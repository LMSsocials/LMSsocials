import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase, getMongoClient } from '../../../lib/mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { verifyNumberQuote, checkQuotedSupplier, reserveQuotedNumber } from '../../../lib/number-provider.js'
import { publicNumberOrder, syncNumberOrder } from '../../../lib/number-order-lifecycle.js'

export const runtime = 'nodejs'
export const maxDuration = 60
const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

async function authenticatedUserId() {
  const store = await cookies()
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  return payload?.sub && ObjectId.isValid(payload.sub) ? new ObjectId(payload.sub) : null
}

export async function GET(request) {
  const userId = await authenticatedUserId()
  if (!userId) return json({ message: 'Authentication required' }, 401)
  const database = await getDatabase()
  const client = await getMongoClient()
  const users = database.collection('users')
  const user = await users.findOne({ _id: userId }, { projection: { balanceKobo: 1, isBanned: 1 } })
  if (!user || user.isBanned) return json({ message: 'Account unavailable' }, 403)
  const collection = database.collection('numberOrders')
  const id = new URL(request.url).searchParams.get('id')
  if (id && !ObjectId.isValid(id)) return json({ message: 'Invalid order' }, 400)
  const filter = id ? { userId, _id: new ObjectId(id) } : { userId }
  const active = await collection.find({ ...filter, status: { $in: ['active', 'cancel_pending', 'cancel_confirmed'] } }).sort({ nextStatusCheckAt: 1, createdAt: 1 }).limit(6).toArray()
  await Promise.all(active.map((order) => syncNumberOrder({ database, client, orderId: order._id, userId })))
  const [live, history] = await Promise.all([
    collection.find({ ...filter, status: { $in: ['active', 'cancel_pending', 'cancel_confirmed', 'debit_reserved', 'submission_review'] } }).sort({ createdAt: -1 }).limit(100).toArray(),
    collection.find(filter).sort({ createdAt: -1 }).limit(50).toArray(),
  ])
  const orders = [...new Map([...live, ...history].map((order) => [String(order._id), order])).values()]
  const balanceUser = await users.findOne({ _id: userId }, { projection: { balanceKobo: 1 } })
  return json({ orders: orders.map(publicNumberOrder), balance: Number(balanceUser?.balanceKobo || 0) / 100 })
}

export async function PATCH(request) {
  const userId = await authenticatedUserId()
  if (!userId) return json({ message: 'Authentication required' }, 401)
  const body = await request.json().catch(() => ({}))
  if (body.action !== 'cancel' || !ObjectId.isValid(body.orderId)) return json({ message: 'Invalid cancellation request' }, 400)
  const database = await getDatabase()
  const client = await getMongoClient()
  const user = await database.collection('users').findOne({ _id: userId }, { projection: { isBanned: 1 } })
  if (!user || user.isBanned) return json({ message: 'Account unavailable' }, 403)
  const orderId = new ObjectId(body.orderId)
  const orders = database.collection('numberOrders')
  const order = await orders.findOne({ _id: orderId, userId })
  if (!order) return json({ message: 'Order not found' }, 404)
  if (order.status === 'completed' || order.smsCode) return json({ message: 'An SMS has already arrived. This order cannot be refunded.', order: publicNumberOrder(order) }, 409)
  const result = await syncNumberOrder({ database, client, userId, orderId, cancel: true })
  const updated = await orders.findOne({ _id: orderId, userId })
  const balance = await database.collection('users').findOne({ _id: userId }, { projection: { balanceKobo: 1 } })
  return json({ order: publicNumberOrder(updated), balance: Number(balance.balanceKobo || 0) / 100,
    message: updated.status === 'refunded' ? 'Number canceled. Your full payment has been returned to your wallet.'
      : result.message || (result.busy ? 'This order is being checked. Please try again shortly.' : 'Cancellation is being confirmed.'),
  })
}

export async function POST(request) {
  const userId = await authenticatedUserId()
  if (!userId) return json({ message: 'Authentication required' }, 401)
  const body = await request.json().catch(() => ({}))
  const requestId = String(body.requestId || '')
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) return json({ message: 'Invalid purchase request', retrySafe: true }, 400)
  const database = await getDatabase()
  const client = await getMongoClient()
  const users = database.collection('users')
  const orders = database.collection('numberOrders')
  const account = await users.findOne({ _id: userId }, { projection: { isBanned: 1, balanceKobo: 1 } })
  if (!account || account.isBanned) return json({ message: 'Account unavailable', retrySafe: true }, 403)
  await orders.createIndex({ requestId: 1 }, { unique: true })
  const existing = await orders.findOne({ requestId, userId })
  if (existing) return json({ order: publicNumberOrder(existing), balance: Number(account.balanceKobo || 0) / 100,
    message: ['debit_reserved', 'submission_review'].includes(existing.status) ? 'This purchase is saved and awaiting confirmation. Please do not buy it again.' : '',
  })

  let quote
  try { quote = await verifyNumberQuote(body.quoteToken, userId) }
  catch { return json({ message: 'Please refresh the price before purchasing.', retrySafe: true, refreshQuote: true }, 409) }
  try { await checkQuotedSupplier(quote) }
  catch { return json({ message: 'This supplier’s price or availability changed. Please review a fresh price.', retrySafe: true, refreshQuote: true }, 409) }
  const priceKobo = quote.sellingPriceKobo
  const orderId = new ObjectId()
  const now = new Date()
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      const user = await users.findOneAndUpdate(
        { _id: userId, isBanned: { $ne: true }, balanceKobo: { $gte: priceKobo } },
        { $inc: { balanceKobo: -priceKobo }, $set: { updatedAt: now } }, { returnDocument: 'after', session },
      )
      if (!user) throw new Error('INSUFFICIENT_BALANCE')
      await orders.insertOne({
        _id: orderId, requestId, userId, serverId: quote.serverId, countryId: quote.countryId, serviceCode: quote.serviceCode,
        countryName: quote.countryName, serviceName: quote.serviceName, providerId: quote.providerId, quality: quote.quality,
        providerPriceUsd: quote.providerPriceUsd, sellingPriceKobo: priceKobo, balanceAfterKobo: user.balanceKobo,
        status: 'debit_reserved', createdAt: now, updatedAt: now,
      }, { session })
    })
  } catch (error) {
    if (error.message === 'INSUFFICIENT_BALANCE') return json({ message: 'Insufficient wallet balance', required: priceKobo / 100, retrySafe: true }, 402)
    if (error.code === 11000) return json({ message: 'This purchase is already processing. Check your numbers below.' }, 409)
    return json({ message: 'Unable to confirm wallet reservation. Retry to check this same request.' }, 500)
  } finally { await session.endSession() }

  let activation
  try { activation = await reserveQuotedNumber(quote) }
  catch (error) {
    if (error.definitive) {
      const refundSession = client.startSession()
      try {
        await refundSession.withTransaction(async () => {
          const result = await orders.updateOne({ _id: orderId, status: 'debit_reserved' }, { $set: { status: 'refunded', failureReason: error.code, refundedAt: new Date(), updatedAt: new Date() } }, { session: refundSession })
          if (result.modifiedCount === 1) {
            await users.updateOne({ _id: userId }, { $inc: { balanceKobo: priceKobo } }, { session: refundSession })
            await database.collection('numberRefunds').insertOne({ _id: orderId, userId, amountKobo: priceKobo, reason: 'reservation_rejected', createdAt: new Date() }, { session: refundSession })
          }
        })
      } finally { await refundSession.endSession() }
    } else {
      await orders.updateOne({ _id: orderId }, { $set: { status: 'submission_review', updatedAt: new Date() } })
    }
    const order = await orders.findOne({ _id: orderId })
    const user = await users.findOne({ _id: userId }, { projection: { balanceKobo: 1 } })
    return json({ order: publicNumberOrder(order), balance: user.balanceKobo / 100,
      message: error.definitive ? 'This supplier could not reserve a number. Your wallet has been fully refunded.'
        : 'The provider has not confirmed the number yet. Your request is saved for support; please do not buy it again.',
    }, error.definitive ? 200 : 202)
  }

  const completed = {
    status: 'active', activationId: String(activation.activationId), phoneNumber: String(activation.phoneNumber),
    providerActivationCostUsd: Number(activation.activationCost ?? quote.providerPriceUsd), countryCode: activation.countryCode,
    reservedAt: new Date(), updatedAt: new Date(),
  }
  try { await orders.updateOne({ _id: orderId }, { $set: completed }) }
  catch (error) {
    console.error('[numbers] activation needs recovery', { orderId: String(orderId), activationId: completed.activationId, message: error.message })
    return json({ message: 'Your reservation needs confirmation. Retry this request to check its status.' }, 503)
  }
  const order = await orders.findOne({ _id: orderId })
  const user = await users.findOne({ _id: userId }, { projection: { balanceKobo: 1 } })
  return json({ order: publicNumberOrder(order), balance: Number(user.balanceKobo) / 100 }, 201)
}

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase, getMongoClient } from '../../../lib/mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { koboToNaira, numberSellingPriceKobo } from '../../../lib/number-pricing'

const PROVIDER_URL = 'https://smsbower.page/stubs/handler_api.php'
const VALID_SERVERS = new Set(['1', '2', '3'])

async function authenticatedUserId() {
  const store = await cookies()
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  return payload?.sub && ObjectId.isValid(payload.sub) ? new ObjectId(payload.sub) : null
}

async function providerRequest(action, parameters = {}) {
  const apiKey = process.env.SMSBOWER_API_KEY
  if (!apiKey) throw new Error('Number provider is not configured')
  const url = new URL(PROVIDER_URL)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('action', action)
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000), cache: 'no-store' })
  const text = await response.text()
  if (!response.ok) throw new Error('Provider request failed')
  return text
}

async function currentProviderPrice(countryId, serviceCode) {
  const text = await providerRequest('getPrices', { country: countryId, service: serviceCode })
  let payload
  try { payload = JSON.parse(text) } catch { throw new Error('Provider price is unavailable') }
  const price = Number(payload?.[countryId]?.[serviceCode]?.cost)
  if (!Number.isFinite(price) || price <= 0) throw new Error('Selected number is unavailable')
  return price
}

async function reserveNumber(countryId, serviceCode, maxPrice) {
  const text = await providerRequest('getNumberV2', { country: countryId, service: serviceCode, maxPrice })
  let payload
  try { payload = JSON.parse(text) } catch { throw new Error(text || 'Provider purchase failed') }
  if (!payload?.activationId || !payload?.phoneNumber) throw new Error(payload?.message || payload?.error || 'No number is currently available')
  return payload
}

export async function GET() {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  const database = await getDatabase()
  const orders = await database.collection('numberOrders').find({ userId }).sort({ createdAt: -1 }).limit(50).toArray()
  return NextResponse.json({ orders: orders.map((order) => ({ ...order, _id: String(order._id), userId: undefined })) })
}

export async function POST(request) {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const serverId = String(body.serverId || '')
  const countryId = String(body.countryId || '')
  const serviceCode = String(body.serviceCode || '')
  const requestId = String(body.requestId || '')

  if (!VALID_SERVERS.has(serverId) || !countryId || !serviceCode || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
    return NextResponse.json({ message: 'Invalid purchase request' }, { status: 400 })
  }

  const database = await getDatabase()
  const client = await getMongoClient()
  const users = database.collection('users')
  const orders = database.collection('numberOrders')
  await orders.createIndex({ requestId: 1 }, { unique: true })

  const existing = await orders.findOne({ requestId, userId })
  if (existing?.status === 'active') return NextResponse.json({ order: existing, balance: existing.balanceAfterKobo / 100 })
  if (existing) return NextResponse.json({ message: 'This purchase is already being processed' }, { status: 409 })

  let providerPriceUsd
  try { providerPriceUsd = await currentProviderPrice(countryId, serviceCode) }
  catch (error) { return NextResponse.json({ message: error.message }, { status: 409 }) }

  const sellingPriceKobo = numberSellingPriceKobo(providerPriceUsd, serverId)
  const orderId = new ObjectId()
  const session = client.startSession()
  let balanceAfterKobo

  try {
    await session.withTransaction(async () => {
      const user = await users.findOneAndUpdate(
        { _id: userId, isBanned: { $ne: true }, balanceKobo: { $gte: sellingPriceKobo } },
        { $inc: { balanceKobo: -sellingPriceKobo }, $set: { updatedAt: new Date(), balanceCurrency: 'NGN' } },
        { returnDocument: 'after', session },
      )
      if (!user) throw new Error('INSUFFICIENT_BALANCE')
      balanceAfterKobo = user.balanceKobo
      await orders.insertOne({
        _id: orderId, requestId, userId, serverId, countryId, serviceCode,
        providerPriceUsd, sellingPriceKobo, balanceAfterKobo,
        status: 'debit_reserved', createdAt: new Date(), updatedAt: new Date(),
      }, { session })
    })
  } catch (error) {
    if (error.message === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json({ message: 'Insufficient wallet balance', required: koboToNaira(sellingPriceKobo) }, { status: 402 })
    }
    if (error.code === 11000) return NextResponse.json({ message: 'This purchase is already being processed' }, { status: 409 })
    console.error('[numbers/purchase] debit failed', { message: error.message })
    return NextResponse.json({ message: 'Unable to reserve wallet funds' }, { status: 500 })
  } finally {
    await session.endSession()
  }

  let activation
  try {
    activation = await reserveNumber(countryId, serviceCode, providerPriceUsd)
  } catch (error) {
    const refundSession = client.startSession()
    try {
      await refundSession.withTransaction(async () => {
        const result = await orders.updateOne(
          { _id: orderId, status: 'debit_reserved' },
          { $set: { status: 'refunded', failureReason: error.message, updatedAt: new Date(), refundedAt: new Date() } },
          { session: refundSession },
        )
        if (result.modifiedCount === 1) {
          await users.updateOne({ _id: userId }, { $inc: { balanceKobo: sellingPriceKobo }, $set: { updatedAt: new Date() } }, { session: refundSession })
        }
      })
    } finally { await refundSession.endSession() }
    return NextResponse.json({ message: error.message || 'Number purchase failed; wallet debit was refunded' }, { status: 409 })
  }

  const completed = {
    status: 'active',
    activationId: String(activation.activationId),
    phoneNumber: String(activation.phoneNumber),
    providerActivationCostUsd: Number(activation.activationCost ?? providerPriceUsd),
    countryCode: activation.countryCode,
    canGetAnotherSms: Boolean(activation.canGetAnotherSms),
    updatedAt: new Date(),
  }
  try { await orders.updateOne({ _id: orderId }, { $set: completed }) }
  catch (error) { console.error('[numbers/purchase] activation persistence failed', { orderId: String(orderId), activationId: completed.activationId, message: error.message }) }

  return NextResponse.json({
    order: { _id: String(orderId), serverId, countryId, serviceCode, sellingPrice: koboToNaira(sellingPriceKobo), ...completed },
    balance: koboToNaira(balanceAfterKobo),
  }, { status: 201 })
}

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { getDatabase, getMongoClient } from '../../../lib/mongodb'
import {
  BoostingProviderError,
  getBoostingOrderStatus,
  getCurrentBoostingService,
  placeBoostingOrder,
} from '../../../lib/boosting-provider'
import { boostingOrderPriceKobo } from '../../../lib/boosting-pricing'
import { validateBoostingInput } from '../../../lib/boosting-validation.js'

export const runtime = 'nodejs'

async function authenticatedUserId() {
  const store = await cookies()
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  return payload?.sub && ObjectId.isValid(payload.sub) ? new ObjectId(payload.sub) : null
}

function publicOrder(order) {
  return {
    _id: String(order._id), serviceId: order.serviceId, serviceName: order.serviceName,
    category: order.category, target: order.target, quantity: order.quantity,
    priceKobo: Number(order.priceKobo || 0), status: order.status, providerStatus: order.providerStatus || null,
    providerOrderId: order.providerOrderId || null, remains: order.remains ?? null,
    startCount: order.startCount ?? null, createdAt: order.createdAt, updatedAt: order.updatedAt,
  }
}

async function refundReservedOrder({ client, users, orders, orderId, userId, priceKobo, reason }) {
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      const result = await orders.updateOne(
        { _id: orderId, status: 'supplier_reserved' },
        { $set: { status: 'refunded', failureReason: reason, refundedAt: new Date(), updatedAt: new Date() } },
        { session },
      )
      if (result.modifiedCount === 1) {
        await users.updateOne({ _id: userId }, { $inc: { balanceKobo: priceKobo }, $set: { updatedAt: new Date() } }, { session })
      }
    })
  } finally { await session.endSession() }
}

async function refreshOrderStatus(orders, order) {
  if (!order.providerOrderId || !['pending', 'processing', 'in_progress'].includes(order.status)) return
  try {
    const status = await getBoostingOrderStatus(order.providerOrderId)
    await orders.updateOne({ _id: order._id }, { $set: { ...status, updatedAt: new Date(), statusCheckedAt: new Date() } })
  } catch (error) {
    console.warn('[boosting/status] provider check failed', { orderId: String(order._id), message: error.message })
  }
}

export async function GET() {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })

  const database = await getDatabase()
  const orders = database.collection('boostingOrders')
  let recent = await orders.find({ userId }).sort({ createdAt: -1 }).limit(100).toArray()
  // A small, bounded refresh keeps user and admin histories useful without
  // turning an overview page into hundreds of supplier status calls.
  await Promise.all(recent.slice(0, 10).map((order) => refreshOrderStatus(orders, order)))
  recent = await orders.find({ userId }).sort({ createdAt: -1 }).limit(100).toArray()
  return NextResponse.json({ orders: recent.map(publicOrder) })
}

export async function POST(request) {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const validation = validateBoostingInput(body)
  if (!validation.valid) {
    return NextResponse.json({ message: Object.values(validation.fieldErrors)[0], fieldErrors: validation.fieldErrors, retrySafe: true }, { status: 400 })
  }
  const { serviceId, requestId, target, quantity } = validation.value

  const database = await getDatabase()
  const users = database.collection('users')
  const account = await users.findOne({ _id: userId }, { projection: { balanceKobo: 1, isBanned: 1 } })
  if (!account || account.isBanned) return NextResponse.json({ message: 'This account cannot place orders.', retrySafe: true }, { status: 403 })
  const orders = database.collection('boostingOrders')
  await orders.createIndex({ requestId: 1 }, { unique: true })

  const existing = await orders.findOne({ requestId, userId })
  if (existing) {
    const pendingReview = ['supplier_reserved', 'submission_review'].includes(existing.status)
    return NextResponse.json({
      message: existing.status === 'refunded' ? 'This order was refunded. You can start a new order.' : pendingReview ? 'This order is awaiting confirmation. Please do not submit another purchase.' : 'Your order has already been submitted.',
      order: publicOrder(existing), balance: Number(account.balanceKobo || 0) / 100, pendingReview,
    })
  }

  let service
  try { service = await getCurrentBoostingService(serviceId) }
  catch (error) {
    const message = error instanceof BoostingProviderError && error.definitive ? error.message : 'Unable to verify the live service price'
    return NextResponse.json({ message, retrySafe: true }, { status: error instanceof BoostingProviderError && error.definitive ? 409 : 502 })
  }
  const serviceValidation = validateBoostingInput(body, service)
  if (!serviceValidation.valid) {
    return NextResponse.json({ message: Object.values(serviceValidation.fieldErrors)[0], fieldErrors: serviceValidation.fieldErrors, retrySafe: true }, { status: 400 })
  }

  let priceKobo
  try { priceKobo = boostingOrderPriceKobo(service.providerRateUsd, quantity) }
  catch { return NextResponse.json({ message: 'Unable to calculate the live order price', retrySafe: true }, { status: 409 }) }

  const client = await getMongoClient()
  const orderId = new ObjectId()
  const now = new Date()
  let balanceAfterKobo
  const debitSession = client.startSession()
  try {
    await debitSession.withTransaction(async () => {
      const user = await users.findOneAndUpdate(
        { _id: userId, isBanned: { $ne: true }, balanceKobo: { $gte: priceKobo } },
        { $inc: { balanceKobo: -priceKobo }, $set: { updatedAt: now, balanceCurrency: 'NGN' } },
        { returnDocument: 'after', session: debitSession },
      )
      if (!user) throw new Error('INSUFFICIENT_BALANCE')
      balanceAfterKobo = Number(user.balanceKobo)
      await orders.insertOne({
        _id: orderId, requestId, userId, serviceId: service.id, serviceName: service.name,
        category: service.category, target, quantity, providerRateUsd: service.providerRateUsd,
        pricePerThousand: service.pricePerThousand, priceKobo, balanceAfterKobo,
        status: 'supplier_reserved', createdAt: now, updatedAt: now,
      }, { session: debitSession })
    })
  } catch (error) {
    if (error.message === 'INSUFFICIENT_BALANCE') return NextResponse.json({ message: 'Insufficient wallet balance', required: priceKobo / 100, retrySafe: true }, { status: 402 })
    if (error.code === 11000) return NextResponse.json({ message: 'This purchase request is already being processed' }, { status: 409 })
    console.error('[boosting/purchase] wallet reservation failed', { message: error.message })
    return NextResponse.json({ message: 'Unable to reserve wallet funds' }, { status: 500 })
  } finally { await debitSession.endSession() }

  let providerOrderId
  try {
    providerOrderId = await placeBoostingOrder({ serviceId: service.id, target, quantity })
  } catch (error) {
    if (error instanceof BoostingProviderError && error.definitive) {
      await refundReservedOrder({ client, users, orders, orderId, userId, priceKobo, reason: error.message })
      const refundedUser = await users.findOne({ _id: userId }, { projection: { balanceKobo: 1 } })
      return NextResponse.json({ message: 'The provider could not accept this order. Your wallet has been refunded.', retrySafe: true, balance: Number(refundedUser?.balanceKobo || 0) / 100 }, { status: 409 })
    }

    // A timeout can happen after a provider accepts the order. Keep the debit
    // protected for review instead of risking a duplicate supplier order.
    await orders.updateOne({ _id: orderId, status: 'supplier_reserved' }, { $set: { status: 'submission_review', failureReason: error.message, updatedAt: new Date() } })
    const reviewOrder = await orders.findOne({ _id: orderId })
    return NextResponse.json({
      message: 'Your order is being confirmed with the provider. Please do not submit it again; support can see the saved request.',
      order: publicOrder(reviewOrder), balance: balanceAfterKobo / 100, pendingReview: true,
    }, { status: 202 })
  }

  const completedAt = new Date()
  await orders.updateOne({ _id: orderId }, { $set: {
    providerOrderId, status: 'pending', providerStatus: 'Pending', submittedAt: completedAt, updatedAt: completedAt,
  } })
  const completed = await orders.findOne({ _id: orderId })
  return NextResponse.json({ order: publicOrder(completed), balance: balanceAfterKobo / 100 }, { status: 201 })
}

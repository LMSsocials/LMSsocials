import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { ESIM_PLANS, getEsimPlans, publicEsimOrder } from '../../../lib/esim'
import { getDatabase, getMongoClient } from '../../../lib/mongodb'

export const runtime = 'nodejs'

async function authenticatedUserId() {
  const store = await cookies()
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  return payload?.sub && ObjectId.isValid(payload.sub) ? new ObjectId(payload.sub) : null
}

export async function GET() {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  const database = await getDatabase()
  const orders = await database.collection('esimOrders').find({ userId }).sort({ createdAt: -1 }).limit(100).toArray()
  return NextResponse.json({ orders: orders.map(publicEsimOrder) })
}

export async function POST(request) {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const plan = ESIM_PLANS.find((item) => item.id === body.planId)
  const requestId = String(body.requestId || '')
  if (!plan || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) return NextResponse.json({ message: 'Invalid purchase request' }, { status: 400 })
  if (!/^234\d{10}$/.test(String(process.env.ESIM_WHATSAPP_NUMBER || '').replace(/\D/g, ''))) {
    return NextResponse.json({ message: 'eSIM delivery support is not configured yet' }, { status: 503 })
  }

  const database = await getDatabase()
  const client = await getMongoClient()
  const orders = database.collection('esimOrders')
  await orders.createIndex({ requestId: 1 }, { unique: true })
  if (await orders.findOne({ requestId, userId })) return NextResponse.json({ message: 'This purchase request has already been used' }, { status: 409 })

  const orderId = new ObjectId()
  const now = new Date()
  const session = client.startSession()
  let priceKobo
  let balanceAfterKobo
  try {
    await session.withTransaction(async () => {
      const plans = await getEsimPlans(database, { session })
      priceKobo = plans.find((item) => item.id === plan.id)?.priceKobo
      if (!priceKobo) throw new Error('NOT_AVAILABLE')
      const user = await database.collection('users').findOneAndUpdate(
        { _id: userId, isBanned: { $ne: true }, balanceKobo: { $gte: priceKobo } },
        { $inc: { balanceKobo: -priceKobo }, $set: { updatedAt: now, balanceCurrency: 'NGN' } },
        { returnDocument: 'after', session },
      )
      if (!user) throw new Error('INSUFFICIENT_BALANCE')
      balanceAfterKobo = user.balanceKobo
      await orders.insertOne({
        _id: orderId, requestId, userId, planId: plan.id, planName: plan.name, months: plan.months,
        priceKobo, balanceAfterKobo, status: 'awaiting_code', createdAt: now, updatedAt: now,
      }, { session })
    })
  } catch (error) {
    if (error.message === 'NOT_AVAILABLE') return NextResponse.json({ message: 'This eSIM plan is not available yet' }, { status: 409 })
    if (error.message === 'INSUFFICIENT_BALANCE') return NextResponse.json({ message: 'Insufficient wallet balance' }, { status: 402 })
    if (error.code === 11000) return NextResponse.json({ message: 'This purchase request has already been used' }, { status: 409 })
    console.error('[esim/purchase]', { message: error.message })
    return NextResponse.json({ message: 'Unable to complete eSIM purchase' }, { status: 500 })
  } finally {
    await session.endSession()
  }

  const order = { _id: orderId, planId: plan.id, planName: plan.name, months: plan.months, priceKobo, status: 'awaiting_code', createdAt: now }
  return NextResponse.json({ order: publicEsimOrder(order), balance: balanceAfterKobo / 100 }, { status: 201 })
}

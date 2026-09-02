import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase, getMongoClient } from '../../../lib/mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'

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
  const orders = await database.collection('formatOrders').find({ userId, status: 'delivered' }).sort({ createdAt: -1 }).limit(100).toArray()
  return NextResponse.json({ orders: orders.map((order) => ({ ...order, _id: String(order._id), assetId: String(order.assetId), downloadUrl: `/api/format-download/${order._id}` })) })
}

export async function POST(request) {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!ObjectId.isValid(body.assetId) || !/^[a-zA-Z0-9-]{16,80}$/.test(String(body.requestId || ''))) return NextResponse.json({ message: 'Invalid purchase request' }, { status: 400 })

  const assetId = new ObjectId(body.assetId)
  const database = await getDatabase()
  const client = await getMongoClient()
  const orders = database.collection('formatOrders')
  await Promise.all([orders.createIndex({ requestId: 1 }, { unique: true }), orders.createIndex({ userId: 1, assetId: 1 }, { unique: true })])
  const existing = await orders.findOne({ userId, assetId, status: 'delivered' })
  if (existing) return NextResponse.json({ message: 'This PDF is already in your library', order: { ...existing, _id: String(existing._id), assetId: String(existing.assetId), downloadUrl: `/api/format-download/${existing._id}` } }, { status: 409 })

  const orderId = new ObjectId()
  const now = new Date()
  const session = client.startSession()
  let asset
  let balanceAfterKobo
  try {
    await session.withTransaction(async () => {
      asset = await database.collection('adminAssets').findOne({ _id: assetId, category: 'formats', status: 'live', contentType: 'application/pdf' }, { session })
      if (!asset) throw new Error('NOT_FOUND')
      const user = await database.collection('users').findOneAndUpdate(
        { _id: userId, balanceKobo: { $gte: asset.priceKobo } },
        { $inc: { balanceKobo: -asset.priceKobo }, $set: { updatedAt: now, balanceCurrency: 'NGN' } },
        { returnDocument: 'after', session },
      )
      if (!user) throw new Error('INSUFFICIENT_BALANCE')
      balanceAfterKobo = user.balanceKobo
      await orders.insertOne({ _id: orderId, requestId: String(body.requestId), userId, assetId, title: asset.title, fileName: asset.fileName, priceKobo: asset.priceKobo, balanceAfterKobo, status: 'delivered', createdAt: now, updatedAt: now }, { session })
    })
  } catch (error) {
    if (error.message === 'NOT_FOUND') return NextResponse.json({ message: 'This PDF is no longer available' }, { status: 404 })
    if (error.message === 'INSUFFICIENT_BALANCE') return NextResponse.json({ message: 'Insufficient wallet balance' }, { status: 402 })
    if (error.code === 11000) return NextResponse.json({ message: 'This PDF is already in your library' }, { status: 409 })
    console.error('[formats/purchase]', { message: error.message })
    return NextResponse.json({ message: 'Unable to complete PDF purchase' }, { status: 500 })
  } finally { await session.endSession() }

  return NextResponse.json({ order: { _id: String(orderId), assetId: String(assetId), title: asset.title, fileName: asset.fileName, priceKobo: asset.priceKobo, createdAt: now, downloadUrl: `/api/format-download/${orderId}` }, balance: balanceAfterKobo / 100 }, { status: 201 })
}

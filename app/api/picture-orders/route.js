import { cookies } from 'next/headers'
import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { getDatabase, getMongoClient } from '../../../lib/mongodb'
import { serializePicture } from '../../../lib/pictures'

export const runtime = 'nodejs'

async function authenticatedUserId() {
  const store = await cookies()
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  return payload?.sub && ObjectId.isValid(payload.sub) ? new ObjectId(payload.sub) : null
}

export async function POST(request) {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (!ObjectId.isValid(body.pictureId) || !/^[a-zA-Z0-9-]{16,80}$/.test(String(body.requestId || ''))) {
    return NextResponse.json({ message: 'Invalid purchase request' }, { status: 400 })
  }

  const pictureId = new ObjectId(body.pictureId)
  const database = await getDatabase()
  const client = await getMongoClient()
  const orders = database.collection('pictureOrders')
  await Promise.all([orders.createIndex({ requestId: 1 }, { unique: true }), orders.createIndex({ userId: 1, pictureId: 1 }, { unique: true })])

  const existing = await orders.findOne({ userId, pictureId, status: 'delivered' })
  if (existing) {
    const picture = await database.collection('pictures').findOne({ _id: pictureId })
    return NextResponse.json({ message: 'You already own this picture', picture: picture ? { ...serializePicture(picture), purchased: true, purchasedAt: existing.createdAt } : null }, { status: 409 })
  }

  const orderId = new ObjectId()
  const now = new Date()
  const mongoSession = client.startSession()
  let picture
  let balanceAfterKobo
  try {
    await mongoSession.withTransaction(async () => {
      picture = await database.collection('pictures').findOne({ _id: pictureId }, { session: mongoSession })
      if (!picture) throw new Error('NOT_FOUND')
      const user = await database.collection('users').findOneAndUpdate(
        { _id: userId, isBanned: { $ne: true }, balanceKobo: { $gte: picture.priceKobo } },
        { $inc: { balanceKobo: -picture.priceKobo }, $set: { updatedAt: now, balanceCurrency: 'NGN' } },
        { returnDocument: 'after', session: mongoSession },
      )
      if (!user) throw new Error('INSUFFICIENT_BALANCE')
      balanceAfterKobo = Number(user.balanceKobo || 0)
      await orders.insertOne({
        _id: orderId, requestId: String(body.requestId), userId, pictureId, title: picture.title,
        priceKobo: Number(picture.priceKobo || 0), balanceAfterKobo, status: 'delivered', createdAt: now, updatedAt: now,
      }, { session: mongoSession })
    })
  } catch (error) {
    if (error.message === 'NOT_FOUND') return NextResponse.json({ message: 'This picture is no longer available' }, { status: 404 })
    if (error.message === 'INSUFFICIENT_BALANCE') return NextResponse.json({ message: 'Insufficient wallet balance' }, { status: 402 })
    if (error.code === 11000) return NextResponse.json({ message: 'You already own this picture' }, { status: 409 })
    console.error('[pictures/purchase]', { message: error.message })
    return NextResponse.json({ message: 'Unable to complete picture purchase' }, { status: 500 })
  } finally { await mongoSession.endSession() }

  return NextResponse.json({
    order: { _id: String(orderId), pictureId: String(pictureId), title: picture.title, priceKobo: Number(picture.priceKobo || 0), status: 'delivered', createdAt: now },
    picture: { ...serializePicture(picture), purchased: true, purchasedAt: now },
    balance: balanceAfterKobo / 100,
  }, { status: 201 })
}

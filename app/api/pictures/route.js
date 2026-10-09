import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { getDatabase } from '../../../lib/mongodb'
import { serializePicture } from '../../../lib/pictures'

export const runtime = 'nodejs'

export async function GET() {
  const store = await cookies()
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!session?.sub || !ObjectId.isValid(session.sub)) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })

  const database = await getDatabase()
  const userId = new ObjectId(session.sub)
  const [pictures, orders] = await Promise.all([
    database.collection('pictures').find({}).sort({ createdAt: -1 }).toArray(),
    database.collection('pictureOrders').find({ userId, status: 'delivered' }, { projection: { pictureId: 1, createdAt: 1 } }).toArray(),
  ])
  const purchased = new Map(orders.map((order) => [String(order.pictureId), order.createdAt]))
  return NextResponse.json({ pictures: pictures.map((picture) => {
    const purchasedAt = purchased.get(String(picture._id))
    return { ...serializePicture(picture, { includeDownloadUrl: Boolean(purchasedAt) }), purchased: Boolean(purchasedAt), ...(purchasedAt ? { purchasedAt } : {}) }
  }) })
}

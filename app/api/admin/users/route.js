import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAdminSession } from '../../../../lib/admin'
import { isAdminEmail } from '../../../../lib/auth'
import { getDatabase } from '../../../../lib/mongodb'

export const runtime = 'nodejs'

const text = (value) => value == null ? '' : String(value)

export async function GET() {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })

  const database = await getDatabase()
  const users = await database.collection('users').find({}, {
    projection: { email: 1, name: 1, balanceKobo: 1, createdAt: 1, updatedAt: 1, isBanned: 1, bannedAt: 1 },
  }).sort({ createdAt: -1 }).limit(250).toArray()
  const userIds = users.map((user) => user._id)

  const [voucherOrders, formatOrders, numberOrders, boostingOrders] = userIds.length ? await Promise.all([
    database.collection('voucherOrders').find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).limit(1000).toArray(),
    database.collection('formatOrders').find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).limit(1000).toArray(),
    database.collection('numberOrders').find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).limit(1000).toArray(),
    database.collection('boostingOrders').find({ userId: { $in: userIds } }).sort({ createdAt: -1 }).limit(1000).toArray(),
  ]) : [[], [], [], []]

  const ordersByUser = new Map(userIds.map((id) => [String(id), []]))
  const addOrder = (userId, order) => ordersByUser.get(String(userId))?.push(order)
  voucherOrders.forEach((order) => addOrder(order.userId, {
    id: String(order._id), requestId: text(order.requestId), apiOrderId: text(order.providerOrderId), type: 'Log',
    item: order.productTitle || order.brand || 'Log product', amountKobo: Number(order.priceKobo || 0),
    status: order.status || 'delivered', createdAt: order.createdAt,
  }))
  formatOrders.forEach((order) => addOrder(order.userId, {
    id: String(order._id), requestId: text(order.requestId), apiOrderId: '', type: 'File',
    item: order.title || order.fileName || 'Download', amountKobo: Number(order.priceKobo || 0),
    status: order.status || 'delivered', createdAt: order.createdAt,
  }))
  numberOrders.forEach((order) => addOrder(order.userId, {
    id: String(order._id), requestId: text(order.requestId), apiOrderId: text(order.activationId), type: 'Number',
    item: [order.countryCode || order.countryId, order.serviceCode].filter(Boolean).join(' · ') || 'Virtual number',
    amountKobo: Number(order.sellingPriceKobo || 0), status: order.status || 'processing', createdAt: order.createdAt,
  }))
  boostingOrders.forEach((order) => addOrder(order.userId, {
    id: String(order._id), requestId: text(order.requestId), apiOrderId: text(order.providerOrderId), type: 'Boosting',
    item: order.serviceName || 'Social media boost', amountKobo: Number(order.priceKobo || 0),
    status: order.status || 'pending', createdAt: order.createdAt,
  }))

  return NextResponse.json({ users: users.map((user) => {
    const orders = (ordersByUser.get(String(user._id)) || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return {
      id: String(user._id), email: user.email, name: user.name || '', balanceKobo: Number(user.balanceKobo || 0),
      createdAt: user.createdAt, updatedAt: user.updatedAt, isBanned: Boolean(user.isBanned), bannedAt: user.bannedAt || null,
      isAdmin: isAdminEmail(user.email), orderCount: orders.length,
      totalSpentKobo: orders.filter((order) => !['refunded', 'failed'].includes(order.status)).reduce((sum, order) => sum + order.amountKobo, 0),
      orders,
    }
  }) })
}

export async function PATCH(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!ObjectId.isValid(body.userId) || typeof body.isBanned !== 'boolean') return NextResponse.json({ message: 'Invalid request' }, { status: 400 })

  const database = await getDatabase()
  const users = database.collection('users')
  const user = await users.findOne({ _id: new ObjectId(body.userId) }, { projection: { email: 1 } })
  if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 })
  if (isAdminEmail(user.email) || String(user._id) === String(admin.sub)) return NextResponse.json({ message: 'Administrator accounts cannot be banned' }, { status: 400 })

  const now = new Date()
  await users.updateOne({ _id: user._id }, {
    $set: body.isBanned
      ? { isBanned: true, bannedAt: now, bannedBy: admin.email, updatedAt: now }
      : { isBanned: false, unbannedAt: now, updatedAt: now },
    ...(body.isBanned ? {} : { $unset: { bannedAt: '', bannedBy: '' } }),
  })
  return NextResponse.json({ success: true, isBanned: body.isBanned })
}

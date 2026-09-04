import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase, getMongoClient } from '../../../lib/mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { decryptVoucherCode, encryptVoucherCode } from '../../../lib/voucher-crypto'
import { bulkProduct, placeBulkOrder, placeSujanOrder, retrieveBulkOrder, sujanProduct } from '../../../lib/log-providers'

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
  const orderCollection = database.collection('voucherOrders')
  let orders = await orderCollection.find({ userId, status: { $in: ['delivered', 'processing'] } }).sort({ createdAt: -1 }).limit(100).toArray()
  const pendingBulk = orders.filter((order) => order.status === 'processing' && order.source === 'bulkacc' && order.providerOrderId)
  await Promise.all(pendingBulk.map(async (order) => {
    const code = await retrieveBulkOrder(order.providerOrderId).catch(() => '')
    if (!code) return
    await orderCollection.updateOne({ _id: order._id, status: 'processing' }, { $set: { ...encryptVoucherCode(code), status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() } })
  }))
  if (pendingBulk.length) orders = await orderCollection.find({ userId, status: { $in: ['delivered', 'processing'] } }).sort({ createdAt: -1 }).limit(100).toArray()
  const inventoryIds = orders.map((order) => order.inventoryItemId)
  const items = inventoryIds.length ? await database.collection('voucherInventory').find({ _id: { $in: inventoryIds }, purchasedBy: userId }).toArray() : []
  const itemMap = new Map(items.map((item) => [String(item._id), item]))
  return NextResponse.json({
    orders: orders.map((order) => {
      const item = itemMap.get(String(order.inventoryItemId))
      return {
        _id: String(order._id), productId: String(order.productId), productTitle: order.productTitle,
        brand: order.brand, priceKobo: order.priceKobo, createdAt: order.createdAt, status: order.status,
        code: item ? decryptVoucherCode(item) : order.encryptedCode ? decryptVoucherCode(order) : null,
      }
    }),
  })
}

export async function POST(request) {
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const productReference = String(body.productId || '')
  const [source, sourceId] = productReference.includes(':') ? productReference.split(/:(.+)/) : ['managed', productReference]
  if (!['managed', 'bulkacc', 'sujan'].includes(source) || !sourceId || !/^[a-zA-Z0-9-]{16,80}$/.test(String(body.requestId || ''))) {
    return NextResponse.json({ message: 'Invalid purchase request' }, { status: 400 })
  }

  if (source !== 'managed') return purchaseSupplierProduct({ userId, source, sourceId, requestId: String(body.requestId) })
  if (!ObjectId.isValid(sourceId)) return NextResponse.json({ message: 'Invalid purchase request' }, { status: 400 })

  const productId = new ObjectId(sourceId)
  const requestId = String(body.requestId)
  const database = await getDatabase()
  const client = await getMongoClient()
  const products = database.collection('voucherProducts')
  const inventory = database.collection('voucherInventory')
  const users = database.collection('users')
  const orders = database.collection('voucherOrders')
  await Promise.all([
    inventory.createIndex({ productId: 1, isSold: 1, createdAt: 1 }),
    orders.createIndex({ requestId: 1 }, { unique: true }),
  ])

  const existing = await orders.findOne({ requestId, userId })
  if (existing) return NextResponse.json({ message: 'This purchase request has already been used' }, { status: 409 })

  const orderId = new ObjectId()
  const now = new Date()
  const session = client.startSession()
  let deliveredItem
  let balanceAfterKobo
  let purchasedProduct
  try {
    await session.withTransaction(async () => {
      purchasedProduct = await products.findOne({ _id: productId, isPublished: true, stockCount: { $gt: 0 } }, { session })
      if (!purchasedProduct) throw new Error('OUT_OF_STOCK')

      deliveredItem = await inventory.findOneAndUpdate(
        { productId, isSold: false },
        { $set: { isSold: true, purchasedBy: userId, orderId, soldAt: now, updatedAt: now } },
        { sort: { createdAt: 1 }, returnDocument: 'after', session },
      )
      if (!deliveredItem) throw new Error('OUT_OF_STOCK')

      const user = await users.findOneAndUpdate(
        { _id: userId, isBanned: { $ne: true }, balanceKobo: { $gte: purchasedProduct.priceKobo } },
        { $inc: { balanceKobo: -purchasedProduct.priceKobo }, $set: { updatedAt: now, balanceCurrency: 'NGN' } },
        { returnDocument: 'after', session },
      )
      if (!user) throw new Error('INSUFFICIENT_BALANCE')
      balanceAfterKobo = user.balanceKobo

      const stockResult = await products.updateOne(
        { _id: productId, stockCount: { $gt: 0 } },
        { $inc: { stockCount: -1 }, $set: { updatedAt: now } },
        { session },
      )
      if (stockResult.modifiedCount !== 1) throw new Error('OUT_OF_STOCK')

      await orders.insertOne({
        _id: orderId, requestId, userId, productId, inventoryItemId: deliveredItem._id,
        productTitle: purchasedProduct.title, brand: purchasedProduct.brand,
        priceKobo: purchasedProduct.priceKobo, balanceAfterKobo, status: 'delivered', createdAt: now, updatedAt: now,
      }, { session })
    })
  } catch (error) {
    if (error.message === 'OUT_OF_STOCK') return NextResponse.json({ message: 'This voucher is sold out' }, { status: 409 })
    if (error.message === 'INSUFFICIENT_BALANCE') return NextResponse.json({ message: 'Insufficient wallet balance' }, { status: 402 })
    if (error.code === 11000) return NextResponse.json({ message: 'This purchase request has already been used' }, { status: 409 })
    console.error('[vouchers/purchase]', { message: error.message })
    return NextResponse.json({ message: 'Unable to complete voucher purchase' }, { status: 500 })
  } finally {
    await session.endSession()
  }

  return NextResponse.json({
    order: {
      _id: String(orderId), productId: String(productId), productTitle: purchasedProduct.title,
      brand: purchasedProduct.brand, priceKobo: purchasedProduct.priceKobo, createdAt: now,
      code: decryptVoucherCode(deliveredItem),
    },
    balance: balanceAfterKobo / 100,
  }, { status: 201 })
}

async function purchaseSupplierProduct({ userId, source, sourceId, requestId }) {
  let product
  try { product = source === 'bulkacc' ? await bulkProduct(sourceId) : await sujanProduct(sourceId) }
  catch (error) { return NextResponse.json({ message: error.message === 'OUT_OF_STOCK' ? 'This product is sold out' : 'Unable to verify supplier stock' }, { status: error.message === 'OUT_OF_STOCK' ? 409 : 502 }) }

  const database = await getDatabase()
  const client = await getMongoClient()
  const users = database.collection('users')
  const orders = database.collection('voucherOrders')
  await orders.createIndex({ requestId: 1 }, { unique: true })
  const existing = await orders.findOne({ requestId, userId })
  if (existing) return NextResponse.json({ message: 'This purchase request has already been used' }, { status: 409 })

  const orderId = new ObjectId()
  const now = new Date()
  const session = client.startSession()
  let balanceAfterKobo
  try {
    await session.withTransaction(async () => {
      const user = await users.findOneAndUpdate(
        { _id: userId, isBanned: { $ne: true }, balanceKobo: { $gte: product.priceKobo } },
        { $inc: { balanceKobo: -product.priceKobo }, $set: { updatedAt: now, balanceCurrency: 'NGN' } },
        { returnDocument: 'after', session },
      )
      if (!user) throw new Error('INSUFFICIENT_BALANCE')
      balanceAfterKobo = user.balanceKobo
      await orders.insertOne({
        _id: orderId, requestId, userId, source, providerProductId: sourceId, productTitle: product.title,
        brand: source === 'sujan' ? 'Marketplace' : 'Digital account', quantity: product.quantity,
        priceKobo: product.priceKobo, balanceAfterKobo, status: 'supplier_reserved', createdAt: now, updatedAt: now,
      }, { session })
    })
  } catch (error) {
    await session.endSession()
    if (error.message === 'INSUFFICIENT_BALANCE') return NextResponse.json({ message: 'Insufficient wallet balance' }, { status: 402 })
    if (error.code === 11000) return NextResponse.json({ message: 'This purchase request has already been used' }, { status: 409 })
    return NextResponse.json({ message: 'Unable to reserve wallet funds' }, { status: 500 })
  }
  await session.endSession()

  let delivery
  try { delivery = source === 'bulkacc' ? await placeBulkOrder(product) : await placeSujanOrder(product) }
  catch (error) {
    const refundSession = client.startSession()
    try {
      await refundSession.withTransaction(async () => {
        const result = await orders.updateOne({ _id: orderId, status: 'supplier_reserved' }, { $set: { status: 'refunded', failureReason: error.message, refundedAt: new Date(), updatedAt: new Date() } }, { session: refundSession })
        if (result.modifiedCount) await users.updateOne({ _id: userId }, { $inc: { balanceKobo: product.priceKobo }, $set: { updatedAt: new Date() } }, { session: refundSession })
      })
    } finally { await refundSession.endSession() }
    return NextResponse.json({ message: 'Supplier could not complete the order; your wallet was refunded' }, { status: 409 })
  }

  const status = delivery.credentials ? 'delivered' : 'processing'
  await orders.updateOne({ _id: orderId }, { $set: {
    providerOrderId: delivery.providerOrderId, status, ...(delivery.credentials ? encryptVoucherCode(delivery.credentials) : {}),
    ...(delivery.credentials ? { deliveredAt: new Date() } : {}), updatedAt: new Date(),
  } })
  return NextResponse.json({
    order: { _id: String(orderId), productId: productReference(source, sourceId), productTitle: product.title, brand: source === 'sujan' ? 'Marketplace' : 'Digital account', priceKobo: product.priceKobo, createdAt: now, status, code: delivery.credentials || null },
    balance: balanceAfterKobo / 100,
  }, { status: 201 })
}

function productReference(source, sourceId) { return `${source}:${sourceId}` }

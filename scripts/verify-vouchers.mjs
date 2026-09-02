import nextEnv from '@next/env'
import { ObjectId } from 'mongodb'
import { createSessionToken, SESSION_COOKIE } from '../lib/auth.js'
import { getDatabase, getMongoClient } from '../lib/mongodb.js'

nextEnv.loadEnvConfig(process.cwd())

const origin = 'http://localhost:3000'
const marker = `codex-voucher-test-${Date.now()}`
const adminEmail = String(process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim()).find(Boolean)
if (!adminEmail) throw new Error('ADMIN_EMAILS is required for this verification')

const database = await getDatabase()
const userId = new ObjectId()
let productId

async function api(path, { token, ...options } = {}) {
  const response = await fetch(origin + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}), ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

try {
  await database.collection('users').insertOne({ _id: userId, email: `${marker}@example.invalid`, name: 'Voucher Test', balanceKobo: 500000, createdAt: new Date(), updatedAt: new Date() })
  const adminToken = await createSessionToken({ _id: new ObjectId(), email: adminEmail, name: 'Admin' })
  const userToken = await createSessionToken({ _id: userId, email: `${marker}@example.invalid`, name: 'Voucher Test' })

  const created = await api('/api/admin/vouchers', { token: adminToken, method: 'POST', body: JSON.stringify({ action: 'createProduct', title: marker, brand: 'Test Brand', category: 'Test', description: 'Disposable verification item', price: 1000 }) })
  assert(created.response.status === 201, `Create product failed: ${created.response.status} ${created.payload.message || ''}`)
  productId = new ObjectId(created.payload.product._id)

  const inventory = await api('/api/admin/vouchers', { token: adminToken, method: 'POST', body: JSON.stringify({ action: 'addInventory', productId: String(productId), codes: `${marker}-A\n${marker}-B\n${marker}-A` }) })
  assert(inventory.response.status === 201 && inventory.payload.insertedCount === 2, 'Bulk inventory did not insert exactly two unique codes')

  const publicCatalog = await api('/api/voucher-products')
  const publicProduct = publicCatalog.payload.products?.find((product) => product._id === String(productId))
  assert(publicProduct?.stockCount === 2, 'Public stock count is incorrect')
  assert(!JSON.stringify(publicProduct).includes(`${marker}-A`), 'Public catalog leaked a voucher code')

  const unauthenticated = await api('/api/voucher-orders')
  assert(unauthenticated.response.status === 401, 'Order history is not authentication-protected')

  const first = await api('/api/voucher-orders', { token: userToken, method: 'POST', body: JSON.stringify({ productId: String(productId), requestId: `${marker}-purchase-A` }) })
  assert(first.response.status === 201, `First purchase failed: ${first.response.status} ${first.payload.message || ''}`)
  assert(first.payload.balance === 4000, 'Wallet was not debited by the product price')
  assert([`${marker}-A`, `${marker}-B`].includes(first.payload.order?.code), 'First purchase did not deliver one valid code')

  const history = await api('/api/voucher-orders', { token: userToken })
  assert(history.response.status === 200 && history.payload.orders?.length === 1, 'Purchaser order history is incorrect')
  assert(history.payload.orders[0].code === first.payload.order.code, 'Order history did not reveal the purchaser code')

  const second = await api('/api/voucher-orders', { token: userToken, method: 'POST', body: JSON.stringify({ productId: String(productId), requestId: `${marker}-purchase-B` }) })
  assert(second.response.status === 201 && second.payload.order.code !== first.payload.order.code, 'Second purchase did not assign the other unique code')
  assert(second.payload.balance === 3000, 'Second wallet debit is incorrect')

  const soldOut = await api('/api/voucher-orders', { token: userToken, method: 'POST', body: JSON.stringify({ productId: String(productId), requestId: `${marker}-purchase-C` }) })
  assert(soldOut.response.status === 409, 'Sold-out inventory accepted another purchase')

  console.log(JSON.stringify({ ok: true, checks: ['admin product creation', 'bulk unique inventory', 'no public code leakage', 'authentication', 'atomic wallet debit', 'one-code delivery', 'purchaser order history', 'sold-out protection'] }, null, 2))
} finally {
  if (productId) {
    await database.collection('voucherOrders').deleteMany({ productId })
    await database.collection('voucherInventory').deleteMany({ productId })
    await database.collection('voucherProducts').deleteOne({ _id: productId })
  }
  await database.collection('users').deleteOne({ _id: userId })
  const client = await getMongoClient()
  await client.close()
  globalThis.__lmsMongoClientPromise = undefined
}

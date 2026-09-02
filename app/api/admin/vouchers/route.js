import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase, getMongoClient } from '../../../../lib/mongodb'
import { encryptVoucherCode, voucherCodeHash } from '../../../../lib/voucher-crypto'

export const runtime = 'nodejs'

const cleanText = (value, max) => String(value || '').trim().slice(0, max)

async function ensureIndexes(database) {
  await Promise.all([
    database.collection('voucherInventory').createIndex({ productId: 1, codeHash: 1 }, { unique: true }),
    database.collection('voucherInventory').createIndex({ productId: 1, isSold: 1, createdAt: 1 }),
    database.collection('voucherOrders').createIndex({ requestId: 1 }, { unique: true }),
  ])
}

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const database = await getDatabase()
  await ensureIndexes(database)
  const products = await database.collection('voucherProducts').find({}).sort({ createdAt: -1 }).limit(100).toArray()
  return NextResponse.json({ products: products.map((product) => ({ ...product, _id: String(product._id) })) })
}

export async function POST(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const action = String(body.action || '')
  const database = await getDatabase()
  await ensureIndexes(database)

  if (action === 'createProduct') {
    const title = cleanText(body.title, 120)
    const brand = cleanText(body.brand, 60)
    const category = cleanText(body.category, 60) || 'Gift cards'
    const description = cleanText(body.description, 500)
    const imageUrl = cleanText(body.imageUrl, 500)
    const priceNaira = Number(body.price)
    if (!title || !brand || !Number.isFinite(priceNaira) || priceNaira < 100) {
      return NextResponse.json({ message: 'Enter a title, brand, and valid price' }, { status: 400 })
    }
    if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('/')) {
      return NextResponse.json({ message: 'Image URL must be an HTTPS URL or local asset path' }, { status: 400 })
    }
    const now = new Date()
    const product = {
      title, brand, category, description, imageUrl,
      priceKobo: Math.round(priceNaira * 100), stockCount: 0, isPublished: true,
      createdBy: admin.email, createdAt: now, updatedAt: now,
    }
    const result = await database.collection('voucherProducts').insertOne(product)
    return NextResponse.json({ product: { ...product, _id: String(result.insertedId) } }, { status: 201 })
  }

  if (action === 'addInventory') {
    if (!ObjectId.isValid(body.productId)) return NextResponse.json({ message: 'Select a valid product' }, { status: 400 })
    const productId = new ObjectId(body.productId)
    const codes = [...new Set(String(body.codes || '').split(/\r?\n/).map((code) => code.trim()).filter(Boolean))]
    if (!codes.length) return NextResponse.json({ message: 'Paste at least one voucher code' }, { status: 400 })
    if (codes.length > 500) return NextResponse.json({ message: 'Upload a maximum of 500 codes at once' }, { status: 400 })
    if (codes.some((code) => code.length < 4 || code.length > 250)) return NextResponse.json({ message: 'Each code must contain 4 to 250 characters' }, { status: 400 })

    const products = database.collection('voucherProducts')
    const inventory = database.collection('voucherInventory')
    const product = await products.findOne({ _id: productId })
    if (!product) return NextResponse.json({ message: 'Product not found' }, { status: 404 })

    const hashes = codes.map((code) => voucherCodeHash(productId, code))
    const existing = await inventory.find({ productId, codeHash: { $in: hashes } }, { projection: { codeHash: 1 } }).toArray()
    const existingHashes = new Set(existing.map((item) => item.codeHash))
    const now = new Date()
    const documents = codes.flatMap((code) => {
      const codeHash = voucherCodeHash(productId, code)
      return existingHashes.has(codeHash) ? [] : [{
        productId, codeHash, ...encryptVoucherCode(code), isSold: false,
        purchasedBy: null, orderId: null, uploadedBy: admin.email, createdAt: now, updatedAt: now,
      }]
    })
    if (!documents.length) return NextResponse.json({ message: 'All pasted codes already exist', insertedCount: 0 }, { status: 409 })

    const client = await getMongoClient()
    const session = client.startSession()
    try {
      await session.withTransaction(async () => {
        await inventory.insertMany(documents, { session, ordered: true })
        await products.updateOne({ _id: productId }, { $inc: { stockCount: documents.length }, $set: { updatedAt: now } }, { session })
      })
    } catch (error) {
      if (error.code === 11000) return NextResponse.json({ message: 'Some codes were uploaded by another request; refresh and retry' }, { status: 409 })
      throw error
    } finally {
      await session.endSession()
    }
    return NextResponse.json({ insertedCount: documents.length, skippedCount: codes.length - documents.length }, { status: 201 })
  }

  return NextResponse.json({ message: 'Unsupported admin action' }, { status: 400 })
}

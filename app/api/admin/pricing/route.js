import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase } from '../../../../lib/mongodb'
import { BULKACC_LOG_PRODUCTS, sujanCatalog } from '../../../../lib/log-providers'
import { getSupplierPricing, supplierProductPriceKobo } from '../../../../lib/supplier-pricing'

export const runtime = 'nodejs'

const serviceSummary = (item) => ({
  id: item._id,
  source: item.source,
  title: item.title,
  category: item.category,
  priceKobo: item.priceKobo,
})

async function getSupplierServices(database, pricing) {
  const bulkItems = BULKACC_LOG_PRODUCTS.map((item) => ({
    _id: `bulkacc:${item.code}`,
    source: 'bulkacc',
    title: item.title,
    category: item.category,
    priceKobo: supplierProductPriceKobo(pricing, `bulkacc:${item.code}`, item.priceKobo),
  }))
  const cached = await database.collection('supplierCatalogCache').findOne({ source: 'sujan' })
  let sujanItems = (cached?.items || []).map((item) => ({
    ...item,
    priceKobo: supplierProductPriceKobo(pricing, item._id, item.basePriceKobo ?? item.priceKobo),
  }))
  if (!sujanItems.length) {
    try {
      sujanItems = await sujanCatalog(pricing)
    } catch (error) {
      console.error('[admin/pricing] supplier catalog unavailable', { message: error.message })
      sujanItems = []
    }
  }
  return [...bulkItems, ...sujanItems].map(serviceSummary)
    .sort((left, right) => left.category.localeCompare(right.category) || left.title.localeCompare(right.title))
}

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const database = await getDatabase()
  const pricing = await getSupplierPricing(database)
  return NextResponse.json({ services: await getSupplierServices(database, pricing) })
}

export async function PATCH(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const submitted = body.prices
  if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted) || Object.keys(submitted).length > 1000) {
    return NextResponse.json({ message: 'Submit a valid service price list' }, { status: 400 })
  }
  const database = await getDatabase()
  const currentPricing = await getSupplierPricing(database)
  const pricesKobo = body.mode === 'merge' ? { ...currentPricing.pricesKobo } : {}
  for (const [reference, value] of Object.entries(submitted)) {
    if (!/^(bulkacc|sujan):[a-zA-Z0-9_-]{1,80}$/.test(reference)) {
      return NextResponse.json({ message: 'A service reference is invalid' }, { status: 400 })
    }
    if (value === '' || value == null) continue
    const priceNaira = Number(value)
    const priceKobo = Math.round(priceNaira * 100)
    if (!Number.isFinite(priceNaira) || !Number.isSafeInteger(priceKobo) || priceKobo < 10000 || priceKobo > 1000000000) {
      return NextResponse.json({ message: 'Each service price must be between ₦100 and ₦10,000,000' }, { status: 400 })
    }
    pricesKobo[reference] = priceKobo
  }
  const now = new Date()
  await database.collection('storeSettings').updateOne(
    { _id: 'supplier-pricing' },
    { $set: { pricesKobo, updatedAt: now, updatedBy: admin.email } },
    { upsert: true },
  )
  const pricing = await getSupplierPricing(database)
  return NextResponse.json({ services: await getSupplierServices(database, pricing) })
}

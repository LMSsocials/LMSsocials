import { NextResponse } from 'next/server'
import { getDatabase } from '../../../lib/mongodb'
import { LOG_PRICE_RULES_VERSION, logCategory, sujanCatalog } from '../../../lib/log-providers'
import { getSupplierPricing } from '../../../lib/supplier-pricing'

export const runtime = 'nodejs'

export async function GET() {
  const database = await getDatabase()
  const pricing = await getSupplierPricing(database)
  const pricingVersion = `sujan:${pricing.sujanMarkupPercent}|rules:${LOG_PRICE_RULES_VERSION}`
  const [managed, cacheDocument] = await Promise.all([
    database.collection('voucherProducts')
      .find({ isPublished: true }, { projection: { title: 1, brand: 1, category: 1, description: 1, imageUrl: 1, priceKobo: 1, stockCount: 1 } })
      .sort({ stockCount: -1, createdAt: -1 })
      .limit(100)
      .toArray(),
    database.collection('supplierCatalogCache').findOne({ source: 'sujan' }),
  ])
  const cacheIsFresh = cacheDocument?.pricingVersion === pricingVersion && cacheDocument?.updatedAt && Date.now() - new Date(cacheDocument.updatedAt).getTime() < 5 * 60 * 1000
  let sujanItems = cacheDocument?.items || []
  try {
    if (!cacheIsFresh) {
      sujanItems = await sujanCatalog(pricing)
      await database.collection('supplierCatalogCache').updateOne(
        { source: 'sujan' },
        { $set: { source: 'sujan', items: sujanItems, pricingVersion, updatedAt: new Date() } },
        { upsert: true },
      )
    }
  } catch (error) {
    console.error('[logs/catalog] marketplace supplier unavailable', { message: error.message })
  }

  const products = [
    ...managed.map((product) => ({ ...product, _id: `managed:${product._id}`, source: 'managed', brand: 'LMS Socials' })),
    ...sujanItems,
  ].sort((a, b) => Number(b.source === 'managed') - Number(a.source === 'managed') || a.category.localeCompare(b.category) || a.title.localeCompare(b.title))

  return NextResponse.json({ products: products.map((product) => {
    const category = logCategory(product.category, product.brand, product.title)
    return { ...product, category, brand: product.source === 'managed' ? product.brand : category }
  }) })
}

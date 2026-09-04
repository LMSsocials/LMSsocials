import { NextResponse } from 'next/server'
import { getDatabase } from '../../../lib/mongodb'
import { bulkCatalog, logCategory, sujanCatalog } from '../../../lib/log-providers'

export const runtime = 'nodejs'

export async function GET() {
  const database = await getDatabase()
  const pricingVersion = `bulk:${process.env.BULKACC_MARKUP_PERCENT ?? 30}|sujan:${process.env.SUJAN_MARKUP_PERCENT ?? 30}`
  const [managed, cacheDocuments] = await Promise.all([
    database.collection('voucherProducts')
      .find({ isPublished: true }, { projection: { title: 1, brand: 1, category: 1, description: 1, imageUrl: 1, priceKobo: 1, stockCount: 1 } })
      .sort({ stockCount: -1, createdAt: -1 })
      .limit(100)
      .toArray(),
    database.collection('supplierCatalogCache').find({ source: { $in: ['bulkacc', 'sujan'] } }).toArray(),
  ])
  const cache = new Map(cacheDocuments.map((document) => [document.source, document]))
  const fresh = (source) => cache.get(source)?.pricingVersion === pricingVersion && cache.get(source)?.updatedAt && Date.now() - new Date(cache.get(source).updatedAt).getTime() < 5 * 60 * 1000
  const [bulkResult, sujanResult] = await Promise.allSettled([
    fresh('bulkacc') ? cache.get('bulkacc').items : bulkCatalog(),
    fresh('sujan') ? cache.get('sujan').items : sujanCatalog(),
  ])
  const bulkItems = bulkResult.status === 'fulfilled' ? bulkResult.value : cache.get('bulkacc')?.items || []
  const sujanItems = sujanResult.status === 'fulfilled' ? sujanResult.value : cache.get('sujan')?.items || []
  const cacheWrites = []
  if (bulkResult.status === 'fulfilled' && !fresh('bulkacc')) cacheWrites.push(database.collection('supplierCatalogCache').updateOne({ source: 'bulkacc' }, { $set: { source: 'bulkacc', items: bulkItems, pricingVersion, updatedAt: new Date() } }, { upsert: true }))
  if (sujanResult.status === 'fulfilled' && !fresh('sujan')) cacheWrites.push(database.collection('supplierCatalogCache').updateOne({ source: 'sujan' }, { $set: { source: 'sujan', items: sujanItems, pricingVersion, updatedAt: new Date() } }, { upsert: true }))
  if (cacheWrites.length) await Promise.all(cacheWrites)
  const products = [
    ...managed.map((product) => ({ ...product, _id: `managed:${product._id}`, source: 'managed', brand: 'LMS Socials' })),
    ...bulkItems,
    ...sujanItems,
  ].sort((a, b) => Number(b.source === 'managed') - Number(a.source === 'managed') || a.category.localeCompare(b.category) || a.title.localeCompare(b.title))

  if (bulkResult.status === 'rejected') console.error('[logs/catalog] bulk supplier unavailable', { message: bulkResult.reason?.message })
  if (sujanResult.status === 'rejected') console.error('[logs/catalog] marketplace supplier unavailable', { message: sujanResult.reason?.message })

  return NextResponse.json({ products: products.map((product) => {
    const category = product.source === 'managed' ? product.category : logCategory(product.title)
    return { ...product, category, brand: product.source === 'managed' ? product.brand : category }
  }) })
}

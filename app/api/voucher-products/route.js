import { after, NextResponse } from 'next/server'
import { getDatabase } from '../../../lib/mongodb'
import { bulkCatalog, isHiddenLogProduct, LOG_PRICE_RULES_VERSION, logCategory, mergeSupplierCatalogItems, sujanCatalog } from '../../../lib/log-providers'
import { normalizeSupplierPricing, supplierPricingVersion, supplierProductPriceKobo } from '../../../lib/supplier-pricing'
import { getVoucherCatalogResponse, invalidateVoucherCatalogResponse, setVoucherCatalogResponse } from '../../../lib/voucher-catalog-cache'

export const runtime = 'nodejs'
const CATALOG_TTL = 5 * 60 * 1000
const CACHE_CONTROL = 'public, max-age=15, s-maxage=30, stale-while-revalidate=300'

function catalogResponse(products, cacheStatus) {
  return NextResponse.json({ products }, { headers: { 'Cache-Control': CACHE_CONTROL, 'X-Catalog-Cache': cacheStatus } })
}

function currentPrices(items, pricing) {
  return (items || []).map((item) => ({
    ...item,
    priceKobo: supplierProductPriceKobo(pricing, item._id, item.basePriceKobo ?? item.priceKobo),
  }))
}

async function refreshCatalog(database, source, loader, pricingVersion, previousItems = []) {
  const promiseKey = `__lmsCatalogRefresh:${source}`
  if (!globalThis[promiseKey]) {
    globalThis[promiseKey] = loader().then(async (items) => {
      const refreshedItems = mergeSupplierCatalogItems(source, items, previousItems)
      await database.collection('supplierCatalogCache').updateOne(
        { source },
        { $set: { source, items: refreshedItems, pricingVersion, updatedAt: new Date() } },
        { upsert: true },
      )
      invalidateVoucherCatalogResponse()
      return refreshedItems
    }).catch((error) => {
      console.error(`[logs/catalog] ${source} supplier unavailable`, { message: error.message })
      return []
    }).finally(() => { globalThis[promiseKey] = undefined })
  }
  return globalThis[promiseKey]
}

export async function GET() {
  const memoryCachedProducts = getVoucherCatalogResponse(LOG_PRICE_RULES_VERSION)
  if (memoryCachedProducts) return catalogResponse(memoryCachedProducts, 'memory-hit')

  const database = await getDatabase()
  const [managed, cacheDocuments, savedPricing] = await Promise.all([
    database.collection('voucherProducts')
      .find({ isPublished: true }, { projection: { title: 1, brand: 1, category: 1, description: 1, imageUrl: 1, priceKobo: 1, stockCount: 1 } })
      .sort({ stockCount: -1, createdAt: -1 })
      .limit(100)
      .toArray(),
    database.collection('supplierCatalogCache').find({ source: { $in: ['bulkacc', 'sujan'] } }).toArray(),
    database.collection('storeSettings').findOne({ _id: 'supplier-pricing' }),
  ])
  const pricing = normalizeSupplierPricing(savedPricing)
  const pricingVersion = `${supplierPricingVersion(pricing)}|rules:${LOG_PRICE_RULES_VERSION}`

  const cacheBySource = new Map(cacheDocuments.map((document) => [document.source, document]))
  const loaders = { bulkacc: () => bulkCatalog(pricing), sujan: () => sujanCatalog(pricing) }
  const supplierItems = {}
  for (const source of Object.keys(loaders)) {
    const cached = cacheBySource.get(source)
    const hasCachedItems = Boolean(cached?.items?.length)
    const cacheIsFresh = cached?.pricingVersion === pricingVersion && cached?.updatedAt
      && Date.now() - new Date(cached.updatedAt).getTime() < CATALOG_TTL
    if (hasCachedItems) {
      supplierItems[source] = currentPrices(cached.items, pricing)
      if (!cacheIsFresh) after(() => refreshCatalog(database, source, loaders[source], pricingVersion, cached.items))
    } else {
      supplierItems[source] = currentPrices(await refreshCatalog(database, source, loaders[source], pricingVersion, cached?.items), pricing)
    }
  }

  const products = [
    ...managed.map((product) => ({ ...product, _id: `managed:${product._id}`, source: 'managed', brand: 'LMS Socials' })),
    ...(supplierItems.bulkacc || []),
    ...(supplierItems.sujan || []),
  ].filter((product) => product.source === 'sujan' || !isHiddenLogProduct(product.title))
    .sort((a, b) => Number(b.source === 'managed') - Number(a.source === 'managed') || a.category.localeCompare(b.category) || a.title.localeCompare(b.title))

  const publicProducts = products.map((product) => {
    const category = logCategory(product.category, product.brand, product.title)
    return { ...product, category, brand: product.source === 'managed' ? product.brand : category }
  })
  setVoucherCatalogResponse(LOG_PRICE_RULES_VERSION, publicProducts)
  return catalogResponse(publicProducts, 'database')
}

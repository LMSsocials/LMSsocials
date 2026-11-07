import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase } from '../../../../lib/mongodb'
import { bulkCatalog, bulkPricingCatalogItems, sujanCatalog } from '../../../../lib/log-providers'
import { getSupplierPricing, supplierProductPriceKobo } from '../../../../lib/supplier-pricing'
import { getBoostingServices } from '../../../../lib/boosting-provider.js'
import { loadNumberOffers } from '../../../../legacy-api/number-services.js'

export const runtime = 'nodejs'

const serviceSummary = (item) => ({
  id: item._id,
  source: item.source,
  title: item.title,
  category: item.category,
  priceKobo: item.priceKobo,
})

async function getLogServices(database, pricing) {
  const cacheDocuments = await database.collection('supplierCatalogCache')
    .find({ source: { $in: ['bulkacc', 'sujan'] } })
    .toArray()
  const cacheBySource = new Map(cacheDocuments.map((document) => [document.source, document.items || []]))

  let bulkLiveItems = cacheBySource.get('bulkacc') || []
  if (!bulkLiveItems.length) {
    try {
      bulkLiveItems = await bulkCatalog(pricing)
    } catch (error) {
      console.error('[admin/pricing] BulkAcc catalog unavailable', { message: error.message })
    }
  }
  const bulkItems = bulkPricingCatalogItems(bulkLiveItems, pricing)

  let sujanItems = (cacheBySource.get('sujan') || []).map((item) => ({
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

async function getEditableServices(database, pricing) {
  const groups = await Promise.allSettled([
    getLogServices(database, pricing),
    process.env.BOOSTING_API_KEY ? getBoostingServices(pricing).then((items) => items.map((item) => ({
      id: `boosting:${item.id}`, source: 'boosting', title: item.name,
      category: `${item.platform} / ${item.category}`, priceKobo: Math.round(item.pricePerThousand * 100),
    }))) : [],
    process.env.SMSBOWER_API_KEY ? loadNumberOffers(process.env.SMSBOWER_API_KEY, pricing).then((offers) => offers.flatMap((offer) => (
      ['1', '2', '3'].map((serverId) => ({
        id: `number:${offer.countryId}:${offer.serviceCode}:${serverId}`,
        source: 'number', title: `${offer.country} — ${offer.service} — ${{ '1': 'Budget', '2': 'Silver', '3': 'Gold' }[serverId]}`,
        category: 'Numbers', priceKobo: Math.round(Number(offer.prices[serverId]) * 100),
      }))
    ))) : [],
  ])
  const labels = ['account services', 'boosting services', 'number services']
  groups.forEach((group, index) => {
    if (group.status === 'rejected') console.error(`[admin/pricing] ${labels[index]} unavailable`, { message: group.reason?.message })
  })
  return groups.flatMap((group) => group.status === 'fulfilled' ? group.value : [])
    .sort((left, right) => left.source.localeCompare(right.source) || left.category.localeCompare(right.category) || left.title.localeCompare(right.title))
}

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const database = await getDatabase()
  const pricing = await getSupplierPricing(database)
  return NextResponse.json({ services: await getEditableServices(database, pricing) })
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
    if (!/^(bulkacc|sujan|boosting|number):[a-zA-Z0-9:_-]{1,120}$/.test(reference)) {
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
  return NextResponse.json({ services: await getEditableServices(database, pricing) })
}

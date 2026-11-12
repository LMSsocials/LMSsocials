import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase } from '../../../../lib/mongodb'
import { bulkCatalog, bulkPricingCatalogItems, sujanCatalog } from '../../../../lib/log-providers'
import { getSupplierPricing, normalizeBoostingAdjustmentPercent, supplierProductPriceKobo } from '../../../../lib/supplier-pricing'
import { getBoostingServices } from '../../../../lib/boosting-provider.js'
import { loadNumberOffers } from '../../../../legacy-api/number-services.js'
import { invalidateVoucherCatalogResponse } from '../../../../lib/voucher-catalog-cache'

export const runtime = 'nodejs'

const serviceSummary = (item) => ({
  id: item._id,
  source: item.source,
  title: item.title,
  category: item.category,
  priceKobo: item.priceKobo,
})

async function getLogServices(database, pricing) {
  const [cacheDocuments, managedDocuments] = await Promise.all([
    database.collection('supplierCatalogCache').find({ source: { $in: ['bulkacc', 'sujan'] } }).toArray(),
    database.collection('voucherProducts')
      .find({ isPublished: true }, { projection: { title: 1, category: 1, priceKobo: 1 } })
      .sort({ title: 1 })
      .limit(100)
      .toArray(),
  ])
  const cacheBySource = new Map(cacheDocuments.map((document) => [document.source, document.items || []]))
  const managedItems = managedDocuments.map((item) => ({
    _id: `managed:${item._id}`, source: 'managed', title: item.title,
    category: item.category || 'Managed logs', priceKobo: item.priceKobo,
  }))

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
  return [...managedItems, ...bulkItems, ...sujanItems].map(serviceSummary)
    .sort((left, right) => left.category.localeCompare(right.category) || left.title.localeCompare(right.title))
}

async function getEditableServices(database, pricing, requestedSection = 'all') {
  const loaders = []
  if (requestedSection === 'all' || requestedSection === 'logs') loaders.push({
    label: 'account services',
    load: () => getLogServices(database, pricing),
  })
  if (requestedSection === 'all' || requestedSection === 'boosting') loaders.push({
    label: 'boosting services',
    load: () => process.env.BOOSTING_API_KEY ? getBoostingServices(pricing).then((items) => items.map((item) => ({
      id: `boosting:${item.id}`, source: 'boosting', title: item.name,
      category: `${item.platform} / ${item.category}`, priceKobo: Math.round(item.pricePerThousand * 100),
    }))) : [],
  })
  if (requestedSection === 'all' || requestedSection === 'number') loaders.push({
    label: 'number services',
    load: () => process.env.SMSBOWER_API_KEY ? loadNumberOffers(process.env.SMSBOWER_API_KEY, pricing).then((offers) => offers.flatMap((offer) => (
      ['1', '2', '3'].map((serverId) => ({
        id: `number:${offer.countryId}:${offer.serviceCode}:${serverId}`,
        source: 'number', title: `${offer.country} — ${offer.service} — ${{ '1': 'Budget', '2': 'Silver', '3': 'Gold' }[serverId]}`,
        category: 'Numbers', priceKobo: Math.round(Number(offer.prices[serverId]) * 100),
        countryId: offer.countryId, country: offer.country, serviceCode: offer.serviceCode, service: offer.service,
        serverId, tier: { '1': 'Budget', '2': 'Silver', '3': 'Gold' }[serverId],
      }))
    ))) : [],
  })
  const groups = await Promise.allSettled(loaders.map((item) => item.load()))
  groups.forEach((group, index) => {
    if (group.status === 'rejected') console.error(`[admin/pricing] ${loaders[index].label} unavailable`, { message: group.reason?.message })
  })
  return groups.flatMap((group) => group.status === 'fulfilled' ? group.value : [])
    .sort((left, right) => left.source.localeCompare(right.source) || left.category.localeCompare(right.category) || left.title.localeCompare(right.title))
}

export async function GET(request) {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const requestedSection = new URL(request.url).searchParams.get('section') || 'all'
  if (!['all', 'logs', 'boosting', 'number'].includes(requestedSection)) return NextResponse.json({ message: 'Invalid pricing section' }, { status: 400 })
  const database = await getDatabase()
  const pricing = await getSupplierPricing(database)
  return NextResponse.json({ services: await getEditableServices(database, pricing, requestedSection), boostingAdjustmentPercent: pricing.boostingAdjustmentPercent })
}

export async function PATCH(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const submitted = body.prices
  const pricesWereSubmitted = Object.hasOwn(body, 'prices')
  const hasPrices = submitted && typeof submitted === 'object' && !Array.isArray(submitted)
  const hasBoostingAdjustment = Object.hasOwn(body, 'boostingAdjustmentPercent')
  if ((pricesWereSubmitted && !hasPrices) || (!hasPrices && !hasBoostingAdjustment) || (hasPrices && Object.keys(submitted).length > 1000)) {
    return NextResponse.json({ message: 'Submit a valid service price list' }, { status: 400 })
  }
  const database = await getDatabase()
  const currentPricing = await getSupplierPricing(database)
  const pricesKobo = body.mode === 'merge' ? { ...currentPricing.pricesKobo } : {}
  const managedPriceUpdates = []
  for (const [reference, value] of Object.entries(hasPrices ? submitted : {})) {
    const managedMatch = /^managed:([a-f0-9]{24})$/i.exec(reference)
    if (!managedMatch && !/^(bulkacc|sujan|boosting|number):[a-zA-Z0-9:_-]{1,120}$/.test(reference)) {
      return NextResponse.json({ message: 'A service reference is invalid' }, { status: 400 })
    }
    if (value === '' || value == null) continue
    const priceNaira = Number(value)
    const priceKobo = Math.round(priceNaira * 100)
    if (!Number.isFinite(priceNaira) || !Number.isSafeInteger(priceKobo) || priceKobo < 10000 || priceKobo > 1000000000) {
      return NextResponse.json({ message: 'Each service price must be between ₦100 and ₦10,000,000' }, { status: 400 })
    }
    if (managedMatch) managedPriceUpdates.push({ productId: new ObjectId(managedMatch[1]), priceKobo })
    else pricesKobo[reference] = priceKobo
  }
  const boostingAdjustmentPercent = normalizeBoostingAdjustmentPercent(body.boostingAdjustmentPercent, NaN)
  if (hasBoostingAdjustment && !Number.isFinite(boostingAdjustmentPercent)) {
    return NextResponse.json({ message: 'Boosting adjustment must be between -90% and +1000%' }, { status: 400 })
  }
  const now = new Date()
  if (managedPriceUpdates.length) {
    const managedIds = managedPriceUpdates.map((item) => item.productId)
    const productCount = await database.collection('voucherProducts').countDocuments({ _id: { $in: managedIds } })
    if (productCount !== managedPriceUpdates.length) return NextResponse.json({ message: 'A managed log product was not found' }, { status: 404 })
    await database.collection('voucherProducts').bulkWrite(managedPriceUpdates.map((item) => ({
      updateOne: {
        filter: { _id: item.productId },
        update: { $set: { priceKobo: item.priceKobo, updatedAt: now, updatedBy: admin.email } },
      },
    })))
  }
  const changes = { updatedAt: now, updatedBy: admin.email }
  if (hasPrices) changes.pricesKobo = pricesKobo
  if (hasBoostingAdjustment) changes.boostingAdjustmentPercent = boostingAdjustmentPercent
  await database.collection('storeSettings').updateOne(
    { _id: 'supplier-pricing' },
    { $set: changes },
    { upsert: true },
  )
  invalidateVoucherCatalogResponse()
  const pricing = await getSupplierPricing(database)
  const requestedSection = ['logs', 'boosting', 'number'].includes(body.section) ? body.section : 'all'
  return NextResponse.json({ services: await getEditableServices(database, pricing, requestedSection), boostingAdjustmentPercent: pricing.boostingAdjustmentPercent })
}

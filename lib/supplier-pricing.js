const defaultPercent = (environmentKey) => {
  const value = Number(process.env[environmentKey])
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 30
}

export function defaultSupplierPricing() {
  return {
    bulkaccMarkupPercent: defaultPercent('BULKACC_MARKUP_PERCENT'),
    sujanMarkupPercent: defaultPercent('SUJAN_MARKUP_PERCENT'),
    boostingAdjustmentPercent: 0,
  }
}

export function normalizeSupplierPricing(value = {}, fallback = defaultSupplierPricing()) {
  const pricing = value ?? {}
  const validPercent = (candidate, defaultValue) => {
    const number = Number(candidate)
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : defaultValue
  }
  return {
    bulkaccMarkupPercent: validPercent(pricing.bulkaccMarkupPercent, fallback.bulkaccMarkupPercent),
    sujanMarkupPercent: validPercent(pricing.sujanMarkupPercent, fallback.sujanMarkupPercent),
    boostingAdjustmentPercent: normalizeBoostingAdjustmentPercent(pricing.boostingAdjustmentPercent, fallback.boostingAdjustmentPercent ?? 0),
    pricesKobo: normalizeSupplierPriceOverrides(pricing.pricesKobo),
  }
}

export function supplierPricingVersion(pricing) {
  const overrides = Object.entries(pricing.pricesKobo || {}).sort(([left], [right]) => left.localeCompare(right))
  return `bulk:${pricing.bulkaccMarkupPercent}|sujan:${pricing.sujanMarkupPercent}|boost:${pricing.boostingAdjustmentPercent || 0}|exact:${JSON.stringify(overrides)}`
}

export function normalizeBoostingAdjustmentPercent(value, fallback = 0) {
  const percentage = Number(value)
  return Number.isFinite(percentage) && percentage >= -90 && percentage <= 1000 ? percentage : fallback
}

export function normalizeSupplierPriceOverrides(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([reference, candidate]) => {
    const priceKobo = Number(candidate)
    if (!/^(bulkacc|sujan|boosting|number):[a-zA-Z0-9:_-]{1,120}$/.test(reference)
      || !Number.isSafeInteger(priceKobo) || priceKobo < 10000 || priceKobo > 1000000000) return []
    return [[reference, priceKobo]]
  }))
}

export function numberPriceReference(countryId, serviceCode, serverId) {
  return `number:${countryId}:${serviceCode}:${serverId}`
}

export function supplierProductPriceKobo(pricing, reference, fallbackPriceKobo) {
  return pricing?.pricesKobo?.[reference] ?? fallbackPriceKobo
}

export function boostingProductPriceKobo(pricing, reference, fallbackPriceKobo) {
  const exactPrice = pricing?.pricesKobo?.[reference]
  if (exactPrice != null) return exactPrice
  const percentage = normalizeBoostingAdjustmentPercent(pricing?.boostingAdjustmentPercent)
  return Math.max(1, Math.round(Number(fallbackPriceKobo) * (1 + percentage / 100)))
}

export async function getSupplierPricing(database) {
  const saved = await database.collection('storeSettings').findOne({ _id: 'supplier-pricing' })
  return normalizeSupplierPricing(saved)
}

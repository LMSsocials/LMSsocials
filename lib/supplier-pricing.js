const defaultPercent = (environmentKey) => {
  const value = Number(process.env[environmentKey])
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 30
}

export function defaultSupplierPricing() {
  return {
    bulkaccMarkupPercent: defaultPercent('BULKACC_MARKUP_PERCENT'),
    sujanMarkupPercent: defaultPercent('SUJAN_MARKUP_PERCENT'),
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
    pricesKobo: normalizeSupplierPriceOverrides(pricing.pricesKobo),
  }
}

export function supplierPricingVersion(pricing) {
  const overrides = Object.entries(pricing.pricesKobo || {}).sort(([left], [right]) => left.localeCompare(right))
  return `bulk:${pricing.bulkaccMarkupPercent}|sujan:${pricing.sujanMarkupPercent}|exact:${JSON.stringify(overrides)}`
}

export function normalizeSupplierPriceOverrides(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([reference, candidate]) => {
    const priceKobo = Number(candidate)
    if (!/^(bulkacc|sujan):[a-zA-Z0-9_-]{1,80}$/.test(reference)
      || !Number.isSafeInteger(priceKobo) || priceKobo < 10000 || priceKobo > 1000000000) return []
    return [[reference, priceKobo]]
  }))
}

export function supplierProductPriceKobo(pricing, reference, fallbackPriceKobo) {
  return pricing?.pricesKobo?.[reference] ?? fallbackPriceKobo
}

export async function getSupplierPricing(database) {
  const saved = await database.collection('storeSettings').findOne({ _id: 'supplier-pricing' })
  return normalizeSupplierPricing(saved)
}

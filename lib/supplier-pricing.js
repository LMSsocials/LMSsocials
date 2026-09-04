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
  const validPercent = (candidate, defaultValue) => {
    const number = Number(candidate)
    return Number.isFinite(number) && number >= 0 && number <= 100 ? number : defaultValue
  }
  return {
    bulkaccMarkupPercent: validPercent(value.bulkaccMarkupPercent, fallback.bulkaccMarkupPercent),
    sujanMarkupPercent: validPercent(value.sujanMarkupPercent, fallback.sujanMarkupPercent),
  }
}

export function supplierPricingVersion(pricing) {
  return `bulk:${pricing.bulkaccMarkupPercent}|sujan:${pricing.sujanMarkupPercent}`
}

export async function getSupplierPricing(database) {
  const saved = await database.collection('storeSettings').findOne({ _id: 'supplier-pricing' })
  return normalizeSupplierPricing(saved)
}

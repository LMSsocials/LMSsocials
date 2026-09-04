const EXCHANGE_RATE_NAIRA = 1341.395
const MARKUP_MULTIPLIER = 2
const LOW_PRICE_CUTOFF_NAIRA = 1000
const LOW_PRICE_TARGET_NAIRA = 1100

// The supplier returns its rate per 1,000 actions in USD. Keep this shared by
// the catalogue and checkout so a browser can never choose its own price.
export function boostingPricePerThousandNaira(providerRateUsd) {
  const providerRate = Number(providerRateUsd)
  if (!Number.isFinite(providerRate) || providerRate <= 0) throw new Error('This service does not have a valid supplier price')

  const standardPrice = providerRate * EXCHANGE_RATE_NAIRA * MARKUP_MULTIPLIER
  if (standardPrice >= LOW_PRICE_CUTOFF_NAIRA) return standardPrice

  // Very low-cost supplier services receive a variable uplift, rather than a
  // confusing fixed price, while every listed service still stays above ₦1,000.
  const additionalMarkupPercent = (LOW_PRICE_TARGET_NAIRA / standardPrice) * 100 + 10
  return Math.ceil(standardPrice * (1 + additionalMarkupPercent / 100))
}

export function boostingOrderPriceKobo(providerRateUsd, quantity) {
  const amount = Number(quantity)
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid quantity')
  const naira = boostingPricePerThousandNaira(providerRateUsd) * amount / 1000
  const kobo = Math.ceil(naira * 100)
  if (!Number.isSafeInteger(kobo) || kobo <= 0) throw new Error('Unable to calculate order price')
  return kobo
}


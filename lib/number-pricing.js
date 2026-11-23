import { DEFAULT_NUMBER_MARKUP_PERCENT, normalizeNumberMarkupPercent, numberPriceReference, supplierProductPriceKobo } from './supplier-pricing.js'

export const NUMBER_USD_TO_NGN_RATE = 1400
export const NUMBER_SERVER_MARKUP_PERCENT = DEFAULT_NUMBER_MARKUP_PERCENT

export function numberSellingPriceKobo(providerPriceUsd, serverId = '1', offer = {}, pricing = {}) {
  const usd = Number(providerPriceUsd)
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('Invalid provider price')
  const markup = normalizeNumberMarkupPercent(pricing?.numberMarkupPercent)[String(serverId)]
  if (!Number.isFinite(markup)) throw new Error('Invalid number server')
  const calculatedPriceKobo = Math.max(1, Math.ceil(usd * NUMBER_USD_TO_NGN_RATE * (100 + markup)))
  const reference = numberPriceReference(offer.countryId, offer.serviceCode, serverId)
  return supplierProductPriceKobo(pricing, reference, calculatedPriceKobo)
}

export function koboToNaira(kobo) {
  return Number(kobo) / 100
}

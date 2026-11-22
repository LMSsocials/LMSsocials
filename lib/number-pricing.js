import { DEFAULT_NUMBER_MARKUP_PERCENT, normalizeNumberMarkupPercent } from './supplier-pricing.js'

export const NUMBER_USD_TO_NGN_RATE = 1400
export const NUMBER_SERVER_MARKUP_PERCENT = DEFAULT_NUMBER_MARKUP_PERCENT

export function numberSellingPriceKobo(providerPriceUsd, serverId = '1', _offer = {}, pricing = {}) {
  void _offer // Retained for the public call signature used by quote creation.
  const usd = Number(providerPriceUsd)
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('Invalid provider price')
  const markup = normalizeNumberMarkupPercent(pricing?.numberMarkupPercent)[String(serverId)]
  if (!Number.isFinite(markup)) throw new Error('Invalid number server')
  // Number prices now follow one transparent formula: live supplier cost,
  // converted to naira, plus the admin-controlled markup for the chosen tier.
  // Legacy exact-price overrides and hard floors intentionally do not apply.
  return Math.max(1, Math.ceil(usd * NUMBER_USD_TO_NGN_RATE * (100 + markup)))
}

export function koboToNaira(kobo) {
  return Number(kobo) / 100
}

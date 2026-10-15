export const NUMBER_USD_TO_NGN_RATE = 1341.395
export const NUMBER_SERVER_MARKUP_PERCENT = Object.freeze({
  '1': 30,
  '2': 50,
  '3': 80,
})

export const FIXED_NUMBER_OFFER = Object.freeze({
  serverId: '1',
  countryId: '187',
  serviceCode: 'wa',
  providerId: '3193',
  sellingPriceKobo: 350000,
})

export const NUMBER_SERVER_PRICE_FLOORS_KOBO = Object.freeze({
  // Silver and Gold are the eSIM-labelled supplier options in the UI.
  '2': 1000000,
  '3': 1500000,
})

export const NUMBER_COUNTRY_PRICE_FLOORS_KOBO = Object.freeze({
  '36': 1000000, // Canada
  '43': 1200000, // Germany (raised to 15,000 for eSIM below)
  '56': 1200000, // Spain
  '78': 1000000, // France
  '86': 1000000, // Italy
  '173': 1500000, // Switzerland
  '175': 1200000, // Australia
  '1001': 1500000, // Japan
})

export function applyNumberPriceFloorsKobo(priceKobo, serverId = '1', offer = {}) {
  if (!Number.isSafeInteger(priceKobo) || priceKobo <= 0) throw new Error('Invalid number price')
  const normalizedServerId = String(serverId)
  const countryId = String(offer.countryId || '')
  const serviceCode = String(offer.serviceCode || '').toLowerCase()
  const floors = [priceKobo, NUMBER_SERVER_PRICE_FLOORS_KOBO[normalizedServerId] || 0, NUMBER_COUNTRY_PRICE_FLOORS_KOBO[countryId] || 0]

  if (countryId === '16' && serviceCode === 'wa' && normalizedServerId === '1') floors.push(650000)
  if (countryId === '43' && ['2', '3'].includes(normalizedServerId)) floors.push(1500000)

  return Math.max(...floors)
}

// Match Boosting's low-price policy: only prices below NGN 1,000 receive
// the variable uplift. Higher prices retain their existing tier markup.
export function adjustLowNumberPriceKobo(standardKobo) {
  if (!Number.isSafeInteger(standardKobo) || standardKobo <= 0) throw new Error('Invalid number price')
  if (standardKobo >= 100000) return standardKobo
  // Equivalent to Boosting's additional percentage: 1100 / price * 100 + 10.
  // Work in kobo and round the adjusted result up to a whole naira.
  return Math.ceil((110000 + standardKobo * 1.1) / 100) * 100
}

export function numberSellingPriceKobo(providerPriceUsd, serverId = '1', offer = {}) {
  const usd = Number(providerPriceUsd)
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('Invalid provider price')
  const markup = NUMBER_SERVER_MARKUP_PERCENT[String(serverId)]
  if (!Number.isFinite(markup)) throw new Error('Invalid number server')
  if (String(serverId) === FIXED_NUMBER_OFFER.serverId
    && String(offer.countryId) === FIXED_NUMBER_OFFER.countryId
    && String(offer.serviceCode) === FIXED_NUMBER_OFFER.serviceCode
    && String(offer.providerId) === FIXED_NUMBER_OFFER.providerId) return FIXED_NUMBER_OFFER.sellingPriceKobo
  const standardKobo = Math.ceil(usd * NUMBER_USD_TO_NGN_RATE * (1 + markup / 100) * 100)
  return applyNumberPriceFloorsKobo(adjustLowNumberPriceKobo(standardKobo), serverId, offer)
}

export function koboToNaira(kobo) {
  return Number(kobo) / 100
}

export const NUMBER_USD_TO_NGN_RATE = 1341.395
export const NUMBER_SERVER_MARKUP_PERCENT = Object.freeze({
  '1': 30,
  '2': 50,
  '3': 80,
})

// Match Boosting's low-price policy: only prices below NGN 1,000 receive
// the variable uplift. Higher prices retain their existing tier markup.
export function adjustLowNumberPriceKobo(standardKobo) {
  if (!Number.isSafeInteger(standardKobo) || standardKobo <= 0) throw new Error('Invalid number price')
  if (standardKobo >= 100000) return standardKobo
  // Equivalent to Boosting's additional percentage: 1100 / price * 100 + 10.
  // Work in kobo and round the adjusted result up to a whole naira.
  return Math.ceil((110000 + standardKobo * 1.1) / 100) * 100
}

export function numberSellingPriceKobo(providerPriceUsd, serverId = '1') {
  const usd = Number(providerPriceUsd)
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('Invalid provider price')
  const markup = NUMBER_SERVER_MARKUP_PERCENT[String(serverId)]
  if (!Number.isFinite(markup)) throw new Error('Invalid number server')
  const standardKobo = Math.ceil(usd * NUMBER_USD_TO_NGN_RATE * (1 + markup / 100) * 100)
  return adjustLowNumberPriceKobo(standardKobo)
}

export function koboToNaira(kobo) {
  return Number(kobo) / 100
}

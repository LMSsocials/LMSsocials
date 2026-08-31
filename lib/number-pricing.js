export const NUMBER_USD_TO_NGN_RATE = 1341.395
export const NUMBER_SERVER_MARKUP_PERCENT = Object.freeze({
  '1': 30,
  '2': 50,
  '3': 80,
})

export function numberSellingPriceKobo(providerPriceUsd, serverId = '1') {
  const usd = Number(providerPriceUsd)
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('Invalid provider price')
  const markup = NUMBER_SERVER_MARKUP_PERCENT[String(serverId)]
  if (!Number.isFinite(markup)) throw new Error('Invalid number server')
  return Math.ceil(usd * NUMBER_USD_TO_NGN_RATE * (1 + markup / 100) * 100)
}

export function koboToNaira(kobo) {
  return Number(kobo) / 100
}

import { koboToNaira, numberSellingPriceKobo } from '../lib/number-pricing.js'

const PROVIDER_URL = 'https://smsbower.page/stubs/handler_api.php'

async function providerRequest(apiKey, action) {
  const url = new URL(PROVIDER_URL)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('action', action)
  const result = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  const text = await result.text()
  if (!result.ok || text === 'BAD_KEY') throw new Error(text === 'BAD_KEY' ? 'Invalid provider key' : `Provider error ${result.status}`)
  try { return JSON.parse(text) } catch { throw new Error('Unexpected provider response') }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' })
  const apiKey = process.env.SMSBOWER_API_KEY
  if (!apiKey) return response.status(503).json({ message: 'Number integration is not configured' })
  try {
    const [countryData, serviceData, priceData] = await Promise.all([
      providerRequest(apiKey, 'getCountries'), providerRequest(apiKey, 'getServicesList'), providerRequest(apiKey, 'getPrices'),
    ])
    const countryRows = Array.isArray(countryData) ? countryData : Object.values(countryData || {})
    const countryNames = new Map(countryRows.map((item) => [String(item.id ?? item.code), String(item.eng || item.name || item.rus || '')]))
    const serviceRows = Array.isArray(serviceData?.services) ? serviceData.services : []
    const serviceNames = new Map(serviceRows.map((item) => [String(item.code), String(item.name)]))
    const offers = []
    Object.entries(priceData || {}).forEach(([countryId, entries]) => Object.entries(entries || {}).forEach(([serviceCode, details]) => {
      const price = Number(details?.cost); const available = Number(details?.count)
      if (!Number.isFinite(price) || !Number.isFinite(available) || available <= 0) return
      offers.push({ id: `${countryId}:${serviceCode}`, countryId, country: countryNames.get(countryId) || `Country ${countryId}`, serviceCode, service: serviceNames.get(serviceCode) || serviceCode.toUpperCase(), price: koboToNaira(numberSellingPriceKobo(price, '1')), prices: { '1': koboToNaira(numberSellingPriceKobo(price, '1')), '2': koboToNaira(numberSellingPriceKobo(price, '2')), '3': koboToNaira(numberSellingPriceKobo(price, '3')) }, available })
    }))
    offers.sort((a, b) => a.price - b.price || b.available - a.available)
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json({ offers, currency: 'NGN' })
  } catch (error) {
    console.error('[numbers/services] request failed', { message: error.message })
    return response.status(502).json({ message: 'Live number availability is temporarily unavailable' })
  }
}

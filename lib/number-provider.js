import { SignJWT, jwtVerify } from 'jose'
import { numberSellingPriceKobo } from './number-pricing.js'

const PROVIDER_URL = 'https://smsbower.page/stubs/handler_api.php'
const DEFINITE_FAILURES = new Set(['NO_NUMBERS', 'NO_BALANCE', 'BAD_KEY', 'BAD_SERVICE', 'BAD_COUNTRY', 'BAD_ACTION', 'WRONG_MAX_PRICE'])

export class NumberProviderError extends Error {
  constructor(code, definitive = false) {
    super(code)
    this.code = code
    this.definitive = definitive
  }
}

export async function numberProviderRequest(action, parameters = {}) {
  const apiKey = process.env.SMSBOWER_API_KEY
  if (!apiKey) throw new NumberProviderError('NOT_CONFIGURED', true)
  const url = new URL(PROVIDER_URL)
  url.search = new URLSearchParams({ api_key: apiKey, action, ...parameters })
  let response, text
  try {
    response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
    text = (await response.text()).trim()
  } catch { throw new NumberProviderError('PROVIDER_UNAVAILABLE') }
  if (!response.ok) throw new NumberProviderError('PROVIDER_UNAVAILABLE')
  return text
}

async function providerJson(action, parameters) {
  const text = await numberProviderRequest(action, parameters)
  try {
    const result = JSON.parse(text)
    if (!result || typeof result !== 'object' || result.error) throw new Error()
    return result
  } catch { throw new NumberProviderError('PROVIDER_UNAVAILABLE') }
}

const countrySlug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function chooseNumberSupplier({ prices, goldPartners, serverId }) {
  const candidates = Object.entries(prices || {}).map(([id, row]) => ({
    providerId: String(row.provider_id ?? id), price: Number(row.price), available: Number(row.count),
    gold: Object.hasOwn(goldPartners || {}, String(row.provider_id ?? id)),
  })).filter((row) => /^\d+$/.test(row.providerId) && Number.isFinite(row.price) && row.price > 0 && Number.isFinite(row.available) && row.available > 0)
  // Gold is a supplier classification, not a measured delivery percentage.
  // Numeric JSON object keys do not preserve supplier rank in JavaScript.
  // Select by membership, then price, instead of inventing a rank or speed.
  const gold = candidates.filter((row) => row.gold)
  const pool = serverId === '3' ? gold : serverId === '2' && gold.length ? gold : candidates
  return pool.sort((a, b) => a.price - b.price || b.available - a.available || a.providerId.localeCompare(b.providerId))[0] || null
}

export async function createNumberQuote({ userId, countryId, serviceCode, serverId }) {
  const [priceData, topResult, countryData, serviceData] = await Promise.all([
    providerJson('getPricesV3', { country: countryId, service: serviceCode }),
    providerJson('getTopCountriesByService', { service: serviceCode }).catch(() => null),
    providerJson('getCountries'), providerJson('getServicesList'),
  ])
  const country = Object.values(countryData).find((row) => String(row.id) === countryId)
  const service = serviceData.services?.find((row) => String(row.code) === serviceCode)
  if (!country || !service) throw new NumberProviderError('UNAVAILABLE', true)
  const goldPartners = topResult?.[countrySlug(country.eng)]
  const supplier = chooseNumberSupplier({ prices: priceData[countryId]?.[serviceCode], goldPartners, serverId })
  if (!supplier) throw new NumberProviderError(serverId === '3' ? 'NO_GOLD_NUMBERS' : 'NO_NUMBERS', true)
  const quote = {
    userId: String(userId), countryId, serviceCode, serverId, providerId: supplier.providerId,
    providerPriceUsd: supplier.price, sellingPriceKobo: numberSellingPriceKobo(supplier.price, serverId),
    quality: supplier.gold ? 'gold' : 'standard', available: supplier.available,
    countryName: String(country.eng), serviceName: String(service.name),
  }
  if (!Number.isSafeInteger(quote.sellingPriceKobo) || quote.sellingPriceKobo <= 0) throw new NumberProviderError('INVALID_PRICE', true)
  const token = await new SignJWT(quote).setProtectedHeader({ alg: 'HS256' }).setIssuer('lms-number-quote')
    .setAudience('lms-number-checkout').setIssuedAt().setExpirationTime('2m').sign(quoteSecret())
  return { token, expiresAt: Date.now() + 120000, priceKobo: quote.sellingPriceKobo, quality: quote.quality, available: quote.available }
}

function quoteSecret() {
  if (!process.env.AUTH_JWT_SECRET || process.env.AUTH_JWT_SECRET.length < 32) throw new Error('Quote signing unavailable')
  return new TextEncoder().encode(process.env.AUTH_JWT_SECRET)
}

export async function verifyNumberQuote(token, userId) {
  const { payload } = await jwtVerify(token, quoteSecret(), { issuer: 'lms-number-quote', audience: 'lms-number-checkout', algorithms: ['HS256'] })
  if (payload.userId !== String(userId)) throw new Error('Invalid quote owner')
  if (payload.sellingPriceKobo !== numberSellingPriceKobo(payload.providerPriceUsd, payload.serverId)) {
    throw new Error('Number pricing has changed; refresh the quote')
  }
  return payload
}

export async function checkQuotedSupplier(quote) {
  const data = await providerJson('getPricesV3', { country: quote.countryId, service: quote.serviceCode })
  const row = data[quote.countryId]?.[quote.serviceCode]?.[quote.providerId]
  if (!row || !(Number(row.count) > 0) || !(Number(row.price) > 0) || Number(row.price) > quote.providerPriceUsd) {
    throw new NumberProviderError('QUOTE_CHANGED', true)
  }
}

export async function reserveQuotedNumber(quote) {
  const text = await numberProviderRequest('getNumberV2', {
    country: quote.countryId, service: quote.serviceCode, providerIds: quote.providerId, maxPrice: String(quote.providerPriceUsd),
  })
  if (DEFINITE_FAILURES.has(text)) throw new NumberProviderError(text, true)
  let result
  try { result = JSON.parse(text) } catch { throw new NumberProviderError('SUBMISSION_UNKNOWN') }
  if (!result?.activationId || !/^\+?\d{7,15}$/.test(String(result.phoneNumber || ''))) throw new NumberProviderError('SUBMISSION_UNKNOWN')
  return result
}

export function parseNumberStatus(text) {
  if (text.startsWith('STATUS_OK:') || text.startsWith('STATUS_WAIT_RETRY:')) {
    const code = text.slice(text.indexOf(':') + 1).trim()
    if (code) return { status: 'completed', smsCode: code }
  }
  if (text === 'STATUS_CANCEL') return { status: 'canceled' }
  if (text === 'STATUS_WAIT_CODE' || text === 'STATUS_WAIT_RESEND') return { status: 'waiting' }
  throw new NumberProviderError(text === 'NO_ACTIVATION' ? 'NO_ACTIVATION' : 'STATUS_UNAVAILABLE')
}

export async function readNumberStatus(activationId) {
  return parseNumberStatus(await numberProviderRequest('getStatus', { id: activationId }))
}

export async function cancelProviderNumber(activationId) {
  const text = await numberProviderRequest('setStatus', { id: activationId, status: '8' })
  if (text === 'ACCESS_CANCEL' || text === 'STATUS_CANCEL') return true
  throw new NumberProviderError(text === 'EARLY_CANCEL_DENIED' ? 'EARLY_CANCEL_DENIED' : 'CANCEL_NOT_CONFIRMED')
}

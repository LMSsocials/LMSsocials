import { SignJWT, jwtVerify } from 'jose'
import { NUMBER_USD_TO_NGN_RATE, numberSellingPriceKobo } from './number-pricing.js'
import { isNumberCountryEnabled, numberProviderForOffer } from './number-catalog.js'

const PROVIDER_URL = 'https://smsbower.page/stubs/handler_api.php'
const DEFINITE_FAILURES = new Set(['NO_NUMBERS', 'NO_BALANCE', 'BAD_KEY', 'BAD_SERVICE', 'BAD_COUNTRY', 'BAD_ACTION', 'WRONG_MAX_PRICE'])
const RESERVATION_PRICE_CUSHION_BASIS_POINTS = 11000
const MIN_PRIMARY_NUMBER_STOCK = 10
const PROVIDER_PRICE_PRECISION = 10000

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

export function chooseNumberSupplier({ prices, goldPartners, serverId, providerId }) {
  return rankNumberSuppliers({ prices, goldPartners, serverId, providerId })[0] || null
}

export function rankNumberSuppliers({ prices, goldPartners, serverId, providerId }) {
  const candidates = Object.entries(prices || {}).map(([id, row]) => ({
    providerId: String(row.provider_id ?? id), price: Number(row.price), available: Number(row.count),
    gold: Object.hasOwn(goldPartners || {}, String(row.provider_id ?? id)),
  })).filter((row) => /^\d+$/.test(row.providerId) && Number.isFinite(row.price) && row.price > 0 && Number.isFinite(row.available) && row.available > 0)
  // A one- or two-number price row is frequently a stale inventory snapshot by
  // the time checkout reaches getNumberV2. Prefer suppliers with a meaningful
  // stock buffer whenever one exists, while retaining thin stock as a last
  // resort for countries that have no other inventory at all.
  const dependable = candidates.filter((row) => row.available >= MIN_PRIMARY_NUMBER_STOCK)
  const eligible = dependable.length ? dependable : candidates
  const preferred = providerId ? eligible.find((row) => row.providerId === String(providerId)) : null
  // Gold is a supplier classification, not a measured delivery percentage.
  // Numeric JSON object keys do not preserve supplier rank in JavaScript.
  // Keep the configured product first, then prefer Gold-classified products
  // for higher tiers, while retaining every valid product as a stock fallback.
  const byValue = (left, right) => left.price - right.price || right.available - left.available || left.providerId.localeCompare(right.providerId)
  const remaining = eligible.filter((row) => row !== preferred)
  const ranked = ['2', '3'].includes(String(serverId))
    ? [...remaining.filter((row) => row.gold).sort(byValue), ...remaining.filter((row) => !row.gold).sort(byValue)]
    : remaining.sort(byValue)
  return preferred ? [preferred, ...ranked] : ranked
}

export function reservationPriceLimitUsd({ sellingPriceKobo, providerPriceUsd }) {
  const quotedProviderPrice = Number(providerPriceUsd)
  const coveredByCustomerPayment = Number(sellingPriceKobo) / (NUMBER_USD_TO_NGN_RATE * 100)
  if (!Number.isFinite(quotedProviderPrice) || quotedProviderPrice <= 0) throw new Error('Invalid provider price')
  if (!Number.isFinite(coveredByCustomerPayment) || coveredByCustomerPayment <= 0) return quotedProviderPrice
  // Round down so a fallback can never cost more than the signed customer
  // payment, even when floating-point conversion lands between price ticks.
  return Math.max(quotedProviderPrice, Math.floor(coveredByCustomerPayment * PROVIDER_PRICE_PRECISION) / PROVIDER_PRICE_PRECISION)
}

export async function createNumberQuote({ userId, countryId, serviceCode, serverId }, pricing = {}) {
  if (!isNumberCountryEnabled(countryId)) throw new NumberProviderError('UNAVAILABLE', true)
  const [priceData, topResult, countryData, serviceData] = await Promise.all([
    providerJson('getPricesV3', { country: countryId, service: serviceCode }),
    providerJson('getTopCountriesByService', { service: serviceCode }).catch(() => null),
    providerJson('getCountries'), providerJson('getServicesList'),
  ])
  const country = Object.values(countryData).find((row) => String(row.id) === countryId)
  const service = serviceData.services?.find((row) => String(row.code) === serviceCode)
  if (!country || !service) throw new NumberProviderError('UNAVAILABLE', true)
  const goldPartners = topResult?.[countrySlug(country.eng)]
  const requiredProviderId = numberProviderForOffer({ countryId, serviceCode, serverId })
  const suppliers = rankNumberSuppliers({ prices: priceData[countryId]?.[serviceCode], goldPartners, serverId, providerId: requiredProviderId })
  const supplier = suppliers[0]
  if (!supplier) throw new NumberProviderError('NO_NUMBERS', true)
  const selectedTier = { '1': 'standard', '2': 'silver', '3': 'gold' }[serverId]
  const sellingPriceKobo = numberSellingPriceKobo(supplier.price, serverId, { countryId, serviceCode, providerId: supplier.providerId }, pricing)
  const reservationMaxPriceUsd = reservationPriceLimitUsd({ sellingPriceKobo, providerPriceUsd: supplier.price })
  const quote = {
    userId: String(userId), countryId, serviceCode, serverId, providerId: supplier.providerId,
    providerIds: suppliers.filter((candidate) => candidate.price <= reservationMaxPriceUsd).slice(0, 10).map((candidate) => candidate.providerId),
    providerPriceUsd: supplier.price, reservationMaxPriceUsd, sellingPriceKobo,
    quality: selectedTier, available: supplier.available,
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

export async function verifyNumberQuote(token, userId, pricing = {}) {
  const { payload } = await jwtVerify(token, quoteSecret(), { issuer: 'lms-number-quote', audience: 'lms-number-checkout', algorithms: ['HS256'] })
  if (payload.userId !== String(userId)) throw new Error('Invalid quote owner')
  if (payload.sellingPriceKobo !== numberSellingPriceKobo(payload.providerPriceUsd, payload.serverId, payload, pricing)) {
    throw new Error('Number pricing has changed; refresh the quote')
  }
  return payload
}

export async function checkQuotedSupplier(quote) {
  const data = await providerJson('getPricesV3', { country: quote.countryId, service: quote.serviceCode })
  const row = data[quote.countryId]?.[quote.serviceCode]?.[quote.providerId]
  const priceLimit = Number(quote.reservationMaxPriceUsd || quote.providerPriceUsd)
  if (!row || !(Number(row.count) > 0) || !(Number(row.price) > 0) || Number(row.price) > priceLimit) {
    throw new NumberProviderError('QUOTE_CHANGED', true)
  }
}

export async function reserveQuotedNumber(quote) {
  // getPricesV3 is a cached inventory snapshot. The provider can move the
  // acquisition price slightly before getNumberV2 reaches the live inventory,
  // and reports that mismatch as NO_NUMBERS. Keep the quoted supplier pinned,
  // but allow a bounded cushion so available stock can still be reserved. This
  // does not change the LMS price already signed into the customer's quote.
  // New quotes carry a signed break-even limit derived from the customer price.
  // Keep the old 10% cushion only for already-issued quotes during a rolling
  // deployment; those tokens expire after two minutes.
  const maxPrice = Number(quote.reservationMaxPriceUsd)
    || Math.ceil(Number(quote.providerPriceUsd) * RESERVATION_PRICE_CUSHION_BASIS_POINTS) / 10000
  const providerIds = [...new Set([quote.providerId, ...(Array.isArray(quote.providerIds) ? quote.providerIds : [])]
    .map(String).filter((providerId) => /^\d+$/.test(providerId)))].slice(0, 10)
  const text = await numberProviderRequest('getNumberV2', {
    country: quote.countryId, service: quote.serviceCode, providerIds: providerIds.join(','), maxPrice: String(maxPrice),
  })
  if (DEFINITE_FAILURES.has(text)) {
    console.warn('[numbers] reservation rejected', { countryId: quote.countryId, serviceCode: quote.serviceCode, providerIds, code: text })
    throw new NumberProviderError(text, true)
  }
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

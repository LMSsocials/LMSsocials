const BULKACC_BASE_URL = 'https://bulkacc.com'
const SUJAN_BASE_URL = 'https://api.sujandepartment.com'
const CACHE_TTL = 5 * 60 * 1000
export const LOG_PRICE_RULES_VERSION = '2026-10-13-1'

export const BULKACC_LOG_PRODUCTS = Object.freeze([
  { code: '202954', title: 'Snapchat with Email Access', description: 'Western female names, email access, aged 3-4 months.', category: 'Snapchat', priceKobo: 600000, expected: /snapchat/i },
  { code: '201240', title: 'USA Apple ID with Email Access', description: 'USA Apple ID with email access, aged 6-7 months.', category: 'Apple ID', priceKobo: 800000, expected: /apple\s*id/i },
  { code: '201269', title: 'Canada Apple ID with Email Access', description: 'Canada Apple ID with email access, aged 1-2 months.', category: 'Apple ID', priceKobo: 750000, expected: /apple\s*id/i },
  { code: '201250', title: 'UK Apple ID with Email Access', description: 'UK Apple ID with email access, aged 1-2 months.', category: 'Apple ID', priceKobo: 500000, expected: /apple\s*id/i },
  { code: '201296', title: 'Germany Apple ID with Email Access', description: 'Germany Apple ID with email access, aged 1-2 months.', category: 'Apple ID', priceKobo: 800000, expected: /apple\s*id/i },
  { code: '201310', title: 'Australia Apple ID with Email Access', description: 'Australia Apple ID with email access, aged 1-2 months.', category: 'Apple ID', priceKobo: 700000, expected: /apple\s*id/i },
  { code: '203416', title: 'Grok AI with Email Access and 2FA', description: 'Grok AI account with email access and 2FA, aged 1-2 months.', category: 'Grok AI', priceKobo: 1100000, expected: /grok\s*ai/i },
])

const number = (value) => Number(value || 0)
const roundKobo = (value) => Math.round(value)
function markupPercent(value, environmentKey) {
  const candidate = value === undefined || value === '' ? process.env[environmentKey] : value
  const parsed = Number(candidate)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 30
}

function cleanText(value, maximum = 240) {
  let text = String(value || '')
    .replace(/<(br|\/p|\/div|\/li|\/ol|\/ul)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maximum) return text
  text = text.slice(0, maximum + 1)
  const lastSpace = text.lastIndexOf(' ')
  return `${text.slice(0, lastSpace > maximum * 0.7 ? lastSpace : maximum).trim()}…`
}

export function logCategory(...values) {
  const text = values.filter(Boolean).join(' ').toLowerCase()
  if (text.includes('apple id') || text.includes('id apple')) return 'Apple ID'
  if (text.includes('grok')) return 'Grok AI'
  if (text.includes('facebook') || /\bfb\b/.test(text)) return 'Facebook'
  if (text.includes('instagram') || /\big\b/.test(text)) return 'Instagram'
  if (text.includes('tiktok') || text.includes('tiktiok')) return 'TikTok'
  if (text.includes('snapchat')) return 'Snapchat'
  if (text.includes('spotify')) return 'Spotify'
  if (text.includes('textplus')) return 'TextPlus'
  if (text.includes('nextplus')) return 'NextPlus'
  if (text.includes('trustpilot')) return 'TrustPilot'
  if (text.includes('reddit')) return 'Reddit'
  if (text.includes('google voice')) return 'Google Voice'
  if (text.includes('gmail')) return 'Gmail'
  if (text.includes('youtube')) return 'YouTube'
  if (text.includes('twitter') || /\bx\b/.test(text)) return 'X / Twitter'
  if (text.includes('linkedin')) return 'LinkedIn'
  if (text.includes('github')) return 'GitHub'
  if (text.includes('discord')) return 'Discord'
  if (text.includes('pinterest')) return 'Pinterest'
  if (text.includes('telegram')) return 'Telegram'
  if (text.includes('whatsapp')) return 'WhatsApp'
  if (text.includes('vpn') || /\bexpress\b/.test(text)) return 'VPN'
  if (text.includes('proxy') || text.includes(' ip ')) return 'Proxy'
  return 'Other'
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000), cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Supplier request failed (${response.status})`)
  return payload
}

function sujanPriceKobo(priceMinor, quantity = 1, percentage) {
  const markup = 1 + markupPercent(percentage, 'SUJAN_MARKUP_PERCENT') / 100
  return roundKobo(number(priceMinor) * quantity * markup)
}

export function applyLogPriceRules(title, calculatedPriceKobo) {
  const normalizedTitle = String(title || '').replace(/\s+/g, ' ').trim().toUpperCase()
  const fixedPrices = [
    [/^MICROSOFT TEXTPLUS\b/, 270000],
    [/^MICROSOFT NEXTPLUS\b/, 290000],
    [/^OLD GOOGLE VOICE \(TEXT AND CALL\)/, 860000],
    [/^NEW GOOGLE VOICE \(ONLY CALL\)/, 670000],
    [/^9 PROXY = 40 IP$/, 750000],
    [/^9 PROXY = 30 IP$/, 630000],
    [/^9 PROXY = 20 IP$/, 480000],
    [/^AVAST VPN\b/, 230000],
    [/^EXPRESS FOR (?:LAPTOP & PC|PHONE)$/, 270000],
    [/\bVPN 7 DAYS\b|\b7 DAYS VPN\b/, 120000],
    [/\bCLONE(?:D)? X OLD TWITTER\b.*\b2021\s*-\s*2024\b.*\bYOPMAIL\b.*\bFULL 2FA\b/, 600000],
    [/\bCLONE(?:D)? X TWITTER\b/, 230000],
    [/\bX TWITTER\b.*\bYEAR 2011\b/, 490000],
    [/^USA FACEBOOK PAGE CREATE ALREADY$/, 800000],
    [/^RANDOM FB PAGE CREATED? YOURSELF$/, 390000],
  ]
  const fixedPrice = fixedPrices.find(([pattern]) => pattern.test(normalizedTitle))
  if (fixedPrice) return fixedPrice[1]
  if (/\bCLONE(?:D)?\b/.test(normalizedTitle)) return roundKobo(number(calculatedPriceKobo) * 2)
  return calculatedPriceKobo
}

export function isHiddenLogProduct(title) {
  const normalizedTitle = String(title || '').replace(/\s+/g, ' ').trim().toUpperCase()
  return normalizedTitle === 'OLD GMAIL 2025' || /^RANDOM FB PAGE CREATED? YOURSELF$/.test(normalizedTitle)
}

function bulkUrl(path, parameters = {}) {
  if (!process.env.BULKACC_API_KEY) throw new Error('Bulk account supplier is not configured')
  const url = new URL(path, BULKACC_BASE_URL)
  url.searchParams.set('apiKey', process.env.BULKACC_API_KEY)
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  return url
}

async function bulkPayload(path, parameters = {}, options = {}) {
  const payload = await jsonFetch(bulkUrl(path, parameters), options)
  if (Number(payload.statusCode) !== 200) throw new Error(payload.message || 'BulkAcc request failed')
  return payload
}

function bulkDefinition(code) {
  return BULKACC_LOG_PRODUCTS.find((item) => item.code === String(code))
}

async function fetchBulkProduct(definition) {
  const payload = await bulkPayload('/api/products', { productCode: definition.code })
  const item = Array.isArray(payload.data) ? payload.data[0] : payload.data?.items?.[0] || payload.data
  if (!item || String(item.code) !== definition.code || !definition.expected.test(String(item.name || ''))) {
    throw new Error('BulkAcc returned an unexpected product')
  }
  return item
}

function sujanHeaders() {
  if (!process.env.SUJAN_API_KEY) throw new Error('Marketplace supplier is not configured')
  return { Authorization: `Bearer ${process.env.SUJAN_API_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
}

export async function retrieveBulkOrder(providerOrderId) {
  const delivered = await bulkPayload('/api/orders', { orderCode: providerOrderId })
  return (delivered.data || []).map((item) => item.accountInformation).filter(Boolean).join('\n')
}

export async function bulkCatalog() {
  const cached = globalThis.__bulkAccLogCatalog
  if (cached && cached.priceRulesVersion === LOG_PRICE_RULES_VERSION && Date.now() - cached.createdAt < CACHE_TTL) return cached.items
  const results = await Promise.allSettled(BULKACC_LOG_PRODUCTS.map(async (definition) => {
    const item = await fetchBulkProduct(definition)
    const stockCount = number(item.inStock)
    if (stockCount < Math.max(1, number(item.min))) return null
    return {
      _id: `bulkacc:${definition.code}`, source: 'bulkacc', title: definition.title, brand: definition.category,
      category: definition.category, description: definition.description, priceKobo: definition.priceKobo,
      stockCount, quantity: 1, imageUrl: '',
    }
  }))
  const items = results.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value)
  if (!items.length && results.some((result) => result.status === 'rejected')) throw new Error('BulkAcc catalog is unavailable')
  globalThis.__bulkAccLogCatalog = { createdAt: Date.now(), priceRulesVersion: LOG_PRICE_RULES_VERSION, items }
  return items
}

export async function bulkProduct(id, requestedQuantity = 1) {
  const definition = bulkDefinition(id)
  const quantity = Number(requestedQuantity)
  if (!definition) throw new Error('UNKNOWN_PRODUCT')
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('INVALID_QUANTITY')
  const item = await fetchBulkProduct(definition)
  const minimum = Math.max(1, number(item.min))
  if (quantity < minimum) throw new Error('INVALID_QUANTITY')
  if (number(item.inStock) < quantity) throw new Error('OUT_OF_STOCK')
  return {
    id: definition.code, title: definition.title, category: definition.category,
    unitPriceKobo: definition.priceKobo, priceKobo: definition.priceKobo * quantity, quantity,
  }
}

export async function placeBulkOrder(product) {
  const payload = await bulkPayload('/api/orders', { productCode: product.id, quantity: product.quantity }, { method: 'POST' })
  const providerOrderId = String(payload.data || '')
  if (!providerOrderId) throw new Error(payload.message || 'BulkAcc did not create the order')
  return { providerOrderId, credentials: '' }
}

export async function sujanCatalog(pricing = {}) {
  const activeMarkup = markupPercent(pricing.sujanMarkupPercent, 'SUJAN_MARKUP_PERCENT')
  const cached = globalThis.__sujanLogCatalog
  if (cached && cached.markupPercent === activeMarkup && cached.priceRulesVersion === LOG_PRICE_RULES_VERSION && Date.now() - cached.createdAt < CACHE_TTL) return cached.items
  const payload = await jsonFetch(`${SUJAN_BASE_URL}/reseller/v1/products`, { headers: sujanHeaders() })
  const items = (payload.data || []).filter((item) => number(item.available_stock) > 0 && !isHiddenLogProduct(item.name)).map((item) => {
    const category = logCategory(item.category?.name, item.platform?.name, item.name)
    return {
      _id: `sujan:${item.id}`, source: 'sujan', title: cleanText(item.name, 110), brand: category, category,
      description: cleanText(item.description || 'Instant digital delivery.'), priceKobo: applyLogPriceRules(item.name, sujanPriceKobo(item.price_minor, 1, activeMarkup)),
      stockCount: number(item.available_stock), quantity: 1, imageUrl: '',
    }
  })
  globalThis.__sujanLogCatalog = { createdAt: Date.now(), markupPercent: activeMarkup, priceRulesVersion: LOG_PRICE_RULES_VERSION, items }
  return items
}

export async function sujanProduct(id, pricing = {}, requestedQuantity = 1) {
  const products = await sujanCatalog(pricing)
  const product = products.find((item) => item._id === `sujan:${id}`)
  const quantity = Number(requestedQuantity)
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('INVALID_QUANTITY')
  if (!product?.stockCount || product.stockCount < quantity) throw new Error('OUT_OF_STOCK')
  return { id: number(id), title: product.title, unitPriceKobo: product.priceKobo, priceKobo: product.priceKobo * quantity, quantity }
}

function credentialText(data) {
  const value = data?.credentials ?? data?.accounts ?? data?.items ?? data?.delivery ?? data?.account ?? data?.account_information
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : item.accountInformation || item.credentials || JSON.stringify(item)).join('\n')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value || '')
}

export async function placeSujanOrder(product) {
  const payload = await jsonFetch(`${SUJAN_BASE_URL}/reseller/v1/orders`, {
    method: 'POST', headers: sujanHeaders(), body: JSON.stringify({ product_id: product.id, quantity: product.quantity }),
  })
  const data = payload.data || payload
  const providerOrderId = String(data.id ?? data.order_id ?? data.orderId ?? data.code ?? '')
  const credentials = credentialText(data)
  return { providerOrderId, credentials }
}

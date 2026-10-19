import { supplierPricingVersion, supplierProductPriceKobo } from './supplier-pricing.js'

const BULKACC_BASE_URL = 'https://bulkacc.com'
const SUJAN_BASE_URL = 'https://api.sujandepartment.com'
const CACHE_TTL = 5 * 60 * 1000
export const LOG_PRICE_RULES_VERSION = '2026-10-19-9'

export function bulkMarkedUpPriceKobo(priceUsd, percentage = 30, usdToNgnRate = 1600) {
  return Math.round(Number(priceUsd) * Number(usdToNgnRate) * (1 + Number(percentage) / 100) * 100)
}

export const BULKACC_LOG_PRODUCTS = Object.freeze([
  { code: '200303', title: 'Snapchat with Email Access', description: 'Western female names, email access, aged 3-4 months.', category: 'Snapchat', priceKobo: 600000, expected: /snapchat/i },
  { code: '201240', title: 'USA Apple ID with Email Access', description: 'USA Apple ID with email access, aged 6-7 months.', category: 'Apple ID', priceKobo: 800000, expected: /apple\s*id/i },
  { code: '201269', title: 'Canada Apple ID with Email Access', description: 'Canada Apple ID with email access, aged 1-2 months.', category: 'Apple ID', priceKobo: 750000, expected: /apple\s*id/i },
  { code: '201250', title: 'UK Apple ID with Email Access', description: 'UK Apple ID with email access, aged 1-2 months.', category: 'Apple ID', priceKobo: 500000, expected: /apple\s*id/i },
  { code: '201296', title: 'Germany Apple ID with Email Access', description: 'Germany Apple ID with email access, aged 1-2 months.', category: 'Apple ID', priceKobo: 800000, expected: /apple\s*id/i },
  { code: '201310', title: 'Australia Apple ID with Email Access', description: 'Australia Apple ID with email access, aged 1-2 months.', category: 'Apple ID', priceKobo: 700000, expected: /apple\s*id/i },
  { code: '203416', title: 'Grok AI with Email Access and 2FA', description: 'Grok AI account with email access and 2FA, aged 1-2 months.', category: 'Grok AI', priceKobo: 1100000, expected: /grok\s*ai/i },
  { code: '200466', title: 'USA SoundCloud with Email and 2FA', description: 'USA SoundCloud account with verified email and 2FA, aged 2-3 years.', category: 'SoundCloud', priceKobo: 3000000, expected: /soundcloud/i },
  { code: '200816', title: 'USA Twitch with Email Access', description: 'USA Twitch account with email access, aged 2-3 years.', category: 'Twitch', priceKobo: 1700000, expected: /twitch/i },
  { code: '202810', title: 'ChatGPT with Email Access (<1 Month)', description: 'ChatGPT account with email access, aged under 1 month.', category: 'ChatGPT', priceKobo: 1000000, expected: /chatgpt/i },
  { code: '202820', title: 'ChatGPT with Email Access (10-11 Months)', description: 'ChatGPT account with email access, aged 10-11 months.', category: 'ChatGPT', priceKobo: 1000000, expected: /chatgpt/i },
  { code: '202821', title: 'ChatGPT with Email Access (11-12 Months)', description: 'ChatGPT account with email access, aged 11-12 months.', category: 'ChatGPT', priceKobo: 1000000, expected: /chatgpt/i },
  { code: '202822', title: 'ChatGPT with Email Access (1-2 Years)', description: 'ChatGPT account with email access, aged 1-2 years.', category: 'ChatGPT', priceKobo: 1000000, expected: /chatgpt/i },
  { code: '202823', title: 'ChatGPT with Email Access (2-3 Years)', description: 'ChatGPT account with email access, aged 2-3 years.', category: 'ChatGPT', priceKobo: 1000000, expected: /chatgpt/i },
  { code: '203503', title: 'ChatGPT with Email Access and 2FA (<1 Month)', description: 'ChatGPT account with email access and 2FA, aged under 1 month.', category: 'ChatGPT', priceKobo: 1000000, expected: /chatgpt/i },
  { code: '203513', title: 'ChatGPT with Email Access and 2FA (10-11 Months)', description: 'ChatGPT account with email access and 2FA, aged 10-11 months.', category: 'ChatGPT', priceKobo: 1000000, expected: /chatgpt/i },
  { code: '203514', title: 'ChatGPT with Email Access and 2FA (11-12 Months)', description: 'ChatGPT account with email access and 2FA, aged 11-12 months.', category: 'ChatGPT', priceKobo: 1000000, expected: /chatgpt/i },
  { code: '203220', title: 'USA Roblox with Email Access (7-8 Months)', description: 'USA Roblox account with email access, aged 7-8 months.', category: 'Roblox', priceKobo: 400000, expected: /roblox/i },
  { code: '203221', title: 'USA Roblox with Email Access (8-9 Months)', description: 'USA Roblox account with email access, aged 8-9 months.', category: 'Roblox', priceKobo: 400000, expected: /roblox/i },
  { code: '203222', title: 'USA Roblox with Email Access (9-10 Months)', description: 'USA Roblox account with email access, aged 9-10 months.', category: 'Roblox', priceKobo: 400000, expected: /roblox/i },
  { code: '203223', title: 'USA Roblox with Email Access (10-11 Months)', description: 'USA Roblox account with email access, aged 10-11 months.', category: 'Roblox', priceKobo: 400000, expected: /roblox/i },
  { code: '203224', title: 'USA Roblox with Email Access (11-12 Months)', description: 'USA Roblox account with email access, aged 11-12 months.', category: 'Roblox', priceKobo: 400000, expected: /roblox/i },
  { code: '203237', title: 'USA Roblox with Email Access and 2FA (9-10 Months)', description: 'USA Roblox account with email access and 2FA, aged 9-10 months.', category: 'Roblox', priceKobo: 400000, expected: /roblox/i },
  { code: '203238', title: 'USA Roblox with Email Access and 2FA (10-11 Months)', description: 'USA Roblox account with email access and 2FA, aged 10-11 months.', category: 'Roblox', priceKobo: 400000, expected: /roblox/i },
  { code: '203239', title: 'USA Roblox with Email Access and 2FA (11-12 Months)', description: 'USA Roblox account with email access and 2FA, aged 11-12 months.', category: 'Roblox', priceKobo: 400000, expected: /roblox/i },
  { code: '203027', title: 'Italy Snapchat with Gmail Access', description: 'Italy Snapchat account registered with Gmail, aged 1-2 years.', category: 'Snapchat', priceKobo: 6700000, expected: /snapchat/i },
  { code: '201733', title: 'USA LinkedIn with Gmail Access and 2FA', description: 'Aged USA LinkedIn account with Gmail access and 2FA, aged 1-2 years.', category: 'LinkedIn', priceKobo: bulkMarkedUpPriceKobo(50.93, 30, 1600), expected: /linkedin/i },
  { code: '200412', title: 'USA Spotify with Email Access', description: 'USA Spotify account with email access, aged 11-12 months.', category: 'Spotify', priceKobo: bulkMarkedUpPriceKobo(3.72, 30, 1600), expected: /spotify/i },
  { code: '202413', title: 'USA Yelp with Email Access', description: 'USA Yelp account with email access, aged under 1 month.', category: 'Yelp', priceKobo: 1000000, expected: /yelp/i },
  { code: '201231', title: 'USA Snapchat Registered with Gmail (1-2 Years)', description: 'USA Snapchat account registered with Gmail, aged 1-2 years.', category: 'Snapchat', priceKobo: 6700000, expected: /usa snapchat accounts.*registered with gmail.*1-2 years/i, useLiveDetails: true },
  { code: '202351', title: 'United Kingdom Snapchat Registered with Gmail (1-2 Years)', description: 'United Kingdom Snapchat account registered with Gmail, aged 1-2 years.', category: 'Snapchat', priceKobo: 6700000, expected: /united kingdom.*snapchat accounts.*registered with gmail.*1-2 years/i, useLiveDetails: true },
  { code: '202962', title: 'Canada Snapchat Registered with Gmail (11-12 Months)', description: 'Canada Snapchat account registered with Gmail, aged 11-12 months.', category: 'Snapchat', priceKobo: 5400000, expected: /canada.*snapchat accounts.*registered with gmail.*11-12 months/i, useLiveDetails: true },
  { code: '203011', title: 'Spain Snapchat Registered with Gmail (1-2 Years)', description: 'Spain Snapchat account registered with Gmail, aged 1-2 years.', category: 'Snapchat', priceKobo: 6700000, expected: /spain.*snapchat accounts.*registered with gmail.*1-2 years/i, useLiveDetails: true },
  { code: '201182', title: 'Snapchat Registered with Gmail, Western Female Names (9-10 Months)', description: 'Snapchat account registered with Gmail using Western female names, aged 9-10 months.', category: 'Snapchat', priceKobo: 2800000, expected: /snapchat.*registered with gmail.*wester[nm] female names.*9-10 months/i, useLiveDetails: true },
  { code: '201082', title: 'Aged USA TikTok Ads Manager Account - Prepaid (1-2 Years)', description: 'Aged USA TikTok Ads Manager account with prepaid access, aged 1-2 years.', category: 'TikTok', priceKobo: null, expected: /tiktok ads manager account.*prepaid.*1-2 years/i, useLiveDetails: true },
  { code: '200313', title: 'Snapchat with Email Access, Western Female Names (6-7 Months)', description: 'Snapchat account with email access using Western female names, aged 6-7 months.', category: 'Snapchat', priceKobo: 1100000, expected: /snapchat.*email access.*wester[nm] female names.*6-7 months/i, useLiveDetails: true },
  { code: '200305', title: 'Snapchat with Email Access, Western Female Names (4-5 Months)', description: 'Snapchat account with email access using Western female names, aged 4-5 months.', category: 'Snapchat', priceKobo: 700000, expected: /snapchat.*email access.*wester[nm] female names.*4-5 months/i, useLiveDetails: true },
  { code: '204743', title: 'Product 204743', description: 'Live supplier product with instant delivery.', category: 'Other', priceKobo: null, expected: /./, useLiveDetails: true },
  { code: '201020', title: 'Product 201020', description: 'Live supplier product with instant delivery.', category: 'Other', priceKobo: null, expected: /./, useLiveDetails: true },
  { code: '202060', title: 'Product 202060', description: 'Live supplier product with instant delivery.', category: 'Other', priceKobo: null, expected: /./, useLiveDetails: true },
  { code: '201112', title: 'Product 201112', description: 'Live supplier product with instant delivery.', category: 'Other', priceKobo: null, expected: /./, useLiveDetails: true },
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
  if (text.includes('onlyfans')) return 'OnlyFans'
  if (text.includes('gmx')) return 'Email'
  if (text.includes('apple id') || text.includes('id apple')) return 'Apple ID'
  if (text.includes('grok')) return 'Grok AI'
  if (text.includes('chatgpt')) return 'ChatGPT'
  if (text.includes('soundcloud')) return 'SoundCloud'
  if (text.includes('roblox')) return 'Roblox'
  if (text.includes('twitch')) return 'Twitch'
  if (text.includes('yelp')) return 'Yelp'
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
  if (text.includes('linkedin')) return 'LinkedIn'
  if (text.includes('gmail')) return 'Gmail'
  if (text.includes('youtube')) return 'YouTube'
  if (text.includes('twitter') || /\bx\b/.test(text)) return 'X / Twitter'
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

export function isHiddenSujanProduct(item) {
  return logCategory(item?.category?.name, item?.platform?.name, item?.name) === 'Gmail'
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

function bulkLivePriceKobo(item) {
  const priceUsd = Number(item.priceUsd ?? item.priceUSD ?? item.price ?? item.unitPrice ?? 0)
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error('BulkAcc returned an invalid product price')
  return bulkMarkedUpPriceKobo(priceUsd, 30, 1600)
}

function bulkProductDetails(definition, item) {
  if (!definition.useLiveDetails) return definition
  const title = cleanText(item.name || definition.title, 110)
  const category = logCategory(item.category?.name, item.category, title)
  return {
    ...definition,
    title,
    category,
    description: cleanText(item.description || `Product code ${definition.code}. Instant digital delivery.`),
    priceKobo: definition.priceKobo ?? bulkLivePriceKobo(item),
  }
}

async function fetchBulkProduct(definition) {
  const payload = await bulkPayload('/api/products', { productCode: definition.code })
  const item = Array.isArray(payload.data) ? payload.data[0] : payload.data?.items?.[0] || payload.data
  if (!item || String(item.code) !== definition.code || !definition.expected.test(String(item.name || ''))) {
    throw new Error('BulkAcc returned an unexpected product')
  }
  return item
}

async function settledMapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length)
  let nextIndex = 0
  async function run() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      try {
        results[index] = { status: 'fulfilled', value: await worker(values[index]) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run))
  return results
}

function sujanHeaders() {
  if (!process.env.SUJAN_API_KEY) throw new Error('Marketplace supplier is not configured')
  return { Authorization: `Bearer ${process.env.SUJAN_API_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
}

export async function retrieveBulkOrder(providerOrderId) {
  const delivered = await bulkPayload('/api/orders', { orderCode: providerOrderId })
  return (delivered.data || []).map((item) => item.accountInformation).filter(Boolean).join('\n')
}

export async function bulkCatalog(pricing = {}) {
  const pricingVersion = supplierPricingVersion(pricing)
  const cached = globalThis.__bulkAccLogCatalog
  if (cached && cached.pricingVersion === pricingVersion && cached.priceRulesVersion === LOG_PRICE_RULES_VERSION && Date.now() - cached.createdAt < CACHE_TTL) return cached.items
  const definitions = [...BULKACC_LOG_PRODUCTS].sort((left, right) => Number(right.useLiveDetails) - Number(left.useLiveDetails))
  const results = await settledMapWithConcurrency(definitions, 4, async (definition) => {
    const item = await fetchBulkProduct(definition)
    const details = bulkProductDetails(definition, item)
    const stockCount = number(item.inStock)
    if (stockCount < Math.max(1, number(item.min))) return null
    return {
      _id: `bulkacc:${definition.code}`, source: 'bulkacc', title: details.title, brand: details.category,
      category: details.category, description: details.description,
      basePriceKobo: details.priceKobo,
      priceKobo: supplierProductPriceKobo(pricing, `bulkacc:${definition.code}`, details.priceKobo),
      stockCount, quantity: 1, imageUrl: '',
    }
  })
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]
    if (result.status === 'rejected') {
      console.error(`BulkAcc catalogue product ${definitions[index].code} was rejected:`, result.reason?.message || result.reason)
    }
  }
  const items = results.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value)
  if (!items.length && results.some((result) => result.status === 'rejected')) throw new Error('BulkAcc catalog is unavailable')
  globalThis.__bulkAccLogCatalog = { createdAt: Date.now(), pricingVersion, priceRulesVersion: LOG_PRICE_RULES_VERSION, items }
  return items
}

export async function bulkProduct(id, requestedQuantity = 1, pricing = {}) {
  const definition = bulkDefinition(id)
  const quantity = Number(requestedQuantity)
  if (!definition) throw new Error('UNKNOWN_PRODUCT')
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('INVALID_QUANTITY')
  const item = await fetchBulkProduct(definition)
  const details = bulkProductDetails(definition, item)
  const minimum = Math.max(1, number(item.min))
  if (quantity < minimum) throw new Error('INVALID_QUANTITY')
  if (number(item.inStock) < quantity) throw new Error('OUT_OF_STOCK')
  const unitPriceKobo = supplierProductPriceKobo(pricing, `bulkacc:${definition.code}`, details.priceKobo)
  return {
    id: definition.code, title: details.title, category: details.category,
    unitPriceKobo, priceKobo: unitPriceKobo * quantity, quantity,
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
  const pricingVersion = supplierPricingVersion(pricing)
  const cached = globalThis.__sujanLogCatalog
  if (cached && cached.pricingVersion === pricingVersion && cached.priceRulesVersion === LOG_PRICE_RULES_VERSION && Date.now() - cached.createdAt < CACHE_TTL) return cached.items
  const payload = await jsonFetch(`${SUJAN_BASE_URL}/reseller/v1/products`, { headers: sujanHeaders() })
  const items = (payload.data || []).filter((item) => !isHiddenSujanProduct(item)).map((item) => {
    const category = logCategory(item.category?.name, item.platform?.name, item.name)
    const basePriceKobo = applyLogPriceRules(item.name, sujanPriceKobo(item.price_minor, 1, activeMarkup))
    return {
      _id: `sujan:${item.id}`, source: 'sujan', title: cleanText(item.name, 110), brand: category, category,
      description: cleanText(item.description || 'Instant digital delivery.'),
      basePriceKobo,
      priceKobo: supplierProductPriceKobo(pricing, `sujan:${item.id}`, basePriceKobo),
      stockCount: number(item.available_stock), quantity: 1, imageUrl: '',
    }
  })
  globalThis.__sujanLogCatalog = { createdAt: Date.now(), pricingVersion, priceRulesVersion: LOG_PRICE_RULES_VERSION, items }
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

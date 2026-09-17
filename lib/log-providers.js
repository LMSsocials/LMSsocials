const BULKACC_BASE_URL = 'https://bulkacc.com'
const SUJAN_BASE_URL = 'https://api.sujandepartment.com'
const CACHE_TTL = 5 * 60 * 1000
export const LOG_PRICE_RULES_VERSION = '2026-09-17-2'

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
    [/^MICROSOFT NEXTPLUS\b/, 220000],
    [/^OLD GOOGLE VOICE \(TEXT AND CALL\)/, 860000],
    [/^NEW GOOGLE VOICE \(ONLY CALL\)/, 670000],
    [/^9 PROXY = 40 IP$/, 750000],
    [/^9 PROXY = 30 IP$/, 630000],
    [/^9 PROXY = 20 IP$/, 480000],
    [/^AVAST VPN\b/, 230000],
    [/^EXPRESS FOR (?:LAPTOP & PC|PHONE)$/, 270000],
    [/\bVPN 7 DAYS\b|\b7 DAYS VPN\b/, 120000],
    [/\bCLONE(?:D)? X TWITTER\b/, 230000],
    [/\bX TWITTER\b.*\bYEAR 2011\b/, 490000],
    [/^USA FACEBOOK PAGE CREATE ALREADY$/, 450000],
    [/^RANDOM FB PAGE CREATED? YOURSELF$/, 390000],
  ]
  const fixedPrice = fixedPrices.find(([pattern]) => pattern.test(normalizedTitle))
  if (fixedPrice) return fixedPrice[1]
  if (/\bCLONE(?:D)?\b/.test(normalizedTitle)) return roundKobo(number(calculatedPriceKobo) * 2)
  return calculatedPriceKobo
}

function bulkUrl(path, parameters = {}) {
  if (!process.env.BULKACC_API_KEY) throw new Error('Bulk account supplier is not configured')
  const url = new URL(path, BULKACC_BASE_URL)
  url.searchParams.set('apiKey', process.env.BULKACC_API_KEY)
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  return url
}

function sujanHeaders() {
  if (!process.env.SUJAN_API_KEY) throw new Error('Marketplace supplier is not configured')
  return { Authorization: `Bearer ${process.env.SUJAN_API_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' }
}

export async function retrieveBulkOrder(providerOrderId) {
  const delivered = await jsonFetch(bulkUrl('/api/orders', { orderCode: providerOrderId }))
  return (delivered.data || []).map((item) => item.accountInformation).filter(Boolean).join('\n')
}

export async function sujanCatalog(pricing = {}) {
  const activeMarkup = markupPercent(pricing.sujanMarkupPercent, 'SUJAN_MARKUP_PERCENT')
  const cached = globalThis.__sujanLogCatalog
  if (cached && cached.markupPercent === activeMarkup && cached.priceRulesVersion === LOG_PRICE_RULES_VERSION && Date.now() - cached.createdAt < CACHE_TTL) return cached.items
  const payload = await jsonFetch(`${SUJAN_BASE_URL}/reseller/v1/products`, { headers: sujanHeaders() })
  const items = (payload.data || []).filter((item) => number(item.available_stock) > 0).map((item) => {
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

export async function sujanProduct(id, pricing = {}) {
  const products = await sujanCatalog(pricing)
  const product = products.find((item) => item._id === `sujan:${id}`)
  if (!product?.stockCount) throw new Error('OUT_OF_STOCK')
  return { id: number(id), title: product.title, priceKobo: product.priceKobo, quantity: 1 }
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

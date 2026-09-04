const BULKACC_BASE_URL = 'https://bulkacc.com'
const SUJAN_BASE_URL = 'https://api.sujandepartment.com'
const CACHE_TTL = 5 * 60 * 1000

const number = (value) => Number(value || 0)
const roundKobo = (value) => Math.round(value)
const markupPercent = (value) => value === undefined || value === '' ? 30 : number(value)

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
  if (text.includes('tiktok')) return 'TikTok'
  if (text.includes('snapchat')) return 'Snapchat'
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
  if (text.includes('vpn')) return 'VPN'
  if (text.includes('proxy') || text.includes(' ip ')) return 'Proxy'
  return 'Other'
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000), cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Supplier request failed (${response.status})`)
  return payload
}

function bulkPriceKobo(price, quantity = 1) {
  const rate = number(process.env.BULKACC_USD_TO_NGN_RATE) || 1600
  const markup = 1 + markupPercent(process.env.BULKACC_MARKUP_PERCENT) / 100
  return roundKobo(number(price) * quantity * rate * markup * 100)
}

function sujanPriceKobo(priceMinor, quantity = 1) {
  const markup = 1 + markupPercent(process.env.SUJAN_MARKUP_PERCENT) / 100
  return roundKobo(number(priceMinor) * quantity * markup)
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

export async function bulkCatalog() {
  const cached = globalThis.__bulkLogCatalog
  if (cached && Date.now() - cached.createdAt < CACHE_TTL) return cached.items
  const first = await jsonFetch(bulkUrl('/api/products/list', { pageIndex: 1, pageSize: 100 }))
  if (first.statusCode !== 200) throw new Error(first.message || 'Bulk catalog failed')
  const pages = Math.min(50, number(first.data?.totalPages) || 1)
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
    jsonFetch(bulkUrl('/api/products/list', { pageIndex: index + 2, pageSize: 100 })).catch(() => ({ data: { items: [] } }))))
  const items = [first, ...rest].flatMap((payload) => payload.data?.items || []).filter((item) => number(item.inStock) > 0).map((item) => {
    const minimum = Math.max(1, number(item.min) || 1)
    return {
      _id: `bulkacc:${item.code}`, source: 'bulkacc', title: cleanText(item.name, 110), brand: logCategory(item.groupName, item.categoryName, item.name),
      category: logCategory(item.groupName, item.categoryName, item.name), description: cleanText(item.description || item.categoryName || 'Instant digital delivery.'),
      priceKobo: bulkPriceKobo(item.price, minimum), stockCount: Math.floor(number(item.inStock) / minimum), quantity: minimum, imageUrl: '',
    }
  })
  globalThis.__bulkLogCatalog = { createdAt: Date.now(), items }
  return items
}

export async function bulkProduct(code) {
  const payload = await jsonFetch(bulkUrl('/api/products', { productCode: code }))
  if (payload.statusCode !== 200 || !payload.data || number(payload.data.inStock) < 1) throw new Error('OUT_OF_STOCK')
  const minimum = Math.max(1, number(payload.data.min) || 1)
  return { code: String(payload.data.code), title: payload.data.name, quantity: minimum, priceKobo: bulkPriceKobo(payload.data.price, minimum) }
}

export async function placeBulkOrder(product) {
  const created = await jsonFetch(bulkUrl('/api/orders', { productCode: product.code, quantity: product.quantity }), { method: 'POST' })
  if (created.statusCode !== 200 || !created.data) throw new Error(created.message || 'Supplier order failed')
  const providerOrderId = String(created.data)
  const credentials = await retrieveBulkOrder(providerOrderId).catch(() => '')
  return { providerOrderId, credentials }
}

export async function retrieveBulkOrder(providerOrderId) {
  const delivered = await jsonFetch(bulkUrl('/api/orders', { orderCode: providerOrderId }))
  return (delivered.data || []).map((item) => item.accountInformation).filter(Boolean).join('\n')
}

export async function sujanCatalog() {
  const cached = globalThis.__sujanLogCatalog
  if (cached && Date.now() - cached.createdAt < CACHE_TTL) return cached.items
  const payload = await jsonFetch(`${SUJAN_BASE_URL}/reseller/v1/products`, { headers: sujanHeaders() })
  const items = (payload.data || []).filter((item) => number(item.available_stock) > 0).map((item) => {
    const category = logCategory(item.category?.name, item.platform?.name, item.name)
    return {
      _id: `sujan:${item.id}`, source: 'sujan', title: cleanText(item.name, 110), brand: category, category,
      description: cleanText(item.description || 'Instant digital delivery.'), priceKobo: sujanPriceKobo(item.price_minor),
      stockCount: number(item.available_stock), quantity: 1, imageUrl: '',
    }
  })
  globalThis.__sujanLogCatalog = { createdAt: Date.now(), items }
  return items
}

export async function sujanProduct(id) {
  const products = await sujanCatalog()
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

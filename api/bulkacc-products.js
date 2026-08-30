const BULKACC_BASE_URL = 'https://bulkacc.com'

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' })
  if (!process.env.BULKACC_API_KEY) return response.status(503).json({ message: 'Supplier integration is not configured' })

  const pageIndex = Math.max(1, Number(request.query.pageIndex) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize) || 30))
  const params = new URLSearchParams({
    apiKey: process.env.BULKACC_API_KEY,
    pageIndex: String(pageIndex),
    pageSize: String(pageSize),
  })

  try {
    const supplierResponse = await fetch(BULKACC_BASE_URL + '/api/products/list?' + params)
    const payload = await supplierResponse.json()
    if (!supplierResponse.ok || payload.statusCode !== 200) throw new Error(payload.message || 'Supplier request failed')

    const exchangeRate = Number(process.env.BULKACC_USD_TO_NGN_RATE) || 1600
    const markup = 1 + (Number(process.env.BULKACC_MARKUP_PERCENT) || 35) / 100
    const items = payload.data.items.map((item) => ({
      code: item.code,
      platform: item.groupName || item.categoryName || 'Other',
      title: item.name,
      detail: item.description || item.categoryName || 'Supplier fulfilled',
      stock: item.inStock,
      minimum: item.min,
      price: Math.ceil(Number(item.price) * exchangeRate * markup / 50) * 50,
    }))

    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return response.status(200).json({ items, totalCount: payload.data.totalCount, pageIndex, pageSize })
  } catch (error) {
    console.error('[bulkacc/products] request failed', { message: error.message })
    return response.status(502).json({ message: 'Supplier catalogue is temporarily unavailable' })
  }
}

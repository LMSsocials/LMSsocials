export function normalizeToolUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

export function toolPriceKobo(value) {
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return null
  return Math.round(price * 100)
}

export function serializeTool(tool) {
  return {
    _id: tool._id.toString(),
    name: tool.name,
    url: tool.url,
    priceKobo: Number(tool.priceKobo || 0),
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt,
  }
}

export function normalizePictureUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

export function normalizePicturePreview(value) {
  const raw = String(value || '').trim()
  if (/^\/api\/picture-previews\/[a-f0-9]{24}$/i.test(raw)) return raw
  if (raw.startsWith('/')) return ''
  return normalizePictureUrl(raw)
}

export function picturePriceKobo(value) {
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return null
  return Math.round(price * 100)
}

export function serializePicture(picture, { includeDownloadUrl = true } = {}) {
  const serialized = {
    _id: picture._id.toString(),
    title: picture.title,
    description: picture.description || '',
    previewUrl: picture.previewUrl,
    priceKobo: Number(picture.priceKobo || 0),
    createdAt: picture.createdAt,
    updatedAt: picture.updatedAt,
  }
  if (includeDownloadUrl) serialized.downloadUrl = picture.downloadUrl
  return serialized
}

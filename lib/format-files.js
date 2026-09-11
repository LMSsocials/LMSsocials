export const MAX_FORMAT_FILE_SIZE = 100 * 1024 * 1024
export const FORMAT_CONTENT_TYPES = ['application/pdf', 'text/plain']
export const MIN_FORMAT_PRICE_NAIRA = 8000

const formats = new Map([
  ['pdf', { contentType: 'application/pdf', label: 'PDF' }],
  ['txt', { contentType: 'text/plain', label: 'TXT' }],
])

export function formatFileExtension(fileName) {
  const name = String(fileName || '').toLowerCase()
  const separator = name.lastIndexOf('.')
  return separator >= 0 ? name.slice(separator + 1) : ''
}

export function formatFileDetails(fileName, contentType) {
  const details = formats.get(formatFileExtension(fileName))
  const normalizedContentType = String(contentType || '').toLowerCase().split(';')[0].trim()
  return details && details.contentType === normalizedContentType ? details : null
}

export function isSupportedFormatFile(fileName, contentType) {
  return Boolean(formatFileDetails(fileName, contentType))
}

export function formatDownloadDisposition(fileName) {
  const name = String(fileName || 'download').replace(/[\r\n]/g, '') || 'download'
  const fallback = name
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '_')
    .trim() || 'download'
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export function formatPriceKobo(value) {
  const price = Number(value)
  if (!Number.isFinite(price) || price < MIN_FORMAT_PRICE_NAIRA) return null
  const priceKobo = Math.round(price * 100)
  return Number.isSafeInteger(priceKobo) ? priceKobo : null
}

export const MAX_FORMAT_FILE_SIZE = 100 * 1024 * 1024
export const FORMAT_CONTENT_TYPES = ['application/pdf', 'text/plain']

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

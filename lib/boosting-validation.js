// Shared by the browser and API. This module must not import server secrets.
export function normalizeBoostingTarget(value) {
  if (typeof value !== 'string') return null
  let input = value.trim()
  if (!input || input.length > 2000 || /[\s\\\p{Cc}]/u.test(input)) return null
  if (input.startsWith('//')) input = 'https:' + input
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) input = 'https://' + input
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    // Accept public website links; a bare username isn't enough to identify
    // the profile/post that the customer wants the provider to boost.
    if (!url.hostname.includes('.') || url.hostname.endsWith('.') || url.hostname.endsWith('.local') || url.hostname.endsWith('.localhost')) return null
    if (/^\d+(\.\d+){3}$/.test(url.hostname) || url.hostname.includes(':')) return null
    return url.toString()
  } catch { return null }
}

export function parseBoostingQuantity(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null
  if (typeof value !== 'string') return null
  const input = value.trim()
  // Allow digits and consistently grouped thousands, without interpreting
  // fractions, exponents, shorthand such as 1k, or malformed separators.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:[ \u00a0]\d{3})+)$/u.test(input)) return null
  const quantity = Number(input.replace(/[, \u00a0]/gu, ''))
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null
}

export function validateBoostingInput(body, service = null) {
  const fieldErrors = {}
  const serviceId = String(body?.serviceId ?? '').trim()
  const requestId = String(body?.requestId ?? '').trim()
  const target = normalizeBoostingTarget(body?.target)
  const quantity = parseBoostingQuantity(body?.quantity)
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(serviceId)) fieldErrors.serviceId = 'Choose a Boosting service before continuing.'
  if (!target) fieldErrors.target = 'Paste the full profile, post, or video link (for example, instagram.com/yourname). A username alone is not a link.'
  if (!quantity) fieldErrors.quantity = 'Enter a whole quantity, such as 100 or 1,000. Decimals and amounts such as 1k are not accepted.'
  else if (service && (quantity < service.min || quantity > service.max)) fieldErrors.quantity = `This service accepts ${service.min.toLocaleString('en-NG')}–${service.max.toLocaleString('en-NG')}. Enter a quantity within that range.`
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) fieldErrors.requestId = 'Your checkout request could not be identified. Refresh the page and try again.'
  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, value: { serviceId, requestId, target, quantity } }
}

import { boostingPricePerThousandNaira } from './boosting-pricing'

const PROVIDER_URL = 'https://justanotherpanel.com/api/v2'

export class BoostingProviderError extends Error {
  constructor(message, { definitive = false } = {}) {
    super(message)
    this.name = 'BoostingProviderError'
    this.definitive = definitive
  }
}

function messageFromPayload(payload, fallback) {
  if (typeof payload?.error === 'string') return payload.error
  if (typeof payload?.message === 'string') return payload.message
  return fallback
}

export async function boostingProviderRequest(action, parameters = {}) {
  const apiKey = process.env.BOOSTING_API_KEY
  if (!apiKey) throw new BoostingProviderError('Boosting integration is not configured', { definitive: true })

  const body = new URLSearchParams({ key: apiKey, action })
  Object.entries(parameters).forEach(([key, value]) => {
    if (value != null) body.set(key, String(value))
  })

  let response
  try {
    response = await fetch(PROVIDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    throw new BoostingProviderError('The boosting provider could not be reached')
  }

  const raw = await response.text()
  let payload
  try { payload = JSON.parse(raw) } catch {
    throw new BoostingProviderError('The boosting provider returned an invalid response')
  }

  if (!response.ok) throw new BoostingProviderError(messageFromPayload(payload, 'Boosting provider request failed'))
  if (payload?.error) throw new BoostingProviderError(messageFromPayload(payload, 'Boosting provider rejected the request'), { definitive: true })
  return payload
}

export const platformForBoostingService = (value = '') => {
  const text = value.toLowerCase()
  if (text.includes('instagram')) return 'Instagram'
  if (text.includes('tiktok')) return 'TikTok'
  if (text.includes('youtube')) return 'YouTube'
  if (text.includes('twitter') || text.includes(' x ')) return 'X (Twitter)'
  if (text.includes('facebook')) return 'Facebook'
  if (text.includes('linkedin')) return 'LinkedIn'
  if (text.includes('snapchat')) return 'Snapchat'
  if (text.includes('telegram')) return 'Telegram'
  if (text.includes('twitch')) return 'Twitch'
  if (text.includes('pinterest')) return 'Pinterest'
  return 'More'
}

export async function getBoostingServices() {
  const payload = await boostingProviderRequest('services')
  if (!Array.isArray(payload)) throw new BoostingProviderError('The boosting provider returned an invalid service list')

  return payload.map((item) => {
    const category = String(item.category || 'Other')
    const name = String(item.name || 'Social media service')
    return {
      id: String(item.service),
      platform: platformForBoostingService(category + ' ' + name),
      category,
      name,
      type: String(item.type || 'Default'),
      min: Number(item.min) || 0,
      max: Number(item.max) || 0,
      providerRateUsd: Number(item.rate),
      pricePerThousand: boostingPricePerThousandNaira(item.rate),
    }
  }).filter((item) => item.id && item.min > 0 && item.max >= item.min && Number.isFinite(item.providerRateUsd) && item.providerRateUsd > 0)
}

export async function getCurrentBoostingService(serviceId) {
  const service = (await getBoostingServices()).find((item) => item.id === String(serviceId))
  if (!service) throw new BoostingProviderError('This boosting service is no longer available', { definitive: true })
  return service
}

export async function placeBoostingOrder({ serviceId, target, quantity }) {
  const payload = await boostingProviderRequest('add', { service: serviceId, link: target, quantity })
  if (payload?.order == null || payload.order === '') throw new BoostingProviderError('The provider did not confirm this order')
  return String(payload.order)
}

export function normalizeBoostingStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  if (status === 'completed') return 'completed'
  if (status === 'partial') return 'partial'
  if (status === 'canceled' || status === 'cancelled') return 'canceled'
  if (status === 'in progress') return 'in_progress'
  if (status === 'processing') return 'processing'
  if (status === 'pending') return 'pending'
  return 'pending'
}

export async function getBoostingOrderStatus(providerOrderId) {
  const payload = await boostingProviderRequest('status', { order: providerOrderId })
  return {
    providerStatus: String(payload?.status || 'Pending'),
    status: normalizeBoostingStatus(payload?.status),
    remains: payload?.remains == null ? null : Number(payload.remains),
    startCount: payload?.start_count == null ? null : Number(payload.start_count),
    providerCharge: payload?.charge == null ? null : Number(payload.charge),
    providerCurrency: payload?.currency == null ? null : String(payload.currency),
  }
}

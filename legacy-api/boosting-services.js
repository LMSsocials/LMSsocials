const PROVIDER_URL = 'https://justanotherpanel.com/api/v2'
const LOW_PRICE_CUTOFF_NAIRA = 1000
const LOW_PRICE_START_NAIRA = 1100

function boostingSellingPrice(providerRateNaira, markup) {
  const standardPrice = providerRateNaira * markup
  if (standardPrice >= LOW_PRICE_CUTOFF_NAIRA) return standardPrice
  const additionalMarkupPercent = (LOW_PRICE_START_NAIRA / standardPrice) * 100 + 10
  return Math.ceil(standardPrice * (1 + additionalMarkupPercent / 100))
}

const platformFor = (value = '') => {
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

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' })
  if (!process.env.BOOSTING_API_KEY) return response.status(503).json({ message: 'Boosting integration is not configured' })

  try {
    const body = new URLSearchParams({ key: process.env.BOOSTING_API_KEY, action: 'services' })
    const providerResponse = await fetch(PROVIDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const payload = await providerResponse.json()
    if (!providerResponse.ok || !Array.isArray(payload)) {
      throw new Error(payload?.error || 'Provider request failed')
    }

    const exchangeRate = 1341.395
    const markup = 2
    const services = payload.map((item) => {
      const category = String(item.category || 'Other')
      const name = String(item.name || 'Social media service')
      return {
        id: String(item.service),
        platform: platformFor(category + ' ' + name),
        category,
        name,
        type: String(item.type || 'Default'),
        min: Number(item.min) || 0,
        max: Number(item.max) || 0,
        pricePerThousand: boostingSellingPrice(Number(item.rate || 0) * exchangeRate, markup),
      }
    })

    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json({ services })
  } catch (error) {
    console.error('[boosting/services] request failed', { message: error.message })
    return response.status(502).json({ message: 'Live boosting services are temporarily unavailable' })
  }
}

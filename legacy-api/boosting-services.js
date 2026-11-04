import { getBoostingServices } from '../lib/boosting-provider'
import { getDatabase } from '../lib/mongodb.js'
import { getSupplierPricing, supplierPricingVersion } from '../lib/supplier-pricing.js'

const CACHE_TTL = 2 * 60 * 1000

async function cachedBoostingServices(pricing) {
  const cache = globalThis.__lmsBoostingServicesCache || (globalThis.__lmsBoostingServicesCache = {})
  const version = supplierPricingVersion(pricing)
  if (cache.services?.length && cache.pricingVersion === version && Date.now() - cache.updatedAt < CACHE_TTL) return cache.services
  if (cache.refresh && cache.pricingVersion === version) return cache.refresh

  cache.pricingVersion = version
  cache.refresh = getBoostingServices(pricing).then((services) => {
    cache.services = services
    cache.updatedAt = Date.now()
    return services
  }).catch((error) => {
    if (cache.services?.length) return cache.services
    throw error
  }).finally(() => { cache.refresh = null })
  return cache.refresh
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' })
  if (!process.env.BOOSTING_API_KEY) return response.status(503).json({ message: 'Boosting integration is not configured' })

  try {
    const pricing = await getSupplierPricing(await getDatabase())
    const services = await cachedBoostingServices(pricing)

    response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return response.status(200).json({ services })
  } catch (error) {
    console.error('[boosting/services] request failed', { message: error.message })
    return response.status(502).json({ message: 'Live boosting services are temporarily unavailable' })
  }
}

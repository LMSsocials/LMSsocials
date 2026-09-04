import { getBoostingServices } from '../lib/boosting-provider'

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' })
  if (!process.env.BOOSTING_API_KEY) return response.status(503).json({ message: 'Boosting integration is not configured' })

  try {
    const services = await getBoostingServices()

    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json({ services })
  } catch (error) {
    console.error('[boosting/services] request failed', { message: error.message })
    return response.status(502).json({ message: 'Live boosting services are temporarily unavailable' })
  }
}

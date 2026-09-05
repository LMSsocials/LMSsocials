import { cookies } from 'next/headers'
import { ObjectId } from 'mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { getDatabase } from '../../../lib/mongodb'
import { createNumberQuote } from '../../../lib/number-provider.js'

export const runtime = 'nodejs'
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET(request) {
  const store = await cookies()
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!session?.sub || !ObjectId.isValid(session.sub)) return json({ message: 'Authentication required' }, 401)
  const params = new URL(request.url).searchParams
  const countryId = params.get('countryId') || ''
  const serviceCode = params.get('serviceCode') || ''
  const serverId = params.get('serverId') || ''
  if (!/^\d{1,5}$/.test(countryId) || !/^[a-zA-Z0-9_-]{1,30}$/.test(serviceCode) || !['1', '2', '3'].includes(serverId)) return json({ message: 'Invalid number selection' }, 400)
  const database = await getDatabase()
  const user = await database.collection('users').findOne({ _id: new ObjectId(session.sub) }, { projection: { isBanned: 1 } })
  if (!user || user.isBanned) return json({ message: 'Account unavailable' }, 403)
  try {
    return json({ quote: await createNumberQuote({ userId: session.sub, countryId, serviceCode, serverId }) })
  } catch (error) {
    return json({ message: error.code === 'NO_GOLD_NUMBERS' ? 'No Gold suppliers are available for this selection. Try another country or Recommended.'
      : error.code === 'NO_NUMBERS' ? 'This selection is sold out. Please choose another country or service.' : 'We could not verify a price right now. Please try again.' }, 503)
  }
}

import { cookies } from 'next/headers'
import { isAdminEmail, SESSION_COOKIE, verifySessionToken } from './auth'

export async function getAdminSession() {
  const store = await cookies()
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  return payload?.sub && isAdminEmail(payload.email) ? payload : null
}

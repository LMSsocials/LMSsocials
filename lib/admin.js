import { cookies } from 'next/headers'
import { ObjectId } from 'mongodb'
import { isAdminUser, SESSION_COOKIE, verifySessionToken } from './auth'
import { getDatabase } from './mongodb'

export async function getAdminSession() {
  const store = await cookies()
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!payload?.sub || !ObjectId.isValid(payload.sub)) return null

  const database = await getDatabase()
  const user = await database.collection('users').findOne({ _id: new ObjectId(payload.sub) })
  if (!user || user.isBanned || !isAdminUser(user)) return null
  return { ...payload, email: user.email, isAdmin: true }
}

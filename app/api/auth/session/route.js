import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase } from '../../../../lib/mongodb'
import { publicUser, SESSION_COOKIE, verifySessionToken } from '../../../../lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const payload = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)
  if (!payload?.sub || !ObjectId.isValid(payload.sub)) return NextResponse.json({ session: null })
  const database = await getDatabase()
  const user = await database.collection('users').findOne({ _id: new ObjectId(payload.sub) })
  return NextResponse.json({ session: user ? { user: publicUser(user) } : null })
}
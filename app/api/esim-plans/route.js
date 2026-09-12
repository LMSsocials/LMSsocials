import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { getEsimPlans } from '../../../lib/esim'
import { getDatabase } from '../../../lib/mongodb'

export const runtime = 'nodejs'

export async function GET() {
  const store = await cookies()
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!session?.sub || !ObjectId.isValid(session.sub)) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  return NextResponse.json({ plans: await getEsimPlans(await getDatabase()) })
}

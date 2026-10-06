import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { getDatabase } from '../../../lib/mongodb'
import { serializeTool } from '../../../lib/tools'

export const runtime = 'nodejs'

export async function GET() {
  const store = await cookies()
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!session?.sub) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })

  const tools = await (await getDatabase()).collection('tools').find({}).sort({ createdAt: -1 }).toArray()
  return NextResponse.json({ tools: tools.map(serializeTool) })
}

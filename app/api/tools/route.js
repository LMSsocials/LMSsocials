import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/auth'
import { getDatabase } from '../../../lib/mongodb'
import { serializeTool } from '../../../lib/tools'

export const runtime = 'nodejs'

export async function GET() {
  const store = await cookies()
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!session?.sub || !ObjectId.isValid(session.sub)) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })

  const database = await getDatabase()
  const userId = new ObjectId(session.sub)
  const [tools, orders] = await Promise.all([
    database.collection('tools').find({}).sort({ createdAt: -1 }).toArray(),
    database.collection('toolOrders').find({ userId, status: 'delivered' }, { projection: { toolId: 1, createdAt: 1 } }).toArray(),
  ])
  const purchased = new Map(orders.map((order) => [String(order.toolId), order.createdAt]))
  return NextResponse.json({ tools: tools.map((tool) => {
    const purchasedAt = purchased.get(String(tool._id))
    return { ...serializeTool(tool, { includeUrl: Boolean(purchasedAt) }), purchased: Boolean(purchasedAt), ...(purchasedAt ? { purchasedAt } : {}) }
  }) })
}

import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase } from '../../../../lib/mongodb'
import { normalizeToolUrl, serializeTool, toolPriceKobo } from '../../../../lib/tools'

export const runtime = 'nodejs'

function readTool(body) {
  const name = String(body.name || '').trim()
  const url = normalizeToolUrl(body.url)
  const priceKobo = toolPriceKobo(body.price)
  if (!name || name.length > 120) return { error: 'Tool name is required and must be 120 characters or fewer' }
  if (!url) return { error: 'Enter a valid website link' }
  if (priceKobo === null) return { error: 'Price must be zero or more' }
  return { name, url, priceKobo }
}

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const tools = await (await getDatabase()).collection('tools').find({}).sort({ createdAt: -1 }).toArray()
  return NextResponse.json({ tools: tools.map(serializeTool) })
}

export async function POST(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const values = readTool(await request.json().catch(() => ({})))
  if (values.error) return NextResponse.json({ message: values.error }, { status: 400 })

  const now = new Date()
  const tool = { ...values, createdAt: now, updatedAt: now, updatedBy: admin.email }
  const result = await (await getDatabase()).collection('tools').insertOne(tool)
  return NextResponse.json({ tool: serializeTool({ ...tool, _id: result.insertedId }) }, { status: 201 })
}

export async function PATCH(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!ObjectId.isValid(body.toolId)) return NextResponse.json({ message: 'Invalid tool' }, { status: 400 })
  const values = readTool(body)
  if (values.error) return NextResponse.json({ message: values.error }, { status: 400 })

  const database = await getDatabase()
  const result = await database.collection('tools').findOneAndUpdate(
    { _id: new ObjectId(body.toolId) },
    { $set: { ...values, updatedAt: new Date(), updatedBy: admin.email } },
    { returnDocument: 'after' },
  )
  if (!result) return NextResponse.json({ message: 'Tool not found' }, { status: 404 })
  return NextResponse.json({ tool: serializeTool(result) })
}

export async function DELETE(request) {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!ObjectId.isValid(body.toolId)) return NextResponse.json({ message: 'Invalid tool' }, { status: 400 })
  const result = await (await getDatabase()).collection('tools').deleteOne({ _id: new ObjectId(body.toolId) })
  if (!result.deletedCount) return NextResponse.json({ message: 'Tool not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}

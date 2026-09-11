import { NextResponse } from 'next/server'
import { FORMAT_CONTENT_TYPES } from '../../../lib/format-files'
import { getDatabase } from '../../../lib/mongodb'

export const runtime = 'nodejs'

export async function GET() {
  const database = await getDatabase()
  const files = await database.collection('adminAssets')
    .find({ category: 'formats', status: 'live', contentType: { $in: FORMAT_CONTENT_TYPES } }, { projection: { title: 1, description: 1, priceKobo: 1, fileName: 1, fileSize: 1, contentType: 1, createdAt: 1 } })
    .sort({ createdAt: -1 }).limit(100).toArray()
  return NextResponse.json({ files: files.map((file) => ({ ...file, _id: String(file._id) })) })
}

import { get } from '@vercel/blob'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { GridFSBucket, ObjectId } from 'mongodb'
import { Readable } from 'node:stream'
import { getDatabase } from '../../../../lib/mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../../lib/auth'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ message: 'Invalid download' }, { status: 400 })
  const store = await cookies()
  const payload = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!payload?.sub || !ObjectId.isValid(payload.sub)) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })

  const database = await getDatabase()
  const order = await database.collection('formatOrders').findOne({ _id: new ObjectId(id), userId: new ObjectId(payload.sub), status: 'delivered' })
  if (!order) return NextResponse.json({ message: 'Purchase required' }, { status: 403 })
  const asset = await database.collection('adminAssets').findOne({ _id: order.assetId, category: 'formats', contentType: 'application/pdf' })
  if (!asset) return NextResponse.json({ message: 'PDF not found' }, { status: 404 })

  const fileName = String(asset.fileName || 'download.pdf').replace(/["\r\n]/g, '')
  const headers = { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}"`, 'Cache-Control': 'private, no-store' }
  if (asset.storage === 'vercel-blob' && asset.blobUrl) {
    const result = await get(asset.blobUrl, { access: 'private' })
    if (result.statusCode !== 200 || !result.stream) return NextResponse.json({ message: 'PDF not found' }, { status: 404 })
    return new Response(result.stream, { headers })
  }
  if (asset.fileId) {
    const stream = new GridFSBucket(database, { bucketName: 'adminUploads' }).openDownloadStream(asset.fileId)
    return new Response(Readable.toWeb(stream), { headers })
  }
  return NextResponse.json({ message: 'PDF not found' }, { status: 404 })
}

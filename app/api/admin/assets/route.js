import { head } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase } from '../../../../lib/mongodb'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 100 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['pdf'])
const BLOCKED_TERMS = ['nibo', 'ajo', 'iyawo']
const extensionOf = (name) => String(name).toLowerCase().split('.').pop()

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const database = await getDatabase()
  const assets = await database.collection('adminAssets').find({}).sort({ createdAt: -1 }).limit(100).toArray()
  return NextResponse.json({ assets: assets.map((asset) => ({ ...asset, _id: String(asset._id), fileId: asset.fileId ? String(asset.fileId) : undefined })) })
}

export async function POST(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const title = String(body?.title || '').trim()
  const description = String(body?.description || '').trim()
  const category = String(body?.category || '')
  const price = Number(body?.price)
  const blobUrl = String(body?.blobUrl || '')

  if (!blobUrl || !title || !['logs', 'formats'].includes(category)) {
    return NextResponse.json({ message: 'Complete every required field' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 8000) return NextResponse.json({ message: 'Starting price is \u20A68,000' }, { status: 400 })

  let blob
  try {
    blob = await head(blobUrl)
  } catch {
    return NextResponse.json({ message: 'Uploaded file could not be verified' }, { status: 400 })
  }
  if (!blob.pathname.startsWith('formats/') || !ALLOWED_EXTENSIONS.has(extensionOf(blob.pathname))) {
    return NextResponse.json({ message: 'Unsupported file type' }, { status: 415 })
  }
  if (blob.size <= 0 || blob.size > MAX_FILE_SIZE) return NextResponse.json({ message: 'Files must be 100 MB or smaller' }, { status: 413 })
  const fileName = String(body?.fileName || blob.pathname.split('/').pop())
  const searchableName = (fileName + ' ' + title).toLowerCase()
  if (BLOCKED_TERMS.some((term) => searchableName.includes(term))) {
    return NextResponse.json({ message: 'This file requires compliance review and cannot be uploaded' }, { status: 422 })
  }

  const database = await getDatabase()
  const document = {
    title, description, category, priceKobo: Math.round(price * 100),
    storage: 'vercel-blob', blobUrl: blob.url, downloadUrl: blob.downloadUrl, pathname: blob.pathname,
    fileName, fileSize: blob.size, contentType: blob.contentType,
    status: 'live', uploadedBy: admin.email, createdAt: new Date(), updatedAt: new Date(),
  }
  const result = await database.collection('adminAssets').insertOne(document)
  return NextResponse.json({ asset: { ...document, _id: String(result.insertedId) } }, { status: 201 })
}

import { Readable } from 'node:stream'
import { GridFSBucket } from 'mongodb'
import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase } from '../../../../lib/mongodb'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'doc', 'docx', 'csv', 'xls', 'xlsx'])
const BLOCKED_TERMS = ['nibo', 'ajo', 'iyawo']
const extensionOf = (name) => String(name).toLowerCase().split('.').pop()

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const database = await getDatabase()
  const assets = await database.collection('adminAssets').find({}).sort({ createdAt: -1 }).limit(100).toArray()
  return NextResponse.json({ assets: assets.map((asset) => ({ ...asset, _id: String(asset._id), fileId: String(asset.fileId) })) })
}

export async function POST(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const form = await request.formData()
  const file = form.get('file')
  const title = String(form.get('title') || '').trim()
  const description = String(form.get('description') || '').trim()
  const category = String(form.get('category') || '')
  const price = Number(form.get('price'))

  if (!(file instanceof File) || !title || !['logs', 'formats'].includes(category)) {
    return NextResponse.json({ message: 'Complete every required field' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 8000) return NextResponse.json({ message: 'Starting price is ₦8,000' }, { status: 400 })
  if (!ALLOWED_EXTENSIONS.has(extensionOf(file.name))) return NextResponse.json({ message: 'Unsupported file type' }, { status: 415 })
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ message: 'Files must be 5 MB or smaller' }, { status: 413 })
  const searchableName = (file.name + ' ' + title).toLowerCase()
  if (BLOCKED_TERMS.some((term) => searchableName.includes(term))) {
    return NextResponse.json({ message: 'This file requires compliance review and cannot be uploaded' }, { status: 422 })
  }

  const database = await getDatabase()
  const bucket = new GridFSBucket(database, { bucketName: 'adminUploads' })
  const buffer = Buffer.from(await file.arrayBuffer())
  const upload = bucket.openUploadStream(file.name, {
    contentType: file.type || 'application/octet-stream',
    metadata: { category, uploadedBy: admin.email, visibility: 'private' },
  })
  await new Promise((resolve, reject) => Readable.from(buffer).pipe(upload).on('finish', resolve).on('error', reject))

  const document = {
    title, description, category, priceKobo: Math.round(price * 100),
    fileId: upload.id, fileName: file.name, fileSize: file.size,
    contentType: file.type || 'application/octet-stream',
    status: 'draft', uploadedBy: admin.email, createdAt: new Date(), updatedAt: new Date(),
  }
  const result = await database.collection('adminAssets').insertOne(document)
  return NextResponse.json({ asset: { ...document, _id: String(result.insertedId), fileId: String(upload.id) } }, { status: 201 })
}

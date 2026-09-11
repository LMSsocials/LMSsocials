import { head } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAdminSession } from '../../../../lib/admin'
import { MAX_FORMAT_FILE_SIZE, MIN_FORMAT_PRICE_NAIRA, formatFileDetails, formatPriceKobo } from '../../../../lib/format-files'
import { getDatabase } from '../../../../lib/mongodb'

export const runtime = 'nodejs'

const BLOCKED_TERMS = ['nibo', 'ajo', 'iyawo']

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
  const priceKobo = formatPriceKobo(body?.price)
  const blobUrl = String(body?.blobUrl || '')

  if (!blobUrl || !title || !['logs', 'formats'].includes(category)) {
    return NextResponse.json({ message: 'Complete every required field' }, { status: 400 })
  }
  if (priceKobo === null) return NextResponse.json({ message: `Starting price is ₦${MIN_FORMAT_PRICE_NAIRA.toLocaleString('en-NG')}` }, { status: 400 })

  let blob
  try {
    blob = await head(blobUrl)
  } catch {
    return NextResponse.json({ message: 'Uploaded file could not be verified' }, { status: 400 })
  }
  const fileDetails = formatFileDetails(blob.pathname, blob.contentType)
  if (!blob.pathname.startsWith('formats/') || !fileDetails) {
    return NextResponse.json({ message: 'Unsupported file type' }, { status: 415 })
  }
  if (blob.size <= 0 || blob.size > MAX_FORMAT_FILE_SIZE) return NextResponse.json({ message: 'Files must be 100 MB or smaller' }, { status: 413 })
  const fileName = String(body?.fileName || blob.pathname.split('/').pop())
  const searchableName = (fileName + ' ' + title).toLowerCase()
  if (BLOCKED_TERMS.some((term) => searchableName.includes(term))) {
    return NextResponse.json({ message: 'This file requires compliance review and cannot be uploaded' }, { status: 422 })
  }

  const database = await getDatabase()
  const document = {
    title, description, category, priceKobo,
    storage: 'vercel-blob', blobUrl: blob.url, downloadUrl: blob.downloadUrl, pathname: blob.pathname,
    fileName, fileSize: blob.size, contentType: fileDetails.contentType,
    status: 'live', uploadedBy: admin.email, createdAt: new Date(), updatedAt: new Date(),
  }
  const result = await database.collection('adminAssets').insertOne(document)
  return NextResponse.json({ asset: { ...document, _id: String(result.insertedId) } }, { status: 201 })
}

export async function PATCH(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const assetId = String(body?.assetId || '')
  const priceKobo = formatPriceKobo(body?.price)
  if (!ObjectId.isValid(assetId)) return NextResponse.json({ message: 'Invalid format' }, { status: 400 })
  if (priceKobo === null) return NextResponse.json({ message: `Price must be at least ₦${MIN_FORMAT_PRICE_NAIRA.toLocaleString('en-NG')}` }, { status: 400 })

  const database = await getDatabase()
  const updatedAt = new Date()
  const asset = await database.collection('adminAssets').findOneAndUpdate(
    { _id: new ObjectId(assetId), category: 'formats' },
    { $set: { priceKobo, updatedAt, updatedBy: admin.email } },
    { returnDocument: 'after', projection: { title: 1, priceKobo: 1, updatedAt: 1 } },
  )
  if (!asset) return NextResponse.json({ message: 'Format not found' }, { status: 404 })
  return NextResponse.json({ asset: { ...asset, _id: String(asset._id) } })
}

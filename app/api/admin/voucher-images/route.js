import { Readable } from 'node:stream'
import { GridFSBucket } from 'mongodb'
import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase } from '../../../../lib/mongodb'

export const runtime = 'nodejs'

const MAX_IMAGE_SIZE = 3 * 1024 * 1024
const IMAGE_TYPES = new Map([
  ['image/jpeg', ['jpg', 'jpeg']],
  ['image/png', ['png']],
  ['image/webp', ['webp']],
  ['image/gif', ['gif']],
])

function hasValidSignature(type, buffer) {
  if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (type === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (type === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  if (type === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  return false
}

export async function POST(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const form = await request.formData()
  const file = form.get('image')
  if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ message: 'Choose a product image' }, { status: 400 })
  if (file.size > MAX_IMAGE_SIZE) return NextResponse.json({ message: 'Product images must be 3 MB or smaller' }, { status: 413 })

  const type = String(file.type || '').toLowerCase()
  const extension = String(file.name || '').toLowerCase().split('.').pop()
  if (!IMAGE_TYPES.has(type) || !IMAGE_TYPES.get(type).includes(extension)) {
    return NextResponse.json({ message: 'Use a JPG, PNG, WebP, or GIF image' }, { status: 415 })
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  if (!hasValidSignature(type, buffer)) return NextResponse.json({ message: 'The selected file is not a valid image' }, { status: 415 })

  const database = await getDatabase()
  const bucket = new GridFSBucket(database, { bucketName: 'voucherImages' })
  const upload = bucket.openUploadStream(file.name, {
    contentType: type,
    metadata: { uploadedBy: admin.email, purpose: 'product-image', contentType: type, createdAt: new Date() },
  })
  await new Promise((resolve, reject) => Readable.from(buffer).pipe(upload).on('finish', resolve).on('error', reject))
  return NextResponse.json({ imageId: String(upload.id), imageUrl: `/api/voucher-images/${upload.id}` }, { status: 201 })
}

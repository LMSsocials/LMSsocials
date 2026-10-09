import { ObjectId } from 'mongodb'
import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase } from '../../../../lib/mongodb'
import { normalizePicturePreview, normalizePictureUrl, picturePriceKobo, serializePicture } from '../../../../lib/pictures'

export const runtime = 'nodejs'

function readPicture(body) {
  const title = String(body.title || '').trim()
  const description = String(body.description || '').trim()
  const previewUrl = normalizePicturePreview(body.previewUrl)
  const downloadUrl = normalizePictureUrl(body.downloadUrl)
  const priceKobo = picturePriceKobo(body.price)
  if (!title || title.length > 120) return { error: 'Picture title is required and must be 120 characters or fewer' }
  if (description.length > 500) return { error: 'Description must be 500 characters or fewer' }
  if (!previewUrl) return { error: 'Upload a valid preview image' }
  if (!downloadUrl) return { error: 'Enter a valid download link' }
  if (priceKobo === null) return { error: 'Price must be zero or more' }
  return { title, description, previewUrl, downloadUrl, priceKobo }
}

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const pictures = await (await getDatabase()).collection('pictures').find({}).sort({ createdAt: -1 }).toArray()
  return NextResponse.json({ pictures: pictures.map(serializePicture) })
}

export async function POST(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const values = readPicture(await request.json().catch(() => ({})))
  if (values.error) return NextResponse.json({ message: values.error }, { status: 400 })

  const now = new Date()
  const picture = { ...values, createdAt: now, updatedAt: now, updatedBy: admin.email }
  const result = await (await getDatabase()).collection('pictures').insertOne(picture)
  return NextResponse.json({ picture: serializePicture({ ...picture, _id: result.insertedId }) }, { status: 201 })
}

export async function PATCH(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!ObjectId.isValid(body.pictureId)) return NextResponse.json({ message: 'Invalid picture' }, { status: 400 })
  const values = readPicture(body)
  if (values.error) return NextResponse.json({ message: values.error }, { status: 400 })

  const result = await (await getDatabase()).collection('pictures').findOneAndUpdate(
    { _id: new ObjectId(body.pictureId) },
    { $set: { ...values, updatedAt: new Date(), updatedBy: admin.email } },
    { returnDocument: 'after' },
  )
  if (!result) return NextResponse.json({ message: 'Picture not found' }, { status: 404 })
  return NextResponse.json({ picture: serializePicture(result) })
}

export async function DELETE(request) {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  if (!ObjectId.isValid(body.pictureId)) return NextResponse.json({ message: 'Invalid picture' }, { status: 400 })
  const result = await (await getDatabase()).collection('pictures').deleteOne({ _id: new ObjectId(body.pictureId) })
  if (!result.deletedCount) return NextResponse.json({ message: 'Picture not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}

import { Readable } from 'node:stream'
import { GridFSBucket, ObjectId } from 'mongodb'
import { getDatabase } from '../../../../lib/mongodb'

export const runtime = 'nodejs'

const PUBLIC_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function GET(_request, { params }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return new Response('Image not found', { status: 404 })
  const database = await getDatabase()
  const file = await database.collection('voucherImages.files').findOne({ _id: new ObjectId(id), 'metadata.purpose': 'product-image' })
  const contentType = file?.contentType || file?.metadata?.contentType
  if (!file || !PUBLIC_IMAGE_TYPES.has(contentType)) return new Response('Image not found', { status: 404 })

  const bucket = new GridFSBucket(database, { bucketName: 'voucherImages' })
  return new Response(Readable.toWeb(bucket.openDownloadStream(file._id)), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(file.length),
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

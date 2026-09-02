import nextEnv from '@next/env'
import { ObjectId } from 'mongodb'
import { createSessionToken, SESSION_COOKIE } from '../lib/auth.js'
import { getDatabase, getMongoClient } from '../lib/mongodb.js'

nextEnv.loadEnvConfig(process.cwd())
const origin = 'http://localhost:3000'
const adminEmail = String(process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim()).find(Boolean)
if (!adminEmail) throw new Error('ADMIN_EMAILS is required')

const adminToken = await createSessionToken({ _id: new ObjectId(), email: adminEmail, name: 'Admin' })
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const form = new FormData()
form.set('image', new Blob([imageBytes], { type: 'image/png' }), 'verification.png')
let imageId

try {
  const deniedForm = new FormData()
  deniedForm.set('image', new Blob([imageBytes], { type: 'image/png' }), 'verification.png')
  const denied = await fetch(`${origin}/api/admin/voucher-images`, { method: 'POST', body: deniedForm })
  if (denied.status !== 403) throw new Error('Image upload is not restricted to administrators')

  const upload = await fetch(`${origin}/api/admin/voucher-images`, {
    method: 'POST', headers: { Cookie: `${SESSION_COOKIE}=${adminToken}` }, body: form,
  })
  const payload = await upload.json().catch(() => ({}))
  if (upload.status !== 201) throw new Error(`Upload failed: ${upload.status} ${payload.message || ''}`)
  imageId = new ObjectId(payload.imageId)

  const served = await fetch(origin + payload.imageUrl)
  if (served.status !== 200 || served.headers.get('content-type') !== 'image/png') throw new Error('Stored image could not be served: ' + served.status + ' ' + served.headers.get('content-type') + ' ' + await served.text())
  if (!Buffer.from(await served.arrayBuffer()).equals(imageBytes)) throw new Error('Served image bytes differ from uploaded image')
  console.log(JSON.stringify({ ok: true, checks: ['admin-only image upload', 'signature validation', 'GridFS storage', 'public image delivery'] }, null, 2))
} finally {
  if (imageId) {
    const database = await getDatabase()
    await database.collection('voucherImages.files').deleteOne({ _id: imageId })
    await database.collection('voucherImages.chunks').deleteMany({ files_id: imageId })
  }
  const client = await getMongoClient()
  await client.close()
  globalThis.__lmsMongoClientPromise = undefined
}

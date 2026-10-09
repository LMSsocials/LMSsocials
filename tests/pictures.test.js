import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePicturePreview, normalizePictureUrl, picturePriceKobo, serializePicture } from '../lib/pictures.js'

test('picture links only allow http and https URLs', () => {
  assert.equal(normalizePictureUrl('example.com/file.jpg'), 'https://example.com/file.jpg')
  assert.equal(normalizePictureUrl('javascript:alert(1)'), '')
  assert.equal(normalizePictureUrl('ftp://example.com/file.jpg'), '')
})

test('picture pricing converts naira to kobo', () => {
  assert.equal(picturePriceKobo('2500'), 250000)
  assert.equal(picturePriceKobo('-1'), null)
})

test('uploaded preview paths are accepted without exposing arbitrary local paths', () => {
  assert.equal(normalizePicturePreview('/api/picture-previews/507f1f77bcf86cd799439011'), '/api/picture-previews/507f1f77bcf86cd799439011')
  assert.equal(normalizePicturePreview('/api/auth/session'), '')
})

test('public picture serialization keeps the paid link private', () => {
  const picture = { _id: { toString: () => 'picture-1' }, title: 'Portrait', previewUrl: 'https://example.com/preview.jpg', downloadUrl: 'https://example.com/original.jpg', priceKobo: 100000 }
  const result = serializePicture(picture, { includeDownloadUrl: false })
  assert.equal(result.previewUrl, picture.previewUrl)
  assert.equal('downloadUrl' in result, false)
})

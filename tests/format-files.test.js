import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDownloadDisposition, formatFileDetails, formatFileExtension, formatPriceKobo, isSupportedFormatFile } from '../lib/format-files.js'

test('PDF and plain-text format files are accepted', () => {
  assert.equal(isSupportedFormatFile('formats/example.pdf', 'application/pdf'), true)
  assert.equal(isSupportedFormatFile('formats/example.TXT', 'text/plain'), true)
  assert.equal(isSupportedFormatFile('formats/example.txt', 'text/plain; charset=utf-8'), true)
  assert.equal(formatFileDetails('example.txt', 'text/plain').label, 'TXT')
})

test('Mismatched and unsupported file types are rejected', () => {
  assert.equal(isSupportedFormatFile('example.txt', 'application/pdf'), false)
  assert.equal(isSupportedFormatFile('example.pdf', 'text/plain'), false)
  assert.equal(isSupportedFormatFile('example.exe', 'text/plain'), false)
  assert.equal(isSupportedFormatFile('example.txt.exe', 'text/plain'), false)
  assert.equal(formatFileExtension('file-without-extension'), '')
})

test('Format prices are stored in kobo and enforce the minimum', () => {
  assert.equal(formatPriceKobo(8000), 800000)
  assert.equal(formatPriceKobo('12500'), 1250000)
  assert.equal(formatPriceKobo(7999), null)
  assert.equal(formatPriceKobo('invalid'), null)
  assert.equal(formatPriceKobo(Number.MAX_SAFE_INTEGER), null)
})

test('Download headers support Unicode filenames without invalid header bytes', () => {
  const disposition = formatDownloadDisposition('🎓ID.ME BYPASS METHOD 💯.pdf')

  assert.equal(
    disposition,
    'attachment; filename="ID.ME BYPASS METHOD .pdf"; filename*=UTF-8\'\'%F0%9F%8E%93ID.ME%20BYPASS%20METHOD%20%F0%9F%92%AF.pdf',
  )
  assert.doesNotThrow(() => new Headers({ 'Content-Disposition': disposition }))
  assert.equal(formatDownloadDisposition('bad\r\nname".txt').includes('\r'), false)
})

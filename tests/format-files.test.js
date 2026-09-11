import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatFileDetails, formatFileExtension, formatPriceKobo, isSupportedFormatFile } from '../lib/format-files.js'

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

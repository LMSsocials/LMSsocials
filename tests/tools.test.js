import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeToolUrl, serializeTool, toolPriceKobo } from '../lib/tools.js'

const savedTool = {
  _id: { toString: () => 'tool-1' },
  name: 'Example tool',
  url: 'https://example.com/private',
  priceKobo: 250000,
  createdAt: new Date('2026-10-06T00:00:00Z'),
  updatedAt: new Date('2026-10-06T00:00:00Z'),
}

test('public tool serialization can omit the private purchase link', () => {
  const tool = serializeTool(savedTool, { includeUrl: false })
  assert.equal(tool.name, 'Example tool')
  assert.equal(tool.priceKobo, 250000)
  assert.equal('url' in tool, false)
})

test('purchased and admin tool serialization includes the link', () => {
  assert.equal(serializeTool(savedTool).url, 'https://example.com/private')
})

test('tool URLs and NGN prices are normalized before storage', () => {
  assert.equal(normalizeToolUrl('example.com/buy'), 'https://example.com/buy')
  assert.equal(normalizeToolUrl('javascript:alert(1)'), '')
  assert.equal(toolPriceKobo('2500'), 250000)
  assert.equal(toolPriceKobo('-1'), null)
})

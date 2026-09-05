import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeBoostingTarget, parseBoostingQuantity, validateBoostingInput } from '../lib/boosting-validation.js'

const request = { serviceId: '12345', requestId: '01234567-89ab-4def-8123-456789abcdef', target: 'https://www.instagram.com/example/', quantity: 1000 }
const service = { min: 50, max: 100000 }

test('Accepts a pasted social URL without the protocol and normalizes it', () => {
  assert.equal(normalizeBoostingTarget('www.instagram.com/example'), 'https://www.instagram.com/example')
  assert.equal(normalizeBoostingTarget('  instagram.com/example  '), 'https://instagram.com/example')
  assert.equal(normalizeBoostingTarget('//www.tiktok.com/@example'), 'https://www.tiktok.com/@example')
  assert.equal(normalizeBoostingTarget('https://youtu.be/abc?t=10'), 'https://youtu.be/abc?t=10')
  assert.equal(normalizeBoostingTarget('https://t.me/example/123'), 'https://t.me/example/123')
})

test('Rejects a username, unsafe URL, or malformed link instead of guessing a target', () => {
  for (const target of ['', '@example', 'example', 'https://', 'javascript:alert(1)', 'data:text/plain,test', 'ftp://example.com', 'https://user:pass@example.com', 'http://localhost', 'http://127.0.0.1', 'https://example.com/a b', 'https://example.com\\evil', 'https://example.com/\npost']) {
    assert.equal(normalizeBoostingTarget(target), null, target)
  }
})

test('Allows whole quantities and properly grouped thousands', () => {
  for (const quantity of [1000, '1000', '1,000', '1 000', '1\u00a0000', ' 1000 ']) assert.equal(parseBoostingQuantity(quantity), 1000)
  assert.equal(parseBoostingQuantity('10,000,000'), 10000000)
  assert.equal(parseBoostingQuantity(1), 1)
})

test('Rejects fractional, empty, shorthand, unsafe, and incorrectly grouped quantities', () => {
  for (const quantity of [null, true, [], {}, 0, -1, 1.5, NaN, Infinity, '', '1k', '1e3', '1.5', '1,5', '10,00', '1,000 000', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(parseBoostingQuantity(quantity), null, String(quantity))
  }
})

test('Browser and API share normalized inputs for the previously rejected case', () => {
  const result = validateBoostingInput({ ...request, target: 'instagram.com/example', quantity: '1,000' }, service)
  assert.equal(result.valid, true)
  assert.equal(result.value.target, 'https://instagram.com/example')
  assert.equal(result.value.quantity, 1000)
  assert.deepEqual(validateBoostingInput(result.value, service).value, result.value)
})

test('Errors identify the actual field, including an invalid request ID', () => {
  assert.deepEqual(Object.keys(validateBoostingInput({ ...request, quantity: 1.5 }, service).fieldErrors), ['quantity'])
  assert.deepEqual(Object.keys(validateBoostingInput({ ...request, target: '@example' }, service).fieldErrors), ['target'])
  assert.deepEqual(Object.keys(validateBoostingInput({ ...request, serviceId: '' }, service).fieldErrors), ['serviceId'])
  assert.deepEqual(Object.keys(validateBoostingInput({ ...request, requestId: '' }, service).fieldErrors), ['requestId'])
})

test('Service quantity limits apply on both ends, with exact boundaries accepted', () => {
  for (const quantity of [49, 100001]) assert.ok(validateBoostingInput({ ...request, quantity }, service).fieldErrors.quantity)
  for (const quantity of [50, 100000]) assert.equal(validateBoostingInput({ ...request, quantity }, service).valid, true)
})

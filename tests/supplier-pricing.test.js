import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeSupplierPricing } from '../lib/supplier-pricing.js'

test('Missing supplier pricing falls back when MongoDB returns null', () => {
  assert.deepEqual(normalizeSupplierPricing(null, { bulkaccMarkupPercent: 30, sujanMarkupPercent: 30 }), {
    bulkaccMarkupPercent: 30,
    sujanMarkupPercent: 30,
  })
})

test('Partial supplier pricing preserves valid values and fills missing values', () => {
  assert.deepEqual(normalizeSupplierPricing({ bulkaccMarkupPercent: 45 }, { bulkaccMarkupPercent: 30, sujanMarkupPercent: 30 }), {
    bulkaccMarkupPercent: 45,
    sujanMarkupPercent: 30,
  })
})

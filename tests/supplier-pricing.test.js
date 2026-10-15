import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeSupplierPricing, supplierProductPriceKobo, supplierPricingVersion } from '../lib/supplier-pricing.js'

test('Missing supplier pricing falls back when MongoDB returns null', () => {
  assert.deepEqual(normalizeSupplierPricing(null, { bulkaccMarkupPercent: 30, sujanMarkupPercent: 30 }), {
    bulkaccMarkupPercent: 30,
    sujanMarkupPercent: 30,
    pricesKobo: {},
  })
})

test('Partial supplier pricing preserves valid values and fills missing values', () => {
  assert.deepEqual(normalizeSupplierPricing({ bulkaccMarkupPercent: 45 }, { bulkaccMarkupPercent: 30, sujanMarkupPercent: 30 }), {
    bulkaccMarkupPercent: 45,
    sujanMarkupPercent: 30,
    pricesKobo: {},
  })
})

test('Exact supplier prices override calculated prices by service reference', () => {
  const pricing = normalizeSupplierPricing({
    pricesKobo: { 'bulkacc:200303': 975000, 'sujan:42': 1250000, invalid: 500000, 'sujan:bad': 12 },
  }, { bulkaccMarkupPercent: 30, sujanMarkupPercent: 30 })
  assert.deepEqual(pricing.pricesKobo, { 'bulkacc:200303': 975000, 'sujan:42': 1250000 })
  assert.equal(supplierProductPriceKobo(pricing, 'bulkacc:200303', 600000), 975000)
  assert.equal(supplierProductPriceKobo(pricing, 'bulkacc:other', 600000), 600000)
})

test('Pricing cache version changes when an exact service price changes', () => {
  const first = { bulkaccMarkupPercent: 30, sujanMarkupPercent: 30, pricesKobo: { 'sujan:42': 100000 } }
  const second = { ...first, pricesKobo: { 'sujan:42': 200000 } }
  assert.notEqual(supplierPricingVersion(first), supplierPricingVersion(second))
})

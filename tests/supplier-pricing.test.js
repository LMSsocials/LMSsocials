import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boostingProductPriceKobo, normalizeSupplierPricing, supplierProductPriceKobo, supplierPricingVersion } from '../lib/supplier-pricing.js'

test('Missing supplier pricing falls back when MongoDB returns null', () => {
  assert.deepEqual(normalizeSupplierPricing(null, { bulkaccMarkupPercent: 30, sujanMarkupPercent: 30 }), {
    bulkaccMarkupPercent: 30,
    sujanMarkupPercent: 30,
    boostingAdjustmentPercent: 0,
    pricesKobo: {},
  })
})

test('Partial supplier pricing preserves valid values and fills missing values', () => {
  assert.deepEqual(normalizeSupplierPricing({ bulkaccMarkupPercent: 45 }, { bulkaccMarkupPercent: 30, sujanMarkupPercent: 30 }), {
    bulkaccMarkupPercent: 45,
    sujanMarkupPercent: 30,
    boostingAdjustmentPercent: 0,
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

test('Boosting percentage increases and decreases calculated prices while exact prices stay fixed', () => {
  assert.equal(boostingProductPriceKobo({ boostingAdjustmentPercent: 25 }, 'boosting:123', 200000), 250000)
  assert.equal(boostingProductPriceKobo({ boostingAdjustmentPercent: -20 }, 'boosting:123', 200000), 160000)
  assert.equal(boostingProductPriceKobo({ boostingAdjustmentPercent: 25, pricesKobo: { 'boosting:123': 300000 } }, 'boosting:123', 200000), 300000)
})

test('Invalid boosting percentages fall back to zero', () => {
  const pricing = normalizeSupplierPricing({ boostingAdjustmentPercent: -100 })
  assert.equal(pricing.boostingAdjustmentPercent, 0)
  assert.equal(boostingProductPriceKobo(pricing, 'boosting:123', 200000), 200000)
})

test('Exact overrides support boosting services and each number tier', () => {
  const pricing = normalizeSupplierPricing({ pricesKobo: {
    'boosting:1234': 225000,
    'number:187:wa:1': 350000,
    'number:187:wa:3': 1500000,
  } })
  assert.equal(supplierProductPriceKobo(pricing, 'boosting:1234', 100000), 225000)
  assert.equal(supplierProductPriceKobo(pricing, 'number:187:wa:1', 100000), 350000)
  assert.equal(supplierProductPriceKobo(pricing, 'number:187:wa:2', 1000000), 1000000)
})

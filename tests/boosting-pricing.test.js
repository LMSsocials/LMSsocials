import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boostingOrderPriceKobo } from '../lib/boosting-pricing.js'

test('Boosting checkout uses the exact admin price per thousand', () => {
  assert.equal(boostingOrderPriceKobo(0.5, 2500, 2250), 562500)
})

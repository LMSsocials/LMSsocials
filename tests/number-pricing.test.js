import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SignJWT } from 'jose'
import { numberSellingPriceKobo, NUMBER_USD_TO_NGN_RATE, NUMBER_SERVER_MARKUP_PERCENT } from '../lib/number-pricing.js'
import { verifyNumberQuote } from '../lib/number-provider.js'

test('Default Budget, Silver, and Gold prices use normal supplier-cost markups', () => {
  assert.deepEqual(NUMBER_SERVER_MARKUP_PERCENT, { '1': 30, '2': 45, '3': 60 })
  for (const [serverId, markup] of Object.entries(NUMBER_SERVER_MARKUP_PERCENT)) {
    for (const usd of [0.01, 0.1, 1, 10, 100]) {
      assert.equal(numberSellingPriceKobo(usd, serverId), Math.ceil(usd * NUMBER_USD_TO_NGN_RATE * (1 + markup / 100) * 100))
    }
  }
})

test('Admin percentages independently change every number tier', () => {
  const pricing = { numberMarkupPercent: { '1': 10, '2': 25, '3': 80 } }
  const supplierPriceUsd = 2
  assert.equal(numberSellingPriceKobo(supplierPriceUsd, '1', {}, pricing), 308000)
  assert.equal(numberSellingPriceKobo(supplierPriceUsd, '2', {}, pricing), 350000)
  assert.equal(numberSellingPriceKobo(supplierPriceUsd, '3', {}, pricing), 504000)
})

test('Exact number prices override percentage pricing for a selected service and tier', () => {
  const pricing = {
    numberMarkupPercent: { '1': 30, '2': 45, '3': 60 },
    pricesKobo: { 'number:175:wa:1': 1200000, 'number:175:wa:2': 1000000, 'number:175:wa:3': 1500000 },
  }
  assert.equal(numberSellingPriceKobo(1, '1', { countryId: '175', serviceCode: 'wa' }, pricing), 1200000)
  assert.equal(numberSellingPriceKobo(1, '2', { countryId: '175', serviceCode: 'wa' }, pricing), 1000000)
  assert.equal(numberSellingPriceKobo(1, '3', { countryId: '175', serviceCode: 'wa' }, pricing), 1500000)
  assert.equal(numberSellingPriceKobo(1, '1', { countryId: '36', serviceCode: 'wa' }, pricing), 182000)
})

test('Invalid supplier prices and tiers are rejected', () => {
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => numberSellingPriceKobo(value, '1'))
  assert.throws(() => numberSellingPriceKobo(1, '4'))
})

test('Checkout rejects a quote signed before an admin percentage change', async () => {
  process.env.AUTH_JWT_SECRET ||= 'number-pricing-test-secret-32-characters-long'
  const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET)
  const payload = { userId: 'test-user', serverId: '2', providerPriceUsd: 2, sellingPriceKobo: 406000 }
  const token = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuer('lms-number-quote').setAudience('lms-number-checkout')
    .setIssuedAt().setExpirationTime('2m').sign(secret)
  await assert.rejects(() => verifyNumberQuote(token, 'test-user', { numberMarkupPercent: { '1': 30, '2': 25, '3': 60 } }), /pricing has changed/)
  const valid = await verifyNumberQuote(token, 'test-user', { numberMarkupPercent: { '1': 30, '2': 45, '3': 60 } })
  assert.equal(valid.sellingPriceKobo, 406000)
})

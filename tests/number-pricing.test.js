import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SignJWT } from 'jose'
import { adjustLowNumberPriceKobo, numberSellingPriceKobo, NUMBER_USD_TO_NGN_RATE, NUMBER_SERVER_MARKUP_PERCENT } from '../lib/number-pricing.js'
import { verifyNumberQuote } from '../lib/number-provider.js'

test('Low number prices receive varying uplifts instead of a fixed selling price', () => {
  assert.equal(adjustLowNumberPriceKobo(7499), 118300)
  assert.equal(adjustLowNumberPriceKobo(25000), 137500)
  assert.equal(adjustLowNumberPriceKobo(50000), 165000)
})

test('Threshold applies only below NGN 1,000 and rejects invalid prices', () => {
  assert.ok(adjustLowNumberPriceKobo(1) >= 100000)
  assert.ok(adjustLowNumberPriceKobo(99999) >= 100000)
  assert.equal(adjustLowNumberPriceKobo(100000), 100000)
  assert.equal(adjustLowNumberPriceKobo(100001), 100001)
  assert.equal(adjustLowNumberPriceKobo(250000), 250000)
  for (const value of [0, -1, NaN, Infinity, 1.5]) assert.throws(() => adjustLowNumberPriceKobo(value))
})

test('All number tiers obey the minimum, preserving higher supplier-derived prices', () => {
  for (const [serverId, markup] of Object.entries(NUMBER_SERVER_MARKUP_PERCENT)) {
    for (const usd of [0.00001, 0.01, 0.031, 0.043, 0.1, 0.4, 0.7, 1, 10, 100]) {
      const original = Math.ceil(usd * NUMBER_USD_TO_NGN_RATE * (1 + markup / 100) * 100)
      const updated = numberSellingPriceKobo(usd, serverId)
      assert.ok(updated >= 100000)
      if (original >= 100000) assert.equal(updated, original)
    }
  }
  assert.equal(numberSellingPriceKobo(0.043, '1'), 118300)
})

test('Checkout rejects an old signed low-price quote and accepts the refreshed price', async () => {
  process.env.AUTH_JWT_SECRET ||= 'number-pricing-test-secret-32-characters-long'
  const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET)
  const sign = (price) => new SignJWT({ userId: 'test-user', serverId: '1', providerPriceUsd: 0.043, sellingPriceKobo: price })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('lms-number-quote').setAudience('lms-number-checkout')
    .setIssuedAt().setExpirationTime('2m').sign(secret)
  await assert.rejects(() => sign(7499).then((token) => verifyNumberQuote(token, 'test-user')), /pricing has changed/)
  const valid = await verifyNumberQuote(await sign(118300), 'test-user')
  assert.equal(valid.sellingPriceKobo, 118300)
})

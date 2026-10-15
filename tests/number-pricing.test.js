import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SignJWT } from 'jose'
import { adjustLowNumberPriceKobo, applyNumberPriceFloorsKobo, FIXED_NUMBER_OFFER, numberSellingPriceKobo, NUMBER_USD_TO_NGN_RATE, NUMBER_SERVER_MARKUP_PERCENT } from '../lib/number-pricing.js'
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

test('All number tiers obey their minimum, preserving higher supplier-derived prices', () => {
  for (const [serverId, markup] of Object.entries(NUMBER_SERVER_MARKUP_PERCENT)) {
    for (const usd of [0.00001, 0.01, 0.031, 0.043, 0.1, 0.4, 0.7, 1, 10, 100]) {
      const original = Math.ceil(usd * NUMBER_USD_TO_NGN_RATE * (1 + markup / 100) * 100)
      const updated = numberSellingPriceKobo(usd, serverId)
      assert.ok(updated >= 100000)
      const serverFloor = serverId === '2' ? 1000000 : serverId === '3' ? 1500000 : 0
      if (original >= 100000) assert.equal(updated, Math.max(original, serverFloor))
    }
  }
  assert.equal(numberSellingPriceKobo(0.043, '1'), 118300)
})

test('Server 1 pins WhatsApp USA provider 3193 to NGN 3,500', () => {
  assert.equal(numberSellingPriceKobo(1.735, '1', FIXED_NUMBER_OFFER), 350000)
  assert.notEqual(numberSellingPriceKobo(1.735, '1', { ...FIXED_NUMBER_OFFER, providerId: '3194' }), 350000)
  assert.notEqual(numberSellingPriceKobo(1.735, '2', FIXED_NUMBER_OFFER), 350000)
})

test('UK WhatsApp standard numbers cost at least NGN 6,500', () => {
  const offer = { countryId: '16', serviceCode: 'wa' }
  assert.equal(numberSellingPriceKobo(1, '1', offer), 650000)
  assert.equal(numberSellingPriceKobo(10, '1', offer), 1743814)
})

test('eSIM-labelled supplier options start around NGN 10,000', () => {
  assert.equal(numberSellingPriceKobo(1, '2'), 1000000)
  assert.equal(numberSellingPriceKobo(1, '3'), 1500000)
  assert.equal(numberSellingPriceKobo(1, '2', { countryId: '43', serviceCode: 'wa' }), 1500000)
})

test('premium foreign countries enforce regional minimum prices', () => {
  assert.equal(applyNumberPriceFloorsKobo(100000, '1', { countryId: '56' }), 1200000)
  assert.equal(applyNumberPriceFloorsKobo(100000, '1', { countryId: '1001' }), 1500000)
  assert.equal(applyNumberPriceFloorsKobo(100000, '1', { countryId: '173' }), 1500000)
  assert.equal(applyNumberPriceFloorsKobo(100000, '1', { countryId: '175' }), 1200000)
  assert.equal(applyNumberPriceFloorsKobo(100000, '1', { countryId: '78' }), 1000000)
  assert.equal(applyNumberPriceFloorsKobo(100000, '1', { countryId: '86' }), 1000000)
  assert.equal(applyNumberPriceFloorsKobo(100000, '1', { countryId: '36' }), 1000000)
})

test('Checkout rejects any signed WhatsApp USA provider 3193 price other than NGN 3,500', async () => {
  process.env.AUTH_JWT_SECRET ||= 'number-pricing-test-secret-32-characters-long'
  const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET)
  const sign = (price) => new SignJWT({ userId: 'test-user', ...FIXED_NUMBER_OFFER, providerPriceUsd: 1.735, sellingPriceKobo: price })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('lms-number-quote').setAudience('lms-number-checkout')
    .setIssuedAt().setExpirationTime('2m').sign(secret)
  await assert.rejects(() => sign(302552).then((token) => verifyNumberQuote(token, 'test-user')), /pricing has changed/)
  const valid = await verifyNumberQuote(await sign(350000), 'test-user')
  assert.equal(valid.sellingPriceKobo, 350000)
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

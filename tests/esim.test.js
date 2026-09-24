import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ESIM_PLANS, esimPriceKobo, normalizeEsimPrices, publicEsimOrder } from '../lib/esim.js'

test('eSIM catalog has the four supported durations', () => {
  assert.deepEqual(ESIM_PLANS.map((plan) => plan.months), [1, 3, 6, 12])
})

test('eSIM prices use the configured catalog defaults', () => {
  assert.deepEqual(normalizeEsimPrices(), { '1-month': 1850000, '3-months': 3000000, '6-months': 6000000, '1-year': 12000000 })
  assert.deepEqual(normalizeEsimPrices({ pricesKobo: { '1-month': null } }), { '1-month': null, '3-months': 3000000, '6-months': 6000000, '1-year': 12000000 })
  assert.equal(esimPriceKobo(''), null)
  assert.equal(esimPriceKobo(99), null)
  assert.equal(esimPriceKobo(12500), 1250000)
})

test('stored eSIM prices are normalized in kobo', () => {
  assert.deepEqual(normalizeEsimPrices({ pricesKobo: { '1-month': 1000000, '3-months': 2500000, '6-months': 4000000, '1-year': 7500000 } }), {
    '1-month': 1000000,
    '3-months': 2500000,
    '6-months': 4000000,
    '1-year': 7500000,
  })
})

test('WhatsApp contact is only generated from a configured Nigerian number', () => {
  const previous = process.env.ESIM_WHATSAPP_NUMBER
  const order = { _id: 'order-123', planId: '1-year', planName: '1 Year' }
  delete process.env.ESIM_WHATSAPP_NUMBER
  assert.equal(publicEsimOrder(order).contactUrl, null)

  process.env.ESIM_WHATSAPP_NUMBER = '2349152618067'
  const contactUrl = publicEsimOrder(order).contactUrl
  assert.equal(contactUrl.startsWith('https://wa.me/2349152618067?text='), true)
  assert.equal(decodeURIComponent(contactUrl).includes('order-123'), true)

  if (previous == null) delete process.env.ESIM_WHATSAPP_NUMBER
  else process.env.ESIM_WHATSAPP_NUMBER = previous
})

test('monthly eSIM WhatsApp messages preserve the supplied text exactly', () => {
  const previous = process.env.ESIM_WHATSAPP_NUMBER
  process.env.ESIM_WHATSAPP_NUMBER = '2349152618067'

  const expectedMessages = {
    '1-month': 'Hello LMS Socials, I have paid for the 1 Month.,eSIM plan. My order reference is 6aa584dfdafe18df7136a4c5. Please send my eSIM QR code.',
    '3-months': 'Hello LMS Socials, I have paid for the 3.! Months eSIM plan. My order reference is 6ab4d5276a3682bca6922980. Please send my eSIM QR code.',
    '6-months': 'Hello LMS Socials, I have paid for the 6 Months.”eSIM plan. My order reference is 6aa58e71662d7d91bd0400b8. Please send my eSIM QR code.',
  }

  for (const plan of ESIM_PLANS.filter((item) => item.months < 12)) {
    const order = { _id: 'generated-order-reference', planId: plan.id, planName: plan.name }
    const url = new URL(publicEsimOrder(order).contactUrl)
    assert.equal(url.searchParams.get('text'), expectedMessages[plan.id])
  }

  if (previous == null) delete process.env.ESIM_WHATSAPP_NUMBER
  else process.env.ESIM_WHATSAPP_NUMBER = previous
})

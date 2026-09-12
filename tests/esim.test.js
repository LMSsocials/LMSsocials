import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ESIM_PLANS, esimPriceKobo, normalizeEsimPrices, publicEsimOrder } from '../lib/esim.js'

test('eSIM catalog has the three supported durations', () => {
  assert.deepEqual(ESIM_PLANS.map((plan) => plan.months), [1, 3, 6])
})

test('eSIM prices remain unavailable until an admin sets them', () => {
  assert.deepEqual(normalizeEsimPrices(), { '1-month': null, '3-months': null, '6-months': null })
  assert.equal(esimPriceKobo(''), null)
  assert.equal(esimPriceKobo(99), null)
  assert.equal(esimPriceKobo(12500), 1250000)
})

test('stored eSIM prices are normalized in kobo', () => {
  assert.deepEqual(normalizeEsimPrices({ pricesKobo: { '1-month': 1000000, '3-months': 2500000, '6-months': 4000000 } }), {
    '1-month': 1000000,
    '3-months': 2500000,
    '6-months': 4000000,
  })
})

test('WhatsApp contact is only generated from a configured Nigerian number', () => {
  const previous = process.env.ESIM_WHATSAPP_NUMBER
  const order = { _id: 'order-123', planName: '3 Months' }
  delete process.env.ESIM_WHATSAPP_NUMBER
  assert.equal(publicEsimOrder(order).contactUrl, null)

  process.env.ESIM_WHATSAPP_NUMBER = '2349152618067'
  const contactUrl = publicEsimOrder(order).contactUrl
  assert.equal(contactUrl.startsWith('https://wa.me/2349152618067?text='), true)
  assert.equal(decodeURIComponent(contactUrl).includes('order-123'), true)

  if (previous == null) delete process.env.ESIM_WHATSAPP_NUMBER
  else process.env.ESIM_WHATSAPP_NUMBER = previous
})

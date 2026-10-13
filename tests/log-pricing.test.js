import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyLogPriceRules, BULKACC_LOG_PRODUCTS, isHiddenLogProduct, logCategory } from '../lib/log-providers.js'

test('Fixed log prices match the storefront price list', () => {
  const cases = [
    ['MICROSOFT TEXTPLUS (Read Rules)', 270000],
    ['MICROSOFT NEXTPLUS (Login Video in Telegram)', 290000],
    ['OLD GOOGLE VOICE (TEXT AND CALL)', 860000],
    ['NEW GOOGLE VOICE (ONLY CALL)', 670000],
    ['9 PROXY = 40 ip', 750000],
    ['9 PROXY = 30 ip', 630000],
    ['9 PROXY = 20 ip', 480000],
    ['AVAST VPN', 230000],
    ['EXPRESS FOR LAPTOP & PC', 270000],
    ['EXPRESS FOR PHONE', 270000],
    ['IP VANISH VPN 7 DAYS', 120000],
    ['NORD VPN 7 DAYS', 120000],
    ['PIA VPN 7 DAYS', 120000],
    ['Clone X Twitter | Reg Phone Ultra | Reg Hotmail Trust | FULL 2FA', 230000],
    ['X Twitter USA Old | Year 2011 | Hotmail | FULL 2FA', 490000],
    ['X Twitter United Kingdom Stock | Year 2011 | Hotmail | FULL 2FA', 490000],
    ['Clone X Old Twitter | 2021-2024 | Yopmail | FULL 2FA', 600000],
    ['USA FACEBOOK PAGE CREATE ALREADY', 800000],
    ['RANDOM FB PAGE CREATED YOURSELF', 390000],
  ]

  for (const [title, expectedPrice] of cases) {
    assert.equal(applyLogPriceRules(title, 100), expectedPrice, title)
  }
})

test('Removed supplier listings stay hidden', () => {
  assert.equal(isHiddenLogProduct('OLD GMAIL 2025'), true)
  assert.equal(isHiddenLogProduct('RANDOM FB PAGE CREATED YOURSELF'), true)
  assert.equal(isHiddenLogProduct('USA FACEBOOK PAGE CREATE ALREADY'), false)
})

test('Log products are grouped under their actual platforms', () => {
  assert.equal(logCategory('Logs', 'LMS Socials', 'USA Spotify account'), 'Spotify')
  assert.equal(logCategory('Other', 'MICROSOFT TEXTPLUS (Read Rules)'), 'TextPlus')
  assert.equal(logCategory('Other', 'EXPRESS FOR PHONE'), 'VPN')
  assert.equal(logCategory('Other', 'CLONE TIKTIOK US | Full 2FA'), 'TikTok')
  assert.equal(logCategory('Other', 'USA Apple ID with email access'), 'Apple ID')
  assert.equal(logCategory('Other', 'Grok AI account with 2FA'), 'Grok AI')
})

test('BulkAcc storefront allowlist uses the requested fixed naira prices', () => {
  assert.deepEqual(Object.fromEntries(BULKACC_LOG_PRODUCTS.map((item) => [item.title, item.priceKobo])), {
    'Snapchat with Email Access': 600000,
    'USA Apple ID with Email Access': 800000,
    'Canada Apple ID with Email Access': 750000,
    'UK Apple ID with Email Access': 500000,
    'Germany Apple ID with Email Access': 800000,
    'Australia Apple ID with Email Access': 700000,
    'Grok AI with Email Access and 2FA': 1100000,
  })
})

test('Other clone-labelled products cost twice their calculated price', () => {
  assert.equal(applyLogPriceRules('CLONE INSTAGRAM US | FULL 2FA', 104000), 208000)
  assert.equal(applyLogPriceRules('CLONED TIKTOK CANADA | FULL 2FA', 91000), 182000)
  assert.equal(applyLogPriceRules('Ordinary Instagram account', 104000), 104000)
})

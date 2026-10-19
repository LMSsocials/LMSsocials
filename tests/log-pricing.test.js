import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyLogPriceRules, bulkMarkedUpPriceKobo, BULKACC_LOG_PRODUCTS, isHiddenLogProduct, isHiddenSujanProduct, logCategory } from '../lib/log-providers.js'

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

test('Sujan hides only Gmail services', () => {
  assert.equal(isHiddenSujanProduct({ name: 'OLD GMAIL 2024', category: { name: 'Gmail' } }), true)
  assert.equal(isHiddenSujanProduct({ name: 'Fresh Gmail Accounts', platform: { name: 'Google Gmail' } }), true)
  assert.equal(isHiddenSujanProduct({ name: 'USA LinkedIn with Gmail access', category: { name: 'LinkedIn' } }), false)
  assert.equal(isHiddenSujanProduct({ name: 'USA Snapchat registered with Gmail', platform: { name: 'Snapchat' } }), false)
  assert.equal(isHiddenSujanProduct({ name: 'RANDOM FB PAGE CREATED YOURSELF', platform: { name: 'USA FACEBOOK' } }), false)
})

test('Log products are grouped under their actual platforms', () => {
  assert.equal(logCategory('Logs', 'LMS Socials', 'USA Spotify account'), 'Spotify')
  assert.equal(logCategory('Other', 'MICROSOFT TEXTPLUS (Read Rules)'), 'TextPlus')
  assert.equal(logCategory('Other', 'EXPRESS FOR PHONE'), 'VPN')
  assert.equal(logCategory('Other', 'CLONE TIKTIOK US | Full 2FA'), 'TikTok')
  assert.equal(logCategory('INSTAGRAM', 'CLONE INSTAGRAM | FULL 2FA'), 'Instagram')
  assert.equal(logCategory('Other', 'USA Apple ID with email access'), 'Apple ID')
  assert.equal(logCategory('Other', 'Grok AI account with 2FA'), 'Grok AI')
  assert.equal(logCategory('Other', 'ChatGPT account with email access'), 'ChatGPT')
  assert.equal(logCategory('Other', 'USA SoundCloud account'), 'SoundCloud')
  assert.equal(logCategory('Other', 'USA Roblox account'), 'Roblox')
  assert.equal(logCategory('Other', 'Aged USA Twitch account'), 'Twitch')
  assert.equal(logCategory('Other', 'USA Yelp account with email access'), 'Yelp')
  assert.equal(logCategory('Other', 'USA LinkedIn with Gmail access'), 'LinkedIn')
  assert.equal(logCategory('Other', 'Onlyfans account with 2FA'), 'OnlyFans')
  assert.equal(logCategory('Other', 'GMX Email with IMAP enabled'), 'Email')
})

test('Requested live BulkAcc products remain in the storefront allowlist', () => {
  const requestedCodes = ['201231', '202351', '202962', '203011', '201182', '201082', '200313', '200305', '204743', '201020', '202060', '201112']
  const definitions = BULKACC_LOG_PRODUCTS.filter((item) => requestedCodes.includes(item.code))
  assert.deepEqual(definitions.map((item) => item.code), requestedCodes)
  assert.ok(definitions.every((item) => item.useLiveDetails === true))
})

test('Requested Snapchat products are assigned to the Snapchat category', () => {
  const definitions = BULKACC_LOG_PRODUCTS.filter((item) => ['200313', '200305'].includes(item.code))
  assert.equal(definitions.length, 2)
  assert.ok(definitions.every((item) => item.category === 'Snapchat'))
  assert.ok(definitions.every((item) => item.expected.test(item.title)))
})

test('Snapchat products use the approved storefront prices', () => {
  const prices = Object.fromEntries(BULKACC_LOG_PRODUCTS.map((item) => [item.code, item.priceKobo]))
  assert.deepEqual(Object.fromEntries(['200303', '203027', '201231', '202351', '202962', '203011', '201182', '200313', '200305'].map((code) => [code, prices[code]])), {
    '200303': 600000,
    '203027': 6700000,
    '201231': 6700000,
    '202351': 6700000,
    '202962': 5400000,
    '203011': 6700000,
    '201182': 2800000,
    '200313': 1100000,
    '200305': 700000,
  })
})

test('BulkAcc storefront allowlist uses the requested fixed naira prices', () => {
  const prices = Object.fromEntries(BULKACC_LOG_PRODUCTS.map((item) => [item.title, item.priceKobo]))
  assert.deepEqual(Object.fromEntries(Object.entries(prices).slice(0, 7)), {
    'Snapchat with Email Access': 600000,
    'USA Apple ID with Email Access': 800000,
    'Canada Apple ID with Email Access': 750000,
    'UK Apple ID with Email Access': 500000,
    'Germany Apple ID with Email Access': 800000,
    'Australia Apple ID with Email Access': 700000,
    'Grok AI with Email Access and 2FA': 1100000,
  })
  assert.equal(prices['USA SoundCloud with Email and 2FA'], 3000000)
  assert.equal(prices['USA Twitch with Email Access'], 1700000)
  const chatGptProducts = BULKACC_LOG_PRODUCTS.filter((item) => item.category === 'ChatGPT')
  const robloxProducts = BULKACC_LOG_PRODUCTS.filter((item) => item.category === 'Roblox')
  assert.equal(chatGptProducts.length, 8)
  assert.equal(robloxProducts.length, 8)
  assert.ok(chatGptProducts.every((item) => item.priceKobo === 1000000))
  assert.ok(robloxProducts.every((item) => item.priceKobo === 400000))
  assert.equal(prices['Italy Snapchat with Gmail Access'], 6700000)
  assert.equal(prices['USA LinkedIn with Gmail Access and 2FA'], 10593440)
  assert.equal(prices['USA Spotify with Email Access'], 773760)
  assert.equal(prices['USA Yelp with Email Access'], 1000000)
})

test('BulkAcc cost-based prices apply a 30 percent uplift after USD conversion', () => {
  assert.equal(bulkMarkedUpPriceKobo(50.93, 30, 1600), 10593440)
  assert.equal(bulkMarkedUpPriceKobo(3.72, 30, 1600), 773760)
})

test('Other clone-labelled products cost twice their calculated price', () => {
  assert.equal(applyLogPriceRules('CLONE INSTAGRAM US | FULL 2FA', 104000), 208000)
  assert.equal(applyLogPriceRules('CLONED TIKTOK CANADA | FULL 2FA', 91000), 182000)
  assert.equal(applyLogPriceRules('Ordinary Instagram account', 104000), 104000)
})

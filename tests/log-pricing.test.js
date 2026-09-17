import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyLogPriceRules, logCategory } from '../lib/log-providers.js'

test('Fixed log prices match the storefront price list', () => {
  const cases = [
    ['MICROSOFT TEXTPLUS (Read Rules)', 270000],
    ['MICROSOFT NEXTPLUS (Read Rules)', 220000],
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
    ['USA FACEBOOK PAGE CREATE ALREADY', 450000],
    ['RANDOM FB PAGE CREATED YOURSELF', 390000],
  ]

  for (const [title, expectedPrice] of cases) {
    assert.equal(applyLogPriceRules(title, 100), expectedPrice, title)
  }
})

test('Log products are grouped under their actual platforms', () => {
  assert.equal(logCategory('Logs', 'LMS Socials', 'USA Spotify account'), 'Spotify')
  assert.equal(logCategory('Other', 'MICROSOFT TEXTPLUS (Read Rules)'), 'TextPlus')
  assert.equal(logCategory('Other', 'EXPRESS FOR PHONE'), 'VPN')
  assert.equal(logCategory('Other', 'CLONE TIKTIOK US | Full 2FA'), 'TikTok')
})

test('Other clone-labelled products cost twice their calculated price', () => {
  assert.equal(applyLogPriceRules('CLONE INSTAGRAM US | FULL 2FA', 104000), 208000)
  assert.equal(applyLogPriceRules('CLONED TIKTOK CANADA | FULL 2FA', 91000), 182000)
  assert.equal(applyLogPriceRules('Ordinary Instagram account', 104000), 104000)
})

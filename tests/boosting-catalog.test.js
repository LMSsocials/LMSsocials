import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isHiddenBoostingService } from '../lib/boosting-provider.js'

test('Only United States website traffic remains in the catalog', () => {
  assert.equal(isHiddenBoostingService('Website Traffic', 'Germany targeted visits'), true)
  assert.equal(isHiddenBoostingService('Traffic', 'Website Traffic - France'), true)
  assert.equal(isHiddenBoostingService('Website Traffic', 'Canada visitors'), true)
  assert.equal(isHiddenBoostingService('Website Traffic', 'United Kingdom targeted visits'), true)
  assert.equal(isHiddenBoostingService('Website Traffic', 'Worldwide visitors'), true)
  assert.equal(isHiddenBoostingService('USA Website Traffic', 'Targeted visits'), false)
  assert.equal(isHiddenBoostingService('Website Traffic', 'United States visitors'), false)
})

test('Twitch and other social services remain available', () => {
  assert.equal(isHiddenBoostingService('Twitch', 'Live stream viewers'), false)
  assert.equal(isHiddenBoostingService('Instagram', 'France followers'), false)
})

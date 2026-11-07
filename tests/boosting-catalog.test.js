import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isHiddenBoostingService } from '../lib/boosting-provider.js'

test('Removed boosting services stay out of both catalog and checkout validation', () => {
  assert.equal(isHiddenBoostingService('Twitch', 'Live stream viewers'), true)
  assert.equal(isHiddenBoostingService('Website Traffic', 'Germany targeted visits'), true)
  assert.equal(isHiddenBoostingService('Traffic', 'Website Traffic - France'), true)
  assert.equal(isHiddenBoostingService('Website Traffic', 'Canada visitors'), true)
})

test('Other website traffic regions and social services remain available', () => {
  assert.equal(isHiddenBoostingService('Website Traffic', 'United Kingdom targeted visits'), false)
  assert.equal(isHiddenBoostingService('Instagram', 'France followers'), false)
})

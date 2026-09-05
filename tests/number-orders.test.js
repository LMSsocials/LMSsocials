import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { MongoClient, ObjectId } from 'mongodb'
import { chooseNumberSupplier, parseNumberStatus, verifyNumberQuote, createNumberQuote, reserveQuotedNumber } from '../lib/number-provider.js'
import { publicNumberOrder, syncNumberOrder } from '../lib/number-order-lifecycle.js'

test('Recommended prefers a Gold supplier over cheaper unranked inventory', () => {
  const prices = { 1: { price: 0.01, count: 100 }, 2: { price: 0.2, count: 10 }, 3: { price: 0.15, count: 8 } }
  const goldPartners = { 2: {}, 3: {} }
  assert.equal(chooseNumberSupplier({ prices, goldPartners, serverId: '2' }).providerId, '3')
  assert.equal(chooseNumberSupplier({ prices, goldPartners, serverId: '1' }).providerId, '1')
  assert.equal(chooseNumberSupplier({ prices, goldPartners: {}, serverId: '3' }), null)
  assert.equal(chooseNumberSupplier({ prices, goldPartners: {}, serverId: '2' }).gold, false)
})

test('Unavailable/invalid inventory is never chosen', () => {
  const prices = { 1: { price: 0, count: 30 }, 2: { price: 0.1, count: 0 }, 3: { price: 'bad', count: 30 } }
  assert.equal(chooseNumberSupplier({ prices, goldPartners: {}, serverId: '2' }), null)
})

test('SMS parsing preserves leading zeros and recognizes a previous delivered code', () => {
  assert.deepEqual(parseNumberStatus('STATUS_OK:001234'), { status: 'completed', smsCode: '001234' })
  assert.deepEqual(parseNumberStatus('STATUS_WAIT_RETRY:000321'), { status: 'completed', smsCode: '000321' })
  assert.deepEqual(parseNumberStatus('STATUS_CANCEL'), { status: 'canceled' })
  assert.throws(() => parseNumberStatus('BAD_KEY'))
  assert.throws(() => parseNumberStatus('STATUS_OK:'))
  assert.throws(() => parseNumberStatus('NO_ACTIVATION'))
})

test('Public order excludes supplier costs and lock state', () => {
  const order = publicNumberOrder({ _id: 'a', createdAt: new Date(), status: 'active', sellingPriceKobo: 100, providerPriceUsd: 0.01, syncToken: 'hidden' })
  assert.equal(order.canCancel, true)
  assert.equal(order.providerPriceUsd, undefined)
  assert.equal(order.syncToken, undefined)
  assert.equal(publicNumberOrder({ _id: 'a', createdAt: new Date(), status: 'active', smsCode: '0001' }).canCancel, false)
})

test('Forged quote cannot choose the debit amount', async () => {
  process.env.AUTH_JWT_SECRET ||= 'number-tests-only-secret-at-least-32-characters'
  await assert.rejects(() => verifyNumberQuote('fake-token', 'user'))
})

test('Reservation pins the quoted supplier and maximum price with no silent retry', async (t) => {
  process.env.SMSBOWER_API_KEY ||= 'test-only'
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls++
    assert.equal(url.searchParams.get('providerIds'), '3209')
    assert.equal(url.searchParams.get('maxPrice'), '0.067')
    assert.equal(url.searchParams.get('action'), 'getNumberV2')
    return new Response('NO_NUMBERS')
  })
  await assert.rejects(() => reserveQuotedNumber({ countryId: '12', serviceCode: 'go', providerId: '3209', providerPriceUsd: 0.067 }), (error) => error.definitive === true)
  assert.equal(calls, 1)
})

test('A reservation timeout is ambiguous and must not automatically refund', async (t) => {
  process.env.SMSBOWER_API_KEY ||= 'test-only'
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('timeout') })
  await assert.rejects(() => reserveQuotedNumber({ countryId: '12', serviceCode: 'go', providerId: '3209', providerPriceUsd: 0.067 }), (error) => error.definitive === false)
})

// Integration checks only ever write into a newly-created, randomly-named test
// database. All SMS provider calls below are stubs; no real number is purchased
// or canceled. Opt in with LMS_NUMBER_INTEGRATION=1 and MONGODB_URI.
const integration = process.env.LMS_NUMBER_INTEGRATION === '1'
let client, database
before(async () => {
  if (!integration) return
  client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  database = client.db('lms_num_test_' + new ObjectId().toHexString())
  await Promise.all(['users', 'numberOrders', 'numberRefunds'].map((name) => database.createCollection(name)))
})
after(async () => {
  if (!client) return
  try {
    assert.match(database.databaseName, /^lms_num_test_[a-f0-9]{24}$/)
    await database.dropDatabase()
  } finally { await client.close() }
})
const scenario = (name, fn) => test(name, { skip: !integration }, fn)
async function fixture(overrides = {}) {
  const userId = new ObjectId(), orderId = new ObjectId()
  await database.collection('users').insertOne({ _id: userId, balanceKobo: 100000 })
  await database.collection('numberOrders').insertOne({ _id: orderId, userId, activationId: 'fake-test-activation', phoneNumber: '12766014770', status: 'active', sellingPriceKobo: 15000, createdAt: new Date(Date.now() - 180000), ...overrides })
  return { database, client, orderId, userId }
}
const waiting = async () => ({ status: 'waiting' })
const accepted = async () => true
async function outcome(args) {
  const order = await database.collection('numberOrders').findOne({ _id: args.orderId })
  const user = await database.collection('users').findOne({ _id: args.userId })
  const refunds = await database.collection('numberRefunds').countDocuments({ _id: args.orderId })
  return { order, balance: user.balanceKobo, refunds }
}

scenario('Confirmed cancellation refunds exactly once, including retries', async () => {
  const args = await fixture()
  let calls = 0
  const provider = { readNumberStatus: waiting, cancelProviderNumber: async () => { calls++; return true } }
  await syncNumberOrder({ ...args, cancel: true, provider })
  await syncNumberOrder({ ...args, cancel: true, provider })
  const result = await outcome(args)
  assert.equal(result.balance, 115000)
  assert.equal(result.refunds, 1)
  assert.equal(result.order.status, 'refunded')
  assert.equal(calls, 1)
})

scenario('SMS already received blocks cancellation and refund', async () => {
  const args = await fixture()
  await syncNumberOrder({ ...args, cancel: true, provider: { readNumberStatus: async () => ({ status: 'completed', smsCode: '001234' }), cancelProviderNumber: () => assert.fail('Must not cancel after SMS') } })
  const result = await outcome(args)
  assert.equal(result.balance, 100000)
  assert.equal(result.order.smsCode, '001234')
  assert.equal(result.order.status, 'completed')
})

scenario('SMS arriving during cancellation is saved without a refund', async () => {
  const args = await fixture()
  let reads = 0
  await syncNumberOrder({ ...args, cancel: true, provider: {
    readNumberStatus: async () => ++reads === 1 ? { status: 'waiting' } : { status: 'completed', smsCode: '123456' },
    cancelProviderNumber: async () => { throw new Error('BAD_STATUS') },
  } })
  const result = await outcome(args)
  assert.equal(result.balance, 100000)
  assert.equal(result.order.status, 'completed')
})

scenario('Concurrent cancellations serialize into one supplier request and one credit', async () => {
  const args = await fixture()
  let release, entered
  const block = new Promise((resolve) => { release = resolve })
  const started = new Promise((resolve) => { entered = resolve })
  let calls = 0
  const provider = { readNumberStatus: async () => { entered(); await block; return { status: 'waiting' } }, cancelProviderNumber: async () => { calls++; return true } }
  const first = syncNumberOrder({ ...args, cancel: true, provider })
  await started
  const second = await syncNumberOrder({ ...args, cancel: true, provider })
  assert.equal(second.busy, true)
  release()
  await first
  const result = await outcome(args)
  assert.equal(result.balance, 115000)
  assert.equal(result.refunds, 1)
  assert.equal(calls, 1)
})

scenario('Two-minute cooldown prevents early provider cancellation', async () => {
  const args = await fixture({ createdAt: new Date() })
  await syncNumberOrder({ ...args, cancel: true, provider: { readNumberStatus: waiting, cancelProviderNumber: () => assert.fail('Too early') } })
  assert.equal((await outcome(args)).balance, 100000)
})

scenario('Unknown provider outcome does not cause a refund', async () => {
  const args = await fixture()
  await syncNumberOrder({ ...args, cancel: true, provider: { readNumberStatus: waiting, cancelProviderNumber: async () => { throw new Error('timeout') } } })
  const result = await outcome(args)
  assert.equal(result.balance, 100000)
  assert.equal(result.order.status, 'cancel_pending')
  assert.equal(result.refunds, 0)
})

scenario('Provider auto-cancellation refunds an expired unused number', async () => {
  const args = await fixture()
  await syncNumberOrder({ ...args, provider: { readNumberStatus: async () => ({ status: 'canceled' }), cancelProviderNumber: accepted } })
  assert.equal((await outcome(args)).balance, 115000)
})

scenario('Persisted cancellation confirmation recovers an interrupted refund', async () => {
  const args = await fixture({ status: 'cancel_confirmed', cancellationConfirmedAt: new Date() })
  await syncNumberOrder({ ...args, provider: { readNumberStatus: () => assert.fail('No need to recancel'), cancelProviderNumber: accepted } })
  assert.equal((await outcome(args)).balance, 115000)
})

scenario('A failed refund transaction rolls back credit and can safely recover', async () => {
  const args = await fixture()
  const brokenDatabase = { collection(name) {
    const collection = database.collection(name)
    if (name !== 'numberRefunds') return collection
    return { insertOne: async () => { throw new Error('Simulated receipt persistence failure') } }
  } }
  await syncNumberOrder({ ...args, database: brokenDatabase, cancel: true, provider: { readNumberStatus: waiting, cancelProviderNumber: accepted } })
  const failed = await outcome(args)
  assert.equal(failed.balance, 100000)
  assert.equal(failed.order.status, 'cancel_confirmed')
  await syncNumberOrder({ ...args, cancel: true, provider: { readNumberStatus: () => assert.fail('Already confirmed'), cancelProviderNumber: accepted } })
  const recovered = await outcome(args)
  assert.equal(recovered.balance, 115000)
  assert.equal(recovered.refunds, 1)
})

scenario('Another user cannot read status or cancel an order', async () => {
  const args = await fixture()
  const result = await syncNumberOrder({ ...args, userId: new ObjectId(), cancel: true, provider: { readNumberStatus: () => assert.fail('Not owned'), cancelProviderNumber: accepted } })
  assert.equal(result.busy, true)
  assert.equal((await outcome(args)).balance, 100000)
})

scenario('A stale lease cannot issue a wallet credit', async () => {
  const args = await fixture()
  await syncNumberOrder({ ...args, cancel: true, provider: {
    readNumberStatus: async () => {
      await database.collection('numberOrders').updateOne({ _id: args.orderId }, { $set: { syncToken: 'new-operation' } })
      return { status: 'canceled' }
    }, cancelProviderNumber: accepted,
  } })
  assert.equal((await outcome(args)).balance, 100000)
})

test('Live quote smoke check uses Gold inventory without buying a number', { skip: process.env.LMS_NUMBER_QUOTE_SMOKE !== '1' }, async () => {
  const quote = await createNumberQuote({ userId: 'test-only', countryId: '12', serviceCode: 'go', serverId: '3' })
  assert.equal(quote.quality, 'gold')
  assert.ok(quote.priceKobo > 0)
  await assert.rejects(() => verifyNumberQuote(quote.token, 'another-user'))
  const verified = await verifyNumberQuote(quote.token, 'test-only')
  assert.equal(verified.userId, 'test-only')
  assert.ok(verified.providerId)
})

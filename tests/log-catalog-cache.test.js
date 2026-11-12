import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { getVoucherCatalogResponse, invalidateVoucherCatalogResponse, setVoucherCatalogResponse } from '../lib/voucher-catalog-cache.js'

afterEach(() => invalidateVoucherCatalogResponse())

test('The assembled voucher catalog is reused briefly without another database read', () => {
  const products = [{ _id: 'bulkacc:1' }]
  setVoucherCatalogResponse('rules-1', products, 1000)
  assert.equal(getVoucherCatalogResponse('rules-1', 15999), products)
})

test('Catalog response cache expires and cannot cross pricing-rule versions', () => {
  setVoucherCatalogResponse('rules-1', [{ _id: 'bulkacc:1' }], 1000)
  assert.equal(getVoucherCatalogResponse('rules-2', 1001), null)
  assert.equal(getVoucherCatalogResponse('rules-1', 16000), null)
})

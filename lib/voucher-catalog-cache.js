const RESPONSE_TTL_MS = 15 * 1000

export function getVoucherCatalogResponse(rulesVersion, now = Date.now()) {
  const cached = globalThis.__lmsVoucherCatalogResponse
  if (!cached || cached.rulesVersion !== rulesVersion || now - cached.createdAt >= RESPONSE_TTL_MS) return null
  return cached.products
}

export function setVoucherCatalogResponse(rulesVersion, products, now = Date.now()) {
  globalThis.__lmsVoucherCatalogResponse = { rulesVersion, products, createdAt: now }
  return products
}

export function invalidateVoucherCatalogResponse() {
  globalThis.__lmsVoucherCatalogResponse = undefined
}

export async function runLegacyHandler(handler, request) {
  let status = 200
  let payload = null
  const headers = new Headers()
  const url = new URL(request.url)
  const legacyRequest = { method: request.method, query: Object.fromEntries(url.searchParams.entries()) }
  const legacyResponse = {
    setHeader(name, value) { headers.set(name, String(value)); return legacyResponse },
    status(code) { status = code; return legacyResponse },
    json(value) { payload = value; return legacyResponse },
  }
  await handler(legacyRequest, legacyResponse)
  return Response.json(payload ?? {}, { status, headers })
}
import handler from '../../../api/bulkacc-products.js'
import { runLegacyHandler } from '../../../lib/legacy-handler'

export async function GET(request) {
  return runLegacyHandler(handler, request)
}

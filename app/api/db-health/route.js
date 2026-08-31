import handler from '../../../api/db-health.js'
import { runLegacyHandler } from '../../../lib/legacy-handler'

export async function GET(request) {
  return runLegacyHandler(handler, request)
}

import handler from '../../../api/boosting-services.js'
import { runLegacyHandler } from '../../../lib/legacy-handler'

export async function GET(request) {
  return runLegacyHandler(handler, request)
}

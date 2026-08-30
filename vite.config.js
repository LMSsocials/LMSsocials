import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import boostingServices from './api/boosting-services.js'
import bulkaccProducts from './api/bulkacc-products.js'

const apiMiddleware = (route, handler) => ({
  name: 'local-api-' + route.replaceAll('/', '-'),
  configureServer(server) {
    server.middlewares.use(route, async (request, response) => {
      const apiResponse = {
        setHeader: (...args) => response.setHeader(...args),
        status(code) {
          response.statusCode = code
          return apiResponse
        },
        json(payload) {
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(payload))
        },
      }
      await handler(request, apiResponse)
    })
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, {
    BOOSTING_API_KEY: env.BOOSTING_API_KEY,
    BULKACC_API_KEY: env.BULKACC_API_KEY,
    BULKACC_USD_TO_NGN_RATE: env.BULKACC_USD_TO_NGN_RATE,
    BULKACC_MARKUP_PERCENT: env.BULKACC_MARKUP_PERCENT,
  })
  return {
    plugins: [
      react(),
      apiMiddleware('/api/boosting-services', boostingServices),
      apiMiddleware('/api/bulkacc-products', bulkaccProducts),
    ],
  }
})

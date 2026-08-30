import { getDatabase } from './lib/mongodb.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ message: 'Method not allowed' })

  try {
    const database = await getDatabase()
    await database.command({ ping: 1 })
    return response.status(200).json({ connected: true, database: database.databaseName })
  } catch (error) {
    console.error('[database/health] connection failed', { message: error.message })
    return response.status(503).json({ connected: false, message: 'Database connection unavailable' })
  }
}

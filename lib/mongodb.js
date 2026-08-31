import { MongoClient, ServerApiVersion } from 'mongodb'

const databaseName = 'lmssocials'

function createClientPromise() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not configured')
  return new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  }).connect()
}

export function getMongoClient() {
  if (!globalThis.__lmsMongoClientPromise) globalThis.__lmsMongoClientPromise = createClientPromise()
  return globalThis.__lmsMongoClientPromise
}

export async function getDatabase() {
  const client = await getMongoClient()
  return client.db(databaseName)
}
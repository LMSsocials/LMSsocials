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
  if (!globalThis.__lmsMongoClientPromise) {
    const connectionPromise = createClientPromise()
    globalThis.__lmsMongoClientPromise = connectionPromise

    // Do not leave a rejected promise in the development/serverless process.
    // A temporary DNS or Atlas networking failure should be retried by the next
    // request instead of making every later database call fail immediately.
    connectionPromise.catch(() => {
      if (globalThis.__lmsMongoClientPromise === connectionPromise) {
        globalThis.__lmsMongoClientPromise = undefined
      }
    })
  }
  return globalThis.__lmsMongoClientPromise
}

export async function getDatabase() {
  const client = await getMongoClient()
  return client.db(databaseName)
}

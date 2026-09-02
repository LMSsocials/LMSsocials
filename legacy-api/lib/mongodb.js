import { MongoClient, ServerApiVersion } from 'mongodb'

const databaseName = 'lmssocials'

const createClientPromise = () => {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not configured')

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  })
  return client.connect()
}

export const getMongoClient = () => {
  if (!globalThis.__lmsMongoClientPromise) {
    globalThis.__lmsMongoClientPromise = createClientPromise()
  }
  return globalThis.__lmsMongoClientPromise
}

export const getDatabase = async () => {
  const client = await getMongoClient()
  return client.db(databaseName)
}

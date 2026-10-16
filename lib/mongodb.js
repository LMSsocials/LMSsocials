import { MongoClient, ServerApiVersion } from 'mongodb'
import { resolve4 } from 'node:dns/promises'

const databaseName = 'lmssocials'

function ipv4Lookup(hostname, options, callback) {
  resolve4(hostname)
    .then((addresses) => {
      if (!addresses.length) throw new Error(`No IPv4 address found for ${hostname}`)
      if (typeof options === 'object' && options?.all) {
        callback(null, addresses.map((address) => ({ address, family: 4 })))
        return
      }
      callback(null, addresses[0], 4)
    })
    .catch((error) => callback(error))
}

function createClientPromise() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not configured')
  return new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    // Atlas SRV discovery succeeds on this host, while Windows getaddrinfo can
    // intermittently return ENOTFOUND for the selected nodes. Resolve their A
    // records through Node's DNS client while keeping the hostname for TLS.
    family: 4,
    lookup: ipv4Lookup,
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

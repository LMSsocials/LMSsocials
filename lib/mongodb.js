import { MongoClient, ServerApiVersion } from 'mongodb'
import { lookup } from 'node:dns'

const databaseName = 'lmssocials'
const atlasSeedLists = {
  'lmssocials.7h3n3co.mongodb.net': {
    hosts: [
      'ac-zp63tsf-shard-00-00.7h3n3co.mongodb.net:27017',
      'ac-zp63tsf-shard-00-01.7h3n3co.mongodb.net:27017',
      'ac-zp63tsf-shard-00-02.7h3n3co.mongodb.net:27017',
    ],
    replicaSet: 'atlas-zir2cm-shard-0',
  },
}

function ipv4Lookup(hostname, options, callback) {
  const lookupOptions = typeof options === 'object'
    ? { ...options, family: 4 }
    : { family: 4 }
  lookup(hostname, lookupOptions, callback)
}

function withoutSrvDiscovery(uri) {
  const match = uri.match(/^mongodb\+srv:\/\/([^@]+@)?([^/?]+)(\/[^?]*)?(?:\?(.*))?$/i)
  if (!match) return uri

  const [, credentials = '', hostname, path = '/', query = ''] = match
  const seedList = atlasSeedLists[hostname.toLowerCase()]
  if (!seedList) return uri

  const parameters = new URLSearchParams(query)
  parameters.set('tls', 'true')
  if (!parameters.has('authSource')) parameters.set('authSource', 'admin')
  if (!parameters.has('replicaSet')) parameters.set('replicaSet', seedList.replicaSet)

  return `mongodb://${credentials}${seedList.hosts.join(',')}${path}?${parameters}`
}

function createClientPromise() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not configured')
  return new MongoClient(withoutSrvDiscovery(uri), {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    // Node's c-ares SRV resolver times out on some Windows networks even when
    // the system resolver works. Known Atlas clusters use their seed list above,
    // while system hostname lookup preserves the hostnames required for TLS.
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

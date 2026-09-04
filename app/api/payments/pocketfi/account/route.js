import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase } from '../../../../../lib/mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../../../lib/auth'
import { createPocketFiVirtualAccount } from '../../../../../lib/pocketfi'

export const runtime = 'nodejs'

function publicAccount(account) {
  if (!account?.accountNumber) return null
  return { bankName: String(account.bankName || ''), accountNumber: String(account.accountNumber), accountName: String(account.accountName || '') }
}

async function getAuthenticatedUser() {
  const store = await cookies()
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!session?.sub || !ObjectId.isValid(session.sub)) return null
  const database = await getDatabase()
  const user = await database.collection('users').findOne({ _id: new ObjectId(session.sub) })
  return user ? { database, user } : null
}

export async function GET() {
  const auth = await getAuthenticatedUser()
  if (!auth) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  return NextResponse.json({ account: publicAccount(auth.user.pocketfiVirtualAccount) })
}

export async function POST() {
  const auth = await getAuthenticatedUser()
  if (!auth) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  if (auth.user.pocketfiVirtualAccount?.accountNumber) return NextResponse.json({ account: publicAccount(auth.user.pocketfiVirtualAccount) })
  try {
    const account = await createPocketFiVirtualAccount({ name: auth.user.name, email: auth.user.email })
    await auth.database.collection('users').createIndex({ 'pocketfiVirtualAccount.accountNumber': 1 }, { unique: true, sparse: true })
    await auth.database.collection('users').updateOne({ _id: auth.user._id, 'pocketfiVirtualAccount.accountNumber': { $exists: false } }, { $set: { pocketfiVirtualAccount: account, updatedAt: new Date() } })
    return NextResponse.json({ account: publicAccount(account) }, { status: 201 })
  } catch (error) {
    console.error('[pocketfi/account]', { message: error.message })
    return NextResponse.json({ message: 'Your dedicated account is not available yet. Please try again shortly.' }, { status: 502 })
  }
}
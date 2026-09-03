import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { getDatabase } from '../../../../../lib/mongodb'
import { SESSION_COOKIE, verifySessionToken } from '../../../../../lib/auth'

export const runtime = 'nodejs'

export async function POST(request) {
  const store = await cookies()
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!session?.sub || !ObjectId.isValid(session.sub)) return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const amount = Number(body.amount)
  const phone = String(body.phone || '').replace(/[^0-9+]/g, '')
  if (!Number.isInteger(amount) || amount < 1000 || amount > 1000000) return NextResponse.json({ message: 'Enter an amount between ₦1,000 and ₦1,000,000' }, { status: 400 })
  if (!/^\+?[0-9]{10,15}$/.test(phone)) return NextResponse.json({ message: 'Enter a valid phone number' }, { status: 400 })

  const database = await getDatabase()
  const user = await database.collection('users').findOne({ _id: new ObjectId(session.sub) })
  if (!user) return NextResponse.json({ message: 'Account not found' }, { status: 404 })
  const names = String(user.name || 'LMS Customer').trim().split(/\s+/)
  const intentId = randomUUID()
  const origin = new URL(request.url).origin
  const providerResponse = await fetch(`${process.env.POCKETFI_BASE_URL}/checkout/request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.POCKETFI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ first_name: names[0], last_name: names.slice(1).join(' ') || 'Customer', phone, business_id: process.env.POCKETFI_MERCHANT_ID, email: user.email, redirect_link: `${origin}/api/payments/pocketfi/callback?intent=${intentId}`, amount: String(amount) }),
    signal: AbortSignal.timeout(20000),
  })
  const payload = await providerResponse.json().catch(() => ({}))
  if (!providerResponse.ok || payload.status !== 'success' || !payload.payment_id || !payload.payment_link) {
    console.error('[pocketfi/initialize]', { status: providerResponse.status, message: payload.message || 'Invalid response' })
    return NextResponse.json({ message: payload.message || 'Unable to start payment' }, { status: 502 })
  }
  const paymentUrl = new URL(payload.payment_link)
  if (paymentUrl.protocol !== 'https:' || !paymentUrl.hostname.endsWith('pocketfi.ng')) return NextResponse.json({ message: 'Invalid checkout response' }, { status: 502 })
  await database.collection('walletPayments').createIndex({ intentId: 1 }, { unique: true })
  await database.collection('walletPayments').createIndex({ providerPaymentId: 1 }, { unique: true })
  await database.collection('walletPayments').insertOne({ intentId, provider: 'pocketfi', providerPaymentId: String(payload.payment_id), userId: user._id, amountKobo: amount * 100, status: 'pending', createdAt: new Date(), updatedAt: new Date() })
  return NextResponse.json({ paymentLink: paymentUrl.toString() })
}

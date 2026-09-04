import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDatabase, getMongoClient } from '../../../../../lib/mongodb'

export const runtime = 'nodejs'

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8')
  const b = Buffer.from(String(right || ''), 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request) {
  const rawBody = await request.text()
  const signature = request.headers.get('http_pocketfi_signature') || request.headers.get('pocketfi-signature')
  const secret = process.env.POCKETFI_SECRET_KEY
  if (!secret || !signature) return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
  if (!safeEqual(signature, expected)) return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })

  let payload
  try { payload = JSON.parse(rawBody) } catch { return NextResponse.json({ message: 'Invalid payload' }, { status: 400 }) }
  const transaction = payload?.transaction || {}
  const order = payload?.order || {}
  const reference = String(transaction.reference || '')
  const paymentStatus = String(transaction.status || payload.status || payload.event || '').toLowerCase()
  if (!/(success|completed|paid)/.test(paymentStatus)) return NextResponse.json({ message: 'Event ignored' }, { status: 202 })
  const accountNumber = String(transaction.account || transaction.account_number || order.account || order.account_number || '')
  const amount = Number(order.amount)
  const amountKobo = Math.round(amount * 100)
  if (!reference || !/^\d{10}$/.test(accountNumber) || !Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    return NextResponse.json({ message: 'Unsupported payment payload' }, { status: 422 })
  }

  const database = await getDatabase()
  const user = await database.collection('users').findOne({ 'pocketfiVirtualAccount.accountNumber': accountNumber })
  if (!user) return NextResponse.json({ message: 'Account not found' }, { status: 404 })
  const payments = database.collection('walletPayments')
  await payments.createIndex({ provider: 1, providerPaymentId: 1 }, { unique: true })

  const client = await getMongoClient()
  const mongoSession = client.startSession()
  try {
    await mongoSession.withTransaction(async () => {
      const inserted = await payments.updateOne(
        { provider: 'pocketfi', providerPaymentId: reference },
        { $setOnInsert: { provider: 'pocketfi', providerPaymentId: reference, userId: user._id, accountNumber, amountKobo, status: 'completed', createdAt: new Date(), updatedAt: new Date() } },
        { upsert: true, session: mongoSession },
      )
      if (!inserted.upsertedCount) return
      await database.collection('users').updateOne(
        { _id: user._id },
        { $inc: { balanceKobo: amountKobo }, $set: { balanceCurrency: 'NGN', updatedAt: new Date() } },
        { session: mongoSession },
      )
    })
  } finally {
    await mongoSession.endSession()
  }
  return NextResponse.json({ message: 'success' })
}

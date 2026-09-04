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
  const signature = request.headers.get('http_pocketfi_signature')
    || request.headers.get('pocketfi-signature')
    || request.headers.get('x-pocketfi-signature')
  const secret = process.env.POCKETFI_SECRET_KEY
  if (!secret) {
    console.error('[pocketfi/webhook] rejected', { reason: 'secret_missing' })
    return NextResponse.json({ message: 'Webhook is not configured' }, { status: 500 })
  }
  if (!signature) {
    console.warn('[pocketfi/webhook] rejected', { reason: 'signature_missing', bodyBytes: Buffer.byteLength(rawBody) })
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
  }
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
  const supplied = signature.trim().replace(/^sha512=/i, '')
  if (!safeEqual(supplied, expected)) {
    console.warn('[pocketfi/webhook] rejected', { reason: 'signature_mismatch', signatureLength: supplied.length, expectedLength: expected.length, bodyBytes: Buffer.byteLength(rawBody) })
    return NextResponse.json({ message: 'Invalid signature' }, { status: 400 })
  }

  let payload
  try { payload = JSON.parse(rawBody) } catch {
    console.warn('[pocketfi/webhook] rejected', { reason: 'invalid_json', bodyBytes: Buffer.byteLength(rawBody) })
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 })
  }
  const transaction = payload?.transaction || {}
  const order = payload?.order || {}
  const reference = String(transaction.reference || '')
  const paymentStatus = String(transaction.status || payload.status || payload.event || '').toLowerCase()
  if (paymentStatus && !/(success|completed|paid)/.test(paymentStatus)) return NextResponse.json({ message: 'Event ignored' }, { status: 202 })
  const accountNumber = String(payload.account_number || transaction.account || transaction.account_number || order.account || order.account_number || '')
  const amount = Number(order.amount)
  const amountKobo = Math.round(amount * 100)
  if (!reference || !/^\d{10}$/.test(accountNumber) || !Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    console.warn('[pocketfi/webhook] rejected', { reason: 'unsupported_payload', hasReference: Boolean(reference), accountNumberLength: accountNumber.length, validAmount: Number.isSafeInteger(amountKobo) && amountKobo > 0 })
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

import { NextResponse } from 'next/server'
import { getDatabase, getMongoClient } from '../../../../../lib/mongodb'

export const runtime = 'nodejs'

const redirectToDashboard = (request, status) => NextResponse.redirect(new URL(`/?funding=${status}#account`, request.url))

export async function GET(request) {
  const intentId = new URL(request.url).searchParams.get('intent')
  if (!intentId) return redirectToDashboard(request, 'failed')
  const database = await getDatabase()
  const payment = await database.collection('walletPayments').findOne({ intentId, provider: 'pocketfi' })
  if (!payment) return redirectToDashboard(request, 'failed')
  if (payment.status === 'completed') return redirectToDashboard(request, 'success')

  const providerResponse = await fetch(`${process.env.POCKETFI_BASE_URL}/checkout/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.POCKETFI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: payment.providerPaymentId }),
    signal: AbortSignal.timeout(20000),
  })
  const payload = await providerResponse.json().catch(() => ({}))
  const paidStatuses = new Set(['success', 'successful', 'paid', 'completed'])
  const verifiedAmountKobo = Math.round(Number(payload.amount) * 100)
  if (!providerResponse.ok || !paidStatuses.has(String(payload.status).toLowerCase()) || String(payload.payment_id) !== payment.providerPaymentId || verifiedAmountKobo !== payment.amountKobo) {
    await database.collection('walletPayments').updateOne({ _id: payment._id, status: 'pending' }, { $set: { lastProviderStatus: String(payload.status || 'unknown'), updatedAt: new Date() } })
    return redirectToDashboard(request, String(payload.status).toLowerCase() === 'pending' ? 'pending' : 'failed')
  }

  const client = await getMongoClient()
  const mongoSession = client.startSession()
  try {
    await mongoSession.withTransaction(async () => {
      const claimed = await database.collection('walletPayments').findOneAndUpdate({ _id: payment._id, status: 'pending' }, { $set: { status: 'completed', verifiedAt: new Date(), updatedAt: new Date(), providerResponse: { status: payload.status, paymentId: payload.payment_id, amount: payload.amount } } }, { returnDocument: 'after', session: mongoSession })
      if (!claimed) return
      await database.collection('users').updateOne({ _id: payment.userId }, { $inc: { balanceKobo: payment.amountKobo }, $set: { balanceCurrency: 'NGN', updatedAt: new Date() } }, { session: mongoSession })
    })
  } finally { await mongoSession.endSession() }
  return redirectToDashboard(request, 'success')
}

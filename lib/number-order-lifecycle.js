import { randomUUID } from 'node:crypto'
import { readNumberStatus, cancelProviderNumber } from './number-provider.js'

export const NUMBER_CANCEL_DELAY_MS = 120000
const LIVE = ['active', 'cancel_pending', 'cancel_confirmed']

export function publicNumberOrder(order) {
  const reservedAt = order.reservedAt || order.createdAt
  return {
    _id: String(order._id), requestId: order.requestId, phoneNumber: order.phoneNumber || '',
    activationId: order.activationId || '', countryId: order.countryId, countryCode: order.countryCode,
    countryName: order.countryName || '', serviceCode: order.serviceCode, serviceName: order.serviceName || order.serviceCode,
    status: order.status, smsCode: order.smsCode || '', sellingPriceKobo: order.sellingPriceKobo,
    serverId: order.serverId, quality: order.quality || 'standard', createdAt: order.createdAt,
    updatedAt: order.updatedAt, refundedAt: order.refundedAt || null,
    cancelAvailableAt: new Date(new Date(reservedAt).getTime() + NUMBER_CANCEL_DELAY_MS).toISOString(),
    canCancel: LIVE.includes(order.status) && !order.smsCode,
    statusMessage: order.statusMessage || '',
  }
}

// A database lease serializes polling/cancel across tabs and server instances.
// Every write is fenced by its token so an expired operation cannot change funds.
export async function syncNumberOrder({ database, client, orderId, userId, cancel = false, provider = { readNumberStatus, cancelProviderNumber } }) {
  const orders = database.collection('numberOrders')
  const token = randomUUID()
  const now = new Date()
  const order = await orders.findOneAndUpdate({
    _id: orderId, userId, activationId: { $exists: true }, status: { $in: LIVE },
    $and: [
      { $or: [{ syncLeaseUntil: { $exists: false } }, { syncLeaseUntil: { $lte: now } }] },
      ...(cancel ? [] : [{ $or: [{ nextStatusCheckAt: { $exists: false } }, { nextStatusCheckAt: { $lte: now } }] }]),
    ],
  }, { $set: { syncToken: token, syncLeaseUntil: new Date(Date.now() + 90000) } }, { returnDocument: 'after' })
  if (!order) return { busy: true }
  const fenced = { _id: orderId, userId, syncToken: token, status: { $in: LIVE } }

  async function saveCode(state) {
    await orders.updateOne(fenced, { $set: { smsCode: state.smsCode, status: 'completed', smsReceivedAt: new Date(), updatedAt: new Date(), statusMessage: '' } })
  }
  async function refund() {
    // Persist provider confirmation first; a later poll can finish the refund
    // if the transaction or process fails between these two operations.
    await orders.updateOne({ ...fenced, smsCode: { $in: [null, ''] } }, { $set: { status: 'cancel_confirmed', cancellationConfirmedAt: new Date() } })
    const session = client.startSession()
    try {
      await session.withTransaction(async () => {
        const result = await orders.updateOne({ ...fenced, status: 'cancel_confirmed', smsCode: { $in: [null, ''] }, refundedAt: { $exists: false } }, {
          $set: { status: 'refunded', refundedAt: new Date(), updatedAt: new Date(), statusMessage: '' },
        }, { session })
        if (result.modifiedCount === 1) {
          const credit = await database.collection('users').updateOne({ _id: userId }, { $inc: { balanceKobo: order.sellingPriceKobo }, $set: { updatedAt: new Date() } }, { session })
          if (credit.matchedCount !== 1) throw new Error('Refund recipient missing')
          await database.collection('numberRefunds').insertOne({ _id: orderId, userId, amountKobo: order.sellingPriceKobo, reason: 'provider_confirmed_cancellation', createdAt: new Date() }, { session })
        }
      })
    } finally { await session.endSession() }
  }

  try {
    if (order.smsCode) { await saveCode({ smsCode: order.smsCode }); return {} }
    if (order.status === 'cancel_confirmed') { await refund(); return {} }
    let state = await provider.readNumberStatus(order.activationId)
    if (state.status === 'completed') { await saveCode(state); return { message: cancel ? 'An SMS has arrived. This number can no longer be refunded.' : '' } }
    if (state.status === 'canceled') { await refund(); return {} }
    if (cancel) {
      const cancelAt = new Date(order.reservedAt || order.createdAt).getTime() + NUMBER_CANCEL_DELAY_MS
      if (Date.now() < cancelAt) return { message: 'Cancellation becomes available two minutes after purchase.' }
      const claimed = await orders.updateOne(fenced, { $set: { status: 'cancel_pending', updatedAt: new Date() } })
      if (claimed.matchedCount !== 1) return { busy: true }
      try {
        await provider.cancelProviderNumber(order.activationId)
      } catch (error) {
        // Code delivery may win the race at the provider. Re-read instead of
        // treating a rejected or timed-out cancel request as a refund.
        state = await provider.readNumberStatus(order.activationId)
        if (state.status === 'completed') { await saveCode(state); return { message: 'An SMS has arrived. This number can no longer be refunded.' } }
        if (state.status === 'canceled') { await refund(); return {} }
        throw error
      }
      await refund()
    }
    return {}
  } catch (error) {
    const message = error.code === 'EARLY_CANCEL_DENIED' ? 'The provider needs a little more time before cancellation. Please try again shortly.'
      : error.code === 'NO_ACTIVATION' ? 'The provider cannot find this activation. Contact support with the order reference; no refund has been confirmed.'
        : 'We could not confirm the latest status. Your order is saved; please check again shortly.'
    await orders.updateOne(fenced, { $set: { statusMessage: message } })
    return { message }
  } finally {
    await orders.updateOne({ _id: orderId, syncToken: token }, { $unset: { syncToken: '', syncLeaseUntil: '' }, $set: { nextStatusCheckAt: new Date(Date.now() + 5000) } })
  }
}

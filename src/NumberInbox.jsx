import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, LoaderCircle, MessageSquareText, RefreshCw } from 'lucide-react'

const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(Number(kobo || 0) / 100)
const labels = { active: 'Waiting for SMS', completed: 'Code received', refunded: 'Refunded', cancel_pending: 'Cancellation pending', cancel_confirmed: 'Refund processing', submission_review: 'Awaiting confirmation', debit_reserved: 'Reserving your number' }

export function displayPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  return digits ? '+' + digits : 'Confirming your number…'
}

export default function NumberInbox({ refreshKey }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')
  const [copied, setCopied] = useState('')
  const [now, setNow] = useState(Date.now())
  const [showAll, setShowAll] = useState(false)
  const responseVersion = useRef(0)
  const cancelBusy = useRef(false)

  const loadOrders = useCallback(async (signal) => {
    if (cancelBusy.current) return
    const version = ++responseVersion.current
    try {
      const response = await fetch('/api/number-orders', { cache: 'no-store', signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Unable to load your numbers')
      if (version !== responseVersion.current || signal?.aborted) return
      setOrders(payload.orders || [])
      setError('')
      if (typeof payload.balance === 'number') window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
    } catch (err) {
      if (err.name !== 'AbortError' && version === responseVersion.current) setError(err.message || 'Unable to refresh your numbers. Try again shortly.')
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let timer
    async function poll() {
      if (!document.hidden) await loadOrders(controller.signal)
      if (!controller.signal.aborted) timer = window.setTimeout(poll, 5000)
    }
    poll()
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { controller.abort(); window.clearTimeout(timer); window.clearInterval(clock) }
  }, [loadOrders, refreshKey])

  async function copy(value, key) {
    try { await navigator.clipboard.writeText(value); setCopied(key) }
    catch { setMessage('Copy is unavailable in this browser. Select and copy the number or code below.') }
  }

  async function cancelOrder(order) {
    if (cancelBusy.current) return
    cancelBusy.current = true
    ++responseVersion.current
    setBusyId(order._id)
    setMessage('')
    try {
      const response = await fetch('/api/number-orders', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order._id, action: 'cancel' }),
      })
      const payload = await response.json()
      if (payload.order) setOrders((current) => current.map((item) => item._id === payload.order._id ? payload.order : item))
      if (typeof payload.balance === 'number') window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
      if (!response.ok) throw new Error(payload.message || 'Unable to cancel this number')
      setMessage(payload.message)
    } catch (err) { setMessage(err.message || 'Cancellation could not be confirmed. Check the order status before trying again.') }
    finally { cancelBusy.current = false; setBusyId(''); await loadOrders() }
  }

  const active = orders.filter((order) => !['completed', 'refunded'].includes(order.status))
  const past = orders.filter((order) => ['completed', 'refunded'].includes(order.status))
  const visible = [...active, ...(showAll ? past : past.slice(0, 10))]

  return <section className='number-inbox' aria-labelledby='number-inbox-title'>
    <header><div><span>YOUR NUMBERS</span><h3 id='number-inbox-title'>Numbers & SMS codes</h3><p>Your orders stay here when you refresh. SMS status updates automatically.</p></div><button type='button' onClick={() => loadOrders()} disabled={Boolean(busyId)} aria-label='Refresh number status'><RefreshCw /> Refresh</button></header>
    {loading && <p role='status'><LoaderCircle className='spin' /> Loading your numbers…</p>}
    {error && <p className='number-notice error' role='alert'>{error}</p>}
    {message && <p className='number-notice' role='status'>{message}</p>}
    {!loading && !orders.length && !error && <div className='number-inbox-empty'><MessageSquareText /><p>Your purchased number and its SMS code will appear here.</p></div>}
    <div className='number-inbox-list'>{visible.map((order) => {
      const seconds = Math.max(0, Math.ceil((new Date(order.cancelAvailableAt).getTime() - now) / 1000))
      const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
      const phone = '+' + String(order.phoneNumber).replace(/\D/g, '')
      return <article key={order._id} className={'number-receipt ' + order.status}>
        <div className='number-receipt-heading'><strong>{order.serviceName || order.serviceCode} {order.countryName && <small> · {order.countryName}</small>}</strong><span>{labels[order.status] || 'Checking status'}</span></div>
        <div className='number-receipt-value'><div><small>Your number</small><strong>{displayPhone(order.phoneNumber)}</strong></div>{order.phoneNumber && <button type='button' aria-label={`Copy number ${displayPhone(order.phoneNumber)}`} onClick={() => copy(phone, order._id + '-phone')}>{copied === order._id + '-phone' ? <Check /> : <Copy />} Copy number</button>}</div>
        <div className={'number-sms-box ' + (order.smsCode ? 'received' : '')}><div><small>SMS code</small><strong>{order.smsCode || (order.status === 'refunded' ? 'Canceled — no code received' : 'Waiting for code…')}</strong></div>{order.smsCode && <button type='button' onClick={() => copy(order.smsCode, order._id + '-code')}>{copied === order._id + '-code' ? <Check /> : <Copy />} Copy code</button>}</div>
        {order.statusMessage && <p className='number-notice'>{order.statusMessage}</p>}
        {order.status === 'submission_review' && <p>Your reservation is awaiting confirmation. Contact support using the reference under Order details.</p>}
        {order.canCancel && <div className='number-cancel-row'><p>{seconds > 0 ? `Cancellation available in ${countdown}.` : 'No SMS yet? Cancel for a full wallet refund once cancellation is confirmed.'}</p><button type='button' disabled={seconds > 0 || Boolean(busyId)} onClick={() => cancelOrder(order)}>{busyId === order._id ? <><LoaderCircle className='spin' /> Checking…</> : 'Cancel & refund'}</button></div>}
        {order.status === 'refunded' && <p className='number-refund-note'>{money(order.sellingPriceKobo)} returned to your wallet.</p>}
        <details><summary>Order details</summary><dl><div><dt>Order reference</dt><dd>{order._id}</dd></div>{order.activationId && <div><dt>Support activation ID</dt><dd>{order.activationId}</dd></div>}<div><dt>Paid</dt><dd>{money(order.sellingPriceKobo)}</dd></div><div><dt>Purchased</dt><dd>{new Date(order.createdAt).toLocaleString()}</dd></div></dl></details>
      </article>
    })}</div>
    {past.length > 10 && <button className='number-history-toggle' type='button' onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show fewer past orders' : 'Show all recent orders'}</button>}
  </section>
}

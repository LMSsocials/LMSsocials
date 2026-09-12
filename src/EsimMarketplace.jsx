import React, { useEffect, useState } from 'react'
import { Check, Clock3, LoaderCircle, MessageCircle, ShieldCheck, ShoppingBag, Wifi } from 'lucide-react'

const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(kobo || 0) / 100)
const requestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function EsimMarketplace() {
  const [plans, setPlans] = useState([])
  const [orders, setOrders] = useState([])
  const [state, setState] = useState('loading')
  const [buying, setBuying] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setState('loading')
    try {
      const [plansResponse, ordersResponse] = await Promise.all([fetch('/api/esim-plans'), fetch('/api/esim-orders')])
      const plansPayload = await plansResponse.json().catch(() => ({}))
      const ordersPayload = await ordersResponse.json().catch(() => ({}))
      if (!plansResponse.ok) throw new Error(plansPayload.message || 'Unable to load eSIM plans')
      if (!ordersResponse.ok) throw new Error(ordersPayload.message || 'Unable to load eSIM orders')
      setPlans(plansPayload.plans || [])
      setOrders(ordersPayload.orders || [])
      setState('ready')
    } catch (error) {
      setMessage(error.message)
      setState('error')
    }
  }

  useEffect(() => { load() }, [])

  async function purchase(plan) {
    if (!plan.priceKobo || buying) return
    if (!window.confirm(`Buy the ${plan.name} eSIM plan for ${money(plan.priceKobo)}? Your wallet will be debited immediately.`)) return
    setBuying(plan.id)
    setMessage('')
    try {
      const response = await fetch('/api/esim-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, requestId: requestId() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Purchase failed')
      setOrders((current) => [payload.order, ...current])
      window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
      setMessage('Payment complete. Use the WhatsApp button below to request your eSIM code.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBuying('')
    }
  }

  return <section className='logs-market esim-market'>
    <header className='logs-head'>
      <div><span>eSIM PLANS</span><h2>Stay connected for longer.</h2><p>Choose a duration and pay securely from your wallet. After payment, contact the admin on WhatsApp to receive your eSIM code.</p></div>
      <div className='voucher-trust'><ShieldCheck /><span><strong>Purchase protected</strong><small>Contact unlocks after payment</small></span></div>
    </header>

    {message && <div className='voucher-message'>{message}</div>}
    {state === 'loading' ? <div className='logs-empty'><LoaderCircle className='spin' /><strong>Loading eSIM plans</strong></div> : <div className='esim-plan-grid'>
      {plans.map((plan, index) => <article key={plan.id} className={index === 1 ? 'featured' : ''}>
        <div className='esim-plan-icon'><Wifi /></div>
        <span>{index === 1 ? 'MOST POPULAR' : 'FLEXIBLE ACCESS'}</span>
        <h3>{plan.name}</h3>
        <p>{plan.description}</p>
        <strong>{plan.priceKobo ? money(plan.priceKobo) : 'Coming soon'}</strong>
        <button type='button' disabled={!plan.priceKobo || Boolean(buying)} onClick={() => purchase(plan)}>
          {buying === plan.id ? <LoaderCircle className='spin' /> : <ShoppingBag />}
          {plan.priceKobo ? 'Purchase plan' : 'Price not set'}
        </button>
      </article>)}
    </div>}

    {orders.length > 0 && <section className='esim-orders'>
      <div className='dash-section-title'><div><span>PAID ORDERS</span><h2>Request your eSIM code</h2></div><small>{orders.length}</small></div>
      <div>{orders.map((order) => <article key={order._id}>
        <i><Check /></i>
        <span><strong>{order.planName} eSIM</strong><small>{money(order.priceKobo)} · {new Date(order.createdAt).toLocaleDateString()} · Ref {order._id.slice(-8).toUpperCase()}</small></span>
        {order.contactUrl ? <a href={order.contactUrl} target='_blank' rel='noreferrer'><MessageCircle /> Message admin</a> : <em><Clock3 /> Support unavailable</em>}
      </article>)}</div>
    </section>}
  </section>
}

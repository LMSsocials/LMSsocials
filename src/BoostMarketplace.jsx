import React, { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeBoostingTarget, parseBoostingQuantity, validateBoostingInput } from '../lib/boosting-validation.js'
import './boost-validation.css'
import {
  AlertCircle, ArrowRight, CheckCircle2, Facebook, Ghost, Hash, Instagram, Link2, Linkedin,
  LayoutGrid, LoaderCircle, MessageCircle, Music2, Pin, Search, Send, ShoppingBag, Twitch, Youtube,
} from 'lucide-react'

const platformMeta = {
  All: { icon: LayoutGrid, tone: 'all' },
  Instagram: { icon: Instagram, tone: 'instagram' },
  TikTok: { icon: Music2, tone: 'tiktok' },
  YouTube: { icon: Youtube, tone: 'youtube' },
  'X (Twitter)': { icon: MessageCircle, tone: 'twitter' },
  Facebook: { icon: Facebook, tone: 'facebook' },
  LinkedIn: { icon: Linkedin, tone: 'linkedin' },
  Snapchat: { icon: Ghost, tone: 'snapchat' },
  Telegram: { icon: Send, tone: 'telegram' },
  Twitch: { icon: Twitch, tone: 'twitch' },
  Pinterest: { icon: Pin, tone: 'pinterest' },
  More: { icon: ArrowRight, tone: 'more' },
}
const platformOrder = Object.keys(platformMeta)
const money = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)

export default function BoostMarketplace() {
  const [services, setServices] = useState([])
  const [status, setStatus] = useState('loading')
  const [selectedPlatform, setSelectedPlatform] = useState('All')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [serviceId, setServiceId] = useState('')
  const [target, setTarget] = useState('')
  const [quantity, setQuantity] = useState('')
  const [purchaseState, setPurchaseState] = useState('idle')
  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [submittedOrder, setSubmittedOrder] = useState(null)
  const [purchaseRequestId, setPurchaseRequestId] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [pendingPurchase, setPendingPurchase] = useState(null)
  const purchaseBusy = useRef(false)
  const formLocked = purchaseState === 'submitting' || Boolean(pendingPurchase)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/boosting-services', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Catalogue unavailable')
        return response.json()
      })
      .then((payload) => {
        setServices(payload.services || [])
        setStatus('ready')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error')
      })
    return () => controller.abort()
  }, [])

  const groups = useMemo(() => platformOrder.map((name) => ({
    name,
    count: name === 'All' ? services.length : services.filter((service) => service.platform === name).length,
    ...platformMeta[name],
  })).filter((group) => group.count > 0 || status === 'loading'), [services, status])

  const platformServices = selectedPlatform === 'All' ? services : services.filter((service) => service.platform === selectedPlatform)
  const categories = useMemo(() => ['All', ...new Set(platformServices.map((service) => service.category))], [platformServices])
  const matchingServices = platformServices.filter((service) => {
    const search = query.trim().toLowerCase()
    return (category === 'All' || service.category === category)
      && (!search || service.name.toLowerCase().includes(search) || service.category.toLowerCase().includes(search))
  }).sort((first, second) => first.pricePerThousand - second.pricePerThousand)
  const selectedService = services.find((service) => service.id === serviceId)
  const parsedQuantity = parseBoostingQuantity(quantity)
  const estimatedPrice = selectedService && parsedQuantity ? selectedService.pricePerThousand * parsedQuantity / 1000 : 0

  const choosePlatform = (name) => {
    if (formLocked || purchaseBusy.current) return
    setSelectedPlatform(name)
    setQuery('')
    setCategory('All')
    setServiceId('')
    setTarget('')
    setQuantity('')
    setPurchaseState('idle')
    setPurchaseMessage('')
    setSubmittedOrder(null)
    setPurchaseRequestId('')
    setFieldErrors({})
  }

  const chooseService = (id) => {
    if (formLocked || purchaseBusy.current) return
    setServiceId(id)
    const service = services.find((item) => item.id === id)
    setQuantity(service ? String(service.min || 1) : '')
    setPurchaseState('idle')
    setPurchaseMessage('')
    setSubmittedOrder(null)
    setPurchaseRequestId('')
    setFieldErrors({})
  }

  function editOrder(change) {
    if (formLocked || purchaseBusy.current) return
    change()
    setPurchaseState('idle'); setPurchaseMessage(''); setSubmittedOrder(null); setPurchaseRequestId(''); setFieldErrors({})
  }

  async function placeOrder() {
    if (purchaseBusy.current) return
    const requestId = purchaseRequestId || crypto.randomUUID()
    const validation = validateBoostingInput({ serviceId: selectedService?.id, target, quantity, requestId }, selectedService)
    if (!pendingPurchase && !validation.valid) {
      setFieldErrors(validation.fieldErrors)
      setPurchaseState('error')
      setPurchaseMessage(Object.values(validation.fieldErrors)[0])
      const firstField = Object.keys(validation.fieldErrors)[0]
      document.getElementById('boost-' + firstField)?.focus()
      return
    }
    purchaseBusy.current = true
    setPurchaseState('submitting')
    setPurchaseMessage('Submitting your order…')
    setFieldErrors({})
    setPurchaseRequestId(requestId)
    const purchase = pendingPurchase || validation.value
    setPendingPurchase(purchase)
    try {
      const response = await fetch('/api/boosting-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchase),
      })
      const payload = await response.json().catch(() => ({}))
      if (typeof payload.balance === 'number') window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
      if (!response.ok) {
        if (payload.retrySafe || [400, 401, 403].includes(response.status)) { setPurchaseRequestId(''); setPendingPurchase(null) }
        if (payload.fieldErrors) setFieldErrors(payload.fieldErrors)
        throw new Error(payload.message || 'Unable to place this boosting order')
      }
      if (!payload.order) throw new Error('We could not confirm the response. Use Check order to check this same purchase.')
      setPendingPurchase(null)
      setSubmittedOrder(payload.order || null)
      setPurchaseState(payload.order.status === 'refunded' ? 'error' : payload.pendingReview ? 'review' : 'success')
      setPurchaseMessage(payload.message || 'Order submitted successfully. You can follow its status on your dashboard.')
      if (payload.order.status === 'refunded') setPurchaseRequestId('')
    } catch (error) {
      setPurchaseState('error')
      setPurchaseMessage(error.message || 'Unable to place this boosting order')
    } finally { purchaseBusy.current = false }
  }

  return (
    <section className='boost-market'>
      <header className='boost-market-head'>
        <span>BOOST ACCOUNT</span>
        <h2>Choose a social service</h2>
        <p>Select a platform, then complete your order below.</p>
      </header>

      {status === 'loading' && <div className='boost-loading'><LoaderCircle /><strong>Syncing live services</strong><span>This will only take a moment.</span></div>}
      {status === 'error' && <div className='boost-loading error'><strong>We could not load the live catalogue.</strong><span>Please refresh the page and try again.</span></div>}

      {status === 'ready' && <div className='boost-platform-grid'>
        {groups.map(({ name, count, icon: Icon, tone }) => (
          <button key={name} disabled={formLocked} className={tone + (selectedPlatform === name ? ' active' : '')} onClick={() => choosePlatform(name)}>
            <i><Icon /></i><strong>{name}</strong><span>{count.toLocaleString()} services</span>
          </button>
        ))}
      </div>}

      {status === 'ready' && <>
        <section className='boost-order-form'>
          <label className='boost-search-field'>
            <Search />
            <input disabled={formLocked} value={query} onChange={(event) => editOrder(() => { setQuery(event.target.value); setServiceId('') })} placeholder='Search services...' />
          </label>
          <label className='boost-select-field'>
            <span>Category</span>
            <select disabled={formLocked} value={category} onChange={(event) => editOrder(() => { setCategory(event.target.value); setServiceId('') })}>
              {categories.map((item) => <option key={item} value={item}>{item === 'All' ? 'All categories' : item}</option>)}
            </select>
          </label>
          <label className='boost-select-field'>
            <span>Service</span>
            <select id='boost-serviceId' disabled={formLocked} value={serviceId} onChange={(event) => chooseService(event.target.value)}>
              <option value=''>Choose a service...</option>
              {matchingServices.map((service) => <option key={service.id} value={service.id}>{service.name} — {money(service.pricePerThousand)} / 1k</option>)}
            </select>
            <small>{matchingServices.length.toLocaleString()} services available</small>
          </label>
          {selectedService && <div className='boost-order-details'>
            <div className='boost-selected-service'>
              <span>{selectedService.category}</span>
              <strong>{selectedService.name}</strong>
              <small>{selectedService.type} · Min {selectedService.min.toLocaleString()} · Max {selectedService.max.toLocaleString()}</small>
            </div>
            <div className='boost-order-inputs'>
              <label><span><Link2 /> Target link</span><input id='boost-target' disabled={formLocked} type='text' inputMode='url' autoCapitalize='none' autoCorrect='off' value={target} onChange={(event) => editOrder(() => setTarget(event.target.value))} onBlur={() => { if (!formLocked) { const normalized = normalizeBoostingTarget(target); if (normalized) setTarget(normalized) } }} placeholder='instagram.com/yourname or a post link' aria-invalid={Boolean(fieldErrors.target)} aria-describedby='boost-target-help' /><small id='boost-target-help' className={fieldErrors.target ? 'boost-field-error' : 'boost-field-help'}>{fieldErrors.target || 'Paste the profile, post, or video link required by your service. We add https:// when needed.'}</small></label>
              <label><span><Hash /> Quantity</span><input id='boost-quantity' disabled={formLocked} type='text' inputMode='numeric' value={quantity} onChange={(event) => editOrder(() => setQuantity(event.target.value))} placeholder='1,000' aria-invalid={Boolean(fieldErrors.quantity)} aria-describedby='boost-quantity-help' /><small id='boost-quantity-help' className={fieldErrors.quantity ? 'boost-field-error' : 'boost-field-help'}>{fieldErrors.quantity || `${selectedService.min.toLocaleString()}–${selectedService.max.toLocaleString()}. Use a whole number, for example 1,000.`}</small></label>
            </div>
            <div className='boost-order-summary'>
              <div><small>Estimated total</small><strong>{money(estimatedPrice)}</strong></div>
              <button onClick={placeOrder} disabled={['submitting', 'success', 'review'].includes(purchaseState)}>
                {purchaseState === 'submitting' ? <LoaderCircle className='spin' /> : <ShoppingBag />}{purchaseState === 'submitting' ? 'Submitting...' : purchaseState === 'success' ? 'Order placed' : purchaseState === 'review' ? 'Awaiting confirmation' : pendingPurchase ? 'Check order' : 'Continue'}
              </button>
            </div>
            {pendingPurchase && purchaseState === 'error' && <p className='boost-field-help'>Your purchase may still be processing. Use Check order to check this same request before starting another order.</p>}
            {purchaseState !== 'idle' && <div className={'boost-purchase-message ' + purchaseState} role='status'>
              {purchaseState === 'error' ? <AlertCircle /> : <CheckCircle2 />}<span>{purchaseMessage}</span>
              {submittedOrder?.providerOrderId && <small>API order ID: {submittedOrder.providerOrderId}</small>}
            </div>}
          </div>}
        </section>
      </>}
    </section>
  )
}

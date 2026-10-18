import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, BadgeCheck, Copy, CircleUserRound, LayoutGrid, LoaderCircle, Minus, PackageOpen, Plus, Search, Send, ShoppingBag, X } from 'lucide-react'
import SocialIcon from './SocialIcon'
import logoImage from '../public/assets/lms-logo-clean.png'
import editorialRed from '../public/assets/logs-editorial-red-v2.png'
import editorialLight from '../public/assets/logs-editorial-light-v2.png'

const carouselSlides = [
  {
    image: editorialRed,
    theme: 'red',
    eyebrow: 'LMS LOGS · VERSION 1.5',
    title: <>Premium logs.<br />Ready when you are.</>,
    description: 'Quality social accounts, simple checkout and instant delivery—all in one place.',
    cta: 'Browse the collection',
  },
  {
    image: editorialLight,
    theme: 'light',
    eyebrow: 'CUSTOMER CARE · ALWAYS CLOSE',
    title: <>Real support.<br />Right when you need it.</>,
    description: 'Questions before or after your order? Talk directly with LMS customer care on Telegram.',
    cta: 'Chat on Telegram',
    href: 'https://t.me/lurdmorrestsupport',
  },
]

const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(kobo || 0) / 100)
const requestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
function subsectionFor(product) {
  const text = `${product.title} ${product.description}`.toLowerCase()
  if (product.category === 'Facebook') {
    if (text.includes('create already') || text.includes('page create already')) return 'Page ready'
    if (text.includes('created yourself') || text.includes('create page yourself')) return 'Create your own page'
    if (text.includes('page')) return 'With page'
  }
  if (text.includes('follower')) return 'With followers'
  if (text.includes('2fa')) return 'With 2FA'
  if (text.includes('email access') || text.includes('with email')) return 'Email access'
  if (text.includes('aged') || text.includes('age:')) return 'Aged accounts'
  return 'Standard'
}

function categoryLabel(item) {
  if (item === 'All') return 'All available logs'
  if (item === 'Proxy') return 'Mobile Proxies'
  if (item === 'Google Voice') return 'Google Voice Accounts'
  if (/accounts?|proxies/i.test(item)) return item
  return `${item} Accounts`
}

export default function LogsMarketplace() {
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [state, setState] = useState('loading')
  const [buying, setBuying] = useState('')
  const [message, setMessage] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [checkoutError, setCheckoutError] = useState('')
  const [completedOrder, setCompletedOrder] = useState(null)
  const [deliveryCopied, setDeliveryCopied] = useState(false)
  const [directoryOpen, setDirectoryOpen] = useState(true)
  const [activeSlide, setActiveSlide] = useState(0)
  const [carouselPaused, setCarouselPaused] = useState(false)

  const load = async () => {
    setState('loading')
    try {
      const [productsResponse, ordersResponse] = await Promise.all([fetch('/api/voucher-products'), fetch('/api/voucher-orders')])
      const productsPayload = await productsResponse.json()
      const ordersPayload = await ordersResponse.json()
      if (!productsResponse.ok) throw new Error(productsPayload.message || 'Unable to load logs')
      if (!ordersResponse.ok) throw new Error(ordersPayload.message || 'Unable to load orders')
      setProducts(productsPayload.products || [])
      setOrders(ordersPayload.orders || [])
      setState('ready')
    } catch (error) {
      setMessage(error.message)
      setState('error')
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (carouselPaused) return undefined
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % carouselSlides.length), 6500)
    return () => window.clearInterval(timer)
  }, [carouselPaused])

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort()], [products])
  const visibleProducts = products.filter((product) => {
    const search = query.trim().toLowerCase()
    const matchesSearch = !search || `${product.title} ${product.brand} ${product.description}`.toLowerCase().includes(search)
    const matchesCategory = category === 'All' || product.category === category
    return matchesSearch && matchesCategory
  }).sort((first, second) => {
    const manualFirst = Number(second.source === 'managed') - Number(first.source === 'managed')
    return manualFirst || Number(first.priceKobo) - Number(second.priceKobo) || first.title.localeCompare(second.title)
  })
  const productSections = useMemo(() => {
    if (category === 'All') return [{ label: '', products: visibleProducts }]
    const grouped = new Map()
    visibleProducts.forEach((product) => {
      const label = subsectionFor(product)
      grouped.set(label, [...(grouped.get(label) || []), product])
    })
    return Array.from(grouped, ([label, sectionProducts]) => ({ label, products: sectionProducts })).sort((a, b) => a.label.localeCompare(b.label))
  }, [category, visibleProducts])
  const browsingProducts = !directoryOpen || Boolean(query.trim())

  const pendingOrderId = completedOrder?.status === 'processing' && !completedOrder.code ? completedOrder._id : ''
  useEffect(() => {
    if (!pendingOrderId) return undefined
    let cancelled = false
    const refreshDelivery = async () => {
      try {
        const response = await fetch('/api/voucher-orders')
        const payload = await response.json()
        if (!response.ok || cancelled) return
        const refreshedOrder = (payload.orders || []).find((order) => order._id === pendingOrderId)
        if (!refreshedOrder) return
        setOrders(payload.orders)
        if (refreshedOrder.code) setCompletedOrder(refreshedOrder)
      } catch { /* The next automatic refresh will retry. */ }
    }
    refreshDelivery()
    const timer = window.setInterval(refreshDelivery, 4000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [pendingOrderId])

  function openCheckout(product) {
    if (!product.stockCount || buying) return
    setSelectedProduct(product)
    setQuantity(1)
    setCheckoutError('')
    setCompletedOrder(null)
    setDeliveryCopied(false)
  }

  function closeCheckout() {
    if (buying) return
    setSelectedProduct(null)
    setCheckoutError('')
    setCompletedOrder(null)
    setDeliveryCopied(false)
  }

  async function purchase(product, purchaseQuantity) {
    if (!product.stockCount || buying) return
    setBuying(product._id)
    setMessage('')
    setCheckoutError('')
    try {
      const response = await fetch('/api/voucher-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product._id, quantity: purchaseQuantity, requestId: requestId() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Purchase failed')
      setOrders((current) => [payload.order, ...current])
      setProducts((current) => current.map((item) => item._id === product._id ? { ...item, stockCount: Math.max(0, item.stockCount - purchaseQuantity) } : item))
      setMessage('')
      setCompletedOrder(payload.order)
      window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
    } catch (error) { setCheckoutError(error.message) }
    finally { setBuying('') }
  }

  async function copyCode(code) {
    await navigator.clipboard.writeText(code)
    setDeliveryCopied(true)
    setMessage('Access code copied.')
  }

  return (
    <section className='logs-market voucher-market'>
      <section className='logs-carousel logs-carousel-v2' aria-roledescription='carousel' aria-label='LMS Logs highlights' onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)} onFocusCapture={() => setCarouselPaused(true)} onBlurCapture={() => setCarouselPaused(false)}>
        <div className='logs-carousel-track' style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
          {carouselSlides.map((slide, index) => {
            const action = slide.href
              ? <a className='logs-carousel-cta telegram' href={slide.href} target='_blank' rel='noreferrer' tabIndex={index === activeSlide ? 0 : -1}><Send /> {slide.cta}</a>
              : <button className='logs-carousel-cta' type='button' tabIndex={index === activeSlide ? 0 : -1} onClick={() => document.getElementById('logs-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{slide.cta} <ArrowRight /></button>
            return <article key={slide.theme} className={`logs-carousel-slide logs-slide-${slide.theme} ${index === activeSlide ? 'active' : ''}`} aria-hidden={index !== activeSlide}>
              <Image className='logs-carousel-art' src={slide.image} alt='' fill priority={index === 0} sizes='(max-width: 720px) 100vw, 1100px' />
              <div className='logs-carousel-copy'>
                <span className='logs-carousel-brand'><Image src={logoImage} alt='' sizes='54px' /> <b>SOCIALS</b></span>
                <small>{slide.eyebrow}</small>
                <h2>{slide.title}</h2>
                <p>{slide.description}</p>
                {action}
              </div>
            </article>
          })}
        </div>
        <button className='logs-carousel-arrow previous' type='button' aria-label='Previous promotion' onClick={() => setActiveSlide((current) => (current - 1 + carouselSlides.length) % carouselSlides.length)}><ArrowLeft /></button>
        <button className='logs-carousel-arrow next' type='button' aria-label='Next promotion' onClick={() => setActiveSlide((current) => (current + 1) % carouselSlides.length)}><ArrowRight /></button>
        <div className='logs-carousel-dots' role='tablist' aria-label='Choose promotion'>
          {carouselSlides.map((slide, index) => <button key={slide.theme} type='button' className={index === activeSlide ? 'active' : ''} aria-label={`Show promotion ${index + 1}`} aria-selected={index === activeSlide} role='tab' onClick={() => setActiveSlide(index)} />)}
        </div>
      </section>
      <header className='logs-head logs-directory-head' id='logs-catalog'>
        <div><span>BUY LOGS</span><h2>{browsingProducts ? categoryLabel(category) : 'Choose a service'}</h2><p>{browsingProducts ? 'Choose a listing and receive your details securely after purchase.' : 'Select a category to view its available products.'}</p></div>
        <div className='voucher-trust'><BadgeCheck /><span><strong>Secure delivery</strong><small>Codes stay private until purchase</small></span></div>
      </header>

      <div className='voucher-tools'>
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search services or products...' /></label>
        {browsingProducts && <div className='logs-browser-bar'><button type='button' onClick={() => { setCategory('All'); setQuery(''); setDirectoryOpen(true) }}><ArrowLeft /> All services</button><span>{visibleProducts.length} product{visibleProducts.length === 1 ? '' : 's'} found</span></div>}
      </div>

      {message && <div className='voucher-message'>{message}</div>}
      {state === 'loading' ? <div className='logs-empty'><LoaderCircle className='spin' /><strong>Loading logs</strong></div> : !browsingProducts ? <div className='log-category-grid'>
        {categories.map((item) => {
          const count = item === 'All' ? products.length : products.filter((product) => product.category === item).length
          return <button key={item} type='button' onClick={() => { setCategory(item); setDirectoryOpen(false) }}>
            <i className={`log-category-icon log-category-${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{item === 'All' ? <LayoutGrid /> : <SocialIcon category={item} />}</i>
            <span><strong>{categoryLabel(item)}</strong><small>{count} available product{count === 1 ? '' : 's'}</small></span>
            <b><ArrowRight /></b>
          </button>
        })}
      </div> : <div className='logs-product-sections'>
        {productSections.map((section) => <section key={section.label || 'all'} className='logs-product-section'>
          {section.label && <header><span>{category}</span><h3>{section.label} <small>{section.products.length}</small></h3></header>}
          <div className='voucher-products'>{section.products.map((product) => (
          <article key={product._id}>
            <div className='voucher-image'>{product.imageUrl ? <img src={product.imageUrl} alt='' /> : <SocialIcon category={product.category} title={product.title} />}</div>
            <div className='voucher-card-copy'><span>{product.brand}</span><h3>{product.title}</h3><p>{product.description || 'Digital product delivered after checkout.'}{product.quantity > 1 ? ` Includes ${product.quantity} accounts.` : ''}</p></div>
            <div className='voucher-stock'><PackageOpen /><span><strong>{product.stockCount}</strong><small>available</small></span></div>
            <footer><strong>{money(product.priceKobo)}</strong><button disabled={!product.stockCount || Boolean(buying)} onClick={() => openCheckout(product)}><ShoppingBag />{product.stockCount ? 'Buy now' : 'Sold out'} <ArrowRight /></button></footer>
          </article>
          ))}</div>
        </section>)}
        {!visibleProducts.length && <div className='logs-empty'><CircleUserRound /><strong>No logs found</strong><span>Try another search or category.</span></div>}
      </div>}

      {selectedProduct && <div className='log-checkout-backdrop' role='presentation' onMouseDown={(event) => { if (event.target === event.currentTarget) closeCheckout() }}>
        <section className='log-checkout' role='dialog' aria-modal='true' aria-labelledby='log-checkout-title'>
          <header>
            <div><span>{completedOrder ? 'PURCHASE COMPLETE' : 'PURCHASE CONFIGURATION'}</span><h2 id='log-checkout-title'>{completedOrder?.productTitle || selectedProduct.title}</h2><p>{completedOrder ? `${completedOrder.quantity || quantity} ${(completedOrder.quantity || quantity) === 1 ? 'log' : 'logs'} purchased · ${money(completedOrder.priceKobo)}` : `${money(selectedProduct.priceKobo)} per log · ${selectedProduct.stockCount} available`}</p></div>
            <button type='button' onClick={closeCheckout} aria-label='Close checkout'><X /></button>
          </header>
          {completedOrder ? <div className='log-delivery-body'>
            <div className='log-delivery-success'><BadgeCheck /><div><h3>Purchase successful</h3><p>Your purchased login details are displayed immediately below.</p></div></div>
            {completedOrder.code ? <div className='log-delivery-details'>
              <span>YOUR LOG DETAILS</span>
              <pre>{completedOrder.code}</pre>
              <button type='button' onClick={() => copyCode(completedOrder.code)}><Copy />{deliveryCopied ? 'Copied' : 'Copy all details'}</button>
            </div> : <div className='log-delivery-processing'><LoaderCircle className='spin' /><div><strong>Preparing your log details</strong><p>Keep this checkout open. Your details will appear here automatically as soon as delivery completes.</p></div></div>}
            <button className='log-delivery-done' type='button' onClick={closeCheckout}>Close</button>
          </div> : <div className='log-checkout-body'>
            <div className='log-checkout-product'>
              <div className='log-checkout-product-image'>{selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt='' /> : <SocialIcon category={selectedProduct.category} title={selectedProduct.title} />}</div>
              <div><h3>{selectedProduct.title}</h3><p><span>{selectedProduct.stockCount} in stock</span><strong>{money(selectedProduct.priceKobo)}</strong></p></div>
            </div>
            <div className='log-checkout-description'>
              <span>DELIVERY DETAILS</span>
              <div><BadgeCheck /><p><strong>Secure delivery after purchase</strong><small>{selectedProduct.description || 'Your purchased item will appear securely in your order history.'}</small></p></div>
            </div>
            <label>Quantity</label>
            <div className='log-quantity-picker'>
              <button type='button' onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1 || Boolean(buying)} aria-label='Decrease quantity'><Minus /></button>
              <input type='number' min='1' max={Math.min(100, selectedProduct.stockCount)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(100, selectedProduct.stockCount, Number(event.target.value) || 1)))} aria-label='Quantity' />
              <button type='button' onClick={() => setQuantity((current) => Math.min(100, selectedProduct.stockCount, current + 1))} disabled={quantity >= Math.min(100, selectedProduct.stockCount) || Boolean(buying)} aria-label='Increase quantity'><Plus /></button>
            </div>
            <div className='log-checkout-summary'>
              <p><span>Subtotal</span><strong>{money(selectedProduct.priceKobo * quantity)}</strong></p>
              <p><span>Service fee</span><strong>{money(0)}</strong></p>
              <p className='total'><span>Total</span><strong>{money(selectedProduct.priceKobo * quantity)}</strong></p>
            </div>
            {checkoutError && <p className='log-checkout-error'>{checkoutError}</p>}
            <button className='log-confirm-purchase' type='button' disabled={Boolean(buying)} onClick={() => purchase(selectedProduct, quantity)}>{buying ? <LoaderCircle className='spin' /> : <ShoppingBag />} {buying ? 'Completing purchase…' : `Buy now · ${money(selectedProduct.priceKobo * quantity)}`}</button>
          </div>}
        </section>
      </div>}

      <section className='voucher-orders'>
        <div className='dash-section-title'><div><span>ORDER HISTORY</span><h2>Your purchased logs</h2></div><small>{orders.length}</small></div>
        {orders.length ? <div className='voucher-order-grid'>{orders.map((order) => <article key={order._id}>
          <div><CircleUserRound /><span><strong>{order.productTitle}</strong><small>{order.brand} · Qty {order.quantity || 1} · {new Date(order.createdAt).toLocaleDateString()}</small></span></div>
          <label><span>{order.status === 'processing' ? 'DELIVERY STATUS' : 'YOUR ACCESS CODE'}</span><strong>{order.code || (order.status === 'processing' ? 'Processing — refresh shortly' : 'Contact support')}</strong><button onClick={() => copyCode(order.code)} disabled={!order.code} aria-label='Copy access code'><Copy /></button></label>
        </article>)}</div> : <div className='logs-empty'><ShoppingBag /><strong>No log orders yet</strong><span>Your purchased codes will appear here.</span></div>}
      </section>
    </section>
  )
}

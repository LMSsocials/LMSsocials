import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, Copy, CircleUserRound, LoaderCircle, PackageOpen, Search, ShoppingBag } from 'lucide-react'
import SocialIcon from './SocialIcon'

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

export default function LogsMarketplace() {
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [state, setState] = useState('loading')
  const [buying, setBuying] = useState('')
  const [message, setMessage] = useState('')

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

  const categories = useMemo(() => ['All', ...(products.some((product) => product.source === 'managed') ? ['LMS Socials'] : []), ...Array.from(new Set(products.filter((product) => product.source !== 'managed').map((product) => product.category).filter(Boolean))).sort()], [products])
  const visibleProducts = products.filter((product) => {
    const search = query.trim().toLowerCase()
    const matchesSearch = !search || `${product.title} ${product.brand} ${product.description}`.toLowerCase().includes(search)
    const matchesCategory = category === 'All' || (category === 'LMS Socials' ? product.source === 'managed' : product.category === category)
    return matchesSearch && matchesCategory
  }).sort((first, second) => {
    const manualFirst = Number(second.source === 'managed') - Number(first.source === 'managed')
    return manualFirst || Number(first.priceKobo) - Number(second.priceKobo) || first.title.localeCompare(second.title)
  })
  const productSections = useMemo(() => {
    if (category === 'All' || category === 'LMS Socials') return [{ label: '', products: visibleProducts }]
    const grouped = new Map()
    visibleProducts.forEach((product) => {
      const label = subsectionFor(product)
      grouped.set(label, [...(grouped.get(label) || []), product])
    })
    return Array.from(grouped, ([label, sectionProducts]) => ({ label, products: sectionProducts })).sort((a, b) => a.label.localeCompare(b.label))
  }, [category, visibleProducts])

  async function purchase(product) {
    if (!product.stockCount || buying) return
    setBuying(product._id)
    setMessage('')
    try {
      const response = await fetch('/api/voucher-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product._id, requestId: requestId() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Purchase failed')
      setOrders((current) => [payload.order, ...current])
      setProducts((current) => current.map((item) => item._id === product._id ? { ...item, stockCount: Math.max(0, item.stockCount - 1) } : item))
      setMessage('Purchase complete. Your log is now available in order history.')
      window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
    } catch (error) { setMessage(error.message) }
    finally { setBuying('') }
  }

  async function copyCode(code) {
    await navigator.clipboard.writeText(code)
    setMessage('Access code copied.')
  }

  return (
    <section className='logs-market voucher-market'>
      <header className='logs-head'>
        <div><span>DIGITAL LOGS</span><h2>Premium logs, ready instantly.</h2><p>Choose a listing, pay securely from your wallet, and receive one unused delivery code in your order history.</p></div>
        <div className='voucher-trust'><BadgeCheck /><span><strong>Secure delivery</strong><small>Codes stay private until purchase</small></span></div>
      </header>

      <div className='voucher-tools'>
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search available logs...' /></label>
        <div className='logs-platforms' role='group' aria-label='Browse log categories'>{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}><SocialIcon category={item} /><span>{item}</span></button>)}</div>
      </div>

      {message && <div className='voucher-message'>{message}</div>}
      {state === 'loading' ? <div className='logs-empty'><LoaderCircle className='spin' /><strong>Loading logs</strong></div> : <div className='logs-product-sections'>
        {productSections.map((section) => <section key={section.label || 'all'} className='logs-product-section'>
          {section.label && <header><span>{category}</span><h3>{section.label} <small>{section.products.length}</small></h3></header>}
          <div className='voucher-products'>{section.products.map((product) => (
          <article key={product._id}>
            <div className='voucher-image'>{product.imageUrl ? <img src={product.imageUrl} alt='' /> : <SocialIcon category={product.category} title={product.title} />}</div>
            <div className='voucher-card-copy'><span>{product.brand}</span><h3>{product.title}</h3><p>{product.description || 'Digital product delivered after checkout.'}{product.quantity > 1 ? ` Includes ${product.quantity} accounts.` : ''}</p></div>
            <div className='voucher-stock'><PackageOpen /><span><strong>{product.stockCount}</strong><small>available</small></span></div>
            <footer><strong>{money(product.priceKobo)}</strong><button disabled={!product.stockCount || Boolean(buying)} onClick={() => purchase(product)}>{buying === product._id ? <LoaderCircle className='spin' /> : <ShoppingBag />}{product.stockCount ? 'Buy now' : 'Sold out'} <ArrowRight /></button></footer>
          </article>
          ))}</div>
        </section>)}
        {!visibleProducts.length && <div className='logs-empty'><CircleUserRound /><strong>No logs found</strong><span>Try another search or category.</span></div>}
      </div>}

      <section className='voucher-orders'>
        <div className='dash-section-title'><div><span>ORDER HISTORY</span><h2>Your purchased logs</h2></div><small>{orders.length}</small></div>
        {orders.length ? <div className='voucher-order-grid'>{orders.map((order) => <article key={order._id}>
          <div><CircleUserRound /><span><strong>{order.productTitle}</strong><small>{order.brand} · {new Date(order.createdAt).toLocaleDateString()}</small></span></div>
          <label><span>{order.status === 'processing' ? 'DELIVERY STATUS' : 'YOUR ACCESS CODE'}</span><strong>{order.code || (order.status === 'processing' ? 'Processing — refresh shortly' : 'Contact support')}</strong><button onClick={() => copyCode(order.code)} disabled={!order.code} aria-label='Copy access code'><Copy /></button></label>
        </article>)}</div> : <div className='logs-empty'><ShoppingBag /><strong>No log orders yet</strong><span>Your purchased codes will appear here.</span></div>}
      </section>
    </section>
  )
}

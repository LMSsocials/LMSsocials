import React, { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import {
  ArrowRight, Bell, Building2, Check, CircleUserRound, Clock3, Copy, FileText, Globe2, Grid2X2, ImageIcon,
  Gem, Headphones, History, LoaderCircle, LogOut, Menu, PackageCheck, Plus, ReceiptText, ShieldCheck, Sparkles, TrendingUp, WalletCards, Wifi, Wrench, X,
} from 'lucide-react'
import logoImage from '../public/assets/lms-logo-clean.png'

const MarketplaceLoading = () => <section className='dash-catalog'><div className='fund-loading'><LoaderCircle className='spin' /><span>Loading marketplace...</span></div></section>
const LogsMarketplace = dynamic(() => import('./LogsMarketplace'), { loading: MarketplaceLoading })
const BoostMarketplace = dynamic(() => import('./BoostMarketplace'), { loading: MarketplaceLoading })
const NumbersMarketplace = dynamic(() => import('./NumbersMarketplace'), { loading: MarketplaceLoading })
const FormatMarketplace = dynamic(() => import('./FormatMarketplace'), { loading: MarketplaceLoading })
const EsimMarketplace = dynamic(() => import('./EsimMarketplace'), { loading: MarketplaceLoading })
const ToolsMarketplace = dynamic(() => import('./ToolsMarketplace'), { loading: MarketplaceLoading })
const PicturesMarketplace = dynamic(() => import('./PicturesMarketplace'), { loading: MarketplaceLoading })
const AdminPanel = dynamic(() => import('./AdminPanel'), { loading: MarketplaceLoading })

const catalog = {
  boosting: [
    ['Instagram Growth', 'Followers package', '$4.50', '+248%'],
    ['TikTok Momentum', 'Views and likes', '$3.20', 'Fast'],
    ['YouTube Reach', 'High-retention views', '$6.00', 'Stable'],
  ],
  logs: [
    ['Instagram Account', 'Aged profile', '$18.00', 'Verified'],
    ['Facebook Account', 'Marketplace ready', '$22.00', 'Limited'],
    ['Gmail Account', 'Fresh setup', '$3.50', 'New'],
  ],
  format: [],
  esim: [
    ['1 Month', 'Short-term eSIM access', '', 'Flexible'],
    ['3 Months', 'Extended eSIM access', '', 'Popular'],
    ['6 Months', 'Long-term eSIM access', '', 'Best value'],
  ],
  tools: [],
  pictures: [],
  numbers: [
    ['United States', '+1 private number', '$8.50', 'Live'],
    ['United Kingdom', '+44 private number', '$9.00', 'Live'],
    ['Canada', '+1 private number', '$8.00', 'Live'],
  ],
}

const serviceMeta = {
  boosting: { label: 'Boost account', icon: TrendingUp },
  logs: { label: 'Buy logs', icon: CircleUserRound },
  numbers: { label: 'Foreign number', icon: Globe2 },
  format: { label: 'Buy format', icon: FileText },
  esim: { label: 'Buy eSIM', icon: Wifi },
  tools: { label: 'Working Tools', icon: Wrench, hideMeta: true },
  pictures: { label: 'Working Pictures', icon: ImageIcon, hideMeta: true },
  admin: { label: 'Admin uploads', icon: ShieldCheck },
}
const serviceOrder = ['boosting', 'numbers', 'logs', 'format', 'esim', 'tools', 'pictures']
const deliveredStatuses = new Set(['delivered', 'completed'])
const notificationKey = (order) => order ? `${order.type}:${order.id}:${order.status}` : ''
const noop = () => {}

const orderSources = [
  ['/api/voucher-orders', (payload) => payload.orders || []],
  ['/api/format-orders', (payload) => payload.orders || []],
  ['/api/number-orders', (payload) => payload.orders || []],
  ['/api/boosting-orders', (payload) => payload.orders || []],
  ['/api/esim-orders', (payload) => payload.orders || []],
  ['/api/tools', (payload) => payload.tools || []],
  ['/api/pictures', (payload) => payload.pictures || []],
]

function orderDate(value) {
  if (!value) return 'Recently'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

const orderStatus = (value) => String(value || 'processing').replaceAll('_', ' ')

const fullNaira = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0))

export default function Dashboard({ route, session, onSignOut, showWelcomeOffer = false, onCloseWelcomeOffer = noop }) {
  const page = route.startsWith('#account/') ? route.slice('#account/'.length) : 'overview'
  const activeService = serviceMeta[page] ? page : null
  const isOrdersPage = page === 'orders'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const user = session.user
  const [balance, setBalance] = useState(Number(user.balance || 0))
  const [fundOpen, setFundOpen] = useState(false)
  const [fundState, setFundState] = useState('idle')
  const [fundMessage, setFundMessage] = useState('')
  const [fundAccount, setFundAccount] = useState(null)
  const [accountCopied, setAccountCopied] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersState, setOrdersState] = useState('loading')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [offerSeconds, setOfferSeconds] = useState(5 * 60)
  const [seenNotificationKeys, setSeenNotificationKeys] = useState(() => {
    const storageKey = `lms-notifications-seen:${user.id}`
    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      try {
        const legacyKey = localStorage.getItem(storageKey)
        return legacyKey ? [legacyKey] : []
      } catch { return [] }
    }
  })
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer'
  const firstName = name.trim().split(/\s+/)[0]
  const ActiveIcon = activeService ? serviceMeta[activeService].icon : TrendingUp
  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const loadOrders = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setOrdersState('loading')
    try {
      const [logs, files, numbers, boosts, esims, tools, pictures] = await Promise.all(orderSources.map(async ([url, selectItems]) => {
        const response = await fetch(url, { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.message || 'Unable to load orders')
        return selectItems(payload)
      }))
      const combined = [
        ...logs.map((order) => ({ id: order._id, type: 'Log', item: order.productTitle || order.brand || 'Log product', status: 'delivered', createdAt: order.createdAt })),
        ...files.map((order) => ({ id: order._id, type: 'File', item: order.title || order.fileName || 'Download', status: order.status || 'delivered', createdAt: order.createdAt })),
        ...numbers.map((order) => ({ id: order._id, type: 'Number', item: order.phoneNumber || [order.countryCode || order.countryId, order.serviceCode].filter(Boolean).join(' · ') || 'Virtual number', status: order.status || 'processing', createdAt: order.createdAt })),
        ...boosts.map((order) => ({ id: order._id, type: 'Boosting', item: order.serviceName || 'Social media boost', status: order.status || 'pending', createdAt: order.createdAt })),
        ...esims.map((order) => ({ id: order._id, type: 'eSIM', item: `${order.planName || 'Plan'} eSIM`, status: order.status || 'awaiting_code', createdAt: order.createdAt })),
        ...tools.filter((tool) => tool.purchased).map((tool) => ({ id: tool._id, type: 'Tool', item: tool.name, status: 'delivered', createdAt: tool.purchasedAt })),
        ...pictures.filter((picture) => picture.purchased).map((picture) => ({ id: picture._id, type: 'Picture', item: picture.title, status: 'delivered', createdAt: picture.purchasedAt })),
      ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      setOrders(combined)
      setOrdersState('success')
    } catch {
      setOrdersState('error')
    }
  }, [])

  useEffect(() => {
    if (!showWelcomeOffer) return undefined
    setOfferSeconds(5 * 60)
    const timer = window.setInterval(() => setOfferSeconds((current) => {
      if (current <= 1) {
        window.clearInterval(timer)
        onCloseWelcomeOffer()
        return 0
      }
      return current - 1
    }), 1000)
    return () => window.clearInterval(timer)
  }, [showWelcomeOffer, onCloseWelcomeOffer])

  function openOrderHistory() {
    setMobileMenuOpen(false)
    setNotificationOpen(false)
    window.location.hash = '#account/orders'
  }

  useEffect(() => {
    const closeMenu = (event) => {
      if (event.key !== 'Escape') return
      setMobileMenuOpen(false)
      setNotificationOpen(false)
      if (showWelcomeOffer) onCloseWelcomeOffer()
    }
    window.addEventListener('keydown', closeMenu)
    return () => window.removeEventListener('keydown', closeMenu)
  }, [showWelcomeOffer, onCloseWelcomeOffer])

  useEffect(() => {
    const updateBalance = (event) => setBalance(Number(event.detail || 0))
    const updateActivity = () => loadOrders({ quiet: true })
    window.addEventListener('wallet-balance', updateBalance)
    window.addEventListener('wallet-balance', updateActivity)
    return () => {
      window.removeEventListener('wallet-balance', updateBalance)
      window.removeEventListener('wallet-balance', updateActivity)
    }
  }, [loadOrders])

  useEffect(() => {
    loadOrders()
    const refresh = () => { if (!document.hidden) loadOrders({ quiet: true }) }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadOrders])

  const notificationOrders = orders.slice(0, 5)
  const unreadNotificationCount = orders.filter((order) => !seenNotificationKeys.includes(notificationKey(order))).length
  const hasUnreadNotifications = unreadNotificationCount > 0
  const deliveredOrders = orders.filter((order) => deliveredStatuses.has(String(order.status).toLowerCase())).length

  function toggleNotifications() {
    const nextOpen = !notificationOpen
    setNotificationOpen(nextOpen)
    setMobileMenuOpen(false)
    if (!nextOpen || !orders.length) return
    const currentKeys = orders.map(notificationKey).filter(Boolean)
    const nextSeenKeys = [...new Set([...seenNotificationKeys, ...currentKeys])].slice(-250)
    setSeenNotificationKeys(nextSeenKeys)
    try { localStorage.setItem(`lms-notifications-seen:${user.id}`, JSON.stringify(nextSeenKeys)) } catch { return }
  }

  async function openFunding() {
    setFundOpen(true); setFundState('loading'); setFundMessage('')
    try {
      const response = await fetch('/api/payments/pocketfi/account')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to load account details')
      if (payload.account) {
        setFundAccount(payload.account); setFundState('idle'); return
      }
      const createResponse = await fetch('/api/payments/pocketfi/account', { method: 'POST' })
      const created = await createResponse.json().catch(() => ({}))
      if (!createResponse.ok) throw new Error(created.message || 'Unable to generate account')
      setFundAccount(created.account); setFundState('success')
    } catch (error) { setFundState('error'); setFundMessage(error.message) }
  }

  function fundFromWelcome() {
    onCloseWelcomeOffer()
    openFunding()
  }

  async function copyAccountNumber() {
    await navigator.clipboard.writeText(fundAccount.accountNumber)
    setAccountCopied(true)
    window.setTimeout(() => setAccountCopied(false), 1800)
  }

  return (
    <main className='dash-page'>
      <section className='dash-frame' id='dashboard'>
        <nav className='dash-nav'>
          <a className='logo dash-brand' href='#top' aria-label='LMS Socials home'><span className='logo-mark'><Image src={logoImage} alt='' sizes='43px' /></span><span className='logo-word'>SOCIALS</span></a>
          <div className={'dash-nav-links ' + (mobileMenuOpen ? 'open' : '')} id='mobile-dashboard-menu'>
            <div className='dash-mobile-menu-head'>
              <a className='logo' href='#top' onClick={() => setMobileMenuOpen(false)}><span className='logo-mark'><Image src={logoImage} alt='' sizes='43px' /></span><span className='logo-word'>SOCIALS</span></a>
              <button type='button' aria-label='Close menu' onClick={() => setMobileMenuOpen(false)}><X /></button>
            </div>
            <div className='dash-mobile-menu-scroll'>
              <button className={!activeService && !isOrdersPage ? 'active' : ''} onClick={() => { window.location.hash = '#account'; setMobileMenuOpen(false) }}><Grid2X2 /> Dashboard</button>
              <button onClick={() => { openFunding(); setMobileMenuOpen(false) }}><WalletCards /> Fund wallet</button>
              <div className='dash-menu-group'>SERVICES</div>
              <button onClick={() => { window.location.hash = '#account/boosting'; setMobileMenuOpen(false) }}><TrendingUp /> Boost account</button>
              <button className={activeService === 'numbers' ? 'active' : ''} onClick={() => { window.location.hash = '#account/numbers'; setMobileMenuOpen(false) }}><Globe2 /> Foreign numbers</button>
              <button className={activeService === 'logs' ? 'active' : ''} onClick={() => { window.location.hash = '#account/logs'; setMobileMenuOpen(false) }}><CircleUserRound /> Buy logs</button>
              <button className={activeService === 'format' ? 'active' : ''} onClick={() => { window.location.hash = '#account/format'; setMobileMenuOpen(false) }}><FileText /> Buy format</button>
              <button className={activeService === 'esim' ? 'active' : ''} onClick={() => { window.location.hash = '#account/esim'; setMobileMenuOpen(false) }}><Wifi /> Buy eSIM</button>
              <button className={activeService === 'tools' ? 'active' : ''} onClick={() => { window.location.hash = '#account/tools'; setMobileMenuOpen(false) }}><Wrench /> Working Tools</button>
              <button className={activeService === 'pictures' ? 'active' : ''} onClick={() => { window.location.hash = '#account/pictures'; setMobileMenuOpen(false) }}><ImageIcon /> Working Pictures</button>
              <div className='dash-menu-group'>ACCOUNT</div>
              <button className={isOrdersPage ? 'active' : ''} onClick={openOrderHistory}><ReceiptText /> Order history</button>
              <button onClick={() => { goTo('support'); setMobileMenuOpen(false) }}><Headphones /> Help & support</button>
              {user.isAdmin && <button className={activeService === 'admin' ? 'active' : ''} onClick={() => { window.location.hash = '#account/admin'; setMobileMenuOpen(false) }}><ShieldCheck /> Admin uploads</button>}
              <button className='mobile-signout' onClick={onSignOut}><LogOut /> Sign out</button>
            </div>
          </div>
          <div className='dash-actions'>
            <button className='notification-trigger' aria-label={hasUnreadNotifications ? `${unreadNotificationCount} unread notifications` : 'Notifications'} aria-controls='dashboard-notifications' aria-expanded={notificationOpen} onClick={toggleNotifications}><Bell />{hasUnreadNotifications && <span className='notification-count'>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}</button>
            <button className='dash-avatar' title={user.email}>{name.charAt(0).toUpperCase()}</button>
            <button aria-label='Sign out' onClick={onSignOut}><LogOut /></button>
            <button className='dash-menu-toggle' aria-label='Open menu' aria-controls='mobile-dashboard-menu' aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><Menu /></button>
          </div>
        </nav>
        {notificationOpen && <><button className='notification-backdrop' aria-label='Close notifications' onClick={() => setNotificationOpen(false)} /><section className='notification-panel' id='dashboard-notifications' role='dialog' aria-modal='true' aria-labelledby='notification-title'>
          <header><div><small>ACTIVITY</small><h2 id='notification-title'>Notifications</h2></div><button type='button' aria-label='Close notifications' onClick={() => setNotificationOpen(false)}><X /></button></header>
          <div className='notification-list'>
            {ordersState === 'loading' && <p><LoaderCircle className='spin' /> Loading notifications...</p>}
            {ordersState === 'error' && <p>Notifications could not be loaded. Refresh to try again.</p>}
            {ordersState === 'success' && !notificationOrders.length && <p><Bell /> You have no notifications yet.</p>}
            {ordersState === 'success' && notificationOrders.map((order) => <article key={`${order.type}-${order.id}`}><i>{deliveredStatuses.has(String(order.status).toLowerCase()) ? <PackageCheck /> : <Clock3 />}</i><span><strong>{order.type}: {order.item}</strong><small>{orderStatus(order.status)} · {orderDate(order.createdAt)}</small></span></article>)}
          </div>
          {notificationOrders.length > 0 && <button className='notification-history' type='button' onClick={openOrderHistory}>View order history <ArrowRight /></button>}
        </section></>}
        {mobileMenuOpen && <button className='dash-menu-backdrop' aria-label='Close menu' onClick={() => setMobileMenuOpen(false)} />}
        {showWelcomeOffer && <div className='welcome-offer-backdrop' role='presentation' onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseWelcomeOffer() }}><section className='welcome-offer' role='dialog' aria-modal='true' aria-labelledby='welcome-offer-title'>
          <button className='welcome-offer-close' type='button' aria-label='Close welcome message' onClick={onCloseWelcomeOffer}><X /></button>
          <span className='welcome-offer-icon'><Gem /></span>
          <small>WELCOME TO LMS SOCIALS</small>
          <h2 id='welcome-offer-title'>Welcome back, {firstName}!</h2>
          <p>Your account is ready. Add money to your wallet and start ordering any service in just a few taps.</p>
          <div className='welcome-offer-balance'><span><Sparkles /> AVAILABLE BALANCE</span><strong>{fullNaira(balance)}</strong><small>Secure funding through your dedicated bank account</small></div>
          <button className='welcome-offer-cta' type='button' onClick={fundFromWelcome}><Plus /> Add Money</button>
          <button className='welcome-offer-later' type='button' onClick={onCloseWelcomeOffer}>Maybe later</button>
          <div className='welcome-offer-timer'>AUTO CLOSES IN <b>{String(Math.floor(offerSeconds / 60)).padStart(2, '0')}:{String(offerSeconds % 60).padStart(2, '0')}</b></div>
        </section></div>}
        {fundOpen && <div className='fund-modal-backdrop' role='presentation' onMouseDown={() => fundState !== 'loading' && setFundOpen(false)}><section className='fund-modal' role='dialog' aria-modal='true' aria-labelledby='fund-wallet-title' onMouseDown={(event) => event.stopPropagation()}>
          <header><span><WalletCards /></span><div><small>BANK TRANSFER</small><h2 id='fund-wallet-title'>Fund your wallet</h2><p>Transfer to your dedicated account from any Nigerian bank.</p></div><button type='button' aria-label='Close funding dialog' onClick={() => setFundOpen(false)}><X /></button></header>
          {fundState === 'loading' && !fundAccount ? <div className='fund-loading'><LoaderCircle className='spin' /><span>Getting your account details...</span></div> : fundAccount ? <div className='fund-account'>
            <div className='fund-account-bank'><span><Building2 /></span><div><small>BANK</small><strong>{fundAccount.bankName}</strong></div></div>
            <div className='fund-account-number'><small>ACCOUNT NUMBER</small><strong>{fundAccount.accountNumber}</strong><button type='button' onClick={copyAccountNumber}>{accountCopied ? <Check /> : <Copy />}{accountCopied ? 'Copied' : 'Copy'}</button></div>
            <div className='fund-account-name'><small>ACCOUNT NAME</small><strong>{fundAccount.accountName}</strong></div>
            {fundMessage && <p className={fundState}>{fundMessage}</p>}
            <div className='fund-note'>Make a bank transfer to this account. Your wallet updates automatically after PocketFi confirms the payment.</div>
          </div> : <div className='fund-loading fund-loading-error'><span>{fundMessage || 'Your dedicated account is not available yet.'}</span><button type='button' onClick={openFunding}>Try again</button></div>}
          <footer>Only transfers confirmed by PocketFi are added to your wallet balance.</footer>
        </section></div>}
        {!fundOpen && fundMessage && <div className={'fund-toast ' + fundState}>{fundMessage}<button onClick={() => setFundMessage('')} aria-label='Dismiss'><X /></button></div>}

        {isOrdersPage ? <header className='dash-service-hero'>
          <button onClick={() => { window.location.hash = '#account' }}><ArrowRight /> Back to dashboard</button>
          <span>YOUR ACCOUNT</span>
          <h1>Order history</h1>
          <p>Review every purchase and follow its latest delivery status.</p>
        </header> : !activeService ? <><header className='dash-head'>
          <div><h1>Welcome back, {firstName}.</h1><p>Choose a service and get started.</p></div>
          <div className={'dash-head-stats ' + (balance >= 1000000 ? 'balance-expanded' : '')}>
            <div className='balance-stat'><div className='stat-label'><i><WalletCards /></i><small>Available balance</small></div><strong>{fullNaira(balance)}</strong><span>Ready to spend across every service</span><div className='wallet-actions'><button type='button' onClick={openFunding}><Plus /> Add Money</button><button type='button' onClick={openOrderHistory}><History /> History</button></div></div>
            <div className='order-stat'><div className='stat-label'><i><ReceiptText /></i><small>Orders</small></div><strong>{ordersState === 'loading' ? '—' : orders.length}</strong><span>All purchases</span></div>
            <div className='delivered-stat'><div className='stat-label'><i><PackageCheck /></i><small>Delivered</small></div><strong>{ordersState === 'loading' ? '—' : deliveredOrders}</strong><span>Completed</span></div>
          </div>
        </header></> : <header className='dash-service-hero'>
          <button onClick={() => { window.location.hash = '#account' }}><ArrowRight /> Back to dashboard</button>
          <span>SERVICE MARKETPLACE</span>
          <h1>{serviceMeta[activeService].label}</h1>
          <p>Browse available options and choose the package that fits what you need.</p>
        </header>}

        <section className={'dash-layout ' + (isOrdersPage ? 'orders-page' : !activeService ? 'overview' : 'service-page')}>
          {!activeService && !isOrdersPage && <aside className='dash-services' id='services'>
            <div className='dash-section-title'><div><span>SERVICES</span><h2>Quick actions</h2></div><small>{String(serviceOrder.length).padStart(2, '0')}</small></div>
            {serviceOrder.map((key) => {
              const item = serviceMeta[key]
              const Icon = item.icon
              return <button key={key} onClick={() => { window.location.hash = '#account/' + key }}><i><Icon /></i><span><strong>{item.label}</strong><small>{!item.hideMeta && <b>{catalog[key].length} offers</b>}<em>Tap to open</em></small></span><ArrowRight /></button>
            })}
            <div className='dash-help' id='support'><Headphones /><div><strong>Need some help?</strong><small>Our support team is ready.</small></div><a href='mailto:hello@lmssocials.com'>Contact support</a></div>
          </aside>}

          {activeService === 'logs' ? <LogsMarketplace /> : activeService === 'boosting' ? <BoostMarketplace /> : activeService === 'numbers' ? <NumbersMarketplace key={user.id} userId={user.id} /> : activeService === 'format' ? <FormatMarketplace /> : activeService === 'esim' ? <EsimMarketplace /> : activeService === 'tools' ? <ToolsMarketplace /> : activeService === 'pictures' ? <PicturesMarketplace /> : activeService === 'admin' && user.isAdmin ? <AdminPanel /> : activeService ? <section className='dash-catalog'>
            <div className='dash-section-title'><div><span>LIVE CATALOG</span><h2>{serviceMeta[activeService].label}</h2></div><small className='live'><i /> Available now</small></div>
            <div className='dash-product-grid'>
              {catalog[activeService].map(([title, meta, price, badge], index) => (
                <article key={title}>
                  <div className='product-top'><i><ActiveIcon /></i><span>0{index + 1}</span></div>
                  <small>{badge}</small><h3>{title}</h3><p>{meta}</p>
                  <div><strong>{price}</strong><button onClick={() => window.alert(title + ' ordering is coming next.')}>Select <ArrowRight /></button></div>
                </article>
              ))}
            </div>
          </section> : null}

          {isOrdersPage && <aside className='dash-activity order-history-page' id='orders'>
            <div className='activity-head'><div><span>ALL ORDERS</span><h2>{orders.length ? `${orders.length} purchase${orders.length === 1 ? '' : 's'}` : 'Activity starts here'}</h2></div></div>
            <p>{ordersState === 'error' ? 'We could not load your orders. Refresh to try again.' : orders.length ? 'Your latest purchases appear first.' : 'Completed and active orders will appear here.'}</p>
            <div className='activity-list'>
              {ordersState === 'loading' && <div className='activity-empty'><LoaderCircle className='spin' /><strong>Loading orders</strong><span>Checking your latest activity.</span></div>}
              {ordersState === 'success' && orders.map((order) => <article key={`${order.type}-${order.id}`}><i className={deliveredStatuses.has(String(order.status).toLowerCase()) ? 'delivered' : 'pending'}>{deliveredStatuses.has(String(order.status).toLowerCase()) ? <PackageCheck /> : <Clock3 />}</i><span><b>{order.type}: {order.item}</b><small>{orderStatus(order.status)} · {orderDate(order.createdAt)}</small></span></article>)}
              {ordersState === 'success' && !orders.length && <div className='activity-empty'><Clock3 /><strong>No orders yet</strong><span>Your purchases will appear here.</span></div>}
              {ordersState === 'error' && <div className='activity-empty'><Clock3 /><strong>Orders unavailable</strong><span>Please refresh the page to try again.</span></div>}
            </div>
          </aside>}
        </section>
      </section>
    </main>
  )
}

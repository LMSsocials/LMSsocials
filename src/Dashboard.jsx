import React, { useEffect, useState } from 'react'
import {
  ArrowRight, Bell, CircleUserRound, Clock3, FileText, Globe2, Grid2X2,
  Headphones, LoaderCircle, LogOut, Menu, PackageCheck, ReceiptText, ShieldCheck, TrendingUp, WalletCards, X,
} from 'lucide-react'
import LogsMarketplace from './LogsMarketplace'
import BoostMarketplace from './BoostMarketplace'
import NumbersMarketplace from './NumbersMarketplace'
import FormatMarketplace from './FormatMarketplace'
import AdminPanel from './AdminPanel'

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
  admin: { label: 'Admin uploads', icon: ShieldCheck },
}
const serviceOrder = ['boosting', 'numbers', 'logs', 'format']

export default function Dashboard({ route, session, onSignOut }) {
  const page = route.startsWith('#account/') ? route.slice('#account/'.length) : 'overview'
  const activeService = serviceMeta[page] ? page : null
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const user = session.user
  const [balance, setBalance] = useState(Number(user.balance || 0))
  const [fundOpen, setFundOpen] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [fundPhone, setFundPhone] = useState('')
  const [fundState, setFundState] = useState('idle')
  const [fundMessage, setFundMessage] = useState('')
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer'
  const firstName = name.trim().split(/\s+/)[0]
  const ActiveIcon = activeService ? serviceMeta[activeService].icon : TrendingUp
  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  useEffect(() => {
    const closeMenu = (event) => event.key === 'Escape' && setMobileMenuOpen(false)
    window.addEventListener('keydown', closeMenu)
    return () => window.removeEventListener('keydown', closeMenu)
  }, [])

  useEffect(() => {
    const updateBalance = (event) => setBalance(Number(event.detail || 0))
    window.addEventListener('wallet-balance', updateBalance)
    return () => window.removeEventListener('wallet-balance', updateBalance)
  }, [])

  useEffect(() => {
    const funding = new URLSearchParams(window.location.search).get('funding')
    if (funding) {
      setFundMessage(funding === 'success' ? 'Payment verified. Your wallet has been credited.' : funding === 'pending' ? 'Payment is still pending. Please check again shortly.' : 'Payment could not be verified.')
      setFundState(funding === 'success' ? 'success' : 'error')
      window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    }
  }, [])

  async function startFunding(event) {
    event.preventDefault()
    setFundState('loading'); setFundMessage('')
    try {
      const response = await fetch('/api/payments/pocketfi/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(fundAmount), phone: fundPhone }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to start payment')
      window.location.assign(payload.paymentLink)
    } catch (error) { setFundState('error'); setFundMessage(error.message) }
  }

  return (
    <main className='dash-page'>
      <section className='dash-frame' id='dashboard'>
        <nav className='dash-nav'>
          <a className='logo dash-brand' href='#top' aria-label='LMS Socials home'><span className='logo-mark'><img src='/assets/lms-logo-clean.png' alt='' /></span><span className='logo-word'>SOCIALS</span></a>
          <div className={'dash-nav-links ' + (mobileMenuOpen ? 'open' : '')} id='mobile-dashboard-menu'>
            <div className='dash-mobile-menu-head'>
              <a className='logo' href='#top' onClick={() => setMobileMenuOpen(false)}><span className='logo-mark'><img src='/assets/lms-logo-clean.png' alt='' /></span><span className='logo-word'>SOCIALS</span></a>
              <button type='button' aria-label='Close menu' onClick={() => setMobileMenuOpen(false)}><X /></button>
            </div>
            <button className={!activeService ? 'active' : ''} onClick={() => { window.location.hash = '#account'; setMobileMenuOpen(false) }}><Grid2X2 /> Dashboard</button>
            <button onClick={() => { setFundOpen(true); setMobileMenuOpen(false) }}><WalletCards /> Fund wallet</button>
            <div className='dash-menu-group'>SERVICES</div>
            <button onClick={() => { window.location.hash = '#account/boosting'; setMobileMenuOpen(false) }}><TrendingUp /> Boost account</button>
            <button className={activeService === 'numbers' ? 'active' : ''} onClick={() => { window.location.hash = '#account/numbers'; setMobileMenuOpen(false) }}><Globe2 /> Foreign numbers</button>
            <button className={activeService === 'logs' ? 'active' : ''} onClick={() => { window.location.hash = '#account/logs'; setMobileMenuOpen(false) }}><CircleUserRound /> Buy logs</button>
            <button className={activeService === 'format' ? 'active' : ''} onClick={() => { window.location.hash = '#account/format'; setMobileMenuOpen(false) }}><FileText /> Buy format</button>
            <div className='dash-menu-group'>ACCOUNT</div>
            <button onClick={() => { goTo('orders'); setMobileMenuOpen(false) }}><ReceiptText /> Order history</button>
            <button onClick={() => { goTo('support'); setMobileMenuOpen(false) }}><Headphones /> Help & support</button>
            {user.isAdmin && <button className={activeService === 'admin' ? 'active' : ''} onClick={() => { window.location.hash = '#account/admin'; setMobileMenuOpen(false) }}><ShieldCheck /> Admin uploads</button>}
            <button className='mobile-signout' onClick={onSignOut}><LogOut /> Sign out</button>
          </div>
          <div className='dash-actions'>
            <button aria-label='Notifications'><Bell /><i /></button>
            <button className='dash-avatar' title={user.email}>{name.charAt(0).toUpperCase()}</button>
            <button aria-label='Sign out' onClick={onSignOut}><LogOut /></button>
            <button className='dash-menu-toggle' aria-label='Open menu' aria-controls='mobile-dashboard-menu' aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><Menu /></button>
          </div>
        </nav>
        {mobileMenuOpen && <button className='dash-menu-backdrop' aria-label='Close menu' onClick={() => setMobileMenuOpen(false)} />}
        {fundOpen && <div className='fund-modal-backdrop' role='presentation' onMouseDown={() => fundState !== 'loading' && setFundOpen(false)}><section className='fund-modal' role='dialog' aria-modal='true' aria-labelledby='fund-wallet-title' onMouseDown={(event) => event.stopPropagation()}>
          <header><span><WalletCards /></span><div><small>POCKETFI CHECKOUT</small><h2 id='fund-wallet-title'>Fund your wallet</h2><p>Enter an amount and continue to secure payment.</p></div><button type='button' aria-label='Close funding dialog' onClick={() => setFundOpen(false)}><X /></button></header>
          <form onSubmit={startFunding}><label>Amount (NGN)<input type='number' min='1000' max='1000000' step='100' value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} placeholder='10000' required /></label><label>Phone number<input type='tel' value={fundPhone} onChange={(event) => setFundPhone(event.target.value)} placeholder='08012345678' autoComplete='tel' required /></label>{fundMessage && <p className={fundState}>{fundMessage}</p>}<button disabled={fundState === 'loading'}>{fundState === 'loading' ? <LoaderCircle className='spin' /> : <WalletCards />}{fundState === 'loading' ? 'Opening checkout...' : 'Continue to PocketFi'}</button></form>
          <footer>Wallet credit is applied only after PocketFi verifies a successful payment.</footer>
        </section></div>}
        {!fundOpen && fundMessage && <div className={'fund-toast ' + fundState}>{fundMessage}<button onClick={() => setFundMessage('')} aria-label='Dismiss'><X /></button></div>}

        {!activeService ? <><header className='dash-head'>
          <div><h1>Welcome back, {firstName}.</h1><p>Choose a service or review your recent orders.</p></div>
          <div className='dash-head-stats'>
            <div><small>Balance</small><strong>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(balance)}</strong></div>
            <div><small>Orders</small><strong>0</strong></div>
            <div><small>Delivered</small><strong>0</strong></div>
          </div>
        </header>

        <div className='dash-progress'>
          <span>Account ready</span><i /><i /><i className='muted' />
          <small>Complete your first order to unlock activity insights</small>
        </div></> : <header className='dash-service-hero'>
          <button onClick={() => { window.location.hash = '#account' }}><ArrowRight /> Back to dashboard</button>
          <span>SERVICE MARKETPLACE</span>
          <h1>{serviceMeta[activeService].label}</h1>
          <p>Browse available options and choose the package that fits what you need.</p>
        </header>}

        <section className={'dash-layout ' + (!activeService ? 'overview' : 'service-page')}>
          {!activeService && <aside className='dash-services' id='services'>
            <div className='dash-section-title'><div><span>SERVICES</span><h2>Choose a lane</h2></div><small>04</small></div>
            {serviceOrder.map((key) => {
              const item = serviceMeta[key]
              const Icon = item.icon
              return <button key={key} onClick={() => { window.location.hash = '#account/' + key }}><i><Icon /></i><span><strong>{item.label}</strong><small><b>{catalog[key].length} offers</b><em>Tap to open</em></small></span><ArrowRight /></button>
            })}
            <div className='dash-help' id='support'><Headphones /><div><strong>Need some help?</strong><small>Our support team is ready.</small></div><a href='mailto:hello@lmssocials.com'>Contact support</a></div>
          </aside>}

          {activeService === 'logs' ? <LogsMarketplace /> : activeService === 'boosting' ? <BoostMarketplace /> : activeService === 'numbers' ? <NumbersMarketplace /> : activeService === 'format' ? <FormatMarketplace /> : activeService === 'admin' && user.isAdmin ? <AdminPanel /> : activeService ? <section className='dash-catalog'>
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

          {!activeService && <aside className='dash-activity' id='orders'>
            <div className='activity-head'><span>RECENT ORDERS</span><strong>0/3</strong></div>
            <div className='activity-ring'><PackageCheck /><span>No orders</span></div>
            <h2>Your activity<br />starts here.</h2>
            <p>Completed and active orders will appear in this space.</p>
            <div className='activity-list'>
              <span><i><Clock3 /></i><b>Order placed</b><small>Waiting</small></span>
              <span><i><TrendingUp /></i><b>In progress</b><small>Waiting</small></span>
              <span><i><PackageCheck /></i><b>Delivered</b><small>Waiting</small></span>
            </div>
          </aside>}
        </section>
      </section>
    </main>
  )
}

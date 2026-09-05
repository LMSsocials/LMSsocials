import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CheckCircle2, ChevronDown, Clock3, Globe2, LoaderCircle, MessageSquareText, Search, Server, ShieldCheck, ShoppingCart, Smartphone } from 'lucide-react'
import NumberInbox from './NumberInbox'

const servers = [
  { id: '1', label: 'Budget', note: 'Lowest available cost' },
  { id: '2', label: 'Recommended', note: 'Gold suppliers preferred' },
  { id: '3', label: 'Gold only', note: 'Gold suppliers exclusively' },
]
const money = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(value)

function SearchSelect({ label, value, options, onChange, placeholder, searchPlaceholder, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedLabel = options.find(([id]) => id === value)?.[1]
  const filteredOptions = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? options.filter(([, name]) => name.toLowerCase().includes(term)) : options
  }, [options, query])

  function choose(nextValue) {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
  }

  return <div className={'number-combobox-field' + (open ? ' open' : '')}>
    <span>{label}</span>
    <button type='button' className='number-combobox-trigger' disabled={disabled} aria-expanded={open} onClick={() => { setOpen((current) => !current); setQuery('') }}>
      <span>{selectedLabel || placeholder}</span><ChevronDown />
    </button>
    {open && <div className='number-combobox-menu'>
      <div className='number-combobox-search'><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></div>
      <div className='number-combobox-options'>
        {filteredOptions.length ? filteredOptions.map(([id, name]) => <button type='button' key={id} className={id === value ? 'selected' : ''} onClick={() => choose(id)}><span>{name}</span>{id === value && <Check />}</button>) : <div className='number-combobox-empty'>No matching results</div>}
      </div>
    </div>}
  </div>
}


export default function NumbersMarketplace({ userId }) {
  const [offers, setOffers] = useState([])
  const [status, setStatus] = useState('loading')
  const [serverId, setServerId] = useState('2')
  const [countryId, setCountryId] = useState('')
  const [serviceCode, setServiceCode] = useState('')
  const [purchaseStatus, setPurchaseStatus] = useState('idle')
  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [quoteState, setQuoteState] = useState('idle')
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoteRefresh, setQuoteRefresh] = useState(0)
  const [inboxRefresh, setInboxRefresh] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [pendingRequest, setPendingRequest] = useState(null)
  const purchaseBusy = useRef(false)
  const storageKey = 'lms-number-purchase-' + userId

  useEffect(() => {
    try { setPendingRequest(JSON.parse(sessionStorage.getItem(storageKey) || 'null')) } catch { /* Storage may be disabled. */ }
  }, [storageKey])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/number-services', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Unavailable'); return response.json() })
      .then((payload) => { setOffers(payload.offers || []); setStatus('ready') })
      .catch((error) => { if (error.name !== 'AbortError') setStatus('error') })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [])

  useEffect(() => {
    if (!countryId || !serviceCode) { setQuote(null); setQuoteState('idle'); return }
    const controller = new AbortController()
    setQuote(null); setQuoteState('loading'); setQuoteError('')
    const params = new URLSearchParams({ countryId, serviceCode, serverId })
    fetch('/api/number-quote?' + params, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.message || 'Unable to verify price')
        if (!controller.signal.aborted) { setQuote(payload.quote); setQuoteState('ready') }
      })
      .catch((error) => { if (error.name !== 'AbortError') { setQuoteState('error'); setQuoteError(error.message) } })
    return () => controller.abort()
  }, [countryId, serviceCode, serverId, quoteRefresh])

  const countries = useMemo(() => {
    const values = new Map()
    offers.forEach((offer) => values.set(offer.countryId, offer.country))
    return [...values].sort((a, b) => a[1].localeCompare(b[1]))
  }, [offers])
  const services = useMemo(() => {
    const values = new Map()
    offers.filter((offer) => offer.countryId === countryId).forEach((offer) => values.set(offer.serviceCode, offer.service))
    return [...values].sort((a, b) => a[1].localeCompare(b[1]))
  }, [offers, countryId])
  const selected = offers.find((offer) => offer.countryId === countryId && offer.serviceCode === serviceCode)
  const expired = quote && now >= quote.expiresAt
  const purchasing = purchaseStatus === 'purchasing'

  function changeSelection(change) {
    if (purchaseBusy.current || pendingRequest) return
    change()
    setQuote(null); setQuoteState('idle'); setPurchaseStatus('idle'); setPurchaseMessage('')
  }

  async function purchaseNumber() {
    if (purchaseBusy.current || (!pendingRequest && (!quote || expired || !selected))) return
    purchaseBusy.current = true
    setPurchaseStatus('purchasing'); setPurchaseMessage('')
    const purchase = pendingRequest || { requestId: crypto.randomUUID(), quoteToken: quote.token }
    setPendingRequest(purchase)
    try { sessionStorage.setItem(storageKey, JSON.stringify(purchase)) } catch { /* In-memory request ID still protects retries. */ }
    try {
      const response = await fetch('/api/number-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(purchase),
      })
      const payload = await response.json()
      if (payload.order || payload.retrySafe) {
        setPendingRequest(null)
        try { sessionStorage.removeItem(storageKey) } catch { /* Storage may be disabled. */ }
      }
      if (typeof payload.balance === 'number') window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
      setInboxRefresh((value) => value + 1)
      if (!response.ok) {
        if (payload.refreshQuote) { setQuote(null); setQuoteRefresh((value) => value + 1) }
        throw new Error(payload.message || 'Unable to confirm the purchase. Retry to check this same request.')
      }
      setPurchaseStatus('success')
      setPurchaseMessage(payload.message || 'Your number is ready. Find it in Numbers & SMS codes below.')
      setQuote(null)
      setQuoteRefresh((value) => value + 1)
    } catch (error) {
      setPurchaseStatus('error')
      setPurchaseMessage(error.message || 'Connection interrupted. Use Check purchase to recover this request.')
    } finally { purchaseBusy.current = false }
  }

  return <section className='number-market number-market-v2'>
    <header className='number-market-head'><div className='number-head-icon'><Smartphone /></div><div><span>FOREIGN NUMBERS</span><h2>Buy a verification number</h2><p>Choose a country and service. Receive your number and SMS code right here.</p></div><small><i /> Live inventory</small></header>
    <div className='number-server-grid' aria-label='Number supplier selection'>
      {servers.map((item) => <button key={item.id} type='button' disabled={purchasing || Boolean(pendingRequest)} className={serverId === item.id ? 'active server-live' : 'server-live'} onClick={() => changeSelection(() => setServerId(item.id))}><span><Server /></span><b>{item.label}</b><small>{item.note}</small><em>Option {item.id}</em></button>)}
    </div>
    <div className='number-trust-row'><span><Globe2 /><b>Global coverage</b><small>Live country inventory</small></span><span><Clock3 /><b>SMS updates</b><small>Check codes on this page</small></span><span><ShieldCheck /><b>Cancellation support</b><small>Refund after cancellation is confirmed</small></span></div>
    {pendingRequest && <div className='number-notice' role='status'>You have a purchase awaiting confirmation. Check it before placing another order. <button type='button' onClick={purchaseNumber} disabled={purchasing}>{purchasing ? 'Checking…' : 'Check purchase'}</button></div>}
    {status === 'loading' && <div className='number-loading'><LoaderCircle /><strong>Checking available numbers</strong></div>}
    {status === 'error' && <div className='number-loading error'><MessageSquareText /><strong>Live inventory is temporarily unavailable</strong><span>Your existing numbers are still available below.</span></div>}
    {status === 'ready' && <div className='number-purchase-shell'><div className='number-order-grid'>
      <div className='number-picker'>
        <div className='number-server-note'><CheckCircle2 /><span><strong>{servers.find((item) => item.id === serverId).label} selected</strong><small>Exact price confirmed before you buy</small></span></div>
        <SearchSelect label='Country' value={countryId} options={countries} disabled={purchasing || Boolean(pendingRequest)} placeholder='Select country…' searchPlaceholder='Search countries…' onChange={(value) => changeSelection(() => { setCountryId(value); setServiceCode('') })} />
        <SearchSelect label='Service' value={serviceCode} options={services} disabled={!countryId || purchasing || Boolean(pendingRequest)} placeholder='Select service…' searchPlaceholder='Search services…' onChange={(value) => changeSelection(() => setServiceCode(value))} />
        <div className='number-match'><ShieldCheck /><span><strong>Choose your supplier quality</strong><small>Gold is the provider’s supplier classification. SMS speed and delivery are not guaranteed.</small></span></div>
      </div>
      <aside className={'number-checkout ' + (selected ? 'selected' : '')}>
        <span>ORDER SUMMARY</span>
        {selected ? <><div className='number-selection-icon'><Smartphone /></div><small>{selected.country}</small><h3>{selected.service}</h3><p>One temporary number for receiving an SMS verification code.</p>
          {quoteState === 'loading' && <p role='status'><LoaderCircle className='spin' /> Checking supplier and price…</p>}
          {quoteError && quoteState === 'error' && <p role='alert' className='number-notice error'>{quoteError}</p>}
          {quote && <><div className='number-availability'><i /> {quote.quality === 'gold' ? 'Gold supplier selected' : 'Standard supplier selected'}</div>{serverId === '2' && quote.quality !== 'gold' && <p>No Gold suppliers are available for this selection. This price is for a standard supplier.</p>}<div className='number-total'><span><small>Total price</small><strong>{money(quote.priceKobo / 100)}</strong></span><button type='button' onClick={purchaseNumber} disabled={purchasing || expired || Boolean(pendingRequest)}><ShoppingCart /> {purchasing ? 'Purchasing…' : 'Buy number'}</button></div></>}
          {(expired || quoteState === 'error') && <button className='number-refresh-quote' type='button' disabled={purchasing || Boolean(pendingRequest)} onClick={() => setQuoteRefresh((value) => value + 1)}>{expired ? 'Price expired — refresh price' : 'Check price again'}</button>}
          <p className='number-checkout-note'>Cancellation is available after two minutes if no SMS has arrived. Your full payment is refunded when cancellation is confirmed.</p>
        </> : <div className='number-empty'><Globe2 /><strong>Build your order</strong><small>Select a country and service to see the price.</small></div>}
      </aside>
    </div></div>}
    {purchaseMessage && <p className={'number-notice ' + (purchaseStatus === 'error' ? 'error' : '')} role='status'>{purchaseMessage}</p>}
    <NumberInbox refreshKey={inboxRefresh} />
  </section>
}

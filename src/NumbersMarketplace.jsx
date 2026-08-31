import React, { useEffect, useMemo, useState } from 'react'
import {
  Check, CheckCircle2, ChevronDown, Clock3, Globe2, LoaderCircle, LockKeyhole,
  MessageSquareText, Radio, Search, Server, ShieldCheck, ShoppingCart, Smartphone,
} from 'lucide-react'

const servers = [
  { id: '1', label: 'Server 1', note: 'Standard access', enabled: true, live: true },
  { id: '2', label: 'Server 2', note: 'Priority access', enabled: true, live: true },
  { id: '3', label: 'Server 3', note: 'Premium access', enabled: true, live: true },
]
const money = (value, currency = 'USD') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 3 }).format(value)


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

export default function NumbersMarketplace() {
  const [offers, setOffers] = useState([])
  const [currency, setCurrency] = useState('USD')
  const [status, setStatus] = useState('loading')
  const [serverId, setServerId] = useState('2')
  const [countryId, setCountryId] = useState('')
  const [serviceCode, setServiceCode] = useState('')
  const [purchaseStatus, setPurchaseStatus] = useState('idle')
  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [purchasedOrder, setPurchasedOrder] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/number-services', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Unavailable'); return response.json() })
      .then((payload) => { setOffers(payload.offers || []); setCurrency(payload.currency || 'USD'); setStatus('ready') })
      .catch((error) => { if (error.name !== 'AbortError') setStatus('error') })
    return () => controller.abort()
  }, [])

  const countries = useMemo(() => {
    const values = new Map()
    offers.forEach((offer) => values.set(offer.countryId, offer.country))
    return [...values].sort((first, second) => first[1].localeCompare(second[1]))
  }, [offers])
  const services = useMemo(() => {
    const values = new Map()
    offers.filter((offer) => offer.countryId === countryId).forEach((offer) => values.set(offer.serviceCode, offer.service + ' - ' + money(offer.prices?.[serverId] ?? offer.price, currency)))
    return [...values].sort((first, second) => first[1].localeCompare(second[1]))
  }, [offers, countryId, serverId, currency])
  const selected = offers.find((offer) => offer.countryId === countryId && offer.serviceCode === serviceCode)
  const selectedPrice = selected?.prices?.[serverId] ?? selected?.price
  const currentStep = !serverId ? 1 : !countryId ? 1 : !serviceCode ? 2 : 3


  async function purchaseNumber() {
    if (!selected || purchaseStatus === 'purchasing') return
    setPurchaseStatus('purchasing')
    setPurchaseMessage('')
    setPurchasedOrder(null)
    try {
      const response = await fetch('/api/number-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          serverId,
          countryId,
          serviceCode,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const required = payload.required ? ` Required: ${money(payload.required, 'NGN')}.` : ''
        throw new Error((payload.message || 'Number purchase failed.') + required)
      }
      setPurchasedOrder(payload.order)
      setPurchaseStatus('success')
      setPurchaseMessage(`Purchased successfully. Wallet balance: ${money(payload.balance, 'NGN')}.`)
    } catch (error) {
      setPurchaseStatus('error')
      setPurchaseMessage(error.message)
    }
  }

  return <section className='number-market number-market-v2'>
    <header className='number-market-head'>
      <div className='number-head-icon'><Smartphone /></div>
      <div><span>FOREIGN NUMBERS</span><h2>Buy a verification number</h2><p>Select the live server, country, and service to see current availability.</p></div>
      <small><i /> Live inventory</small>
    </header>

    <div className='number-server-grid' aria-label='Number servers'>
      {servers.map((item) => <button key={item.id} type='button' disabled={!item.enabled} className={(serverId === item.id ? 'active ' : '') + (item.live ? 'server-live' : '')} onClick={() => { setServerId(item.id); setPurchaseStatus('idle'); setPurchaseMessage(''); setPurchasedOrder(null) }}>
        <span><Server /></span><b>{item.label}</b><small>{item.note}</small>{item.live ? <em><Radio /> Live</em> : <em><LockKeyhole /> Unavailable</em>}
      </button>)}
    </div>

    <div className='number-trust-row'><span><Globe2 /><b>Global coverage</b><small>Live country inventory</small></span><span><Clock3 /><b>Instant updates</b><small>Availability synced now</small></span><span><ShieldCheck /><b>Protected checkout</b><small>No charge without delivery</small></span></div>

    {status === 'loading' && <div className='number-loading'><LoaderCircle /><strong>Checking available numbers</strong><span>Syncing Server 2 inventory.</span></div>}
    {status === 'error' && <div className='number-loading error'><MessageSquareText /><strong>Live inventory is temporarily unavailable</strong><span>Please refresh and try again shortly.</span></div>}

    {status === 'ready' && <div className='number-purchase-shell'>
      <div className='number-stepper' aria-label={`Step ${currentStep} of 3`}><span className='done'><b>1</b><small>Country</small></span><i className={countryId ? 'done' : ''} /><span className={countryId ? 'done' : ''}><b>2</b><small>Service</small></span><i className={serviceCode ? 'done' : ''} /><span className={serviceCode ? 'done' : ''}><b>3</b><small>Confirm</small></span></div>
      <div className='number-order-grid'>
        <div className='number-picker'>
          <div className='number-server-note'><CheckCircle2 /><span><strong>Server {serverId} selected</strong><small>Live numbers for all available countries</small></span></div>
          <SearchSelect label='Country' value={countryId} options={countries} placeholder='Select country...' searchPlaceholder='Search countries...' onChange={(value) => { setCountryId(value); setServiceCode('') }} />
          <SearchSelect label='Service' value={serviceCode} options={services} placeholder={countryId ? 'Select service...' : 'Choose a country first'} searchPlaceholder='Search services...' disabled={!countryId} onChange={setServiceCode} />
          <div className='number-match'><Check /><span><strong>{countryId ? services.length.toLocaleString() : countries.length.toLocaleString()} {countryId ? 'services' : 'countries'} available</strong><small>Inventory is fetched directly from the live provider.</small></span></div>
        </div>

        <aside className={'number-checkout ' + (selected ? 'selected' : '')}>
          <span>ORDER SUMMARY</span>
          {selected ? <><div className='number-selection-icon'><Smartphone /></div><small>{selected.country}</small><h3>{selected.service}</h3><p>One temporary number for receiving an SMS verification code.</p><div className='number-availability'><i /> {selected.available.toLocaleString()} available now</div><div className='number-total'><span><small>Provider price</small><strong>{money(selectedPrice, currency)}</strong></span><button type='button' onClick={purchaseNumber} disabled={purchaseStatus === 'purchasing'}><ShoppingCart /> {purchaseStatus === 'purchasing' ? 'Purchasing...' : 'Buy number'}</button></div>{purchasedOrder && <div className='number-purchased'><strong>{purchasedOrder.phoneNumber}</strong><small>Activation #{purchasedOrder.activationId}</small></div>}<em className={purchaseStatus === 'error' ? 'purchase-error' : ''}>{purchaseMessage || 'Your wallet is debited before the provider reservation. Failed reservations are refunded automatically.'}</em></> : <div className='number-empty'><Globe2 /><strong>Build your order</strong><small>Select a country and service to see the live price.</small></div>}
        </aside>
      </div>
    </div>}
  </section>
}

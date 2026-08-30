import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Facebook, Ghost, Hash, Instagram, Link2, Linkedin,
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
  const estimatedPrice = selectedService && quantity ? selectedService.pricePerThousand * Number(quantity) / 1000 : 0

  const choosePlatform = (name) => {
    setSelectedPlatform(name)
    setQuery('')
    setCategory('All')
    setServiceId('')
    setTarget('')
    setQuantity('')
  }

  const chooseService = (id) => {
    setServiceId(id)
    const service = services.find((item) => item.id === id)
    setQuantity(service ? String(service.min || 1) : '')
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
          <button key={name} className={tone + (selectedPlatform === name ? ' active' : '')} onClick={() => choosePlatform(name)}>
            <i><Icon /></i><strong>{name}</strong><span>{count.toLocaleString()} services</span>
          </button>
        ))}
      </div>}

      {status === 'ready' && <>
        <section className='boost-order-form'>
          <label className='boost-search-field'>
            <Search />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setServiceId('') }} placeholder='Search services...' />
          </label>
          <label className='boost-select-field'>
            <span>Category</span>
            <select value={category} onChange={(event) => { setCategory(event.target.value); setServiceId('') }}>
              {categories.map((item) => <option key={item} value={item}>{item === 'All' ? 'All categories' : item}</option>)}
            </select>
          </label>
          <label className='boost-select-field'>
            <span>Service</span>
            <select value={serviceId} onChange={(event) => chooseService(event.target.value)}>
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
              <label><span><Link2 /> Target link</span><input type='url' value={target} onChange={(event) => setTarget(event.target.value)} placeholder='https://...' /></label>
              <label><span><Hash /> Quantity</span><input type='number' min={selectedService.min} max={selectedService.max} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            </div>
            <div className='boost-order-summary'>
              <div><small>Estimated total</small><strong>{money(estimatedPrice)}</strong></div>
              <button disabled={!target || Number(quantity) < selectedService.min || Number(quantity) > selectedService.max}><ShoppingBag /> Continue</button>
            </div>
          </div>}
        </section>
        {false && <div className='boost-service-list'>
          {visibleServices.map((service) => (
            <article key={service.id}>
              <div><span>{service.category}</span><h3>{service.name}</h3><p>{service.type} · Min {service.min.toLocaleString()} · Max {service.max.toLocaleString()}</p></div>
              <div className='boost-service-price'><small>per 1,000</small><strong>{money(service.pricePerThousand)}</strong></div>
              <button onClick={() => window.alert(service.name + ' ordering is coming next.')}>Select <ArrowRight /></button>
            </article>
          ))}
        </div>}
      </>}
    </section>
  )
}

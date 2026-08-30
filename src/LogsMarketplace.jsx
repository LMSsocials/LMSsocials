import React, { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, Boxes, Cloud, RefreshCw, ShieldCheck } from 'lucide-react'

const managedProducts = [
  { id: 'm1', platform: 'Facebook', title: 'USA Facebook � 20500 friends', detail: 'Aged profiles � 20122024 � client verified', stock: 24, price: 2900 },
  { id: 'm2', platform: 'Facebook', title: 'Facebook Marketplace ready', detail: 'Active marketplace � aged account', stock: 11, price: 4200 },
  { id: 'm3', platform: 'Instagram', title: 'Old Instagram with posts', detail: 'USA profile � email included', stock: 16, price: 1950 },
  { id: 'm4', platform: 'X / Twitter', title: 'Old X account � empty', detail: 'Registration 20092020', stock: 89, price: 1000 },
]

const demoSyncedProducts = [
  { code: 'BA-200345', platform: 'TikTok', title: 'USA TikTok with email access', detail: 'Age: 12 years � supplier fulfilled', stock: 100, price: 5600 },
  { code: 'BA-300004', platform: 'Instagram', title: 'Instagram starter account', detail: 'Instant API delivery', stock: 3449, price: 1800 },
  { code: 'BA-400118', platform: 'Facebook', title: 'Facebook aged account', detail: 'Live supplier inventory', stock: 73, price: 4900 },
]

const platforms = ['All', 'Facebook', 'Instagram', 'TikTok', 'X / Twitter']
const money = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)

export default function LogsMarketplace() {
  const [source, setSource] = useState('managed')
  const [platform, setPlatform] = useState('All')
  const [syncedProducts, setSyncedProducts] = useState([])
  const [syncState, setSyncState] = useState('idle')

  useEffect(() => {
    if (source !== 'bulkacc' || syncState !== 'idle') return
    setSyncState('loading')
    fetch('/api/bulkacc-products?pageIndex=1&pageSize=30')
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable')
        return response.json()
      })
      .then(({ items }) => {
        setSyncedProducts(items || [])
        setSyncState('ready')
      })
      .catch(() => {
        setSyncedProducts(demoSyncedProducts)
        setSyncState('demo')
      })
  }, [source, syncState])

  const products = source === 'managed' ? managedProducts : syncedProducts
  const visibleProducts = products.filter((item) => platform === 'All' || item.platform === platform)

  return (
    <section className='logs-market'>
      <header className='logs-head'>
        <div><span>ACCOUNT MARKETPLACE</span><h2>Quality logs, two ways.</h2><p>Choose locally managed stock or browse live supplier inventory.</p></div>
        <div className='logs-source-tabs'>
          <button className={source === 'managed' ? 'active' : ''} onClick={() => { setSource('managed'); setPlatform('All') }}><Boxes /> Managed stock</button>
          <button className={source === 'bulkacc' ? 'active' : ''} onClick={() => { setSource('bulkacc'); setPlatform('All') }}><Cloud /> Live API</button>
        </div>
      </header>

      <div className={'logs-source-note ' + source}>
        {source === 'managed' ? <ShieldCheck /> : <RefreshCw />}
        <div><strong>{source === 'managed' ? 'Uploaded and fulfilled by LMS' : 'Live supplier catalogue'}</strong><span>{source === 'managed' ? 'Stock is checked and managed directly by the store owner.' : syncState === 'demo' ? 'Preview data shown until the secure server connection is configured.' : 'Prices and availability are synced through the live inventory API.'}</span></div>
        <small>{source === 'managed' ? 'MANAGED' : syncState === 'loading' ? 'SYNCINg&' : 'API SYNC'}</small>
      </div>

      <div className='logs-platforms'>
        {platforms.map((item) => <button key={item} className={platform === item ? 'active' : ''} onClick={() => setPlatform(item)}>{item}</button>)}
      </div>

      <div className='logs-products'>
        {visibleProducts.map((product) => (
          <article key={product.id || product.code} className={source === 'bulkacc' ? 'supplier' : ''}>
            <div className={'log-platform ' + product.platform.toLowerCase().replaceAll(' ', '-').replace('/', '')}>{product.platform.charAt(0)}</div>
            <div className='log-copy'><span>{product.platform}</span><h3>{product.title}</h3><p>{product.detail}</p><div><b>{product.stock} pcs.</b><strong>{money(product.price)}</strong></div></div>
            <button disabled={!product.stock}>{product.stock ? 'Buy' : 'Sold'} <ArrowRight /></button>
          </article>
        ))}
        {!visibleProducts.length && syncState !== 'loading' && <div className='logs-empty'><BadgeCheck /><strong>No products in this filter</strong><span>Try another platform.</span></div>}
      </div>
    </section>
  )
}

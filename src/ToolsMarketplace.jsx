import React, { useEffect, useState } from 'react'
import { ArrowUpRight, Check, LoaderCircle, ShoppingBag, Wrench } from 'lucide-react'

const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(kobo || 0) / 100)
const requestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function ToolsMarketplace() {
  const [tools, setTools] = useState([])
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')
  const [buying, setBuying] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/tools', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to load tools')
      if (!cancelled) { setTools(payload.tools || []); setState('success') }
    }).catch((error) => { if (!cancelled) { setMessage(error.message); setState('error') } })
    return () => { cancelled = true }
  }, [])

  async function purchase(tool) {
    if (buying || tool.purchased) return
    setBuying(tool._id); setMessage('')
    try {
      const response = await fetch('/api/tool-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolId: tool._id, requestId: requestId() }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Purchase failed')
      setTools((current) => current.map((item) => item._id === tool._id ? payload.tool : item))
      setMessage('Purchase complete. Your tool link is now unlocked.')
      window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
    } catch (error) { setMessage(error.message) }
    finally { setBuying('') }
  }

  return <section className='dash-catalog tools-market'>
    <div className='dash-section-title'><div><span>CURATED WEBSITES</span><h2>Working Tools</h2></div><small className='live'><i /> Available now</small></div>
    <p className='tools-intro'>Purchase a tool to unlock its private website link. Purchased links remain available in this section.</p>
    {message && <div className='voucher-message'>{message}</div>}
    {state === 'loading' && <div className='fund-loading'><LoaderCircle className='spin' /><span>Loading tools...</span></div>}
    {state === 'error' && <p className='tools-empty'>{message}</p>}
    {state === 'success' && !tools.length && <p className='tools-empty'>No tools have been added yet. Check back soon.</p>}
    {state === 'success' && tools.length > 0 && <div className='tools-grid'>{tools.map((tool, index) => <article key={tool._id}>
      <div className='tools-card-top'><i><Wrench /></i><span>{String(index + 1).padStart(2, '0')}</span></div>
      <h3>{tool.name}</h3><p>{tool.purchased ? 'Purchased · Link unlocked' : 'Website link unlocks after purchase'}</p>
      <footer><strong>{tool.priceKobo ? money(tool.priceKobo) : 'Free'}</strong>{tool.purchased
        ? <a href={tool.url} target='_blank' rel='noopener noreferrer'><Check /> Open tool <ArrowUpRight /></a>
        : <button type='button' disabled={Boolean(buying)} onClick={() => purchase(tool)}>{buying === tool._id ? <LoaderCircle className='spin' /> : <ShoppingBag />} Buy now</button>}</footer>
    </article>)}</div>}
  </section>
}

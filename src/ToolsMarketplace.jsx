import React, { useEffect, useState } from 'react'
import { ArrowUpRight, LoaderCircle, Wrench } from 'lucide-react'

const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(kobo || 0) / 100)

export default function ToolsMarketplace() {
  const [tools, setTools] = useState([])
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/tools', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to load tools')
      if (!cancelled) { setTools(payload.tools || []); setState('success') }
    }).catch((error) => { if (!cancelled) { setMessage(error.message); setState('error') } })
    return () => { cancelled = true }
  }, [])

  return <section className='dash-catalog tools-market'>
    <div className='dash-section-title'><div><span>CURATED WEBSITES</span><h2>Working Tools</h2></div><small className='live'><i /> Available now</small></div>
    <p className='tools-intro'>Useful websites selected by LMS Socials. Open any tool to continue on its website.</p>
    {state === 'loading' && <div className='fund-loading'><LoaderCircle className='spin' /><span>Loading tools...</span></div>}
    {state === 'error' && <p className='tools-empty'>{message}</p>}
    {state === 'success' && !tools.length && <p className='tools-empty'>No tools have been added yet. Check back soon.</p>}
    {state === 'success' && tools.length > 0 && <div className='tools-grid'>{tools.map((tool, index) => <article key={tool._id}>
      <div className='tools-card-top'><i><Wrench /></i><span>{String(index + 1).padStart(2, '0')}</span></div>
      <h3>{tool.name}</h3><p>{new URL(tool.url).hostname.replace(/^www\./, '')}</p>
      <footer><strong>{tool.priceKobo ? money(tool.priceKobo) : 'Free'}</strong><a href={tool.url} target='_blank' rel='noopener noreferrer'>Buy now <ArrowUpRight /></a></footer>
    </article>)}</div>}
  </section>
}

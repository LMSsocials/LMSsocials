import React, { useEffect, useState } from 'react'
import { ArrowDownToLine, Check, Eye, ImageIcon, LoaderCircle, Search, ShoppingBag, X } from 'lucide-react'

const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(kobo || 0) / 100)
const requestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function PicturesMarketplace() {
  const [pictures, setPictures] = useState([])
  const [query, setQuery] = useState('')
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')
  const [buying, setBuying] = useState('')
  const [previewing, setPreviewing] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/pictures', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to load pictures')
      if (!cancelled) { setPictures(payload.pictures || []); setState('success') }
    }).catch((error) => { if (!cancelled) { setMessage(error.message); setState('error') } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!previewing) return undefined
    const closePreview = (event) => { if (event.key === 'Escape') setPreviewing(null) }
    window.addEventListener('keydown', closePreview)
    return () => window.removeEventListener('keydown', closePreview)
  }, [previewing])

  async function purchase(picture) {
    if (buying || picture.purchased) return
    setBuying(picture._id); setMessage('')
    try {
      const response = await fetch('/api/picture-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pictureId: picture._id, requestId: requestId() }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Purchase failed')
      setPictures((current) => current.map((item) => item._id === picture._id ? payload.picture : item))
      setMessage('Purchase complete. Your picture download link is now unlocked.')
      window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
    } catch (error) { setMessage(error.message) }
    finally { setBuying('') }
  }

  const visiblePictures = pictures.filter((picture) => !query.trim() || `${picture.title} ${picture.description}`.toLowerCase().includes(query.trim().toLowerCase()))

  return <section className='dash-catalog pictures-market'>
    <div className='dash-section-title'><div><span>PREVIEW GALLERY</span><h2>Working Pictures</h2></div><small className='live'><i /> Ready to download</small></div>
    <p className='tools-intro'>Preview every picture before you buy. The private full-quality download link appears only after payment.</p>
    <div className='voucher-tools'><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search pictures...' /></label></div>
    {message && <div className='voucher-message'>{message}</div>}
    {state === 'loading' && <div className='fund-loading'><LoaderCircle className='spin' /><span>Loading pictures...</span></div>}
    {state === 'error' && <p className='tools-empty'>{message}</p>}
    {state === 'success' && !visiblePictures.length && <div className='pictures-empty'><ImageIcon /><strong>No pictures available</strong><span>New previews will appear here when they are published.</span></div>}
    {state === 'success' && visiblePictures.length > 0 && <div className='pictures-grid'>{visiblePictures.map((picture) => <article key={picture._id}>
      <button className='picture-preview' type='button' aria-label={`Preview ${picture.title}`} onClick={() => setPreviewing(picture)}><img src={picture.previewUrl} alt={`Preview of ${picture.title}`} loading='lazy' /><span><Eye /> Preview</span></button>
      <div className='picture-copy'>{picture.purchased && <small><Check /> PURCHASED</small>}<h3>{picture.title}</h3><p>{picture.description || 'Full-quality picture download.'}</p></div>
      <footer><strong>{picture.priceKobo ? money(picture.priceKobo) : 'Free'}</strong>{picture.purchased
        ? <a href={picture.downloadUrl} target='_blank' rel='noopener noreferrer'><ArrowDownToLine /> Download</a>
        : <button type='button' disabled={Boolean(buying)} onClick={() => purchase(picture)}>{buying === picture._id ? <LoaderCircle className='spin' /> : <ShoppingBag />} Buy picture</button>}</footer>
    </article>)}</div>}
    {previewing && <div className='picture-lightbox-backdrop' role='presentation' onMouseDown={() => setPreviewing(null)}><section className='picture-lightbox' role='dialog' aria-modal='true' aria-label={`${previewing.title} preview`} onMouseDown={(event) => event.stopPropagation()}>
      <button type='button' aria-label='Close picture preview' onClick={() => setPreviewing(null)}><X /></button>
      <img src={previewing.previewUrl} alt={`Preview of ${previewing.title}`} />
      <footer><strong>{previewing.title}</strong>{previewing.description && <span>{previewing.description}</span>}</footer>
    </section></div>}
  </section>
}

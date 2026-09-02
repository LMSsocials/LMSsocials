import React, { useEffect, useMemo, useState } from 'react'
import { BookOpen, Download, FileText, LoaderCircle, Search, ShoppingBag } from 'lucide-react'

const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(kobo || 0) / 100)
const requestId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const fileSize = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export default function FormatMarketplace() {
  const [files, setFiles] = useState([])
  const [orders, setOrders] = useState([])
  const [query, setQuery] = useState('')
  const [state, setState] = useState('loading')
  const [buying, setBuying] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    setState('loading')
    try {
      const [filesResponse, ordersResponse] = await Promise.all([fetch('/api/format-products'), fetch('/api/format-orders')])
      const filesPayload = await filesResponse.json()
      const ordersPayload = await ordersResponse.json()
      if (!filesResponse.ok) throw new Error(filesPayload.message || 'Unable to load PDFs')
      if (!ordersResponse.ok) throw new Error(ordersPayload.message || 'Unable to load your library')
      setFiles(filesPayload.files || [])
      setOrders(ordersPayload.orders || [])
      setState('ready')
    } catch (error) { setMessage(error.message); setState('error') }
  }

  useEffect(() => { load() }, [])
  const purchased = useMemo(() => new Map(orders.map((order) => [order.assetId, order])), [orders])
  const visibleFiles = files.filter((file) => !query.trim() || `${file.title} ${file.description} ${file.fileName}`.toLowerCase().includes(query.trim().toLowerCase()))

  async function purchase(file) {
    if (buying || purchased.has(file._id)) return
    setBuying(file._id); setMessage('')
    try {
      const response = await fetch('/api/format-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId: file._id, requestId: requestId() }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Purchase failed')
      setOrders((current) => [payload.order, ...current])
      setMessage('Purchase complete. Your PDF is ready to download.')
      window.dispatchEvent(new CustomEvent('wallet-balance', { detail: payload.balance }))
    } catch (error) { setMessage(error.message) }
    finally { setBuying('') }
  }

  return <section className='logs-market voucher-market format-market'>
    <header className='logs-head'>
      <div><span>PDF LIBRARY</span><h2>Downloadable formats.</h2><p>Browse the available PDF resources. Purchased files stay in your library for future downloads.</p></div>
      <div className='voucher-trust'><BookOpen /><span><strong>PDF files only</strong><small>Private access after purchase</small></span></div>
    </header>
    <div className='voucher-tools'><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Search PDFs...' /></label></div>
    {message && <div className='voucher-message'>{message}</div>}
    {state === 'loading' ? <div className='logs-empty'><LoaderCircle className='spin' /><strong>Loading PDFs</strong></div> : <div className='format-file-grid'>
      {visibleFiles.map((file) => {
        const order = purchased.get(file._id)
        return <article key={file._id}>
          <i><FileText /></i>
          <div><span>PDF · {fileSize(file.fileSize)}</span><h3>{file.title}</h3><p>{file.description || file.fileName}</p></div>
          <strong>{money(file.priceKobo)}</strong>
          {order ? <a href={order.downloadUrl}><Download /> Download</a> : <button disabled={Boolean(buying)} onClick={() => purchase(file)}>{buying === file._id ? <LoaderCircle className='spin' /> : <ShoppingBag />} Buy PDF</button>}
        </article>
      })}
      {!visibleFiles.length && <div className='logs-empty'><FileText /><strong>No PDFs available</strong><span>Published PDF uploads will appear here.</span></div>}
    </div>}
    {orders.length > 0 && <section className='format-library'>
      <div className='dash-section-title'><div><span>YOUR LIBRARY</span><h2>Purchased PDFs</h2></div><small>{orders.length}</small></div>
      <div>{orders.map((order) => <article key={order._id}><FileText /><span><strong>{order.title}</strong><small>{new Date(order.createdAt).toLocaleDateString()} · {order.fileName}</small></span><a href={order.downloadUrl}><Download /> Download</a></article>)}</div>
    </section>}
  </section>
}

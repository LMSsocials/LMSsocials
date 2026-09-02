import React, { useEffect, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { CircleUserRound, FileText, Layers3, LoaderCircle, PackagePlus, ShieldCheck, UploadCloud } from 'lucide-react'

const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(kobo || 0) / 100)

export default function AdminPanel() {
  const [tab, setTab] = useState('vouchers')
  const [assets, setAssets] = useState([])
  const [products, setProducts] = useState([])
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)

  const loadData = async () => {
    const [assetsResponse, vouchersResponse] = await Promise.all([fetch('/api/admin/assets'), fetch('/api/admin/vouchers')])
    const assetsPayload = await assetsResponse.json().catch(() => ({}))
    const vouchersPayload = await vouchersResponse.json().catch(() => ({}))
    if (assetsResponse.ok) setAssets(assetsPayload.assets || [])
    if (vouchersResponse.ok) setProducts(vouchersPayload.products || [])
  }

  useEffect(() => { loadData().catch((error) => setMessage(error.message)) }, [])

  async function postVoucher(body, form) {
    setState('loading'); setMessage('')
    const response = await fetch('/api/admin/vouchers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setState('error'); setMessage(payload.message || 'Request failed'); return }
    form.reset(); setState('success')
    setMessage(body.action === 'createProduct' ? 'Log product published.' : `${payload.insertedCount} unique delivery codes added${payload.skippedCount ? `; ${payload.skippedCount} duplicates skipped` : ''}.`)
    await loadData()
  }

  const createProduct = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const image = formData.get('image')
    setState('loading'); setMessage('')
    try {
      let imageUrl = ''
      if (image instanceof File && image.size) {
        const imageData = new FormData()
        imageData.set('image', image)
        const imageResponse = await fetch('/api/admin/voucher-images', { method: 'POST', body: imageData })
        const imagePayload = await imageResponse.json().catch(() => ({}))
        if (!imageResponse.ok) throw new Error(imagePayload.message || 'Image upload failed')
        imageUrl = imagePayload.imageUrl
      }
      const data = Object.fromEntries(formData)
      delete data.image
      await postVoucher({ action: 'createProduct', ...data, imageUrl }, form)
    } catch (error) {
      setState('error'); setMessage(error.message || 'Unable to create product')
    }
  }

  const addInventory = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    await postVoucher({ action: 'addInventory', ...Object.fromEntries(new FormData(form)) }, form)
  }

  const uploadAsset = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const file = formData.get('file')
    setState('loading'); setMessage(''); setUploadProgress(0)
    try {
      if (!(file instanceof File) || !file.size) throw new Error('Choose a file to upload')
      if (file.size > 100 * 1024 * 1024) throw new Error('Files must be 100 MB or smaller')
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const blob = await upload(`formats/${Date.now()}-${safeName}`, file, {
        access: 'private',
        handleUploadUrl: '/api/admin/assets/upload',
        contentType: file.type || undefined,
        multipart: file.size > 10 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(percentage)),
      })
      const response = await fetch('/api/admin/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.get('title'), description: formData.get('description'),
          category: formData.get('category'), price: formData.get('price'),
          fileName: file.name, blobUrl: blob.url,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Upload failed')
      form.reset(); setState('success'); setMessage('PDF published and available in the Format library.'); await loadData()
    } catch (error) {
      setState('error'); setMessage(error.message || 'Upload failed')
    } finally {
      setUploadProgress(0)
    }
  }

  return <section className='admin-panel'>
    <header><span><ShieldCheck /></span><div><small>ADMIN WORKSPACE</small><h2>Store inventory</h2><p>Create log listings, bulk-load unique delivery codes, and manage downloadable products.</p></div></header>
    <div className='admin-tabs'>
      <button className={tab === 'vouchers' ? 'active' : ''} onClick={() => { setTab('vouchers'); setMessage('') }}><CircleUserRound /> Logs</button>
      <button className={tab === 'files' ? 'active' : ''} onClick={() => { setTab('files'); setMessage('') }}><FileText /> Files & formats</button>
    </div>
    {message && <p className={'admin-message banner ' + state}>{message}</p>}

    {tab === 'vouchers' ? <>
      <div className='admin-grid voucher-admin-grid'>
        <form onSubmit={createProduct}>
          <div className='admin-form-title'><PackagePlus /><span><strong>Create log product</strong><small>This becomes visible in the customer marketplace.</small></span></div>
          <label>Product title<input name='title' required maxLength='120' placeholder='Premium digital log package' /></label>
          <div className='admin-form-row'><label>Brand<input name='brand' required maxLength='60' placeholder='Product brand' /></label><label>Category<input name='category' maxLength='60' defaultValue='Logs' /></label></div>
          <label>Description<textarea name='description' maxLength='500' placeholder='Product details and delivery information' /></label>
          <label className='admin-product-image'><UploadCloud /><span><strong>Product image</strong><small>JPG, PNG, WebP or GIF · max 3 MB</small></span><input name='image' type='file' accept='.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif' required /></label>
          <label>Price (NGN)<input name='price' type='number' min='100' step='50' required /></label>
          <button disabled={state === 'loading'}>{state === 'loading' ? <LoaderCircle className='spin' /> : <PackagePlus />} Publish product</button>
        </form>

        <form onSubmit={addInventory}>
          <div className='admin-form-title'><Layers3 /><span><strong>Bulk upload codes</strong><small>One unused delivery code per line. Maximum 500.</small></span></div>
          <label>Log product<select name='productId' required defaultValue=''><option value='' disabled>Select a product</option>{products.map((product) => <option value={product._id} key={product._id}>{product.title} · {product.stockCount} in stock</option>)}</select></label>
          <label>Delivery codes<textarea className='code-textarea' name='codes' required spellCheck='false' placeholder={'CODE-ONE\nCODE-TWO\nCODE-THREE'} /></label>
          <p className='admin-security-note'><ShieldCheck /> Codes are encrypted before storage, deduplicated, and never returned by public product APIs.</p>
          <button disabled={state === 'loading' || !products.length}>{state === 'loading' ? <LoaderCircle className='spin' /> : <UploadCloud />} Add codes to stock</button>
        </form>
      </div>
      <aside className='admin-product-list'><div><span>LOG PRODUCTS</span><strong>{products.length}</strong></div>{products.length ? products.map((product) => <article key={product._id}><CircleUserRound /><span><strong>{product.title}</strong><small>{money(product.priceKobo)} · {product.stockCount} available</small></span><em>{product.isPublished ? 'live' : 'draft'}</em></article>) : <p>Create your first log product, then add codes to its stock.</p>}</aside>
    </> : <div className='admin-grid'>
      <form onSubmit={uploadAsset}>
        <input name='category' type='hidden' value='formats' />
        <label>Title<input name='title' required maxLength='120' placeholder='Product title' /></label>
        <label>Description<textarea name='description' maxLength='500' placeholder='What the customer receives' /></label>
        <label>Price (NGN)<input name='price' type='number' min='8000' step='500' defaultValue='8000' required /></label>
        <label className='admin-file'><UploadCloud /><span><strong>Choose file</strong><small>PDF file · max 100 MB</small></span><input name='file' type='file' accept='.pdf,application/pdf' required /></label>
        <button disabled={state === 'loading'}>{state === 'loading' ? <LoaderCircle className='spin' /> : <UploadCloud />}{state === 'loading' ? `Uploading${uploadProgress ? ` ${uploadProgress}%` : '...'}` : 'Save draft'}</button>
      </form>
      <aside><div><span>UPLOADS</span><strong>{assets.length}</strong></div>{assets.length ? assets.map((asset) => <article key={asset._id}><FileText /><span><strong>{asset.title}</strong><small>{asset.fileName} · {money(asset.priceKobo)}</small></span><em>{asset.status}</em></article>) : <p>No uploads yet.</p>}</aside>
    </div>}
  </section>
}
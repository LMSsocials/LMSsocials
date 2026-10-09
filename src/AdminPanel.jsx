import React, { useCallback, useEffect, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { Ban, CircleUserRound, ExternalLink, FileText, ImageIcon, Layers3, LoaderCircle, PackagePlus, Search, ShieldCheck, SlidersHorizontal, Trash2, UploadCloud, UserCheck, Users, Wifi, Wrench } from 'lucide-react'
import SocialIcon from './SocialIcon'

const money = (kobo) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(kobo || 0) / 100)
const formatType = (file) => {
  const name = String(file?.name || '').toLowerCase()
  if (name.endsWith('.txt') && (!file?.type || file.type === 'text/plain')) return 'TXT'
  if (name.endsWith('.pdf') && (!file?.type || file.type === 'application/pdf')) return 'PDF'
  return ''
}

export default function AdminPanel() {
  const [tab, setTab] = useState('vouchers')
  const [assets, setAssets] = useState([])
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [pricing, setPricing] = useState({ bulkaccMarkupPercent: 30, sujanMarkupPercent: 30 })
  const [esimPlans, setEsimPlans] = useState([])
  const [esimPrices, setEsimPrices] = useState({})
  const [tools, setTools] = useState([])
  const [editingTool, setEditingTool] = useState(null)
  const [pictures, setPictures] = useState([])
  const [editingPicture, setEditingPicture] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [editingAssetId, setEditingAssetId] = useState('')
  const [assetPrice, setAssetPrice] = useState('')
  const [editingProductId, setEditingProductId] = useState('')
  const [productPrice, setProductPrice] = useState('')

  const loadData = useCallback(async () => {
    const [assetsResponse, vouchersResponse, usersResponse, pricingResponse, esimResponse, toolsResponse, picturesResponse] = await Promise.all([fetch('/api/admin/assets'), fetch('/api/admin/vouchers'), fetch('/api/admin/users'), fetch('/api/admin/pricing'), fetch('/api/admin/esim'), fetch('/api/admin/tools'), fetch('/api/admin/pictures')])
    const assetsPayload = await assetsResponse.json().catch(() => ({}))
    const vouchersPayload = await vouchersResponse.json().catch(() => ({}))
    const usersPayload = await usersResponse.json().catch(() => ({}))
    const pricingPayload = await pricingResponse.json().catch(() => ({}))
    const esimPayload = await esimResponse.json().catch(() => ({}))
    const toolsPayload = await toolsResponse.json().catch(() => ({}))
    const picturesPayload = await picturesResponse.json().catch(() => ({}))
    if (assetsResponse.ok) setAssets(assetsPayload.assets || [])
    if (vouchersResponse.ok) setProducts(vouchersPayload.products || [])
    if (usersResponse.ok) setUsers(usersPayload.users || [])
    if (pricingResponse.ok) setPricing(pricingPayload.pricing || { bulkaccMarkupPercent: 30, sujanMarkupPercent: 30 })
    if (esimResponse.ok) {
      const plans = esimPayload.plans || []
      setEsimPlans(plans)
      setEsimPrices(Object.fromEntries(plans.map((plan) => [plan.id, plan.priceKobo ? String(plan.priceKobo / 100) : ''])))
    }
    if (toolsResponse.ok) setTools(toolsPayload.tools || [])
    if (picturesResponse.ok) setPictures(picturesPayload.pictures || [])
  }, [])

  useEffect(() => { loadData().catch((error) => setMessage(error.message)) }, [loadData])

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
      if (!['PDF', 'TXT'].includes(formatType(file))) throw new Error('Choose a PDF or TXT file')
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
      form.reset(); setState('success'); setMessage(`${formatType(file)} published and available in the Format library.`); await loadData()
    } catch (error) {
      setState('error'); setMessage(error.message || 'Upload failed')
    } finally {
      setUploadProgress(0)
    }
  }

  const editAssetPrice = (asset) => {
    setEditingAssetId(asset._id)
    setAssetPrice(String(Number(asset.priceKobo || 0) / 100))
    setMessage('')
  }

  const saveAssetPrice = async (assetId) => {
    setState('loading'); setMessage('')
    try {
      const response = await fetch('/api/admin/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, price: assetPrice }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to update price')
      setAssets((current) => current.map((asset) => asset._id === assetId ? { ...asset, priceKobo: payload.asset.priceKobo } : asset))
      setEditingAssetId(''); setAssetPrice(''); setState('success'); setMessage('Format price updated.')
    } catch (error) {
      setState('error'); setMessage(error.message || 'Unable to update price')
    }
  }

  const editProductPrice = (product) => {
    setEditingProductId(product._id)
    setProductPrice(String(Number(product.priceKobo || 0) / 100))
    setMessage('')
  }

  const saveProductPrice = async (productId) => {
    setState('loading'); setMessage('')
    try {
      const response = await fetch('/api/admin/vouchers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, price: productPrice }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to update price')
      setProducts((current) => current.map((product) => product._id === productId ? { ...product, priceKobo: payload.product.priceKobo } : product))
      setEditingProductId(''); setProductPrice(''); setState('success'); setMessage('Log product price updated.')
    } catch (error) {
      setState('error'); setMessage(error.message || 'Unable to update price')
    }
  }

  const toggleProductPublication = async (product) => {
    const isPublished = !product.isPublished
    if (!isPublished && !window.confirm(`Move ${product.title} to draft? It will disappear from the customer logs marketplace.`)) return
    setState('loading'); setMessage('')
    try {
      const response = await fetch('/api/admin/vouchers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product._id, isPublished }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to update publication status')
      setProducts((current) => current.map((item) => item._id === product._id ? { ...item, isPublished: payload.product.isPublished } : item))
      setState('success'); setMessage(isPublished ? 'Log product is live in the marketplace.' : 'Log product moved to draft.')
    } catch (error) {
      setState('error'); setMessage(error.message || 'Unable to update publication status')
    }
  }

  const toggleBan = async (user) => {
    const action = user.isBanned ? 'unban' : 'ban'
    if (!window.confirm(`${action === 'ban' ? 'Ban' : 'Unban'} ${user.email}?`)) return
    setState('loading'); setMessage('')
    const response = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, isBanned: !user.isBanned }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setState('error'); setMessage(payload.message || `Unable to ${action} user`); return }
    setUsers((current) => current.map((item) => item.id === user.id ? { ...item, isBanned: !user.isBanned } : item))
    setState('success'); setMessage(`${user.email} has been ${action === 'ban' ? 'banned' : 'unbanned'}.`)
  }

  const savePricing = async (event) => {
    event.preventDefault()
    setState('loading'); setMessage('')
    const response = await fetch('/api/admin/pricing', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulkaccMarkupPercent: Number(pricing.bulkaccMarkupPercent), sujanMarkupPercent: Number(pricing.sujanMarkupPercent) }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setState('error'); setMessage(payload.message || 'Unable to update pricing'); return }
    setPricing(payload.pricing); setState('success'); setMessage('Supplier markups saved. New catalog prices are now active.')
  }

  const saveEsimPricing = async (event) => {
    event.preventDefault()
    setState('loading'); setMessage('')
    const response = await fetch('/api/admin/esim', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prices: esimPrices }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setState('error'); setMessage(payload.message || 'Unable to update eSIM prices'); return }
    const plans = payload.plans || []
    setEsimPlans(plans)
    setEsimPrices(Object.fromEntries(plans.map((plan) => [plan.id, plan.priceKobo ? String(plan.priceKobo / 100) : ''])))
    setState('success'); setMessage('eSIM prices saved. Priced plans are now available for purchase.')
  }

  const saveTool = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    setState('loading'); setMessage('')
    try {
      const response = await fetch('/api/admin/tools', {
        method: editingTool ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTool ? { ...values, toolId: editingTool._id } : values),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to save tool')
      form.reset(); setEditingTool(null); setState('success'); setMessage(editingTool ? 'Tool updated.' : 'Tool added to Quick Actions.'); await loadData()
    } catch (error) {
      setState('error'); setMessage(error.message || 'Unable to save tool')
    }
  }

  const deleteTool = async (tool) => {
    if (!window.confirm(`Remove ${tool.name} from the Tools page?`)) return
    setState('loading'); setMessage('')
    try {
      const response = await fetch('/api/admin/tools', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolId: tool._id }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to remove tool')
      setTools((current) => current.filter((item) => item._id !== tool._id)); setEditingTool(null); setState('success'); setMessage('Tool removed.')
    } catch (error) {
      setState('error'); setMessage(error.message || 'Unable to remove tool')
    }
  }

  const savePicture = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const image = formData.get('previewImage')
    const values = Object.fromEntries(formData)
    delete values.previewImage
    setState('loading'); setMessage('')
    try {
      let previewUrl = editingPicture?.previewUrl || ''
      if (image instanceof File && image.size) {
        const imageData = new FormData()
        imageData.set('image', image)
        const imageResponse = await fetch('/api/admin/picture-previews', { method: 'POST', body: imageData })
        const imagePayload = await imageResponse.json().catch(() => ({}))
        if (!imageResponse.ok) throw new Error(imagePayload.message || 'Preview upload failed')
        previewUrl = imagePayload.previewUrl
      }
      if (!previewUrl) throw new Error('Choose a preview image')
      const response = await fetch('/api/admin/pictures', {
        method: editingPicture ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPicture ? { ...values, previewUrl, pictureId: editingPicture._id } : { ...values, previewUrl }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to save picture')
      form.reset(); setEditingPicture(null); setState('success'); setMessage(editingPicture ? 'Picture updated.' : 'Picture added to Working Pictures.'); await loadData()
    } catch (error) {
      setState('error'); setMessage(error.message || 'Unable to save picture')
    }
  }

  const deletePicture = async (picture) => {
    if (!window.confirm(`Remove ${picture.title} from Working Pictures? Existing order records will remain.`)) return
    setState('loading'); setMessage('')
    try {
      const response = await fetch('/api/admin/pictures', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pictureId: picture._id }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Unable to remove picture')
      setPictures((current) => current.filter((item) => item._id !== picture._id)); setEditingPicture(null); setState('success'); setMessage('Picture removed.')
    } catch (error) {
      setState('error'); setMessage(error.message || 'Unable to remove picture')
    }
  }

  const filteredUsers = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(userSearch.trim().toLowerCase()))
  const selectedUser = users.find((user) => user.id === selectedUserId) || filteredUsers[0]

  return <section className='admin-panel'>
    <header><span><ShieldCheck /></span><div><small>ADMIN WORKSPACE</small><h2>Store inventory</h2><p>Create log listings, bulk-load unique delivery codes, and manage downloadable products.</p></div></header>
    <div className='admin-tabs'>
      <button className={tab === 'vouchers' ? 'active' : ''} onClick={() => { setTab('vouchers'); setMessage('') }}><CircleUserRound /> Logs</button>
      <button className={tab === 'pricing' ? 'active' : ''} onClick={() => { setTab('pricing'); setMessage('') }}><SlidersHorizontal /> Pricing</button>
      <button className={tab === 'esim' ? 'active' : ''} onClick={() => { setTab('esim'); setMessage('') }}><Wifi /> eSIM</button>
      <button className={tab === 'tools' ? 'active' : ''} onClick={() => { setTab('tools'); setMessage('') }}><Wrench /> Working Tools</button>
      <button className={tab === 'pictures' ? 'active' : ''} onClick={() => { setTab('pictures'); setMessage('') }}><ImageIcon /> Working Pictures</button>
      <button className={tab === 'files' ? 'active' : ''} onClick={() => { setTab('files'); setMessage('') }}><FileText /> Files & formats</button>
      <button className={tab === 'users' ? 'active' : ''} onClick={() => { setTab('users'); setMessage('') }}><Users /> Users</button>
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
      <aside className='admin-product-list'><div><span>LOG PRODUCTS</span><strong>{products.length}</strong></div>{products.length ? products.map((product) => <article key={product._id}><SocialIcon category={product.category} title={product.title} /><span><strong>{product.title}</strong><small>{money(product.priceKobo)} · {product.stockCount} available</small></span>{editingProductId === product._id
        ? <div className='admin-asset-price-editor admin-product-price-editor'><input aria-label={`New price for ${product.title}`} type='number' min='100' step='50' value={productPrice} onChange={(event) => setProductPrice(event.target.value)} /><button type='button' disabled={state === 'loading'} onClick={() => saveProductPrice(product._id)}>Save</button><button type='button' onClick={() => { setEditingProductId(''); setProductPrice('') }}>Cancel</button></div>
        : <div className='admin-product-actions'><button className='admin-asset-edit' type='button' onClick={() => editProductPrice(product)}>Edit price</button><button className={`admin-product-publish ${product.isPublished ? 'live' : 'draft'}`} type='button' disabled={state === 'loading'} onClick={() => toggleProductPublication(product)}>{product.isPublished ? 'Move to draft' : 'Publish'}</button></div>}<em className={product.isPublished ? 'live' : 'draft'}>{product.isPublished ? 'live' : 'draft'}</em></article>) : <p>Create your first log product, then add codes to its stock.</p>}</aside>
    </> : tab === 'pricing' ? <section className='admin-pricing'>
      <header><SlidersHorizontal /><div><small>SUPPLIER PRICING</small><h3>Set your marketplace margin</h3><p>These percentages are added to the live supplier cost. Changes apply to catalog prices and checkout immediately.</p></div></header>
      <form onSubmit={savePricing}>
        <label><span>BulkAcc markup</span><div><input type='number' min='0' max='100' step='0.1' value={pricing.bulkaccMarkupPercent} onChange={(event) => setPricing((current) => ({ ...current, bulkaccMarkupPercent: event.target.value }))} required /><strong>%</strong></div><small>For social-account listings supplied by BulkAcc.</small></label>
        <label><span>Sujan Department markup</span><div><input type='number' min='0' max='100' step='0.1' value={pricing.sujanMarkupPercent} onChange={(event) => setPricing((current) => ({ ...current, sujanMarkupPercent: event.target.value }))} required /><strong>%</strong></div><small>For VPN, proxy, and marketplace listings.</small></label>
        <button disabled={state === 'loading'}>{state === 'loading' ? <LoaderCircle className='spin' /> : <SlidersHorizontal />} Save pricing</button>
      </form>
    </section> : tab === 'esim' ? <section className='admin-pricing esim-admin-pricing'>
      <header><Wifi /><div><small>eSIM PRICING</small><h3>Set plan prices</h3><p>Leave a price blank to keep that plan unavailable. Customers can only purchase plans with a saved price.</p></div></header>
      <form onSubmit={saveEsimPricing}>
        {esimPlans.map((plan) => <label key={plan.id}><span>{plan.name}</span><div><strong>₦</strong><input type='number' min='100' step='100' value={esimPrices[plan.id] || ''} onChange={(event) => setEsimPrices((current) => ({ ...current, [plan.id]: event.target.value }))} placeholder='Not set' /></div><small>{plan.description}</small></label>)}
        <button disabled={state === 'loading'}>{state === 'loading' ? <LoaderCircle className='spin' /> : <Wifi />} Save eSIM prices</button>
      </form>
    </section> : tab === 'tools' ? <div className='admin-grid tools-admin-grid'>
      <form onSubmit={saveTool} key={editingTool?._id || 'new-tool'}>
        <div className='admin-form-title'><Wrench /><span><strong>{editingTool ? 'Edit website tool' : 'Add website tool'}</strong><small>This appears in the customer Tools page.</small></span></div>
        <label>Tool name<input name='name' required maxLength='120' defaultValue={editingTool?.name || ''} placeholder='Canva Pro' /></label>
        <label>Website link<input name='url' type='text' inputMode='url' required defaultValue={editingTool?.url || ''} placeholder='https://example.com' /></label>
        <label>Price (NGN)<input name='price' type='number' min='0' step='50' required defaultValue={editingTool ? Number(editingTool.priceKobo || 0) / 100 : ''} placeholder='0 for free' /></label>
        <button disabled={state === 'loading'}>{state === 'loading' ? <LoaderCircle className='spin' /> : <Wrench />}{editingTool ? 'Save changes' : 'Add tool'}</button>
        {editingTool && <button className='admin-cancel-tool' type='button' onClick={() => setEditingTool(null)}>Cancel editing</button>}
      </form>
      <aside><div><span>WEBSITE TOOLS</span><strong>{tools.length}</strong></div>{tools.length ? tools.map((tool) => <article className='admin-tool-row' key={tool._id}>
        <ExternalLink />
        <span><strong>{tool.name}</strong><small>{money(tool.priceKobo)} · {tool.url}</small></span>
        <div className='admin-tool-actions'><button type='button' onClick={() => { setEditingTool(tool); setMessage('') }}>Edit</button><button type='button' aria-label={`Remove ${tool.name}`} onClick={() => deleteTool(tool)}><Trash2 /></button></div>
      </article>) : <p>No website tools yet.</p>}</aside>
    </div> : tab === 'pictures' ? <div className='admin-grid pictures-admin-grid'>
      <form onSubmit={savePicture} key={editingPicture?._id || 'new-picture'}>
        <div className='admin-form-title'><ImageIcon /><span><strong>{editingPicture ? 'Edit picture' : 'Add working picture'}</strong><small>Customers see the preview; the download link stays locked until payment.</small></span></div>
        <label>Picture title<input name='title' required maxLength='120' defaultValue={editingPicture?.title || ''} placeholder='Premium workspace portrait' /></label>
        <label>Description<textarea name='description' maxLength='500' defaultValue={editingPicture?.description || ''} placeholder='Describe the picture and what the buyer receives' /></label>
        {editingPicture && <div className='admin-current-preview'><img src={editingPicture.previewUrl} alt='' /><span><strong>Current preview</strong><small>Choose a new file below only if you want to replace it.</small></span></div>}
        <label className='admin-product-image'><UploadCloud /><span><strong>{editingPicture ? 'Replace preview picture' : 'Upload preview picture'}</strong><small>JPG, PNG, WebP or GIF · max 5 MB</small></span><input name='previewImage' type='file' accept='.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif' required={!editingPicture} /></label>
        <label>Private download link<input name='downloadUrl' type='text' inputMode='url' required defaultValue={editingPicture?.downloadUrl || ''} placeholder='https://drive.example.com/full-quality-file' /></label>
        <label>Price (NGN)<input name='price' type='number' min='0' step='50' required defaultValue={editingPicture ? Number(editingPicture.priceKobo || 0) / 100 : ''} placeholder='2500' /></label>
        <button disabled={state === 'loading'}>{state === 'loading' ? <LoaderCircle className='spin' /> : <ImageIcon />}{editingPicture ? 'Save changes' : 'Publish picture'}</button>
        {editingPicture && <button className='admin-cancel-tool' type='button' onClick={() => setEditingPicture(null)}>Cancel editing</button>}
      </form>
      <aside><div><span>WORKING PICTURES</span><strong>{pictures.length}</strong></div>{pictures.length ? pictures.map((picture) => <article className='admin-tool-row admin-picture-row' key={picture._id}>
        <img src={picture.previewUrl} alt='' loading='lazy' />
        <span><strong>{picture.title}</strong><small>{money(picture.priceKobo)} · Download link protected</small></span>
        <div className='admin-tool-actions'><button type='button' onClick={() => { setEditingPicture(picture); setMessage('') }}>Edit</button><button type='button' aria-label={`Remove ${picture.title}`} onClick={() => deletePicture(picture)}><Trash2 /></button></div>
      </article>) : <p>No pictures yet.</p>}</aside>
    </div> : tab === 'files' ? <div className='admin-grid'>
      <form onSubmit={uploadAsset}>
        <input name='category' type='hidden' value='formats' />
        <label>Title<input name='title' required maxLength='120' placeholder='Product title' /></label>
        <label>Description<textarea name='description' maxLength='500' placeholder='What the customer receives' /></label>
        <label>Price (NGN)<input name='price' type='number' min='8000' step='500' defaultValue='8000' required /></label>
        <label className='admin-file'><UploadCloud /><span><strong>Choose file</strong><small>PDF or TXT · max 100 MB</small></span><input name='file' type='file' accept='.pdf,.txt,application/pdf,text/plain' required /></label>
        <button disabled={state === 'loading'}>{state === 'loading' ? <LoaderCircle className='spin' /> : <UploadCloud />}{state === 'loading' ? `Uploading${uploadProgress ? ` ${uploadProgress}%` : '...'}` : 'Publish file'}</button>
      </form>
      <aside><div><span>UPLOADS</span><strong>{assets.length}</strong></div>{assets.length ? assets.map((asset) => <article className='admin-asset-row' key={asset._id}>
        <FileText />
        <span><strong>{asset.title}</strong><small>{asset.fileName} · {money(asset.priceKobo)}</small></span>
        {editingAssetId === asset._id
          ? <div className='admin-asset-price-editor'><input aria-label={`New price for ${asset.title}`} type='number' min='8000' step='500' value={assetPrice} onChange={(event) => setAssetPrice(event.target.value)} /><button type='button' disabled={state === 'loading'} onClick={() => saveAssetPrice(asset._id)}>Save</button><button type='button' onClick={() => { setEditingAssetId(''); setAssetPrice('') }}>Cancel</button></div>
          : <button className='admin-asset-edit' type='button' onClick={() => editAssetPrice(asset)}>Edit price</button>}
      </article>) : <p>No uploads yet.</p>}</aside>
    </div> : <div className='admin-users'>
      <div className='admin-user-summary'>
        <article><Users /><span><small>USERS</small><strong>{users.length}</strong></span></article>
        <article><Ban /><span><small>BANNED</small><strong>{users.filter((user) => user.isBanned).length}</strong></span></article>
        <article><Layers3 /><span><small>ORDERS</small><strong>{users.reduce((sum, user) => sum + user.orderCount, 0)}</strong></span></article>
      </div>
      <div className='admin-user-layout'>
        <aside className='admin-user-list'>
          <label className='admin-user-search'><Search /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder='Search name or email' /></label>
          <div>{filteredUsers.map((user) => <button key={user.id} className={selectedUser?.id === user.id ? 'active' : ''} onClick={() => setSelectedUserId(user.id)}>
            <CircleUserRound /><span><strong>{user.name || 'Unnamed user'}</strong><small>{user.email}</small></span><em className={user.isBanned ? 'banned' : ''}>{user.isBanned ? 'banned' : 'active'}</em>
          </button>)}{!filteredUsers.length && <p>No users match your search.</p>}</div>
        </aside>
        <main className='admin-user-detail'>{selectedUser ? <>
          <header><div><small>USER ACCOUNT</small><h3>{selectedUser.name || 'Unnamed user'}</h3><p>{selectedUser.email}</p></div><button className={selectedUser.isBanned ? 'unban' : 'ban'} disabled={selectedUser.isAdmin || state === 'loading'} onClick={() => toggleBan(selectedUser)}>{selectedUser.isBanned ? <UserCheck /> : <Ban />}{selectedUser.isBanned ? 'Unban user' : 'Ban user'}</button></header>
          <div className='admin-user-meta'><span><small>Wallet</small><strong>{money(selectedUser.balanceKobo)}</strong></span><span><small>Total spent</small><strong>{money(selectedUser.totalSpentKobo)}</strong></span><span><small>Joined</small><strong>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : '—'}</strong></span></div>
          <h4>Purchase history <span>{selectedUser.orderCount}</span></h4>
          <div className='admin-orders'>{selectedUser.orders.length ? selectedUser.orders.map((order) => <article key={`${order.type}-${order.id}`}>
            <div><span className='admin-order-type'>{order.type}</span><strong>{order.item}</strong><small>{order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date unavailable'}</small></div>
            <div><strong>{money(order.amountKobo)}</strong><small>Status: {order.status}</small></div>
            <dl><div><dt>Order ID</dt><dd>{order.id}</dd></div><div><dt>Request ID</dt><dd>{order.requestId || '—'}</dd></div>{order.apiOrderId && <div><dt>API order ID</dt><dd>{order.apiOrderId}</dd></div>}</dl>
          </article>) : <p className='admin-empty-orders'>This user has not bought anything yet.</p>}</div>
        </> : <p>Select a user to view their account and purchases.</p>}</main>
      </div>
    </div>}
  </section>
}

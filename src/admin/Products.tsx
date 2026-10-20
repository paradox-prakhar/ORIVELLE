import { useState, type FormEvent } from 'react'
import { Archive, ArrowUpRight, Edit3, Plus, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, money, toPaise, useResource, type Product } from './api'
import { Empty, ErrorState, Field, Loading, Modal, Notice, PageHeading, Status, SubmitButton } from './components'

type DraftVariant = { sku: string; size: string; color: string; stock: string }

function ProductEditor({ product, close, saved }: { product?: Product; close: () => void; saved: () => void }) {
  const [variants, setVariants] = useState<DraftVariant[]>([{ sku: '', size: 'S', color: '', stock: '0' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changeVariant = (index: number, key: keyof DraftVariant, value: string) => setVariants(rows => rows.map((row, i) => i === index ? { ...row, [key]: value } : row))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const imageUrls = [...new Set([String(form.get('image') || '').trim(), ...String(form.get('images') || '').split('\n').map(value => value.trim())].filter(Boolean))]
    setBusy(true); setError('')
    try {
      const body = { name: form.get('name'), slug: form.get('slug'), description: form.get('description'), category: form.get('category'), price: toPaise(form.get('price')), compareAtPrice: form.get('compareAtPrice') ? toPaise(form.get('compareAtPrice')) : null, image: form.get('image'), images: imageUrls, color: form.get('color'), material: form.get('material'), care: form.get('care'), featured: form.get('featured') === 'on', demo: form.get('demo') === 'on', active: form.get('active') === 'on', ...(!product ? { variants: variants.map(row => ({ ...row, stock: Number(row.stock) })) } : {}) }
      await api(`/admin/products${product ? `/${product.id}` : ''}`, { method: product ? 'PATCH' : 'POST', body: JSON.stringify(body) })
      saved()
    } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <Modal title={product ? 'Edit the piece' : 'A new addition'} subtitle="Considered details make a considered collection." close={close} wide><form onSubmit={submit} className="ad-form">
    {error && <Notice error>{error}</Notice>}
    <div className="ad-form-grid"><Field label="Product name"><input name="name" required minLength={2} maxLength={150} defaultValue={product?.name} placeholder="The Seoul Overshirt" /></Field><Field label="URL slug" hint="Lowercase letters, numbers and hyphens."><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={product?.slug} placeholder="seoul-overshirt" /></Field></div>
    <Field label="Description"><textarea name="description" required minLength={10} maxLength={5000} rows={3} defaultValue={product?.description} placeholder="The story, silhouette and details of this piece." /></Field>
    <div className="ad-form-grid"><Field label="Category"><input name="category" required defaultValue={product?.category} placeholder="Outerwear" /></Field><Field label="Color"><input name="color" required defaultValue={product?.color} placeholder="Cloud" /></Field><Field label="Price · INR"><input name="price" type="number" min="1" step="0.01" required defaultValue={product ? product.price / 100 : ''} /></Field><Field label="Compare-at price · INR" hint="Optional original price before a discount."><input name="compareAtPrice" type="number" min="0" step="0.01" defaultValue={product?.compareAtPrice ? product.compareAtPrice / 100 : ''} /></Field></div>
    <Field label="Cover image URL" hint="Use a public HTTPS image URL from your media provider."><input name="image" type="url" required defaultValue={product?.image} placeholder="https://…" /></Field>
    <Field label="Additional gallery image URLs" hint="One HTTPS image URL per line, in display order. Up to nine additional images."><textarea name="images" rows={3} defaultValue={(product?.images || []).slice(1).join('\n')} placeholder="https://…" /></Field>
    <div className="ad-form-grid"><Field label="Material"><input name="material" required defaultValue={product?.material} placeholder="100% cotton" /></Field><Field label="Care instructions"><input name="care" required defaultValue={product?.care} placeholder="Cold gentle wash. Dry in shade." /></Field></div>
    <div className="ad-form-divider"><h3>Sizes & inventory</h3>{product ? <p className="ad-muted">Manage stock in <Link to="/admin/inventory" onClick={close}>Inventory</Link>. Existing variant identifiers are preserved.</p> : <p className="ad-muted">Add each purchasable size with a unique SKU.</p>}</div>
    {product ? <div className="ad-variant-summary">{product.variants.map(variant => <span key={variant.id}>{variant.size} · {variant.color} <b>{variant.stock} units</b></span>)}</div> : <><div className="ad-variant-labels"><span>SKU</span><span>Size</span><span>Color</span><span>Stock</span></div>{variants.map((variant, index) => <div className="ad-variant-row" key={index}><input aria-label={`Variant ${index + 1} SKU`} required value={variant.sku} onChange={event => changeVariant(index, 'sku', event.target.value)} placeholder="ORI-001-S" /><input aria-label={`Variant ${index + 1} size`} required value={variant.size} onChange={event => changeVariant(index, 'size', event.target.value)} /><input aria-label={`Variant ${index + 1} color`} required value={variant.color} onChange={event => changeVariant(index, 'color', event.target.value)} placeholder="Cloud" /><input aria-label={`Variant ${index + 1} stock`} type="number" min="0" step="1" required value={variant.stock} onChange={event => changeVariant(index, 'stock', event.target.value)} /><button className="ad-icon-button" type="button" aria-label={`Remove variant ${index + 1}`} disabled={variants.length === 1} onClick={() => setVariants(rows => rows.filter((_, i) => i !== index))}><X size={16} /></button></div>)}<button className="ad-text-button" type="button" onClick={() => setVariants(rows => [...rows, { sku: '', size: '', color: '', stock: '0' }])}><Plus size={14} /> Add size</button></>}
    <div className="ad-checkbox-group"><label><input type="checkbox" name="active" defaultChecked={product?.active ?? true} /> Published</label><label><input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} /> Featured piece</label><label><input type="checkbox" name="demo" defaultChecked={product?.demo ?? true} /> Demonstration product</label></div>
    <div className="ad-modal-actions"><button type="button" className="ad-button ad-button-secondary" onClick={close} disabled={busy}>Cancel</button><SubmitButton busy={busy}>{product ? 'Save changes' : 'Create product'}</SubmitButton></div>
  </form></Modal>
}

export default function Products() {
  const resource = useResource<{ items: Product[]; total: number }>('/admin/products')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<Product | 'new' | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [archiving, setArchiving] = useState('')
  async function archive(product: Product) {
    setArchiving(product.id); setError(''); setNotice('')
    try { await api(`/admin/products/${product.id}`, { method: 'DELETE' }); setNotice(`${product.name} has been archived. You can publish it again by editing the piece.`); resource.reload() } catch (error) { setError((error as Error).message) } finally { setArchiving('') }
  }
  const products = (resource.data?.items || []).filter(product => `${product.name} ${product.category} ${product.variants.map(variant => variant.sku).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  return <><PageHeading title="The collection" description="Every piece, from the first sketch to the final order."><button className="ad-button" onClick={() => setEditor('new')}><Plus size={16} /> Add a piece</button></PageHeading>{notice && <Notice>{notice}</Notice>}{error && <Notice error>{error}</Notice>}
    <div className="ad-panel"><div className="ad-panel-toolbar"><div><span className="ad-panel-title">All products</span><span className="ad-count">{resource.data?.total ?? '—'}</span></div><label className="ad-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the collection" aria-label="Search products" /></label></div>
      {resource.loading ? <Loading /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} /> : products.length === 0 ? <Empty title={query ? 'No matching pieces' : 'Your collection starts here'}>{query ? 'Try a different name, category or SKU.' : 'Add your first product to begin building the collection.'}</Empty> : <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Inventory</th><th>Status</th><th><span className="ad-sr-only">Actions</span></th></tr></thead><tbody>{products.map(product => <tr key={product.id}><td><div className="ad-product-cell"><img src={product.image} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden' }} /><div><strong>{product.name}</strong><small>{product.variants.length} sizes · {product.demo ? 'Demo' : 'Live collection'}</small></div></div></td><td>{product.category}</td><td className="ad-nowrap">{money(product.price)}</td><td>{product.variants.reduce((sum, variant) => sum + variant.stock, 0)} units</td><td><Status value={product.active ? 'published' : 'archived'} /></td><td><div className="ad-row-actions"><Link className="ad-icon-button" to={`/product/${product.slug}`} title="View product" aria-label={`View ${product.name}`}><ArrowUpRight size={16} /></Link><button className="ad-icon-button" onClick={() => setEditor(product)} aria-label={`Edit ${product.name}`}><Edit3 size={16} /></button>{product.active && <button className="ad-icon-button" disabled={!!archiving} onClick={() => archive(product)} aria-label={`Archive ${product.name}`}><Archive size={16} /></button>}</div></td></tr>)}</tbody></table></div>}
    </div>{editor && <ProductEditor product={editor === 'new' ? undefined : editor} close={() => setEditor(null)} saved={() => { setEditor(null); setNotice('The collection has been updated.'); resource.reload() }} />}
  </>
}



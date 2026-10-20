import { useCallback, useEffect, useState } from 'react'

export interface User { id: string; name: string; email: string; role: string }
export interface Variant { id: string; sku: string; size: string; color: string; stock: number; productName?: string; productId?: string }
export interface Product { id: string; slug: string; name: string; description: string; category: string; price: number; compareAtPrice?: number | null; image: string; images: string[]; color: string; material: string; care: string; featured: boolean; demo: boolean; active: boolean; variants: Variant[] }
export interface OrderItem { id?: string; name?: string; productName?: string; quantity: number; price?: number; unitPrice?: number; size?: string; color?: string; sku?: string; image?: string; product?: { name: string }; variant?: { size: string; color: string } }
export interface Order { id: string; reference: string; user?: { name: string; email: string }; items: OrderItem[]; address: Record<string, string>; subtotal: number; discount: number; shipping: number; tax: number; total: number; status: string; paymentMethod: string; paymentStatus: string; createdAt: string; trackingNumber?: string; trackingUrl?: string }
export interface Customer { id: string; name: string; email: string; role: string; createdAt: string; orderCount: number; totalSpent: number }
export interface Coupon { id: string; code: string; percent: number; minSubtotal: number; active: boolean; uses: number; usageLimit?: number | null; expiresAt?: string | null }
export interface StoreSettings { currency: string; shippingFlat: number; freeShippingAbove: number; taxRate: number; codEnabled: boolean; storeName: string }
export interface Overview { revenue: number; totalOrders: number; pendingOrders: number; fulfilledOrders: number; customers: number; revenueNote?: string; lowStock: Variant[]; recentOrders: Order[]; sales: { date: string; total: number; count: number }[] }
export interface AuditItem { id: string; action: string; reason?: string; createdAt: string; entityType?: string; entityId?: string; details?: unknown; user?: { name?: string; email?: string }; actor?: string; actorEmail?: string }

export const money = (paise: number = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100)
export const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
export const toPaise = (value: FormDataEntryValue | null) => Math.round(Number(value || 0) * 100)

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : body.error?.message || body.message || `Request failed (${response.status}). Please try again.`)
  return body as T
}

export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api<T>(path, { signal: controller.signal }).then(setData).catch((error: Error) => {
      if (error.name !== 'AbortError') setError(error.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, revision])
  return { data, loading, error, reload }
}



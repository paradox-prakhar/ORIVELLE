export interface User { id: string; name: string; email: string; role: 'customer' | 'admin'; createdAt?: string }
export interface Variant { id: string; sku: string; size: string; color: string; stock: number }
export interface Product {
  id: string; slug: string; name: string; description: string; category: string;
  price: number; compareAtPrice: number | null; compareAt: number | null;
  image: string; images: string[]; color: string; material: string; care: string;
  featured: boolean; active: boolean; demo: boolean; createdAt: string; variants: Variant[];
}
export interface Address { name: string; phone: string; line1: string; city: string; state: string; pincode: string }
export interface Settings { storeName: string; currency: 'INR'; shippingFlat: number; freeShippingAbove: number; taxRate: number; codEnabled: boolean }
export interface Coupon { id: string; code: string; percent: number; minSubtotal: number; active: boolean; uses: number; usageLimit: number | null; expiresAt: string | null }
export interface CartItem { id: string; variantId: string; quantity: number; product: Product; variant: Variant; lineTotal: number }
export interface Cart { items: CartItem[]; subtotal: number; discount: number; shipping: number; tax: number; total: number; coupon: Coupon | null; warnings: string[] }
export interface OrderItem { id: string; productId: string; variantId: string; name: string; slug: string; image: string; size: string; color: string; sku: string; quantity: number; price: number; lineTotal: number }
export type OrderStatus = 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export interface Order {
  id: string; reference: string; user: Pick<User, 'id' | 'name' | 'email'>; items: OrderItem[];
  address: Address; subtotal: number; discount: number; shipping: number; tax: number; total: number;
  coupon: string | null; status: OrderStatus; paymentMethod: 'cod'; paymentStatus: 'pending' | 'cancelled';
  createdAt: string; updatedAt: string; trackingNumber: string | null; trackingUrl: string | null;
}
export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'INVALID_REQUEST') { super(message); }
}

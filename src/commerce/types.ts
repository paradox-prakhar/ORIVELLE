export type Variant = { id: string; sku: string; size: string; color: string; stock: number };
export type Product = { id: string; slug: string; name: string; description: string; category: string; price: number; compareAtPrice?: number; image: string; images: string[]; color: string; material: string; care: string; featured: boolean; demo: boolean; variants: Variant[] };
export type User = { id: string; name: string; email: string; role: string; emailVerified?: boolean };
export type CartItem = { id: string; variantId: string; quantity: number; product: Product; variant: Variant; lineTotal: number };
export type Cart = { items: CartItem[]; subtotal: number; discount: number; shipping: number; tax: number; total: number; coupon: string | { code: string } | null; warnings?: string[] };
export type StoreConfig = {
  currency: string;
  codEnabled: boolean;
  shipping: { flatRate: number; freeAbove: number };
  payments: { razorpay: { enabled: boolean; keyId?: string; testMode?: boolean; message: string } };
  email: { configured: boolean; message: string };
};
export type Address = { id?: string; name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string; isDefault?: boolean };
export type OrderItem = { id?: string; name: string; productName?: string; size?: string; variant?: string; image?: string; quantity: number; price?: number; unitPrice?: number; lineTotal?: number };
export type Order = { id: string; reference?: string; orderNumber?: string; status: string; paymentStatus: string; paymentMethod: string; createdAt: string; address: Address; items: OrderItem[]; subtotal: number; discount: number; shipping: number; tax: number; total: number; trackingNumber?: string; trackingUrl?: string };
export type Catalog = { items: Product[]; total: number; page: number; pageSize: number; categories: (string | { id: string; name: string; slug?: string })[] };

export type CheckoutSessionStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'PAYMENT_PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REQUIRES_RECONCILIATION';

export type CheckoutSession = {
  id: string;
  userId: string;
  idempotencyKey: string;
  status: CheckoutSessionStatus;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  paymentProvider: 'razorpay' | 'cod';
  providerOrderId?: string | null;
  orderId?: string | null;
  expiresAt: number;
  createdAt: string;
  updatedAt: string;
};

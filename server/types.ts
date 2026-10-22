export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  emailVerified?: boolean;
  createdAt?: string;
}

export interface Variant {
  id: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number; // in paise
  compareAtPrice: number | null;
  compareAt: number | null;
  image: string;
  images: string[];
  color: string;
  material: string;
  care: string;
  featured: boolean;
  active: boolean;
  demo: boolean;
  createdAt: string;
  variants: Variant[];
}

export interface Address {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  line2?: string;
  isDefault?: boolean;
}

export interface Settings {
  storeName: string;
  currency: 'INR';
  shippingFlat: number;
  freeShippingAbove: number;
  taxRate: number;
  codEnabled: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  percent: number;
  minSubtotal: number;
  active: boolean;
  uses: number;
  usageLimit: number | null;
  expiresAt: string | null;
}

export interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  product: Product;
  variant: Variant;
  lineTotal: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  coupon: Coupon | null;
  warnings: string[];
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  image: string;
  size: string;
  color: string;
  sku: string;
  quantity: number;
  price: number;
  lineTotal: number;
}

export type OrderStatus = 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'cancelled' | 'failed' | 'refunded';
export type PaymentMethod = 'cod' | 'razorpay';

export interface Order {
  id: string;
  reference: string;
  user: Pick<User, 'id' | 'name' | 'email'>;
  items: OrderItem[];
  address: Address;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  coupon: string | null;
  couponId?: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  checkoutSessionId?: string | null;
  createdAt: string;
  updatedAt: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
}

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

export interface CheckoutSessionItemSnapshot {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  slug: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  price: number; // in paise
  lineTotal: number; // in paise
}

export interface CheckoutSession {
  id: string;
  userId: string;
  idempotencyKey: string;
  status: CheckoutSessionStatus;
  subtotal: number; // in paise
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: 'INR';
  itemsSnapshot: CheckoutSessionItemSnapshot[];
  shippingAddress: Address;
  couponId: string | null;
  couponCode: string | null;
  paymentProvider: 'razorpay' | 'cod';
  providerOrderId: string | null;
  orderId: string | null;
  expiresAt: number; // unix timestamp ms
  createdAt: string;
  updatedAt: string;
}

export type PaymentAttemptStatus =
  | 'initiated'
  | 'attempted'
  | 'captured'
  | 'failed'
  | 'cancelled'
  | 'requires_reconciliation';

export interface PaymentAttempt {
  id: string;
  checkoutSessionId: string;
  orderId: string | null;
  provider: 'razorpay' | 'cod';
  providerOrderId: string;
  providerPaymentId: string | null;
  providerSignature: string | null;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  errorCode: string | null;
  errorDescription: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryReservation {
  id: string;
  checkoutSessionId: string;
  variantId: string;
  quantity: number;
  status: 'ACTIVE' | 'FINALIZED' | 'RELEASED' | 'EXPIRED';
  expiresAt: number; // unix timestamp ms
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'INVALID_REQUEST',
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

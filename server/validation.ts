import { z } from 'zod';
export const email = z.string().trim().email().max(254).transform(value => value.toLowerCase());
export const password = z.string().min(10, 'Use at least 10 characters.').max(72, 'Use at most 72 characters.').refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must fit within 72 UTF-8 bytes.');
export const name = z.string().trim().min(2).max(100);
export const quantity = z.number().int().min(1).max(20);
export const addressSchema = z.object({ name, phone: z.string().trim().regex(/^\+?[\d\s-]{10,16}$/, 'Enter a valid Indian phone number.'), line1: z.string().trim().min(5).max(240), city: z.string().trim().min(2).max(100), state: z.string().trim().min(2).max(100), pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a six-digit Indian PIN code.') });
const imageUrl = z.string().url().max(2000).refine(value => new URL(value).protocol === 'https:', 'Use an HTTPS image URL.');
export const productSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), name: z.string().trim().min(2).max(150), description: z.string().trim().min(10).max(5000), category: z.string().trim().min(2).max(80),
  price: z.number().int().min(100).max(100000000), compareAtPrice: z.number().int().min(0).max(100000000).nullable().optional(), images: z.array(imageUrl).min(1).max(10),
  color: z.string().trim().min(1).max(80), material: z.string().trim().max(300), care: z.string().trim().max(1000), featured: z.boolean().default(false), active: z.boolean().default(true), demo: z.boolean().default(false),
  variants: z.array(z.object({ sku: z.string().trim().min(2).max(100), size: z.string().trim().min(1).max(30), color: z.string().trim().min(1).max(80), stock: z.number().int().min(0).max(100000) })).min(1).max(100),
});
export const couponSchema = z.object({ code: z.string().trim().regex(/^[a-zA-Z0-9_-]{3,32}$/).transform(value => value.toUpperCase()), percent: z.number().int().min(1).max(90), minSubtotal: z.number().int().min(0).max(100000000).default(0), active: z.boolean().default(true), usageLimit: z.number().int().min(1).max(1000000).nullable().optional(), expiresAt: z.string().datetime().nullable().optional() });
// Create-time defaults must never be applied to omitted PATCH fields.
export const productPatchSchema = productSchema.omit({ variants: true }).extend({ featured: z.boolean(), active: z.boolean(), demo: z.boolean() }).partial();
export const couponPatchSchema = couponSchema.extend({ minSubtotal: z.number().int().min(0).max(100000000), active: z.boolean() }).partial();
export const settingsSchema = z.object({ storeName: z.string().trim().min(2).max(100), currency: z.literal('INR'), shippingFlat: z.number().int().min(0).max(1000000), freeShippingAbove: z.number().int().min(0).max(100000000), taxRate: z.number().min(0).max(30), codEnabled: z.boolean() });

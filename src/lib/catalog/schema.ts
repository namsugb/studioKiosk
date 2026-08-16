import { z } from "zod";

export const priceSchema = z.object({ amount: z.number().int().nonnegative().nullable(), label: z.string().optional() });
export const tierSchema = z.object({ id: z.string(), name: z.string(), subtitle: z.string(), description: z.string(), features: z.array(z.string()), order: z.number().int() });
export const productSchema = z.object({
  id: z.string(), categoryId: z.string(), tierId: z.string(), name: z.string(), tag: z.string(),
  price: priceSchema, details: z.array(z.string()), durationMinutes: z.number().int().nonnegative().nullable(), durationLabel: z.string().optional(),
  addonPriceOverrides: z.record(z.string(), z.number().int().nonnegative()).optional(), tierSubtitle: z.string().optional(), tierDescription: z.string().optional(), tierFeatures: z.array(z.string()).optional(),
  allowedAddonIds: z.array(z.string()), includedAddonIds: z.array(z.string()).default([]), allowedPickupIds: z.array(z.string()), active: z.boolean().default(true)
});
export const categorySchema = z.object({ id: z.string(), name: z.string(), description: z.string(), icon: z.string(), order: z.number().int(), active: z.boolean().default(true) });
export const addonSchema = z.object({ id: z.string(), name: z.string(), description: z.string(), price: z.number().int().nonnegative(), conflictGroup: z.string().nullable().default(null), excludes: z.array(z.string()).default([]), active: z.boolean().default(true) });
export const discountSchema = z.object({ id: z.string(), name: z.string(), description: z.string(), amount: z.number().int().positive(), requiresStaffApproval: z.boolean(), active: z.boolean().default(true) });
export const pickupSchema = z.object({ id: z.string(), name: z.string(), description: z.string(), surcharge: z.number().int().nonnegative(), active: z.boolean().default(true) });
export const catalogSchema = z.object({
  schemaVersion: z.literal(1), releaseId: z.string(), version: z.number().int().positive(), publishedAt: z.string(),
  studio: z.object({ name: z.string(), tagline: z.string(), primaryColor: z.string(), supportCopy: z.string(), privacyRetentionDays: z.number().int().positive() }),
  categories: z.array(categorySchema), tiers: z.array(tierSchema), products: z.array(productSchema), addons: z.array(addonSchema), discounts: z.array(discountSchema),
  discountPolicy: z.enum(["stackable", "single"]), pickups: z.array(pickupSchema)
});

export type Catalog = z.infer<typeof catalogSchema>;
export type Product = z.infer<typeof productSchema>;
export type Addon = z.infer<typeof addonSchema>;
export type Discount = z.infer<typeof discountSchema>;
export type Pickup = z.infer<typeof pickupSchema>;



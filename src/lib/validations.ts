import { z } from "zod";

export const voidReasons = [
  "wrong_item",
  "unavailable_86",
  "customer_changed_mind",
  "kitchen_error",
  "other",
] as const;
export const voidReasonSchema = z.enum(voidReasons);
export type VoidReason = (typeof voidReasons)[number];

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const orderItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  quantityGrams: z.number().int().min(1),
  notes: z.string().optional(),
  hold: z.boolean().optional(),
});

export const createOrderSchema = z.object({
  tableNumber: z.string().optional(),
  guests: z.number().int().min(1).max(30).optional(),
  // When present, the items are appended to that live order instead of creating one.
  orderId: z.string().uuid().optional(),
  items: z.array(orderItemInputSchema).min(1),
});

export const orderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fire") }),
  z.object({ action: z.literal("rush") }),
  z.object({ action: z.literal("unrush") }),
  z.object({ action: z.literal("serve") }),
  z.object({ action: z.literal("paid") }),
  z.object({
    action: z.literal("cancel"),
    reason: voidReasonSchema,
    note: z.string().optional(),
  }),
]);
export type OrderAction = z.infer<typeof orderActionSchema>;

export const itemActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("bump") }),
  z.object({ action: z.literal("unbump") }),
  z.object({ action: z.literal("fire") }),
  z.object({
    action: z.literal("void"),
    reason: voidReasonSchema,
    note: z.string().optional(),
  }),
]);
export type ItemAction = z.infer<typeof itemActionSchema>;

export const createMenuItemSchema = z.object({
  nameEl: z.string().min(1),
  nameEn: z.string().min(1),
  descriptionEl: z.string().optional(),
  descriptionEn: z.string().optional(),
  categoryId: z.string().uuid(),
  stationId: z.string().uuid(),
  priceCents: z.number().int().min(0),
  pricingType: z.enum(["unit", "weight"]).default("unit"),
  available: z.boolean().default(true),
  imageUrl: z.string().optional(),
});

export const updateMenuItemSchema = z.object({
  nameEl: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  descriptionEl: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional(),
  stationId: z.string().uuid().optional(),
  priceCents: z.number().int().min(0).optional(),
  pricingType: z.enum(["unit", "weight"]).optional(),
  available: z.boolean().optional(),
  imageUrl: z.string().optional().nullable(),
});

export const createCategorySchema = z.object({
  nameEl: z.string().min(1),
  nameEn: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = z.object({
  id: z.string().uuid(),
  nameEl: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const deleteCategorySchema = z.object({
  id: z.string().uuid(),
});

export const createTableSchema = z.object({
  name: z.string().min(1),
  seats: z.number().int().min(1).optional(),
  sortOrder: z.number().int().default(0),
});

export const updateTableSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  seats: z.number().int().min(1).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const deleteTableSchema = z.object({
  id: z.string().uuid(),
});

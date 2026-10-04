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
  // Dining tables the order occupies — one normally, several when combined.
  // When present, the server derives the table label from these.
  tableIds: z.array(z.string().uuid()).optional(),
  guests: z.number().int().min(1).max(30).optional(),
  guestName: z.string().max(80).optional(),
  // Seating a reservation: links the new order to it and marks it seated.
  reservationId: z.string().uuid().optional(),
  // When present, the items are appended to that live order instead of creating one.
  orderId: z.string().uuid().optional(),
  items: z.array(orderItemInputSchema).min(1),
});

export const createReservationSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1).max(120).optional(),
  customerPhone: z.string().min(6).max(20).optional(),
  partySize: z.number().int().min(1).max(30),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reservationTime: z.string().regex(/^([01]\d|2[0-3]):(00|30)(:00)?$/),
  tableId: z.string().uuid().optional(),
  specialRequests: z.string().max(300).optional(),
});

export const updateReservationSchema = z.object({
  partySize: z.number().int().min(1).max(30).optional(),
  reservationTime: z.string().regex(/^([01]\d|2[0-3]):(00|30)(:00)?$/).optional(),
  status: z.enum(["confirmed", "seated", "cancelled", "no_show"]).optional(),
  specialRequests: z.string().max(300).optional().nullable(),
  tableId: z.string().uuid().optional().nullable(),
});

export const createCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).default(""),
  phone: z.string().regex(/^\+?[0-9][0-9\s-]{5,18}$/),
  email: z.string().email().optional(),
  dietaryNotes: z.string().max(300).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  optInMarketing: z.boolean().optional(),
});

export const updateCustomerSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().regex(/^\+?[0-9][0-9\s-]{5,18}$/).optional(),
  email: z.string().email().optional().nullable(),
  dietaryNotes: z.string().max(300).optional().nullable(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  optInMarketing: z.boolean().optional(),
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
  z.object({
    // Admin-only audit annotation on a PAID order (complaint / refund).
    action: z.literal("refund"),
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
  nickname: z.string().optional(),
  seats: z.number().int().min(1).optional(),
  sortOrder: z.number().int().default(0),
});

export const updateTableSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  nickname: z.string().optional().nullable(),
  seats: z.number().int().min(1).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export const deleteTableSchema = z.object({
  id: z.string().uuid(),
});

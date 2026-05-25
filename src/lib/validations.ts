import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createOrderSchema = z.object({
  tableNumber: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantityGrams: z.number().int().min(1),
        notes: z.string().optional(),
      })
    )
    .min(1),
});

export const createMenuItemSchema = z.object({
  nameEl: z.string().min(1),
  nameEn: z.string().min(1),
  descriptionEl: z.string().optional(),
  descriptionEn: z.string().optional(),
  categoryId: z.string().uuid(),
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

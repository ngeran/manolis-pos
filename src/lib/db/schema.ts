import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameEl: text("name_el").notNull().unique(),
  nameEn: text("name_en").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItems = pgTable("menu_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameEl: text("name_el").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionEl: text("description_el"),
  descriptionEn: text("description_en"),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  priceCents: integer("price_cents").notNull(),
  pricingType: text("pricing_type").notNull().default("unit"),
  available: boolean("available").notNull().default(true),
  imageUrl: text("image_url"),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tableNumber: text("table_number"),
  status: text("status").notNull().default("pending"),
  totalCents: integer("total_cents").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  menuItemId: uuid("menu_item_id")
    .notNull()
    .references(() => menuItems.id),
  quantityGrams: integer("quantity_grams").notNull(),
  priceAtTimeCents: integer("price_at_time_cents").notNull(),
  notes: text("notes"),
});

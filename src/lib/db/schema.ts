import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
  "sent",
  "preparing",
  "ready",
  "served",
  "paid",
  "cancelled",
]);
export const orderItemStatusEnum = pgEnum("order_item_status", [
  "held",
  "queued",
  "done",
  "voided",
]);
export const voidReasonEnum = pgEnum("void_reason", [
  "wrong_item",
  "unavailable_86",
  "customer_changed_mind",
  "kitchen_error",
  "other",
]);

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type OrderItemStatus = (typeof orderItemStatusEnum.enumValues)[number];
export type VoidReason = (typeof voidReasonEnum.enumValues)[number];

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

export const stations = pgTable("stations", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  nameEl: text("name_el").notNull(),
  nameEn: text("name_en").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const diningTables = pgTable("dining_tables", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  seats: integer("seats"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItems = pgTable(
  "menu_items",
  {
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
    stationId: uuid("station_id")
      .notNull()
      .references(() => stations.id),
  },
  (t) => [index("menu_items_station_id_idx").on(t.stationId)]
);

export const orderCounters = pgTable("order_counters", {
  businessDate: date("business_date").primaryKey(),
  lastNumber: integer("last_number").notNull(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tableNumber: text("table_number"),
    status: orderStatusEnum("status").notNull().default("sent"),
    totalCents: integer("total_cents").notNull(),
    businessDate: date("business_date").notNull(),
    dailyNumber: integer("daily_number").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    priority: boolean("priority").notNull().default(false),
    priorityAt: timestamp("priority_at", { withTimezone: true }),
    servedAt: timestamp("served_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelReason: voidReasonEnum("cancel_reason"),
    cancelNote: text("cancel_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_business_date_daily_number_idx").on(t.businessDate, t.dailyNumber),
    index("orders_status_sent_at_idx").on(t.status, t.sentAt),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
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
    // Snapshots — tickets must render even if the menu item is later edited/deleted.
    nameEl: text("name_el").notNull(),
    nameEn: text("name_en").notNull(),
    pricingType: text("pricing_type").notNull().default("unit"),
    stationId: uuid("station_id")
      .notNull()
      .references(() => stations.id),
    status: orderItemStatusEnum("status").notNull().default("queued"),
    round: integer("round").notNull().default(1),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    firedAt: timestamp("fired_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    voidedReason: voidReasonEnum("voided_reason"),
    voidedNote: text("voided_note"),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_station_status_idx").on(t.stationId, t.status),
  ]
);

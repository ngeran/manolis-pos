import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * One-time, idempotent migration for an EXISTING database to the
 * order-lifecycle schema (stations, statuses, snapshots, timestamps).
 *
 * Fresh databases do NOT need this: `npm run db:push` + `npm run db:seed`
 * produce the same state directly.
 *
 * Run with:  npm run db:migrate-kitchen
 */

async function raw(query: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
  // postgres-js returns the rows array directly; other drivers wrap in { rows }.
  const res = (await db.execute(query)) as unknown;
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const withRows = res as { rows?: Record<string, unknown>[] };
  return withRows.rows ?? [];
}

async function migrate() {
  console.log("Migrating existing database to order-lifecycle schema...");

  // ── 1. Enums (idempotent) ──
  await db.execute(sql`DO $$ BEGIN CREATE TYPE order_status AS ENUM ('sent','preparing','ready','served','paid','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE order_item_status AS ENUM ('held','queued','done','voided'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE void_reason AS ENUM ('wrong_item','unavailable_86','customer_changed_mind','kitchen_error','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE reservation_status AS ENUM ('reserved','seated','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

  // ── 2. Stations + counters ──
  await db.execute(sql`CREATE TABLE IF NOT EXISTS stations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL CONSTRAINT stations_slug_unique UNIQUE,
    name_el text NOT NULL,
    name_en text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS order_counters (
    business_date date PRIMARY KEY,
    last_number integer NOT NULL
  )`);
  await db.execute(sql`INSERT INTO stations (slug, name_el, name_en, sort_order) VALUES
    ('grill', 'Σχάρα', 'Grill', 0),
    ('fryer', 'Τηγάνι', 'Fryer', 1),
    ('salads', 'Κρύα', 'Cold Pass', 2),
    ('bar', 'Μπαρ', 'Bar', 3)
    ON CONFLICT (slug) DO NOTHING`);

  // ── 2b. Dining tables (1–12, admin-editable later) ──
  await db.execute(sql`CREATE TABLE IF NOT EXISTS dining_tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CONSTRAINT dining_tables_name_unique UNIQUE,
    nickname text,
    seats integer,
    sort_order integer NOT NULL DEFAULT 0
  )`);
  await db.execute(sql`ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS nickname text`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS order_tables (
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    table_id uuid NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
    PRIMARY KEY (order_id, table_id)
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS order_tables_table_id_idx ON order_tables (table_id)`);;
  await db.execute(sql`INSERT INTO dining_tables (name, seats, sort_order)
    SELECT g.name,
      CASE WHEN g.n <= 6 THEN 2 WHEN g.n <= 10 THEN 4 ELSE 6 END,
      g.n - 1
    FROM (SELECT generate_series(1, 12) AS n, generate_series(1, 12)::text AS name) g
    ON CONFLICT (name) DO NOTHING`);

  // ── 3. menu_items.station_id (nullable until mapped) ──
  await db.execute(sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES stations(id)`);
  // Grill: grilled/oven items + all meats + grilled fish
  await db.execute(sql`UPDATE menu_items SET station_id = (SELECT id FROM stations WHERE slug='grill')
    WHERE station_id IS NULL AND name_en IN (
      'Grilled Feta Cheese with tomato/pepper/oregano', 'Gruyere, can be served Grilled',
      'Farmer Cheese, Talagani grilled', 'Eggplant From The Oven (Ιμαμ)',
      'Chickpeas from the Oven with Curry', 'Country Pie',
      'Pork Steak', 'Beef Steak', 'Smoked Pork Steak', 'Homemade Burger', 'Pork Tender Loin',
      'Liver', 'Chicken Souvlaki', 'Sausage', 'Lamb Chops',
      'Grilled Sardines', 'Porgies')`);
  // Fryer
  await db.execute(sql`UPDATE menu_items SET station_id = (SELECT id FROM stations WHERE slug='fryer')
    WHERE station_id IS NULL AND name_en IN (
      'French Fries', 'Fried Zucchini', 'Homemade Meatballs', 'Anchovies',
      'Fresh Calamari', 'Fried Mullets', 'Cod Fish')`);
  // Cold pass: bread, cold mezé, spreads, all salads
  await db.execute(sql`UPDATE menu_items SET station_id = (SELECT id FROM stations WHERE slug='salads')
    WHERE station_id IS NULL AND name_en IN (
      'Bread', 'Feta Cheese', 'Split Peas', 'Anchovy In Oil And Salt',
      'Homemade Tzatziki', 'Homemade Spicy Cheese Cream',
      'Tomato Salad', 'Boiled Zucchini', 'Broccoli', 'Greek Traditional Salad',
      'Rocket Salad', 'Cabbage - Carrot Salad', 'Mix Pickled Salad', 'Boiled Greens')`);
  // Bar: everything in the Drinks category
  await db.execute(sql`UPDATE menu_items SET station_id = (SELECT id FROM stations WHERE slug='bar')
    WHERE station_id IS NULL AND category_id IN (SELECT id FROM categories WHERE name_en='Drinks')`);

  const unmapped = await raw(sql`SELECT name_en FROM menu_items WHERE station_id IS NULL`);
  if (unmapped.length > 0) {
    console.error("ERROR — items with no station mapping:", unmapped);
    throw new Error("Backfill incomplete; fix the mapping above and re-run.");
  }

  // ── 4. orders: new columns (nullable first) ──
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_date date`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS daily_number integer`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS guests integer`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_at timestamptz`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority_at timestamptz`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS served_at timestamptz`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES users(id)`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason void_reason`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_note text`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at timestamptz`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_by uuid REFERENCES users(id)`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason void_reason`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_note text`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_name text`);

  // ── Reservations (phone bookings; seated when the party arrives) ──
  await db.execute(sql`CREATE TABLE IF NOT EXISTS reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_date date NOT NULL,
    time text NOT NULL,
    name text NOT NULL,
    guests integer NOT NULL,
    phone text,
    notes text,
    table_id uuid REFERENCES dining_tables(id),
    status reservation_status NOT NULL DEFAULT 'reserved',
    order_id uuid REFERENCES orders(id),
    created_at timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS reservations_business_date_idx ON reservations (business_date)`);

  // ── 5. Legacy text status → enum ──
  await db.execute(sql`ALTER TABLE orders ALTER COLUMN status DROP DEFAULT`);
  await db.execute(sql`UPDATE orders SET status = 'paid' WHERE status::text NOT IN ('sent','preparing','ready','served','paid','cancelled')`);
  await db.execute(sql`ALTER TABLE orders ALTER COLUMN status TYPE order_status USING status::text::order_status`);
  await db.execute(sql`ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'sent'`);

  // ── 6. Legacy rows: business date, daily number, sent time ──
  await db.execute(sql`UPDATE orders SET business_date = (created_at AT TIME ZONE 'UTC')::date WHERE business_date IS NULL`);
  await db.execute(sql`WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY business_date ORDER BY created_at) AS rn
    FROM orders WHERE daily_number IS NULL
  )
  UPDATE orders o SET daily_number = r.rn FROM ranked r WHERE o.id = r.id`);
  await db.execute(sql`UPDATE orders SET sent_at = created_at WHERE sent_at IS NULL`);
  await db.execute(sql`ALTER TABLE orders ALTER COLUMN business_date SET NOT NULL`);
  await db.execute(sql`ALTER TABLE orders ALTER COLUMN daily_number SET NOT NULL`);
  await db.execute(sql`ALTER TABLE orders ALTER COLUMN sent_at SET DEFAULT now()`);
  await db.execute(sql`ALTER TABLE orders ALTER COLUMN sent_at SET NOT NULL`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS orders_business_date_daily_number_idx ON orders (business_date, daily_number)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS orders_status_sent_at_idx ON orders (status, sent_at)`);
  await db.execute(sql`INSERT INTO order_counters (business_date, last_number)
    SELECT business_date, MAX(daily_number) FROM orders GROUP BY business_date
    ON CONFLICT (business_date) DO NOTHING`);

  // ── 7. order_items: snapshots + lifecycle columns ──
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS name_el text`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS name_en text`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'unit'`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES stations(id)`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS status order_item_status NOT NULL DEFAULT 'queued'`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 1`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sent_at timestamptz`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fired_at timestamptz`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS done_at timestamptz`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_reason void_reason`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_note text`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES users(id)`);
  await db.execute(sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_at timestamptz`);

  // Snapshot names from the menu (NULL marks not-yet-migrated legacy rows).
  await db.execute(sql`UPDATE order_items oi SET
      name_el = mi.name_el, name_en = mi.name_en,
      pricing_type = mi.pricing_type, station_id = mi.station_id
    FROM menu_items mi
    WHERE oi.menu_item_id = mi.id AND oi.name_el IS NULL`);
  // Legacy items are historical → done, timed from their order's creation.
  await db.execute(sql`UPDATE order_items oi SET
      status = 'done', round = 1, sent_at = o.created_at, fired_at = o.created_at, done_at = o.created_at
    FROM orders o
    WHERE oi.order_id = o.id AND oi.sent_at IS NULL`);
  await db.execute(sql`ALTER TABLE order_items ALTER COLUMN sent_at SET DEFAULT now()`);
  await db.execute(sql`ALTER TABLE order_items ALTER COLUMN sent_at SET NOT NULL`);
  await db.execute(sql`ALTER TABLE order_items ALTER COLUMN name_el SET NOT NULL`);
  await db.execute(sql`ALTER TABLE order_items ALTER COLUMN name_en SET NOT NULL`);
  await db.execute(sql`ALTER TABLE order_items ALTER COLUMN station_id SET NOT NULL`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS order_items_station_status_idx ON order_items (station_id, status)`);

  // ── 8. menu_items.station_id is now fully mapped ──
  await db.execute(sql`ALTER TABLE menu_items ALTER COLUMN station_id SET NOT NULL`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS menu_items_station_id_idx ON menu_items (station_id)`);

  const counts = await raw(sql`SELECT s.slug, count(mi.id)::int AS items
    FROM stations s LEFT JOIN menu_items mi ON mi.station_id = s.id
    GROUP BY s.slug, s.sort_order ORDER BY s.sort_order`);
  console.log("Migration complete. Station mapping:", counts);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

# Manolis Orders

Restaurant order management / POS web application. Touch-optimized, responsive, built for staff to take, modify, and manage customer orders with a CMS for the menu.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19), TypeScript |
| Database | Neon Postgres |
| ORM | Drizzle ORM with `postgres.js` driver |
| Auth | NextAuth.js v5 — Credentials provider, bcryptjs, JWT sessions |
| State | Zustand (client-side cart before DB insertion) |
| Styling | Tailwind CSS v4 with custom design tokens |
| Font | Outfit (via `next/font/google`) |
| Deployment | Vercel |

## Prerequisites

- Node.js 24+
- Docker & Docker Compose (for local Postgres)
- npm

## Local Development

### 1. Clone and install

```bash
git clone <repo-url>
cd manolis-pos
npm install
```

### 2. Start Postgres

```bash
docker compose up -d db
```

This starts a Postgres 16 container on `localhost:5432` with:
- User: `manolis`
- Password: `manolis123`
- Database: `manolis_pos`

### 3. Configure environment

A `.env.local` file is included for local development:

```
DATABASE_URL=postgres://manolis:manolis123@localhost:5432/manolis_pos
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-change-in-production
```

> **Important:** Generate a new `NEXTAUTH_SECRET` for production with `npx auth secret`.

### 4. Push schema and seed

```bash
npm run db:push    # Create tables from Drizzle schema
npm run db:seed    # Populate with categories, menu items, and admin user
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to the login page.

### Default login credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@manolis.local` | `admin123` |
| Staff | `staff@manolis.local` | `staff123` |

## Seeded Menu

The seed script populates **46 menu items** across **5 categories**:

| Category | Items |
|---|---|
| Ορεκτικά | 15 items (Ψωμί, Πατάτες Τηγανιτές, Φέτα, Κεφτέδες, ...) |
| Σαλάτες | 8 items (Χωριάτικη, Ρόκα, Ντοματοσαλάτα, ...) |
| Κρεατικά | 9 items (Χοιρινή Μπριζόλα, Μπιφτέκια, Παϊδάκια, ...) |
| Ψάρια | 6 items (Σαρδέλα, Καλαμαράκια, Τσιπούρα, ...) |
| Ποτά | 8 items (Κρασί Χύμα, Μπύρες, Αναψυκτικά, Ούζο, ...) |

To re-seed from scratch:

```bash
docker compose down -v    # Remove DB volume
docker compose up -d db   # Start fresh
npm run db:push
npm run db:seed
```

## Available Scripts

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Drizzle migration files
npm run db:migrate   # Run pending migrations
npm run db:push      # Push schema directly to DB (dev)
npm run db:seed      # Seed categories, menu items, and users
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                          # Root layout (Outfit font, Material Symbols)
│   ├── globals.css                         # Tailwind v4 + design tokens
│   ├── page.tsx                            # Redirects to /pos
│   ├── login/page.tsx                      # Login form
│   ├── kitchen/page.tsx                    # Kitchen display (fullscreen, per-station)
│   ├── (app)/
│   │   ├── layout.tsx                      # App shell (sidebar, top bar, auth guard)
│   │   ├── pos/page.tsx                    # POS screen (menu grid + order ticket + append mode)
│   │   ├── orders/page.tsx                 # Service board (active) + history
│   │   ├── orders/[id]/page.tsx            # Order detail (view/edit/void/serve/close)
│   │   └── admin/
│   │       ├── menu/page.tsx               # Menu CRUD (+ station assignment)
│   │       └── categories/page.tsx         # Category management
│   └── api/
│       ├── auth/[...nextauth]/route.ts     # NextAuth handler
│       ├── orders/route.ts                 # Create (with daily number) / append / list by scope
│       ├── orders/[id]/route.ts            # Order detail + actions (fire/rush/serve/paid/cancel)
│       ├── orders/[id]/items/[itemId]/route.ts  # Item actions (bump/unbump/fire/void)
│       ├── kitchen/route.ts                # Kitchen feed (tickets per station)
│       ├── stations/route.ts               # Prep stations list
│       ├── menu/route.ts                   # Menu items CRUD
│       └── categories/route.ts             # Categories CRUD
├── components/
│   ├── kitchen/
│   │   ├── TicketCard.tsx                  # Kitchen ticket (bump/undo/fire/held zone)
│   │   └── VoidModal.tsx                   # Reason-picker for voids/cancels
│   ├── service/
│   │   └── StatusChip.tsx                  # Order status badge (el labels)
│   ├── pos/
│   │   ├── MenuGrid.tsx                    # Category filter + item cards
│   │   ├── OrderTicket.tsx                 # Cart sidebar with totals + hold toggles
│   │   ├── NoteModal.tsx                   # Item notes modal
│   │   └── QuantityStepper.tsx             # +/- quantity control
│   └── ui/
│       ├── Button.tsx                      # Reusable button component
│       └── Badge.tsx                       # Status badge
├── hooks/
│   ├── usePolling.ts                       # Poll-with-backoff hook (401 redirect, pause when hidden)
│   └── useServerClock.ts                   # Server-synced ticking clock (skew-proof timers)
├── lib/
│   ├── auth.ts                             # NextAuth config
│   ├── api-auth.ts                         # Session/admin helpers for API routes
│   ├── orders.ts                           # Status recompute, totals, daily numbers, order detail
│   ├── kitchen.ts                          # Age thresholds, payload types, el labels
│   ├── sound.ts                            # Chime/vibration/notifications (gesture-unlocked)
│   ├── db/
│   │   ├── schema.ts                       # Drizzle tables, enums, indexes
│   │   ├── index.ts                        # DB connection (postgres.js)
│   │   ├── seed.ts                         # Seed (stations + item→station mapping)
│   │   └── backfill-stations.ts            # One-time migration for existing DBs
│   ├── store.ts                            # Zustand cart store (+ hold, append mode)
│   ├── validations.ts                      # Zod schemas (orders, actions, menu)
│   └── utils.ts                            # formatPrice, cn helpers
└── middleware.ts                           # Auth guard for all pages (API routes enforce auth themselves)
```

## Order Lifecycle & Kitchen Displays

After "Send to Kitchen", orders flow through **prep stations** with full view/edit/void support:

| Screen | Who | What |
|---|---|---|
| `/pos` | Waiter | Take orders; reopen a live order to append a new round (R2, R3…); mark items **hold** (Αναμονή) to course-fire later |
| `/orders` | Waiter | Service board — active orders with per-station progress, SERVE NOW highlight, age chips (green <8′, amber 8–15′, red ≥15′), rush flags; **Ιστορικό** tab for closed orders |
| `/orders/[id]` | Waiter | Full detail: items grouped by station → round, live kitchen status, void items (reason-tracked), fire held courses, rush, serve, close as paid, cancel (admin only) |
| `/kitchen` | Stations | Per-station ticket screens (Grill/Σχάρα, Fryer/Τηγάνι, Cold/Κρύα, Bar/Μπαρ) via `?station=<slug>` deep links — one tablet per station; tap item = done (with undo), sound + vibration on new orders, fullscreen mode |

**Rules:** item statuses are `held → queued → done` (plus `voided` with reason + who + when); orders `sent → preparing → ready → served → paid` (auto-transitions computed server-side; held items block ready). Any staff can void an item; cancelling a whole order is admin-only. Totals recompute from non-voided items. Daily order numbers (#1, #2…) reset per Athens calendar day. Realtime is 5s polling (no deps) with optimistic taps.

### Schema migration for existing databases

Fresh databases: `npm run db:push && npm run db:seed` (seeds the 4 stations + item mapping).

Existing databases (one-time, idempotent — adds stations, statuses, snapshots, and marks legacy orders as paid):

```bash
npm run db:migrate-kitchen
```

## Architecture Notes

- **All prices stored as integer cents** (e.g. €4,50 → `450`). Converted to Euro display only on the frontend via `formatPrice()`.
- **Zustand manages the draft order client-side** — items are added/removed/modified in the browser, then a single `POST /api/orders` creates the final order.
- **`export const dynamic = "force-dynamic"`** on all pages that query the database.
- **Touch targets** — all interactive elements maintain a minimum 48px height.
- **`postgres.js` driver** — not `@neondatabase/serverless`, which uses WebSockets that break local Docker Postgres.

## Deploy to Vercel with Neon Postgres

### 1. Create a Neon database via Vercel Marketplace

1. Go to your Vercel dashboard → **Storage** tab.
2. Click **Create Database** → select **Neon Postgres**.
3. Choose a region close to your users and click **Create**.
4. Vercel automatically sets `DATABASE_URL` as an environment variable linked to your project.

> Alternatively, create one at [console.neon.tech](https://console.neon.tech) and copy the connection string manually.

### 2. Set environment variables in Vercel

In your Vercel project settings → **Environment Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Auto-set if using Vercel Marketplace Neon integration |
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` |
| `NEXTAUTH_SECRET` | Generate with `npx auth secret` or `openssl rand -base64 32` |

### 3. Push schema and seed to Neon

Run these commands locally — they use the Neon `DATABASE_URL` to set up the remote database:

```bash
# Set the Neon connection string for drizzle-kit
export DATABASE_URL="postgres://user:pass@ep-xxx.region.aws.neon.tech/manolis_pos?sslmode=require"

npm run db:push    # Create tables on Neon
npm run db:seed    # Seed menu data and admin user
```

You can find the Neon `DATABASE_URL` in Vercel → Settings → Environment Variables, or in the Neon console.

### 4. Deploy

```bash
# Option A: Push to GitHub (auto-deploys if connected)
git push origin main

# Option B: Deploy via Vercel CLI
npm i -g vercel@latest
vercel --prod
```

### 5. Verify

1. Open your production URL.
2. Log in with `admin@manolis.local` / `admin123`.
3. You should see the POS screen with all seeded menu items.

> **Security:** Change the default admin password after first deploy. You can do this via the Neon SQL editor or by creating a password-update script.

## [Issues Resolved](./ISSUES-RESOLVED.md)

A log of issues encountered during development, their root causes, and fixes applied.

## Testing

```bash
npm run lint         # Lint check
npm run build        # Type-check + build (catches TS errors)
```

The project uses TypeScript strict mode. The `build` command runs both type-checking and compilation — if it passes, the app is structurally sound.

### Manual test checklist

- [ ] Login with admin credentials redirects to `/pos`
- [ ] Menu items load with correct categories and prices in Euro format
- [ ] Category filter chips toggle correctly
- [ ] Adding items to cart updates the Order Ticket sidebar
- [ ] Quantity stepper adds/removes items
- [ ] Notes can be added to individual items
- [ ] "Send to Kitchen" creates an order and redirects to `/orders`
- [ ] Order history shows submitted orders with correct totals
- [ ] Menu Admin page allows editing prices and toggling availability
- [ ] Logout redirects to login page

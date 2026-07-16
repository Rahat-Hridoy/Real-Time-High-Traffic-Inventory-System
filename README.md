<div align="center">

# 🚀 Real-Time High-Traffic Inventory System

**A production-grade, race-condition-proof inventory reservation engine built for extreme concurrency.**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io)
[![Playwright](https://img.shields.io/badge/Playwright-1.45-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev)

> Handles **50+ concurrent users** attempting to claim the same item at the exact same millisecond. Only **1 succeeds**. Every time.

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Database Schema](#-database-schema)
- [Running the Application](#-running-the-application)
- [Running Playwright Tests](#-running-playwright-tests)
- [Concurrency Test Results](#-concurrency-test-results)
- [Logging Breakdown](#-logging-breakdown)
- [API Reference](#-api-reference)
- [How It Works](#-how-it-works)

---

## 🎯 Overview

This system solves one of the hardest problems in e-commerce: **overselling under high traffic**. When a limited-edition item (a "Drop") has exactly 1 unit in stock and 1,000 users try to buy it simultaneously, only **one transaction can succeed** — no duplicates, no oversells, no race conditions.

### Key Features

| Feature | Implementation |
|---|---|
| **Pessimistic Locking** | `SELECT ... FOR UPDATE` via Sequelize transactions |
| **Real-Time Updates** | Socket.io broadcasts on every stock change |
| **Auto Stock Recovery** | Background worker runs every 5s, expires stale reservations |
| **Row-Level Security** | PostgreSQL RLS ensures users only see their own reservations |
| **Connection Pooling** | Sequelize pool `{ max: 50, min: 10 }` for high concurrency |
| **Cancel & Recover** | Users can cancel reservations, stock returns instantly |
| **E2E Proof** | Playwright API tests validate all guarantees automatically |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              React 19 + Vite + Tailwind CSS              │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐  │   │
│  │  │ Dashboard  │  │ PurchasePage│  │  useInventory    │  │   │
│  │  │   Page     │  │ + Countdown │  │  (state hook)    │  │   │
│  │  └────────────┘  └─────────────┘  └──────────────────┘  │   │
│  │           │               │               │              │   │
│  │           └───────────────┴───────────────┘              │   │
│  │                           │                              │   │
│  │               HTTP REST + Socket.io Client               │   │
│  └───────────────────────────┼──────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                        ╔══════▼══════╗
                        ║  PORT 5000  ║
                        ║  Express.js ║
                        ║  + Node.js  ║
                        ╚══════╤══════╝
              ┌────────────────┼─────────────────┐
              │                │                 │
       ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
       │  REST API   │  │  Socket.io  │  │  Recovery   │
       │  Routes     │  │  Server     │  │  Worker     │
       │             │  │             │  │  (5s cron)  │
       │ /reserve    │  │ stock_update│  │             │
       │ /purchase   │  │ restock     │  │ Expires     │
       │ /cancel     │  │             │  │ PENDING →   │
       │ /drops      │  └─────────────┘  │ EXPIRED     │
       └──────┬──────┘                   └──────┬──────┘
              │                                 │
              └─────────────────┬───────────────┘
                                │
                    ╔═══════════▼═══════════╗
                    ║      PostgreSQL        ║
                    ║  (Neon.tech / local)  ║
                    ║                       ║
                    ║  ┌────────────────┐   ║
                    ║  │  Users         │   ║
                    ║  │  Drops         │   ║
                    ║  │  Reservations  │   ║
                    ║  │  Purchases     │   ║
                    ║  └────────────────┘   ║
                    ║                       ║
                    ║  Pessimistic Lock:    ║
                    ║  SELECT ... FOR UPDATE║
                    ║  Connection Pool:     ║
                    ║  max=50, min=10       ║
                    ╚═══════════════════════╝
```

### Concurrency Flow (The Critical Path)

```
User A ──────► POST /api/reserve ──► BEGIN TRANSACTION
User B ──────► POST /api/reserve ──►   ↓
User C ──────► POST /api/reserve ──►   SELECT * FROM Drops WHERE id=? FOR UPDATE
...                                    ↓ (All other transactions BLOCKED here)
User N ──────► POST /api/reserve ──►   CHECK available_stock >= 1
                                       ↓
                                  ┌────┴────────────────────────┐
                                  │ IF stock >= 1               │
                                  │   available_stock -= 1      │
                                  │   INSERT INTO Reservations  │
                                  │   COMMIT  ← Lock released   │
                                  └─────────────────────────────┘
                                       ↓
                              All blocked transactions unblock.
                              They each see available_stock = 0.
                              They all ROLLBACK with OUT_OF_STOCK.
```

---

## 🛠️ Technology Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| `express` | 4.x | HTTP server & routing |
| `sequelize` | 6.x | ORM with transaction & lock support |
| `pg` | 8.x | PostgreSQL driver |
| `socket.io` | 4.x | Real-time WebSocket broadcasting |
| `tsx` | 4.x | TypeScript execution (dev) |
| `dotenv` | 16.x | Environment variable loading |

### Frontend
| Package | Version | Purpose |
|---|---|---|
| `react` | 19.x | UI library |
| `react-router-dom` | 7.x | Client-side routing |
| `socket.io-client` | 4.x | Real-time event listener |
| `react-hot-toast` | 2.x | Toast notifications |
| `tailwindcss` | 4.x | Utility-first CSS |
| `lucide-react` | 1.x | Icon library |
| `vite` | 8.x | Build tool |

### Testing
| Package | Version | Purpose |
|---|---|---|
| `@playwright/test` | 1.45.x | API-mode concurrency testing |

---

## 📁 Project Structure

```
Techzu/
├── backend/
│   ├── .env                      # Environment variables
│   ├── config/
│   │   └── db.ts                 # Sequelize connection + pooling
│   ├── models/
│   │   ├── index.ts              # Model exports + associations
│   │   ├── User.ts               # Users model
│   │   ├── Drop.ts               # Drops model (inventory items)
│   │   ├── Reservation.ts        # Reservations model
│   │   └── Purchase.ts           # Purchases model
│   ├── scripts/
│   │   ├── test-db.ts            # Stage 1: DB connection check
│   │   ├── test-reserve.ts       # Stage 2: Reservation logic check
│   │   ├── test-recovery.ts      # Stage 3: Recovery worker check
│   │   └── test-cancel.ts        # Cancel reservation check
│   ├── src/
│   │   ├── index.ts              # Server entry point
│   │   ├── server.ts             # Express app setup
│   │   ├── socket.ts             # Socket.io init + broadcast helpers
│   │   ├── worker.ts             # Recovery worker scheduler
│   │   ├── recovery.ts           # Stock recovery logic (core)
│   │   └── routes/
│   │       └── reservation.ts    # All API routes
│   └── schema.sql                # PostgreSQL schema + RLS policies
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Root component + auth state
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx     # Username login
│   │   │   ├── DashboardPage.tsx # Drops catalog + reservations
│   │   │   └── PurchasePage.tsx  # Purchase flow + countdown
│   │   ├── components/
│   │   │   ├── layout/Navbar.tsx
│   │   │   ├── drops/ProductCard.tsx
│   │   │   ├── reservations/ReservationItem.tsx
│   │   │   └── ui/CountdownTimer.tsx
│   │   ├── hooks/
│   │   │   ├── useInventory.ts   # Main state + API calls hook
│   │   │   └── useSocket.ts      # Socket.io event listener hook
│   │   ├── lib/
│   │   │   └── api.ts            # Typed fetch wrappers
│   │   ├── types/index.ts        # Shared TypeScript types
│   │   └── constants/index.ts    # Card accent colors
│   └── index.html
│
└── tests/
    ├── playwright.config.ts      # API mode config, 120s timeout
    ├── concurrency.spec.ts       # Main E2E test suite
    └── helpers/
        └── seed.ts               # resetDropStock, upsertTestUser helpers
```

---

## ✅ Prerequisites

- **Node.js** v20+ (`node --version`)
- **npm** v10+ (`npm --version`)
- **PostgreSQL** 15+ (local or hosted, e.g. [Neon.tech](https://neon.tech))
- **Git**

---

## 📦 Installation

### 1. Clone the repository

```bash
git clone https://github.com/Rahat-Hridoy/Real-Time-High-Traffic-Inventory-System.git
cd Real-Time-High-Traffic-Inventory-System
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 4. Install test dependencies

```bash
cd ../tests
npm install
```

---

## 🔑 Environment Variables

Create `backend/.env` with the following:

```env
# Server
PORT=5000

# Database (local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=techzu
DB_USER=postgres
DB_PASSWORD=your_password

# OR: use a hosted connection string (Neon, Supabase, etc.)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

> **Note:** If `DATABASE_URL` is set, the app uses it directly (cloud). Otherwise it constructs the connection from individual `DB_*` variables (local).

---

## 🗄️ Database Schema

Run this SQL against your PostgreSQL database to set up all tables, indexes, and RLS policies:

```sql
-- Enable RLS app variable helper
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS INTEGER AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::INTEGER;
$$ LANGUAGE SQL STABLE;

-- Users table
CREATE TABLE IF NOT EXISTS "Users" (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drops table (inventory items)
CREATE TABLE IF NOT EXISTS "Drops" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_stock INTEGER NOT NULL DEFAULT 0,
  available_stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reservations table
CREATE TABLE IF NOT EXISTS "Reservations" (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "Users"(id),
  drop_id INTEGER NOT NULL REFERENCES "Drops"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'COMPLETED', 'EXPIRED')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases table
CREATE TABLE IF NOT EXISTS "Purchases" (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "Users"(id),
  drop_id INTEGER NOT NULL REFERENCES "Drops"(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Composite B-Tree index on Purchases for rapid top-buyer lookups
CREATE INDEX IF NOT EXISTS idx_purchases_drop_created
  ON "Purchases" (drop_id, created_at DESC);

-- Row Level Security on Reservations
ALTER TABLE "Reservations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY reservations_isolation ON "Reservations"
  USING (user_id = current_app_user_id());

-- Seed some example drops
INSERT INTO "Drops" (name, price, total_stock, available_stock) VALUES
  ('Air Jordan 1 Retro High "Chicago"', 180.00, 1, 1),
  ('Nike SB Dunk Low "Panda"', 110.00, 3, 3),
  ('Adidas Yeezy 350 V2 "Zebra"', 220.00, 2, 2)
ON CONFLICT DO NOTHING;
```

---

## 🚀 Running the Application

### Start the Backend

```bash
cd backend
npm run dev
```

Expected output:
```
[SERVER] Authenticating database connection...
[SERVER] Database connection verified successfully.
[WORKER] Starting stock recovery worker. Running every 5 seconds.
[SERVER] Running with Socket.io on http://localhost:5000
```

### Start the Frontend

Open a second terminal:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

1. Enter any username to log in (account is created automatically)
2. Click **Reserve** on any drop
3. Complete the purchase within the 60-second countdown
4. Observe real-time stock updates across multiple browser tabs

---

## 🧪 Running Playwright Tests

The Playwright suite uses **API testing mode** — no browser window opens. It sends raw HTTP requests directly to the backend, making it ideal for concurrency validation.

### Prerequisites

The backend must be running in **test mode**:

```bash
# Terminal 1 — Backend in test mode
cd backend
$env:NODE_ENV="test"   # PowerShell (Windows)
# OR
NODE_ENV=test          # bash/zsh (Mac/Linux)
npm run dev
```

### Run the Tests

```bash
# Terminal 2
cd tests
npx playwright test --reporter=list
```

### What the Tests Do

```
Test 1 — [CONCURRENCY]   ~18s
  ├─ Resets drop stock to exactly 1
  ├─ Creates 50 test user accounts in parallel
  ├─ Fires all 50 POST /api/reserve requests simultaneously
  └─ Asserts: exactly 1 succeeds (HTTP 201), 49 fail with OUT_OF_STOCK

Test 2 — [RECOVERY]      ~65s
  ├─ Does NOT complete the winning reservation
  ├─ Waits 65 seconds (reservation expires at 60s, worker runs every 5s)
  └─ Asserts: available_stock === 1 (fully recovered)

Test 3 — [CANCEL]        ~7s
  ├─ Resets stock to 1
  ├─ Makes a fresh reservation (stock drops to 0)
  ├─ Immediately cancels it via POST /api/cancel-reservation
  └─ Asserts: available_stock === 1 (instantly restored)
```

### View HTML Report

After running:

```bash
npx playwright show-report
```

---

## 📊 Concurrency Test Results

Full output from the Playwright suite run on **2026-07-16**:

```
══════════════════════════════════════════════════════════════════════
TEST 1 — CONCURRENCY: 50 users vs. 1-stock drop
══════════════════════════════════════════════════════════════════════

[STEP 1] Resetting Drop 14 stock to 1 via test endpoint...
[STEP 1] ✓ Stock reset to 1 confirmed.

[STEP 2] Creating 50 test user accounts...
[STEP 2] ✓ 50 users ready.

[STEP 3] Firing 50 POST /api/reserve requests in parallel...
[STEP 3] → All requests launched at the same moment.
[STEP 3] ✓ All 50 requests completed in 13860ms.

[STEP 4] Analysing results...

  User  1 (id=16) → [400] ❌ FAIL    | error=OUT_OF_STOCK
  User  2 (id=17) → [201] ✅ SUCCESS | reservation_id=42
  User  3 (id=21) → [400] ❌ FAIL    | error=OUT_OF_STOCK
  ...
  User 50 (id=65) → [400] ❌ FAIL    | error=OUT_OF_STOCK

──────────────────────────────────────────────────────────────────────
  Total requests    : 50
  ✅ Successes      : 1  (expected: 1)
  ❌ OUT_OF_STOCK   : 49  (expected: 49)
  ⚠️  Other errors  : 0  (expected: 0)
  ⏱  Elapsed       : 13860ms
──────────────────────────────────────────────────────────────────────

[TEST 1] ✅ PASSED — Pessimistic locking held. Only 1 reservation succeeded.

══════════════════════════════════════════════════════════════════════
TEST 2 — RECOVERY
══════════════════════════════════════════════════════════════════════

[STEP 2] Drop 14 → available_stock=1 (expected: 1)
  Drop Name         : Air Jordan 1 Retro High "Chicago"
  Available Stock   : 1  (expected: 1)

[TEST 2] ✅ PASSED — Stock recovered to 1 after reservation expiry.

══════════════════════════════════════════════════════════════════════
TEST 3 — CANCEL
══════════════════════════════════════════════════════════════════════

[STEP 2] ✓ Reserved successfully. reservation_id=43, available_stock=0
[STEP 4] ✓ Cancelled. available_stock=1 (expected: 1)

[TEST 3] ✅ PASSED — Cancel reservation immediately restored stock to 1.

  ✓ [api] › concurrency.spec.ts › [CONCURRENCY] Only 1 of 50 succeeds  (18.1s)
  ✓ [api] › concurrency.spec.ts › [RECOVERY] Stock recovers after 65s   (1.1m)
  ✓ [api] › concurrency.spec.ts › [CANCEL] Cancel restores stock        (6.6s)

  3 passed (1.6m)
```

---

## 📝 Logging Breakdown

Every backend action is logged with a consistent prefix format:

| Prefix | Module | Meaning |
|---|---|---|
| `[SERVER]` | `index.ts` | Server startup / shutdown events |
| `[RESERVE][TX:xxx]` | `routes/reservation.ts` | Reservation transaction steps |
| `[PURCHASE][TX:xxx]` | `routes/reservation.ts` | Purchase transaction steps |
| `[CANCEL][TX:xxx]` | `routes/reservation.ts` | Cancel reservation steps |
| `[RECOVERY][TX:xxx]` | `recovery.ts` | Background worker stock recovery |
| `[WORKER]` | `worker.ts` | Recovery worker scheduling |
| `[SOCKET]` | `socket.ts` | WebSocket broadcast events |
| `[SEQUELIZE]` | Sequelize | Raw SQL query logs |
| `[TEST-RESET]` | `routes/reservation.ts` | Test-only stock seeding |
| `[SEED]` | `tests/helpers/seed.ts` | Playwright seeding actions |

### Example Transaction Log

```
[RESERVE][TX:abc-123] Transaction started.
[RESERVE][TX:abc-123] Setting session user context to 17
[RESERVE][TX:abc-123] Querying Drop ID 14 with FOR UPDATE lock...
[RESERVE][TX:abc-123] Acquired lock on Drop ID 14. Current available stock: 1
[RESERVE][TX:abc-123] Decremented stock by 1. New stock: 0
[RESERVE][TX:abc-123] Created pending reservation ID 42 expiring at 2026-07-16T06:45:00Z
[RESERVE][TX:abc-123] Transaction committed successfully.
[SOCKET] Broadcasting stock update → Drop ID: 14, Available Stock: 0
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/users` | Create or retrieve a user by username |
| `GET` | `/api/drops` | Fetch all available drops |
| `POST` | `/api/reserve` | Reserve a drop (pessimistic lock) |
| `GET` | `/api/reservations?userId=` | Fetch reservations for a user |
| `POST` | `/api/purchase` | Complete a purchase using a reservation |
| `POST` | `/api/cancel-reservation` | Cancel a pending reservation (restores stock) |
| `PATCH` | `/api/drops/:id/reset-stock` | ⚠️ Test-only: Reset stock (NODE_ENV=test) |

### Socket.io Events

| Event | Direction | Payload |
|---|---|---|
| `stock_update` | Server → Client | `{ dropId, availableStock, status, recentBuyers }` |
| `restock` | Server → Client | `{ dropId, name }` |

---

## 🔒 How It Works

### 1. Pessimistic Locking (Race Condition Prevention)

When a user clicks **Reserve**, the backend:
1. Opens a PostgreSQL transaction
2. Executes `SELECT * FROM "Drops" WHERE id = ? FOR UPDATE` — this **locks the row**
3. All other transactions trying to lock the same row are **blocked** (queued by PostgreSQL)
4. Once the first transaction commits or rolls back, the next transaction gets the lock and sees the updated stock

This guarantees atomicity at the database level — not just at the application level.

### 2. Stock Recovery Worker

```typescript
// Runs every 5 seconds
setInterval(async () => {
  // Finds PENDING reservations where expires_at < NOW()
  // Atomically increments available_stock for each affected drop
  // Marks reservations as EXPIRED
  // Broadcasts restock event via Socket.io
}, 5000);
```

### 3. Row-Level Security

PostgreSQL RLS ensures users can only query **their own** reservations:

```sql
CREATE POLICY reservations_isolation ON "Reservations"
  USING (user_id = current_app_user_id());
```

Before each query, the backend sets: `SET LOCAL app.current_user_id = :userId`

### 4. Connection Pooling

```typescript
pool: {
  max: 50,   // Maximum simultaneous connections
  min: 10,   // Always keep 10 connections warm
  idle: 10000 // Release idle connections after 10s
}
```

This prevents connection exhaustion under the 50-user load test.

---

<div align="center">

**Built with ❤️ for the Techzu engineering challenge.**

*Proving that with the right database primitives, 50 users can race to claim 1 item — and only 1 wins.*

</div>

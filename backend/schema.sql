-- PostgreSQL Database Schema for Techzu Inventory Reservation System

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS "Users" (
  "id" SERIAL PRIMARY KEY,
  "username" VARCHAR(255) NOT NULL UNIQUE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Drops Table
CREATE TABLE IF NOT EXISTS "Drops" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "price" DECIMAL(10, 2) NOT NULL,
  "total_stock" INTEGER NOT NULL DEFAULT 0,
  "available_stock" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Reservations Table
CREATE TABLE IF NOT EXISTS "Reservations" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "drop_id" INTEGER NOT NULL REFERENCES "Drops"("id") ON DELETE CASCADE,
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'EXPIRED')),
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Purchases Table
CREATE TABLE IF NOT EXISTS "Purchases" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "drop_id" INTEGER NOT NULL REFERENCES "Drops"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Composite Index on Purchases table for rapid lookup of top buyers
CREATE INDEX IF NOT EXISTS idx_purchases_drop_created ON "Purchases" ("drop_id", "created_at");

-- 6. Enable Row Level Security (RLS) and FORCE it (applies even for superusers/owners)
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Users" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reservations" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Purchases" FORCE ROW LEVEL SECURITY;

-- 7. Define RLS Policies based on transaction session variable 'app.current_user_id'
DROP POLICY IF EXISTS user_self ON "Users";
CREATE POLICY user_self ON "Users" FOR ALL USING (
  "id" = NULLIF(current_setting('app.current_user_id', true), '')::integer
);

DROP POLICY IF EXISTS res_self ON "Reservations";
CREATE POLICY res_self ON "Reservations" FOR ALL USING (
  "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::integer
);

DROP POLICY IF EXISTS pur_self ON "Purchases";
CREATE POLICY pur_self ON "Purchases" FOR ALL USING (
  "user_id" = NULLIF(current_setting('app.current_user_id', true), '')::integer
);

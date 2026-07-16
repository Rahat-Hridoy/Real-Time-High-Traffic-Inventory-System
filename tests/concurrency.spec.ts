/**
 * concurrency.spec.ts
 *
 * Stage 5 — High-Concurrency Playwright API Tests
 * =================================================
 * This suite validates the core promise of the system:
 *   "Under extreme concurrent load, exactly ONE reservation succeeds
 *    and all others are rejected. Stock recovery works reliably."
 *
 * Test Cases
 * ----------
 * 1. [CONCURRENCY] 50 parallel users attempt to reserve a 1-stock drop.
 *    → Exactly 1 must succeed (HTTP 201), 49 must fail with OUT_OF_STOCK.
 *
 * 2. [RECOVERY] After 65 seconds, the winning reservation expires
 *    (if not purchased) and the recovery worker restores stock to 1.
 *    → available_stock must be 1 again.
 *
 * 3. [CANCEL] A fresh reservation can be immediately cancelled,
 *    which instantly restores the stock level.
 *    → available_stock must return to its pre-reserve value.
 *
 * Prerequisites
 * -------------
 * - Backend running with NODE_ENV=test on port 5000.
 * - At least one row in the `drops` table. The test targets DROP_ID.
 */

import { test, expect } from '@playwright/test';
import { resetDropStock, upsertTestUser, fetchDrops } from './helpers/seed';

// ─── Configuration ────────────────────────────────────────────────────────────
const CONCURRENT_USERS = 50;

// We pick the first drop in the database. Override with an env var if needed.
let DROP_ID: number;

// Shared state between tests (serial execution guarantees order)
let winningReservationId: number | null = null;
let winningUserId: number | null = null;

// ─── Before all: resolve DROP_ID ──────────────────────────────────────────────
test.beforeAll(async ({ request }) => {
  const drops = await fetchDrops(request);
  if (drops.length === 0) {
    throw new Error(
      '[SETUP] No drops found in the database. Add at least one row to the `drops` table before running tests.'
    );
  }
  DROP_ID = drops[0].id;
  console.log(`\n[SETUP] Target drop → id=${DROP_ID}, name="${drops[0].name}"`);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: High-Concurrency Race — 50 users, 1 stock
// ─────────────────────────────────────────────────────────────────────────────
test('[CONCURRENCY] Only 1 of 50 concurrent reservations succeeds', async ({ request }) => {
  console.log('\n' + '═'.repeat(70));
  console.log('TEST 1 — CONCURRENCY: 50 users vs. 1-stock drop');
  console.log('═'.repeat(70));

  // ── Step 1: Seed — reset stock to exactly 1 ───────────────────────────────
  console.log(`\n[STEP 1] Resetting Drop ${DROP_ID} stock to 1 via test endpoint...`);
  await resetDropStock(request, DROP_ID, 1);
  console.log('[STEP 1] ✓ Stock reset to 1 confirmed.\n');

  // ── Step 2: Spin up 50 test users ─────────────────────────────────────────
  console.log(`[STEP 2] Creating ${CONCURRENT_USERS} test user accounts...`);
  const users = await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, (_, i) =>
      upsertTestUser(request, `playwright_user_${i + 1}`)
    )
  );
  console.log(`[STEP 2] ✓ ${users.length} users ready.\n`);

  // ── Step 3: Fire all 50 reserve requests simultaneously ───────────────────
  console.log(`[STEP 3] Firing ${CONCURRENT_USERS} POST /api/reserve requests in parallel...`);
  console.log('[STEP 3] → All requests launched at the same moment.\n');

  const startTime = Date.now();

  const results = await Promise.all(
    users.map(async (user, idx) => {
      const res = await request.post('/api/reserve', {
        data: { userId: user.id, dropId: DROP_ID }
      });

      const status = res.status();
      let body: any;
      try {
        body = await res.json();
      } catch {
        body = {};
      }

      return { userIndex: idx + 1, userId: user.id, status, body };
    })
  );

  const elapsed = Date.now() - startTime;
  console.log(`[STEP 3] ✓ All ${CONCURRENT_USERS} requests completed in ${elapsed}ms.\n`);

  // ── Step 4: Analyse results ────────────────────────────────────────────────
  console.log('[STEP 4] Analysing results...\n');

  const successes = results.filter(r => r.status === 201);
  const outOfStock = results.filter(r => r.status === 400 && r.body?.error === 'OUT_OF_STOCK');
  const otherErrors = results.filter(r => r.status !== 201 && !(r.status === 400 && r.body?.error === 'OUT_OF_STOCK'));

  // Print each result
  for (const r of results) {
    const icon = r.status === 201 ? '✅ SUCCESS' : '❌ FAIL   ';
    const detail = r.status === 201
      ? `reservation_id=${r.body?.reservation?.id}`
      : `error=${r.body?.error}`;
    console.log(`  User ${String(r.userIndex).padStart(2)} (id=${r.userId}) → [${r.status}] ${icon} | ${detail}`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`  Total requests    : ${CONCURRENT_USERS}`);
  console.log(`  ✅ Successes      : ${successes.length}  (expected: 1)`);
  console.log(`  ❌ OUT_OF_STOCK   : ${outOfStock.length}  (expected: ${CONCURRENT_USERS - 1})`);
  console.log(`  ⚠️  Other errors  : ${otherErrors.length}  (expected: 0)`);
  console.log(`  ⏱  Elapsed       : ${elapsed}ms`);
  console.log('─'.repeat(70) + '\n');

  if (otherErrors.length > 0) {
    for (const e of otherErrors) {
      console.error(`  UNEXPECTED ERROR from user ${e.userIndex}: status=${e.status}`, e.body);
    }
  }

  // Store winning reservation for the next test
  if (successes.length === 1) {
    winningReservationId = successes[0].body?.reservation?.id ?? null;
    winningUserId = successes[0].userId;
    console.log(`[RESULT] Winning user: id=${winningUserId}, reservation_id=${winningReservationId}`);
  }

  // ── Assertions ────────────────────────────────────────────────────────────
  expect(successes.length).toBe(1);
  expect(outOfStock.length).toBe(CONCURRENT_USERS - 1);
  expect(otherErrors.length).toBe(0);
  console.log('\n[TEST 1] ✅ PASSED — Pessimistic locking held. Only 1 reservation succeeded.');
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Stock Recovery — expires_at elapses, worker restores stock
// ─────────────────────────────────────────────────────────────────────────────
test('[RECOVERY] Stock recovers to 1 after reservation expires (65 s wait)', async ({ request }) => {
  console.log('\n' + '═'.repeat(70));
  console.log('TEST 2 — RECOVERY: Waiting for reservation to expire + worker to reclaim stock');
  console.log('═'.repeat(70));

  if (!winningReservationId) {
    console.warn('[RECOVERY] No winning reservation from Test 1. Skipping recovery check.');
    test.skip();
    return;
  }

  console.log(`\n[STEP 1] Winning reservation_id=${winningReservationId} was NOT completed.`);
  console.log('[STEP 1] It expires in 60 s. Recovery worker runs every 5 s.');
  console.log('[STEP 1] Waiting 65 seconds for the worker to reclaim the stock...\n');

  // Wait 65 seconds — this is intentional and per the instruction spec.
  await new Promise(resolve => setTimeout(resolve, 65_000));

  console.log('[STEP 2] Wait complete. Fetching current drop stock from /api/drops...');
  const drops = await fetchDrops(request);
  const targetDrop = drops.find(d => d.id === DROP_ID);

  if (!targetDrop) {
    throw new Error(`[RECOVERY] Drop ${DROP_ID} not found in /api/drops response.`);
  }

  console.log(`[STEP 2] Drop ${DROP_ID} → available_stock=${targetDrop.available_stock} (expected: 1)`);
  console.log('\n' + '─'.repeat(70));
  console.log(`  Drop ID           : ${targetDrop.id}`);
  console.log(`  Drop Name         : ${targetDrop.name}`);
  console.log(`  Available Stock   : ${targetDrop.available_stock}  (expected: 1)`);
  console.log('─'.repeat(70) + '\n');

  expect(targetDrop.available_stock).toBe(1);
  console.log('[TEST 2] ✅ PASSED — Stock recovered to 1 after reservation expiry.');
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Cancel Reservation — immediately restores stock
// ─────────────────────────────────────────────────────────────────────────────
test('[CANCEL] Cancelling a reservation immediately restores stock', async ({ request }) => {
  console.log('\n' + '═'.repeat(70));
  console.log('TEST 3 — CANCEL: Reserve then immediately cancel, verify stock restored');
  console.log('═'.repeat(70));

  // ── Step 1: Ensure stock = 1 ──────────────────────────────────────────────
  console.log('\n[STEP 1] Resetting stock to 1 for a clean cancel test...');
  await resetDropStock(request, DROP_ID, 1);

  // ── Step 2: Make a fresh reservation ──────────────────────────────────────
  console.log('[STEP 2] Creating a fresh reservation with playwright_cancel_user...');
  const cancelUser = await upsertTestUser(request, 'playwright_cancel_user');

  const reserveRes = await request.post('/api/reserve', {
    data: { userId: cancelUser.id, dropId: DROP_ID }
  });

  expect(reserveRes.status()).toBe(201);
  const reserveBody = await reserveRes.json();
  const reservationId = reserveBody.reservation.id;
  console.log(`[STEP 2] ✓ Reserved successfully. reservation_id=${reservationId}, available_stock=${reserveBody.available_stock}`);
  expect(reserveBody.available_stock).toBe(0);

  // ── Step 3: Verify stock is now 0 ─────────────────────────────────────────
  console.log('[STEP 3] Verifying stock is 0 post-reservation...');
  const dropsAfterReserve = await fetchDrops(request);
  const dropAfterReserve = dropsAfterReserve.find(d => d.id === DROP_ID)!;
  console.log(`[STEP 3] available_stock=${dropAfterReserve.available_stock} (expected: 0)`);
  expect(dropAfterReserve.available_stock).toBe(0);

  // ── Step 4: Cancel the reservation ────────────────────────────────────────
  console.log('\n[STEP 4] Cancelling reservation via POST /api/cancel-reservation...');
  const cancelRes = await request.post('/api/cancel-reservation', {
    data: { reservationId, userId: cancelUser.id }
  });

  expect(cancelRes.status()).toBe(200);
  const cancelBody = await cancelRes.json();
  console.log(`[STEP 4] ✓ Cancelled. available_stock=${cancelBody.available_stock} (expected: 1)`);
  expect(cancelBody.available_stock).toBe(1);

  // ── Step 5: Confirm via GET /api/drops ────────────────────────────────────
  console.log('[STEP 5] Confirming restored stock via GET /api/drops...');
  const dropsAfterCancel = await fetchDrops(request);
  const dropAfterCancel = dropsAfterCancel.find(d => d.id === DROP_ID)!;

  console.log('\n' + '─'.repeat(70));
  console.log(`  Drop ID           : ${dropAfterCancel.id}`);
  console.log(`  Post-Cancel Stock : ${dropAfterCancel.available_stock}  (expected: 1)`);
  console.log('─'.repeat(70) + '\n');

  expect(dropAfterCancel.available_stock).toBe(1);
  console.log('[TEST 3] ✅ PASSED — Cancel reservation immediately restored stock to 1.');
});

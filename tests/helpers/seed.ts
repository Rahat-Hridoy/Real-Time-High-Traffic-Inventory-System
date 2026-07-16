/**
 * helpers/seed.ts
 *
 * Utility functions used by Playwright tests to set up deterministic
 * database state before each test run. These call the test-only backend
 * endpoints that are guarded by NODE_ENV=test.
 */

import { APIRequestContext } from '@playwright/test';

/**
 * Resets the available_stock of a drop to the given value.
 * Also expires any lingering PENDING reservations for that drop.
 * Requires the backend to be running with NODE_ENV=test.
 */
export async function resetDropStock(
  request: APIRequestContext,
  dropId: number,
  stock: number
): Promise<void> {
  const response = await request.patch(`/api/drops/${dropId}/reset-stock`, {
    data: { stock }
  });

  if (!response.ok()) {
    const body = await response.json();
    throw new Error(
      `[SEED] Failed to reset stock for drop ${dropId}: ${JSON.stringify(body)}`
    );
  }

  const body = await response.json();
  console.log(
    `[SEED] Drop ${dropId} stock reset → available_stock=${body.available_stock}`
  );
}

/**
 * Creates or retrieves a test user by username.
 * Returns the user object with { id, username }.
 */
export async function upsertTestUser(
  request: APIRequestContext,
  username: string
): Promise<{ id: number; username: string }> {
  const response = await request.post('/api/users', {
    data: { username }
  });

  if (!response.ok()) {
    const body = await response.json();
    throw new Error(`[SEED] Failed to create/retrieve user "${username}": ${JSON.stringify(body)}`);
  }

  const user = await response.json();
  console.log(`[SEED] Test user ready → id=${user.id}, username=${user.username}`);
  return { id: user.id, username: user.username };
}

/**
 * Fetches all available drops and returns them.
 */
export async function fetchDrops(
  request: APIRequestContext
): Promise<Array<{ id: number; name: string; available_stock: number; total_stock: number }>> {
  const response = await request.get('/api/drops');
  if (!response.ok()) {
    throw new Error('[SEED] Failed to fetch drops.');
  }
  return response.json();
}

import sequelize from '../config/db';
import { User, Drop, Reservation, Purchase } from '../models';
import { QueryTypes } from 'sequelize';

async function testDatabase() {
  console.log('[BACKEND CHECK] Starting Database & RLS Verification...');
  
  try {
    await sequelize.authenticate();
    console.log('[BACKEND CHECK] Database connection authenticated successfully.');
  } catch (error: any) {
    console.error('[BACKEND CHECK] Database authentication failed. Check your .env file.', error.message);
    process.exit(1);
  }

  // 1. Verify table existence
  try {
    await sequelize.query('SELECT 1 FROM "Users" LIMIT 1', { type: QueryTypes.SELECT });
    await sequelize.query('SELECT 1 FROM "Drops" LIMIT 1', { type: QueryTypes.SELECT });
    await sequelize.query('SELECT 1 FROM "Reservations" LIMIT 1', { type: QueryTypes.SELECT });
    await sequelize.query('SELECT 1 FROM "Purchases" LIMIT 1', { type: QueryTypes.SELECT });
    console.log('[BACKEND CHECK] Verified all schema tables exist.');
  } catch (error: any) {
    console.error('[BACKEND CHECK] Schema table check failed. Have you run the DDL schema in schema.sql?', error.message);
    process.exit(1);
  }

  // 2. Verify connection pool config
  const pool: any = (sequelize.connectionManager as any).pool;
  console.log(`[BACKEND CHECK] Connection Pool config: min=${pool.min}, max=${pool.max}, idleTimeout=${pool.idleTimeoutMillis}`);
  console.log(`[BACKEND CHECK] Current Pool stats: size=${pool.size}, available=${pool.available}, pending=${pool.pending}`);

  // 3. Verify Composite Index exists on Purchases(drop_id, created_at)
  try {
    const indexes = await sequelize.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'Purchases' AND indexname = 'idx_purchases_drop_created';`,
      { type: QueryTypes.SELECT }
    );
    if (indexes.length > 0) {
      console.log(`[BACKEND CHECK] Composite index 'idx_purchases_drop_created' verified in pg_indexes.`);
    } else {
      console.error(`[BACKEND CHECK] Composite index 'idx_purchases_drop_created' NOT found on Purchases table.`);
    }
  } catch (error: any) {
    console.error('[BACKEND CHECK] Error checking composite index:', error.message);
  }

  // 3b. Diagnostic check for RLS status
  try {
    const rlsStatus = await sequelize.query<{ rowsecurity: boolean; relname: string }>(
      `SELECT c.relname, c.relrowsecurity as rowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname IN ('Users', 'Reservations', 'Purchases') AND n.nspname = 'public';`,
      { type: QueryTypes.SELECT }
    );
    console.log('[BACKEND CHECK] RLS Table status:', rlsStatus);

    const policies = await sequelize.query<{ policyname: string; tablename: string }>(
      `SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public';`,
      { type: QueryTypes.SELECT }
    );
    console.log('[BACKEND CHECK] Active Policies:', policies);

    const roleAttributes = await sequelize.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = CURRENT_USER;`,
      { type: QueryTypes.SELECT }
    );
    console.log('[BACKEND CHECK] Current user attributes:', roleAttributes);
  } catch (error: any) {
    console.error('[BACKEND CHECK] Error checking RLS diagnostics:', error.message);
  }

  // 4. Verification of Row Level Security (RLS)
  console.log('\n[BACKEND CHECK] Starting Row Level Security (RLS) enforcement verification...');
  
  // Try to alter current role to NOBYPASSRLS to force RLS check on this admin user
  try {
    const [{ rolname }] = await sequelize.query<{ rolname: string }>(
      `SELECT CURRENT_USER as rolname;`,
      { type: QueryTypes.SELECT }
    );
    console.log(`[BACKEND CHECK] Attempting to alter role ${rolname} to NOBYPASSRLS...`);
    await sequelize.query(`ALTER ROLE "${rolname}" NOBYPASSRLS;`);
    console.log(`[BACKEND CHECK] Successfully altered role ${rolname} to NOBYPASSRLS.`);
  } catch (error: any) {
    console.log(`[BACKEND CHECK] Note: Could not alter role to NOBYPASSRLS (this is normal for cloud/managed DB owners without superuser privileges): ${error.message}`);
    console.log(`[BACKEND CHECK] Recommendation: For RLS testing/production, use a dedicated app user that does not have the BYPASSRLS attribute.`);
  }

  const transaction = await sequelize.transaction();
  try {
    const userA = await User.create({ username: 'test_user_rls_A' }, { transaction, logging: false });
    const userB = await User.create({ username: 'test_user_rls_B' }, { transaction, logging: false });
    
    const drop = await Drop.create({
      name: 'Test Drop RLS',
      price: 99.99,
      total_stock: 10,
      available_stock: 10
    }, { transaction, logging: false });

    // Create a reservation for User A
    const resA = await Reservation.create({
      user_id: userA.id,
      drop_id: drop.id,
      status: 'PENDING',
      expires_at: new Date(Date.now() + 60000)
    }, { transaction, logging: false });

    console.log(`[BACKEND CHECK] Created reservation ID ${resA.id} for User A (${userA.username}, ID ${userA.id})`);

    // Case 1: Query reservation without setting app.current_user_id
    const resNoUser = await Reservation.findByPk(resA.id, { transaction, logging: false });
    console.log(`[BACKEND CHECK] Fetch with no user context: ${resNoUser ? 'FOUND (RLS FAILED!)' : 'NOT FOUND (RLS PASSED)'}`);

    // Case 2: Query reservation setting app.current_user_id to User B
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId: userB.id.toString() },
      transaction,
      logging: false
    });
    
    const resUserB = await Reservation.findByPk(resA.id, { transaction, logging: false });
    console.log(`[BACKEND CHECK] Fetch with User B context (ID ${userB.id}): ${resUserB ? 'FOUND (RLS FAILED!)' : 'NOT FOUND (RLS PASSED)'}`);

    // Case 3: Query reservation setting app.current_user_id to User A
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId: userA.id.toString() },
      transaction,
      logging: false
    });
    
    const resUserA = await Reservation.findByPk(resA.id, { transaction, logging: false });
    console.log(`[BACKEND CHECK] Fetch with User A context (ID ${userA.id}): ${resUserA ? `FOUND (ID ${resUserA.id}, RLS PASSED)` : 'NOT FOUND (RLS FAILED!)'}`);

    console.log('[BACKEND CHECK] Row Level Security (RLS) enforcement verification COMPLETED.');
  } catch (error: any) {
    console.error('[BACKEND CHECK] RLS verification encountered an error:', error.message);
  } finally {
    await transaction.rollback();
    console.log('[BACKEND CHECK] Transaction rolled back. Cleaned up test data.');
  }

  // Close connection
  await sequelize.close();
  console.log('[BACKEND CHECK] Database verification completed successfully.');
}

testDatabase().catch((err) => {
  console.error('[BACKEND CHECK] Unexpected error:', err);
});

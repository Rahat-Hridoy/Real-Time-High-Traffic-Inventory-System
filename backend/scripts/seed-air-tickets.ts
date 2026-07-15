import sequelize from '../config/db';
import { Drop, Reservation, Purchase } from '../models';

async function seedAirTickets() {
  console.log('[SEED] Connecting to database...');
  try {
    await sequelize.authenticate();
    console.log('[SEED] Database connection verified.');

    // Start transaction to safely wipe and insert
    const tx = await sequelize.transaction();
    try {
      console.log('[SEED] Wiping old reservations, purchases and drops...');
      await Reservation.destroy({ where: {}, transaction: tx });
      await Purchase.destroy({ where: {}, transaction: tx });
      await Drop.destroy({ where: {}, transaction: tx });

      console.log('[SEED] Seeding 6 air ticket booking drops...');
      const tickets = [
        {
          name: 'Air Jordan Flight 1-100 (JFK to LHR)',
          price: 499.99,
          total_stock: 10,
          available_stock: 10,
        },
        {
          name: 'Air Jordan Flight 2-200 (NRT to CDG)',
          price: 799.50,
          total_stock: 8,
          available_stock: 8,
        },
        {
          name: 'Air Jordan Flight 3-300 (LAX to SYD)',
          price: 949.00,
          total_stock: 5,
          available_stock: 5,
        },
        {
          name: 'Air Jordan Flight 4-400 (DXB to SIN)',
          price: 619.99,
          total_stock: 12,
          available_stock: 12,
        },
        {
          name: 'Air Jordan Flight 5-500 (LHR to FCO)',
          price: 179.00,
          total_stock: 15,
          available_stock: 15,
        },
        {
          name: 'Air Jordan Flight 6-600 (SFO to HNL)',
          price: 349.50,
          total_stock: 6,
          available_stock: 6,
        },
      ];

      for (const t of tickets) {
        const created = await Drop.create(t, { transaction: tx });
        console.log(`[SEED] Created: ${created.name} (ID: ${created.id}, Stock: ${created.available_stock})`);
      }

      await tx.commit();
      console.log('[SEED] Database transaction committed successfully. Seeding complete!');
    } catch (err: any) {
      await tx.rollback();
      console.error('[SEED] Transaction rolled back due to error:', err.message);
      throw err;
    }
  } catch (error: any) {
    console.error('[SEED] Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seedAirTickets();

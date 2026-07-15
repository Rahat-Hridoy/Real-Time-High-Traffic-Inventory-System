import sequelize from '../config/db';
import { Drop, Reservation, Purchase } from '../models';

async function seedSneakers() {
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

      console.log('[SEED] Seeding 6 sneaker drops...');
      const sneakers = [
        {
          name: 'Air Jordan 1 Retro High "Chicago"',
          price: 220.00,
          total_stock: 100,
          available_stock: 3,
        },
        {
          name: 'Yeezy Boost 350 V2 "Zebra"',
          price: 230.00,
          total_stock: 50,
          available_stock: 0,
        },
        {
          name: 'Nike Dunk Low "Panda"',
          price: 110.00,
          total_stock: 80,
          available_stock: 47,
        },
        {
          name: 'New Balance 550 White Grey',
          price: 130.00,
          total_stock: 60,
          available_stock: 22,
        },
        {
          name: 'Adidas Samba OG Core Black',
          price: 100.00,
          total_stock: 40,
          available_stock: 1,
        },
        {
          name: "Nike Air Force 1 '07 Triple White",
          price: 90.00,
          total_stock: 120,
          available_stock: 65,
        },
      ];

      for (const s of sneakers) {
        const created = await Drop.create(s, { transaction: tx });
        console.log(`[SEED] Created: ${created.name} (ID: ${created.id}, Stock: ${created.available_stock}/${created.total_stock})`);
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

seedSneakers();

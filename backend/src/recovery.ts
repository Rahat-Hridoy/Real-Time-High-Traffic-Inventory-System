import sequelize from '../config/db';
import { Reservation, Drop, User, Purchase } from '../models';
import { Op, Transaction } from 'sequelize';
import { broadcastStockUpdate, broadcastRestock } from './socket';

/**
 * Recovers stock from expired pending reservations.
 * Runs in a transaction with pessimistic locking.
 */
export async function recoverExpiredStock(): Promise<number[]> {
  const transaction = await sequelize.transaction();
  const txId = (transaction as any).id;
  
  try {
    // 1. Query all pending reservations where expires_at has passed, using LOCK.UPDATE
    const expiredReservations = await Reservation.findAll({
      where: {
        status: 'PENDING',
        expires_at: {
          [Op.lt]: new Date()
        }
      },
      lock: Transaction.LOCK.UPDATE,
      transaction
    });

    if (expiredReservations.length === 0) {
      // No expired reservations to recover
      await transaction.commit();
      return [];
    }

    console.log(`[RECOVERY][TX:${txId}] Found ${expiredReservations.length} expired reservations to reclaim.`);

    // 2. Aggregate count of recovered stock by drop_id
    const recoveryCounts: Record<number, number> = {};
    for (const res of expiredReservations) {
      recoveryCounts[res.drop_id] = (recoveryCounts[res.drop_id] || 0) + 1;
    }

    const affectedDrops: { dropId: number; availableStock: number; name: string }[] = [];

    // 3. For each drop, lock the Drop row, increment the available stock, and save
    for (const [dropIdStr, count] of Object.entries(recoveryCounts)) {
      const dropId = Number(dropIdStr);

      console.log(`[RECOVERY][TX:${txId}] Querying Drop ID ${dropId} with FOR UPDATE to restore ${count} items...`);
      const drop = await Drop.findByPk(dropId, {
        transaction,
        lock: Transaction.LOCK.UPDATE
      });

      if (!drop) {
        console.warn(`[RECOVERY][TX:${txId}] Drop ID ${dropId} not found while reclaiming stock. Skipping.`);
        continue;
      }

      const previousStock = drop.available_stock;
      drop.available_stock += count;
      await drop.save({ transaction });
      
      console.log(`[RECOVERY][TX:${txId}] Recovered stock for Drop ID ${dropId}. Previous: ${previousStock}, New: ${drop.available_stock}`);
      affectedDrops.push({ dropId, availableStock: drop.available_stock, name: drop.name });
    }

    // 4. Update status of the reservations to 'EXPIRED'
    const reservationIds = expiredReservations.map(r => r.id);
    await Reservation.update(
      { status: 'EXPIRED' },
      {
        where: { id: reservationIds },
        transaction
      }
    );
    console.log(`[RECOVERY][TX:${txId}] Marked reservations [${reservationIds.join(', ')}] as EXPIRED.`);

    // 5. Commit transaction
    await transaction.commit();
    console.log(`[RECOVERY][TX:${txId}] Stock recovery transaction committed successfully.`);

    // 6. Broadcast the new stock levels to socket clients after transaction commit
    for (const { dropId, availableStock, name } of affectedDrops) {
      const recentPurchases = await Purchase.findAll({
        where: { drop_id: dropId },
        order: [['created_at', 'DESC']],
        limit: 3,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['username']
          }
        ]
      });
      const recentBuyers = recentPurchases.map(p => ({
        username: (p as any).user?.username || 'Anonymous'
      }));

      broadcastStockUpdate(dropId, availableStock, 'default', recentBuyers);
      broadcastRestock(dropId, name);
    }

    return affectedDrops.map(d => d.dropId);

  } catch (error: any) {
    console.error(`[RECOVERY][TX:${txId}] Error during stock recovery:`, error.message);
    try {
      await transaction.rollback();
      console.log(`[RECOVERY][TX:${txId}] Transaction rolled back successfully.`);
    } catch (rollbackError: any) {
      console.error(`[RECOVERY][TX:${txId}] Rollback failed:`, rollbackError.message);
    }
    return [];
  }
}

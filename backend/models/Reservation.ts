import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import User from './User';
import Drop from './Drop';

export type ReservationStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

interface ReservationAttributes {
  id: number;
  user_id: number;
  drop_id: number;
  status: ReservationStatus;
  expires_at: Date;
  createdAt?: Date;
}

export interface ReservationCreationAttributes extends Optional<ReservationAttributes, 'id' | 'status'> {}

export class Reservation extends Model<ReservationAttributes, ReservationCreationAttributes> implements ReservationAttributes {
  declare id: number;
  declare user_id: number;
  declare drop_id: number;
  declare status: ReservationStatus;
  declare expires_at: Date;
  declare readonly createdAt: Date;
}

Reservation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id'
      }
    },
    drop_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Drop,
        key: 'id'
      }
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'PENDING',
      validate: {
        isIn: [['PENDING', 'COMPLETED', 'EXPIRED']]
      }
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'Reservation',
    tableName: 'Reservations'
  }
);

// Define associations
Reservation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Reservation.belongsTo(Drop, { foreignKey: 'drop_id', as: 'drop' });
User.hasMany(Reservation, { foreignKey: 'user_id', as: 'reservations' });
Drop.hasMany(Reservation, { foreignKey: 'drop_id', as: 'reservations' });

export default Reservation;

import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import User from './User';
import Drop from './Drop';

interface PurchaseAttributes {
  id: number;
  user_id: number;
  drop_id: number;
  createdAt?: Date;
}

export interface PurchaseCreationAttributes extends Optional<PurchaseAttributes, 'id'> {}

export class Purchase extends Model<PurchaseAttributes, PurchaseCreationAttributes> implements PurchaseAttributes {
  declare id: number;
  declare user_id: number;
  declare drop_id: number;
  declare readonly createdAt: Date;
}

Purchase.init(
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
    }
  },
  {
    sequelize,
    modelName: 'Purchase',
    tableName: 'Purchases'
  }
);

// Define associations
Purchase.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Purchase.belongsTo(Drop, { foreignKey: 'drop_id', as: 'drop' });
User.hasMany(Purchase, { foreignKey: 'user_id', as: 'purchases' });
Drop.hasMany(Purchase, { foreignKey: 'drop_id', as: 'purchases' });

export default Purchase;

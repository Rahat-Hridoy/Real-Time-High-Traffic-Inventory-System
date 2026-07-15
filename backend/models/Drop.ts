import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';

interface DropAttributes {
  id: number;
  name: string;
  price: number;
  total_stock: number;
  available_stock: number;
  createdAt?: Date;
}

export interface DropCreationAttributes extends Optional<DropAttributes, 'id'> {}

export class Drop extends Model<DropAttributes, DropCreationAttributes> implements DropAttributes {
  declare id: number;
  declare name: string;
  declare price: number;
  declare total_stock: number;
  declare available_stock: number;
  declare readonly createdAt: Date;
}

Drop.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('price');
        return rawValue ? parseFloat(rawValue as unknown as string) : 0;
      }
    },
    total_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    available_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    sequelize,
    modelName: 'Drop',
    tableName: 'Drops'
  }
);

export default Drop;

import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';

interface UserAttributes {
  id: number;
  username: string;
  createdAt?: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number;
  declare username: string;
  declare readonly createdAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'Users'
  }
);

export default User;

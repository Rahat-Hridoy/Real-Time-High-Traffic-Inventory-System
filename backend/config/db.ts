import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root relative to this file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL;
let sequelize: Sequelize;

if (databaseUrl) {
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Required for Neon and other self-signed/managed cloud databases
      }
    },
    logging: (msg) => console.log(`[SEQUELIZE] ${msg}`),
    pool: {
      max: 50,
      min: 10,
      idle: 10000,
      acquire: 30000
    },
    define: {
      timestamps: true,
      updatedAt: false, // We only have created_at in our schema
      underscored: true // maps camelCase to snake_case fields (e.g. createdAt -> created_at)
    }
  });
} else {
  const dbName = process.env.DB_NAME || 'techzu';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'postgres';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432', 10);

  sequelize = new Sequelize(dbName, dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: (msg) => console.log(`[SEQUELIZE] ${msg}`),
    pool: {
      max: 50,
      min: 10,
      idle: 10000,
      acquire: 30000
    },
    define: {
      timestamps: true,
      updatedAt: false, // We only have created_at in our schema
      underscored: true // maps camelCase to snake_case fields (e.g. createdAt -> created_at)
    }
  });
}

export default sequelize;

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool as PgPool } from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: Pool | PgPool;
let db: ReturnType<typeof drizzle> | ReturnType<typeof pgDrizzle>;

async function initializeDatabase() {
  try {
    // Try to get system config to check if external DB is enabled
    // We need a temporary connection to check this
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
    }

    // Create initial connection using environment DATABASE_URL
    const tempPool = new Pool({ connectionString: process.env.DATABASE_URL });
    const tempDb = drizzle({ client: tempPool, schema });
    
    // Check if system config exists and if external DB is enabled
    try {
      const [systemConfig] = await tempDb.select().from(schema.systemConfigs).limit(1);
      
      if (systemConfig?.useExternalDb && systemConfig.dbHost && systemConfig.dbUser) {
        // Use external database configuration
        const connectionString = `postgresql://${systemConfig.dbUser}:${systemConfig.dbPassword}@${systemConfig.dbHost}:${systemConfig.dbPort}/${systemConfig.dbName}`;
        
        console.log(`Connecting to external database: ${systemConfig.dbHost}:${systemConfig.dbPort}/${systemConfig.dbName}`);
        
        pool = new PgPool({ connectionString });
        db = pgDrizzle({ client: pool, schema });
        
        // Test the external connection
        await pool.query('SELECT 1');
        console.log('Successfully connected to external database');
        
        // Close temp connection
        await tempPool.end();
        return;
      }
    } catch (error) {
      console.log('No system config found or external DB not configured, using default connection');
    }
    
    // Use default Neon database
    pool = tempPool;
    db = tempDb;
    console.log('Using default database connection');
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Initialize database and export promise
const dbInitPromise = initializeDatabase();

export { pool, db, dbInitPromise };
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';

export interface DatabaseConfig {
  path: string;
  poolSize?: number;
  timeout?: number;
  verbose?: boolean;
}

@Injectable()
export class DatabasePoolService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabasePoolService.name);
  private pools: Map<string, Database[]> = new Map();
  private poolConfigs: Map<string, DatabaseConfig> = new Map();
  private poolStats: Map<
    string,
    { active: number; total: number; created: number; destroyed: number }
  > = new Map();

  constructor() {
    this.logger.log('Database Pool Service initialized');
  }

  /**
   * Create a connection pool for a specific database
   */
  createPool(poolName: string, config: DatabaseConfig): void {
    if (this.pools.has(poolName)) {
      this.logger.warn(`Pool ${poolName} already exists`);
      return;
    }

    const poolSize = config.poolSize || 5;
    const pool: Database[] = [];

    this.poolConfigs.set(poolName, config);

    // Initialize pool stats
    this.poolStats.set(poolName, {
      active: 0,
      total: 0,
      created: 0,
      destroyed: 0,
    });

    // Create initial connections
    for (let i = 0; i < poolSize; i++) {
      try {
        const db = new Database(config.path, {
          verbose: config.verbose
            ? this.logger.debug.bind(this.logger)
            : undefined,
          timeout: config.timeout || 5000,
          fileMustExist: false,
        });

        // Optimize SQLite for performance
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('cache_size = 10000');
        db.pragma('temp_store = MEMORY');
        db.pragma('mmap_size = 268435456'); // 256MB

        pool.push(db);

        const stats = this.poolStats.get(poolName)!;
        stats.created++;
        stats.total++;
      } catch (error) {
        this.logger.error(
          `Failed to create database connection ${i} for pool ${poolName}:`,
          error,
        );
      }
    }

    this.pools.set(poolName, pool);
    this.logger.log(
      `Created database pool '${poolName}' with ${pool.length} connections`,
    );
  }

  /**
   * Get a connection from the pool
   */
  async getConnection(poolName: string): Promise<Database | null> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      this.logger.error(`Pool ${poolName} does not exist`);
      return null;
    }

    const stats = this.poolStats.get(poolName)!;

    // Try to get an available connection
    if (pool.length > 0) {
      const connection = pool.pop()!;
      stats.active++;
      return connection;
    }

    // If no connections available, create a new one
    const config = this.poolConfigs.get(poolName)!;
    try {
      const db = new Database(config.path, {
        verbose: config.verbose
          ? this.logger.debug.bind(this.logger)
          : undefined,
        timeout: config.timeout || 5000,
        fileMustExist: false,
      });

      // Apply optimizations
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = 10000');
      db.pragma('temp_store = MEMORY');
      db.pragma('mmap_size = 268435456');

      stats.created++;
      stats.active++;
      stats.total++;

      this.logger.debug(`Created new connection for pool ${poolName}`);
      return db;
    } catch (error) {
      this.logger.error(
        `Failed to create new connection for pool ${poolName}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Return a connection to the pool
   */
  releaseConnection(poolName: string, connection: Database): void {
    const pool = this.pools.get(poolName);
    if (!pool) {
      this.logger.error(`Pool ${poolName} does not exist`);
      connection.close();
      return;
    }

    const stats = this.poolStats.get(poolName)!;
    const config = this.poolConfigs.get(poolName)!;
    const maxPoolSize = config.poolSize || 5;

    // If pool is not full, return connection to pool
    if (pool.length < maxPoolSize) {
      pool.push(connection);
      stats.active--;
    } else {
      // Pool is full, close the connection
      connection.close();
      stats.active--;
      stats.total--;
      stats.destroyed++;
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async executeQuery<T>(
    poolName: string,
    query: (db: Database) => T,
  ): Promise<T | null> {
    const connection = await this.getConnection(poolName);
    if (!connection) {
      return null;
    }

    try {
      const result = query(connection);
      return result;
    } catch (error) {
      this.logger.error(`Query execution failed for pool ${poolName}:`, error);
      throw error;
    } finally {
      this.releaseConnection(poolName, connection);
    }
  }

  /**
   * Execute a transaction with automatic connection management
   */
  async executeTransaction<T>(
    poolName: string,
    transaction: (db: Database) => T,
  ): Promise<T | null> {
    const connection = await this.getConnection(poolName);
    if (!connection) {
      return null;
    }

    const txn = connection.transaction(() => {
      return transaction(connection);
    });

    try {
      const result = txn();
      return result;
    } catch (error) {
      this.logger.error(`Transaction failed for pool ${poolName}:`, error);
      throw error;
    } finally {
      this.releaseConnection(poolName, connection);
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats(poolName?: string) {
    if (poolName) {
      const stats = this.poolStats.get(poolName);
      const pool = this.pools.get(poolName);
      return {
        poolName,
        ...stats,
        available: pool?.length || 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Return all pool stats
    const allStats: any = {};
    for (const [name, stats] of this.poolStats.entries()) {
      const pool = this.pools.get(name);
      allStats[name] = {
        ...stats,
        available: pool?.length || 0,
      };
    }

    return {
      pools: allStats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Health check for database pools
   */
  async healthCheck(): Promise<{ healthy: boolean; pools: any[] }> {
    const poolHealths: any[] = [];
    let overallHealthy = true;

    for (const [poolName, pool] of this.pools.entries()) {
      try {
        const connection = await this.getConnection(poolName);
        if (connection) {
          // Test the connection
          const result = connection.prepare('SELECT 1 as test').get();
          this.releaseConnection(poolName, connection);

          poolHealths.push({
            name: poolName,
            healthy: result && (result as any).test === 1,
            available: pool.length,
            stats: this.poolStats.get(poolName),
          });
        } else {
          poolHealths.push({
            name: poolName,
            healthy: false,
            available: pool.length,
            error: 'Could not get connection',
          });
          overallHealthy = false;
        }
      } catch (error) {
        poolHealths.push({
          name: poolName,
          healthy: false,
          available: pool.length,
          error: error instanceof Error ? error.message : String(error),
        });
        overallHealthy = false;
      }
    }

    return {
      healthy: overallHealthy,
      pools: poolHealths,
    };
  }

  /**
   * Close all connections in a pool
   */
  closePool(poolName: string): void {
    const pool = this.pools.get(poolName);
    if (!pool) {
      this.logger.warn(`Pool ${poolName} does not exist`);
      return;
    }

    // Close all connections
    for (const connection of pool) {
      connection.close();
    }

    // Clean up
    this.pools.delete(poolName);
    this.poolConfigs.delete(poolName);
    this.poolStats.delete(poolName);

    this.logger.log(`Closed database pool '${poolName}'`);
  }

  /**
   * Close all pools and connections
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing all database pools...');

    for (const poolName of this.pools.keys()) {
      this.closePool(poolName);
    }

    this.logger.log('All database pools closed');
  }
}

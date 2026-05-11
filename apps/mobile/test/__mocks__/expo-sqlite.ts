/**
 * Manual mock for expo-sqlite (Approach A: delegate to better-sqlite3).
 *
 * Exposes an `openDatabaseAsync(name)` function that returns a fake SQLiteDatabase
 * whose async methods delegate to a real better-sqlite3 in-memory instance.
 * This validates all SQL strings end-to-end without requiring native iOS SQLite.
 */
import Database from "better-sqlite3";

export interface SQLiteDatabase {
  runAsync(sql: string, ...args: unknown[]): Promise<void>;
  getAllAsync<T = unknown>(sql: string, ...args: unknown[]): Promise<T[]>;
  getFirstAsync<T = unknown>(sql: string, ...args: unknown[]): Promise<T | null>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync<R>(fn: () => Promise<R>): Promise<R>;
}

function makeFakeDb(bsdb: Database.Database): SQLiteDatabase {
  return {
    async runAsync(sql: string, ...args: unknown[]): Promise<void> {
      bsdb.prepare(sql).run(...(args as Database.BindingDictionary[]));
    },

    async getAllAsync<T = unknown>(sql: string, ...args: unknown[]): Promise<T[]> {
      return bsdb.prepare(sql).all(...(args as Database.BindingDictionary[])) as T[];
    },

    async getFirstAsync<T = unknown>(sql: string, ...args: unknown[]): Promise<T | null> {
      const row = bsdb.prepare(sql).get(...(args as Database.BindingDictionary[]));
      return (row ?? null) as T | null;
    },

    async execAsync(sql: string): Promise<void> {
      bsdb.exec(sql);
    },

    async withTransactionAsync<R>(fn: () => Promise<R>): Promise<R> {
      // Mirror expo-sqlite contract: rolls back on throw.
      const sp = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      bsdb.prepare(`SAVEPOINT ${sp}`).run();
      try {
        const result = await fn();
        bsdb.prepare(`RELEASE SAVEPOINT ${sp}`).run();
        return result;
      } catch (e) {
        bsdb.prepare(`ROLLBACK TO SAVEPOINT ${sp}`).run();
        bsdb.prepare(`RELEASE SAVEPOINT ${sp}`).run();
        throw e;
      }
    },
  };
}

export async function openDatabaseAsync(name: string): Promise<SQLiteDatabase> {
  const bsdb = new Database(":memory:");
  return makeFakeDb(bsdb);
}

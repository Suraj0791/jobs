// ============================================================
// DuckDB Wrapper — query parquet files with SQL
// ============================================================

import { DuckDBInstance } from '@duckdb/node-api';

let instance: DuckDBInstance | null = null;

/**
 * Get or create the shared DuckDB instance.
 * Uses in-memory database — no persistent state needed.
 */
async function getInstance(): Promise<DuckDBInstance> {
  if (!instance) {
    instance = await DuckDBInstance.create(':memory:');
  }
  return instance;
}

/**
 * Run a SQL query against parquet files and return typed results.
 * 
 * Usage:
 * ```ts
 * const jobs = await queryParquet<JobRow>(
 *   "SELECT * FROM read_parquet('path/to/file.parquet') WHERE country = 'India'"
 * );
 * ```
 */
export async function queryParquet<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const db = await getInstance();
  const connection = await db.connect();

  try {
    const result = await connection.run(sql);
    const rows: T[] = [];
    
    // Read all result rows
    const chunks = await result.fetchAllChunks();
    
    for (const chunk of chunks) {
      const columnCount = chunk.columnCount;
      const rowCount = chunk.rowCount;
      
      // Get column names from the result
      const columnNames: string[] = [];
      for (let col = 0; col < columnCount; col++) {
        columnNames.push(result.columnName(col));
      }
      
      // Build row objects
      for (let row = 0; row < rowCount; row++) {
        const obj: Record<string, unknown> = {};
        for (let col = 0; col < columnCount; col++) {
          const column = chunk.getColumn(col);
          obj[columnNames[col]] = column.getItem(row);
        }
        rows.push(obj as T);
      }
    }

    return rows;
  } finally {
    await connection.close();
  }
}

/**
 * Close the DuckDB instance. Call this during cleanup.
 */
export async function closeDuckDB(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

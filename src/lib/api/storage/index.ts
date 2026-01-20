/**
 * Storage 模块 - SQLite 数据库操作 API
 *
 * 提供与 SQLite 数据库交互的方法，包括表管理、行操作和 SQL 执行。
 */
import { logger } from '@/lib/logger';
import { invoke } from "@tauri-apps/api/core";

/**
 * Lists all tables in the SQLite database
 * @returns Promise resolving to an array of table information
 */
export async function storageListTables(): Promise<any[]> {
  try {
    return await invoke<any[]>("storage_list_tables");
  } catch (error) {
    logger.error('index', "Failed to list tables:", error);
    throw error;
  }
}

/**
 * Reads table data with pagination
 * @param tableName - Name of the table to read
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of rows per page
 * @param searchQuery - Optional search query
 * @returns Promise resolving to table data with pagination info
 */
export async function storageReadTable(
  tableName: string,
  page: number,
  pageSize: number,
  searchQuery?: string,
): Promise<any> {
  try {
    return await invoke<any>("storage_read_table", {
      tableName,
      page,
      pageSize,
      searchQuery,
    });
  } catch (error) {
    logger.error('index', "Failed to read table:", error);
    throw error;
  }
}

/**
 * Updates a row in a table
 * @param tableName - Name of the table
 * @param primaryKeyValues - Map of primary key column names to values
 * @param updates - Map of column names to new values
 * @returns Promise resolving when the row is updated
 */
export async function storageUpdateRow(
  tableName: string,
  primaryKeyValues: Record<string, any>,
  updates: Record<string, any>,
): Promise<void> {
  try {
    return await invoke<void>("storage_update_row", {
      tableName,
      primaryKeyValues,
      updates,
    });
  } catch (error) {
    logger.error('index', "Failed to update row:", error);
    throw error;
  }
}

/**
 * Deletes a row from a table
 * @param tableName - Name of the table
 * @param primaryKeyValues - Map of primary key column names to values
 * @returns Promise resolving when the row is deleted
 */
export async function storageDeleteRow(
  tableName: string,
  primaryKeyValues: Record<string, any>,
): Promise<void> {
  try {
    return await invoke<void>("storage_delete_row", {
      tableName,
      primaryKeyValues,
    });
  } catch (error) {
    logger.error('index', "Failed to delete row:", error);
    throw error;
  }
}

/**
 * Inserts a new row into a table
 * @param tableName - Name of the table
 * @param values - Map of column names to values
 * @returns Promise resolving to the last insert row ID
 */
export async function storageInsertRow(
  tableName: string,
  values: Record<string, any>,
): Promise<number> {
  try {
    return await invoke<number>("storage_insert_row", {
      tableName,
      values,
    });
  } catch (error) {
    logger.error('index', "Failed to insert row:", error);
    throw error;
  }
}

/**
 * Executes a raw SQL query
 * @param query - SQL query string
 * @returns Promise resolving to query result
 */
export async function storageExecuteSql(query: string): Promise<any> {
  try {
    return await invoke<any>("storage_execute_sql", { query });
  } catch (error) {
    logger.error('index', "Failed to execute SQL:", error);
    throw error;
  }
}

/**
 * Resets the entire database
 * @returns Promise resolving when the database is reset
 */
export async function storageResetDatabase(): Promise<void> {
  try {
    return await invoke<void>("storage_reset_database");
  } catch (error) {
    logger.error('index', "Failed to reset database:", error);
    throw error;
  }
}

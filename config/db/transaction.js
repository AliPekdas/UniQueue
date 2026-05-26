const { sql, getPool } = require('./pool');

/**
 * Runs fn inside a SQL Server transaction with automatic commit/rollback.
 * @param {function(import('mssql').Transaction): Promise<*>} fn
 */
async function withTransaction(fn) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    if (transaction._aborted !== true) {
      try {
        await transaction.rollback();
      } catch {
        /* already rolled back */
      }
    }
    throw err;
  }
}

module.exports = { withTransaction };

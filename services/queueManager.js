const { sql, getPool } = require('../config/db/pool');
const { withTransaction } = require('../config/db/transaction');
const resourceService = require('./resourceService');
const { notificationService } = require('./notificationService');

class QueueManager {
  /**
   * Adds user to waitlist when resource is full.
   */
  async enqueueUser(userId, resourceId) {
    const pool = await getPool();

    const dup = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('resourceId', sql.Int, resourceId)
      .query(`
        SELECT TOP 1 reservationID FROM Reservations
        WHERE userID = @userId AND resourceID = @resourceId
          AND status IN ('Booked', 'Waitlisted')
      `);

    if (dup.recordset.length) {
      const err = new Error('Already booked or waitlisted');
      err.code = 'DUPLICATE';
      throw err;
    }

    const availability = await resourceService.checkAvailability(resourceId);
    if (!availability.resource) {
      const err = new Error('Resource not found');
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (availability.reason === 'NOT_BOOKABLE') {
      const err = new Error('This resource cannot be waitlisted');
      err.code = 'NOT_BOOKABLE';
      throw err;
    }

    if (availability.available) {
      const err = new Error('Capacity available — book directly');
      err.code = 'CAPACITY_AVAILABLE';
      throw err;
    }

    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('resourceId', sql.Int, resourceId)
      .query(`
        INSERT INTO Reservations (userID, resourceID, status)
        OUTPUT INSERTED.*
        VALUES (@userId, @resourceId, 'Waitlisted')
      `);

    return result.recordset[0];
  }

  /**
   * Promotes the oldest waitlisted user using UPDLOCK/ROWLOCK (SQL Server FOR UPDATE equivalent).
   */
  async promoteNextUser(resourceId) {
    return withTransaction(async (transaction) => {
      const lockRequest = new sql.Request(transaction);
      lockRequest.input('resourceId', sql.Int, resourceId);

      const next = await lockRequest.query(`
        SELECT TOP 1 reservationID, userID, resourceID, timestamp, status
        FROM Reservations WITH (UPDLOCK, ROWLOCK)
        WHERE resourceID = @resourceId AND status = 'Waitlisted'
        ORDER BY timestamp ASC
      `);

      const candidate = next.recordset[0];
      if (!candidate) return null;

      const avail = await resourceService.checkAvailability(resourceId, transaction);
      if (!avail.available) return null;

      await resourceService.updateCapacity(resourceId, 1, transaction);

      const promoteRequest = new sql.Request(transaction);
      promoteRequest.input('reservationId', sql.Int, candidate.reservationID);

      const promoted = await promoteRequest.query(`
        UPDATE Reservations
        SET status = 'Booked'
        OUTPUT INSERTED.reservationID, INSERTED.userID, INSERTED.resourceID,
               INSERTED.timestamp, INSERTED.status
        WHERE reservationID = @reservationId AND status = 'Waitlisted'
      `);

      const row = promoted.recordset[0];
      if (row) {
        const resource = await resourceService.getById(row.resourceID, transaction);
        await notificationService.notifyQueuePromotion(
          row.userID,
          resource?.resourceName || 'resource',
          row.reservationID
        );
      }
      return row || null;
    });
  }
}

module.exports = new QueueManager();

const { sql, getPool } = require('../config/db/pool');
const { RESOURCE_TYPES } = require('../constants/resourceTypes');
const resourceService = require('./resourceService');
const queueManager = require('./queueManager');
const { notificationService } = require('./notificationService');

const STATUS = Object.freeze({
  BOOKED: 'Booked',
  WAITLISTED: 'Waitlisted',
  CANCELED: 'Canceled',
});

class ReservationService {
  async getById(reservationId, transaction = null) {
    const request = transaction
      ? new sql.Request(transaction)
      : (await getPool()).request();
    request.input('reservationId', sql.Int, reservationId);

    const result = await request.query(`
      SELECT reservationID, userID, resourceID, timestamp, status
      FROM Reservations
      WHERE reservationID = @reservationId
    `);
    return result.recordset[0] || null;
  }

  async getActiveByUserAndResource(userId, resourceId) {
    const pool = await getPool();
    const resource = await resourceService.getById(resourceId);

    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('resourceId', sql.Int, resourceId)
      .query(`
        SELECT TOP 1 reservationID, userID, resourceID, timestamp, status
        FROM Reservations
        WHERE userID = @userId AND resourceID = @resourceId
          AND status IN ('Booked', 'Waitlisted')
        ORDER BY timestamp DESC
      `);
    return result.recordset[0] || null;
  }

  async listByUser(userId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT r.reservationID, r.userID, r.resourceID, r.timestamp, r.status,
               res.resourceName, res.resourceType
        FROM Reservations r
        JOIN Resources res ON res.resourceID = r.resourceID
        WHERE r.userID = @userId AND r.status IN ('Booked', 'Waitlisted')
        ORDER BY r.timestamp DESC
      `);
    return result.recordset;
  }

  async createBooking(userId, resourceId, { slotStart, durationMinutes } = {}) {
    const resource = await resourceService.getById(resourceId);
    if (!resource) {
      const err = new Error('Resource not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    const existing = await this.getActiveByUserAndResource(userId, resourceId);
    if (existing) {
      const err = new Error('Active reservation already exists');
      err.code = 'DUPLICATE';
      throw err;
    }

    const availability = await resourceService.checkAvailability(resourceId);
    if (!availability.available) {
      if (availability.reason === 'NOT_BOOKABLE') {
        const err = new Error('This resource cannot be booked');
        err.code = 'NOT_BOOKABLE';
        throw err;
      }
      const err = new Error('Resource at capacity');
      err.code = 'CONFLICT';
      throw err;
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await resourceService.updateCapacity(resourceId, 1, transaction);

      const insert = await new sql.Request(transaction)
        .input('userId', sql.Int, userId)
        .input('resourceId', sql.Int, resourceId)
        .input('status', sql.NVarChar(20), STATUS.BOOKED)
        .query(`
          INSERT INTO Reservations (userID, resourceID, status)
          OUTPUT INSERTED.*
          VALUES (@userId, @resourceId, @status)
        `);

      await transaction.commit();
      return { reservation: insert.recordset[0], waitlisted: false };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async joinWaitlist(userId, resourceId) {
    const resource = await resourceService.getById(resourceId);
    return queueManager.enqueueUser(userId, resourceId);
  }

  async cancel(reservationId, requestingUserId, isAdmin) {
    const reservation = await this.getById(reservationId);
    if (!reservation) {
      const err = new Error('Reservation not found');
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!isAdmin && reservation.userID !== requestingUserId) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (reservation.status === STATUS.CANCELED) {
      return { reservation, promoted: null };
    }

    const wasBooked = reservation.status === STATUS.BOOKED;
    const resource = await resourceService.getById(reservation.resourceID);
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction)
        .input('reservationId', sql.Int, reservationId)
        .input('status', sql.NVarChar(20), STATUS.CANCELED)
        .query(`
          UPDATE Reservations SET status = @status WHERE reservationID = @reservationId
        `);

      if (wasBooked && (resource?.resourceType === RESOURCE_TYPES.STUDY_ROOM || resource?.resourceType === RESOURCE_TYPES.OFFICE_HOURS)) {
        await resourceService.updateCapacity(reservation.resourceID, -1, transaction);
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    const ownerId = reservation.userID;
    if (resource && (wasBooked || reservation.status === STATUS.WAITLISTED)) {
      await notificationService.notifyBookingCanceled(
        ownerId,
        resource.resourceName,
        resource.resourceType
      );
    }

    let promoted = null;
    if (wasBooked && (resource?.resourceType === RESOURCE_TYPES.STUDY_ROOM || resource?.resourceType === RESOURCE_TYPES.OFFICE_HOURS)) {
      promoted = await queueManager.promoteNextUser(reservation.resourceID);
    }

    return {
      reservation: { ...reservation, status: STATUS.CANCELED },
      promoted,
      resource,
    };
  }
}

const reservationService = new ReservationService();
reservationService.STATUS = STATUS;
module.exports = reservationService;

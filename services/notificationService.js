const { sql, getPool } = require('../config/db/pool');
const { RESOURCE_TYPES } = require('../constants/resourceTypes');
const { broker } = require('./notificationBroker');

const NOTIFICATION_TYPES = Object.freeze({
  QUEUE_PROMOTED: 'queue_promoted',
  RESERVATION_CANCELED: 'reservation_canceled',
  RESOURCE_UPDATED: 'resource_updated',
  RESOURCE_REMOVED: 'resource_removed',
  TRANSIT_LINE_REMOVED: 'transit_line_removed',
});

class NotificationService {
  async create(userId, type, message) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('type', sql.NVarChar(40), type)
      .input('message', sql.NVarChar(500), message)
      .query(`
        INSERT INTO Notifications (userID, type, message)
        OUTPUT INSERTED.notificationID, INSERTED.userID, INSERTED.type,
               INSERTED.message, INSERTED.isRead, INSERTED.createdAt
        VALUES (@userId, @type, @message)
      `);
    return result.recordset[0];
  }

  async listForUser(userId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT TOP 50 notificationID, userID, type, message, isRead, createdAt
        FROM Notifications
        WHERE userID = @userId
        ORDER BY createdAt DESC
      `);
    return result.recordset;
  }

  async notifyUser(userId, type, message) {
    const row = await this.create(userId, type, message);
    broker.dispatch({ type, userId, message, notificationId: row.notificationID });
    return row;
  }

  async notifyAllStudents(type, message) {
    const pool = await getPool();
    const students = await pool.request().query(`
      SELECT userID FROM Users WHERE role = 'Student'
    `);
    for (const s of students.recordset) {
      await this.notifyUser(s.userID, type, message);
    }
  }

  async getAffectedStudentIds(resourceId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('resourceId', sql.Int, resourceId)
      .query(`
        SELECT DISTINCT userID FROM Reservations
        WHERE resourceID = @resourceId AND status IN ('Booked', 'Waitlisted')
      `);
    return result.recordset.map((r) => r.userID);
  }

  async notifyAffectedStudents(resourceId, type, message) {
    const userIds = await this.getAffectedStudentIds(resourceId);
    for (const userId of userIds) {
      await this.notifyUser(userId, type, message);
    }
  }

  async notifyQueuePromotion(userId, resourceName, reservationId) {
    return this.notifyUser(
      userId,
      NOTIFICATION_TYPES.QUEUE_PROMOTED,
      `You were promoted from the waitlist for "${resourceName}" (reservation #${reservationId}).`
    );
  }

  async notifyBookingCanceled(userId, resourceName, resourceType) {
    const label =
      resourceType === RESOURCE_TYPES.OFFICE_HOURS ? 'office hours' : 'study room';
    return this.notifyUser(
      userId,
      NOTIFICATION_TYPES.RESERVATION_CANCELED,
      `Your ${label} booking for "${resourceName}" was canceled.`
    );
  }

  async notifyResourceUpdated(resource) {
    const message = `"${resource.resourceName}" was updated. Please review your booking.`;
    await this.notifyAffectedStudents(
      resource.resourceID,
      NOTIFICATION_TYPES.RESOURCE_UPDATED,
      message
    );
  }

  async notifyResourceRemoved(resource) {
    if (resource.resourceType === RESOURCE_TYPES.TRANSIT_LINE) {
      await this.notifyAllStudents(
        NOTIFICATION_TYPES.TRANSIT_LINE_REMOVED,
        `Transit line "${resource.resourceName}" has been removed.`
      );
      return;
    }
    const message = `"${resource.resourceName}" was removed and your booking was canceled.`;
    await this.notifyAffectedStudents(
      resource.resourceID,
      NOTIFICATION_TYPES.RESOURCE_REMOVED,
      message
    );
  }
}

module.exports = {
  notificationService: new NotificationService(),
  NOTIFICATION_TYPES,
};

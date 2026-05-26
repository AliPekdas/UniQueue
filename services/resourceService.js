const { sql, getPool } = require('../config/db/pool');
const { RESOURCE_TYPES, isBookable } = require('../constants/resourceTypes');
const { notificationService } = require('./notificationService');

const RESOURCE_COLUMNS = `
  resourceID, resourceName, resourceType, scheduleInfo,
  maxCapacity, currentCapacity, status, ownerUserID
`;

class ResourceService {
  async getById(resourceId, transaction = null) {
    const request = transaction
      ? new sql.Request(transaction)
      : (await getPool()).request();
    request.input('resourceId', sql.Int, resourceId);

    const result = await request.query(`
      SELECT ${RESOURCE_COLUMNS} FROM Resources WHERE resourceID = @resourceId
    `);
    return result.recordset[0] || null;
  }

  async listAll({ type, bookableOnly, ownerUserId } = {}) {
    const pool = await getPool();
    const request = pool.request();
    let where = 'WHERE 1=1';

    if (type) {
      request.input('type', sql.NVarChar(20), type);
      where += ' AND resourceType = @type';
    }
    if (bookableOnly) {
      where += ` AND resourceType IN ('StudyRoom', 'OfficeHours')`;
    }
    if (ownerUserId != null) {
      request.input('ownerUserId', sql.Int, ownerUserId);
      where += ' AND ownerUserID = @ownerUserId';
    }

    const result = await request.query(`
      SELECT ${RESOURCE_COLUMNS}
      FROM Resources ${where}
      ORDER BY resourceType, resourceName
    `);
    return result.recordset;
  }

  async checkAvailability(resourceId, transaction = null) {
    const resource = await this.getById(resourceId, transaction);
    if (!resource) return { available: false, reason: 'NOT_FOUND' };
    if (!isBookable(resource.resourceType)) {
      return { available: false, reason: 'NOT_BOOKABLE', resource };
    }
    if (resource.status === 'OutOfService') {
      return { available: false, reason: 'OUT_OF_SERVICE', resource };
    }



    const hasCapacity = resource.currentCapacity < resource.maxCapacity;
    return {
      available: hasCapacity,
      reason: hasCapacity ? 'OK' : 'FULL',
      resource,
    };
  }

  async updateCapacity(resourceId, delta, transaction = null) {
    const resource = await this.getById(resourceId, transaction);


    const request = transaction
      ? new sql.Request(transaction)
      : (await getPool()).request();
    request.input('resourceId', sql.Int, resourceId);
    request.input('delta', sql.Int, delta);

    const result = await request.query(`
      UPDATE Resources
      SET currentCapacity = currentCapacity + @delta,
          status = CASE
            WHEN currentCapacity + @delta >= maxCapacity THEN 'Full'
            WHEN status = 'OutOfService' THEN 'OutOfService'
            ELSE 'Available'
          END
      OUTPUT INSERTED.resourceID, INSERTED.resourceName, INSERTED.resourceType,
             INSERTED.scheduleInfo, INSERTED.maxCapacity, INSERTED.currentCapacity,
             INSERTED.status, INSERTED.ownerUserID
      WHERE resourceID = @resourceId
        AND resourceType IN ('StudyRoom', 'OfficeHours')
        AND currentCapacity + @delta >= 0
        AND currentCapacity + @delta <= maxCapacity
    `);

    if (!result.recordset[0]) {
      throw new Error('Capacity update rejected');
    }
    return result.recordset[0];
  }

  async create({
    resourceName,
    maxCapacity,
    resourceType,
    scheduleInfo,
    ownerUserId,
  }) {
    const pool = await getPool();
    const isTransit = resourceType === RESOURCE_TYPES.TRANSIT_LINE;

    const result = await pool
      .request()
      .input('resourceName', sql.NVarChar(100), resourceName)
      .input('maxCapacity', sql.Int, isTransit ? 0 : maxCapacity || 1)
      .input('resourceType', sql.NVarChar(20), resourceType)
      .input('scheduleInfo', sql.NVarChar(500), scheduleInfo || null)
      .input('ownerUserId', sql.Int, ownerUserId)
      .query(`
        INSERT INTO Resources (
          resourceName, maxCapacity, currentCapacity, status, resourceType,
          scheduleInfo, ownerUserID
        )
        OUTPUT INSERTED.resourceID, INSERTED.resourceName, INSERTED.resourceType,
               INSERTED.scheduleInfo, INSERTED.maxCapacity, INSERTED.currentCapacity,
               INSERTED.status, INSERTED.ownerUserID
        VALUES (
          @resourceName, @maxCapacity, 0, 'Available', @resourceType,
          @scheduleInfo, @ownerUserId
        )
      `);
    return result.recordset[0];
  }

  async update(resourceId, fields) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('resourceId', sql.Int, resourceId)
      .input('resourceName', sql.NVarChar(100), fields.resourceName ?? null)
      .input('maxCapacity', sql.Int, fields.maxCapacity ?? null)
      .input('status', sql.NVarChar(20), fields.status ?? null)
      .query(`
        UPDATE Resources
        SET resourceName = COALESCE(@resourceName, resourceName),
            maxCapacity = COALESCE(@maxCapacity, maxCapacity),
            status = COALESCE(@status, status)
        OUTPUT INSERTED.resourceID, INSERTED.resourceName, INSERTED.resourceType,
               INSERTED.scheduleInfo, INSERTED.maxCapacity, INSERTED.currentCapacity,
               INSERTED.status, INSERTED.ownerUserID
        WHERE resourceID = @resourceId
      `);
    const updated = result.recordset[0] || null;
    if (updated) {
      await notificationService.notifyResourceUpdated(updated);
    }
    return updated;
  }

  async remove(resourceId) {
    const resource = await this.getById(resourceId);
    if (!resource) return null;

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await notificationService.notifyResourceRemoved(resource);

      await new sql.Request(transaction)
        .input('resourceId', sql.Int, resourceId)
        .query('DELETE FROM Reservations WHERE resourceID = @resourceId');

      await new sql.Request(transaction)
        .input('resourceId', sql.Int, resourceId)
        .query('DELETE FROM Resources WHERE resourceID = @resourceId');

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    return resource;
  }
}

module.exports = new ResourceService();

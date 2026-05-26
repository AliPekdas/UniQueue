const reservationService = require('../services/reservationService');
const { canAccessReservation, ROLES } = require('../middleware/auth');

async function createReservation(req, res) {
  const resourceId = parseInt(req.body.resourceId, 10);
  const forceWaitlist = req.body.waitlist === true;
  const { slotStart, durationMinutes } = req.body;

  if (Number.isNaN(resourceId)) {
    return res.status(400).json({ error: 'resourceId is required' });
  }

  try {
    if (forceWaitlist) {
      const waitlisted = await reservationService.joinWaitlist(
        req.user.userId,
        resourceId
      );
      return res.status(201).json({
        message: 'Added to waitlist',
        reservation: waitlisted,
        waitlisted: true,
      });
    }

    const result = await reservationService.createBooking(req.user.userId, resourceId, {
      slotStart,
      durationMinutes: durationMinutes != null ? parseInt(durationMinutes, 10) : null,
    });
    return res.status(201).json({
      message: 'Booking confirmed',
      reservation: result.reservation,
      waitlisted: false,
    });
  } catch (err) {
    if (err.code === 'CONFLICT') {
      return res.status(409).json({
        error: 'Resource is full',
        message: 'Join the waitlist to be notified when a slot opens',
        canWaitlist: true,
      });
    }
    if (err.code === 'NOT_BOOKABLE') {
      return res.status(403).json({ error: err.message });
    }
    if (err.code === 'DUPLICATE') {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    if (
      err.code === 'SLOT_REQUIRED' ||
      err.code === 'SLOT_CONFLICT' ||
      err.code === 'INVALID_DURATION' ||
      err.code === 'OUTSIDE_WINDOW' ||
      err.code === 'INVALID_WINDOW'
    ) {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === 'NOT_WAITLIST') {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Booking failed' });
  }
}

async function listMyReservations(req, res) {
  try {
    const list = await reservationService.listByUser(req.user.userId);
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list reservations' });
  }
}

async function cancelReservation(req, res) {
  const reservationId = parseInt(req.params.id, 10);
  if (Number.isNaN(reservationId)) {
    return res.status(400).json({ error: 'Invalid reservation id' });
  }

  try {
    const existing = await reservationService.getById(reservationId);
    if (!existing) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (!canAccessReservation(req, existing)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await reservationService.cancel(
      reservationId,
      req.user.userId,
      req.user.role === ROLES.ADMIN
    );

    res.json({
      message: 'Reservation canceled',
      reservation: result.reservation,
      promoted: result.promoted,
    });
  } catch (err) {
    if (err.code === 'FORBIDDEN') {
      return res.status(403).json({ error: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Cancellation failed' });
  }
}

module.exports = { createReservation, listMyReservations, cancelReservation };

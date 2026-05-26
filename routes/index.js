const express = require('express');
const { authenticate, requireRoles, ROLES } = require('../middleware/auth');
const { login } = require('../controllers/authController');
const {
  listResources,
  createResource,
  updateResource,
  deleteResource,
} = require('../controllers/resourceController');
const {
  createReservation,
  listMyReservations,
  cancelReservation,
} = require('../controllers/reservationController');
const { listNotifications } = require('../controllers/notificationController');

const router = express.Router();

router.post('/api/auth/login', login);

router.get('/api/resources', authenticate, listResources);
router.post(
  '/api/resources',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.LECTURER, ROLES.BUS_DRIVER),
  createResource
);
router.put(
  '/api/resources/:id',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.LECTURER),
  updateResource
);
router.delete(
  '/api/resources/:id',
  authenticate,
  requireRoles(ROLES.ADMIN, ROLES.LECTURER, ROLES.BUS_DRIVER),
  deleteResource
);

router.get('/api/reservations', authenticate, requireRoles(ROLES.STUDENT), listMyReservations);
router.post(
  '/api/reservations',
  authenticate,
  requireRoles(ROLES.STUDENT),
  createReservation
);
router.delete(
  '/api/reservations/:id',
  authenticate,
  requireRoles(ROLES.STUDENT),
  cancelReservation
);

router.get(
  '/api/notifications',
  authenticate,
  requireRoles(ROLES.STUDENT),
  listNotifications
);

module.exports = router;

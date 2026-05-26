const jwt = require('jsonwebtoken');

const ROLES = Object.freeze({
  STUDENT: 'Student',
  LECTURER: 'Lecturer',
  BUS_DRIVER: 'BusDriver',
  ADMIN: 'Admin',
});

const ROLE_HIERARCHY = {
  [ROLES.STUDENT]: 1,
  [ROLES.BUS_DRIVER]: 2,
  [ROLES.LECTURER]: 3,
  [ROLES.ADMIN]: 4,
};

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * IDOR guard: ensures the authenticated user may act on targetUserId.
 * Admins may access any user; others only their own record.
 */
function assertOwnerOrAdmin(req, targetUserId) {
  const uid = parseInt(targetUserId, 10);
  if (Number.isNaN(uid)) return false;
  if (req.user.role === ROLES.ADMIN) return true;
  return req.user.userId === uid;
}

/**
 * IDOR guard for reservations: user must own reservation unless Admin.
 */
function canAccessReservation(req, reservation) {
  if (!reservation) return false;
  if (req.user.role === ROLES.ADMIN) return true;
  return req.user.userId === reservation.userID;
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  authenticate,
  requireRoles,
  assertOwnerOrAdmin,
  canAccessReservation,
};

const { ROLES } = require('./auth');
const { RESOURCE_TYPES } = require('../constants/resourceTypes');

function allowedTypesForRole(role) {
  if (role === ROLES.ADMIN) {
    return [
      RESOURCE_TYPES.STUDY_ROOM,
      RESOURCE_TYPES.OFFICE_HOURS,
      RESOURCE_TYPES.TRANSIT_LINE,
    ];
  }
  if (role === ROLES.LECTURER) return [RESOURCE_TYPES.OFFICE_HOURS];
  if (role === ROLES.BUS_DRIVER) return [RESOURCE_TYPES.TRANSIT_LINE];
  return [];
}

function resolveCreateType(role, requestedType) {
  const allowed = allowedTypesForRole(role);
  if (!allowed.length) return null;
  if (role === ROLES.ADMIN) return requestedType || RESOURCE_TYPES.STUDY_ROOM;
  return allowed[0];
}

/** Admin: all resources. Lecturer/driver: only resources they own. */
function canManageResource(user, resource) {
  if (!resource) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.LECTURER) {
    return (
      resource.resourceType === RESOURCE_TYPES.OFFICE_HOURS &&
      resource.ownerUserID === user.userId
    );
  }
  if (user.role === ROLES.BUS_DRIVER) {
    return (
      resource.resourceType === RESOURCE_TYPES.TRANSIT_LINE &&
      resource.ownerUserID === user.userId
    );
  }
  return false;
}

/** Transit lines cannot be updated by anyone (add/remove only). */
function canUpdateResource(user, resource) {
  if (!resource || resource.resourceType === RESOURCE_TYPES.TRANSIT_LINE) {
    return false;
  }
  return canManageResource(user, resource);
}

module.exports = {
  allowedTypesForRole,
  resolveCreateType,
  canManageResource,
  canUpdateResource,
};

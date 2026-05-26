const resourceService = require('../services/resourceService');
const { ROLES } = require('../middleware/auth');
const { RESOURCE_TYPES } = require('../constants/resourceTypes');
const {
  canManageResource,
  canUpdateResource,
  resolveCreateType,
} = require('../middleware/resourcePolicy');

function listOptionsForUser(user) {
  if (user.role === ROLES.LECTURER) {
    return { type: RESOURCE_TYPES.OFFICE_HOURS, ownerUserId: user.userId };
  }
  if (user.role === ROLES.BUS_DRIVER) {
    return { type: RESOURCE_TYPES.TRANSIT_LINE, ownerUserId: user.userId };
  }
  return {};
}

async function listResources(req, res) {
  try {
    const resources = await resourceService.listAll(listOptionsForUser(req.user));
    res.json(resources);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list resources' });
  }
}



async function createResource(req, res) {
  const {
    resourceName,
    maxCapacity,
    resourceType,
    scheduleInfo,
  } = req.body;
  const type = resolveCreateType(req.user.role, resourceType);

  if (!type) {
    return res.status(403).json({ error: 'Your role cannot create resources' });
  }
  if (!resourceName) {
    return res.status(400).json({ error: 'resourceName is required' });
  }
  if (type === RESOURCE_TYPES.TRANSIT_LINE && !scheduleInfo) {
    return res.status(400).json({ error: 'scheduleInfo is required for transit lines' });
  }
  if (type !== RESOURCE_TYPES.TRANSIT_LINE && !maxCapacity) {
    return res.status(400).json({ error: 'maxCapacity is required' });
  }

  try {
    const resource = await resourceService.create({
      resourceName,
      maxCapacity: parseInt(maxCapacity, 10) || 1,
      resourceType: type,
      scheduleInfo,
      ownerUserId: req.user.userId,
    });
    res.status(201).json(resource);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create resource' });
  }
}

async function updateResource(req, res) {
  const resourceId = parseInt(req.params.id, 10);
  const {
    resourceName,
    maxCapacity,
    status,
  } = req.body;

  try {
    const existing = await resourceService.getById(resourceId);
    if (!existing) return res.status(404).json({ error: 'Resource not found' });
    if (!canUpdateResource(req.user, existing)) {
      return res.status(403).json({
        error:
          existing.resourceType === RESOURCE_TYPES.TRANSIT_LINE
            ? 'Transit lines cannot be updated'
            : 'You can only update your own resources',
      });
    }

    const resource = await resourceService.update(resourceId, {
      resourceName,
      maxCapacity: maxCapacity != null ? parseInt(maxCapacity, 10) : null,
      status,
    });
    res.json(resource);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update resource' });
  }
}

async function deleteResource(req, res) {
  const resourceId = parseInt(req.params.id, 10);
  try {
    const existing = await resourceService.getById(resourceId);
    if (!existing) return res.status(404).json({ error: 'Resource not found' });
    if (!canManageResource(req.user, existing)) {
      return res.status(403).json({ error: 'You can only remove your own resources' });
    }

    await resourceService.remove(resourceId);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
}

module.exports = {
  listResources,
  createResource,
  updateResource,
  deleteResource,
};

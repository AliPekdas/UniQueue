const { notificationService } = require('../services/notificationService');

async function listNotifications(req, res) {
  try {
    const list = await notificationService.listForUser(req.user.userId);
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
}

module.exports = { listNotifications };

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth } = require('../middleware/auth');
const { validateAdmin } = require('../middleware/validation');

router.post('/add', auth, validateAdmin, adminController.addAdmin);
router.post('/remove', auth, validateAdmin, adminController.removeAdmin);

router.post('/events/:eventId/approve', auth, validateAdmin, adminController.approveEvent);
router.post('/events/:eventId/reject', auth, validateAdmin, adminController.rejectEvent);

router.get('/stats', auth, validateAdmin, adminController.getAdminStats);
router.get('/events/pending', auth, validateAdmin, adminController.getPendingEvents);
router.get('/verify/:address', auth, validateAdmin, adminController.verifyAdmin);

module.exports = router;
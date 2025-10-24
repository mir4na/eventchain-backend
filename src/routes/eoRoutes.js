const express = require('express');
const multer = require('multer');
const router = express.Router();
const eoController = require('../controllers/eoController');
const { authenticate, requireEO } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

router.post('/events', authenticate, upload.single('poster'), eoController.createEvent);
router.get('/events/:address', eoController.getEOEvents);
router.put('/events/:eventId', authenticate, requireEO, eoController.updateEvent);
router.delete('/events/:eventId', authenticate, requireEO, eoController.deactivateEvent);

router.post('/events/:eventId/ticket-types', authenticate, requireEO, eoController.addTicketType);
router.post('/events/:eventId/finalize', authenticate, requireEO, eoController.finalizeEvent);
router.put('/ticket-types/:typeId', authenticate, requireEO, eoController.updateTicketType);
router.get('/events/:eventId/ticket-types', eoController.getTicketTypes);

router.get('/events/:eventId/revenue', authenticate, requireEO, eoController.getEventRevenue);
router.get('/events/:eventId/analytics', authenticate, requireEO, eoController.getEventAnalytics);
router.get('/dashboard/:address', eoController.getDashboardStats);

router.post('/tickets/:ticketId/verify', authenticate, requireEO, eoController.verifyTicket);
router.post('/tickets/:ticketId/use', authenticate, requireEO, eoController.useTicket);

module.exports = router;
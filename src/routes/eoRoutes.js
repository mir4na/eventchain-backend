const express = require('express');
const router = express.Router();
const eoController = require('../controllers/eoController');
const { authenticate, requireEO } = require('../middleware/auth');

router.post('/events', authenticate, eoController.createEvent);
router.get('/events/:address', eoController.getEOEvents);
router.put('/events/:eventId', authenticate, requireEO, eoController.updateEvent);
router.delete('/events/:eventId', authenticate, requireEO, eoController.deactivateEvent);

router.post('/events/:eventId/ticket-types', authenticate, requireEO, eoController.addTicketType);
router.put('/ticket-types/:typeId', authenticate, requireEO, eoController.updateTicketType);
router.get('/events/:eventId/ticket-types', eoController.getTicketTypes);

router.get('/events/:eventId/revenue', authenticate, requireEO, eoController.getEventRevenue);
router.get('/events/:eventId/analytics', authenticate, requireEO, eoController.getEventAnalytics);
router.get('/dashboard/:address', eoController.getDashboardStats);

router.post('/tickets/:ticketId/verify', authenticate, requireEO, eoController.verifyTicket);
router.post('/tickets/:ticketId/use', authenticate, requireEO, eoController.useTicket);

module.exports = router;
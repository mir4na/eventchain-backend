const express = require('express');
const router = express.Router();
const eoController = require('../controllers/eoController');

router.post('/events', eoController.createEvent);
router.get('/events/:address', eoController.getEOEvents);
router.get('/events/:eventId/details', eoController.getEventDetails);
router.put('/events/:eventId', eoController.updateEvent);
router.delete('/events/:eventId', eoController.deactivateEvent);

router.post('/events/:eventId/ticket-types', eoController.addTicketType);
router.put('/events/:eventId/ticket-types/:typeId', eoController.updateTicketType);
router.get('/events/:eventId/ticket-types', eoController.getTicketTypes);

router.get('/events/:eventId/revenue', eoController.getEventRevenue);
router.get('/events/:eventId/analytics', eoController.getEventAnalytics);
router.get('/dashboard/:address', eoController.getDashboardStats);

router.post('/tickets/:ticketId/verify', eoController.verifyTicket);
router.post('/tickets/:ticketId/use', eoController.useTicket);

module.exports = router;
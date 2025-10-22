const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const ticketService = require('../services/ticketService');

router.get('/', ticketController.getResaleTickets);

router.get('/:ticketId', async (req, res) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.ticketId);
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

router.get('/event/:eventId', async (req, res) => {
  try {
    const tickets = await ticketService.getResaleTickets({ 
      eventId: req.params.eventId 
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
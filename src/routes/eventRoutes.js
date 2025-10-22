const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

router.get('/', eventController.getAllEvents);
router.get('/:eventId', eventController.getEventById);
router.get('/creator/:address', eventController.getEventsByCreator);
router.get('/:eventId/statistics', eventController.getEventStatistics);

router.post('/:eventId/favorite', eventController.toggleFavorite);
router.get('/favorites/:userId', eventController.getUserFavorites);

module.exports = router;
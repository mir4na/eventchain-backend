const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate } = require('../middleware/auth');

router.get('/', eventController.getAllEvents);
router.get('/:eventId', eventController.getEventById);
router.get('/creator/:address', eventController.getEventsByCreator);
router.get('/:eventId/statistics', eventController.getEventStatistics);

router.post('/:eventId/bookmark', authenticate, eventController.toggleBookmark);
router.get('/bookmarks/my', authenticate, eventController.getUserBookmarks);
router.get('/:eventId/is-bookmarked', authenticate, eventController.isEventBookmarked);

module.exports = router;
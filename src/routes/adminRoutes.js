const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.post('/add', authenticate, requireAdmin, adminController.addAdmin);
router.post('/remove', authenticate, requireAdmin, adminController.removeAdmin);
router.get('/verify/:address', adminController.verifyAdmin);

router.get('/proposals/pending', authenticate, requireAdmin, adminController.getPendingProposals);
router.post('/proposals/:proposalId/approve', authenticate, requireAdmin, adminController.approveProposal);
router.post('/proposals/:proposalId/reject', authenticate, requireAdmin, adminController.rejectProposal);

router.get('/stats', authenticate, requireAdmin, adminController.getTransactionStats);
router.get('/eos', authenticate, requireAdmin, adminController.getEventOrganizers);

module.exports = router;
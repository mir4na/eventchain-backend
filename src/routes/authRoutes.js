const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.get('/nonce/:address', authController.getNonce);
router.post('/login', authController.login);
router.get('/admin-check/:address', authController.checkAdmin);

router.post('/logout', authenticate, authController.logout);
router.get('/verify', authenticate, authController.verifyToken);

module.exports = router;
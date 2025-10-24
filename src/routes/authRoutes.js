const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);

router.get('/wallet-nonce/:address', authController.getWalletNonce);
router.post('/connect-wallet', authenticate, authController.connectWallet);
router.post('/disconnect-wallet', authenticate, authController.disconnectWallet);

router.get('/admin-check/:address', authController.checkAdmin);

router.post('/logout', authenticate, authController.logout);
router.get('/verify', authenticate, authController.verifyToken);

module.exports = router;
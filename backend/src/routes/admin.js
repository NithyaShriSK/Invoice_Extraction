const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', adminController.getUsers);
router.put('/users/:userId/status', adminController.updateUserStatus);
router.put('/users/:userId/role', adminController.updateUserRole);
router.get('/invoices', adminController.getInvoices);
router.get('/analytics', adminController.getAnalytics);
router.get('/health', adminController.getSystemHealth);

module.exports = router;

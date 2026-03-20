const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authMiddleware } = require('../middleware/auth');

// All invoice routes are protected
router.use(authMiddleware);

router.post('/upload', invoiceController.uploadInvoice);
router.put('/:id/save', invoiceController.saveInvoice);
router.get('/my', invoiceController.getMyInvoices);
router.get('/:id', invoiceController.getInvoiceById);
router.delete('/:id', invoiceController.deleteInvoice);
router.get('/analytics/my', invoiceController.getMyAnalytics);

module.exports = router;

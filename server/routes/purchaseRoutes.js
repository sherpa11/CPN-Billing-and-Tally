const express = require('express');
const router = express.Router();
const {
  getNextPurchaseNumber,
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  cancelPurchase,
} = require('../controllers/purchaseController');
const { protect } = require('../middleware/authMiddleware');

// Enforce authentication on all purchase routes
router.use(protect);

router.get('/next-number', getNextPurchaseNumber);
router.get('/', getPurchases);
router.get('/:id', getPurchaseById);
router.post('/', createPurchase);
router.put('/:id', updatePurchase);
router.put('/:id/cancel', cancelPurchase);
router.post('/:id/cancel', cancelPurchase);

module.exports = router;

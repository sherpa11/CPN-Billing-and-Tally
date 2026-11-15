const express = require('express');
const router = express.Router();
const {
  createPayment,
  getPayments,
  voidPayment,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Protect all payment routes
router.use(protect);

router.get('/', getPayments);
router.post('/', createPayment);
router.post('/:id/void', voidPayment);

module.exports = router;

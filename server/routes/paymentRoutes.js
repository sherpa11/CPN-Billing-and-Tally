const express = require('express');
const router = express.Router();
const {
  createPayment,
  getPayments,
  voidPayment,
} = require('../controllers/paymentController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.get('/', getPayments);
router.post('/', optionalAuth, createPayment);
router.post('/:id/void', optionalAuth, voidPayment);

module.exports = router;

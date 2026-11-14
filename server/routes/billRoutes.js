const express = require('express');
const router = express.Router();
const {
  getNextBillNumber,
  getBills,
  getBillById,
  createBill,
  updateBill,
  cancelBill,
} = require('../controllers/billController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.get('/next-number', getNextBillNumber);
router.get('/', getBills);
router.get('/:id', getBillById);
router.post('/', optionalAuth, createBill);
router.put('/:id', optionalAuth, updateBill);
router.post('/:id/cancel', optionalAuth, cancelBill);

module.exports = router;

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
const { protect } = require('../middleware/authMiddleware');

// Protect all billing routes
router.use(protect);

router.get('/next-number', getNextBillNumber);
router.get('/', getBills);
router.get('/:id', getBillById);
router.post('/', createBill);
router.put('/:id', updateBill);
router.post('/:id/cancel', cancelBill);

module.exports = router;

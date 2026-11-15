const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerLedger,
  reconcileCustomerBalance,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

// Protect all customer routes
router.use(protect);

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);
router.get('/:id/ledger', getCustomerLedger);
router.post('/:id/reconcile', reconcileCustomerBalance);

module.exports = router;

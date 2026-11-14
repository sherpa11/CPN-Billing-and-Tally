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
const { optionalAuth } = require('../middleware/authMiddleware');

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', optionalAuth, createCustomer);
router.put('/:id', optionalAuth, updateCustomer);
router.delete('/:id', optionalAuth, deleteCustomer);
router.get('/:id/ledger', getCustomerLedger);
router.post('/:id/reconcile', optionalAuth, reconcileCustomerBalance);

module.exports = router;

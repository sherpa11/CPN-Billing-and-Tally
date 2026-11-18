const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierHistory,
  recordSupplierPayment,
} = require('../controllers/supplierController');
const { protect } = require('../middleware/authMiddleware');

// Enforce authentication on all supplier routes
router.use(protect);

router.get('/', getSuppliers);
router.get('/:id', getSupplierById);
router.post('/', createSupplier);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);
router.get('/:id/history', getSupplierHistory);
router.post('/:id/payments', recordSupplierPayment);

module.exports = router;

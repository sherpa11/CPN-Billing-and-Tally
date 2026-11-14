const express = require('express');
const router = express.Router();
const {
  getVegetables,
  getVegetableById,
  createVegetable,
  quickAddVegetable,
  updateVegetable,
  deleteVegetable,
} = require('../controllers/vegetableController');
const { optionalAuth } = require('../middleware/authMiddleware');

router.get('/', getVegetables);
router.get('/:id', getVegetableById);
router.post('/', optionalAuth, createVegetable);
router.post('/quick-add', optionalAuth, quickAddVegetable);
router.put('/:id', optionalAuth, updateVegetable);
router.delete('/:id', optionalAuth, deleteVegetable);

module.exports = router;

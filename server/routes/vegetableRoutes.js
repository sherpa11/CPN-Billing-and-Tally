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
const { protect } = require('../middleware/authMiddleware');

// Protect all vegetable routes
router.use(protect);

router.get('/', getVegetables);
router.get('/:id', getVegetableById);
router.post('/', createVegetable);
router.post('/quick-add', quickAddVegetable);
router.put('/:id', updateVegetable);
router.delete('/:id', deleteVegetable);

module.exports = router;

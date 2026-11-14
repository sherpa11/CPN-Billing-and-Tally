const express = require('express');
const router = express.Router();
const { exportBackup, restoreBackup } = require('../controllers/backupController');
const { protect } = require('../middleware/authMiddleware');

router.get('/export', protect, exportBackup);
router.post('/restore', protect, restoreBackup);

module.exports = router;

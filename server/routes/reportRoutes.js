const express = require('express');
const router = express.Router();
const {
  getDailyReport,
  getDateWiseSalesReport,
  getCustomerOutstandingReport,
  getVegetableWiseReport,
  getMonthlySummary,
  getDashboardStats,
} = require('../controllers/reportController');

router.get('/daily', getDailyReport);
router.get('/sales-summary', getDateWiseSalesReport);
router.get('/outstanding', getCustomerOutstandingReport);
router.get('/vegetables', getVegetableWiseReport);
router.get('/monthly', getMonthlySummary);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;

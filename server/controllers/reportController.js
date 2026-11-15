const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Vegetable = require('../models/Vegetable');
const { round2 } = require('../utils/mathUtils');

// @desc Get Daily Billing Report
// @route GET /api/reports/daily
const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [bills, payments] = await Promise.all([
      Bill.find({
        billDate: { $gte: startOfDay, $lte: endOfDay },
        status: 'active',
      })
        .select('billNumber billNumberFormatted customer customerName customerPhone billDate items totalBag totalWeight todayTotal grandTotal totalDebit totalCredit discount varavu cashReceived closingBalance')
        .sort({ billNumber: 1 })
        .lean(),
      Payment.find({
        paymentDate: { $gte: startOfDay, $lte: endOfDay },
        status: 'active',
      })
        .select('paymentNumber customer customerName bill amount paymentDate paymentMode remarks')
        .lean(),
    ]);

    let totalBags = 0;
    let totalWeight = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalDiscounts = 0;
    let billVaravu = 0;

    bills.forEach((b) => {
      totalBags += b.totalBag || 0;
      totalWeight = round2(totalWeight + (b.totalWeight || 0));
      const bDebit = b.todayTotal !== undefined && b.todayTotal !== null ? b.todayTotal : (b.totalDebit || 0);
      totalDebit = round2(totalDebit + bDebit);
      totalCredit = round2(totalCredit + (b.totalCredit || 0));
      totalDiscounts = round2(totalDiscounts + (b.discount || 0));
      billVaravu = round2(billVaravu + (b.varavu !== undefined ? b.varavu : (b.cashReceived || 0)));
    });

    let directPaymentsTotal = 0;
    payments.forEach((p) => {
      if (!p.bill) {
        directPaymentsTotal = round2(directPaymentsTotal + p.amount);
      }
    });

    const totalCashCollected = round2(billVaravu + directPaymentsTotal);

    res.json({
      success: true,
      reportDate: startOfDay.toISOString().split('T')[0],
      summary: {
        totalBills: bills.length,
        totalBags,
        totalWeight,
        totalDebit,
        totalCredit,
        totalDiscounts,
        billCashReceived: billVaravu,
        billVaravu,
        directPaymentsTotal,
        totalCashCollected,
      },
      bills,
      directPayments: payments.filter((p) => !p.bill),
    });
  } catch (error) {
    console.error('[Report] getDailyReport error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Date-wise Sales Summary Report
// @route GET /api/reports/sales-summary
const getDateWiseSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const bills = await Bill.find({
      billDate: { $gte: start, $lte: end },
      status: 'active',
    })
      .select('billDate totalBag totalWeight todayTotal totalDebit totalCredit cashReceived varavu')
      .sort({ billDate: 1 })
      .lean();

    const grouped = {};

    bills.forEach((b) => {
      const dateKey = new Date(b.billDate).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          billCount: 0,
          totalBags: 0,
          totalWeight: 0,
          totalDebit: 0,
          totalCredit: 0,
          cashReceived: 0,
        };
      }
      grouped[dateKey].billCount += 1;
      grouped[dateKey].totalBags += b.totalBag || 0;
      grouped[dateKey].totalWeight = round2(grouped[dateKey].totalWeight + (b.totalWeight || 0));
      const debit = b.todayTotal !== undefined ? b.todayTotal : (b.totalDebit || 0);
      grouped[dateKey].totalDebit = round2(grouped[dateKey].totalDebit + debit);
      grouped[dateKey].totalCredit = round2(grouped[dateKey].totalCredit + (b.totalCredit || 0));
      const cash = b.varavu !== undefined ? b.varavu : (b.cashReceived || 0);
      grouped[dateKey].cashReceived = round2(grouped[dateKey].cashReceived + cash);
    });

    const report = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));

    res.json({
      success: true,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      data: report,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Customer Outstanding Balance Report
// @route GET /api/reports/outstanding
const getCustomerOutstandingReport = async (req, res) => {
  try {
    const customers = await Customer.find({ isDeleted: false, currentBalance: { $gt: 0 } })
      .select('name tamilName phone address marketStall currentBalance openingBalance lastTransactionDate')
      .sort({ currentBalance: -1 })
      .lean();

    let totalOutstanding = 0;
    customers.forEach((c) => {
      totalOutstanding = round2(totalOutstanding + c.currentBalance);
    });

    res.json({
      success: true,
      totalCustomers: customers.length,
      totalOutstanding,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Vegetable-wise Volume and Revenue Report
// @route GET /api/reports/vegetables
const getVegetableWiseReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchFilter = { status: 'active' };

    if (startDate || endDate) {
      matchFilter.billDate = {};
      if (startDate) matchFilter.billDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchFilter.billDate.$lte = end;
      }
    }

    const bills = await Bill.find(matchFilter).select('items billDate status').lean();
    const vegMap = {};

    bills.forEach((b) => {
      (b.items || []).forEach((item) => {
        const key = item.particulars || 'Other';
        if (!vegMap[key]) {
          vegMap[key] = {
            vegetable: key,
            tamilName: item.tamilName || '',
            totalBags: 0,
            totalWeight: 0,
            totalRevenue: 0,
            rowCount: 0,
            avgRate: 0,
          };
        }
        vegMap[key].rowCount += 1;
        vegMap[key].totalBags += item.bag || 0;
        vegMap[key].totalWeight = round2(vegMap[key].totalWeight + (item.weight || 0));
        const rev = item.amount !== undefined ? item.amount : (item.debit || 0);
        vegMap[key].totalRevenue = round2(vegMap[key].totalRevenue + rev);
        if (!vegMap[key].tamilName && item.tamilName) {
          vegMap[key].tamilName = item.tamilName;
        }
      });
    });

    const report = Object.values(vegMap)
      .map((v) => ({
        ...v,
        avgRate: v.totalWeight > 0 ? round2(v.totalRevenue / v.totalWeight) : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({
      success: true,
      count: report.length,
      data: report,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Monthly Business Summary
// @route GET /api/reports/monthly
const getMonthlySummary = async (req, res) => {
  try {
    const [bills, payments] = await Promise.all([
      Bill.find({ status: 'active' }).select('billDate todayTotal totalDebit totalCredit cashReceived varavu').lean(),
      Payment.find({ status: 'active', bill: null }).select('paymentDate amount').lean(),
    ]);

    const months = {};

    bills.forEach((b) => {
      const d = new Date(b.billDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) {
        months[key] = {
          month: key,
          billCount: 0,
          totalDebit: 0,
          totalCredit: 0,
          billCash: 0,
          directCash: 0,
          totalCollection: 0,
        };
      }
      months[key].billCount += 1;
      const debit = b.todayTotal !== undefined ? b.todayTotal : (b.totalDebit || 0);
      months[key].totalDebit = round2(months[key].totalDebit + debit);
      months[key].totalCredit = round2(months[key].totalCredit + (b.totalCredit || 0));
      const cash = b.varavu !== undefined ? b.varavu : (b.cashReceived || 0);
      months[key].billCash = round2(months[key].billCash + cash);
    });

    payments.forEach((p) => {
      const d = new Date(p.paymentDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) {
        months[key] = {
          month: key,
          billCount: 0,
          totalDebit: 0,
          totalCredit: 0,
          billCash: 0,
          directCash: 0,
          totalCollection: 0,
        };
      }
      months[key].directCash = round2(months[key].directCash + (p.amount || 0));
    });

    const report = Object.values(months)
      .map((m) => ({
        ...m,
        totalCollection: round2(m.billCash + m.directCash),
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Quick Dashboard Metrics
// @route GET /api/reports/dashboard-stats
const getDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayBills, todayPayments, totalCustomers, totalVegetables, outstandingAgg] = await Promise.all([
      Bill.find({ billDate: { $gte: todayStart, $lte: todayEnd }, status: 'active' })
        .select('todayTotal totalDebit totalCredit discount varavu cashReceived')
        .lean(),
      Payment.find({ paymentDate: { $gte: todayStart, $lte: todayEnd }, status: 'active', bill: null })
        .select('amount')
        .lean(),
      Customer.countDocuments({ isDeleted: false, isActive: true }),
      Vegetable.countDocuments({ isDeleted: false, isActive: true }),
      Customer.aggregate([
        { $match: { isDeleted: false, currentBalance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$currentBalance' } } },
      ]),
    ]);

    let todaySales = 0;
    let todayDebit = 0;
    let todayCredit = 0;
    let todayDiscounts = 0;
    let todayVaravu = 0;

    todayBills.forEach((b) => {
      const sales = b.todayTotal !== undefined && b.todayTotal !== null ? b.todayTotal : (b.totalDebit || 0);
      todaySales = round2(todaySales + sales);
      todayDebit = round2(todayDebit + sales);
      todayCredit = round2(todayCredit + (b.totalCredit || 0));
      todayDiscounts = round2(todayDiscounts + (b.discount || 0));
      todayVaravu = round2(todayVaravu + (b.varavu !== undefined ? b.varavu : (b.cashReceived || 0)));
    });

    let directPaymentsTotal = 0;
    todayPayments.forEach((p) => {
      directPaymentsTotal = round2(directPaymentsTotal + (p.amount || 0));
    });

    const totalPaymentsReceived = round2(todayVaravu + directPaymentsTotal);
    const totalOutstanding = outstandingAgg.length > 0 ? round2(outstandingAgg[0].total) : 0;

    res.json({
      success: true,
      todayBillsCount: todayBills.length,
      todaySales,
      todayDebit,
      todayCredit,
      todayDiscounts,
      todayPaymentsReceived: totalPaymentsReceived,
      todayCash: totalPaymentsReceived,
      totalOutstanding,
      activeCustomers: totalCustomers,
      activeVegetables: totalVegetables,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDailyReport,
  getDateWiseSalesReport,
  getCustomerOutstandingReport,
  getVegetableWiseReport,
  getMonthlySummary,
  getDashboardStats,
};

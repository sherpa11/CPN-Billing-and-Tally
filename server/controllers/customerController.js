const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const { round2, add2, sub2 } = require('../utils/mathUtils');

// @desc Get all customers with search & pagination
// @route GET /api/customers
const getCustomers = async (req, res) => {
  try {
    const { search, activeOnly, page = 1, limit = 50 } = req.query;
    let query = { isDeleted: false };

    if (activeOnly === 'true' || activeOnly === undefined) {
      query.isActive = true;
    } else if (activeOnly === 'all') {
      delete query.isActive;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { tamilName: searchRegex },
        { phone: searchRegex },
        { address: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // High performance query: lean and targeted field projection
    const [total, customers] = await Promise.all([
      Customer.countDocuments(query),
      Customer.find(query)
        .select('name tamilName phone address marketStall currentBalance openingBalance isActive lastTransactionDate createdAt')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    res.json({
      success: true,
      count: customers.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: customers,
    });
  } catch (error) {
    console.error('[Customer] getCustomers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single customer with summary & recent activities
// @route GET /api/customers/:id
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const [recentBills, recentPayments] = await Promise.all([
      Bill.find({ customer: customer._id, status: 'active' })
        .select('billNumber billNumberFormatted billDate todayTotal grandTotal closingBalance')
        .sort({ billDate: -1, billNumber: -1 })
        .limit(10)
        .lean(),
      Payment.find({ customer: customer._id, status: 'active' })
        .select('paymentNumber amount paymentDate paymentMode resultingBalance')
        .sort({ paymentDate: -1 })
        .limit(10)
        .lean(),
    ]);

    let lastBalanceDate = null;
    if (recentBills.length > 0 && recentBills[0].billDate) {
      lastBalanceDate = recentBills[0].billDate;
    } else if (recentPayments.length > 0 && recentPayments[0].paymentDate) {
      lastBalanceDate = recentPayments[0].paymentDate;
    } else if (customer.lastTransactionDate) {
      lastBalanceDate = customer.lastTransactionDate;
    } else if (customer.createdAt) {
      lastBalanceDate = customer.createdAt;
    }

    res.json({
      success: true,
      data: {
        ...customer,
        lastBalanceDate,
      },
      lastBalanceDate,
      recentBills,
      recentPayments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create new customer
// @route POST /api/customers
const createCustomer = async (req, res) => {
  try {
    const { name, tamilName, phone, address, marketStall, openingBalance, notes } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const opBal = round2(openingBalance || 0);

    const customer = await Customer.create({
      name: name.trim(),
      tamilName: tamilName ? tamilName.trim() : '',
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      marketStall: marketStall ? marketStall.trim() : '',
      openingBalance: opBal,
      currentBalance: opBal,
      notes: notes || '',
      isActive: true,
    });

    AuditLog.create({
      action: 'create',
      entityType: 'customer',
      entityId: customer._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      newState: customer.toObject(),
    }).catch((err) => console.warn('[Customer] Audit log notice:', err.message));

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer,
    });
  } catch (error) {
    console.error('[Customer] createCustomer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update existing customer
// @route PUT /api/customers/:id
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const {
      name,
      tamilName,
      phone,
      address,
      marketStall,
      openingBalance,
      currentBalance,
      notes,
      isActive,
    } = req.body;

    const previousState = customer.toObject();

    if (name !== undefined) customer.name = name.trim();
    if (tamilName !== undefined) customer.tamilName = tamilName.trim();
    if (phone !== undefined) customer.phone = phone.trim();
    if (address !== undefined) customer.address = address.trim();
    if (marketStall !== undefined) customer.marketStall = marketStall.trim();
    if (notes !== undefined) customer.notes = notes;
    if (isActive !== undefined) customer.isActive = isActive;

    if (openingBalance !== undefined) {
      const newOpening = round2(openingBalance);
      const balanceDelta = sub2(newOpening, customer.openingBalance || 0);
      customer.openingBalance = newOpening;
      if (currentBalance === undefined) {
        customer.currentBalance = add2(customer.currentBalance || 0, balanceDelta);
      }
    }

    if (currentBalance !== undefined) {
      customer.currentBalance = round2(currentBalance);
    }

    await customer.save();

    AuditLog.create({
      action: 'update',
      entityType: 'customer',
      entityId: customer._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      previousState,
      newState: customer.toObject(),
    }).catch((err) => console.warn('[Customer] Audit log notice:', err.message));

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Soft-delete customer
// @route DELETE /api/customers/:id
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.isDeleted = true;
    customer.isActive = false;
    await customer.save();

    AuditLog.create({
      action: 'delete',
      entityType: 'customer',
      entityId: customer._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      newState: customer.toObject(),
    }).catch((err) => console.warn('[Customer] Audit log notice:', err.message));

    res.json({
      success: true,
      message: 'Customer soft-deleted successfully',
      data: customer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get complete customer ledger with chronological running balance
// @route GET /api/customers/:id/ledger
const getCustomerLedger = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const { startDate, endDate } = req.query;

    let billDateFilter = { customer: customer._id, status: 'active' };
    let payDateFilter = { customer: customer._id, status: 'active' };

    if (startDate || endDate) {
      const dateRange = {};
      if (startDate) dateRange.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateRange.$lte = end;
      }
      billDateFilter.billDate = dateRange;
      payDateFilter.paymentDate = dateRange;
    }

    const [bills, payments] = await Promise.all([
      Bill.find(billDateFilter).sort({ billDate: 1, billNumber: 1 }).lean(),
      Payment.find({ ...payDateFilter, bill: null }).sort({ paymentDate: 1 }).lean(),
    ]);

    // Build timeline entries
    const timeline = [];

    // Opening balance entry
    timeline.push({
      date: customer.createdAt,
      type: 'OPENING_BALANCE',
      reference: 'Opening Balance',
      description: 'Account Opening Balance',
      debit: customer.openingBalance > 0 ? customer.openingBalance : 0,
      credit: customer.openingBalance < 0 ? Math.abs(customer.openingBalance) : 0,
    });

    // Add bills
    bills.forEach((b) => {
      const billDebit = b.todayTotal !== undefined ? b.todayTotal : b.totalDebit;
      timeline.push({
        date: b.billDate,
        type: 'BILL',
        id: b._id,
        reference: b.billNumberFormatted ? `Bill #${b.billNumberFormatted}` : `Bill #${b.billNumber}`,
        description: `Vegetable Purchase (${b.items ? b.items.length : 0} items, ${b.totalBag || 0} bags, ${b.totalWeight || 0} kg)`,
        debit: billDebit,
        credit: 0,
        discount: b.discount || 0,
        varavu: b.varavu !== undefined ? b.varavu : (b.cashReceived || 0),
        closingBalance: b.closingBalance,
      });

      if (b.discount > 0) {
        timeline.push({
          date: b.billDate,
          type: 'DISCOUNT',
          id: b._id,
          reference: `Discount on #${b.billNumberFormatted || b.billNumber}`,
          description: `Bill Discount / தள்ளுபடி`,
          debit: 0,
          credit: b.discount,
        });
      }

      const billVaravu = b.varavu !== undefined ? b.varavu : (b.cashReceived || 0);
      if (billVaravu > 0) {
        timeline.push({
          date: b.billDate,
          type: 'VARAVU',
          id: b._id,
          reference: `Varavu on #${b.billNumberFormatted || b.billNumber}`,
          description: `Varavu / வரவு received for Bill #${b.billNumberFormatted || b.billNumber}`,
          debit: 0,
          credit: billVaravu,
        });
      }
    });

    // Add standalone payments
    payments.forEach((p) => {
      timeline.push({
        date: p.paymentDate,
        type: 'PAYMENT',
        id: p._id,
        reference: `Payment #${p.paymentNumber || ''}`,
        description: `Direct Payment Received (${p.paymentMode || 'Cash'}) ${p.remarks ? '- ' + p.remarks : ''}`,
        debit: 0,
        credit: p.amount,
        resultingBalance: p.resultingBalance,
      });
    });

    // Sort all timeline entries chronologically
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance strictly with 2-decimal arithmetic
    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const computedTimeline = timeline.map((item) => {
      totalDebit = round2(totalDebit + (item.debit || 0));
      totalCredit = round2(totalCredit + (item.credit || 0));
      runningBalance = round2(runningBalance + (item.debit || 0) - (item.credit || 0));

      return {
        ...item,
        runningBalance,
      };
    });

    res.json({
      success: true,
      customer: {
        _id: customer._id,
        id: customer._id,
        name: customer.name,
        tamilName: customer.tamilName,
        phone: customer.phone,
        openingBalance: customer.openingBalance,
        currentBalance: customer.currentBalance,
        calculatedBalance: runningBalance,
      },
      summary: {
        totalDebit,
        totalCredit,
        netBalance: runningBalance,
        currentBalance: customer.currentBalance,
      },
      ledger: computedTimeline,
    });
  } catch (error) {
    console.error('[Customer] getCustomerLedger error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Reconcile / audit customer balance against bills and payments
// @route POST /api/customers/:id/reconcile
const reconcileCustomerBalance = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const [bills, payments] = await Promise.all([
      Bill.find({ customer: customer._id, status: 'active' }).sort({ billDate: 1, billNumber: 1 }).lean(),
      Payment.find({ customer: customer._id, status: 'active', bill: null }).sort({ paymentDate: 1 }).lean(),
    ]);

    let calculatedBalance = customer.openingBalance || 0;

    bills.forEach((b) => {
      const debit = b.todayTotal !== undefined ? b.todayTotal : (b.totalDebit || 0);
      const discount = b.discount || 0;
      const varavu = b.varavu !== undefined ? b.varavu : (b.cashReceived || 0);
      calculatedBalance = round2(calculatedBalance + debit - discount - varavu);
    });

    payments.forEach((p) => {
      calculatedBalance = round2(calculatedBalance - p.amount);
    });

    const previousBalance = customer.currentBalance;
    customer.currentBalance = calculatedBalance;
    await customer.save();

    AuditLog.create({
      action: 'reconcile_balance',
      entityType: 'customer',
      entityId: customer._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      previousState: { currentBalance: previousBalance },
      newState: { currentBalance: calculatedBalance },
    }).catch((err) => console.warn('[Customer] Audit log notice:', err.message));

    res.json({
      success: true,
      message: 'Customer balance reconciled successfully',
      previousBalance,
      reconciledBalance: calculatedBalance,
      difference: round2(calculatedBalance - previousBalance),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerLedger,
  reconcileCustomerBalance,
};

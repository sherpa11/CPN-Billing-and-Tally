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

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [total, customers] = await Promise.all([
      Customer.countDocuments(query),
      Customer.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum),
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
    const customer = await Customer.findById(req.params.id);
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const [recentBills, recentPayments] = await Promise.all([
      Bill.find({ customer: customer._id, status: 'active' })
        .sort({ billDate: -1, billNumber: -1 })
        .limit(10),
      Payment.find({ customer: customer._id, status: 'active' })
        .sort({ paymentDate: -1 })
        .limit(10),
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
        ...customer.toObject(),
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

    await AuditLog.create({
      action: 'create',
      entityType: 'customer',
      entityId: customer._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      newState: customer.toObject(),
    });

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

// @desc Update customer
// @route PUT /api/customers/:id
const updateCustomer = async (req, res) => {
  try {
    const { name, tamilName, phone, address, marketStall, notes, isActive, openingBalance } = req.body;
    const customer = await Customer.findById(req.params.id);

    if (!customer || customer.isDeleted) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const previousState = customer.toObject();

    if (name) customer.name = name.trim();
    if (tamilName !== undefined) customer.tamilName = tamilName.trim();
    if (phone !== undefined) customer.phone = phone.trim();
    if (address !== undefined) customer.address = address.trim();
    if (marketStall !== undefined) customer.marketStall = marketStall.trim();
    if (notes !== undefined) customer.notes = notes;
    if (isActive !== undefined) customer.isActive = Boolean(isActive);

    // If opening balance changed, recalculate current balance safely
    if (openingBalance !== undefined && round2(openingBalance) !== customer.openingBalance) {
      const diff = sub2(round2(openingBalance), customer.openingBalance);
      customer.openingBalance = round2(openingBalance);
      customer.currentBalance = add2(customer.currentBalance, diff);
    }

    await customer.save();

    await AuditLog.create({
      action: 'update',
      entityType: 'customer',
      entityId: customer._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      previousState,
      newState: customer.toObject(),
    });

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Delete customer (soft or permanent)
// @route DELETE /api/customers/:id
const deleteCustomer = async (req, res) => {
  try {
    const { permanent } = req.query;
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (permanent === 'true') {
      await Customer.findByIdAndDelete(req.params.id);
    } else {
      customer.isDeleted = true;
      customer.isActive = false;
      await customer.save();
    }

    await AuditLog.create({
      action: permanent === 'true' ? 'delete_permanent' : 'delete_soft',
      entityType: 'customer',
      entityId: req.params.id,
      performedBy: req.user ? req.user.username : 'admin',
    });

    res.json({
      success: true,
      message: 'Customer deleted successfully',
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
    const customer = await Customer.findById(req.params.id);
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
      Bill.find(billDateFilter).sort({ billDate: 1, billNumber: 1 }),
      // Exclude payments linked to a bill so we don't double count cash received on bill
      Payment.find({ ...payDateFilter, bill: null }).sort({ paymentDate: 1 }),
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
        description: `Vegetable Purchase (${b.items.length} items, ${b.totalBag} bags, ${b.totalWeight} kg)`,
        debit: billDebit,
        credit: 0,
        discount: b.discount || 0,
        varavu: b.varavu !== undefined ? b.varavu : (b.cashReceived || 0),
        closingBalance: b.closingBalance,
      });

      // If bill had discount, record separate discount entry
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

      // If bill had varavu / cash received, add it as varavu/payment entry
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
        reference: `Payment #${p.paymentNumber || p._id.toString().slice(-4)}`,
        description: `Direct Payment (${p.paymentMode})${p.referenceNumber ? ' Ref: ' + p.referenceNumber : ''}${p.remarks ? ' - ' + p.remarks : ''}`,
        debit: 0,
        credit: p.amount,
      });
    });

    // Sort chronologically
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance: balance = prev + debit - credit
    let runningBalance = 0;
    const ledgerWithRunning = timeline.map((entry) => {
      runningBalance = round2(runningBalance + (entry.debit || 0) - (entry.credit || 0));
      return {
        ...entry,
        runningBalance,
      };
    });

    res.json({
      success: true,
      customer: {
        id: customer._id,
        name: customer.name,
        tamilName: customer.tamilName,
        phone: customer.phone,
        openingBalance: customer.openingBalance || 0,
        currentBalance: customer.currentBalance,
        calculatedBalance: runningBalance,
      },
      ledger: ledgerWithRunning,
    });
  } catch (error) {
    console.error('[Customer] getCustomerLedger error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Reconcile and fix customer balance against all transactions
// @route POST /api/customers/:id/reconcile
const reconcileCustomerBalance = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const [bills, payments] = await Promise.all([
      Bill.find({ customer: customer._id, status: 'active' }),
      Payment.find({ customer: customer._id, status: 'active', bill: null }),
    ]);

    let calcBal = customer.openingBalance;
    bills.forEach((b) => {
      calcBal = round2(calcBal + b.totalDebit - b.totalCredit - (b.cashReceived || 0));
    });
    payments.forEach((p) => {
      calcBal = round2(calcBal - p.amount);
    });

    const oldBalance = customer.currentBalance;
    customer.currentBalance = calcBal;
    await customer.save();

    await AuditLog.create({
      action: 'reconcile_balance',
      entityType: 'customer',
      entityId: customer._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      previousState: { currentBalance: oldBalance },
      newState: { currentBalance: calcBal },
    });

    res.json({
      success: true,
      message: 'Customer balance reconciled accurately',
      oldBalance,
      reconciledBalance: calcBal,
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

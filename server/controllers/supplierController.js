const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const SupplierPayment = require('../models/SupplierPayment');
const AuditLog = require('../models/AuditLog');
const { round2, add2, sub2 } = require('../utils/mathUtils');

// @desc Get all suppliers with search & pagination
// @route GET /api/suppliers
const getSuppliers = async (req, res) => {
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

    const [total, suppliers] = await Promise.all([
      Supplier.countDocuments(query),
      Supplier.find(query)
        .select('name tamilName phone address currentBalance openingBalance notes isActive lastTransactionDate createdAt')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    res.json({
      success: true,
      count: suppliers.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: suppliers,
    });
  } catch (error) {
    console.error('[Supplier] getSuppliers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single supplier with recent purchases & balance summary
// @route GET /api/suppliers/:id
const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const [recentPurchases, recentPayments] = await Promise.all([
      Purchase.find({ supplier: supplier._id, status: 'active' })
        .select('purchaseNumber purchaseNumberFormatted purchaseDate todayTotal grandTotal closingBalance')
        .sort({ purchaseDate: -1, purchaseNumber: -1 })
        .limit(10)
        .lean(),
      SupplierPayment.find({ supplier: supplier._id, status: 'active' })
        .select('paymentNumber amount paymentDate paymentMode resultingBalance')
        .sort({ paymentDate: -1 })
        .limit(10)
        .lean(),
    ]);

    let lastBalanceDate = null;
    if (recentPurchases.length > 0 && recentPurchases[0].purchaseDate) {
      lastBalanceDate = recentPurchases[0].purchaseDate;
    } else if (recentPayments.length > 0 && recentPayments[0].paymentDate) {
      lastBalanceDate = recentPayments[0].paymentDate;
    } else if (supplier.lastTransactionDate) {
      lastBalanceDate = supplier.lastTransactionDate;
    } else if (supplier.createdAt) {
      lastBalanceDate = supplier.createdAt;
    }

    res.json({
      success: true,
      data: {
        ...supplier,
        lastBalanceDate,
        recentPurchases,
        recentPayments,
      },
    });
  } catch (error) {
    console.error('[Supplier] getSupplierById error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create a new supplier
// @route POST /api/suppliers
const createSupplier = async (req, res) => {
  try {
    const { name, tamilName, phone, address, openingBalance, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const initialOpeningBalance = round2(parseFloat(openingBalance) || 0);

    const supplier = await Supplier.create({
      name: name.trim(),
      tamilName: tamilName ? tamilName.trim() : '',
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      openingBalance: initialOpeningBalance,
      currentBalance: initialOpeningBalance,
      notes: notes ? notes.trim() : '',
      isActive: true,
      isDeleted: false,
    });

    try {
      await AuditLog.create({
        action: 'CREATE_SUPPLIER',
        entityType: 'Supplier',
        entityId: supplier._id,
        user: req.user ? req.user._id : null,
        details: { name: supplier.name, openingBalance: initialOpeningBalance },
      });
    } catch {}

    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    console.error('[Supplier] createSupplier error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update supplier details
// @route PUT /api/suppliers/:id
const updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const { name, tamilName, phone, address, notes, isActive } = req.body;

    if (name !== undefined) supplier.name = name.trim();
    if (tamilName !== undefined) supplier.tamilName = tamilName.trim();
    if (phone !== undefined) supplier.phone = phone.trim();
    if (address !== undefined) supplier.address = address.trim();
    if (notes !== undefined) supplier.notes = notes.trim();
    if (isActive !== undefined) supplier.isActive = Boolean(isActive);

    await supplier.save();

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error('[Supplier] updateSupplier error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Safely delete or deactivate supplier
// @route DELETE /api/suppliers/:id
const deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // Check for existing purchases or payments
    const [purchaseCount, paymentCount] = await Promise.all([
      Purchase.countDocuments({ supplier: supplier._id, status: 'active' }),
      SupplierPayment.countDocuments({ supplier: supplier._id, status: 'active' }),
    ]);

    if (purchaseCount > 0 || paymentCount > 0) {
      // Transaction history protection: soft-delete / deactivate only
      supplier.isDeleted = true;
      supplier.isActive = false;
      await supplier.save();

      return res.json({
        success: true,
        message: 'Supplier has existing transaction history and was safely archived (deactivated).',
        isSoftDeleted: true,
      });
    }

    // Safe to soft-delete
    supplier.isDeleted = true;
    supplier.isActive = false;
    await supplier.save();

    res.json({ success: true, message: 'Supplier successfully removed' });
  } catch (error) {
    console.error('[Supplier] deleteSupplier error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get supplier complete transaction history / ledger
// @route GET /api/suppliers/:id/history
const getSupplierHistory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    let purchaseQuery = { supplier: supplier._id, status: 'active' };
    let paymentQuery = { supplier: supplier._id, status: 'active' };

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      purchaseQuery.purchaseDate = dateFilter;
      paymentQuery.paymentDate = dateFilter;
    }

    const [purchases, payments] = await Promise.all([
      Purchase.find(purchaseQuery)
        .select('purchaseNumber purchaseNumberFormatted purchaseDate items totalBag totalWeight todayTotal grandTotal discount varavu cashPaid closingBalance status')
        .sort({ purchaseDate: 1, purchaseNumber: 1 })
        .lean(),
      SupplierPayment.find(paymentQuery)
        .select('paymentNumber amount paymentDate paymentMode referenceNumber remarks resultingBalance status purchase')
        .sort({ paymentDate: 1 })
        .lean(),
    ]);

    // Build timeline
    const timeline = [];

    // Opening balance entry if not filtered by date or date includes creation
    timeline.push({
      date: supplier.createdAt,
      type: 'OPENING_BALANCE',
      reference: 'Opening Balance',
      description: 'Account Opening Balance',
      debit: supplier.openingBalance > 0 ? supplier.openingBalance : 0,
      credit: supplier.openingBalance < 0 ? Math.abs(supplier.openingBalance) : 0,
    });

    purchases.forEach((p) => {
      const purchaseAmount = p.todayTotal !== undefined ? p.todayTotal : (p.totalDebit || 0);
      const particularsList = (p.items || [])
        .map((it) => it.tamilName || it.particulars)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');

      timeline.push({
        date: p.purchaseDate,
        type: 'PURCHASE',
        id: p._id,
        reference: p.purchaseNumberFormatted || `PUR-${String(p.purchaseNumber).padStart(4, '0')}`,
        description: `Vegetable Purchase (${p.items ? p.items.length : 0} items${particularsList ? ': ' + particularsList : ''})`,
        debit: purchaseAmount,
        credit: 0,
        discount: p.discount || 0,
        varavu: p.varavu !== undefined ? p.varavu : (p.cashPaid || 0),
        closingBalance: p.closingBalance,
        status: p.status,
      });

      if (p.discount > 0) {
        timeline.push({
          date: p.purchaseDate,
          type: 'DISCOUNT',
          id: p._id,
          reference: `Discount on #${p.purchaseNumberFormatted || p.purchaseNumber}`,
          description: 'Purchase Discount / தள்ளுபடி',
          debit: 0,
          credit: p.discount,
        });
      }

      const varavuAmount = p.varavu !== undefined ? p.varavu : (p.cashPaid || 0);
      if (varavuAmount > 0) {
        timeline.push({
          date: p.purchaseDate,
          type: 'VARAVU',
          id: p._id,
          reference: `Varavu on #${p.purchaseNumberFormatted || p.purchaseNumber}`,
          description: `Settlement / வரவு for #${p.purchaseNumberFormatted || p.purchaseNumber}`,
          debit: 0,
          credit: varavuAmount,
        });
      }
    });

    // Standalone payments
    payments.forEach((pay) => {
      timeline.push({
        date: pay.paymentDate,
        type: 'PAYMENT',
        id: pay._id,
        reference: pay.paymentNumber ? `Payment #${pay.paymentNumber}` : 'Payment',
        description: `Payment Made (${pay.paymentMode || 'Cash'}) ${pay.remarks ? '- ' + pay.remarks : ''}`,
        debit: 0,
        credit: pay.amount,
        resultingBalance: pay.resultingBalance,
      });
    });

    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

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
      data: {
        supplier,
        timeline: computedTimeline,
        summary: {
          totalPurchases: totalDebit,
          totalPayments: totalCredit,
          currentBalance: runningBalance,
        },
      },
    });
  } catch (error) {
    console.error('[Supplier] getSupplierHistory error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Record a standalone payment to a supplier
// @route POST /api/suppliers/:id/payments
const recordSupplierPayment = async (req, res) => {
  try {
    const { amount, paymentDate, paymentMode = 'Cash', referenceNumber = '', remarks = '' } = req.body;
    const numAmount = round2(parseFloat(amount) || 0);

    if (numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required' });
    }

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier || supplier.isDeleted) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const previousBalance = round2(supplier.currentBalance || 0);
    const resultingBalance = round2(previousBalance - numAmount);

    const latestPayment = await SupplierPayment.findOne().sort({ paymentNumber: -1 }).select('paymentNumber').lean();
    const nextPaymentNumber = latestPayment && latestPayment.paymentNumber ? latestPayment.paymentNumber + 1 : 1;

    const payment = await SupplierPayment.create({
      paymentNumber: nextPaymentNumber,
      supplier: supplier._id,
      supplierName: supplier.name,
      amount: numAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMode,
      referenceNumber,
      remarks,
      previousBalance,
      resultingBalance,
      status: 'active',
      createdBy: req.user ? req.user._id : null,
    });

    supplier.currentBalance = resultingBalance;
    supplier.lastTransactionDate = payment.paymentDate;
    await supplier.save();

    res.status(201).json({ success: true, data: payment, supplierBalance: resultingBalance });
  } catch (error) {
    console.error('[Supplier] recordSupplierPayment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierHistory,
  recordSupplierPayment,
};

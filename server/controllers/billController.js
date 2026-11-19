const Bill = require('../models/Bill');
const Purchase = require('../models/Purchase');
const Customer = require('../models/Customer');
const Vegetable = require('../models/Vegetable');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const { round2, add2, sub2 } = require('../utils/mathUtils');

// @desc Get next sequential bill number
// @route GET /api/bills/next-number
const getNextBillNumber = async (req, res) => {
  try {
    const [settings, latestBill] = await Promise.all([
      Settings.findOne().select('billPrefix').lean(),
      Bill.findOne().sort({ billNumber: -1 }).select('billNumber').lean(),
    ]);

    const nextNum = latestBill && latestBill.billNumber ? latestBill.billNumber + 1 : 1;
    const prefix = (settings && settings.billPrefix) || 'CPN';
    const formatted = `${prefix}-${String(nextNum).padStart(4, '0')}`;

    res.json({
      success: true,
      nextBillNumber: nextNum,
      formattedBillNumber: formatted,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all bills with filters & pagination (supports customer, purchase, or all unified)
// @route GET /api/bills
const getBills = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      customer,
      supplier,
      search,
      status = 'active',
      page = 1,
      limit = 25,
      type = 'customer', // 'customer' | 'purchase' | 'all'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // 1. PURCHASE BILLS ONLY
    if (type === 'purchase') {
      let purQuery = {};
      if (status !== 'all') {
        purQuery.status = status;
      }
      if (supplier) {
        purQuery.supplier = supplier;
      }
      if (startDate || endDate) {
        purQuery.purchaseDate = {};
        if (startDate) purQuery.purchaseDate.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          purQuery.purchaseDate.$lte = end;
        }
      }
      if (search && search.trim() !== '') {
        const term = search.trim();
        const numTerm = parseInt(term, 10);
        const orClauses = [
          { supplierName: new RegExp(term, 'i') },
          { purchaseNumberFormatted: new RegExp(term, 'i') },
        ];
        if (!isNaN(numTerm)) {
          orClauses.push({ purchaseNumber: numTerm });
        }
        purQuery.$or = orClauses;
      }

      const [total, purchases] = await Promise.all([
        Purchase.countDocuments(purQuery),
        Purchase.find(purQuery)
          .select(
            'purchaseNumber purchaseNumberFormatted supplier supplierName supplierPhone purchaseDate totalBag totalWeight todayTotal grandTotal totalDebit discount varavu cashPaid closingBalance status notes createdAt'
          )
          .populate('supplier', 'name tamilName phone currentBalance')
          .sort({ purchaseDate: -1, purchaseNumber: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
      ]);

      const formatted = purchases.map((p) => ({
        ...p,
        billType: 'purchase',
        isPurchase: true,
        billNumber: p.purchaseNumber,
        billNumberFormatted: p.purchaseNumberFormatted,
        billDate: p.purchaseDate,
        customerName: p.supplierName,
        customerPhone: p.supplierPhone,
        todayTotal: p.todayTotal !== undefined && p.todayTotal !== null ? p.todayTotal : (p.totalDebit || 0),
        purchaseTotal: p.todayTotal !== undefined && p.todayTotal !== null ? p.todayTotal : (p.totalDebit || 0),
        cashReceived: p.varavu !== undefined ? p.varavu : (p.cashPaid || 0),
        discount: 0,
      }));

      return res.json({
        success: true,
        count: formatted.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        data: formatted,
      });
    }

    // 2. UNIFIED BILLS (Customer Sales + Supplier Purchases)
    if (type === 'all') {
      let billQuery = {};
      let purQuery = {};

      if (status !== 'all') {
        billQuery.status = status;
        purQuery.status = status;
      }

      if (customer) billQuery.customer = customer;
      if (supplier) purQuery.supplier = supplier;

      if (startDate || endDate) {
        billQuery.billDate = {};
        purQuery.purchaseDate = {};
        if (startDate) {
          const s = new Date(startDate);
          billQuery.billDate.$gte = s;
          purQuery.purchaseDate.$gte = s;
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          billQuery.billDate.$lte = e;
          purQuery.purchaseDate.$lte = e;
        }
      }

      if (search && search.trim() !== '') {
        const term = search.trim();
        const numTerm = parseInt(term, 10);

        const billOr = [
          { customerName: new RegExp(term, 'i') },
          { billNumberFormatted: new RegExp(term, 'i') },
        ];
        if (!isNaN(numTerm)) billOr.push({ billNumber: numTerm });
        billQuery.$or = billOr;

        const purOr = [
          { supplierName: new RegExp(term, 'i') },
          { purchaseNumberFormatted: new RegExp(term, 'i') },
        ];
        if (!isNaN(numTerm)) purOr.push({ purchaseNumber: numTerm });
        purQuery.$or = purOr;
      }

      const shouldQueryBills = !supplier;
      const shouldQueryPurchases = !customer;

      const [totalBills, totalPurchases] = await Promise.all([
        shouldQueryBills ? Bill.countDocuments(billQuery) : 0,
        shouldQueryPurchases ? Purchase.countDocuments(purQuery) : 0,
      ]);

      const grandTotalCount = totalBills + totalPurchases;
      const fetchLimit = skip + limitNum;

      const [rawBills, rawPurchases] = await Promise.all([
        shouldQueryBills
          ? Bill.find(billQuery)
              .select(
                'billNumber billNumberFormatted customer customerName customerPhone billDate totalBag totalWeight todayTotal grandTotal totalDebit discount varavu cashReceived closingBalance status notes createdAt'
              )
              .populate('customer', 'name tamilName phone currentBalance')
              .sort({ billDate: -1, billNumber: -1 })
              .limit(fetchLimit)
              .lean()
          : [],
        shouldQueryPurchases
          ? Purchase.find(purQuery)
              .select(
                'purchaseNumber purchaseNumberFormatted supplier supplierName supplierPhone purchaseDate totalBag totalWeight todayTotal grandTotal totalDebit discount varavu cashPaid closingBalance status notes createdAt'
              )
              .populate('supplier', 'name tamilName phone currentBalance')
              .sort({ purchaseDate: -1, purchaseNumber: -1 })
              .limit(fetchLimit)
              .lean()
          : [],
      ]);

      const combined = [
        ...rawBills.map((b) => ({
          ...b,
          billType: 'customer',
          isPurchase: false,
          effectiveDate: b.billDate,
        })),
        ...rawPurchases.map((p) => ({
          ...p,
          billType: 'purchase',
          isPurchase: true,
          billNumber: p.purchaseNumber,
          billNumberFormatted: p.purchaseNumberFormatted,
          billDate: p.purchaseDate,
          customerName: p.supplierName,
          customerPhone: p.supplierPhone,
          todayTotal: p.todayTotal !== undefined && p.todayTotal !== null ? p.todayTotal : (p.totalDebit || 0),
          purchaseTotal: p.todayTotal !== undefined && p.todayTotal !== null ? p.todayTotal : (p.totalDebit || 0),
          cashReceived: p.varavu !== undefined ? p.varavu : (p.cashPaid || 0),
          discount: 0,
          effectiveDate: p.purchaseDate,
        })),
      ];

      combined.sort((a, b) => {
        const timeA = new Date(a.effectiveDate || a.createdAt || 0).getTime();
        const timeB = new Date(b.effectiveDate || b.createdAt || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return (b.billNumber || 0) - (a.billNumber || 0);
      });

      const paged = combined.slice(skip, skip + limitNum);

      return res.json({
        success: true,
        count: paged.length,
        total: grandTotalCount,
        page: pageNum,
        pages: Math.ceil(grandTotalCount / limitNum),
        data: paged,
      });
    }

    // 3. DEFAULT: CUSTOMER BILLS ONLY (100% Backward Compatible)
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }

    if (customer) {
      query.customer = customer;
    }

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      const numTerm = parseInt(term, 10);
      const orClauses = [
        { customerName: new RegExp(term, 'i') },
        { billNumberFormatted: new RegExp(term, 'i') },
      ];
      if (!isNaN(numTerm)) {
        orClauses.push({ billNumber: numTerm });
      }
      query.$or = orClauses;
    }

    // High performance query: use .lean() and avoid heavy nested subdocument populates in list view
    const [total, bills] = await Promise.all([
      Bill.countDocuments(query),
      Bill.find(query)
        .select(
          'billNumber billNumberFormatted customer customerName customerPhone billDate totalBag totalWeight todayTotal grandTotal totalDebit discount varavu cashReceived closingBalance status notes createdAt'
        )
        .populate('customer', 'name tamilName phone currentBalance')
        .sort({ billDate: -1, billNumber: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const formattedBills = bills.map((b) => ({
      ...b,
      billType: 'customer',
      isPurchase: false,
    }));

    res.json({
      success: true,
      count: formattedBills.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: formattedBills,
    });
  } catch (error) {
    console.error('[Bill] getBills error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single bill by ID
// @route GET /api/bills/:id
const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('customer', 'name tamilName phone address marketStall currentBalance')
      .populate('items.vegetable', 'name tamilName defaultRate unit')
      .lean();

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const billObj = { ...bill };
    if (billObj.todayTotal === undefined || billObj.todayTotal === null) {
      billObj.todayTotal = billObj.totalDebit || 0;
    }
    if (billObj.grandTotal === undefined || billObj.grandTotal === null) {
      billObj.grandTotal = round2((billObj.todayTotal || 0) + (billObj.previousBalance || 0));
    }
    if (!billObj.billVersion) {
      billObj.billVersion = 'v1_legacy_6col';
    }
    if (billObj.discount === undefined || billObj.discount === null) {
      billObj.discount = 0;
    }
    if (billObj.varavu === undefined || billObj.varavu === null) {
      billObj.varavu = billObj.cashReceived || 0;
    }

    // Resolve Tamil vegetable names from master for both current and historical bills
    const allVegetables = await Vegetable.find({}).select('_id name normalizedName tamilName').lean();
    const vegById = new Map();
    const vegByName = new Map();
    for (const v of allVegetables) {
      vegById.set(v._id.toString(), v);
      if (v.name) vegByName.set(v.name.trim().toLowerCase(), v);
      if (v.normalizedName) vegByName.set(v.normalizedName, v);
    }

    billObj.items = (billObj.items || []).map((it) => {
      let resolvedTamil = '';
      if (it.tamilName && it.tamilName.trim()) {
        resolvedTamil = it.tamilName.trim();
      } else if (it.vegetable && typeof it.vegetable === 'object' && it.vegetable.tamilName && it.vegetable.tamilName.trim()) {
        resolvedTamil = it.vegetable.tamilName.trim();
      } else if (it.vegetable && vegById.has(it.vegetable.toString())) {
        resolvedTamil = vegById.get(it.vegetable.toString()).tamilName || '';
      } else if (it.particulars && vegByName.has(it.particulars.trim().toLowerCase())) {
        resolvedTamil = vegByName.get(it.particulars.trim().toLowerCase()).tamilName || '';
      }

      return {
        ...it,
        tamilName: resolvedTamil,
        amount: it.amount !== undefined && it.amount !== null ? it.amount : (it.debit || 0),
      };
    });

    res.json({ success: true, data: billObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create a new Bill (Optimized Save & New Workflow)
// @route POST /api/bills
const createBill = async (req, res) => {
  try {
    const {
      customerId,
      customer: customerField,
      customerName,
      customerPhone,
      billDate,
      items,
      previousBalance,
      previousBalanceDate,
      discount = 0,
      varavu,
      cashReceived = 0,
      notes = '',
    } = req.body;

    const resolvedCustomerId = customerId || customerField;

    if (!resolvedCustomerId && !customerName) {
      return res.status(400).json({ success: false, message: 'Customer information is required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Bill must contain at least one vegetable item' });
    }

    const inputVegIds = items.filter((it) => it.vegetable).map((it) => it.vegetable);

    // Parallelize independent initial lookups into a single round trip
    const [latestBill, settings, resolvedCustomer, vegDocs, lastCustBill] = await Promise.all([
      Bill.findOne().sort({ billNumber: -1 }).select('billNumber').lean(),
      Settings.findOne().select('billPrefix').lean(),
      resolvedCustomerId ? Customer.findById(resolvedCustomerId) : null,
      inputVegIds.length > 0
        ? Vegetable.find({ _id: { $in: inputVegIds } }).select('_id name tamilName defaultRate unit').lean()
        : [],
      resolvedCustomerId && !previousBalanceDate
        ? Bill.findOne({ customer: resolvedCustomerId, status: 'active' })
            .sort({ billDate: -1, billNumber: -1 })
            .select('billDate')
            .lean()
        : null,
    ]);

    let customer = resolvedCustomer;
    if (!customer && customerName) {
      customer = await Customer.create({
        name: customerName.trim(),
        phone: customerPhone ? customerPhone.trim() : '',
        openingBalance: 0,
        currentBalance: 0,
      });
    }

    if (!customer) {
      return res.status(400).json({ success: false, message: 'Customer could not be resolved' });
    }

    const billNumber = latestBill && latestBill.billNumber ? latestBill.billNumber + 1 : 1;
    const billPrefix = (settings && settings.billPrefix) || 'CPN';
    const billNumberFormatted = `${billPrefix}-${String(billNumber).padStart(4, '0')}`;

    // Process and validate items
    let totalBag = 0;
    let totalWeight = 0;
    let todayTotal = 0;

    const vegMap = new Map();
    vegDocs.forEach((v) => vegMap.set(v._id.toString(), v));

    const processedItems = items.map((item) => {
      const rate = round2(item.rate || 0);
      const bag = Number(item.bag) || 0;
      const weight = round2(item.weight || 0);
      let amount = round2(
        item.amount !== undefined && item.amount !== null
          ? item.amount
          : item.debit !== undefined && item.debit !== null
          ? item.debit
          : (rate * weight)
      );
      const debit = amount;
      const credit = 0;

      totalBag += bag;
      totalWeight = add2(totalWeight, weight);
      todayTotal = add2(todayTotal, amount);

      const matchedVeg = item.vegetable ? vegMap.get(item.vegetable.toString()) : null;
      const resolvedTamilName = (item.tamilName && item.tamilName.trim())
        ? item.tamilName.trim()
        : (matchedVeg && matchedVeg.tamilName ? matchedVeg.tamilName.trim() : '');

      return {
        vegetable: item.vegetable || null,
        particulars: item.particulars ? item.particulars.trim() : 'Vegetable',
        tamilName: resolvedTamilName,
        rate,
        bag,
        weight,
        amount,
        debit,
        credit,
      };
    });

    const parsedDiscount = Math.max(0, round2(discount || 0));
    const parsedVaravu = Math.max(
      0,
      round2(varavu !== undefined && varavu !== null && varavu !== '' ? varavu : (cashReceived || 0))
    );
    const parsedPrevBalance = round2(
      previousBalance !== undefined && previousBalance !== null
        ? previousBalance
        : (customer.currentBalance || 0)
    );

    // Resolve date of previous balance
    let resolvedPrevBalanceDate = previousBalanceDate ? new Date(previousBalanceDate) : null;
    if (!resolvedPrevBalanceDate) {
      if (lastCustBill && lastCustBill.billDate) {
        resolvedPrevBalanceDate = lastCustBill.billDate;
      } else if (customer.lastTransactionDate) {
        resolvedPrevBalanceDate = customer.lastTransactionDate;
      } else if (customer.createdAt) {
        resolvedPrevBalanceDate = customer.createdAt;
      }
    }

    // 6-ROW SUMMARY ACCOUNTING LOGIC:
    // 1. Today's Total = todayTotal
    // 2. Previous Balance = parsedPrevBalance
    // 3. Total = todayTotal + parsedPrevBalance
    // 4. Discount = parsedDiscount
    // 5. Varavu = parsedVaravu
    // 6. Closing Balance = Total - Discount - Varavu
    const total = round2(todayTotal + parsedPrevBalance);
    const closingBalance = round2(total - parsedDiscount - parsedVaravu);

    // Save Bill
    const bill = await Bill.create({
      billNumber,
      billNumberFormatted,
      customer: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      billDate: billDate ? new Date(billDate) : new Date(),
      items: processedItems,
      totalBag,
      totalWeight,
      todayTotal,
      grandTotal: total,
      totalDebit: todayTotal,
      totalCredit: 0,
      previousBalance: parsedPrevBalance,
      previousBalanceDate: resolvedPrevBalanceDate,
      discount: parsedDiscount,
      varavu: parsedVaravu,
      cashReceived: parsedVaravu,
      closingBalance,
      billVersion: 'v3_new_6row',
      notes: notes || '',
      status: 'active',
      createdBy: req.user ? req.user._id : null,
    });

    // Update customer balance & record payment concurrently
    customer.currentBalance = closingBalance;
    customer.lastTransactionDate = bill.billDate;

    const postTasks = [customer.save()];

    if (parsedVaravu > 0) {
      postTasks.push(
        Payment.create({
          customer: customer._id,
          customerName: customer.name,
          bill: bill._id,
          amount: parsedVaravu,
          paymentDate: bill.billDate,
          paymentMode: 'Cash',
          remarks: `Varavu / Cash received for Bill #${billNumberFormatted}`,
          previousBalance: round2(total - parsedDiscount),
          resultingBalance: closingBalance,
          status: 'active',
          createdBy: req.user ? req.user._id : null,
        })
      );
    }

    await Promise.all(postTasks);

    // Asynchronous non-blocking background tasks
    const vegIds = processedItems
      .map((it) => it.vegetable)
      .filter((v) => v !== null);
    if (vegIds.length > 0) {
      Vegetable.updateMany({ _id: { $in: vegIds } }, { $inc: { usageCount: 1 } }).catch((err) =>
        console.warn('[Bill] Vegetable usageCount update notice:', err.message)
      );
    }

    AuditLog.create({
      action: 'create_bill',
      entityType: 'bill',
      entityId: bill._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      newState: bill.toObject(),
    }).catch((err) => console.warn('[Bill] Audit log notice:', err.message));

    // Construct response directly from in-memory records without extra database queries
    const responseBill = bill.toObject();
    responseBill.customer = {
      _id: customer._id,
      name: customer.name,
      tamilName: customer.tamilName,
      phone: customer.phone,
      address: customer.address,
      marketStall: customer.marketStall,
      currentBalance: customer.currentBalance,
    };
    responseBill.items = responseBill.items.map((it) => ({
      ...it,
      vegetable: it.vegetable && vegMap.has(it.vegetable.toString()) ? vegMap.get(it.vegetable.toString()) : it.vegetable,
    }));

    res.status(201).json({
      success: true,
      message: 'Bill created and saved permanently',
      data: responseBill,
    });
  } catch (error) {
    console.error('[Bill] createBill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update existing Bill and safely recalculate customer balance
// @route PUT /api/bills/:id
const updateBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    if (bill.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cancelled bills cannot be edited' });
    }

    // Concurrency / optimistic locking check
    if (req.body.version !== undefined && bill.version !== undefined) {
      if (Number(req.body.version) !== Number(bill.version)) {
        return res.status(409).json({
          success: false,
          message: 'This bill has been modified in another session. Please refresh and try again.',
        });
      }
    }

    const customer = await Customer.findById(bill.customer);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const previousBillState = bill.toObject();

    const {
      billDate,
      items,
      discount = 0,
      varavu,
      cashReceived = 0,
      notes = '',
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Bill must contain at least one vegetable item' });
    }

    const inputVegIds = items.filter((it) => it.vegetable).map((it) => it.vegetable);
    const vegDocs = await Vegetable.find({ _id: { $in: inputVegIds } }).select('_id name tamilName').lean();
    const vegMap = new Map();
    vegDocs.forEach((v) => vegMap.set(v._id.toString(), v));

    let totalBag = 0;
    let totalWeight = 0;
    let todayTotal = 0;

    const processedItems = items.map((item) => {
      const rate = round2(item.rate || 0);
      const bag = Number(item.bag) || 0;
      const weight = round2(item.weight || 0);
      const amount = round2(
        item.amount !== undefined && item.amount !== null
          ? item.amount
          : item.debit !== undefined && item.debit !== null
          ? item.debit
          : (rate * weight)
      );

      totalBag += bag;
      totalWeight = add2(totalWeight, weight);
      todayTotal = add2(todayTotal, amount);

      const matchedVeg = item.vegetable ? vegMap.get(item.vegetable.toString()) : null;
      const resolvedTamilName = (item.tamilName && item.tamilName.trim())
        ? item.tamilName.trim()
        : (matchedVeg && matchedVeg.tamilName ? matchedVeg.tamilName.trim() : '');

      return {
        vegetable: item.vegetable || null,
        particulars: item.particulars ? item.particulars.trim() : 'Vegetable',
        tamilName: resolvedTamilName,
        rate,
        bag,
        weight,
        amount,
        debit: amount,
        credit: 0,
      };
    });

    const parsedDiscount = Math.max(0, round2(discount || 0));
    const parsedVaravu = Math.max(
      0,
      round2(varavu !== undefined && varavu !== null && varavu !== '' ? varavu : (cashReceived || 0))
    );

    // Preserve the original previous balance recorded on the bill
    const parsedPrevBalance = round2(bill.previousBalance || 0);
    const total = round2(todayTotal + parsedPrevBalance);
    const closingBalance = round2(total - parsedDiscount - parsedVaravu);

    // Calculate balance difference to adjust customer current balance safely
    const oldClosingBalance = round2(bill.closingBalance || 0);
    const balanceDiff = round2(closingBalance - oldClosingBalance);

    bill.billDate = billDate ? new Date(billDate) : bill.billDate;
    bill.items = processedItems;
    bill.totalBag = totalBag;
    bill.totalWeight = totalWeight;
    bill.todayTotal = todayTotal;
    bill.grandTotal = total;
    bill.totalDebit = todayTotal;
    bill.discount = parsedDiscount;
    bill.varavu = parsedVaravu;
    bill.cashReceived = parsedVaravu;
    bill.closingBalance = closingBalance;
    bill.notes = notes !== undefined ? notes : bill.notes;
    bill.version = (bill.version || 1) + 1;

    await bill.save();

    // Chronologically recalculate subsequent bills for this customer if any exist
    const subsequentBills = await Bill.find({
      customer: customer._id,
      status: 'active',
      $or: [
        { billDate: { $gt: bill.billDate } },
        { billDate: bill.billDate, billNumber: { $gt: bill.billNumber } },
        { billDate: bill.billDate, _id: { $ne: bill._id }, createdAt: { $gt: bill.createdAt } },
      ],
    }).sort({ billDate: 1, billNumber: 1, createdAt: 1 });

    if (subsequentBills.length > 0) {
      let runningPrevBalance = closingBalance;
      let lastBillDate = bill.billDate;

      for (const subBill of subsequentBills) {
        // Find any standalone payments made by this customer between lastBillDate and subBill.billDate
        const standalonePayments = await Payment.find({
          customer: customer._id,
          status: 'active',
          bill: null,
          paymentDate: { $gt: lastBillDate, $lte: subBill.billDate },
        });
        const intermediateVaravu = standalonePayments.reduce((acc, p) => acc + (p.amount || 0), 0);
        runningPrevBalance = round2(runningPrevBalance - intermediateVaravu);

        subBill.previousBalance = runningPrevBalance;
        subBill.previousBalanceDate = lastBillDate;
        subBill.grandTotal = round2(subBill.todayTotal + runningPrevBalance);
        subBill.closingBalance = round2(
          subBill.grandTotal - (subBill.discount || 0) - (subBill.varavu || 0)
        );
        await subBill.save();

        runningPrevBalance = subBill.closingBalance;
        lastBillDate = subBill.billDate;
      }

      // Check any standalone payments after the last subsequent bill
      const trailingPayments = await Payment.find({
        customer: customer._id,
        status: 'active',
        bill: null,
        paymentDate: { $gt: lastBillDate },
      });
      const trailingVaravu = trailingPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
      customer.currentBalance = round2(runningPrevBalance - trailingVaravu);
    } else {
      customer.currentBalance = round2((customer.currentBalance || 0) + balanceDiff);
    }

    await customer.save();

    // Update or create linked payment
    const linkedPayment = await Payment.findOne({ bill: bill._id });
    if (parsedVaravu > 0) {
      if (linkedPayment) {
        linkedPayment.amount = parsedVaravu;
        linkedPayment.previousBalance = round2(total - parsedDiscount);
        linkedPayment.resultingBalance = closingBalance;
        await linkedPayment.save();
      } else {
        await Payment.create({
          customer: customer._id,
          customerName: customer.name,
          bill: bill._id,
          amount: parsedVaravu,
          paymentDate: bill.billDate,
          paymentMode: 'Cash',
          remarks: `Varavu / Cash received for Bill #${bill.billNumberFormatted}`,
          previousBalance: round2(total - parsedDiscount),
          resultingBalance: closingBalance,
          status: 'active',
          createdBy: req.user ? req.user._id : null,
        });
      }
    } else if (linkedPayment) {
      linkedPayment.status = 'voided';
      linkedPayment.remarks = 'Voided due to bill edit with 0 varavu';
      await linkedPayment.save();
    }

    AuditLog.create({
      action: 'update_bill',
      entityType: 'bill',
      entityId: bill._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      previousState: {
        billNumber: previousBillState.billNumber,
        billNumberFormatted: previousBillState.billNumberFormatted,
        billDate: previousBillState.billDate,
        customerName: previousBillState.customerName,
        todayTotal: previousBillState.todayTotal,
        grandTotal: previousBillState.grandTotal,
        closingBalance: previousBillState.closingBalance,
        discount: previousBillState.discount,
        varavu: previousBillState.varavu,
        itemCount: previousBillState.items?.length,
        items: (previousBillState.items || []).map((i) => ({
          particulars: i.particulars,
          tamilName: i.tamilName,
          rate: i.rate,
          bag: i.bag,
          weight: i.weight,
          amount: i.amount,
        })),
      },
      newState: {
        billNumber: bill.billNumber,
        billNumberFormatted: bill.billNumberFormatted,
        billDate: bill.billDate,
        customerName: bill.customerName,
        todayTotal: bill.todayTotal,
        grandTotal: bill.grandTotal,
        closingBalance: bill.closingBalance,
        discount: bill.discount,
        varavu: bill.varavu,
        balanceDiff,
        itemCount: bill.items?.length,
        items: bill.items.map((i) => ({
          particulars: i.particulars,
          tamilName: i.tamilName,
          rate: i.rate,
          bag: i.bag,
          weight: i.weight,
          amount: i.amount,
        })),
      },
    }).catch((err) => console.warn('[Bill] Audit log notice:', err.message));

    res.json({
      success: true,
      message: 'Bill updated successfully',
      data: bill,
    });
  } catch (error) {
    console.error('[Bill] updateBill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Cancel / Void a bill and reverse customer balance
// @route POST /api/bills/:id/cancel
const cancelBill = async (req, res) => {
  try {
    const { reason = 'Cancelled by administrator' } = req.body;

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    if (bill.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Bill is already cancelled' });
    }

    const customer = await Customer.findById(bill.customer);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const previousBillState = bill.toObject();

    // Reversal logic:
    // When bill was created: customer balance became closingBalance = previousBalance + todayTotal - discount - varavu
    // Net effect on balance was: todayTotal - discount - varavu
    // To reverse: newBalance = currentBalance - (todayTotal - discount - varavu)
    const netEffect = round2((bill.todayTotal || bill.totalDebit || 0) - (bill.discount || 0) - (bill.varavu || bill.cashReceived || 0));
    customer.currentBalance = round2(customer.currentBalance - netEffect);

    bill.status = 'cancelled';
    bill.cancellationReason = reason;

    // Void linked payment if exists
    const paymentUpdate = Payment.updateMany(
      { bill: bill._id },
      { $set: { status: 'voided', remarks: `Voided due to Bill #${bill.billNumberFormatted} cancellation: ${reason}` } }
    );

    await Promise.all([bill.save(), customer.save(), paymentUpdate]);

    AuditLog.create({
      action: 'cancel_bill',
      entityType: 'bill',
      entityId: bill._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      previousState: previousBillState,
      newState: bill.toObject(),
    }).catch((err) => console.warn('[Bill] Audit log notice:', err.message));

    res.json({
      success: true,
      message: `Bill #${bill.billNumberFormatted} cancelled successfully`,
      data: bill,
      newCustomerBalance: customer.currentBalance,
    });
  } catch (error) {
    console.error('[Bill] cancelBill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getNextBillNumber,
  getBills,
  getBillById,
  createBill,
  updateBill,
  cancelBill,
};

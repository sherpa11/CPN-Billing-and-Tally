const Purchase = require('../models/Purchase');
const Supplier = require('../models/Supplier');
const Vegetable = require('../models/Vegetable');
const SupplierPayment = require('../models/SupplierPayment');
const Settings = require('../models/Settings');
const { round2, add2, sub2 } = require('../utils/mathUtils');

// @desc Get next sequential purchase bill number
// @route GET /api/purchases/next-number
const getNextPurchaseNumber = async (req, res) => {
  try {
    const latestPurchase = await Purchase.findOne().sort({ purchaseNumber: -1 }).select('purchaseNumber').lean();
    const nextNum = latestPurchase && latestPurchase.purchaseNumber ? latestPurchase.purchaseNumber + 1 : 1;
    const formatted = `PUR-${String(nextNum).padStart(4, '0')}`;

    res.json({
      success: true,
      nextPurchaseNumber: nextNum,
      formattedPurchaseNumber: formatted,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all purchases with filters & pagination
// @route GET /api/purchases
const getPurchases = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      supplier,
      search,
      status = 'active',
      page = 1,
      limit = 25,
    } = req.query;

    let query = {};
    if (status !== 'all') {
      query.status = status;
    }

    if (supplier) {
      query.supplier = supplier;
    }

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) {
        query.purchaseDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = end;
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
      query.$or = orClauses;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, purchases] = await Promise.all([
      Purchase.countDocuments(query),
      Purchase.find(query)
        .select(
          'purchaseNumber purchaseNumberFormatted supplier supplierName supplierPhone purchaseDate totalBag totalWeight todayTotal grandTotal totalDebit discount varavu cashPaid closingBalance status notes createdAt'
        )
        .populate('supplier', 'name tamilName phone currentBalance')
        .sort({ purchaseDate: -1, purchaseNumber: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    res.json({
      success: true,
      count: purchases.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: purchases,
    });
  } catch (error) {
    console.error('[Purchase] getPurchases error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single purchase by ID
// @route GET /api/purchases/:id
const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier', 'name tamilName phone address currentBalance')
      .populate('items.vegetable', 'name tamilName defaultRate unit')
      .lean();

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase bill not found' });
    }

    const purchaseObj = { ...purchase };
    if (!purchaseObj.grandTotal && purchaseObj.todayTotal) {
      purchaseObj.grandTotal = round2((purchaseObj.todayTotal || 0) + (purchaseObj.previousBalance || 0));
    }
    if (!purchaseObj.billVersion) {
      purchaseObj.billVersion = 'v3_new_6row';
    }
    if (purchaseObj.discount === undefined || purchaseObj.discount === null) {
      purchaseObj.discount = 0;
    }
    if (purchaseObj.varavu === undefined || purchaseObj.varavu === null) {
      purchaseObj.varavu = purchaseObj.cashPaid || 0;
    }

    // Resolve Tamil vegetable names from master
    const allVegetables = await Vegetable.find({}).select('_id name normalizedName tamilName').lean();
    const vegById = new Map();
    const vegByName = new Map();
    for (const v of allVegetables) {
      vegById.set(v._id.toString(), v);
      if (v.name) vegByName.set(v.name.trim().toLowerCase(), v);
      if (v.normalizedName) vegByName.set(v.normalizedName, v);
    }

    purchaseObj.items = (purchaseObj.items || []).map((it) => {
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

    res.json({ success: true, data: purchaseObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create a new purchase bill
// @route POST /api/purchases
const createPurchase = async (req, res) => {
  try {
    const {
      supplierId,
      supplier: supplierField,
      supplierName,
      supplierPhone,
      purchaseDate,
      items,
      previousBalance,
      previousBalanceDate,
      discount = 0,
      varavu,
      cashPaid = 0,
      notes = '',
    } = req.body;

    const resolvedSupplierId = supplierId || supplierField;

    if (!resolvedSupplierId && !supplierName) {
      return res.status(400).json({ success: false, message: 'Supplier information is required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Purchase bill must contain at least one vegetable item' });
    }

    const inputVegIds = items.filter((it) => it.vegetable).map((it) => it.vegetable);

    const [latestPurchase, resolvedSupplier, vegDocs, lastSuppPurchase] = await Promise.all([
      Purchase.findOne().sort({ purchaseNumber: -1 }).select('purchaseNumber').lean(),
      resolvedSupplierId ? Supplier.findById(resolvedSupplierId) : null,
      inputVegIds.length > 0
        ? Vegetable.find({ _id: { $in: inputVegIds } }).select('_id name tamilName defaultRate unit').lean()
        : [],
      resolvedSupplierId && !previousBalanceDate
        ? Purchase.findOne({ supplier: resolvedSupplierId, status: 'active' })
            .sort({ purchaseDate: -1, purchaseNumber: -1 })
            .select('purchaseDate')
            .lean()
        : null,
    ]);

    let supplier = resolvedSupplier;
    if (!supplier && supplierName) {
      supplier = await Supplier.create({
        name: supplierName.trim(),
        phone: supplierPhone ? supplierPhone.trim() : '',
        openingBalance: 0,
        currentBalance: 0,
      });
    }

    if (!supplier) {
      return res.status(400).json({ success: false, message: 'Supplier could not be resolved' });
    }

    const purchaseNumber = latestPurchase && latestPurchase.purchaseNumber ? latestPurchase.purchaseNumber + 1 : 1;
    const purchaseNumberFormatted = `PUR-${String(purchaseNumber).padStart(4, '0')}`;

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
      round2(varavu !== undefined && varavu !== null && varavu !== '' ? varavu : (cashPaid || 0))
    );
    const parsedPrevBalance = round2(
      previousBalance !== undefined && previousBalance !== null
        ? previousBalance
        : (supplier.currentBalance || 0)
    );

    let resolvedPrevBalanceDate = previousBalanceDate ? new Date(previousBalanceDate) : null;
    if (!resolvedPrevBalanceDate) {
      if (lastSuppPurchase && lastSuppPurchase.purchaseDate) {
        resolvedPrevBalanceDate = lastSuppPurchase.purchaseDate;
      } else if (supplier.lastTransactionDate) {
        resolvedPrevBalanceDate = supplier.lastTransactionDate;
      } else if (supplier.createdAt) {
        resolvedPrevBalanceDate = supplier.createdAt;
      }
    }

    const total = round2(todayTotal + parsedPrevBalance);
    const closingBalance = round2(total - parsedDiscount - parsedVaravu);

    const purchase = await Purchase.create({
      purchaseNumber,
      purchaseNumberFormatted,
      supplier: supplier._id,
      supplierName: supplier.name,
      supplierPhone: supplier.phone,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
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
      cashPaid: parsedVaravu,
      closingBalance,
      billVersion: 'v3_new_6row',
      notes: notes || '',
      status: 'active',
      createdBy: req.user ? req.user._id : null,
    });

    supplier.currentBalance = closingBalance;
    supplier.lastTransactionDate = purchase.purchaseDate;

    const postTasks = [supplier.save()];

    if (parsedVaravu > 0) {
      const latestPay = await SupplierPayment.findOne().sort({ paymentNumber: -1 }).select('paymentNumber').lean();
      const nextPaymentNumber = latestPay && latestPay.paymentNumber ? latestPay.paymentNumber + 1 : 1;

      postTasks.push(
        SupplierPayment.create({
          paymentNumber: nextPaymentNumber,
          supplier: supplier._id,
          supplierName: supplier.name,
          purchase: purchase._id,
          amount: parsedVaravu,
          paymentDate: purchase.purchaseDate,
          paymentMode: 'Cash',
          remarks: `Settlement / Varavu for Purchase #${purchaseNumberFormatted}`,
          previousBalance: round2(total - parsedDiscount),
          resultingBalance: closingBalance,
          status: 'active',
          createdBy: req.user ? req.user._id : null,
        })
      );
    }

    await Promise.all(postTasks);

    res.status(201).json({
      success: true,
      message: 'Purchase bill created successfully',
      data: purchase,
      supplierBalance: closingBalance,
    });
  } catch (error) {
    console.error('[Purchase] createPurchase error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update existing purchase bill with safe ledger recalculation & cascading
// @route PUT /api/purchases/:id
const updatePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase bill not found' });
    }

    if (purchase.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot edit a cancelled purchase bill' });
    }

    const supplier = await Supplier.findById(purchase.supplier);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Associated supplier not found' });
    }

    const {
      purchaseDate,
      items,
      discount = 0,
      varavu,
      cashPaid = 0,
      notes = '',
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Purchase bill must contain at least one vegetable item' });
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
      round2(varavu !== undefined && varavu !== null && varavu !== '' ? varavu : (cashPaid || 0))
    );

    const parsedPrevBalance = round2(purchase.previousBalance || 0);
    const total = round2(todayTotal + parsedPrevBalance);
    const closingBalance = round2(total - parsedDiscount - parsedVaravu);

    purchase.purchaseDate = purchaseDate ? new Date(purchaseDate) : purchase.purchaseDate;
    purchase.items = processedItems;
    purchase.totalBag = totalBag;
    purchase.totalWeight = totalWeight;
    purchase.todayTotal = todayTotal;
    purchase.grandTotal = total;
    purchase.totalDebit = todayTotal;
    purchase.discount = parsedDiscount;
    purchase.varavu = parsedVaravu;
    purchase.cashPaid = parsedVaravu;
    purchase.closingBalance = closingBalance;
    purchase.notes = notes !== undefined ? notes : purchase.notes;
    purchase.version = (purchase.version || 1) + 1;

    await purchase.save();

    // Cascading: recalculate any subsequent purchases for this supplier
    const subsequentPurchases = await Purchase.find({
      supplier: supplier._id,
      status: 'active',
      $or: [
        { purchaseDate: { $gt: purchase.purchaseDate } },
        { purchaseDate: purchase.purchaseDate, purchaseNumber: { $gt: purchase.purchaseNumber } },
        { purchaseDate: purchase.purchaseDate, _id: { $ne: purchase._id }, createdAt: { $gt: purchase.createdAt } },
      ],
    }).sort({ purchaseDate: 1, purchaseNumber: 1, createdAt: 1 });

    if (subsequentPurchases.length > 0) {
      let runningPrevBalance = closingBalance;
      let lastPurchaseDate = purchase.purchaseDate;

      for (const subPurch of subsequentPurchases) {
        const intermediatePayments = await SupplierPayment.find({
          supplier: supplier._id,
          status: 'active',
          purchase: null,
          paymentDate: { $gt: lastPurchaseDate, $lte: subPurch.purchaseDate },
        }).lean();

        for (const p of intermediatePayments) {
          runningPrevBalance = round2(runningPrevBalance - (p.amount || 0));
        }

        const subTodayTotal = round2(subPurch.todayTotal || 0);
        const subDiscount = round2(subPurch.discount || 0);
        const subVaravu = round2(subPurch.varavu || 0);
        const subTotal = round2(subTodayTotal + runningPrevBalance);
        const subClosing = round2(subTotal - subDiscount - subVaravu);

        subPurch.previousBalance = runningPrevBalance;
        subPurch.previousBalanceDate = lastPurchaseDate;
        subPurch.grandTotal = subTotal;
        subPurch.closingBalance = subClosing;
        await subPurch.save();

        runningPrevBalance = subClosing;
        lastPurchaseDate = subPurch.purchaseDate;
      }

      const finalPayments = await SupplierPayment.find({
        supplier: supplier._id,
        status: 'active',
        purchase: null,
        paymentDate: { $gt: lastPurchaseDate },
      }).lean();

      for (const p of finalPayments) {
        runningPrevBalance = round2(runningPrevBalance - (p.amount || 0));
      }

      supplier.currentBalance = runningPrevBalance;
    } else {
      const finalPayments = await SupplierPayment.find({
        supplier: supplier._id,
        status: 'active',
        purchase: null,
        paymentDate: { $gt: purchase.purchaseDate },
      }).lean();

      let running = closingBalance;
      for (const p of finalPayments) {
        running = round2(running - (p.amount || 0));
      }
      supplier.currentBalance = running;
    }

    // Update associated settlement payment if present
    const assocPayment = await SupplierPayment.findOne({ purchase: purchase._id, status: 'active' });
    if (assocPayment) {
      if (parsedVaravu > 0) {
        assocPayment.amount = parsedVaravu;
        assocPayment.resultingBalance = closingBalance;
        assocPayment.previousBalance = round2(total - parsedDiscount);
        await assocPayment.save();
      } else {
        assocPayment.status = 'voided';
        await assocPayment.save();
      }
    } else if (parsedVaravu > 0) {
      const latestPay = await SupplierPayment.findOne().sort({ paymentNumber: -1 }).select('paymentNumber').lean();
      const nextPaymentNumber = latestPay && latestPay.paymentNumber ? latestPay.paymentNumber + 1 : 1;
      await SupplierPayment.create({
        paymentNumber: nextPaymentNumber,
        supplier: supplier._id,
        supplierName: supplier.name,
        purchase: purchase._id,
        amount: parsedVaravu,
        paymentDate: purchase.purchaseDate,
        paymentMode: 'Cash',
        remarks: `Settlement / Varavu for Purchase #${purchase.purchaseNumberFormatted}`,
        previousBalance: round2(total - parsedDiscount),
        resultingBalance: closingBalance,
        status: 'active',
        createdBy: req.user ? req.user._id : null,
      });
    }

    await supplier.save();

    res.json({
      success: true,
      message: 'Purchase bill updated successfully',
      data: purchase,
      supplierBalance: supplier.currentBalance,
    });
  } catch (error) {
    console.error('[Purchase] updatePurchase error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Cancel purchase bill
// @route PUT /api/purchases/:id/cancel
const cancelPurchase = async (req, res) => {
  try {
    const { reason = 'Cancelled by user' } = req.body;
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase bill not found' });
    }

    if (purchase.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Purchase bill is already cancelled' });
    }

    const supplier = await Supplier.findById(purchase.supplier);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    purchase.status = 'cancelled';
    purchase.cancellationReason = reason;
    await purchase.save();

    // Void associated varavu payment
    await SupplierPayment.updateMany({ purchase: purchase._id }, { status: 'voided' });

    // Recompute supplier balance from active purchases and payments
    const [allActivePurchases, allActivePayments] = await Promise.all([
      Purchase.find({ supplier: supplier._id, status: 'active' }).sort({ purchaseDate: 1, purchaseNumber: 1 }).lean(),
      SupplierPayment.find({ supplier: supplier._id, status: 'active', purchase: null }).sort({ paymentDate: 1 }).lean(),
    ]);

    let running = round2(supplier.openingBalance || 0);
    const events = [
      ...allActivePurchases.map((p) => ({
        date: p.purchaseDate,
        type: 'PURCHASE',
        effect: round2((p.todayTotal || 0) - (p.discount || 0) - (p.varavu || 0)),
      })),
      ...allActivePayments.map((p) => ({
        date: p.paymentDate,
        type: 'PAYMENT',
        effect: -round2(p.amount || 0),
      })),
    ];
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    for (const ev of events) {
      running = round2(running + ev.effect);
    }

    supplier.currentBalance = running;
    await supplier.save();

    res.json({
      success: true,
      message: 'Purchase bill cancelled successfully',
      supplierBalance: supplier.currentBalance,
    });
  } catch (error) {
    console.error('[Purchase] cancelPurchase error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getNextPurchaseNumber,
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  cancelPurchase,
};

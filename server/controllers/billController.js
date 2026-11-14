const Bill = require('../models/Bill');
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
    const settings = await Settings.findOne() || { billPrefix: 'CPN' };
    const latestBill = await Bill.findOne().sort({ billNumber: -1 });
    const nextNum = latestBill && latestBill.billNumber ? latestBill.billNumber + 1 : 1;
    const formatted = `${settings.billPrefix || 'CPN'}-${String(nextNum).padStart(4, '0')}`;

    res.json({
      success: true,
      nextBillNumber: nextNum,
      formattedBillNumber: formatted,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all bills with filters & pagination
// @route GET /api/bills
const getBills = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      customer,
      search,
      status = 'active',
      page = 1,
      limit = 20,
    } = req.query;

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

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [total, bills] = await Promise.all([
      Bill.countDocuments(query),
      Bill.find(query)
        .populate('customer', 'name tamilName phone address marketStall currentBalance')
        .populate('items.vegetable', 'name tamilName defaultRate unit')
        .sort({ billDate: -1, billNumber: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    res.json({
      success: true,
      count: bills.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: bills,
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
      .populate('items.vegetable', 'name tamilName defaultRate unit');

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const billObj = bill.toObject();
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
    const allVegetables = await Vegetable.find({}).lean();
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

// @desc Create a new Bill
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

    // Find or create customer
    let customer;
    if (resolvedCustomerId) {
      customer = await Customer.findById(resolvedCustomerId);
    }
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

    // Calculate sequential bill number atomically
    const latestBill = await Bill.findOne().sort({ billNumber: -1 });
    const billNumber = latestBill && latestBill.billNumber ? latestBill.billNumber + 1 : 1;
    const settings = await Settings.findOne() || { billPrefix: 'CPN' };
    const billNumberFormatted = `${settings.billPrefix || 'CPN'}-${String(billNumber).padStart(4, '0')}`;

    // Process and validate items for 5-column bill
    let totalBag = 0;
    let totalWeight = 0;
    let todayTotal = 0;

    // Fetch vegetable docs to resolve Tamil names accurately
    const inputVegIds = items.filter((it) => it.vegetable).map((it) => it.vegetable);
    const vegDocs = await Vegetable.find({ _id: { $in: inputVegIds } }).lean();
    const vegMap = new Map();
    vegDocs.forEach((v) => vegMap.set(v._id.toString(), v));

    const processedItems = items.map((item) => {
      const rate = round2(item.rate || 0);
      const bag = Number(item.bag) || 0;
      const weight = round2(item.weight || 0);
      // In 5-column design: amount = rate * weight (or explicit amount if provided)
      let amount = round2(
        item.amount !== undefined && item.amount !== null
          ? item.amount
          : item.debit !== undefined && item.debit !== null
          ? item.debit
          : (rate * weight)
      );
      // Backward compatibility fields
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
      const lastCustBill = await Bill.findOne({ customer: customer._id, status: 'active' }).sort({ billDate: -1, billNumber: -1 });
      if (lastCustBill && lastCustBill.billDate) {
        resolvedPrevBalanceDate = lastCustBill.billDate;
      } else if (customer.lastTransactionDate) {
        resolvedPrevBalanceDate = customer.lastTransactionDate;
      } else if (customer.createdAt) {
        resolvedPrevBalanceDate = customer.createdAt;
      }
    }

    // EXACT NEW 6-ROW SUMMARY ACCOUNTING LOGIC (Matching Authoritative Reference):
    // 1. இன்றைய மொத்தம் (Today's Total) = Sum of all vegetable row amounts
    // 2. முன் பாக்கி (Previous Balance) = Customer's carried-forward balance (with date)
    // 3. மொத்தம் (Total) = Today's Total + Previous Balance
    // 4. தள்ளுபடி (Discount) = User-entered discount amount
    // 5. வரவு (Varavu) = Cash/payment received from customer today
    // 6. மொத்த பாக்கி (Final Outstanding Balance) = Total - Discount - Varavu
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
      grandTotal: total, // represents மொத்தம் = todayTotal + previousBalance
      totalDebit: todayTotal, // Backward compatibility
      totalCredit: 0,
      previousBalance: parsedPrevBalance,
      previousBalanceDate: resolvedPrevBalanceDate,
      discount: parsedDiscount,
      varavu: parsedVaravu,
      cashReceived: parsedVaravu, // synced for backward compatibility
      closingBalance,
      billVersion: 'v3_new_6row',
      notes: notes || '',
      status: 'active',
      createdBy: req.user ? req.user._id : null,
    });

    // Update customer current balance
    customer.currentBalance = closingBalance;
    customer.lastTransactionDate = bill.billDate;
    await customer.save();

    // If varavu > 0, record exactly ONE linked Payment document
    if (parsedVaravu > 0) {
      await Payment.create({
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
      });
    }

    // Increment usageCount for vegetables
    const vegIds = processedItems
      .map((it) => it.vegetable)
      .filter((v) => v !== null);
    if (vegIds.length > 0) {
      await Vegetable.updateMany({ _id: { $in: vegIds } }, { $inc: { usageCount: 1 } });
    }

    // Audit log
    await AuditLog.create({
      action: 'create_bill',
      entityType: 'bill',
      entityId: bill._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      newState: bill.toObject(),
    });

    const populatedBill = await Bill.findById(bill._id)
      .populate('customer', 'name tamilName phone address marketStall currentBalance')
      .populate('items.vegetable', 'name tamilName defaultRate unit');

    res.status(201).json({
      success: true,
      message: 'Bill created and saved permanently',
      data: populatedBill || bill,
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
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Bill must contain at least one item' });
    }

    // 1. Calculate old bill effect on customer balance: todayTotal - discount - varavu
    const oldTodayTotal = bill.todayTotal !== undefined ? bill.todayTotal : bill.totalDebit;
    const oldDiscount = bill.discount || 0;
    const oldVaravu = bill.varavu !== undefined ? bill.varavu : (bill.cashReceived || 0);
    const oldEffect = round2(oldTodayTotal - oldDiscount - oldVaravu);

    // 2. Process new items
    let totalBag = 0;
    let totalWeight = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const processedItems = items.map((item) => {
      const rate = round2(item.rate || 0);
      const bag = Number(item.bag) || 0;
      const weight = round2(item.weight || 0);
      let debit = round2(item.debit !== undefined && item.debit !== null ? item.debit : (rate * weight));
      const credit = round2(item.credit || 0);

      totalBag += bag;
      totalWeight = add2(totalWeight, weight);
      totalDebit = add2(totalDebit, debit);
      totalCredit = add2(totalCredit, credit);

      return {
        vegetable: item.vegetable || null,
        particulars: item.particulars ? item.particulars.trim() : 'Vegetable',
        tamilName: item.tamilName ? item.tamilName.trim() : '',
        rate,
        bag,
        weight,
        amount: debit,
        debit,
        credit,
      };
    });

    const parsedDiscount = Math.max(0, round2(discount !== undefined ? discount : oldDiscount));
    const parsedVaravu = Math.max(
      0,
      round2(varavu !== undefined && varavu !== null && varavu !== '' ? varavu : (cashReceived || oldVaravu))
    );
    const newEffect = round2(totalDebit - parsedDiscount - parsedVaravu);

    // 3. Update customer's current balance: revert oldEffect, apply newEffect
    const balanceDifference = round2(newEffect - oldEffect);
    customer.currentBalance = round2(customer.currentBalance + balanceDifference);
    await customer.save();

    // 4. Update Bill fields
    bill.items = processedItems;
    bill.totalBag = totalBag;
    bill.totalWeight = totalWeight;
    bill.totalDebit = totalDebit;
    bill.totalCredit = totalCredit;
    bill.todayTotal = totalDebit;
    bill.grandTotal = round2(totalDebit + bill.previousBalance);
    bill.discount = parsedDiscount;
    bill.varavu = parsedVaravu;
    bill.cashReceived = parsedVaravu;
    bill.closingBalance = round2(bill.grandTotal - parsedDiscount - parsedVaravu);
    if (billDate) bill.billDate = new Date(billDate);
    if (notes !== undefined) bill.notes = notes;
    bill.version = (bill.version || 1) + 1;

    await bill.save();

    // 5. Update or sync linked Payment
    let linkedPayment = await Payment.findOne({ bill: bill._id });
    if (parsedVaravu > 0) {
      if (linkedPayment) {
        linkedPayment.amount = parsedVaravu;
        linkedPayment.paymentDate = bill.billDate;
        linkedPayment.status = 'active';
        await linkedPayment.save();
      } else {
        await Payment.create({
          customer: customer._id,
          customerName: customer.name,
          bill: bill._id,
          amount: parsedVaravu,
          paymentDate: bill.billDate,
          paymentMode: 'Cash',
          remarks: `Varavu / Cash received for Bill #${bill.billNumberFormatted || bill.billNumber}`,
          status: 'active',
          createdBy: req.user ? req.user._id : null,
        });
      }
    } else if (linkedPayment) {
      linkedPayment.status = 'voided';
      await linkedPayment.save();
    }

    // 6. Audit log
    await AuditLog.create({
      action: 'update_bill',
      entityType: 'bill',
      entityId: bill._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      previousState: previousBillState,
      newState: bill.toObject(),
    });

    res.json({
      success: true,
      message: 'Bill updated and customer balance recalculated safely',
      data: bill,
    });
  } catch (error) {
    console.error('[Bill] updateBill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Cancel / Void a Bill and reverse customer balance
// @route POST /api/bills/:id/cancel
const cancelBill = async (req, res) => {
  try {
    const { reason } = req.body;
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    if (bill.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Bill is already cancelled' });
    }

    const customer = await Customer.findById(bill.customer);
    if (customer) {
      // Revert bill effect: todayTotal - discount - varavu
      const billToday = bill.todayTotal !== undefined ? bill.todayTotal : bill.totalDebit;
      const billDiscount = bill.discount || 0;
      const billVaravu = bill.varavu !== undefined ? bill.varavu : (bill.cashReceived || 0);
      const effect = round2(billToday - billDiscount - billVaravu);
      customer.currentBalance = round2(customer.currentBalance - effect);
      await customer.save();
    }

    bill.status = 'cancelled';
    bill.cancellationReason = reason || 'Cancelled by admin';
    await bill.save();

    // Void any linked payment
    await Payment.updateMany({ bill: bill._id }, { status: 'voided' });

    await AuditLog.create({
      action: 'cancel_bill',
      entityType: 'bill',
      entityId: bill._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      notes: reason || 'Cancelled',
    });

    res.json({
      success: true,
      message: 'Bill cancelled and balance reversed',
      data: bill,
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

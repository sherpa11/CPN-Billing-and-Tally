const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');
const { round2, sub2, add2 } = require('../utils/mathUtils');

// @desc Create standalone payment entry
// @route POST /api/payments
const createPayment = async (req, res) => {
  try {
    const {
      customerId,
      customer: customerField,
      amount,
      paymentDate,
      paymentMode = 'Cash',
      referenceNumber = '',
      remarks = '',
    } = req.body;

    const resolvedCustomerId = customerId || customerField;

    if (!resolvedCustomerId) {
      return res.status(400).json({ success: false, message: 'Customer ID is required' });
    }

    const parsedAmount = round2(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero' });
    }

    const customer = await Customer.findById(resolvedCustomerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Determine sequential payment number
    const latestPayment = await Payment.findOne().sort({ paymentNumber: -1 });
    const paymentNumber = latestPayment && latestPayment.paymentNumber ? latestPayment.paymentNumber + 1 : 1;

    const previousBalance = round2(customer.currentBalance);
    // Customer pays money -> reduces outstanding debit balance
    const resultingBalance = round2(previousBalance - parsedAmount);

    const payment = await Payment.create({
      paymentNumber,
      customer: customer._id,
      customerName: customer.name,
      amount: parsedAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMode,
      referenceNumber: referenceNumber ? referenceNumber.trim() : '',
      remarks: remarks ? remarks.trim() : '',
      previousBalance,
      resultingBalance,
      status: 'active',
      createdBy: req.user ? req.user._id : null,
    });

    // Update customer current balance
    customer.currentBalance = resultingBalance;
    customer.lastTransactionDate = payment.paymentDate;
    await customer.save();

    await AuditLog.create({
      action: 'create_payment',
      entityType: 'payment',
      entityId: payment._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      newState: payment.toObject(),
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment,
      newCustomerBalance: resultingBalance,
    });
  } catch (error) {
    console.error('[Payment] createPayment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all payments with filters
// @route GET /api/payments
const getPayments = async (req, res) => {
  try {
    const {
      customerId,
      customer: customerQuery,
      startDate,
      endDate,
      paymentMode,
      page = 1,
      limit = 30,
    } = req.query;

    let query = { status: 'active' };

    const resolvedCustomerFilter = customerId || customerQuery;
    if (resolvedCustomerFilter) query.customer = resolvedCustomerFilter;
    if (paymentMode) query.paymentMode = paymentMode;

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.paymentDate.$lte = end;
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [total, payments] = await Promise.all([
      Payment.countDocuments(query),
      Payment.find(query)
        .populate('customer', 'name phone address currentBalance')
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    res.json({
      success: true,
      count: payments.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: payments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Void / cancel payment and restore customer balance
// @route POST /api/payments/:id/void
const voidPayment = async (req, res) => {
  try {
    const { reason } = req.body;
    const payment = await Payment.findById(req.params.id);

    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status === 'voided') {
      return res.status(400).json({ success: false, message: 'Payment is already voided' });
    }

    const customer = await Customer.findById(payment.customer);
    if (customer) {
      // Revert payment: add amount back to customer balance
      customer.currentBalance = round2(customer.currentBalance + payment.amount);
      await customer.save();
    }

    payment.status = 'voided';
    payment.remarks = `${payment.remarks || ''} [VOIDED: ${reason || 'By admin'}]`.trim();
    await payment.save();

    await AuditLog.create({
      action: 'void_payment',
      entityType: 'payment',
      entityId: payment._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      notes: reason || 'Voided payment',
    });

    res.json({
      success: true,
      message: 'Payment voided and customer balance adjusted',
      data: payment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createPayment,
  getPayments,
  voidPayment,
};

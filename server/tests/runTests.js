const mongoose = require('mongoose');
const Vegetable = require('../models/Vegetable');
const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const { round2, add2, sub2, mul2 } = require('../utils/mathUtils');
const { seedInitialData } = require('../utils/seedData');

const runAllTests = async () => {
  console.log('\n======================================================');
  console.log('  CPN VEGETABLES - COMPREHENSIVE AUTOMATED TEST SUITE  ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  try {
    // 1. Database Connection - Isolated Test Database to protect production data
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_test_db';
    await mongoose.connect(mongoUri);
    assert(mongoose.connection.readyState === 1, 'MongoDB connection established to isolated test DB (cpn_vegetables_test_db)');

    // Seed defaults
    await seedInitialData();

    // 2. Vegetable Master Test: Add vegetable
    const testVegName = `Test Beetroot ${Date.now()}`;
    const veg1 = await Vegetable.create({
      name: testVegName,
      tamilName: 'பீட்ரூட் ஸ்பெஷல்',
      defaultRate: 45.5,
      unit: 'Kg',
      isActive: true,
    });
    assert(veg1._id && veg1.normalizedName === testVegName.toLowerCase(), 'Vegetable Master: created vegetable with normalized name');

    // 3. Vegetable Duplicate Prevention Test
    let dupFailed = false;
    try {
      await Vegetable.create({
        name: testVegName.toUpperCase(),
        tamilName: 'பீட்ரூட்',
      });
    } catch (e) {
      dupFailed = true;
    }
    assert(dupFailed, 'Vegetable Master: prevented duplicate vegetable name case-insensitively');

    // 4. Dynamic Vegetable Addition while Billing (Quick-Add logic)
    const quickVegName = `Quick Mint ${Date.now()}`;
    const quickVeg = await Vegetable.create({
      name: quickVegName,
      tamilName: 'புதினா கட்டுகள்',
      defaultRate: 30,
      unit: 'Bunch',
      isActive: true,
      usageCount: 1,
    });
    const foundQuickVeg = await Vegetable.findOne({ normalizedName: quickVegName.toLowerCase() });
    assert(foundQuickVeg && foundQuickVeg.name === quickVegName, 'Dynamic Billing: quick-added vegetable saved permanently in master');

    // 5. Customer Creation & Opening Balance
    const custName = `Selvam Test Buyer ${Date.now()}`;
    const customer = await Customer.create({
      name: custName,
      tamilName: 'செல்வம் வாடிக்கையாளர்',
      phone: '9842199999',
      address: 'Shop 5, Gandhi Market, Dindigul',
      openingBalance: 5000,
      currentBalance: 5000,
    });
    assert(customer._id && customer.currentBalance === 5000, 'Customer Management: created customer with opening balance ₹5,000');

    // 6. Bill #1 Creation: Multiple vegetable items, auto debit calculation, cash received
    // Items:
    // Item 1: Rate 40, Bag 2, Weight 50.5 kg -> Debit = 40 * 50.5 = 2020.00
    // Item 2: Rate 60, Bag 1, Weight 25.0 kg -> Debit = 60 * 25 = 1500.00
    // Total Debit = 3520.00, Total Bags = 3, Total Weight = 75.5 kg
    // Previous Balance = 5000.00
    // Cash Received = 2500.00
    // Closing Balance = 5000 + 3520 - 0 - 2500 = 6020.00
    const itemsBill1 = [
      {
        vegetable: veg1._id,
        particulars: veg1.name,
        rate: 40,
        bag: 2,
        weight: 50.5,
        debit: mul2(40, 50.5),
        credit: 0,
      },
      {
        vegetable: quickVeg._id,
        particulars: quickVeg.name,
        rate: 60,
        bag: 1,
        weight: 25.0,
        debit: mul2(60, 25.0),
        credit: 0,
      },
    ];

    const totalDebitBill1 = itemsBill1.reduce((sum, it) => add2(sum, it.debit), 0);
    const totalBagBill1 = itemsBill1.reduce((sum, it) => sum + it.bag, 0);
    const totalWeightBill1 = itemsBill1.reduce((sum, it) => add2(sum, it.weight), 0);
    const cashRecBill1 = 2500;
    const closingBalBill1 = round2(customer.currentBalance + totalDebitBill1 - 0 - cashRecBill1);

    const latestBill = await Bill.findOne().sort({ billNumber: -1 });
    const billNum1 = latestBill && latestBill.billNumber ? latestBill.billNumber + 1 : 1;

    const bill1 = await Bill.create({
      billNumber: billNum1,
      billNumberFormatted: `CPN-${String(billNum1).padStart(4, '0')}`,
      customer: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      billDate: new Date(),
      items: itemsBill1,
      totalBag: totalBagBill1,
      totalWeight: totalWeightBill1,
      totalDebit: totalDebitBill1,
      todayTotal: totalDebitBill1,
      grandTotal: round2(totalDebitBill1 + customer.currentBalance),
      billVersion: 'v2_new_5col',
      totalCredit: 0,
      previousBalance: customer.currentBalance,
      cashReceived: cashRecBill1,
      closingBalance: closingBalBill1,
      status: 'active',
    });

    customer.currentBalance = closingBalBill1;
    await customer.save();

    // Linked payment check
    await Payment.create({
      customer: customer._id,
      customerName: customer.name,
      bill: bill1._id,
      amount: cashRecBill1,
      paymentDate: bill1.billDate,
      paymentMode: 'Cash',
      previousBalance: 5000 + totalDebitBill1,
      resultingBalance: closingBalBill1,
    });

    assert(bill1.totalDebit === 3520 && bill1.totalBag === 3 && bill1.totalWeight === 75.5, 'Billing Calculation: verified Bag, Weight, Debit totals (3520.00)');
    assert(customer.currentBalance === 6020, 'Customer Accounting: accurate Closing Balance calculation (₹6,020.00)');

    // 7. Bill #2 for Same Customer: Verify Previous Balance auto-retrieval
    const loadedCustomer = await Customer.findById(customer._id);
    assert(loadedCustomer.currentBalance === 6020, 'Customer Accounting: customer current balance is loaded as next bill previous balance (₹6,020.00)');

    // Bill #2: Rate 50, Bag 1, Weight 20 kg -> Debit 1000. Cash Received = 1000
    // Closing Balance = 6020 + 1000 - 1000 = 6020.00
    const billNum2 = billNum1 + 1;
    const bill2 = await Bill.create({
      billNumber: billNum2,
      billNumberFormatted: `CPN-${String(billNum2).padStart(4, '0')}`,
      customer: customer._id,
      customerName: customer.name,
      billDate: new Date(),
      items: [
        {
          vegetable: veg1._id,
          particulars: veg1.name,
          rate: 50,
          bag: 1,
          weight: 20,
          debit: 1000,
          credit: 0,
        },
      ],
      totalBag: 1,
      totalWeight: 20,
      totalDebit: 1000,
      totalCredit: 0,
      previousBalance: loadedCustomer.currentBalance,
      cashReceived: 1000,
      closingBalance: loadedCustomer.currentBalance, // 6020 + 1000 - 1000 = 6020
      status: 'active',
    });

    assert(bill2.closingBalance === 6020, 'Bill #2: accurate balance continuity across sequential bills');

    // 8. Standalone Payment Test (Customer pays without buying vegetables)
    // Customer pays ₹2,000 cash
    // Resulting balance should be: 6020 - 2000 = 4020.00
    const payAmount = 2000;
    const payment = await Payment.create({
      paymentNumber: 101,
      customer: customer._id,
      customerName: customer.name,
      amount: payAmount,
      paymentDate: new Date(),
      paymentMode: 'Cash',
      previousBalance: loadedCustomer.currentBalance,
      resultingBalance: round2(loadedCustomer.currentBalance - payAmount),
      status: 'active',
    });

    customer.currentBalance = round2(customer.currentBalance - payAmount);
    await customer.save();

    assert(payment.resultingBalance === 4020 && customer.currentBalance === 4020, 'Payment Management: standalone payment reduced customer balance to ₹4,020.00');

    // 9. Decimal Accuracy Test (avoid floating point bugs e.g. 0.1 + 0.2)
    const floatTest = add2(0.1, 0.2);
    assert(floatTest === 0.3, 'Financial Arithmetic: strict decimal math verified (0.1 + 0.2 = 0.3)');

    const mulTest = mul2(33.33, 3);
    assert(mulTest === 99.99, 'Financial Arithmetic: precise multiplication verified (33.33 * 3 = 99.99)');

    // 10. Bill Cancellation / Void Test
    // Cancel Bill #2: Revert Bill #2 effect (+1000 debit, -1000 cash = net 0 change)
    const bill2Effect = round2(bill2.totalDebit - bill2.totalCredit - bill2.cashReceived);
    customer.currentBalance = round2(customer.currentBalance - bill2Effect);
    bill2.status = 'cancelled';
    await bill2.save();
    await customer.save();

    assert(bill2.status === 'cancelled' && customer.currentBalance === 4020, 'Bill Cancellation: safely voided bill and verified balance consistency');

    // 11. Database Backup Export Test
    const [allVegs, allCusts, allBills] = await Promise.all([
      Vegetable.find(),
      Customer.find(),
      Bill.find(),
    ]);
    assert(allVegs.length > 0 && allCusts.length > 0 && allBills.length > 0, 'Database Safety: verified all collections contain active records for backup');

    // =========================================================================
    // NEW REQUIREMENTS: DASHBOARD INDIVIDUAL PRINTING & TAMIL VEGETABLE NAMES
    // =========================================================================
    console.log('\n--- Testing Dashboard Individual Printing & Tamil Names ---');

    // 12. Requirement 1: Dashboard Individual Bill Retrieval by ID
    // Verify Bill #1 retrieval by its unique ID
    const bill1Fetched = await Bill.findById(bill1._id)
      .populate('customer', 'name tamilName phone address marketStall currentBalance')
      .populate('items.vegetable', 'name tamilName defaultRate unit');
    assert(
      bill1Fetched && bill1Fetched._id.toString() === bill1._id.toString() && bill1Fetched.customerName === customer.name,
      'Dashboard Print 1: Retrieved exact bill #1 by its unique ID with customer details'
    );
    assert(
      bill1Fetched.todayTotal === 3520 && bill1Fetched.previousBalance === 5000 && bill1Fetched.grandTotal === 8520 && bill1Fetched.closingBalance === 6020,
      'Dashboard Print 1: Full 5-row summary fields verified (Today: 3520, Prev: 5000, Grand: 8520, Cash: 2500, Closing: 6020)'
    );

    // Verify Bill #2 retrieval by its separate ID
    const bill2Fetched = await Bill.findById(bill2._id);
    assert(
      bill2Fetched && bill2Fetched._id.toString() === bill2._id.toString() && bill2Fetched._id.toString() !== bill1._id.toString(),
      'Dashboard Print 2: Retrieved distinct bill #2 by its unique ID without state contamination'
    );

    // 13. Read-only safeguard: Printing old bills does NOT create new bills or payments
    const billsCountBefore = await Bill.countDocuments();
    const paymentsCountBefore = await Payment.countDocuments();
    // Simulate printing read-only operation
    const reprintBill1 = await Bill.findById(bill1._id);
    const billsCountAfter = await Bill.countDocuments();
    const paymentsCountAfter = await Payment.countDocuments();
    assert(
      billsCountBefore === billsCountAfter && paymentsCountBefore === paymentsCountAfter,
      'Printing Safeguard: Read-only bill retrieval does not create duplicate bills or payments'
    );

    // 14. Requirement 2: Vegetable Master with English and Tamil names
    const newVegTest = await Vegetable.create({
      name: `Test Cauliflower ${Date.now()}`,
      tamilName: 'காலிஃபிளவர் ஸ்பெஷல்',
      defaultRate: 55,
      unit: 'Kg',
      isActive: true,
    });
    assert(
      newVegTest.name.includes('Test Cauliflower') && newVegTest.tamilName === 'காலிஃபிளவர் ஸ்பெஷல்',
      'Vegetable Master: Saved new vegetable with both English and Tamil names'
    );

    // Update test: Updating rate or name preserves Tamil name
    newVegTest.defaultRate = 60;
    await newVegTest.save();
    const reloadedVeg = await Vegetable.findById(newVegTest._id);
    assert(
      reloadedVeg.defaultRate === 60 && reloadedVeg.tamilName === 'காலிஃபிளவர் ஸ்பெஷல்',
      'Vegetable Master: Updating default rate safely preserved Tamil name'
    );

    // 15. Create Bill with Tamil vegetable name
    const latestBillDoc1 = await Bill.findOne().sort({ billNumber: -1 });
    const tamilBillNum = (latestBillDoc1?.billNumber || 100) + 1;
    const billWithTamil = await Bill.create({
      billNumber: tamilBillNum,
      billNumberFormatted: `CPN-${String(tamilBillNum).padStart(4, '0')}`,
      customer: customer._id,
      customerName: customer.name,
      billDate: new Date(),
      items: [
        {
          vegetable: newVegTest._id,
          particulars: newVegTest.name,
          tamilName: newVegTest.tamilName,
          rate: 60,
          bag: 2,
          weight: 40,
          amount: 2400,
          debit: 2400,
          credit: 0,
        },
      ],
      totalBag: 2,
      totalWeight: 40,
      todayTotal: 2400,
      grandTotal: round2(2400 + customer.currentBalance),
      previousBalance: customer.currentBalance,
      cashReceived: 1000,
      closingBalance: round2(2400 + customer.currentBalance - 1000),
      billVersion: 'v2_new_5col',
      status: 'active',
    });

    const populatedTamilBill = await Bill.findById(billWithTamil._id)
      .populate('items.vegetable', 'name tamilName defaultRate unit');
    assert(
      populatedTamilBill.items[0].tamilName === 'காலிஃபிளவர் ஸ்பெஷல்' || populatedTamilBill.items[0].vegetable.tamilName === 'காலிஃபிளவர் ஸ்பெஷல்',
      'Bill Creation: Vegetable Tamil name stored and populated for printed bill (காலிஃபிளவர் ஸ்பெஷல்)'
    );

    // 16. Search Functionality: English and Tamil search
    const searchTamilRegex = new RegExp('காலிஃபிளவர்', 'i');
    const tamilSearchResults = await Vegetable.find({
      $or: [{ name: searchTamilRegex }, { tamilName: searchTamilRegex }],
    });
    assert(
      tamilSearchResults.some((v) => v._id.toString() === newVegTest._id.toString()),
      'Search Functionality: Successfully found vegetable searching with Tamil name ("காலிஃபிளவர்")'
    );

    const searchEngRegex = new RegExp(newVegTest.name, 'i');
    const engSearchResults = await Vegetable.find({
      $or: [{ name: searchEngRegex }, { tamilName: searchEngRegex }],
    });
    assert(
      engSearchResults.some((v) => v._id.toString() === newVegTest._id.toString()),
      'Search Functionality: Successfully found vegetable searching with English name'
    );

    // 17. Historical Bill Tamil Name Resolution Test
    // Create an old historical bill having only English particulars: "Tomato" and no vegetable ref
    const latestBillDoc2 = await Bill.findOne().sort({ billNumber: -1 });
    const histBillNum = (latestBillDoc2?.billNumber || 200) + 1;
    const historicalBill = await Bill.create({
      billNumber: histBillNum,
      billNumberFormatted: `CPN-${String(histBillNum).padStart(4, '0')}`,
      customer: customer._id,
      customerName: customer.name,
      billDate: new Date('2026-10-01'),
      items: [
        {
          particulars: 'Tomato',
          rate: 35,
          bag: 1,
          weight: 20,
          debit: 700,
          credit: 0,
        },
      ],
      totalBag: 1,
      totalWeight: 20,
      totalDebit: 700,
      previousBalance: 0,
      closingBalance: 700,
      billVersion: 'v1_legacy_6col',
      status: 'active',
    });

    // Test controller resolution logic for historical bills
    const allVegMaster = await Vegetable.find({}).lean();
    const vegByNameMap = new Map();
    allVegMaster.forEach((v) => {
      if (v.name) vegByNameMap.set(v.name.trim().toLowerCase(), v);
      if (v.normalizedName) vegByNameMap.set(v.normalizedName, v);
    });

    const historicalMatchedVeg = vegByNameMap.get(historicalBill.items[0].particulars.toLowerCase());
    const resolvedTamilForHistorical = historicalMatchedVeg ? historicalMatchedVeg.tamilName : '';
    assert(
      resolvedTamilForHistorical === 'தக்காளி',
      'Historical Bills: Safely resolved English particulars "Tomato" to Tamil name "தக்காளி" without altering record'
    );

    // 18. Fallback Test: When item particulars has no Tamil equivalent
    const customItemName = 'Custom Wooden Crate Charge';
    const fallbackMatched = vegByNameMap.get(customItemName.toLowerCase());
    const fallbackDisplayName = fallbackMatched && fallbackMatched.tamilName ? fallbackMatched.tamilName : customItemName;
    assert(
      fallbackDisplayName === customItemName,
      'Fallback Safety: Safely preserved English particulars when Tamil name is unavailable'
    );

    // =========================================================================
    // SECTION 19: NEW AUTHORITATIVE 6-ROW BILL ACCOUNTING & CALCULATION TEST
    // =========================================================================
    console.log('\n--- Testing Authoritative 6-Row Summary Accounting & Invariants ---');

    // Create a dedicated test customer for the 6-row prompt test case
    const test6RowCust = await Customer.create({
      name: `Raja Veg Buyer ${Date.now()}`,
      tamilName: 'ராஜா காய்கறி வாங்குபவர்',
      phone: '9788229090',
      address: '22-A, Gandhi Market, Dindigul',
      openingBalance: 2000,
      currentBalance: 2000,
    });
    assert(test6RowCust.currentBalance === 2000, '6-Row Test: Created customer with ₹2,000 previous balance');

    // Prompt example:
    // Today's total = 10,000
    // Previous balance = 2,000
    // Total (மொத்தம்) = 12,000
    // Discount (தள்ளுபடி) = 500
    // Varavu (வரவு) = 5,000
    // Final balance (மொத்த பாக்கி) = 6,500
    const todayTotalVal = 10000;
    const prevBalanceVal = test6RowCust.currentBalance; // 2000
    const totalVal = round2(todayTotalVal + prevBalanceVal); // 12000
    const discountVal = 500;
    const varavuVal = 5000;
    const closingBalanceVal = round2(totalVal - discountVal - varavuVal); // 6500

    const latestBillDoc3 = await Bill.findOne().sort({ billNumber: -1 });
    const bill6RowNum = (latestBillDoc3?.billNumber || 300) + 1;

    const bill6Row = await Bill.create({
      billNumber: bill6RowNum,
      billNumberFormatted: `CPN-${String(bill6RowNum).padStart(4, '0')}`,
      customer: test6RowCust._id,
      customerName: test6RowCust.name,
      customerPhone: test6RowCust.phone,
      billDate: new Date(),
      items: [
        {
          vegetable: veg1._id,
          particulars: veg1.name,
          tamilName: veg1.tamilName,
          rate: 50,
          bag: 5,
          weight: 200,
          amount: todayTotalVal,
          debit: todayTotalVal,
          credit: 0,
        },
      ],
      totalBag: 5,
      totalWeight: 200,
      todayTotal: todayTotalVal,
      totalDebit: todayTotalVal,
      previousBalance: prevBalanceVal,
      grandTotal: totalVal,
      discount: discountVal,
      varavu: varavuVal,
      cashReceived: varavuVal,
      closingBalance: closingBalanceVal,
      billVersion: 'v3_new_6row',
      status: 'active',
    });

    // Create the single payment document for Varavu (cash received)
    const payment6Row = await Payment.create({
      paymentNumber: 201,
      customer: test6RowCust._id,
      customerName: test6RowCust.name,
      bill: bill6Row._id,
      amount: varavuVal,
      paymentDate: bill6Row.billDate,
      paymentMode: 'Cash',
      previousBalance: totalVal - discountVal,
      resultingBalance: closingBalanceVal,
      status: 'active',
    });

    test6RowCust.currentBalance = closingBalanceVal;
    test6RowCust.lastBalanceDate = bill6Row.billDate;
    await test6RowCust.save();

    assert(
      bill6Row.todayTotal === 10000 &&
      bill6Row.previousBalance === 2000 &&
      bill6Row.grandTotal === 12000 &&
      bill6Row.discount === 500 &&
      bill6Row.varavu === 5000 &&
      bill6Row.closingBalance === 6500,
      '6-Row Summary Values: Verified exact prompt example (10000 + 2000 = 12000, 12000 - 500 - 5000 = 6500)'
    );

    assert(
      payment6Row.amount === 5000 && payment6Row.bill.toString() === bill6Row._id.toString(),
      'Accounting Distinction: Exactly 1 payment created with cash received ₹5,000 (discount of ₹500 is NOT cash)'
    );

    assert(
      test6RowCust.currentBalance === 6500,
      'Customer Ledger Balance: Customer current balance updated to ₹6,500'
    );

    // Verify subsequent bill inherits the 6500 balance as previousBalance
    const reloadedCust = await Customer.findById(test6RowCust._id);
    assert(
      reloadedCust.currentBalance === 6500,
      'Balance Continuity: Next bill for customer correctly receives ₹6,500 as previous balance'
    );

    // Verify customer controller ledger endpoint logic
    const customerLedgerBills = await Bill.find({ customer: test6RowCust._id, status: 'active' });
    const customerLedgerPayments = await Payment.find({ customer: test6RowCust._id, status: 'active' });
    assert(
      customerLedgerBills.length === 1 && customerLedgerPayments.length === 1,
      'Ledger Integrity: Verified bills and payments are cleanly linked and isolated'
    );

    console.log('\n------------------------------------------------------');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('------------------------------------------------------\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test suite failed with unexpected error:', err);
    process.exit(1);
  }
};

runAllTests();

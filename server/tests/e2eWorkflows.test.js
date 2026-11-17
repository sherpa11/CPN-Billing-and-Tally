// Force test database environment before server loads
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_test_db';
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const http = require('http');
const connectDB = require('../config/db');
const app = require('../server');
const User = require('../models/User');
const Vegetable = require('../models/Vegetable');
const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const { round2, add2, sub2, mul2 } = require('../utils/mathUtils');

let server;
let baseUrl;
let authToken = '';

const runE2E = async () => {
  console.log('\n======================================================');
  console.log('  CPN VEGETABLES - PRODUCTION END-TO-END WORKFLOW SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const test = (description, condition) => {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failed++;
    }
  };

  try {
    // 0. Ensure database connection is fully established before running tests
    await connectDB();

    // 1. Start Ephemeral Server on free port
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        console.log(`  [SETUP] Ephemeral test server running at ${baseUrl}`);
        resolve();
      });
    });

    // Helper for API calls
    const request = async (endpoint, options = {}) => {
      const url = `${baseUrl}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      };
      const res = await fetch(url, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }
      return { status: res.status, ok: res.ok, data };
    };

    // -------------------------------------------------------------------------
    // WORKFLOW A: AUTHENTICATION & SECURITY
    // -------------------------------------------------------------------------
    console.log('\n--- Workflow A: Authentication & Security ---');

    // A1. Invalid credentials test
    const badLogin = await request('/auth/login', {
      method: 'POST',
      body: { username: 'raja', password: 'wrongpassword' },
    });
    test('Auth: Rejects invalid credentials with 401', badLogin.status === 401 && !badLogin.data.success);

    // A2. Admin Login with raja / raja
    const validLogin = await request('/auth/login', {
      method: 'POST',
      body: { username: 'raja', password: 'raja' },
    });
    test('Auth: Successfully authenticates admin "raja" / "raja"', validLogin.status === 200 && validLogin.data.token);
    authToken = validLogin.data?.token || '';

    // A3. Verify /auth/me with valid token
    const meRes = await request('/auth/me', { method: 'GET' });
    test('Auth: /auth/me returns authenticated user details', meRes.status === 200 && meRes.data.user.username === 'raja');

    // A4. Test Unauthorized access with invalid token
    const invalidTokenRes = await request('/auth/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid.token.payload' },
    });
    test('Auth: Rejects counterfeit or expired tokens with 401', invalidTokenRes.status === 401);

    // A5. Test Mandatory Authentication on all sensitive endpoints without token
    const unauthCustomers = await request('/customers', { method: 'GET', headers: { Authorization: '' } });
    test('Auth: Rejects unauthenticated /customers with 401', unauthCustomers.status === 401);

    const unauthVegetables = await request('/vegetables', { method: 'GET', headers: { Authorization: '' } });
    test('Auth: Rejects unauthenticated /vegetables with 401', unauthVegetables.status === 401);

    const unauthBills = await request('/bills', { method: 'GET', headers: { Authorization: '' } });
    test('Auth: Rejects unauthenticated /bills with 401', unauthBills.status === 401);

    const unauthPayments = await request('/payments', { method: 'GET', headers: { Authorization: '' } });
    test('Auth: Rejects unauthenticated /payments with 401', unauthPayments.status === 401);

    const unauthReports = await request('/reports/dashboard-stats', { method: 'GET', headers: { Authorization: '' } });
    test('Auth: Rejects unauthenticated /reports with 401', unauthReports.status === 401);

    const unauthSettings = await request('/settings', { method: 'GET', headers: { Authorization: '' } });
    test('Auth: Rejects unauthenticated /settings with 401', unauthSettings.status === 401);

    const unauthBackup = await request('/backup/export', { method: 'GET', headers: { Authorization: '' } });
    test('Auth: Rejects unauthenticated /backup/export with 401', unauthBackup.status === 401);

    // -------------------------------------------------------------------------
    // WORKFLOW B: VEGETABLE MASTER MANAGEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- Workflow B: Vegetable Master Management ---');

    const uniqueVegName = `Chilli Special ${Date.now()}`;
    // B1. Add Vegetable with Tamil and English names
    const addVegRes = await request('/vegetables', {
      method: 'POST',
      body: {
        name: uniqueVegName,
        tamilName: 'மிளகாய் ஸ்பெஷல்',
        defaultRate: 75.0,
        unit: 'Kg',
      },
    });
    test('Vegetables: Added new vegetable with Tamil and English names', addVegRes.status === 201 && addVegRes.data.data._id);
    const createdVegId = addVegRes.data?.data?._id;

    // B2. Duplicate prevention test (case-insensitive)
    const dupVegRes = await request('/vegetables', {
      method: 'POST',
      body: {
        name: uniqueVegName.toUpperCase(),
        tamilName: 'மிளகாய் டூப்ளிகேட்',
        defaultRate: 80.0,
      },
    });
    test('Vegetables: Prevents duplicate vegetable name case-insensitively (HTTP 400/409)', dupVegRes.status === 400 || dupVegRes.status === 409);

    // B3. Search by Tamil Name
    const searchTamilRes = await request('/vegetables?search=மிளகாய்');
    const tamilFound = searchTamilRes.data?.data?.some((v) => v.tamilName.includes('மிளகாய்'));
    test('Vegetables: Search retrieves vegetables by Tamil name', tamilFound);

    // B4. Search by English Name
    const searchEngRes = await request(`/vegetables?search=${encodeURIComponent(uniqueVegName)}`);
    const engFound = searchEngRes.data?.data?.some((v) => v.name === uniqueVegName);
    test('Vegetables: Search retrieves vegetables by English name', engFound);

    // B5. Edit default rate and preserve Tamil name
    const updateVegRes = await request(`/vegetables/${createdVegId}`, {
      method: 'PUT',
      body: {
        defaultRate: 82.5,
      },
    });
    test(
      'Vegetables: Updated rate while safely preserving Tamil name',
      updateVegRes.status === 200 && updateVegRes.data.data.defaultRate === 82.5 && updateVegRes.data.data.tamilName === 'மிளகாய் ஸ்பெஷல்'
    );

    // -------------------------------------------------------------------------
    // WORKFLOW C: CUSTOMER MANAGEMENT & LEDGER
    // -------------------------------------------------------------------------
    console.log('\n--- Workflow C: Customer Management & Ledger ---');

    const custName = `Dindigul Buyer ${Date.now()}`;
    const custPhone = '98421' + Math.floor(10000 + Math.random() * 90000);
    // C1. Create Customer with opening balance
    const addCustRes = await request('/customers', {
      method: 'POST',
      body: {
        name: custName,
        tamilName: 'திண்டுக்கல் வாடிக்கையாளர்',
        phone: custPhone,
        address: 'காந்தி மார்க்கெட், கடை எண் 5',
        openingBalance: 3000.0,
      },
    });
    test('Customers: Created customer with ₹3,000 opening balance', addCustRes.status === 201 && addCustRes.data.data.currentBalance === 3000);
    const testCustomerId = addCustRes.data?.data?._id;

    // C2. Search Customer by Phone
    const searchCustRes = await request(`/customers?search=${custPhone}`);
    test('Customers: Search locates customer by phone number', searchCustRes.data?.data?.some((c) => c.phone === custPhone));

    // C3. Search Customer by Tamil Name
    const searchCustTamil = await request('/customers?search=திண்டுக்கல்');
    test('Customers: Search locates customer by Tamil name', searchCustTamil.data?.data?.some((c) => c._id === testCustomerId));

    // C4. Customer Ledger History before bills
    const ledgerBeforeRes = await request(`/customers/${testCustomerId}/ledger`);
    test(
      'Customers: Ledger displays correct opening balance of ₹3,000',
      ledgerBeforeRes.status === 200 && ledgerBeforeRes.data.customer.openingBalance === 3000
    );

    // -------------------------------------------------------------------------
    // WORKFLOW D: BILLING ENGINE & INVARIANTS
    // -------------------------------------------------------------------------
    console.log('\n--- Workflow D: Billing Engine & Calculations ---');

    // D1. Next Bill Number Generation
    const nextNumRes = await request('/bills/next-number');
    test('Billing: Next sequential bill number generated cleanly', nextNumRes.status === 200 && nextNumRes.data.nextBillNumber > 0);

    // D2. Create Bill #1 with multiple vegetables and previous balance
    // Vegetable 1: 5 bags, 200 kg @ ₹50 = ₹10,000
    // Vegetable 2: 2 bags, 50 kg @ ₹40 = ₹2,000
    // Today's Total = ₹12,000
    // Previous Balance = ₹3,000 (from customer opening balance)
    // Grand Total = ₹15,000
    // Varavu / Cash Received = ₹5,000
    // Discount = ₹0
    // Closing Balance = ₹10,000
    const bill1Payload = {
      customerId: testCustomerId,
      customerName: custName,
      customerPhone: custPhone,
      billDate: new Date().toISOString(),
      items: [
        {
          vegetable: createdVegId,
          particulars: uniqueVegName,
          tamilName: 'மிளகாய் ஸ்பெஷல்',
          rate: 50,
          bag: 5,
          weight: 200,
          amount: 10000,
        },
        {
          particulars: 'Onion',
          tamilName: 'பெரிய வெங்காயம்',
          rate: 40,
          bag: 2,
          weight: 50,
          amount: 2000,
        },
      ],
      totalBag: 7,
      totalWeight: 250,
      todayTotal: 12000,
      previousBalance: 3000,
      grandTotal: 15000,
      cashReceived: 5000,
      varavu: 5000,
      discount: 0,
      closingBalance: 10000,
      billVersion: 'v3_new_6row',
    };

    const createBill1Res = await request('/bills', {
      method: 'POST',
      body: bill1Payload,
    });
    test('Billing: Bill #1 created successfully', createBill1Res.status === 201 && createBill1Res.data.data._id);
    const bill1Id = createBill1Res.data?.data?._id;

    // D3. Verify customer current balance is automatically updated to ₹10,000
    const custAfterBill1 = await request(`/customers/${testCustomerId}`);
    test(
      'Accounting: Customer balance updated to ₹10,000 closing balance after Bill #1',
      custAfterBill1.data.data.currentBalance === 10000
    );

    // D4. Verify automatic payment record created for Cash Received ₹5,000
    const paymentsBill1 = await request(`/payments?customer=${testCustomerId}`);
    test(
      'Accounting: Exactly 1 payment record created for cash received ₹5,000',
      paymentsBill1.data.data.length === 1 && paymentsBill1.data.data[0].amount === 5000
    );

    // D5. Sequential Bill #2 Balance Continuity:
    // Today's Total: ₹4,000
    // Previous Balance: ₹10,000 (auto-loaded from customer balance)
    // Grand Total: ₹14,000
    // Cash Received: ₹2,000
    // Discount: ₹500
    // Closing Balance: ₹11,500 (14000 - 500 - 2000 = 11500)
    const bill2Payload = {
      customerId: testCustomerId,
      customerName: custName,
      customerPhone: custPhone,
      billDate: new Date().toISOString(),
      items: [
        {
          particulars: 'Tomato',
          tamilName: 'தக்காளி',
          rate: 40,
          bag: 2,
          weight: 100,
          amount: 4000,
        },
      ],
      totalBag: 2,
      totalWeight: 100,
      todayTotal: 4000,
      previousBalance: 10000,
      grandTotal: 14000,
      discount: 500,
      cashReceived: 2000,
      varavu: 2000,
      closingBalance: 11500,
      billVersion: 'v3_new_6row',
    };

    const createBill2Res = await request('/bills', {
      method: 'POST',
      body: bill2Payload,
    });
    test('Billing: Bill #2 created with ₹500 discount and ₹2,000 cash', createBill2Res.status === 201);
    const bill2Id = createBill2Res.data?.data?._id;

    // D6. Verify Customer current balance updated to ₹11,500
    const custAfterBill2 = await request(`/customers/${testCustomerId}`);
    test(
      'Accounting: Balance continuity verified (customer balance is now ₹11,500)',
      custAfterBill2.data.data.currentBalance === 11500
    );

    // -------------------------------------------------------------------------
    // WORKFLOW E: STANDALONE PAYMENTS & LEDGER CONTINUITY
    // -------------------------------------------------------------------------
    console.log('\n--- Workflow E: Standalone Payments & Ledger ---');

    // E1. Customer makes standalone payment of ₹1,500
    const standalonePaymentRes = await request('/payments', {
      method: 'POST',
      body: {
        customerId: testCustomerId,
        amount: 1500,
        paymentMode: 'Cash',
        remarks: 'Direct cash payment at mandi counter',
      },
    });
    test('Payments: Standalone payment of ₹1,500 created', standalonePaymentRes.status === 201);

    // E2. Verify customer balance reduced from ₹11,500 to ₹10,000
    const custAfterStandalone = await request(`/customers/${testCustomerId}`);
    test(
      'Accounting: Customer outstanding reduced to ₹10,000 (11,500 - 1,500 = 10,000)',
      custAfterStandalone.data.data.currentBalance === 10000
    );

    // E3. Verify Customer Ledger Complete Audit Trail
    const fullLedgerRes = await request(`/customers/${testCustomerId}/ledger`);
    const ledgerEntries = fullLedgerRes.data?.ledger || [];
    const hasBills = ledgerEntries.some((e) => e.type === 'BILL');
    const hasVaravu = ledgerEntries.some((e) => e.type === 'VARAVU');
    const hasDiscount = ledgerEntries.some((e) => e.type === 'DISCOUNT');
    test(
      'Ledger: Complete audit trail verified (Bills, Varavu, Discounts, Running Balance)',
      hasBills && hasVaravu && hasDiscount && fullLedgerRes.data.customer.calculatedBalance === 10000
    );

    // -------------------------------------------------------------------------
    // WORKFLOW F: BILL RETRIEVAL FOR DASHBOARD PRINT
    // -------------------------------------------------------------------------
    console.log('\n--- Workflow F: Dashboard Read-Only Print Retrieval ---');

    // F1. Retrieve Bill #1 by ID without state mutation
    const printBillRes = await request(`/bills/${bill1Id}`);
    test(
      'Dashboard Print: Read-only bill retrieval returns accurate items and summary',
      printBillRes.status === 200 &&
        printBillRes.data.data.todayTotal === 12000 &&
        printBillRes.data.data.items[0].tamilName === 'மிளகாய் ஸ்பெஷல்'
    );

    // F2. Verify reading bill did not mutate payments or customer balance
    const custBalanceCheck = await request(`/customers/${testCustomerId}`);
    test(
      'Dashboard Print: Read-only safeguard confirmed (customer balance remains ₹10,000)',
      custBalanceCheck.data.data.currentBalance === 10000
    );

    // -------------------------------------------------------------------------
    // WORKFLOW G: SOFT DELETION & CUSTOMER MANAGEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- Workflow G: Soft Deletion of Customer ---');

    // Create a temporary customer to test deletion
    const tempCustRes = await request('/customers', {
      method: 'POST',
      body: {
        name: `Temp Customer ${Date.now()}`,
        phone: '9000012345',
        openingBalance: 0,
      },
    });
    const tempCustId = tempCustRes.data.data._id;

    // Delete customer
    const delCustRes = await request(`/customers/${tempCustId}`, { method: 'DELETE' });
    test('Customers: Soft delete customer endpoint works', delCustRes.status === 200);

    // Verify deleted customer is excluded from active customers query
    const activeCustList = await request('/customers?activeOnly=true');
    const isExcluded = !activeCustList.data.data.some((c) => c._id === tempCustId);
    test('Customers: Deleted customer excluded from active lists', isExcluded);

    // -------------------------------------------------------------------------
    // WORKFLOW H: BILL EDITING, LEDGER CASCADING & CONCURRENCY
    // -------------------------------------------------------------------------
    console.log('\n--- Workflow H: Bill Editing, Ledger Cascading & Concurrency ---');

    // H1. Edit existing Bill #1: Add another item and adjust cash received
    // Bill #1 originally had: todayTotal=12000, prev=3000, grand=15000, varavu=5000, closing=10000.
    // Bill #2 originally had: prev=10000, today=4000, discount=500, varavu=2000, grand=14000, closing=11500.
    // After standalone payment of 1500, customer balance became 10000.
    const originalBill1 = printBillRes.data.data;
    const editBillRes = await request(`/bills/${bill1Id}`, {
      method: 'PUT',
      body: {
        billDate: originalBill1.billDate,
        items: [
          ...originalBill1.items,
          {
            vegetable: createdVegId,
            particulars: 'தக்காளி நாடன்',
            tamilName: 'தக்காளி நாடன்',
            rate: 40,
            bag: 2,
            weight: 25,
            amount: 1000,
          },
        ],
        discount: 0,
        varavu: 5000,
        version: originalBill1.version || 1,
      },
    });

    test(
      'Billing: HTTP PUT /bills/:id updates existing bill with HTTP 200',
      editBillRes.status === 200 && editBillRes.data.success
    );

    test(
      'Billing: Original bill number strictly preserved across edit',
      editBillRes.data.data.billNumber === originalBill1.billNumber &&
        editBillRes.data.data.billNumberFormatted === originalBill1.billNumberFormatted
    );

    // New todayTotal = 12000 + 1000 = 13000. Grand = 13000 + 3000 = 16000. Closing = 16000 - 5000 = 11000.
    test(
      'Billing: Totals recalculated accurately (Today ₹13,000, Closing ₹11,000)',
      editBillRes.data.data.todayTotal === 13000 &&
        editBillRes.data.data.closingBalance === 11000
    );

    // H2. Verify cascading update to subsequent Bill #2
    const subBillRes = await request(`/bills/${bill2Id}`);
    test(
      'Accounting: Subsequent Bill #2 previous balance cascaded to ₹11,000',
      subBillRes.data.data.previousBalance === 11000 &&
        subBillRes.data.data.closingBalance === 12500 // (11000 + 4000) - 500 - 2000 = 12500
    );

    // H3. Verify customer current balance reflects the cascading change and standalone payment
    // 12500 - standalone payment (1500) = 11000
    const finalCustCheck = await request(`/customers/${testCustomerId}`);
    test(
      'Accounting: Customer balance accurately cascaded to ₹11,000 (+₹1,000 difference)',
      finalCustCheck.data.data.currentBalance === 11000
    );

    // H4. Optimistic locking: submitting stale version must return 409 Conflict
    const staleEditRes = await request(`/bills/${bill1Id}`, {
      method: 'PUT',
      body: {
        items: editBillRes.data.data.items,
        version: 1, // outdated, version is now 2
      },
    });
    test(
      'Concurrency: Optimistic locking rejects stale version with HTTP 409',
      staleEditRes.status === 409
    );

    // H5. Cancelled bill editing rejection
    // Cancel Bill #1 and attempt editing
    await request(`/bills/${bill1Id}/cancel`, {
      method: 'POST',
      body: { reason: 'Test cancellation' },
    });
    const editCancelledRes = await request(`/bills/${bill1Id}`, {
      method: 'PUT',
      body: { items: editBillRes.data.data.items },
    });
    test(
      'Safeguard: Editing cancelled bill rejected with HTTP 400',
      editCancelledRes.status === 400
    );

    // -------------------------------------------------------------------------
    // RESULTS & CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------');
    console.log(`  E2E WORKFLOW TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('------------------------------------------------------\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('E2E workflow failed unexpectedly:', err);
    if (server) server.close();
    process.exit(1);
  }
};

runE2E();

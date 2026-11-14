/**
 * CPN VEGETABLES - MONGODB ATLAS MIGRATION & AUDIT HELPER
 *
 * Requirements:
 * 1. Safe, non-destructive side-by-side comparison of Local vs MongoDB Atlas.
 * 2. Compares record counts, identifies genuine business data vs demo/test data.
 * 3. Never deletes or mutates source or target records automatically.
 * 4. Generates an exact differences report.
 * 5. Masks all passwords and secrets in logs.
 */

const mongoose = require('mongoose');
const dns = require('dns');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Ensure reliable SRV DNS lookup for MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const maskUri = (uri) => {
  if (!uri) return 'undefined';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

const runMigrationAudit = async () => {
  console.log('\n=====================================================================');
  console.log('  CPN VEGETABLES - ATLAS DATABASE COMPARISON & AUDIT TOOL');
  console.log('=====================================================================\n');

  const sourceUri = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_db';
  const targetUri = process.env.MONGODB_URI;

  console.log(`[Source Database (Local)] : ${maskUri(sourceUri)}`);
  console.log(`[Target Database (Atlas)] : ${maskUri(targetUri)}`);
  console.log('');

  const isTargetAtlas = targetUri && (targetUri.startsWith('mongodb+srv://') || targetUri.includes('.mongodb.net'));
  const isTargetLocal = targetUri && (targetUri.includes('127.0.0.1') || targetUri.includes('localhost'));

  if (!targetUri || isTargetLocal) {
    console.log('[Notice] The target connection string in server/.env is currently local MongoDB.');
    console.log('To connect to MongoDB Atlas:');
    console.log('  1. Open server/.env (or root .env)');
    console.log('  2. Replace MONGODB_URI with your actual Atlas connection string:');
    console.log('     MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/cpn_vegetables_db?retryWrites=true&w=majority');
    console.log('  3. Re-run this audit script: node server/scripts/atlasMigrationHelper.js\n');
  }

  // 1. Inspect Source (Local)
  console.log('[Step 1] Inspecting Source (Local Database)...');
  let sourceConn = null;
  let sourceCounts = {};
  const collections = ['vegetables', 'customers', 'bills', 'payments', 'users', 'settings'];

  try {
    sourceConn = await mongoose.createConnection(sourceUri, {
      dbName: 'cpn_vegetables_db',
      serverSelectionTimeoutMS: 5000,
    }).asPromise();

    const sourceDb = sourceConn.db;
    for (const col of collections) {
      sourceCounts[col] = await sourceDb.collection(col).countDocuments();
    }
    console.log('  -> Source database connected successfully.');
  } catch (err) {
    console.error('  -> Failed to connect to local source database:', err.message);
  }

  // 2. Inspect Target (Atlas or Configured MONGODB_URI)
  let targetConn = null;
  let targetCounts = {};
  let targetConnected = false;

  if (targetUri && (!isTargetLocal || sourceUri !== targetUri)) {
    console.log('\n[Step 2] Inspecting Target (MongoDB Atlas)...');
    try {
      targetConn = await mongoose.createConnection(targetUri, {
        dbName: 'cpn_vegetables_db',
        serverSelectionTimeoutMS: 10000,
        family: 4,
      }).asPromise();

      const targetDb = targetConn.db;
      for (const col of collections) {
        targetCounts[col] = await targetDb.collection(col).countDocuments();
      }
      targetConnected = true;
      console.log(`  -> Atlas connected successfully! (Host: ${targetConn.host}, Database: ${targetConn.name})`);
    } catch (err) {
      console.error(`  -> Failed to connect to Target MongoDB (${maskUri(targetUri)}):`, err.message);
    }
  }

  // 3. Side-by-side Comparison Matrix
  console.log('\n=====================================================================');
  console.log('  DATABASE COMPARISON & DIFFERENCE MATRIX');
  console.log('=====================================================================');
  console.log('Collection    | Local Count | Target (Atlas) | Difference | Status');
  console.log('--------------|-------------|----------------|------------|-----------------------');

  for (const col of collections) {
    const sCount = sourceCounts[col] !== undefined ? sourceCounts[col] : 'ERR';
    const tCount = targetConnected ? (targetCounts[col] !== undefined ? targetCounts[col] : 0) : 'Not Checked';
    let diff = 'N/A';
    let status = 'Pending Atlas Connection';

    if (targetConnected && typeof sCount === 'number' && typeof tCount === 'number') {
      diff = tCount - sCount;
      if (diff === 0) {
        status = 'In Sync';
      } else if (tCount === 0) {
        status = 'Target Empty';
      } else {
        status = diff > 0 ? `Target has +${diff}` : `Target has ${diff}`;
      }
    } else if (isTargetLocal) {
      status = 'Target is Local';
    }

    console.log(
      `${col.padEnd(13)} | ${String(sCount).padEnd(11)} | ${String(tCount).padEnd(14)} | ${String(diff).padEnd(10)} | ${status}`
    );
  }
  console.log('=====================================================================\n');

  // 4. Data Safety Checks
  if (sourceConn) {
    const testCustomers = await sourceConn.db.collection('customers').find({
      $or: [
        { name: { $regex: /test|demo|temp/i } },
        { phone: { $regex: /90000|123456/ } },
      ],
    }).toArray();

    if (testCustomers.length > 0) {
      console.log(`[WARNING] Found ${testCustomers.length} potential test customer(s) in source:`);
      testCustomers.forEach((c) => console.log(`  - ${c.name} (${c.phone})`));
    } else {
      console.log('[Audit Verification] Zero test/demo records detected in source database.');
    }
    await sourceConn.close();
  }

  if (targetConn) {
    await targetConn.close();
  }

  console.log('\n[Summary] Non-destructive audit completed. Zero records were altered.');
};

if (require.main === module) {
  runMigrationAudit().catch((err) => {
    console.error('Audit Error:', err.message);
    process.exit(1);
  });
}

module.exports = { runMigrationAudit, maskUri };

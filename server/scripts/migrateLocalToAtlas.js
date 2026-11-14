/**
 * CPN VEGETABLES - PRODUCTION RECORD MIGRATION TOOL
 * Safely copies the 27 approved vegetables, admin user 'raja', and shop settings
 * from the local database to MongoDB Atlas upon explicit approval.
 */

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']); } catch(e){}

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const maskUri = (uri) => {
  if (!uri) return 'undefined';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
};

const migrateData = async () => {
  console.log('\n=====================================================================');
  console.log('  CPN VEGETABLES - LOCAL TO ATLAS PRODUCTION MIGRATION');
  console.log('=====================================================================\n');

  const sourceUri = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/cpn_vegetables_db';
  const targetUri = process.env.MONGODB_URI;

  console.log(`[Source Local]  : ${maskUri(sourceUri)}`);
  console.log(`[Target Atlas]  : ${maskUri(targetUri)}`);

  if (!targetUri || targetUri.includes('127.0.0.1') || targetUri.includes('localhost')) {
    console.error('\n[Error] MONGODB_URI in server/.env is still pointing to local MongoDB.');
    process.exit(1);
  }

  // Connect to Source
  console.log('\n[1/4] Connecting to Local Source Database...');
  const sourceConn = await mongoose.createConnection(sourceUri, {
    dbName: 'cpn_vegetables_db',
    serverSelectionTimeoutMS: 5000,
  }).asPromise();

  // Connect to Target Atlas
  console.log('[2/4] Connecting to MongoDB Atlas Cluster...');
  const targetConn = await mongoose.createConnection(targetUri, {
    dbName: 'cpn_vegetables_db',
    serverSelectionTimeoutMS: 15000,
  }).asPromise();

  console.log(`  -> Connected to Atlas host: ${targetConn.host}`);

  // Fetch approved records from Local
  console.log('\n[3/4] Reading approved records from Local Database...');
  const vegetables = await sourceConn.db.collection('vegetables').find().toArray();
  const users = await sourceConn.db.collection('users').find().toArray();
  const settings = await sourceConn.db.collection('settings').find().toArray();

  console.log(`  -> Found ${vegetables.length} vegetables, ${users.length} users, ${settings.length} settings.`);

  // Write to Atlas using upsert (non-destructive)
  console.log('\n[4/4] Migrating records to Atlas (idempotent upsert)...');
  let vegCount = 0;
  for (const veg of vegetables) {
    await targetConn.db.collection('vegetables').updateOne(
      { normalizedName: veg.normalizedName },
      { $set: veg },
      { upsert: true }
    );
    vegCount++;
  }

  let userCount = 0;
  for (const user of users) {
    await targetConn.db.collection('users').updateOne(
      { username: user.username },
      { $set: user },
      { upsert: true }
    );
    userCount++;
  }

  let settingCount = 0;
  for (const set of settings) {
    await targetConn.db.collection('settings').updateOne(
      { _id: set._id },
      { $set: set },
      { upsert: true }
    );
    settingCount++;
  }

  console.log('\n--- MIGRATION RESULTS ---');
  console.log(`  - Vegetables Migrated : ${vegCount}`);
  console.log(`  - Users Migrated      : ${userCount}`);
  console.log(`  - Settings Migrated   : ${settingCount}`);
  console.log('-------------------------\n');

  await sourceConn.close();
  await targetConn.close();
  console.log('[Success] MongoDB Atlas successfully populated with approved records.');
};

if (require.main === module) {
  migrateData().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { migrateData };

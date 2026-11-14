const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');
const { seedInitialData, seedDevelopmentDemoData } = require('../utils/seedData');

async function runDevSeed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Cannot run seedDev in production environment!');
    process.exit(1);
  }

  console.log('Running development seeder...');
  await connectDB();
  await seedInitialData();
  await seedDevelopmentDemoData();
  console.log('Development seeding finished successfully.');
  await mongoose.disconnect();
  process.exit(0);
}

runDevSeed();

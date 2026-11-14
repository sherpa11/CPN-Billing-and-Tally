const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');

const seedRaja = async () => {
  try {
    await connectDB();
    console.log('[Seed] Connected to MongoDB');

    const username = 'raja';
    const password = 'raja';
    const name = 'Raja';

    let user = await User.findOne({ username: 'raja' });
    if (user) {
      console.log('[Seed] User "raja" already exists. Updating password...');
      user.password = password;
      user.name = name;
      user.role = 'admin';
      user.isActive = true;
      await user.save();
      console.log('[Seed] Successfully updated "raja" password to "raja"!');
    } else {
      console.log('[Seed] Creating user "raja"...');
      user = await User.create({
        username: 'raja',
        password: password,
        name: name,
        role: 'admin',
        isActive: true,
      });
      console.log('[Seed] Successfully created user "raja" with password "raja"!');
    }

    // Verify password matching
    const isMatch = await user.comparePassword('raja');
    console.log(`[Seed] Verification check: isMatch('raja') === ${isMatch}`);

    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
};

seedRaja();

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

const User = require('../models/User');
const connectDB = require('../config/db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const provisionAdmin = async () => {
  try {
    await connectDB();
    console.log('\n=== CPN VEGETABLES - Secure Admin Provisioning CLI ===\n');

    const username = await question('Enter Admin Username: ');
    if (!username.trim()) {
      console.log('Username cannot be empty.');
      process.exit(1);
    }

    const password = await question('Enter Admin Password (min 6 chars): ');
    if (!password || password.length < 6) {
      console.log('Password must be at least 6 characters.');
      process.exit(1);
    }

    const name = await question('Enter Full Name (e.g. CPN Manager): ');

    const existing = await User.findOne({ username: username.toLowerCase().trim() });
    if (existing) {
      console.log(`\nUser "${username}" already exists. Updating password...`);
      existing.password = password;
      if (name.trim()) existing.name = name.trim();
      existing.role = 'admin';
      existing.isActive = true;
      await existing.save();
      console.log(`[SUCCESS] Admin user "${username}" updated successfully!`);
    } else {
      await User.create({
        username: username.toLowerCase().trim(),
        password,
        name: name.trim() || 'CPN Administrator',
        role: 'admin',
        isActive: true,
      });
      console.log(`\n[SUCCESS] Admin user "${username}" created securely in MongoDB!`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n[ERROR] Provisioning failed:', error.message);
    process.exit(1);
  }
};

provisionAdmin();

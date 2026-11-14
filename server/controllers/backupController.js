const Vegetable = require('../models/Vegetable');
const Customer = require('../models/Customer');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// @desc Export full database backup as JSON
// @route GET /api/backup/export
const exportBackup = async (req, res) => {
  try {
    const [vegetables, customers, bills, payments, settings, auditLogs] = await Promise.all([
      Vegetable.find(),
      Customer.find(),
      Bill.find(),
      Payment.find(),
      Settings.find(),
      AuditLog.find().sort({ createdAt: -1 }).limit(1000),
    ]);

    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      shop: 'CPN VEGETABLES, Dindigul',
      collections: {
        vegetables,
        customers,
        bills,
        payments,
        settings,
        auditLogs,
      },
      counts: {
        vegetables: vegetables.length,
        customers: customers.length,
        bills: bills.length,
        payments: payments.length,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="CPN_Vegetables_Backup_${Date.now()}.json"`);
    res.json(backupData);
  } catch (error) {
    console.error('[Backup] exportBackup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Restore database from uploaded JSON backup
// @route POST /api/backup/restore
const restoreBackup = async (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || !backupData.collections) {
      return res.status(400).json({ success: false, message: 'Invalid backup data format' });
    }

    const { vegetables, customers, bills, payments, settings } = backupData.collections;

    let restoredVegetables = 0;
    let restoredCustomers = 0;
    let restoredBills = 0;
    let restoredPayments = 0;

    if (Array.isArray(vegetables) && vegetables.length > 0) {
      for (const item of vegetables) {
        await Vegetable.findByIdAndUpdate(item._id, item, { upsert: true, new: true });
        restoredVegetables++;
      }
    }

    if (Array.isArray(customers) && customers.length > 0) {
      for (const cust of customers) {
        await Customer.findByIdAndUpdate(cust._id, cust, { upsert: true, new: true });
        restoredCustomers++;
      }
    }

    if (Array.isArray(bills) && bills.length > 0) {
      for (const b of bills) {
        await Bill.findByIdAndUpdate(b._id, b, { upsert: true, new: true });
        restoredBills++;
      }
    }

    if (Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        await Payment.findByIdAndUpdate(p._id, p, { upsert: true, new: true });
        restoredPayments++;
      }
    }

    if (Array.isArray(settings) && settings.length > 0) {
      await Settings.deleteMany({});
      await Settings.create(settings[0]);
    }

    await AuditLog.create({
      action: 'restore_database_backup',
      entityType: 'settings',
      entityId: 'backup',
      performedBy: req.user ? req.user.username : 'admin',
      notes: `Restored ${restoredBills} bills, ${restoredCustomers} customers, ${restoredVegetables} vegetables`,
    });

    res.json({
      success: true,
      message: 'Database backup restored successfully',
      restored: {
        vegetables: restoredVegetables,
        customers: restoredCustomers,
        bills: restoredBills,
        payments: restoredPayments,
      },
    });
  } catch (error) {
    console.error('[Backup] restoreBackup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  exportBackup,
  restoreBackup,
};

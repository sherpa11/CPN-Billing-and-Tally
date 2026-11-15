const Vegetable = require('../models/Vegetable');
const AuditLog = require('../models/AuditLog');

// @desc Get all vegetables with search & active filter
// @route GET /api/vegetables
const getVegetables = async (req, res) => {
  try {
    const { search, activeOnly, limit } = req.query;
    let query = { isDeleted: false };

    if (activeOnly === 'true' || activeOnly === undefined) {
      query.isActive = true;
    } else if (activeOnly === 'all') {
      delete query.isActive;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { tamilName: searchRegex },
      ];
    }

    const maxLimit = limit ? parseInt(limit, 10) : 500;
    // High performance query: use .lean() with composite index matching sort order
    const vegetables = await Vegetable.find(query)
      .select('name normalizedName tamilName defaultRate unit isActive sortOrder usageCount')
      .sort({ usageCount: -1, sortOrder: 1, name: 1 })
      .limit(maxLimit)
      .lean();

    res.json({
      success: true,
      count: vegetables.length,
      data: vegetables,
    });
  } catch (error) {
    console.error('[Vegetable] getVegetables error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single vegetable
// @route GET /api/vegetables/:id
const getVegetableById = async (req, res) => {
  try {
    const vegetable = await Vegetable.findById(req.params.id).lean();
    if (!vegetable || vegetable.isDeleted) {
      return res.status(404).json({ success: false, message: 'Vegetable not found' });
    }
    res.json({ success: true, data: vegetable });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create a new vegetable
// @route POST /api/vegetables
const createVegetable = async (req, res) => {
  try {
    const { name, tamilName, defaultRate, unit, isActive } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Vegetable name is required' });
    }

    const normalizedName = name.trim().toLowerCase();
    const existing = await Vegetable.findOne({ normalizedName, isDeleted: false });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Vegetable "${name}" already exists`,
        data: existing,
      });
    }

    // Check if was previously soft-deleted, reactivate
    const deletedExisting = await Vegetable.findOne({ normalizedName, isDeleted: true });
    if (deletedExisting) {
      deletedExisting.isDeleted = false;
      deletedExisting.isActive = isActive !== undefined ? isActive : true;
      deletedExisting.name = name.trim();
      deletedExisting.tamilName = tamilName ? tamilName.trim() : deletedExisting.tamilName;
      deletedExisting.defaultRate = Number(defaultRate) || 0;
      deletedExisting.unit = unit || 'Kg';
      await deletedExisting.save();

      await AuditLog.create({
        action: 'restore',
        entityType: 'vegetable',
        entityId: deletedExisting._id.toString(),
        performedBy: req.user ? req.user.username : 'admin',
        newState: deletedExisting.toObject(),
      });

      return res.status(200).json({
        success: true,
        message: 'Reactivated existing vegetable',
        data: deletedExisting,
      });
    }

    const vegetable = await Vegetable.create({
      name: name.trim(),
      normalizedName,
      tamilName: tamilName ? tamilName.trim() : '',
      defaultRate: Number(defaultRate) || 0,
      unit: unit || 'Kg',
      isActive: isActive !== undefined ? isActive : true,
    });

    await AuditLog.create({
      action: 'create',
      entityType: 'vegetable',
      entityId: vegetable._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      newState: vegetable.toObject(),
    });

    res.status(201).json({
      success: true,
      message: 'Vegetable created successfully',
      data: vegetable,
    });
  } catch (error) {
    console.error('[Vegetable] createVegetable error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Quick Add Vegetable while billing (Atomic, frictionless, returns object for auto-select)
// @route POST /api/vegetables/quick-add
const quickAddVegetable = async (req, res) => {
  try {
    const { name, tamilName, defaultRate, unit } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Vegetable name is required' });
    }

    const normalizedName = name.trim().toLowerCase();
    let vegetable = await Vegetable.findOne({ normalizedName, isDeleted: false });

    if (vegetable) {
      // If already exists, ensure active and return it
      if (!vegetable.isActive) {
        vegetable.isActive = true;
        await vegetable.save();
      }
      return res.status(200).json({
        success: true,
        message: 'Vegetable already exists, selected successfully',
        data: vegetable,
        isExisting: true,
      });
    }

    vegetable = await Vegetable.create({
      name: name.trim(),
      normalizedName,
      tamilName: tamilName ? tamilName.trim() : '',
      defaultRate: Number(defaultRate) || 0,
      unit: unit || 'Kg',
      isActive: true,
      usageCount: 1,
    });

    await AuditLog.create({
      action: 'quick_add_during_billing',
      entityType: 'vegetable',
      entityId: vegetable._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      newState: vegetable.toObject(),
    });

    res.status(201).json({
      success: true,
      message: 'Vegetable added instantly and saved to master',
      data: vegetable,
      isExisting: false,
    });
  } catch (error) {
    console.error('[Vegetable] quickAddVegetable error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update vegetable
// @route PUT /api/vegetables/:id
const updateVegetable = async (req, res) => {
  try {
    const { name, tamilName, defaultRate, unit, isActive, sortOrder } = req.body;
    const vegetable = await Vegetable.findById(req.params.id);

    if (!vegetable || vegetable.isDeleted) {
      return res.status(404).json({ success: false, message: 'Vegetable not found' });
    }

    const previousState = vegetable.toObject();

    if (name && name.trim() !== '') {
      const normalizedName = name.trim().toLowerCase();
      // Check duplicate with another ID
      const conflict = await Vegetable.findOne({
        normalizedName,
        _id: { $ne: vegetable._id },
        isDeleted: false,
      });
      if (conflict) {
        return res.status(409).json({ success: false, message: `Another vegetable with name "${name}" already exists` });
      }
      vegetable.name = name.trim();
      vegetable.normalizedName = normalizedName;
    }

    if (tamilName !== undefined) vegetable.tamilName = tamilName.trim();
    if (defaultRate !== undefined) vegetable.defaultRate = Number(defaultRate) || 0;
    if (unit !== undefined) vegetable.unit = unit.trim();
    if (isActive !== undefined) vegetable.isActive = Boolean(isActive);
    if (sortOrder !== undefined) vegetable.sortOrder = Number(sortOrder) || 0;

    await vegetable.save();

    await AuditLog.create({
      action: 'update',
      entityType: 'vegetable',
      entityId: vegetable._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
      previousState,
      newState: vegetable.toObject(),
    });

    res.json({
      success: true,
      message: 'Vegetable updated successfully',
      data: vegetable,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Delete (soft) or toggle vegetable
// @route DELETE /api/vegetables/:id
const deleteVegetable = async (req, res) => {
  try {
    const vegetable = await Vegetable.findById(req.params.id);
    if (!vegetable || vegetable.isDeleted) {
      return res.status(404).json({ success: false, message: 'Vegetable not found' });
    }

    // Soft delete to protect historical bills
    vegetable.isDeleted = true;
    vegetable.isActive = false;
    await vegetable.save();

    await AuditLog.create({
      action: 'delete_soft',
      entityType: 'vegetable',
      entityId: vegetable._id.toString(),
      performedBy: req.user ? req.user.username : 'admin',
    });

    res.json({
      success: true,
      message: 'Vegetable deleted safely from master',
      data: vegetable,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getVegetables,
  getVegetableById,
  createVegetable,
  quickAddVegetable,
  updateVegetable,
  deleteVegetable,
};

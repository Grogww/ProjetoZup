const subcategoriesService = require('../services/subcategoriesService');

const list = async (req, res, next) => {
  try {
    const subcategories = await subcategoriesService.listSubcategories();
    res.json(subcategories);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const subcategory = await subcategoriesService.getSubcategoryById(id);
    if (!subcategory) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    res.json(subcategory);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { category_id, name, description, icon, is_active } = req.body || {};

    if (!Number.isInteger(category_id) || category_id <= 0) {
      return res.status(400).json({ error: 'category_id is required and must be a positive integer' });
    }
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'name must be at most 100 characters' });
    }
    if (icon !== undefined && icon !== null && (typeof icon !== 'string' || icon.length > 50)) {
      return res.status(400).json({ error: 'icon must be a string up to 50 characters' });
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    const subcategory = await subcategoriesService.createSubcategory({
      category_id,
      name: name.trim(),
      description,
      icon,
      is_active,
    });

    res.status(201).json(subcategory);
  } catch (err) {
    if (err.code === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'SUBCATEGORY_NAME_CONFLICT') {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const deleted = await subcategoriesService.deleteSubcategory(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    res.status(204).send();
  } catch (err) {
    if (err.code === 'SUBCATEGORY_IN_USE') {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
};

module.exports = { list, getById, create, remove };

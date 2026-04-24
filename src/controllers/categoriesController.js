const categoriesService = require('../services/categoriesService');

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const list = async (req, res, next) => {
  try {
    const categories = await categoriesService.listCategories();
    res.json(categories);
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

    const category = await categoriesService.getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, description, icon, color, is_active } = req.body || {};

    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'name must be at most 100 characters' });
    }
    if (icon !== undefined && icon !== null && (typeof icon !== 'string' || icon.length > 50)) {
      return res.status(400).json({ error: 'icon must be a string up to 50 characters' });
    }
    if (color !== undefined && color !== null && (typeof color !== 'string' || !HEX_COLOR_REGEX.test(color))) {
      return res.status(400).json({ error: 'color must be a hex string like #RRGGBB' });
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    const category = await categoriesService.createCategory({
      name: name.trim(),
      description,
      icon,
      color,
      is_active,
    });

    res.status(201).json(category);
  } catch (err) {
    if (err.code === 'CATEGORY_NAME_CONFLICT') {
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

    const deleted = await categoriesService.deleteCategory(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.status(204).send();
  } catch (err) {
    if (err.code === 'CATEGORY_IN_USE') {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
};

module.exports = { list, getById, create, remove };

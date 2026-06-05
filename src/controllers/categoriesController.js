const categoriesService = require('../services/categoriesService');
const { slugify } = require('../utils/slugify');

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 120;

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
    const { name, slug, description, icon, color, is_active } = req.body || {};

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

    // slug: usa o informado (validado) ou deriva do nome.
    let finalSlug;
    if (slug !== undefined && slug !== null) {
      if (typeof slug !== 'string' || slug.length > SLUG_MAX || !SLUG_REGEX.test(slug)) {
        return res.status(400).json({ error: `slug must be lowercase alphanumeric words separated by hyphens, up to ${SLUG_MAX} characters` });
      }
      finalSlug = slug;
    } else {
      finalSlug = slugify(name);
      if (!finalSlug) {
        return res.status(400).json({ error: 'could not derive slug from name; provide slug explicitly' });
      }
    }

    const category = await categoriesService.createCategory({
      name: name.trim(),
      slug: finalSlug,
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
    if (err.code === 'CATEGORY_SLUG_CONFLICT') {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { name, slug, description, icon, color, is_active } = req.body || {};
    const patch = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      if (name.length > 100) {
        return res.status(400).json({ error: 'name must be at most 100 characters' });
      }
      patch.name = name.trim();
    }

    if (slug !== undefined) {
      if (typeof slug !== 'string' || slug.length > SLUG_MAX || !SLUG_REGEX.test(slug)) {
        return res.status(400).json({ error: `slug must be lowercase alphanumeric words separated by hyphens, up to ${SLUG_MAX} characters` });
      }
      patch.slug = slug;
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be a string or null' });
      }
      patch.description = description;
    }

    if (icon !== undefined) {
      if (icon !== null && (typeof icon !== 'string' || icon.length > 50)) {
        return res.status(400).json({ error: 'icon must be a string up to 50 characters' });
      }
      patch.icon = icon;
    }

    if (color !== undefined) {
      if (color !== null && (typeof color !== 'string' || !HEX_COLOR_REGEX.test(color))) {
        return res.status(400).json({ error: 'color must be a hex string like #RRGGBB' });
      }
      patch.color = color;
    }

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'is_active must be a boolean' });
      }
      patch.is_active = is_active;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const category = await categoriesService.updateCategory(id, patch);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (err) {
    if (err.code === 'CATEGORY_NAME_CONFLICT') {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === 'CATEGORY_SLUG_CONFLICT') {
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

module.exports = { list, getById, create, update, remove };

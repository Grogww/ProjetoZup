const categoriesModel = require('../models/categoriesModel');

const listCategories = async () => {
  return categoriesModel.findAll();
};

const getCategoryById = async (id) => {
  return categoriesModel.findById(id);
};

const createCategory = async (data) => {
  if (await categoriesModel.findByName(data.name)) {
    const err = new Error('Category name already exists');
    err.code = 'CATEGORY_NAME_CONFLICT';
    throw err;
  }
  if (await categoriesModel.findBySlug(data.slug)) {
    const err = new Error('Category slug already exists');
    err.code = 'CATEGORY_SLUG_CONFLICT';
    throw err;
  }
  return categoriesModel.create(data);
};

// Atualização parcial. Revalida conflitos de nome/slug (ignorando a própria
// linha) apenas para os campos efetivamente informados. Retorna null se a
// categoria não existir.
const updateCategory = async (id, patch) => {
  const existing = await categoriesModel.findById(id);
  if (!existing) return null;

  if (patch.name !== undefined && (await categoriesModel.findByName(patch.name, id))) {
    const err = new Error('Category name already exists');
    err.code = 'CATEGORY_NAME_CONFLICT';
    throw err;
  }
  if (patch.slug !== undefined && (await categoriesModel.findBySlug(patch.slug, id))) {
    const err = new Error('Category slug already exists');
    err.code = 'CATEGORY_SLUG_CONFLICT';
    throw err;
  }

  return categoriesModel.update(id, patch);
};

const deleteCategory = async (id) => {
  const existing = await categoriesModel.findById(id);
  if (!existing) return false;

  try {
    return await categoriesModel.remove(id);
  } catch (err) {
    if (err.code === '23503') {
      const conflict = new Error('Category is referenced by existing occurrences');
      conflict.code = 'CATEGORY_IN_USE';
      throw conflict;
    }
    throw err;
  }
};

module.exports = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};

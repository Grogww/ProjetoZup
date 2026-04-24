const categoriesModel = require('../models/categoriesModel');

const listCategories = async () => {
  return categoriesModel.findAll();
};

const getCategoryById = async (id) => {
  return categoriesModel.findById(id);
};

const createCategory = async (data) => {
  const existing = await categoriesModel.findByName(data.name);
  if (existing) {
    const err = new Error('Category name already exists');
    err.code = 'CATEGORY_NAME_CONFLICT';
    throw err;
  }
  return categoriesModel.create(data);
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
  deleteCategory,
};

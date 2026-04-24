const subcategoriesModel = require('../models/subcategoriesModel');
const categoriesModel = require('../models/categoriesModel');

const listSubcategories = async () => {
  return subcategoriesModel.findAll();
};

const getSubcategoryById = async (id) => {
  return subcategoriesModel.findById(id);
};

const createSubcategory = async (data) => {
  const category = await categoriesModel.findById(data.category_id);
  if (!category) {
    const err = new Error('Category not found');
    err.code = 'CATEGORY_NOT_FOUND';
    throw err;
  }

  const existing = await subcategoriesModel.findByCategoryAndName(data.category_id, data.name);
  if (existing) {
    const err = new Error('Subcategory name already exists for this category');
    err.code = 'SUBCATEGORY_NAME_CONFLICT';
    throw err;
  }
  return subcategoriesModel.create(data);
};

const deleteSubcategory = async (id) => {
  const existing = await subcategoriesModel.findById(id);
  if (!existing) return false;

  try {
    return await subcategoriesModel.remove(id);
  } catch (err) {
    if (err.code === '23503') {
      const conflict = new Error('Subcategory is referenced by existing occurrences');
      conflict.code = 'SUBCATEGORY_IN_USE';
      throw conflict;
    }
    throw err;
  }
};

module.exports = {
  listSubcategories,
  getSubcategoryById,
  createSubcategory,
  deleteSubcategory,
};

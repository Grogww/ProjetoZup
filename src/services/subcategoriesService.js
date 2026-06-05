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

  if (await subcategoriesModel.findByCategoryAndName(data.category_id, data.name)) {
    const err = new Error('Subcategory name already exists for this category');
    err.code = 'SUBCATEGORY_NAME_CONFLICT';
    throw err;
  }
  if (await subcategoriesModel.findByCategoryAndSlug(data.category_id, data.slug)) {
    const err = new Error('Subcategory slug already exists for this category');
    err.code = 'SUBCATEGORY_SLUG_CONFLICT';
    throw err;
  }
  return subcategoriesModel.create(data);
};

// Atualização parcial. Preserva a validação cruzada: se a categoria mudar, ela
// precisa existir; nome e slug seguem únicos dentro da categoria-alvo (a nova,
// se informada, senão a atual), ignorando a própria linha. Retorna null se a
// subcategoria não existir.
const updateSubcategory = async (id, patch) => {
  const existing = await subcategoriesModel.findById(id);
  if (!existing) return null;

  const targetCategoryId = patch.category_id ?? existing.category_id;

  if (patch.category_id !== undefined && patch.category_id !== existing.category_id) {
    const category = await categoriesModel.findById(patch.category_id);
    if (!category) {
      const err = new Error('Category not found');
      err.code = 'CATEGORY_NOT_FOUND';
      throw err;
    }
  }

  // Nome e slug precisam ser revalidados se eles mudaram OU se a categoria mudou
  // (o mesmo nome/slug pode já existir na categoria de destino).
  const name = patch.name ?? existing.name;
  const slug = patch.slug ?? existing.slug;

  if (await subcategoriesModel.findByCategoryAndName(targetCategoryId, name, id)) {
    const err = new Error('Subcategory name already exists for this category');
    err.code = 'SUBCATEGORY_NAME_CONFLICT';
    throw err;
  }
  if (await subcategoriesModel.findByCategoryAndSlug(targetCategoryId, slug, id)) {
    const err = new Error('Subcategory slug already exists for this category');
    err.code = 'SUBCATEGORY_SLUG_CONFLICT';
    throw err;
  }

  return subcategoriesModel.update(id, patch);
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
  updateSubcategory,
  deleteSubcategory,
};

const occurrencesModel = require('../models/occurrencesModel');
const categoriesModel = require('../models/categoriesModel');
const subcategoriesModel = require('../models/subcategoriesModel');
const neighborhoodsModel = require('../models/neighborhoodsModel');
const evaluationsService = require('./evaluationsService');

const ANTIDUPLICITY_RADIUS_M = 500;

const listOccurrences = async (filters) => {
  return occurrencesModel.findAll(filters);
};

const getOccurrenceById = async (id, { userId } = {}) => {
  const occurrence = await occurrencesModel.findById(id);
  if (!occurrence) return null;

  const voted_user = userId
    ? await evaluationsService.getUserVote(userId, id)
    : null;

  return { ...occurrence, voted_user };
};

const listNearbyOccurrences = async ({ latitude, longitude, radius_m }) => {
  return occurrencesModel.findNearby({
    latitude,
    longitude,
    radius_m: radius_m ?? ANTIDUPLICITY_RADIUS_M,
  });
};

const createOccurrence = async (data) => {
  const category = await categoriesModel.findById(data.category_id);
  if (!category) {
    const err = new Error('Category not found');
    err.code = 'CATEGORY_NOT_FOUND';
    throw err;
  }

  if (data.subcategory_id !== undefined && data.subcategory_id !== null) {
    const subcategory = await subcategoriesModel.findById(data.subcategory_id);
    if (!subcategory) {
      const err = new Error('Subcategory not found');
      err.code = 'SUBCATEGORY_NOT_FOUND';
      throw err;
    }
    if (subcategory.category_id !== data.category_id) {
      const err = new Error('Subcategory does not belong to the given category');
      err.code = 'SUBCATEGORY_CATEGORY_MISMATCH';
      throw err;
    }
  }

  if (data.neighborhood_id !== undefined && data.neighborhood_id !== null) {
    const neighborhood = await neighborhoodsModel.findById(data.neighborhood_id);
    if (!neighborhood) {
      const err = new Error('Neighborhood not found');
      err.code = 'NEIGHBORHOOD_NOT_FOUND';
      throw err;
    }
  }

  if (data.parent_occurrence_id !== undefined && data.parent_occurrence_id !== null) {
    const parent = await occurrencesModel.findById(data.parent_occurrence_id);
    if (!parent) {
      const err = new Error('Parent occurrence not found');
      err.code = 'PARENT_OCCURRENCE_NOT_FOUND';
      throw err;
    }
  }

  const nearby = await occurrencesModel.findNearby({
    latitude: data.latitude,
    longitude: data.longitude,
    radius_m: ANTIDUPLICITY_RADIUS_M,
  });
  const duplicate = nearby.find(
    (o) => o.category_id === data.category_id && o.status !== 'closed'
  );
  if (duplicate) {
    const err = new Error('A similar open occurrence already exists within 500m');
    err.code = 'OCCURRENCE_DUPLICATE';
    err.details = { duplicate_id: duplicate.id, distance_m: duplicate.distance_m };
    throw err;
  }

  return occurrencesModel.create(data);
};

const updateOccurrenceStatus = async (id, status) => {
  const existing = await occurrencesModel.findById(id);
  if (!existing) return null;
  return occurrencesModel.updateStatus(id, status);
};

const deleteOccurrence = async (id) => {
  const existing = await occurrencesModel.findById(id);
  if (!existing) return false;

  try {
    return await occurrencesModel.remove(id);
  } catch (err) {
    if (err.code === '23503') {
      const conflict = new Error('Occurrence is referenced by other records');
      conflict.code = 'OCCURRENCE_IN_USE';
      throw conflict;
    }
    throw err;
  }
};

module.exports = {
  listOccurrences,
  getOccurrenceById,
  listNearbyOccurrences,
  createOccurrence,
  updateOccurrenceStatus,
  deleteOccurrence,
  ANTIDUPLICITY_RADIUS_M,
};

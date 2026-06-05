const neighborhoodsModel = require('../models/neighborhoodsModel');
const occurrencesModel = require('../models/occurrencesModel');

const listNeighborhoods = async () => {
  return neighborhoodsModel.findAll();
};

const getNeighborhoodById = async (id) => {
  return neighborhoodsModel.findById(id);
};

const getNeighborhoodOccurrences = async (id) => {
  const neighborhood = await neighborhoodsModel.findById(id);
  if (!neighborhood) return null;

  return occurrencesModel.findAll({ neighborhood_id: id });
};

// Geofencing: resolve um ponto (lat/lng) para o bairro que o contém.
const locateByPoint = async ({ latitude, longitude }) => {
  return neighborhoodsModel.findByPoint(longitude, latitude);
};

module.exports = {
  listNeighborhoods,
  getNeighborhoodById,
  getNeighborhoodOccurrences,
  locateByPoint,
};

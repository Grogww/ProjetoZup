const neighborhoodsModel = require('../models/neighborhoodsModel');

const listNeighborhoods = async () => {
  return neighborhoodsModel.findAll();
};

const getNeighborhoodById = async (id) => {
  return neighborhoodsModel.findById(id);
};

module.exports = { listNeighborhoods, getNeighborhoodById };

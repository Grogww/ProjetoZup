const neighborhoodsService = require('../services/neighborhoodsService');

const list = async (req, res, next) => {
  try {
    const neighborhoods = await neighborhoodsService.listNeighborhoods();
    res.json(neighborhoods);
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

    const neighborhood = await neighborhoodsService.getNeighborhoodById(id);
    if (!neighborhood) {
      return res.status(404).json({ error: 'Neighborhood not found' });
    }

    res.json(neighborhood);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById };

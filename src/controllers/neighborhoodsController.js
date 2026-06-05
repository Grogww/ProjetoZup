const neighborhoodsService = require('../services/neighborhoodsService');

const parseLatitude = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= -90 && n <= 90 ? n : null;
};

const parseLongitude = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
};

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

// Geofencing: GET /neighborhoods/locate?lat=&lng= → bairro que contém o ponto.
const locate = async (req, res, next) => {
  try {
    const latitude = parseLatitude(req.query.lat ?? req.query.latitude);
    const longitude = parseLongitude(req.query.lng ?? req.query.longitude);

    if (latitude === null) {
      return res.status(400).json({ error: 'lat is required and must be between -90 and 90' });
    }
    if (longitude === null) {
      return res.status(400).json({ error: 'lng is required and must be between -180 and 180' });
    }

    const neighborhood = await neighborhoodsService.locateByPoint({ latitude, longitude });
    if (!neighborhood) {
      return res.status(404).json({ error: 'No neighborhood contains this point' });
    }

    res.json(neighborhood);
  } catch (err) {
    next(err);
  }
};

const listOccurrences = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const result = await neighborhoodsService.getNeighborhoodOccurrences(id);
    if (!result) {
      return res.status(404).json({ error: 'Neighborhood not found' });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, locate, getById, listOccurrences };

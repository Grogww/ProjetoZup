const occurrencesService = require('../services/occurrencesService');

const VALID_STATUSES = ['pending', 'in_progress', 'resolved', 'rejected', 'closed'];

const parsePositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

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
    const filters = {};

    if (req.query.status !== undefined) {
      if (!VALID_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      filters.status = req.query.status;
    }

    for (const key of [
      'category_id',
      'subcategory_id',
      'neighborhood_id',
      'author_id',
      'assigned_organization_id',
    ]) {
      if (req.query[key] !== undefined) {
        const n = parsePositiveInt(req.query[key]);
        if (n === null) {
          return res.status(400).json({ error: `${key} must be a positive integer` });
        }
        filters[key] = n;
      }
    }

    if (req.query.limit !== undefined) {
      const n = parsePositiveInt(req.query.limit);
      if (n === null || n > 200) {
        return res.status(400).json({ error: 'limit must be a positive integer up to 200' });
      }
      filters.limit = n;
    }
    if (req.query.offset !== undefined) {
      const n = Number(req.query.offset);
      if (!Number.isInteger(n) || n < 0) {
        return res.status(400).json({ error: 'offset must be a non-negative integer' });
      }
      filters.offset = n;
    }

    const occurrences = await occurrencesService.listOccurrences(filters);
    res.json(occurrences);
  } catch (err) {
    next(err);
  }
};

const nearby = async (req, res, next) => {
  try {
    const latitude = parseLatitude(req.query.lat ?? req.query.latitude);
    const longitude = parseLongitude(req.query.lng ?? req.query.longitude);

    if (latitude === null) {
      return res.status(400).json({ error: 'lat is required and must be between -90 and 90' });
    }
    if (longitude === null) {
      return res.status(400).json({ error: 'lng is required and must be between -180 and 180' });
    }

    let radius_m;
    if (req.query.radius !== undefined) {
      const n = Number(req.query.radius);
      if (!Number.isFinite(n) || n <= 0 || n > 50000) {
        return res.status(400).json({ error: 'radius must be a positive number up to 50000 meters' });
      }
      radius_m = n;
    }

    const occurrences = await occurrencesService.listNearbyOccurrences({
      latitude,
      longitude,
      radius_m,
    });
    res.json(occurrences);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const userId = req.user && Number.isInteger(req.user.id) ? req.user.id : null;
    const occurrence = await occurrencesService.getOccurrenceById(id, { userId });
    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }
    res.json(occurrence);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const {
      title,
      description,
      latitude,
      longitude,
      address,
      category_id,
      subcategory_id,
      neighborhood_id,
      assigned_organization_id,
      parent_occurrence_id,
      status,
    } = req.body || {};

    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: 'title must be at most 200 characters' });
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ error: 'description is required' });
    }

    const lat = parseLatitude(latitude);
    const lng = parseLongitude(longitude);
    if (lat === null) {
      return res.status(400).json({ error: 'latitude is required and must be between -90 and 90' });
    }
    if (lng === null) {
      return res.status(400).json({ error: 'longitude is required and must be between -180 and 180' });
    }

    if (!Number.isInteger(category_id) || category_id <= 0) {
      return res.status(400).json({ error: 'category_id is required and must be a positive integer' });
    }

    for (const [key, value] of Object.entries({
      subcategory_id,
      neighborhood_id,
      assigned_organization_id,
      parent_occurrence_id,
    })) {
      if (value !== undefined && value !== null && (!Number.isInteger(value) || value <= 0)) {
        return res.status(400).json({ error: `${key} must be a positive integer` });
      }
    }

    if (address !== undefined && address !== null && typeof address !== 'string') {
      return res.status(400).json({ error: 'address must be a string' });
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    if (!req.user || !Number.isInteger(req.user.id)) {
      return res.status(401).json({ error: 'Authenticated user required' });
    }

    const occurrence = await occurrencesService.createOccurrence({
      title: title.trim(),
      description: description.trim(),
      latitude: lat,
      longitude: lng,
      address: address?.trim?.() ?? address ?? null,
      category_id,
      subcategory_id: subcategory_id ?? null,
      neighborhood_id: neighborhood_id ?? null,
      author_id: req.user.id,
      assigned_organization_id: assigned_organization_id ?? null,
      parent_occurrence_id: parent_occurrence_id ?? null,
      status,
    });

    res.status(201).json(occurrence);
  } catch (err) {
    if (err.code === 'CATEGORY_NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'SUBCATEGORY_NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'NEIGHBORHOOD_NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'PARENT_OCCURRENCE_NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'SUBCATEGORY_CATEGORY_MISMATCH') return res.status(400).json({ error: err.message });
    if (err.code === 'OCCURRENCE_DUPLICATE') {
      return res.status(409).json({ error: err.message, details: err.details });
    }
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const occurrence = await occurrencesService.updateOccurrenceStatus(id, status);
    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }
    res.json(occurrence);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const deleted = await occurrencesService.deleteOccurrence(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }
    res.status(204).send();
  } catch (err) {
    if (err.code === 'OCCURRENCE_IN_USE') {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
};

module.exports = { list, nearby, getById, create, updateStatus, remove };

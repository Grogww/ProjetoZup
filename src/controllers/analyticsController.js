const analyticsService = require('../services/analyticsService');
const { OCCURRENCE_STATUSES } = require('../services/occurrencesService');

const HEATMAP_DEFAULT_LIMIT = 5000;
const HEATMAP_MAX_LIMIT = 50000;
const GROUP_BY_OPTIONS = ['category', 'neighborhood', 'month'];

const parsePositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Filtros comuns a overview/by-neighborhood/response-time/by-organization.
// Retorna { filters } ou { error } (mensagem para 400).
const parseCommonFilters = (query, { allowStatus = true } = {}) => {
  const filters = {};

  for (const key of ['from', 'to']) {
    if (query[key] !== undefined) {
      if (typeof query[key] !== 'string' || Number.isNaN(Date.parse(query[key]))) {
        return { error: `${key} must be a valid date (e.g. 2026-01-01)` };
      }
      filters[key] = query[key];
    }
  }

  for (const key of ['category_id', 'subcategory_id', 'neighborhood_id']) {
    if (query[key] !== undefined) {
      const n = parsePositiveInt(query[key]);
      if (n === null) {
        return { error: `${key} must be a positive integer` };
      }
      filters[key] = n;
    }
  }

  if (allowStatus && query.status !== undefined) {
    if (!OCCURRENCE_STATUSES.includes(query.status)) {
      return { error: `status must be one of: ${OCCURRENCE_STATUSES.join(', ')}` };
    }
    filters.status = query.status;
  }

  return { filters };
};

const overview = async (req, res, next) => {
  try {
    const { filters, error } = parseCommonFilters(req.query);
    if (error) return res.status(400).json({ error });

    res.json(await analyticsService.getOverview(filters));
  } catch (err) {
    next(err);
  }
};

const byNeighborhood = async (req, res, next) => {
  try {
    const { filters, error } = parseCommonFilters(req.query);
    if (error) return res.status(400).json({ error });

    res.json(await analyticsService.getByNeighborhood(filters));
  } catch (err) {
    next(err);
  }
};

const heatmap = async (req, res, next) => {
  try {
    const filters = {};

    if (req.query.bbox !== undefined) {
      const parts = String(req.query.bbox).split(',').map(Number);
      if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
        return res.status(400).json({ error: 'bbox must be "min_lng,min_lat,max_lng,max_lat"' });
      }
      const [minLng, minLat, maxLng, maxLat] = parts;
      if (minLng < -180 || maxLng > 180 || minLng >= maxLng) {
        return res.status(400).json({ error: 'bbox longitudes must be within [-180,180] and min_lng < max_lng' });
      }
      if (minLat < -90 || maxLat > 90 || minLat >= maxLat) {
        return res.status(400).json({ error: 'bbox latitudes must be within [-90,90] and min_lat < max_lat' });
      }
      filters.bbox = { minLng, minLat, maxLng, maxLat };
    }

    if (req.query.status !== undefined) {
      if (!OCCURRENCE_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ error: `status must be one of: ${OCCURRENCE_STATUSES.join(', ')}` });
      }
      filters.status = req.query.status;
    }

    if (req.query.category_id !== undefined) {
      const n = parsePositiveInt(req.query.category_id);
      if (n === null) return res.status(400).json({ error: 'category_id must be a positive integer' });
      filters.category_id = n;
    }

    let limit = HEATMAP_DEFAULT_LIMIT;
    if (req.query.limit !== undefined) {
      const n = parsePositiveInt(req.query.limit);
      if (n === null || n > HEATMAP_MAX_LIMIT) {
        return res.status(400).json({ error: `limit must be a positive integer up to ${HEATMAP_MAX_LIMIT}` });
      }
      limit = n;
    }
    filters.limit = limit;

    res.json(await analyticsService.getHeatmap(filters));
  } catch (err) {
    next(err);
  }
};

const responseTime = async (req, res, next) => {
  try {
    const { filters, error } = parseCommonFilters(req.query);
    if (error) return res.status(400).json({ error });

    let groupBy;
    if (req.query.group_by !== undefined) {
      if (!GROUP_BY_OPTIONS.includes(req.query.group_by)) {
        return res.status(400).json({ error: `group_by must be one of: ${GROUP_BY_OPTIONS.join(', ')}` });
      }
      groupBy = req.query.group_by;
    }

    res.json(await analyticsService.getResponseTime(filters, groupBy));
  } catch (err) {
    next(err);
  }
};

const byOrganization = async (req, res, next) => {
  try {
    // status não se aplica aqui (recorte é por órgão); só datas/categoria/bairro.
    const { filters, error } = parseCommonFilters(req.query, { allowStatus: false });
    if (error) return res.status(400).json({ error });

    res.json(await analyticsService.getByOrganization(filters));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  overview,
  byNeighborhood,
  heatmap,
  responseTime,
  byOrganization,
};

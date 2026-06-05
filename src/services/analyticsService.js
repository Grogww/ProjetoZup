const analyticsModel = require('../models/analyticsModel');

// pg devolve bigint/numeric como string. Normalizamos para number/null no JSON.
const toInt = (v) => (v === null || v === undefined ? 0 : parseInt(v, 10));
const toNum = (v) => (v === null || v === undefined ? null : Number(v));
const round = (v) => (v === null ? null : Math.round(v));
const rate = (num, den) => (den > 0 ? num / den : null);

const getOverview = async (filters) => {
  const [agg, topCategories] = await Promise.all([
    analyticsModel.getOverview(filters),
    analyticsModel.getTopCategories(filters),
  ]);

  const total = toInt(agg.total_occurrences);
  const distinctProblems = toInt(agg.distinct_problems);
  const resolved = toInt(agg.resolved_count);
  const reopenedProblems = toInt(agg.reopened_problems);

  return {
    total_occurrences: total,
    distinct_problems: distinctProblems,
    by_status_group: {
      open: toInt(agg.open_count),
      resolved,
      closed_unresolved: toInt(agg.closed_unresolved_count),
    },
    resolution_rate: rate(resolved, total),
    avg_response_seconds: round(toNum(agg.avg_response_seconds)),
    avg_resolution_seconds: round(toNum(agg.avg_resolution_seconds)),
    recurrence: {
      reopened_problems: reopenedProblems,
      recurrence_rate: rate(reopenedProblems, distinctProblems),
    },
    active_neighborhoods: toInt(agg.active_neighborhoods),
    top_categories: topCategories.map((c) => ({
      category_id: c.category_id,
      name: c.name,
      count: toInt(c.count),
    })),
  };
};

const getByNeighborhood = async (filters) => {
  const rows = await analyticsModel.getByNeighborhood(filters);
  return rows.map((r) => {
    const total = toInt(r.total);
    const population = r.population_estimate === null ? null : toInt(r.population_estimate);
    return {
      neighborhood_id: r.neighborhood_id, // null = "sem bairro"
      name: r.name,
      center_point: r.center_point,
      total,
      open: toInt(r.open),
      resolved: toInt(r.resolved),
      closed_unresolved: toInt(r.closed_unresolved),
      avg_resolution_seconds: round(toNum(r.avg_resolution_seconds)),
      population_estimate: population,
      per_capita: population && population > 0 ? total / population : null,
    };
  });
};

const getHeatmap = async (filters) => {
  const rows = await analyticsModel.getHeatmapPoints(filters);
  return rows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    weight: toInt(r.weight),
  }));
};

const shapeResponseTimeRow = (r) => ({
  avg_response_seconds: round(toNum(r.avg_response_seconds)),
  median_response_seconds: round(toNum(r.median_response_seconds)),
  avg_resolution_seconds: round(toNum(r.avg_resolution_seconds)),
  median_resolution_seconds: round(toNum(r.median_resolution_seconds)),
  sample_size_response: toInt(r.sample_size_response),
  sample_size_resolution: toInt(r.sample_size_resolution),
});

const getResponseTime = async (filters, groupBy) => {
  const summary = shapeResponseTimeRow(await analyticsModel.getResponseTimeSummary(filters));

  if (!groupBy) return summary;

  const { rows, keyName } = await analyticsModel.getResponseTimeBreakdown(filters, groupBy);
  const breakdown = rows.map((r) => ({
    [keyName]: keyName === 'month' && r.key ? new Date(r.key).toISOString().slice(0, 7) : r.key,
    ...(keyName !== 'month' ? { name: r.name } : {}),
    ...shapeResponseTimeRow(r),
  }));

  return { ...summary, group_by: groupBy, breakdown };
};

const getByOrganization = async (filters) => {
  const [rows, reopened] = await Promise.all([
    analyticsModel.getByOrganization(filters),
    analyticsModel.getReopenedByOrganization(),
  ]);

  const reopenedByOrg = new Map(
    reopened.map((r) => [r.organization_id, toInt(r.reopened_after_resolution)])
  );

  return rows.map((r) => {
    const total = toInt(r.assigned_total);
    const resolved = toInt(r.resolved);
    const open = toInt(r.open);
    return {
      organization_id: r.assigned_organization_id, // null = "sem órgão atribuído"
      name: r.name,
      assigned_total: total,
      resolved,
      open,
      backlog_open: open,
      resolution_rate: rate(resolved, total),
      avg_response_seconds: round(toNum(r.avg_response_seconds)),
      avg_resolution_seconds: round(toNum(r.avg_resolution_seconds)),
      reopened_after_resolution: reopenedByOrg.get(r.assigned_organization_id) ?? 0,
    };
  });
};

module.exports = {
  getOverview,
  getByNeighborhood,
  getHeatmap,
  getResponseTime,
  getByOrganization,
};

const pool = require('../config/database');

// Monta o WHERE comum das consultas sobre v_occurrence_metrics (alias m).
// Datas vêm como string (YYYY-MM-DD ou ISO) e são comparadas como timestamp
// naive — mesmo fuso em que occurrences.created_at é gravado (Brasília).
const buildMetricFilters = (filters = {}, startIndex = 1) => {
  const conditions = [];
  const values = [];
  let i = startIndex;

  if (filters.from !== undefined) {
    conditions.push(`m.created_at >= $${i++}`);
    values.push(filters.from);
  }
  if (filters.to !== undefined) {
    conditions.push(`m.created_at <= $${i++}`);
    values.push(filters.to);
  }
  if (filters.category_id !== undefined) {
    conditions.push(`m.category_id = $${i++}`);
    values.push(filters.category_id);
  }
  if (filters.subcategory_id !== undefined) {
    conditions.push(`m.subcategory_id = $${i++}`);
    values.push(filters.subcategory_id);
  }
  if (filters.neighborhood_id !== undefined) {
    conditions.push(`m.neighborhood_id = $${i++}`);
    values.push(filters.neighborhood_id);
  }
  if (filters.status !== undefined) {
    conditions.push(`m.status = $${i++}::occurrence_status`);
    values.push(filters.status);
  }

  const clause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, values, nextIndex: i };
};

// RF29 — agregados globais. recurrence é derivada da própria view (reopen_count
// > 0 marca uma ocorrência-filha de reabertura), respeitando os mesmos filtros.
const getOverview = async (filters) => {
  const { clause, values } = buildMetricFilters(filters);
  const { rows } = await pool.query(
    `SELECT
        count(*)                                                          AS total_occurrences,
        count(DISTINCT problem_id)                                        AS distinct_problems,
        count(*) FILTER (WHERE is_open)                                   AS open_count,
        count(*) FILTER (WHERE is_resolved)                              AS resolved_count,
        count(*) FILTER (WHERE is_closed_unresolved)                     AS closed_unresolved_count,
        count(DISTINCT neighborhood_id) FILTER (WHERE neighborhood_id IS NOT NULL) AS active_neighborhoods,
        count(DISTINCT problem_id) FILTER (WHERE reopen_count > 0)        AS reopened_problems,
        avg(response_seconds)                                            AS avg_response_seconds,
        avg(resolution_seconds)                                          AS avg_resolution_seconds
       FROM v_occurrence_metrics m
       ${clause}`,
    values
  );
  return rows[0];
};

const getTopCategories = async (filters, limit = 5) => {
  const { clause, values, nextIndex } = buildMetricFilters(filters);
  values.push(limit);
  const { rows } = await pool.query(
    `SELECT m.category_id,
            c.name,
            count(*) AS count
       FROM v_occurrence_metrics m
       JOIN categories c ON c.id = m.category_id
       ${clause}
      GROUP BY m.category_id, c.name
      ORDER BY count DESC, c.name ASC
      LIMIT $${nextIndex}`,
    values
  );
  return rows;
};

// RF30 — agregação por bairro. LEFT JOIN inclui o bucket neighborhood_id = NULL
// ("sem bairro"). center_point ajuda o front a posicionar no mapa.
const getByNeighborhood = async (filters) => {
  const { clause, values } = buildMetricFilters(filters);
  const { rows } = await pool.query(
    `SELECT
        m.neighborhood_id,
        n.name,
        ST_AsGeoJSON(n.center_point)::json                AS center_point,
        n.population_estimate,
        count(*)                                          AS total,
        count(*) FILTER (WHERE m.is_open)                 AS open,
        count(*) FILTER (WHERE m.is_resolved)             AS resolved,
        count(*) FILTER (WHERE m.is_closed_unresolved)    AS closed_unresolved,
        avg(m.resolution_seconds)                         AS avg_resolution_seconds
       FROM v_occurrence_metrics m
       LEFT JOIN neighborhoods n ON n.id = m.neighborhood_id
       ${clause}
      GROUP BY m.neighborhood_id, n.name, n.center_point, n.population_estimate
      ORDER BY total DESC, n.name ASC`,
    values
  );
  return rows;
};

// RF31 — pontos para o mapa de calor. Filtra por bbox (envelope), status e
// categoria; sempre com LIMIT de segurança. weight = 1 (densidade de ocorrências).
const getHeatmapPoints = async (filters = {}) => {
  const conditions = [];
  const values = [];
  let i = 1;

  if (filters.bbox) {
    const { minLng, minLat, maxLng, maxLat } = filters.bbox;
    conditions.push(
      `ST_Intersects(location, ST_MakeEnvelope($${i++}, $${i++}, $${i++}, $${i++}, 4326))`
    );
    values.push(minLng, minLat, maxLng, maxLat);
  }
  if (filters.status !== undefined) {
    conditions.push(`status = $${i++}::occurrence_status`);
    values.push(filters.status);
  }
  if (filters.category_id !== undefined) {
    conditions.push(`category_id = $${i++}`);
    values.push(filters.category_id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(filters.limit);
  const { rows } = await pool.query(
    `SELECT lat, lng, 1 AS weight
       FROM v_heatmap_points
       ${where}
      ORDER BY created_at DESC
      LIMIT $${i}`,
    values
  );
  return rows;
};

// RF32 — médias e medianas de resposta/resolução. percentile_cont e count(col)
// ignoram NULL, então sample_size reflete só o que tem o dado.
const getResponseTimeSummary = async (filters) => {
  const { clause, values } = buildMetricFilters(filters);
  const { rows } = await pool.query(
    `SELECT
        avg(response_seconds)                                                   AS avg_response_seconds,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY response_seconds)           AS median_response_seconds,
        avg(resolution_seconds)                                                 AS avg_resolution_seconds,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY resolution_seconds)         AS median_resolution_seconds,
        count(response_seconds)                                                 AS sample_size_response,
        count(resolution_seconds)                                               AS sample_size_resolution
       FROM v_occurrence_metrics m
       ${clause}`,
    values
  );
  return rows[0];
};

// RF32 — breakdown opcional por categoria, bairro ou mês.
const getResponseTimeBreakdown = async (filters, groupBy) => {
  const dimensions = {
    category: { expr: 'm.category_id', join: 'JOIN categories d ON d.id = m.category_id', label: 'd.name', key: 'category_id' },
    neighborhood: { expr: 'm.neighborhood_id', join: 'LEFT JOIN neighborhoods d ON d.id = m.neighborhood_id', label: 'd.name', key: 'neighborhood_id' },
    month: { expr: "date_trunc('month', m.created_at)", join: '', label: 'NULL::text', key: 'month' },
  };
  const dim = dimensions[groupBy];
  const { clause, values } = buildMetricFilters(filters);
  const { rows } = await pool.query(
    `SELECT
        ${dim.expr}                                                       AS key,
        ${dim.label}                                                      AS name,
        avg(response_seconds)                                            AS avg_response_seconds,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY response_seconds)     AS median_response_seconds,
        avg(resolution_seconds)                                          AS avg_resolution_seconds,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY resolution_seconds)   AS median_resolution_seconds,
        count(response_seconds)                                          AS sample_size_response,
        count(resolution_seconds)                                        AS sample_size_resolution
       FROM v_occurrence_metrics m
       ${dim.join}
       ${clause}
      GROUP BY ${dim.expr}, ${dim.label}
      ORDER BY ${dim.expr}`,
    values
  );
  return { rows, keyName: dim.key };
};

// RF33 — eficiência por órgão. LEFT JOIN inclui o bucket "sem órgão" (NULL).
const getByOrganization = async (filters) => {
  const { clause, values } = buildMetricFilters(filters);
  const { rows } = await pool.query(
    `SELECT
        m.assigned_organization_id,
        o.name,
        count(*)                                          AS assigned_total,
        count(*) FILTER (WHERE m.is_resolved)             AS resolved,
        count(*) FILTER (WHERE m.is_open)                 AS open,
        avg(m.response_seconds)                           AS avg_response_seconds,
        avg(m.resolution_seconds)                         AS avg_resolution_seconds
       FROM v_occurrence_metrics m
       LEFT JOIN organizations o ON o.id = m.assigned_organization_id
       ${clause}
      GROUP BY m.assigned_organization_id, o.name
      ORDER BY assigned_total DESC, o.name ASC`,
    values
  );
  return rows;
};

// RF33 — reincidências atribuídas a cada órgão: a ocorrência ORIGINAL (que esse
// órgão tratou) foi reaberta. Agrupado pelo órgão da original.
const getReopenedByOrganization = async () => {
  const { rows } = await pool.query(
    `SELECT orig.assigned_organization_id AS organization_id,
            count(*)                       AS reopened_after_resolution
       FROM occurrence_reopens r
       JOIN occurrences orig ON orig.id = r.original_occurrence_id
      GROUP BY orig.assigned_organization_id`
  );
  return rows;
};

module.exports = {
  getOverview,
  getTopCategories,
  getByNeighborhood,
  getHeatmapPoints,
  getResponseTimeSummary,
  getResponseTimeBreakdown,
  getByOrganization,
  getReopenedByOrganization,
};

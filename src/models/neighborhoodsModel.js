const pool = require('../config/database');

const findAll = async () => {
  const { rows } = await pool.query(
    `SELECT id, name, population_estimate
       FROM neighborhoods
       ORDER BY name`
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id,
            name,
            population_estimate,
            ST_AsGeoJSON(boundary)::json     AS boundary,
            ST_AsGeoJSON(center_point)::json AS center_point,
            created_at,
            updated_at
       FROM neighborhoods
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

module.exports = { findAll, findById };

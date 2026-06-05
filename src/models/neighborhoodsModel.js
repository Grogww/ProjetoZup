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

// Geofencing: bairro cujo polígono contém o ponto (lng, lat) em SRID 4326.
// Usa o índice gist de boundary (filtro de bbox + ST_Contains). Retorna null
// se o ponto não cai em nenhum bairro. ORDER BY id torna o resultado
// determinístico caso o ponto esteja exatamente sobre uma divisa compartilhada.
const findByPoint = async (longitude, latitude) => {
  const { rows } = await pool.query(
    `SELECT id, name, population_estimate
       FROM neighborhoods
      WHERE boundary IS NOT NULL
        AND ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      ORDER BY id
      LIMIT 1`,
    [longitude, latitude]
  );
  return rows[0] || null;
};

module.exports = { findAll, findById, findByPoint };

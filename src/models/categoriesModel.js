const pool = require('../config/database');

const findAll = async () => {
  const { rows } = await pool.query(
    `SELECT id, name, description, icon, color, is_active, created_at, updated_at
       FROM categories
       ORDER BY name`
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, name, description, icon, color, is_active, created_at, updated_at
       FROM categories
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

const findByName = async (name) => {
  const { rows } = await pool.query(
    `SELECT id FROM categories WHERE name = $1`,
    [name]
  );
  return rows[0] || null;
};

const create = async ({ name, description, icon, color, is_active }) => {
  const { rows } = await pool.query(
    `INSERT INTO categories (name, description, icon, color, is_active)
          VALUES ($1, $2, $3, $4, COALESCE($5, true))
       RETURNING id, name, description, icon, color, is_active, created_at, updated_at`,
    [name, description ?? null, icon ?? null, color ?? null, is_active ?? null]
  );
  return rows[0];
};

const remove = async (id) => {
  const { rowCount } = await pool.query(
    `DELETE FROM categories WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

module.exports = { findAll, findById, findByName, create, remove };

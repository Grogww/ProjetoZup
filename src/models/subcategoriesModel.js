const pool = require('../config/database');

const findAll = async () => {
  const { rows } = await pool.query(
    `SELECT id, category_id, name, description, icon, is_active, created_at, updated_at
       FROM subcategories
       ORDER BY category_id, name`
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, category_id, name, description, icon, is_active, created_at, updated_at
       FROM subcategories
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

const findByCategoryAndName = async (categoryId, name) => {
  const { rows } = await pool.query(
    `SELECT id FROM subcategories WHERE category_id = $1 AND name = $2`,
    [categoryId, name]
  );
  return rows[0] || null;
};

const create = async ({ category_id, name, description, icon, is_active }) => {
  const { rows } = await pool.query(
    `INSERT INTO subcategories (category_id, name, description, icon, is_active)
          VALUES ($1, $2, $3, $4, COALESCE($5, true))
       RETURNING id, category_id, name, description, icon, is_active, created_at, updated_at`,
    [category_id, name, description ?? null, icon ?? null, is_active ?? null]
  );
  return rows[0];
};

const remove = async (id) => {
  const { rowCount } = await pool.query(
    `DELETE FROM subcategories WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

module.exports = { findAll, findById, findByCategoryAndName, create, remove };

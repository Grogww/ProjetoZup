const pool = require('../config/database');

const findAll = async () => {
  const { rows } = await pool.query(
    `SELECT id, name, slug, description, icon, color, is_active, created_at, updated_at
       FROM categories
       ORDER BY name`
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, name, slug, description, icon, color, is_active, created_at, updated_at
       FROM categories
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

// Conflito de nome. excludeId permite ignorar a própria linha numa atualização.
const findByName = async (name, excludeId) => {
  const { rows } = await pool.query(
    `SELECT id FROM categories WHERE name = $1 AND ($2::int IS NULL OR id <> $2)`,
    [name, excludeId ?? null]
  );
  return rows[0] || null;
};

// Conflito de slug. excludeId permite ignorar a própria linha numa atualização.
const findBySlug = async (slug, excludeId) => {
  const { rows } = await pool.query(
    `SELECT id FROM categories WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)`,
    [slug, excludeId ?? null]
  );
  return rows[0] || null;
};

const create = async ({ name, slug, description, icon, color, is_active }) => {
  const { rows } = await pool.query(
    `INSERT INTO categories (name, slug, description, icon, color, is_active)
          VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
       RETURNING id, name, slug, description, icon, color, is_active, created_at, updated_at`,
    [name, slug, description ?? null, icon ?? null, color ?? null, is_active ?? null]
  );
  return rows[0];
};

// Atualização parcial: aplica apenas os campos presentes no patch.
const update = async (id, patch) => {
  const sets = [];
  const values = [];
  let i = 1;

  for (const column of ['name', 'slug', 'description', 'icon', 'color', 'is_active']) {
    if (patch[column] !== undefined) {
      sets.push(`${column} = $${i++}`);
      values.push(patch[column]);
    }
  }

  if (sets.length === 0) {
    return findById(id);
  }

  sets.push('updated_at = now()');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE categories
        SET ${sets.join(', ')}
      WHERE id = $${i}
      RETURNING id, name, slug, description, icon, color, is_active, created_at, updated_at`,
    values
  );
  return rows[0] || null;
};

const remove = async (id) => {
  const { rowCount } = await pool.query(
    `DELETE FROM categories WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

module.exports = { findAll, findById, findByName, findBySlug, create, update, remove };

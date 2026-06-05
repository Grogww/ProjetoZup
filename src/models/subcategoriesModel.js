const pool = require('../config/database');

const findAll = async () => {
  const { rows } = await pool.query(
    `SELECT id, category_id, name, slug, description, icon, is_active, created_at, updated_at
       FROM subcategories
       ORDER BY category_id, name`
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, category_id, name, slug, description, icon, is_active, created_at, updated_at
       FROM subcategories
      WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

// Conflito de nome dentro da categoria. excludeId ignora a própria linha numa atualização.
const findByCategoryAndName = async (categoryId, name, excludeId) => {
  const { rows } = await pool.query(
    `SELECT id FROM subcategories
      WHERE category_id = $1 AND name = $2 AND ($3::int IS NULL OR id <> $3)`,
    [categoryId, name, excludeId ?? null]
  );
  return rows[0] || null;
};

// Conflito de slug dentro da categoria. excludeId ignora a própria linha numa atualização.
const findByCategoryAndSlug = async (categoryId, slug, excludeId) => {
  const { rows } = await pool.query(
    `SELECT id FROM subcategories
      WHERE category_id = $1 AND slug = $2 AND ($3::int IS NULL OR id <> $3)`,
    [categoryId, slug, excludeId ?? null]
  );
  return rows[0] || null;
};

const create = async ({ category_id, name, slug, description, icon, is_active }) => {
  const { rows } = await pool.query(
    `INSERT INTO subcategories (category_id, name, slug, description, icon, is_active)
          VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
       RETURNING id, category_id, name, slug, description, icon, is_active, created_at, updated_at`,
    [category_id, name, slug, description ?? null, icon ?? null, is_active ?? null]
  );
  return rows[0];
};

// Atualização parcial: aplica apenas os campos presentes no patch.
const update = async (id, patch) => {
  const sets = [];
  const values = [];
  let i = 1;

  for (const column of ['category_id', 'name', 'slug', 'description', 'icon', 'is_active']) {
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
    `UPDATE subcategories
        SET ${sets.join(', ')}
      WHERE id = $${i}
      RETURNING id, category_id, name, slug, description, icon, is_active, created_at, updated_at`,
    values
  );
  return rows[0] || null;
};

const remove = async (id) => {
  const { rowCount } = await pool.query(
    `DELETE FROM subcategories WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

module.exports = {
  findAll,
  findById,
  findByCategoryAndName,
  findByCategoryAndSlug,
  create,
  update,
  remove,
};

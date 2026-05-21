const pool = require('../config/database');

const ALL_COLUMNS = `
  id,
  name,
  email,
  password_hash,
  role,
  avatar_url,
  neighborhood_id,
  is_active,
  email_verified_at,
  reset_token,
  reset_token_expires_at,
  refresh_token,
  created_at,
  updated_at
`;

const UPDATABLE_COLUMNS = ['name', 'email', 'password_hash', 'avatar_url', 'neighborhood_id'];

const findAll = async () => {
  const { rows } = await pool.query(
    `SELECT ${ALL_COLUMNS} FROM users ORDER BY id`
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT ${ALL_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

const findByEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT ${ALL_COLUMNS} FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
};

const create = async ({ name, email, password_hash, role, neighborhood_id }) => {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, neighborhood_id)
     VALUES ($1, $2, $3, COALESCE($4::user_role, 'citizen'::user_role), $5)
     RETURNING ${ALL_COLUMNS}`,
    [name, email, password_hash, role ?? null, neighborhood_id ?? null]
  );
  return rows[0];
};

const update = async (id, patch) => {
  const sets = [];
  const values = [];
  let i = 1;

  for (const column of UPDATABLE_COLUMNS) {
    if (patch[column] !== undefined) {
      sets.push(`${column} = $${i++}`);
      values.push(patch[column]);
    }
  }

  if (sets.length === 0) {
    return findById(id);
  }

  sets.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE users
        SET ${sets.join(', ')}
      WHERE id = $${i}
      RETURNING ${ALL_COLUMNS}`,
    values
  );
  return rows[0] || null;
};

const updateRole = async (id, role) => {
  const { rows } = await pool.query(
    `UPDATE users
        SET role = $2::user_role,
            updated_at = now()
      WHERE id = $1
      RETURNING ${ALL_COLUMNS}`,
    [id, role]
  );
  return rows[0] || null;
};

const updateRefreshToken = async (id, refreshToken) => {
  await pool.query(
    `UPDATE users
        SET refresh_token = $2,
            updated_at = now()
      WHERE id = $1`,
    [id, refreshToken]
  );
};

module.exports = {
  findAll,
  findById,
  findByEmail,
  create,
  update,
  updateRole,
  updateRefreshToken,
};

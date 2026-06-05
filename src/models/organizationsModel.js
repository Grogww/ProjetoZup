const pool = require('../config/database');

const findAll = async () => {
  const { rows } = await pool.query(
    `SELECT id, name, description, contact_email, contact_phone, is_active, created_at, updated_at
       FROM organizations
       ORDER BY name`
  );
  return rows;
};

module.exports = { findAll };

const pool = require('../config/database');

const BASE_SELECT = `
  SELECT id,
         occurrence_id,
         storage_key,
         original_name,
         mime_type,
         size_bytes,
         uploaded_by,
         created_at
    FROM occurrence_media
`;

const create = async (
  { occurrence_id, storage_key, original_name, mime_type, size_bytes, uploaded_by },
  client
) => {
  const runner = client || pool;
  const { rows } = await runner.query(
    `INSERT INTO occurrence_media (
        occurrence_id,
        storage_key,
        original_name,
        mime_type,
        size_bytes,
        uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id,
                occurrence_id,
                storage_key,
                original_name,
                mime_type,
                size_bytes,
                uploaded_by,
                created_at`,
    [
      occurrence_id,
      storage_key,
      original_name ?? null,
      mime_type,
      size_bytes,
      uploaded_by ?? null,
    ]
  );
  return rows[0];
};

const findByOccurrenceId = async (occurrence_id) => {
  const { rows } = await pool.query(
    `${BASE_SELECT} WHERE occurrence_id = $1 ORDER BY created_at ASC, id ASC`,
    [occurrence_id]
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await pool.query(`${BASE_SELECT} WHERE id = $1`, [id]);
  return rows[0] || null;
};

const remove = async (id, client) => {
  const runner = client || pool;
  const { rowCount } = await runner.query(
    `DELETE FROM occurrence_media WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

module.exports = {
  create,
  findByOccurrenceId,
  findById,
  remove,
};

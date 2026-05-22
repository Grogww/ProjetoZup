const pool = require('../config/database');

const BASE_SELECT = `
  SELECT id,
         occurrence_id,
         user_id,
         vote_type,
         created_at,
         updated_at
    FROM evaluations
`;

const findByOccurrence = async (occurrence_id) => {
  const { rows } = await pool.query(
    `${BASE_SELECT} WHERE occurrence_id = $1 ORDER BY created_at DESC`,
    [occurrence_id]
  );
  return rows;
};

const findByUserAndOccurrence = async (user_id, occurrence_id, client) => {
  const runner = client || pool;
  const { rows } = await runner.query(
    `${BASE_SELECT} WHERE user_id = $1 AND occurrence_id = $2`,
    [user_id, occurrence_id]
  );
  return rows[0] || null;
};

const create = async ({ occurrence_id, user_id, vote_type }, client) => {
  const runner = client || pool;
  const { rows } = await runner.query(
    `INSERT INTO evaluations (occurrence_id, user_id, vote_type)
          VALUES ($1, $2, $3::evaluation_vote_type)
       RETURNING id, occurrence_id, user_id, vote_type, created_at, updated_at`,
    [occurrence_id, user_id, vote_type]
  );
  return rows[0];
};

const updateVoteType = async (id, vote_type, client) => {
  const runner = client || pool;
  const { rows } = await runner.query(
    `UPDATE evaluations
        SET vote_type = $2::evaluation_vote_type,
            updated_at = now()
      WHERE id = $1
      RETURNING id, occurrence_id, user_id, vote_type, created_at, updated_at`,
    [id, vote_type]
  );
  return rows[0] || null;
};

const remove = async (id, client) => {
  const runner = client || pool;
  const { rowCount } = await runner.query(
    `DELETE FROM evaluations WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

module.exports = {
  findByOccurrence,
  findByUserAndOccurrence,
  create,
  updateVoteType,
  remove,
};

const pool = require('../config/database');

const BASE_SELECT = `
  SELECT id,
         original_occurrence_id,
         new_occurrence_id,
         root_occurrence_id,
         reopened_by,
         reason,
         previous_status,
         reopen_sequence,
         created_at
    FROM occurrence_reopens
`;

const create = async (
  {
    original_occurrence_id,
    new_occurrence_id,
    root_occurrence_id,
    reopened_by,
    reason,
    previous_status,
    reopen_sequence,
  },
  client
) => {
  const runner = client || pool;
  const { rows } = await runner.query(
    `INSERT INTO occurrence_reopens (
        original_occurrence_id,
        new_occurrence_id,
        root_occurrence_id,
        reopened_by,
        reason,
        previous_status,
        reopen_sequence
      ) VALUES ($1, $2, $3, $4, $5, $6::occurrence_status, $7)
      RETURNING id,
                original_occurrence_id,
                new_occurrence_id,
                root_occurrence_id,
                reopened_by,
                reason,
                previous_status,
                reopen_sequence,
                created_at`,
    [
      original_occurrence_id ?? null,
      new_occurrence_id,
      root_occurrence_id ?? null,
      reopened_by ?? null,
      reason,
      previous_status,
      reopen_sequence,
    ]
  );
  return rows[0];
};

// Histórico completo de reincidência de um problema: todas as reaberturas
// que compartilham a mesma raiz, da mais antiga para a mais recente.
const findByRoot = async (root_occurrence_id) => {
  const { rows } = await pool.query(
    `${BASE_SELECT} WHERE root_occurrence_id = $1 ORDER BY reopen_sequence ASC, created_at ASC`,
    [root_occurrence_id]
  );
  return rows;
};

module.exports = {
  create,
  findByRoot,
};

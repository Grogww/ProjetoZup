const pool = require('../config/database');

const BASE_SELECT = `
  SELECT id,
         occurrence_id,
         old_status,
         new_status,
         changed_by,
         note,
         created_at
    FROM occurrence_status_history
`;

// Registra uma transição de status. old_status pode ser null no primeiro
// registro (criação da ocorrência: NULL -> status inicial). Aceita um client
// para participar de uma transação já aberta pelo chamador.
const create = async (
  { occurrence_id, old_status, new_status, changed_by, note },
  client
) => {
  const runner = client || pool;
  const { rows } = await runner.query(
    `INSERT INTO occurrence_status_history (
        occurrence_id,
        old_status,
        new_status,
        changed_by,
        note
      ) VALUES (
        $1,
        $2::occurrence_status,
        $3::occurrence_status,
        $4,
        $5
      )
      RETURNING id,
                occurrence_id,
                old_status,
                new_status,
                changed_by,
                note,
                created_at`,
    [
      occurrence_id,
      old_status ?? null,
      new_status,
      changed_by ?? null,
      note ?? null,
    ]
  );
  return rows[0];
};

// Histórico completo de status de uma ocorrência, do mais antigo ao mais recente.
const findByOccurrence = async (occurrence_id) => {
  const { rows } = await pool.query(
    `${BASE_SELECT} WHERE occurrence_id = $1 ORDER BY created_at ASC, id ASC`,
    [occurrence_id]
  );
  return rows;
};

module.exports = {
  create,
  findByOccurrence,
};

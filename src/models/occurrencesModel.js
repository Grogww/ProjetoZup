const pool = require('../config/database');

const BASE_SELECT = `
  SELECT id,
         title,
         description,
         ST_AsGeoJSON(location)::json AS location,
         address,
         category_id,
         subcategory_id,
         neighborhood_id,
         author_id,
         assigned_organization_id,
         status,
         upvote_count,
         downvote_count,
         score,
         reopen_count,
         parent_occurrence_id,
         resolved_at,
         closed_at,
         created_at,
         updated_at
    FROM occurrences
`;

const findAll = async (filters = {}) => {
  const conditions = [];
  const values = [];

  const pushFilter = (column, value) => {
    if (value !== undefined && value !== null) {
      values.push(value);
      conditions.push(`${column} = $${values.length}`);
    }
  };

  pushFilter('status', filters.status);
  pushFilter('category_id', filters.category_id);
  pushFilter('subcategory_id', filters.subcategory_id);
  pushFilter('neighborhood_id', filters.neighborhood_id);
  pushFilter('author_id', filters.author_id);
  pushFilter('assigned_organization_id', filters.assigned_organization_id);

  let sql = BASE_SELECT;
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY created_at DESC';

  if (filters.limit !== undefined) {
    values.push(filters.limit);
    sql += ` LIMIT $${values.length}`;
  }
  if (filters.offset !== undefined) {
    values.push(filters.offset);
    sql += ` OFFSET $${values.length}`;
  }

  const { rows } = await pool.query(sql, values);
  return rows;
};

const findById = async (id) => {
  const { rows } = await pool.query(`${BASE_SELECT} WHERE id = $1`, [id]);
  return rows[0] || null;
};

const findNearby = async ({ latitude, longitude, radius_m }) => {
  const { rows } = await pool.query(
    `SELECT id,
            title,
            description,
            ST_AsGeoJSON(location)::json AS location,
            address,
            category_id,
            subcategory_id,
            neighborhood_id,
            author_id,
            assigned_organization_id,
            status,
            upvote_count,
            downvote_count,
            score,
            reopen_count,
            parent_occurrence_id,
            resolved_at,
            closed_at,
            created_at,
            updated_at,
            ST_Distance(
              location::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            ) AS distance_m
       FROM occurrences
      WHERE ST_DWithin(
              location::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              $3
            )
      ORDER BY distance_m ASC`,
    [longitude, latitude, radius_m]
  );
  return rows;
};

const create = async ({
  title,
  description,
  latitude,
  longitude,
  address,
  category_id,
  subcategory_id,
  neighborhood_id,
  author_id,
  assigned_organization_id,
  parent_occurrence_id,
  status,
}) => {
  const { rows } = await pool.query(
    `INSERT INTO occurrences (
        title,
        description,
        location,
        address,
        category_id,
        subcategory_id,
        neighborhood_id,
        author_id,
        assigned_organization_id,
        parent_occurrence_id,
        status
      ) VALUES (
        $1,
        $2,
        ST_SetSRID(ST_MakePoint($3, $4), 4326),
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        COALESCE($12, 'pending'::occurrence_status)
      )
      RETURNING id,
                title,
                description,
                ST_AsGeoJSON(location)::json AS location,
                address,
                category_id,
                subcategory_id,
                neighborhood_id,
                author_id,
                assigned_organization_id,
                status,
                upvote_count,
                downvote_count,
                score,
                reopen_count,
                parent_occurrence_id,
                resolved_at,
                closed_at,
                created_at,
                updated_at`,
    [
      title,
      description,
      longitude,
      latitude,
      address ?? null,
      category_id,
      subcategory_id ?? null,
      neighborhood_id ?? null,
      author_id,
      assigned_organization_id ?? null,
      parent_occurrence_id ?? null,
      status ?? null,
    ]
  );
  return rows[0];
};

const updateStatus = async (id, status) => {
  const { rows } = await pool.query(
    `UPDATE occurrences
        SET status = $2::occurrence_status,
            resolved_at = CASE
                            WHEN $2 = 'resolved' AND resolved_at IS NULL THEN now()
                            ELSE resolved_at
                          END,
            closed_at = CASE
                          WHEN $2 = 'closed' AND closed_at IS NULL THEN now()
                          ELSE closed_at
                        END,
            reopen_count = CASE
                             WHEN $2 = 'pending' AND status IN ('resolved', 'closed') THEN reopen_count + 1
                             ELSE reopen_count
                           END,
            updated_at = now()
      WHERE id = $1
      RETURNING id,
                title,
                description,
                ST_AsGeoJSON(location)::json AS location,
                address,
                category_id,
                subcategory_id,
                neighborhood_id,
                author_id,
                assigned_organization_id,
                status,
                upvote_count,
                downvote_count,
                score,
                reopen_count,
                parent_occurrence_id,
                resolved_at,
                closed_at,
                created_at,
                updated_at`,
    [id, status]
  );
  return rows[0] || null;
};

const remove = async (id) => {
  const { rowCount } = await pool.query(
    `DELETE FROM occurrences WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
};

module.exports = {
  findAll,
  findById,
  findNearby,
  create,
  updateStatus,
  remove,
};

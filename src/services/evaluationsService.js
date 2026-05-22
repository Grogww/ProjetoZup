const pool = require('../config/database');
const evaluationsModel = require('../models/evaluationsModel');

const VOTE_TYPES = ['upvote', 'downvote'];

const notFound = (msg) => {
  const err = new Error(msg);
  err.code = 'OCCURRENCE_NOT_FOUND';
  return err;
};

const closed = (msg) => {
  const err = new Error(msg);
  err.code = 'OCCURRENCE_CLOSED';
  return err;
};

const evaluationNotFound = (msg) => {
  const err = new Error(msg);
  err.code = 'EVALUATION_NOT_FOUND';
  return err;
};

const recomputeOccurrenceCounts = async (client, occurrence_id) => {
  await client.query(
    `UPDATE occurrences
        SET upvote_count = COALESCE(stats.upvotes, 0),
            downvote_count = COALESCE(stats.downvotes, 0),
            score = COALESCE(stats.upvotes, 0) - COALESCE(stats.downvotes, 0),
            updated_at = now()
       FROM (
              SELECT
                COUNT(*) FILTER (WHERE vote_type = 'upvote')   AS upvotes,
                COUNT(*) FILTER (WHERE vote_type = 'downvote') AS downvotes
                FROM evaluations
               WHERE occurrence_id = $1
            ) AS stats
      WHERE occurrences.id = $1`,
    [occurrence_id]
  );
};

const loadOccurrenceForUpdate = async (client, occurrence_id) => {
  const { rows } = await client.query(
    `SELECT id, status FROM occurrences WHERE id = $1 FOR UPDATE`,
    [occurrence_id]
  );
  return rows[0] || null;
};

const listByOccurrence = async (occurrence_id) => {
  return evaluationsModel.findByOccurrence(occurrence_id);
};

const getUserVote = async (user_id, occurrence_id) => {
  if (!user_id || !occurrence_id) return null;
  const ev = await evaluationsModel.findByUserAndOccurrence(user_id, occurrence_id);
  return ev ? ev.vote_type : null;
};

const voteOnOccurrence = async ({ user_id, occurrence_id, vote_type }) => {
  if (!VOTE_TYPES.includes(vote_type)) {
    const err = new Error(`vote_type must be one of: ${VOTE_TYPES.join(', ')}`);
    err.code = 'INVALID_VOTE_TYPE';
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const occurrence = await loadOccurrenceForUpdate(client, occurrence_id);
    if (!occurrence) throw notFound('Occurrence not found');
    if (occurrence.status === 'closed') {
      throw closed('Cannot vote on a closed occurrence');
    }

    const existing = await evaluationsModel.findByUserAndOccurrence(
      user_id,
      occurrence_id,
      client
    );

    let evaluation;
    if (!existing) {
      evaluation = await evaluationsModel.create(
        { occurrence_id, user_id, vote_type },
        client
      );
    } else if (existing.vote_type !== vote_type) {
      evaluation = await evaluationsModel.updateVoteType(existing.id, vote_type, client);
    } else {
      evaluation = existing;
    }

    await recomputeOccurrenceCounts(client, occurrence_id);
    await client.query('COMMIT');
    return evaluation;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const removeUserVote = async ({ user_id, occurrence_id }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const occurrence = await loadOccurrenceForUpdate(client, occurrence_id);
    if (!occurrence) throw notFound('Occurrence not found');

    const existing = await evaluationsModel.findByUserAndOccurrence(
      user_id,
      occurrence_id,
      client
    );
    if (!existing) throw evaluationNotFound('No vote found for this user on this occurrence');

    await evaluationsModel.remove(existing.id, client);
    await recomputeOccurrenceCounts(client, occurrence_id);

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  VOTE_TYPES,
  listByOccurrence,
  getUserVote,
  voteOnOccurrence,
  removeUserVote,
};

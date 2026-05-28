const evaluationsService = require('../services/evaluationsService');

const parsePositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const requireUser = (req, res) => {
  if (!req.user || !Number.isInteger(req.user.id)) {
    res.status(401).json({ error: 'Authenticated user required' });
    return null;
  }
  return req.user;
};

const handleVoteError = (err, res, next) => {
  if (err.code === 'OCCURRENCE_NOT_FOUND') return res.status(404).json({ error: err.message });
  if (err.code === 'OCCURRENCE_CLOSED') return res.status(409).json({ error: err.message });
  if (err.code === 'EVALUATION_NOT_FOUND') return res.status(404).json({ error: err.message });
  if (err.code === 'INVALID_VOTE_TYPE') return res.status(400).json({ error: err.message });
  return next(err);
};

const upvote = async (req, res, next) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const occurrence_id = parsePositiveInt(req.params.id);
    if (occurrence_id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const evaluation = await evaluationsService.voteOnOccurrence({
      user_id: user.id,
      occurrence_id,
      vote_type: 'up',
    });

    res.status(200).json(evaluation);
  } catch (err) {
    return handleVoteError(err, res, next);
  }
};

const downvote = async (req, res, next) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const occurrence_id = parsePositiveInt(req.params.id);
    if (occurrence_id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const evaluation = await evaluationsService.voteOnOccurrence({
      user_id: user.id,
      occurrence_id,
      vote_type: 'down',
    });

    res.status(200).json(evaluation);
  } catch (err) {
    return handleVoteError(err, res, next);
  }
};

const list = async (req, res, next) => {
  try {
    const occurrence_id = parsePositiveInt(req.params.id);
    if (occurrence_id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const evaluations = await evaluationsService.listByOccurrence(occurrence_id);
    res.json(evaluations);
  } catch (err) {
    next(err);
  }
};

const removeVote = async (req, res, next) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;

    const occurrence_id = parsePositiveInt(req.params.id);
    if (occurrence_id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    await evaluationsService.removeUserVote({
      user_id: user.id,
      occurrence_id,
    });

    res.status(204).send();
  } catch (err) {
    return handleVoteError(err, res, next);
  }
};

module.exports = { upvote, downvote, list, removeVote };

const organizationsService = require('../services/organizationsService');

const list = async (req, res, next) => {
  try {
    const organizations = await organizationsService.listOrganizations();
    res.json(organizations);
  } catch (err) {
    next(err);
  }
};

module.exports = { list };

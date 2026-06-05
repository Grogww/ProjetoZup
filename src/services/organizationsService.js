const organizationsModel = require('../models/organizationsModel');

const listOrganizations = async () => {
  return organizationsModel.findAll();
};

module.exports = { listOrganizations };

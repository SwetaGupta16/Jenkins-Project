const buNode = require('../dal/graph-db/models/nodes').businessUnit;
const errors = require('../errors');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);

const validateGetMaxLicensesInput = (args) => {
  logger.debug('>> validateGetMaxLicensesInput()');
  if (!args.organizationId) {
    const errMsg = 'OrganizationId is mandatory to get max licenses count.';
    logger.error(errMsg);
    throw errors.Mandatory('ORGANIZATION', errMsg);
  }
  logger.debug('<< validateGetMaxLicensesInput()');
};

const getMaxLicenses = async (args) => {
  logger.debug('>> getMaxLicenses()');
  validateGetMaxLicensesInput(args);
  const result = await buNode.readPricingPlanStrategy(args.organizationId);
  logger.debug('<< getMaxLicenses()');
  return result.maxLicenses;
};

module.exports = {
  getMaxLicenses,
};

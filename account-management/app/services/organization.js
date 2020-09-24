const srpService = require('./scopeRolePrivilege');
const buService = require('./business-unit');
const userNode = require('../dal/graph-db/models/nodes').user;
const errors = require('../errors');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);

const validateGetRemainingLicensesInput = (args) => {
  logger.debug('>> validateGetRemainingLicensesInput()');
  if (!args.organizationId) {
    const errMsg = 'OrganizationId is mandatory to get count of remaining licenses.';
    logger.error(errMsg);
    throw errors.Mandatory('ORGANIZATION', errMsg);
  }
  logger.debug('<< validateGetRemainingLicensesInput()');
};

const getRemainingLicenses = async (args, context) => {
  logger.debug('>> getRemainingLicenses()');
  validateGetRemainingLicensesInput(args);

  // Validate if user has privilege to read licenses
  await srpService.hasReadLicensesPrivilege(context);

  const maxLicenses = await buService.getMaxLicenses(args);
  const registeredUsers = await userNode.readLicensedUsersByOrganizationId(args.organizationId);

  const remainingLicenses = maxLicenses - registeredUsers.length;
  logger.debug('<< getRemainingLicenses()');
  return remainingLicenses;
};

module.exports = {
  getRemainingLicenses,
};

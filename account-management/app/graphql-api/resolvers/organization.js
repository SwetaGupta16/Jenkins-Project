const orgService = require('../../services').organization;

const getRemainingLicenses = async (obj, args, context) => await orgService.getRemainingLicenses(args, context);

module.exports = {
  getRemainingLicenses,
};

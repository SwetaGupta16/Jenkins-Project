const severityService = require('../../services').severity;

const updateSeverities = async (obj, args, context) => await severityService.updateSeverities(args, context);

module.exports = {
  updateSeverities,
};

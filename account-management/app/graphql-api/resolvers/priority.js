const priorityService = require('../../services').priority;

const updatePriorities = async (obj, args, context) => await priorityService.updatePriorities(args, context);

module.exports = {
  updatePriorities,
};

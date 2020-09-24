const issueService = require('../../services').issue;

const getIssues = async (obj, args, context) => await issueService.getIssues(args, context);

const getRMTIssueTypes = async (obj, args) => await issueService.getIssueTypes(args);

const syncIssues = async (obj, args, context) => await issueService.syncIssues(args, context);

const getSyncStatus = async (obj, args) => await issueService.getSyncStatus(args);

module.exports = {
  getIssues,
  getRMTIssueTypes,
  syncIssues,
  getSyncStatus,
};

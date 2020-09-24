const rmtService = require('../../services').rmt;

const getRMTList = async (obj, args, context) => await rmtService.getRMTList(args, context);

const testConnection = async (obj, args, context) => await rmtService.testConnection(args, context);

const getConnectionDetails = async (obj, args, context) => await rmtService.getConnectionDetails(args, context);

const deleteRMTConnection = async (obj, args, context) => await rmtService.deleteRMTConnection(args, context);

const updateRMTConnection = async (obj, args, context) => await rmtService.updateRMTConnection(args, context);

const getRMTProjects = async (obj, args, context) => await rmtService.getRMTProjects(args, context);

const getRMTProjectEntityTypes = async (obj, args, context) => await rmtService.getEntityTypesForRMTProject(args, context);

const getRMTProjectEntityDetails = async (obj, args, context) => await rmtService.getEntityListForRMTProject(args, context);

const setRMTProjectIssueTypeHierarchy = async (obj, args, context) => await rmtService.setHierarchyForIssueType(args, context);

module.exports = {
  getRMTList,
  testConnection,
  getConnectionDetails,
  deleteRMTConnection,
  updateRMTConnection,
  getRMTProjects,
  getRMTProjectEntityTypes,
  getRMTProjectEntityDetails,
  setRMTProjectIssueTypeHierarchy,
};

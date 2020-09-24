const srpService = require('../../services').scopeRolePrivilege;

const getAllScopesRolesPrivileges = async (obj, args, context) => await srpService.getAllScopesRolesPrivileges(args, context);

const getProjectRolesPrivileges = async (obj, args, context) => await srpService.getProjectRolesPrivileges(args, context);

const getRoleDetails = async (obj, args, context) => await srpService.getRoleDetails(args, context);

module.exports = {
  getAllScopesRolesPrivileges,
  getProjectRolesPrivileges,
  getRoleDetails,
};

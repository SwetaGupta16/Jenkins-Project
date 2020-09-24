const srpNode = require('../dal/graph-db/models/nodes').scopeRolePrivilege;
const orgNode = require('../dal/graph-db/models/nodes').organization;
const buNode = require('../dal/graph-db/models/nodes').businessUnit;
const projectNode = require('../dal/graph-db/models/nodes').project;
const errors = require('../errors');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);

const orgLabels = orgNode.LABELS;
const buLabels = buNode.LABELS;
const projectLabels = projectNode.LABELS;

const getOrgBUScopes = (context) => [
  { labels: [orgLabels.organization], properties: { organizationId: context.organizationId } },
  { labels: [buLabels.businessUnit], properties: { businessUnitId: context.businessUnitId } },
];

/**
 *Validates if user has privilege on specified scope
 *
 * @param {*} userId
 * @param {*} scope
 * @param {*} privilege
 * @param {*} [txOrSession=null]
 */
const validateUserPrivilege = async (userId, scope, privilege, txOrSession = null) => {
  logger.debug('>> validateUserPrivilege()');
  const userRole = await srpNode.readUserRole({ userId }, scope, txOrSession);
  if (!userRole) {
    // User does not have any role on this scope
    const errMsg = `User(${userId}) does not have permission to perform this operation`;
    logger.error(errMsg);
    throw errors.NotPermitted('OPERATION', errMsg);
  }

  const hasPrivilege = await srpNode.hasPrivilege(userRole, privilege, txOrSession);
  if (!hasPrivilege) {
    const errMsg = `User(${userId}) does not have permission to perform this operation`;
    logger.error(errMsg);
    throw errors.NotPermitted('OPERATION', errMsg);
  }
  logger.debug('<< validateUserPrivilege()');
};

const validateUserPrivilegeOnAnyScope = async (userId, scopes, privilege, txOrSession = null) => {
  logger.debug('>> validateUserPrivilegeOnAnyScope()');
  for (let index = 0; index < scopes.length; index++) {
    try {
      await validateUserPrivilege(userId, scopes[index], privilege, txOrSession);
      logger.debug('<< validateUserPrivilegeOnAnyScope()');
      return;
    }
    catch (err) {
      if (err.code === 'ServiceError.OPERATION_NOT_PERMITTED' || err.code === 'ServiceError.GET_ROLE_QUERY_FAILED') {
        if (index === scopes.length - 1) {
          throw err;
        }
      }
      else {
        throw err;
      }
    }
  }
};

const hasCreateProjectPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasCreateProjectPrivilege()');
  const scopes = getOrgBUScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanCreateProject, txOrSession);
  logger.debug('<< hasCreateProjectPrivilege()');
};

const getOrgBUProjectScopes = (context) => {
  logger.debug('>> getOrgBUProjectScopes()');
  const scopes = getOrgBUScopes(context);
  scopes.push({ labels: [projectLabels.project], properties: { projectId: context.projectId } });
  logger.debug('<< getOrgBUProjectScopes()');
  return scopes;
};

const hasUpdateProjectPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasUpdateProjectPrivilege()');
  const scopes = getOrgBUProjectScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanUpdateProject, txOrSession);
  logger.debug('<< hasUpdateProjectPrivilege()');
};

const hasDeleteProjectPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasDeleteProjectPrivilege()');
  const scopes = getOrgBUScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanDeleteProject, txOrSession);
  logger.debug('<< hasDeleteProjectPrivilege()');
};

const hasAllocateUserToProjectPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasAllocateUserToProjectPrivilege()');
  const scopes = getOrgBUProjectScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanAllocateUserToProject, txOrSession);
  logger.debug('<< hasAllocateUserToProjectPrivilege()');
};

const hasDeallocateUserFromProjectPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasDeallocateUserFromProjectPrivilege()');
  const scopes = getOrgBUProjectScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanDeallocateUserFromProject, txOrSession);
  logger.debug('<< hasDeallocateUserFromProjectPrivilege()');
};

const hasChangeUserRoleOnProjectPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasChangeUserRoleOnProjectPrivilege()');
  const scopes = getOrgBUProjectScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanChangeUserRoleOnProject, txOrSession);
  logger.debug('<< hasChangeUserRoleOnProjectPrivilege()');
};

const hasReadUserPrivilege = async (context, txOrSession = null) => {
  const scopes = getOrgBUProjectScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanReadUser, txOrSession);
};

const hasCreateUserPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasCreateUserPrivilege()');
  const scopes = getOrgBUScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanCreateUser, txOrSession);
  logger.debug('<< hasCreateUserPrivilege()');
};

const hasDeleteUserPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasDeleteUserPrivilege()');
  const scopes = getOrgBUScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanDeleteUser, txOrSession);
  logger.debug('<< hasDeleteUserPrivilege()');
};

const hasReadLicensesPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasReadLicensesPrivilege()');
  const scopes = getOrgBUScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanReadLicenses, txOrSession);
  logger.debug('<< hasReadLicensesPrivilege()');
};

const hasReadRMTPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasReadRMTPrivilege()');
  const scopes = getOrgBUProjectScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanReadRMT, txOrSession);
  logger.debug('<< hasReadRMTPrivilege()');
};

const hasUpdateRMTPrivilege = async (context, txOrSession = null) => {
  logger.debug('>> hasUpdateRMTPrivilege()');
  const scopes = getOrgBUProjectScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanUpdateRMT, txOrSession);
  logger.debug('<< hasUpdateRMTPrivilege()');
};

const hasPrivilegeToReadRoles = async (context, txOrSession = null) => {
  logger.debug('>> hasPrivilegeToReadRoles()');
  const scopes = getOrgBUProjectScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanReadRoles, txOrSession);
  logger.debug('<< hasPrivilegeToReadRoles()');
};

const hasPrivilegeToReadPrivileges = async (context, txOrSession = null) => {
  logger.debug('>> hasPrivilegeToReadPrivileges()');
  const scopes = getOrgBUProjectScopes(context);
  await validateUserPrivilegeOnAnyScope(context.userId, scopes, srpNode.PRIVILEGES.CanReadPrivileges, txOrSession);
  logger.debug('<< hasPrivilegeToReadRoles()');
};

const validateGetAllScopesRolesPrivilegesInput = async (args, context) => {
  logger.debug('>> validateGetAllScopesRolesPrivilegesInput()');
  if (!context.userId) {
    const errMsg = 'userId is mandatory to get all scope roles and each role privileges of user.';
    logger.error(errMsg);
    throw errors.Mandatory('USER', errMsg);
  }
  logger.debug('<< validateGetAllScopesRolesPrivilegesInput()');
};

const getAllScopesRolesPrivileges = async (args, context) => {
  logger.debug('>> getAllScopesRolesPrivileges()');
  await validateGetAllScopesRolesPrivilegesInput(args, context);

  const { userId } = context;
  const result = await srpNode.readAllScopesRolesPrivileges(userId);
  logger.debug('<< getAllScopesRolesPrivileges()');
  return result;
};

const validateGetProjectRolesPrivilegesInput = (args) => {
  logger.debug('>> validateGetProjectRolesPrivilegesInput()');
  if (!args.projectId) {
    const errMsg = 'projectId is mandatory to get roles and each role privileges for that project.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT_ID', errMsg);
  }
  logger.debug('<< validateGetProjectRolesPrivilegesInput()');
};

const getProjectRolesPrivileges = async (args, context) => {
  logger.debug('>> getProjectRolesPrivileges()');
  validateGetProjectRolesPrivilegesInput(args);

  // Check if user has privilege to read project roles and privileges
  context.projectId = args.projectId;
  await hasPrivilegeToReadRoles(context);
  await hasPrivilegeToReadPrivileges(context);

  const result = await srpNode.readProjectRolesPrivileges(args.projectId);
  logger.debug('<< getProjectRolesPrivileges()');
  return result;
};

const getRoleDetails = async (args, context) => {
  logger.debug('>> getRoleDetails()');
  // Check if user has privilege to read project roles and privileges
  context.projectId = args.projectId;
  await hasPrivilegeToReadRoles(context);
  await hasPrivilegeToReadPrivileges(context);

  const result = await srpNode.readRoleDetails(context.organizationId, args.projectId);
  logger.debug('<< getRoleDetails()');
  return result;
};

module.exports = {
  validateUserPrivilege,
  validateUserPrivilegeOnAnyScope,
  getAllScopesRolesPrivileges,
  getProjectRolesPrivileges,
  getRoleDetails,
  hasUpdateProjectPrivilege,
  hasReadLicensesPrivilege,
  hasCreateProjectPrivilege,
  hasDeleteProjectPrivilege,
  hasAllocateUserToProjectPrivilege,
  hasDeallocateUserFromProjectPrivilege,
  hasChangeUserRoleOnProjectPrivilege,
  hasReadUserPrivilege,
  hasCreateUserPrivilege,
  hasDeleteUserPrivilege,
  hasReadRMTPrivilege,
  hasUpdateRMTPrivilege,
  hasPrivilegeToReadRoles,
  hasPrivilegeToReadPrivileges,
};

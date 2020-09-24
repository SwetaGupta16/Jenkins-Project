const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);
const orgNode = require('./organization');
const projectNode = require('./project');
const userNode = require('./user');
const executor = require('../../executor');
const utils = require('../../utils');
const errors = require('../../../../errors');

const { convertIntoCypherLabels } = utils;
const { convertIntoCypherProps } = utils;
const { convertIntoCypherParams } = utils;

/* Neo4j labels */
const LABELS = {
  role: 'Role',
  defaultRole: 'DefaultRole',
  projectRole: 'ProjectRole',
  privilege: 'Privilege',
};

/* Neo4j relationships */
const RELATIONSHIPS = {
  hasPrivilege: 'HAS_PRIVILEGE',
};

const SCOPES = {
  Organization: 'Organization',
  BusinessUnit: 'BusinessUnit',
  Project: 'Project',
};

const ROLES = {};
const PRIVILEGES = {};

const ROLES_PRIVILEGES = {};

const orgLabels = orgNode.LABELS;
const projectLabels = projectNode.LABELS;
const userLabels = userNode.LABELS;
const userRelationships = userNode.RELATIONSHIPS;

/**
 *Fetches all default roles, privileges from database and stores them in in-memory data structures.
 *These data structures are supposed to be updated whenever custom roles are added or deleted.
 *ROLES are stored like {
                            roleName: roleName
                        }

 *PRIVILEGES are stored like {
                                privilegeName: privilegeName
                             }

*ROLES_PRIVILEGES are stored like {
                                    roleName: {
                                                privilegeName: privilegeName
                                              }
                                  }
 * @param {*} [txOrSession=null]
 */
const setup = async (txOrSession = null) => {
  logger.debug('>> setup()');
  try {
    logger.debug('Setting up all roles and privileges in in-memory data structures');

    const queryReturn = '{role:role,privileges:collect({privilege:privilege})}';
    const query = `MATCH (role:${LABELS.defaultRole}) 
WITH role MATCH(role)-[r:${RELATIONSHIPS.hasPrivilege}]->(privilege:${LABELS.privilege}) 
RETURN ${queryReturn}`;

    const dbResult = await executor.read(query, {}, txOrSession);

    if (dbResult.records.length <= 0) {
      throw errors.DBQueryFailed('GET_ROLES_PRIVILEGES', 'Failed to fetch roles and their privileges.');
    }

    for (let index = 0; index < dbResult.records.length; index++) {
      const roleAndPrivileges = dbResult.records[index].get(queryReturn);
      const role = roleAndPrivileges.role.properties.name;
      ROLES[role] = role;
      ROLES_PRIVILEGES[role] = {};

      for (let index1 = 0; index1 < roleAndPrivileges.privileges.length; index1++) {
        const privilege = roleAndPrivileges.privileges[index1].privilege.properties.name;
        PRIVILEGES[privilege] = privilege;
        ROLES_PRIVILEGES[role][privilege] = privilege;
      }
    }

    logger.debug('<< Setting up done');
    return true;
  }
  catch (err) {
    logger.error(`Exception occurred while setting up all roles an privileges in in-memory data structures.\nCode=> ${err.code}\nMessage=> ${err}\nStack=> ${err.stack}`);
    throw err;
  }
};

const extractScope = (scopeNode) => {
  logger.debug('>> extractScope()');
  let scope = null;
  const returnValue = {};
  for (let index = 0; index < scopeNode.labels.length; index++) {
    scope = SCOPES[scopeNode.labels[index]];
    if (scope) {
      break;
    }
  }

  if (!scope) {
    const errMsg = 'Scope not found';
    logger.error(errMsg);
    throw errors.NotFound('SCOPE', errMsg);
  }

  const idName = `${scope.charAt(0).toLowerCase() + scope.slice(1)}Id`;
  returnValue.name = scope;
  returnValue.id = scopeNode.properties[idName];
  returnValue.idName = idName;
  logger.debug('<< extractScope()');
  return returnValue;
};

/**
 *Reads user's roles, scopes and privileges based on userId
 *
 * @param {*} userId
 * @param {*} [txOrSession=null]
 * @returns {*} [{
    scope{
      name
      id
      idName
    }
    role{
      roleId
      name
      description
      privileges[{
        privilegeId
        name
        description
      }]
    }
  }
}]
 */
const readAllScopesRolesPrivileges = async (userId, txOrSession = null) => {
  logger.debug('>> readAllScopesRolesPrivileges()');
  const userScopeQuery = `MATCH (user:${userLabels.user} {userId: $userId}) 
    WITH user MATCH(user)-[r:${userRelationships.isMemberOf}]->(scope) 
    RETURN {scope:scope,rel:r}`;
  const params = {
    userId,
  };
  const dbResult = await executor.read(userScopeQuery, params, txOrSession);

  if (dbResult.records.length <= 0) {
    const errMsg = `Failed to get scope and role for user ${userId}`;
    logger.error(errMsg);
    throw errors.DBQueryFailed('GET_SCOPE', errMsg);
  }

  const scopesRolesPrivileges = [];
  for (let index = 0; index < dbResult.records.length; index++) {
    const scopeAndRole = dbResult.records[index].get('{scope:scope,rel:r}');

    if (!scopeAndRole.rel.properties.role) {
      // User does not have any role on scope
      continue;
    }

    const scopeRolePrivilege = {};

    // add scope in return data structure
    scopeRolePrivilege.scope = extractScope(scopeAndRole.scope);

    const query = `MATCH(role:${LABELS.role} {name:$role}) WHERE role.show=true
        WITH role MATCH (role)-[:${RELATIONSHIPS.hasPrivilege}]->(prev:${LABELS.privilege}) WHERE prev.show=true
        RETURN {role:role,prevs:collect({prev:prev})}`;

    const secondParams = {
      role: scopeAndRole.rel.properties.role,
    };
    let result = await executor.read(query, secondParams, txOrSession);
    if (!result || !result.records || result.records.length <= 0) {
      continue;
    }
    result = result.records[0].get('{role:role,prevs:collect({prev:prev})}');

    // add role in return data structure
    scopeRolePrivilege.role = result.role.properties;

    scopeRolePrivilege.privileges = [];
    scopeRolePrivilege.role.privileges = [];
    for (let j = 0; j < result.prevs.length; j++) {
      const priv = result.prevs[j].prev.properties;

      // add privileges in return data structure
      scopeRolePrivilege.role.privileges.push(priv);
    }
    scopesRolesPrivileges.push(scopeRolePrivilege);
  }
  logger.debug('<< readAllScopesRolesPrivileges()');
  return scopesRolesPrivileges;
};

/**
 *Reads all roles and privileges applicable to Project
 *
 * @returns {*} [{
      roleId
      name
      description
      privileges[{
        privilegeId
        name
        description
      }]
}]
 */
const readProjectRolesPrivileges = async (projectId, txOrSession = null) => {
  logger.debug('>> readProjectRolesPrivileges()');
  const queryReturn = '{role:role, privileges:collect({privilege:privilege})}';
  const query = `MATCH (role:${LABELS.projectRole}) WHERE role.show=true WITH role 
    MATCH (role)-[r1:${RELATIONSHIPS.hasPrivilege}]->(privilege:${LABELS.privilege}) WHERE privilege.show=true 
    RETURN ${queryReturn}`;

  const dbResult = await executor.read(query, {}, txOrSession);

  if (dbResult.records.length <= 0) {
    const errMsg = 'Failed to fetch project roles and role privileges.';
    logger.error(errMsg);
    throw errors.DBQueryFailed('PROJECT_ROLES_PRIVILEGES', errMsg);
  }

  const rolesPrivileges = [];
  for (let index = 0; index < dbResult.records.length; index++) {
    let rolePrivileges = {};

    const record = dbResult.records[index].get(queryReturn);
    rolePrivileges = record.role.properties;
    rolePrivileges.privileges = [];

    for (let j = 0; j < record.privileges.length; j++) {
      if (record.privileges[j].privilege) {
        rolePrivileges.privileges.push(record.privileges[j].privilege.properties);
      }
    }

    rolesPrivileges.push(rolePrivileges);
  }
  logger.debug('<< readProjectRolesPrivileges()');
  return rolesPrivileges;
};

/**
 *Returns project scope specific roles
 *
 * @returns {*} ["ProjectRole1","ProjectRole2"]
 */
const getProjectRoles = async (txOrSession = null) => {
  logger.debug('>> getProjectRoles()');
  const query = `MATCH (role:${LABELS.projectRole}) RETURN role`;

  const dbResult = await executor.read(query, {}, txOrSession);

  if (dbResult.records.length <= 0) {
    const errMsg = 'Failed to fetch project roles.';
    logger.error(errMsg);
    throw errors.DBQueryFailed('PROJECT_ROLES', errMsg);
  }

  const returnValue = [];
  for (let index = 0; index < dbResult.records.length; index++) {
    const role = dbResult.records[index].get('role').properties;
    returnValue.push(role.name);
  }
  logger.debug('<< getProjectRoles()');
  return returnValue;
};

/**
 *Returns user role on specified scope
 *
 * @param {*} userProps
 * @param {*} scope
 * @param {*} txOrSession
 * @returns {*} role
 */
const readUserRole = async (userProps, scope, txOrSession = null) => {
  logger.debug('>> readUserRole()');
  const userScopeQuery = `MATCH (user:${userLabels.user} {userId: $userId}) 
    WITH user MATCH(user)-[r:${userRelationships.isMemberOf}]->(scope${convertIntoCypherLabels(scope.labels)} { ${convertIntoCypherProps(scope.properties)} }) 
    RETURN r`;

  const params = convertIntoCypherParams({ ...userProps, ...scope.properties });

  const dbResult = await executor.read(userScopeQuery, params, txOrSession);

  if (dbResult.records.length <= 0) {
    const errMsg = `Failed to get role of user ${userProps.userId}`;
    logger.error(errMsg);
    throw errors.DBQueryFailed('GET_ROLE', errMsg);
  }

  const userRole = dbResult.records[0].get('r').properties.role;
  logger.debug('<< readUserRole()');
  return userRole;
};

const readRoleByName = async (name, txOrSession = null) => {
  logger.debug('>> readRoleByName()');
  const roleQuery = `MATCH(r:${LABELS.role} {name:$name}) RETURN {role:r{.*}} AS result`;
  const params = { name };
  const dbResult = await executor.read(roleQuery, params, txOrSession);

  if (dbResult.records.length <= 0) {
    const errMsg = `Failed to get role details by name: ${name}`;
    logger.error(errMsg);
    throw errors.DBQueryFailed('GET_ROLE', errMsg);
  }

  const { role } = dbResult.records[0].get('result');
  logger.debug('<< readRoleByName()');
  return role;
};

const getProjectRoleDetailsQueries = () => {
  logger.debug('>> getProjectRoleDetailsQueries()');
  const rolePrivilegesQuery = `MATCH (role:${LABELS.projectRole}) WHERE role.show=true WITH role
        ORDER BY role.name ASC
        MATCH (role)-[r1:${RELATIONSHIPS.hasPrivilege}]->(privilege:${LABELS.privilege}) WHERE privilege.show=true
        RETURN {role:role, privileges:collect({privilege:privilege})} AS RolesPrivileges`;
  const usersQuery = `MATCH(project:${projectLabels.project} {projectId:$projectId}) WITH project 
        MATCH (project)<-[r1:${userRelationships.isMemberOf} {role:$role}]-(user:${userLabels.user} {status:'Active'}) RETURN {users:collect({user:user})} AS US`;
  logger.debug('<< getProjectRoleDetailsQueries()');
  return { rolePrivilegesQuery, usersQuery };
};

const compareRoleASC = (role1, role2) => {
  if (role1.name < role2.name) {
    return -1;
  }
  if (role1.name > role2.name) {
    return 1;
  }
  return 0;
};

const runRoleDetailsQueries = async (queries, organizationId, projectId, txOrSession) => {
  logger.debug('>> runRoleDetailsQueries()');
  const dbResult = await executor.read(queries.rolePrivilegesQuery, {}, txOrSession);
  if (dbResult.records.length <= 0) {
    const errMsg = 'Failed to fetch role details.';
    logger.error(errMsg);
    throw errors.DBQueryFailed('ROLES', errMsg);
  }

  const rolesPrivileges = [];
  for (let index = 0; index < dbResult.records.length; index++) {
    let role = {};
    const record = dbResult.records[index].get('RolesPrivileges');

    const userRole = record.role.properties.name;

    // role properties
    // Till custom roles come, role type is always Default
    role = record.role.properties;
    role.type = 'Default';
    role.privileges = [];

    // Users count having specific role
    const params = {
      role: userRole,
      organizationId,
      projectId,
    };
    const dbRecords = await executor.read(queries.usersQuery, params, txOrSession);
    role.assignedToUsers = dbRecords.records[0].get('US').users.length;
    if (dbRecords.records[0].get('US').scopes) {
      role.usedInScopes = dbRecords.records[0].get('US').scopes.length;
    }
    // role privileges array
    for (let j = 0; j < record.privileges.length; j++) {
      if (record.privileges[j].privilege) {
        const privilege = record.privileges[j].privilege.properties;
        role.privileges.push(privilege);
      }
    }
    rolesPrivileges.push(role);
  }

  // send roles in ascending order
  rolesPrivileges.sort(compareRoleASC);
  logger.debug('<< runRoleDetailsQueries()');
  return rolesPrivileges;
};

const getOrganizationRoleDetailsQueries = () => {
  logger.debug('>> getOrganizationRoleDetailsQueries()');
  const rolePrivilegesQuery = `MATCH (role:${LABELS.defaultRole}) WHERE role.show=true WITH role 
        ORDER BY role.name ASC
        MATCH (role)-[r1:${RELATIONSHIPS.hasPrivilege}]->(privilege:${LABELS.privilege}) WHERE privilege.show=true
        RETURN {role:role, privileges:collect({privilege:privilege})} AS RolesPrivileges`;
  const usersQuery = `MATCH(org:${orgLabels.organization} {organizationId:$organizationId}) WITH org 
        MATCH (org)<-[r1:${userRelationships.isMemberOf}]-(user:${userLabels.user} {status:'Active'}) WITH user
        MATCH (user)-[r2:${userRelationships.isMemberOf} {role:$role}]->(scope) 
        WHERE ((exists(scope.status) AND scope.status="Active") OR NOT exists(scope.status))
        RETURN {users:collect(distinct {user:user}), scopes:collect(distinct {scope:scope})} AS US`;
  logger.debug('<< getOrganizationRoleDetailsQueries()');
  return { rolePrivilegesQuery, usersQuery };
};

/**
 *Read roles and their details like role type, number of users having role, role privileges
 *
 * @param {*} [txOrSession=null]
 * @returns {*} [{
                    roleId
                    name
                    description
                    assignedToUsers
                    type
                    privileges [{
                                privilegeId
                                name
                                description
                                }]
                }]
 */
const readRoleDetails = async (organizationId, projectId, txOrSession = null) => {
  logger.debug('>> readRoleDetails()');
  let queries;
  if (projectId) {
    queries = getProjectRoleDetailsQueries();
  }
  else {
    queries = getOrganizationRoleDetailsQueries();
  }
  const result = await runRoleDetailsQueries(queries, organizationId, projectId, txOrSession);
  logger.debug('<< readRoleDetails()');
  return result;
};

/**
 *Checks if provided role has given privilege
 *
 * @param {*} role
 * @param {*} privilege
 * @param {*} txOrSession
 * @returns {*} Boolean
 */
const hasPrivilege = async (role, privilege) => {
  logger.debug('>> hasPrivilege()');
  const returnValue = !!ROLES_PRIVILEGES[role][privilege];
  logger.debug('<< hasPrivilege()');
  return returnValue;
};

module.exports = {
  setup,
  LABELS,
  RELATIONSHIPS,
  SCOPES,
  ROLES,
  PRIVILEGES,
  readAllScopesRolesPrivileges,
  readProjectRolesPrivileges,
  getProjectRoles,
  readUserRole,
  readRoleDetails,
  hasPrivilege,
  readRoleByName,
};

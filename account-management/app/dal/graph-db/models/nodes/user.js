const executor = require('../../executor');
const utils = require('../../utils');
const errors = require('../../../../errors');
const organizationNode = require('./organization');
const projectNode = require('./project');
const businessUnitNode = require('./business-unit');
const generalUtils = require('../../../../utils');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const { uuid } = generalUtils;
const { crypto } = generalUtils;

const { convertIntoCypherLabels } = utils;
const { convertIntoCypherProps } = utils;
const { convertIntoCypherParams } = utils;

/* Neo4j labels */
const LABELS = {
  user: 'User',
  role: 'Role',
};

/* Neo4j relationships */
const RELATIONSHIPS = {
  isMemberOf: 'IS_MEMBER_OF',
  hasInvitationToken: 'HAS_INVITATION_TOKEN',
};

const STATUSES = {
  active: 'Active',
  invited: 'Invited',
  deleted: 'Deleted',
};

const orgLabels = organizationNode.LABELS;
const orgRelationships = organizationNode.RELATIONSHIPS;
const projectLabels = projectNode.LABELS;
const businessUnitLabels = businessUnitNode.LABELS;

const GET_USERS_QUERY_RETURN = `{user:user{.*,createdAt:toString(user.createdAt),updatedAt:toString(user.updatedAt)},
org:org{.*,createdAt:toString(user.createdAt),updatedAt:toString(user.updatedAt)},
orgRel:r1{.*,createdAt:toString(user.createdAt),updatedAt:toString(user.updatedAt)},
projects: collect({project:prj{.*,createdAt:toString(prj.createdAt),updatedAt:toString(prj.updatedAt)},prjRel:r2{.*,createdAt:toString(r2.createdAt),updatedAt:toString(r2.updatedAt)},role:role.displayName})}`;

const formatUserReturnValue = (result, allDetails = false) => {
  logger.debug('>> formatUserReturnValue()');
  const userNode = result.records[0].get('user').properties;
  const returnValue = utils.simplifyIntegerTypes(userNode);
  if (!allDetails) {
    delete returnValue.password;
  }
  logger.debug('<< formatUserReturnValue()');
  return returnValue;
};

/**
 *Fetches a user by userId and organizationId from database.
 *
 * @param {*} userId
 * @param {*} organizationId
 * @param {*} [allDetails=false]
 * @param {*} [txOrSession=null]
 * @returns {*} {
                userId,
                name,
                email
            }
 */
const readById = async (userId, organizationId, allDetails = false, txOrSession = null) => {
  logger.debug('>> readById()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
    <-[r:${RELATIONSHIPS.isMemberOf}]-
    (user:${LABELS.user} {userId: $userId}) 
    return user`;
  const params = {
    organizationId,
    userId,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errorMessage = `User with id '${userId}' not found in this organization.`;
    logger.error(errorMessage);
    throw errors.NotFound('USER', errorMessage);
  }

  const returnVal = formatUserReturnValue(result, allDetails);
  logger.debug('<< readById()');
  return returnVal;
};

/**
 *Fetches a user by his/her e-mail address and organizationId from database.
 *
 * @param {*} email
 * @param {*} organizationId
 * @param {*} [txOrSession=null]
 * @returns {*} {
                userId,
                name,
                email
            }
 */
const readByEmail = async (email, organizationId, txOrSession = null) => {
  logger.debug('>> readByEmail()');
  let query;
  if (organizationId) {
    query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
    <-[r:${RELATIONSHIPS.isMemberOf}]-
    (user:${LABELS.user}) 
    WHERE toLower(toString(user.email)) = toLower(toString($email))
    RETURN user`;
  } else {
    query = `MATCH (user:${LABELS.user})
        -[r:${RELATIONSHIPS.isMemberOf}]->
        (org:${orgLabels.organization})
        WHERE toLower(toString(user.email)) = toLower(toString($email)) 
        RETURN {user:user, organization:org}`;
  }

  const params = {
    organizationId,
    email,
  };

  let result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = `User with e-mail id '${email}' not found.`;
    logger.error(errMsg);
    throw errors.NotFound('USER', errMsg);
  }

  let userNode;
  if (organizationId) {
    userNode = result.records[0].get('user').properties;
  } else {
    result = result.records[0].get('{user:user, organization:org}');
    userNode = result.user.properties;
    userNode.organization = result.organization.properties;
  }

  const returnValue = utils.simplifyIntegerTypes(userNode);
  delete returnValue.password;
  logger.debug('<< readByEmail()');
  return returnValue;
};

/**
 *Fetches a user by his/her name and organizationId from database.
 *
 * @param {*} name
 * @param {*} organizationId
 * @param {*} [txOrSession=null]
 * @returns {*} {
                userId,
                name,
                email
            }
 */
const readByName = async (name, organizationId, txOrSession = null) => {
  logger.debug('>> readByName()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
    <-[r:${RELATIONSHIPS.isMemberOf}]-
    (user:${LABELS.user} {name: $name}) 
    return user`;
  const params = {
    organizationId,
    name,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    throw errors.NotFound('USER', `'${name}' user not found in this organization.`);
  }
  const returnVal = formatUserReturnValue(result);
  logger.debug('<< readByName()');
  return returnVal;
};

/**
 *Checks if user exists or not based on either one of the input parameter- userId, userName, userEmail.
 *This function also expects organizationId as input.
 *
 * @param {*} input
 * @param {*} txOrSession
 * @returns {*} Boolean
 */
const exists = async (input, txOrSession = null) => {
  logger.debug('>> exists()');
  let returnValue = false;

  if (!input.organizationId) {
    return returnValue;
  }

  if (input.userId) {
    try {
      await readById(input.userId, input.organizationId, false, txOrSession);
      returnValue = true;
    } catch (err) {}
  } else if (input.userEmail) {
    try {
      await readByEmail(input.userEmail, input.organizationId, txOrSession);
      returnValue = true;
    } catch (err) {}
  } else if (input.userName) {
    try {
      await readByName(input.userName, input.organizationId, txOrSession);
      returnValue = true;
    } catch (err) {}
  } else {
    // do nothing
  }
  logger.debug('<< exists()');
  return returnValue;
};

const createOrganizationRelation = async (context, user, organization, relationshipProps = {}) => {
  logger.debug('>> createOrganizationRelation()');
  try {
    const result = await executor.createOrUpdateRelationship(context, user, organization, RELATIONSHIPS.isMemberOf, relationshipProps);
    const returnValue = {
      user: result.source,
      organization: result.destination,
      relationship: result.relationship,
    };
    logger.debug('<< createOrganizationRelation()');
    return returnValue;
  } catch (err) {
    if (err.code === 'ServiceError.RELATIONSHIP_CREATION_FAILED') {
      const orgExist = await organizationNode.exists({ organizationId: organization.organizationId }, context.tx);
      if (!orgExist) {
        const errMsg = 'Organization does not exist. Cannot create user relationship with organization.';
        logger.error(errMsg);
        throw errors.NotFound('ORGANIZATION', errMsg);
      }
      const userExist = await exists({ userId: user.userId, organizationId: organization.organizationId }, context.tx);
      if (!userExist) {
        const errMsg = 'User does not exist. Cannot create user relationship with organization.';
        logger.error(errMsg);
        throw errors.NotFound('USER', errMsg);
      }
    }
    throw err;
  }
};

/**
 *Creates a new user node and associates that with organization node
 *
 * @param {*} context
 * @param {*} user
 * @returns {*} Newly created user node.
 */
const createNew = async (context, input) => {
  logger.debug('>> createNew()');
  const userProps = input.user;
  const organization = {
    properties: input.organization,
    labels: [organizationNode.LABELS.organization],
  };
  userProps.userId = uuid.uuidWithoutHyphens();
  if (userProps.password) {
    userProps.password = await crypto.hash(userProps.password);
  }

  let userNode = null;
  try {
    // create user node
    userNode = await executor.createNode(context, [LABELS.user], userProps);

    // associate user node with organization
    await createOrganizationRelation(context, { labels: [LABELS.user], properties: { userId: userProps.userId } }, organization);
  } catch (err) {
    if (err.code === 'Neo.ClientError.Schema.ConstraintValidationFailed' && err.message.includes('already exists with label')) {
      const errMsg = `User with email ${userProps.email} already exists.\nMessage=> ${err} \nStack=> ${err.stack}`;
      logger.error(errMsg);
      throw errors.AlreadyExists('USER', errMsg);
    }
    throw err;
  }

  userNode = utils.simplifyIntegerTypes(userNode);
  logger.debug('<< createNew()');
  return userNode;
};

/**
 *Creates user relationship with invitation token node.
 *
 * @param {*} context
 * @param {*} user
 * @param {*} invitationToken
 * @returns
 */
const createInvitationTokenRelation = async (context, user, invitationToken) => {
  logger.debug('>> createInvitationTokenRelation()');
  const result = await executor.createOrUpdateRelationship(context, user, invitationToken, RELATIONSHIPS.hasInvitationToken);
  const returnValue = {
    user: result.source,
    invitationToken: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createInvitationTokenRelation()');
  return returnValue;
};

/**
 *Creates IS_MEMBER_OF relationship from user to project node.
 *
 * @param {*} context
 * @param {*} userProps
 * @param {*} projectProps
 * @param {*} relationshipProps
 * @returns {*} {
            user,
            project,
            relationship
        }
 */
const createProjectRelation = async (context, userProps, projectProps, relationshipProps = {}) => {
  logger.debug('>> createProjectRelation()');
  try {
    const user = { labels: [LABELS.user], properties: { userId: userProps.userId } };
    const project = { labels: [projectLabels.project], properties: { projectId: projectProps.projectId } };

    const result = await executor.createOrUpdateRelationship(context, user, project, RELATIONSHIPS.isMemberOf, relationshipProps);
    const returnValue = {
      user: result.source,
      project: result.destination,
      relationship: result.relationship,
    };
    logger.debug('<< createProjectRelation()');
    return returnValue;
  } catch (err) {
    if (err.code === 'ServiceError.RELATIONSHIP_CREATION_FAILED') {
      const projectExist = await projectNode.exists({ projectId: projectProps.projectId, organizationId: userProps.organizationId }, context.tx);
      if (!projectExist) {
        const errMsg = 'Project does not exist. Cannot create user relationship with project';
        logger.error(errMsg);
        throw errors.NotFound('PROJECT', errMsg);
      }
      const userExist = await exists({ userId: userProps.userId, organizationId: userProps.organizationId }, context.tx);
      if (!userExist) {
        const errMsg = 'User does not exist. Cannot create user relationship with project.';
        logger.error(errMsg);
        throw errors.NotFound('USER', errMsg);
      }
    }
    throw err;
  }
};

/**
 *Creates IS_MEMBER_OF relationship from user to business unit node.
 *If businessUnitId is specified in input, relationship is created with that. Otherwise  default business unit is used.
 *
 * @param {*} context
 * @param {*} userProps
 * @param {*} businessUnitProps
 * @param {*} relationshipProps
 * @returns {*} {
            user,
            businessUnit,
            relationship
        }
 */
const createBusinessUnitRelation = async (context, userProps, businessUnitProps, relationshipProps = {}) => {
  logger.debug('>> createBusinessUnitRelation()');
  const user = { labels: [LABELS.user], properties: { userId: userProps.userId } };
  const businessUnit = { labels: [businessUnitLabels.businessUnit] };

  if (businessUnitProps.businessUnitId) {
    businessUnit.properties = { businessUnitId: businessUnitProps.businessUnitId };
  } else {
    const defaultBusinessUnit = await businessUnitNode.readDefaultBusinessUnit(businessUnitProps.organizationId, context.tx);
    businessUnit.properties = { businessUnitId: defaultBusinessUnit.properties.businessUnitId };
  }

  const result = await executor.createOrUpdateRelationship(context, user, businessUnit, RELATIONSHIPS.isMemberOf, relationshipProps);
  const returnValue = {
    user: result.source,
    businessUnit: result.destination,
    relationship: result.relationship,
  };

  logger.debug('<< createBusinessUnitRelation()');
  return returnValue;
};

/**
 *Changes user role on the specified scope
 *
 * @param {*} context
 * @param {*} userProps
 * @param {*} scope
 * @param {*} newRole
 */
const changeRole = async (context, userProps, scope, newRole) => {
  logger.debug('>> changeRole()');
  const relationshipProps = {
    role: newRole,
  };
  const user = { labels: [LABELS.user], properties: { userId: userProps.userId } };
  await executor.createOrUpdateRelationship(context, user, scope, RELATIONSHIPS.isMemberOf, relationshipProps);
  logger.debug('<< changeRole()');
};

const readUsers = async (query, params, txOrSession) => {
  logger.debug('>> readUsers()');
  const result = await executor.read(query, params, txOrSession);
  const users = [];
  for (let index = 0; index < result.records.length; index++) {
    const user = result.records[index].get('user').properties;
    delete user.password;
    users.push(user);
  }
  const returnVal = utils.simplifyIntegerTypes(users);
  logger.debug('<< readUsers()');
  return returnVal;
};

const runReadUsers = async (query, params, txOrSession) => {
  logger.debug('>> runReadUsers()');
  let result = await executor.read(query, params, txOrSession);

  result = utils.simplifyIntegerTypes(result);
  const users = [];
  for (let index = 0; index < result.records.length; index++) {
    const userType = {
      userProjects: [],
      userOrganization: {},
    };

    const record = result.records[index].get(GET_USERS_QUERY_RETURN);

    // set user details
    userType.user = record.user;

    // set organization details
    userType.userOrganization = record.orgRel;
    userType.userOrganization.organization = record.org;

    const { projects } = record;
    for (let prjIndex = 0; prjIndex < projects.length; prjIndex++) {
      let userProjectType = {};
      if (projects[prjIndex].prjRel) {
        userProjectType = projects[prjIndex].prjRel;
        userProjectType.role = projects[prjIndex].role;
      }
      if (projects[prjIndex].project) {
        userProjectType.project = projects[prjIndex].project;
      }
      if (Object.keys(userProjectType).length > 0) {
        userType.userProjects.push(userProjectType);
      }
    }
    users.push(userType);
  }
  logger.debug('<< runReadUsers()');
  return users;
};

/**
 *Read all users within organization along with allocated projects. This also gets user roles on different projects.
 *Returns array of users where each user object containing array of projects with specific role on project.
 *
 * @param {*} organizationId
 * @param {*} page
 * @param {*} count
 * @param {*} [txOrSession=null]
 * @returns {*}   [
                    {
                        "user": {
                                    "userId",
                                    "name",
                                    "email",
                                    "status"
                                },
                        "userProjects": [
                                            {
                                                "project": {
                                                            "projectId":,
                                                            "name"
                                                            },
                                                "role",
                                                "createdAt"
                                            }
                                        ]
                    }
                ]
 */
const readUsersByOrganizationId = async (organizationId, page = 1, count = 10, txOrSession = null) => {
  logger.debug('>> readUsersByOrganizationId()');
  const query = `match(org:${orgLabels.organization} {organizationId:$organizationId}) 
    with org match(org)<-[r1:${RELATIONSHIPS.isMemberOf}]-(user:${LABELS.user}) 
    WHERE user.status<>"${STATUSES.deleted}" AND r1.role IS NULL
    with org,r1,user optional match(user)-[r2:${RELATIONSHIPS.isMemberOf}]->(prj:${projectLabels.project} {status:"${STATUSES.active}"})
    WHERE NOT r2 IS NULL OPTIONAL MATCH(role:${LABELS.role} {name:r2.role}) WITH org,r1,user,r2,prj,role
    ORDER BY toLower(user.name) ASC
    return ${GET_USERS_QUERY_RETURN} SKIP toInteger(${page - 1}*${count}) LIMIT toInteger(${count})`;

  const params = {
    organizationId,
  };
  const returnVal = await runReadUsers(query, params, txOrSession);
  logger.debug('<< readUsersByOrganizationId()');
  return returnVal;
};

/**
 *Fetches total user count by organizationId from database.
 *
 * @param {*} organizationId
 * @param {*} [txOrSession=null]
 * @returns {*} count of users
 */
const readTotalUserCountByOrganizationId = async (organizationId, txOrSession = null) => {
  logger.debug('>> readTotalUsersByOrganizationId()');
  const query = `Match(org:${orgLabels.organization} {organizationId:$organizationId}) 
    with org Match (org)<-[r1:${RELATIONSHIPS.isMemberOf}]-(user:${LABELS.user}) 
    WHERE user.status<>"${STATUSES.deleted}"
     RETURN count(user) as count`;
  const params = {
    organizationId,
  };
  let returnValue = 0;
  const result = await executor.read(query, params, txOrSession);
  if (result.records.length > 0) {
    returnValue = result.records[0].get('count');
    returnValue = returnValue.low;
  }
  logger.debug('<< readTotalUsersByOrganizationId()');
  return returnValue;
};

/**
 *Read all users within organization.
 *
 * @param {*} organizationId
 * @param {*} [txOrSession=null]
 * @returns {*}   [
                    {
                        "user": {
                                    "userId",
                                    "name",
                                    "email",
                                    "status"
                                }
                    }
                ]
 */
const readLicensedUsersByOrganizationId = async (organizationId, txOrSession = null) => {
  logger.debug('>> readLicensedUsersByOrganizationId()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId:$organizationId}) 
    WITH org MATCH (org)<-[r1:${RELATIONSHIPS.isMemberOf}]-(user:${LABELS.user}) 
    WHERE user.status<>"${STATUSES.deleted}"
    RETURN user`;

  const params = {
    organizationId,
  };

  const result = await readUsers(query, params, txOrSession);

  logger.debug('<< readLicensedUsersByOrganizationId()');
  return result;
};

/**
 *Read all users within organization by user status(e.g. active, invited).
 *This function also optionally reads allocated projects to user along with projectRole.
 *Returns array of users where each user object containing array of projects with specific role on project.
 *
 * @param {*} organizationId
 * @param {*} [txOrSession=null]
 * @returns {*}   [
                    {
                        "user": {
                                    "userId",
                                    "name",
                                    "email",
                                    "status"
                                },
                        "userProjects": [
                                            {
                                                "project": {
                                                            "projectId":,
                                                            "name"
                                                            },
                                                "role",
                                                "createdAt"
                                            }
                                        ]
                    }
                ]
 */
const readUsersByStatusAndOrganizationId = async (userStatus, organizationId, txOrSession = null) => {
  logger.debug('>> readUsersByStatusAndOrganizationId()');
  const query = `match(org:${orgLabels.organization} {organizationId:$organizationId}) 
    with org match(org)<-[r1:${RELATIONSHIPS.isMemberOf}]-(user:${LABELS.user}) 
    WHERE toLower(toString(user.status))=toLower(toString($status))
    with org,r1,user optional match(user)-[r2:${RELATIONSHIPS.isMemberOf}]->(prj:${projectLabels.project} {status:"${STATUSES.active}"})
    WHERE NOT r2 IS NULL OPTIONAL MATCH(role:${LABELS.role} {name:r2.role})
    return ${GET_USERS_QUERY_RETURN}`;

  const params = {
    organizationId,
    status: userStatus,
  };

  const returnVal = await runReadUsers(query, params, txOrSession);
  logger.debug('>> readUsersByStatusAndOrganizationId()');
  return returnVal;
};

/**
 *Read all users within project along each user's roles on that project.
 *Returns array of users where each user object containing specified project with specific role.
 *
 * @param {*} projectId
 * @param {*} organizationId
 * @param {*} page
 * @param {*} count
 * @param {*} [txOrSession=null]
 * @returns {*}   [
                    {
                        "user": {
                                    "userId",
                                    "name",
                                    "email",
                                    "status"
                                },
                        "userProjects": [
                                            {
                                                "project": {
                                                            "projectId":,
                                                            "name"
                                                            },
                                                "role",
                                                "createdAt"
                                            }
                                        ]
                    }
                ]
 */
const readUsersByProjectId = async (projectId, organizationId, page = 1, count = 10, txOrSession = null) => {
  logger.debug('>> readUsersByProjectId()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})-[r1:${orgRelationships.hasProject}]-> (prj: ${projectLabels.project} { projectId: $projectId })<-[r2: ${RELATIONSHIPS.isMemberOf}]-(user: ${LABELS.user})
    WHERE user.status<>"Deleted" AND r2.role<>"Root" MATCH(role:${LABELS.role} {name:r2.role}) WITH org,r1,prj, r2, user, role
    ORDER BY toLower(user.name) ASC
    return ${GET_USERS_QUERY_RETURN} SKIP toInteger(${page - 1}*${count}) LIMIT toInteger(${count})`;

  const params = {
    organizationId,
    projectId,
  };
  const returnValue = await runReadUsers(query, params, txOrSession);
  logger.debug('<< readUsersByProjectId()');
  return returnValue;
};

/**
 *Fetches total user count by projectId from database.
 *
 * @param {*} projectId
 * @param {*} organizationId
 * @param {*} [txOrSession=null]
 * @returns {*} count of users
 */
const readTotalUserCountByProjectId = async (projectId, organizationId, txOrSession = null) => {
  logger.debug('>> readTotalUserCountByProjectId()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
    WITH org MATCH (org)-[r1:${orgRelationships.hasProject}]-> (prj: ${projectLabels.project} { projectId: $projectId })
    WITH org,r1,prj OPTIONAL MATCH(prj) < -[r2: ${RELATIONSHIPS.isMemberOf}] - (user: ${LABELS.user})
    WHERE user.status<>"Deleted" AND r2.role<>"Root"
     RETURN count(user) as count`;
  const params = {
    organizationId,
    projectId,
  };
  let returnValue = 0;
  const result = await executor.read(query, params, txOrSession);
  if (result.records.length > 0) {
    returnValue = result.records[0].get('count');
    returnValue = returnValue.low;
  }
  logger.debug('<< readTotalUserCountByProjectId()');
  return returnValue;
};

/**
 *Returns active users which are not part of the provided organization
 *
 * @param {*} organizationId
 * @param {*} projectId
 * @param {*} txOrSession
 * @returns {*} [{
 *                  "userId",
                    "name",
                    "email"
 *              }]
 */
const readNonProjectMembers = async (organizationId, projectId, txOrSession) => {
  logger.debug('>> readNonProjectMembers()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId:$organizationId})  
    WITH org MATCH(org)-[:${orgRelationships.hasProject}]->(prj:${projectLabels.project} {projectId:$projectId}) 
    WITH org, prj MATCH(user:${LABELS.user} {status:"${STATUSES.active}"})-[r:${RELATIONSHIPS.isMemberOf}]->(org) WHERE (NOT EXISTS(r.role) OR  r.role<>"Root")  
    WITH org, prj, user, r MATCH(user) WHERE NOT (user)-[:${RELATIONSHIPS.isMemberOf}]->(prj) return user`;

  const params = { organizationId, projectId };

  const returnVal = await readUsers(query, params, txOrSession);
  logger.debug('<< readNonProjectMembers()');
  return returnVal;
};

/**
 *Fetches users who has specified role(ProjectManager, Tester, etc) on specified scope(Project, Organization, etc).
 *
 * @param {*} role
 * @param {*} scope
 * @param {*} txOrSession
 * @returns {*} [{
 *                  "userId",
                    "name",
                    "email"
 *              }]
 */
const readByRole = async (role, scope, txOrSession) => {
  logger.debug('>> readByRole()');
  const query = `MATCH(on${convertIntoCypherLabels(scope.labels)} { ${convertIntoCypherProps(scope.properties)} })
WITH on MATCH(on) < -[r: ${RELATIONSHIPS.isMemberOf} { role: $role }] - (user: ${LABELS.user}) RETURN user`;

  const params = convertIntoCypherParams({ ...scope.properties, ...{ role } });

  const returnVal = await readUsers(query, params, txOrSession);
  logger.debug('<< readByRole()');
  return returnVal;
};

/**
 *Removes user's IS_MEMBER_OF relationship from the project.
 *
 * @param {*} tx
 * @param {*} userProps
 * @param {*} projectProps
 */
const deleteProjectRelation = async (tx, userProps, projectProps) => {
  logger.debug('>> deleteProjectRelation()');
  const user = {
    labels: [LABELS.user],
    properties: userProps,
  };
  const project = {
    labels: [projectLabels.project],
    properties: projectProps,
  };

  await executor.deleteRelationship(tx, user, project, RELATIONSHIPS.isMemberOf);
  logger.debug('<< deleteProjectRelation()');
};

/**
 * Deletes the user.
 * @param {*} context
 * @param {*} userProps
 * @param {*} updatedUserProps
 * @param {*} deleteType
 */
const deleteUser = async (context, userProps, updatedUserProps, deleteType = 'update') => {
  logger.debug('>> deleteUser()');
  let userNode = null;
  if (deleteType === 'update') {
    userNode = await executor.updateNode(context, [LABELS.user], userProps, updatedUserProps);
  } else {
    userNode = await executor.deleteNode(context.tx, [LABELS.user], userProps);
  }
  logger.debug('<< deleteUser()');
  return userNode;
};

module.exports = {
  createNew,
  createProjectRelation,
  createBusinessUnitRelation,
  createInvitationTokenRelation,
  readById,
  readByEmail,
  readByName,
  readUsersByProjectId,
  readUsersByOrganizationId,
  readTotalUserCountByOrganizationId,
  readTotalUserCountByProjectId,
  readLicensedUsersByOrganizationId,
  readUsersByStatusAndOrganizationId,
  exists,
  LABELS,
  RELATIONSHIPS,
  readNonProjectMembers,
  readByRole,
  deleteProjectRelation,
  changeRole,
  deleteUser,
};

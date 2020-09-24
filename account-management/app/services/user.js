const driverManager = require('../dal/graph-db/driver-manager');
const userNode = require('../dal/graph-db/models/nodes').user;
const projectNode = require('../dal/graph-db/models/nodes').project;
const invitationTokenNode = require('../dal/graph-db/models/nodes').invitationToken;
const srpNode = require('../dal/graph-db/models/nodes').scopeRolePrivilege;
const srpService = require('./scopeRolePrivilege');
const errors = require('../errors');
const mail = require('./mail');
const generalUtils = require('../utils');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);
const request = require('request-promise');
const config = require('config');

const ERROR_MESSAGES = {
  createUsersGeneric: 'Exception occurred while creating users.',
  rollback: 'Exception occurred while rolling back DB operation.',
  newUserInvitationMail: 'Exception occurred while sending new user sign up invitation email to',
  deallocateUsers: 'Exception occurred while deallocating users from the project.',
  changeRole: 'Exception occurred while changing user role',
  deleteUser: 'Exception occurred while deleting user.',
  projectRoleUpdateMail: 'Exception occurred while sending user role update mail.',
};

const projectLabels = projectNode.LABELS;

const { stringUtils } = generalUtils;

const validateGetUserInput = (args) => {
  logger.debug('>> validateGetUserInput()');
  if (!args.email && !args.name) {
    const errMsg = 'User email or name is mandatory to get user details.';
    logger.error(errMsg);
    throw errors.UserEmailAndNameNotFound(errMsg);
  }

  // organizationId is optional if searched by email. But mandatory if searched by name
  if (args.name && !args.organizationId) {
    const errMsg = 'OrganizationId is mandatory to get user details.';
    logger.error(errMsg);
    throw errors.Mandatory('ORGANIZATION', errMsg);
  }
  logger.debug('<< validateGetUserInput()');
};

/**
 *Fetches the a single user details based on user email or name.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getUser = async (args) => {
  logger.debug('>> getUser()');
  validateGetUserInput(args);

  let returnValue = null;
  const { organizationId } = args;
  const { email } = args;
  const { name } = args;

  if (email) {
    returnValue = await userNode.readByEmail(email, organizationId);
  }
  else if (name) {
    returnValue = await userNode.readByName(name, organizationId);
  }
  else {
    // do nothing
  }
  logger.debug('<< getUser()');
  return returnValue;
};

/**
 *If projectId is provided, this service reads all users allocated to specified project with roles.
 *Otherwise reads all users within provided organizationId. organizationId is mandatory for both conditions.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getUsers = async (args, context) => {
  logger.debug('>> getUsers()');
  if (!args.organizationId) {
    const errMsg = 'OrganizationId is mandatory to get users details.';
    logger.error(errMsg);
    throw errors.NotFound('ORGANIZATION', errMsg);
  }

  let page = 1;
  let count = 10;
  const { page: pg, count: limit } = args;
  if (pg && pg >= 1) {
    page = pg;
  }

  if (limit && limit >= 1) {
    count = limit;
  }

  const returnValue = {};
  let data = null;
  let totalUserCount = 0;
  if (args.projectId) {
    context.projectId = args.projectId;
    await srpService.hasReadUserPrivilege(context);
    totalUserCount = await userNode.readTotalUserCountByProjectId(args.projectId, args.organizationId);
    if (args.all) {
      count = totalUserCount;
    }
    data = await userNode.readUsersByProjectId(args.projectId, args.organizationId, page, count);
  }
  else {
    await srpService.hasReadUserPrivilege(context);
    totalUserCount = await userNode.readTotalUserCountByOrganizationId(args.organizationId);
    if (args.all) {
      count = totalUserCount;
    }
    data = await userNode.readUsersByOrganizationId(args.organizationId, page, count);
  }
  logger.debug('<< getUsers()');
  returnValue.data = data;
  returnValue.totalCount = totalUserCount;
  return returnValue;
};

/**
 *Read all users within organization by user status(e.g. active, invited).
 *This function also optionally reads allocated projects to user along with projectRole.
 *Returns array of users where each user object containing array of projects with specific role on project.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getUsersByStatus = async (args) => {
  logger.debug('>> getUsersByStatus()');
  if (!args.organizationId) {
    const errMsg = 'OrganizationId is mandatory to get users details by status.';
    logger.error(errMsg);
    throw errors.NotFound('ORGANIZATION', errMsg);
  }
  if (!args.status) {
    const errMsg = 'UserStatus is mandatory to get users details by status.';
    logger.error(errMsg);
    throw errors.NotFound('USER_STATUS', errMsg);
  }

  const returnValue = await userNode.readUsersByStatusAndOrganizationId(args.status, args.organizationId);
  logger.debug('<< getUsersByStatus()');
  return returnValue;
};

const validateGetNonProjectMembersInput = (args, context) => {
  logger.debug('>> validateGetNonProjectMembersInput()');
  if (!context.organizationId) {
    const errMsg = 'OrganizationId is mandatory to get non project members.';
    logger.error(errMsg);
    throw errors.Mandatory('ORGANIZATION', errMsg);
  }

  if (!args.projectId) {
    const errMsg = 'projectId is mandatory to get non project members.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT', errMsg);
  }
  logger.debug('<< validateGetNonProjectMembersInput()');
};

const getNonProjectMembers = async (args, context) => {
  logger.debug('>> getNonProjectMembers()');
  validateGetNonProjectMembersInput(args, context);

  const returnValue = await userNode.readNonProjectMembers(context.organizationId, args.projectId);
  logger.debug('<< getNonProjectMembers()');
  return returnValue;
};

const validateCreateUsersInput = (args) => {
  logger.debug('>> validateCreateUsersInput()');
  if (!args.organizationId) {
    const errMsg = 'OrganizationId is mandatory to create users.';
    logger.error(errMsg);
    throw errors.Mandatory('ORGANIZATION', errMsg);
  }

  if (!args.usersInput.users || args.usersInput.users.length <= 0) {
    const errMsg = 'At least one user is mandatory.';
    logger.error(errMsg);
    throw errors.Mandatory('USER', errMsg);
  }
  logger.debug('<< validateCreateUsersInput()');
};

const validateCreateUserInput = (user) => {
  logger.debug('>> validateCreateUserInput()');
  if (!user.email) {
    const errMsg = 'User email is mandatory.';
    logger.error(errMsg);
    throw errors.Mandatory('USER_EMAIL', errMsg);
  }
  logger.debug('<< validateCreateUserInput()');
};

/**
 *This service creates number of users, assign those users to specified organization, and business unit.
 *This also sends sign up invitation mails to users.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const createUsers = async (args, context) => {
  logger.debug('>> createUsers()');
  let tx = null;
  let session = null;

  validateCreateUsersInput(args);

  try {
    const { organizationId } = args;
    const { businessUnitId } = args.usersInput;
    const { users } = args.usersInput;

    const newUsers = [];
    const returnValue = true;

    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;

    // Validate if user has privilege to create another user
    await srpService.hasCreateUserPrivilege(context, tx);

    // Continue. User has privilege to create another user
    for (let index = 0; index < users.length; index++) {
      let user = users[index];

      validateCreateUserInput(user);

      user.status = 'Invited';
      user.email = user.email.toLowerCase();
      user = await userNode.createNew(context, { user, organization: { organizationId } });
      user = user.properties;

      // create invitationToken for new user
      const invitationToken = await invitationTokenNode.create(context);
      await userNode.createInvitationTokenRelation(context, { labels: [userNode.LABELS.user], properties: { userId: user.userId } }, invitationToken);

      user.accessId = invitationToken.properties.accessId;
      newUsers.push(user);

      // associate user with business unit
      await userNode.createBusinessUnitRelation(context, { userId: user.userId }, { businessUnitId, organizationId });
    }

    await tx.commit();

    mail.sendUserInvitationMails(newUsers);

    logger.debug('<< createUsers()');
    return returnValue;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.createUsersGeneric} \nMessage=> ${err} \nStack=> ${err.stack}`);

    if (tx !== null) {
      try {
        await tx.rollback();
      }
      catch (rollbackError) {
        logger.error(`${ERROR_MESSAGES.rollback} ${rollbackError}`);
      }
    }
    throw err;
  }
  finally {
    driverManager.closeSession(session);
  }
};

const validateAllocateUsersToProjectInput = (args) => {
  logger.debug('>> validateAllocateUsersToProjectInput()');
  if (!args.organizationId) {
    const errMsg = 'OrganizationId is mandatory to assign users to project.';
    logger.error(errMsg);
    throw errors.Mandatory('ORGANIZATION', errMsg);
  }

  if (!args.projectId) {
    const errMsg = 'projectId is mandatory to assign users to that project.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT', errMsg);
  }

  if (!args.usersInput.users || args.usersInput.users.length <= 0) {
    const errMsg = 'At least one user is mandatory to be allocated on the project.';
    logger.error(errMsg);
    throw errors.Mandatory('USER', errMsg);
  }
  logger.debug('<< validateAllocateUsersToProjectInput()');
};

const allocateUsersToProject = async (args, context) => {
  logger.debug('>> allocateUsersToProject()');
  let tx = null;
  let session = null;

  validateAllocateUsersToProjectInput(args);

  try {
    const { organizationId } = args;
    const { projectId } = args;
    const { businessUnitId } = args;
    const { users } = args.usersInput;
    /*
    Un comment this code block when UI allows PM users to send request to admin users for new users in the project
    const newUsers = [];
*/
    const returnValue = true;

    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;

    // Validate if user has privilege to allocate users to project
    context.projectId = projectId;
    await srpService.hasAllocateUserToProjectPrivilege(context, tx);

    // Continue. User has privilege to allocate users to project
    for (let index = 0; index < users.length; index++) {
      let user = users[index];

      // Create user entry in data store if he/she is a new user
      if (!user.userId) {
        user.status = 'requested';
        user = await userNode.createNew(context, { user, organization: { organizationId } });
        user = user.properties;
        /*
    Un comment this code block when UI allows PM users to send request to admin users for new users in the project
    newUsers.push(user.properties);
*/
      }

      // associate user with project
      await userNode.createProjectRelation(context, { userId: user.userId, organizationId }, { projectId }, { role: user.projectRole });

      // associate user with business unit
      await userNode.createBusinessUnitRelation(context, { userId: user.userId }, { businessUnitId, organizationId });
    }

    await tx.commit();

    // Send user request mails to admin users
    /*
      Un comment this code block when UI allows PM users to send request to admin users for new users in the project
    if (newUsers.length > 0) {
      if (!businessUnitId) {
        const bu = await businessUnitNode.readDefaultBusinessUnit(organizationId);
        businessUnitId = bu.properties.businessUnitId;
      }
      const adminUsers = await userNode.readByRole('Admin', { labels: [buLabels.businessUnit], properties: { businessUnitId } });
      const recipients = [];
      for (let index = 0; index < adminUsers.length; index++) {
        recipients.push(`<${adminUsers[index].email}>`);
      }
      mail.sendUserRequestMails(recipients, newUsers);
    }
            /****************************************************************/
    logger.debug('<< allocateUsersToProject()');
    return returnValue;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.createUsersGeneric} \nMessage=> ${err} \nStack=> ${err.stack}`);

    if (tx !== null) {
      try {
        await tx.rollback();
      }
      catch (rollbackError) {
        logger.error(`${ERROR_MESSAGES.rollback} ${rollbackError}`);
      }
    }
    throw err;
  }
  finally {
    driverManager.closeSession(session);
  }
};

const validateDeallocateUsersFromProjectInput = (args) => {
  logger.debug('>> validateDeallocateUsersFromProjectInput()');
  if (!args.projectId) {
    const errMsg = 'projectId is mandatory to deallocate users from that project.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT', errMsg);
  }

  if (!args.usersInput.users || args.usersInput.users.length <= 0) {
    const errMsg = 'No user is provided to be deallocated from the project';
    logger.error(errMsg);
    throw errors.Mandatory('USER', errMsg);
  }
  logger.debug('<< validateDeallocateUsersFromProjectInput()');
};

const validateUserToBeDeallocatedFromProject = (user) => {
  logger.debug('>> validateUserToBeDeallocatedFromProject()');
  if (!user.userId) {
    logger.error('userId is not provided. Cannot deallocate user from the project.');
    throw errors.Mandatory('USER_ID', 'userId is mandatory to deallocate user from the project.');
  }
  logger.debug('<< validateUserToBeDeallocatedFromProject()');
};

/**
 *Deallocates users from the project.
 *If user being deallocated is the only ProjectManager of the project then that user cannot be deallocated.
 *
 * @param {*} args
 * @param {*} context
 * @returns {*} Boolean
 */
const deallocateUsersFromProject = async (args, context) => {
  logger.debug('>> deallocateUsersFromProject()');
  let tx = null;
  let session = null;

  validateDeallocateUsersFromProjectInput(args);

  try {
    const { projectId } = args;
    const { users } = args.usersInput;

    session = driverManager.getWriteSession();
    tx = session.beginTransaction();

    // Validate if user has privilege to deallocate users to project
    context.projectId = projectId;
    await srpService.hasDeallocateUserFromProjectPrivilege(context, tx);

    for (let index = 0; index < users.length; index++) {
      const user = users[index];
      validateUserToBeDeallocatedFromProject(user);

      await userNode.deleteProjectRelation(tx, { userId: user.userId }, { projectId });
    }

    await tx.commit();
    logger.debug('<< deallocateUsersFromProject()');
    return true;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.deallocateUsers} \nMessage=> ${err} \nStack=> ${err.stack}`);
    if (tx !== null) {
      try {
        await tx.rollback();
      }
      catch (rollbackError) {
        logger.error(`${ERROR_MESSAGES.rollback} ${rollbackError}`);
      }
    }
    throw err;
  }
  finally {
    driverManager.closeSession(session);
  }
};

const checkIfUserIsProjectManager = (userId, projects) => {
  logger.debug('>> checkIfUserIsProjectManager()');
  projects.forEach((project) => {
    const { users } = project;
    if (users.length > 0) {
      const userIndex = users.findIndex((user) => user.userId === userId);
      if (userIndex !== -1) {
        const user = users[userIndex];
        if (user.role === 'ProjectManager') {
          const projectManagersList = users.filter((userInfo) => userInfo.role === 'ProjectManager');
          if (projectManagersList.length === 1) {
            const errMsg = 'Project must have atleast one project manager.';
            logger.error(errMsg);
            throw errors.Mandatory('PROJECT_MANAGER', errMsg);
          }
        }
      }
    }
  });
  logger.debug('<< checkIfUserIsProjectManager()');
};

const removeUserProjectRelations = async (tx, userId, projects) => {
  logger.debug('<< removeUserProjectRelations()');
  for (let i = 0; i < projects.length; i++) {
    await userNode.deleteProjectRelation(tx, { userId }, { projectId: projects[i].projectId });
  }
  logger.debug('>> removeUserProjectRelations()');
};

/**
 * Deletes user from the organization by updating the status to Deleted.
 * User will be removed if actively or inactively attached to a project.
 * @param {*} args
 * @param {*} context
 */
const deleteUser = async (args, context) => {
  logger.debug('>> deleteUser()');
  let tx = null;
  let session = null;
  let returnValue = false;

  try {
    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;
    if (!args.userId) {
      const errMsg = 'UserId is mandatory to delete user.';
      logger.error(errMsg);
      throw errors.Mandatory('USER', errMsg);
    }
    if (!args.organizationId) {
      const errMsg = 'OrganizationId is mandatory to delete user.';
      logger.error(errMsg);
      throw errors.Mandatory('ORGANIZATION', errMsg);
    }

    // Validate if user has privilege to delete user
    await srpService.hasDeleteUserPrivilege(context, tx);

    const { userId } = args;
    const user = await userNode.readById(userId, args.organizationId, true, tx);
    if (user.length === 0) {
      const errMsg = 'User does not exist on the provided organization';
      logger.error(errMsg);
      throw errors.NotFound('User', errMsg);
    }
    const activeProjectExists = await projectNode.readUserProjectsFromOrganization(userId);
    if (activeProjectExists.length > 0) {
      await checkIfUserIsProjectManager(userId, activeProjectExists);
      await removeUserProjectRelations(tx, userId, activeProjectExists);
    }

    const inactiveProjectExists = await projectNode.readUserProjectsFromOrganization(userId, 'Inactive');
    if (inactiveProjectExists.length > 0) {
      await removeUserProjectRelations(tx, userId, inactiveProjectExists);
    }
    const userProps = { ...user };
    if (userProps.status === 'Invited') {
      const token = await invitationTokenNode.readByUserId(tx, { userId });
      await invitationTokenNode.deleteNode(tx, { accessId: token[0].accessId });
      await userNode.deleteUser(context, { userId }, userProps, 'remove');
    }
    else {
      userProps.status = 'Deleted';
      await userNode.deleteUser(context, { userId }, userProps);
    }
    await tx.commit();
    returnValue = true;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.deleteUser} \nMessage=> ${err} \nStack=> ${err.stack}`);

    if (tx !== null) {
      try {
        await tx.rollback();
      }
      catch (rollbackError) {
        logger.error(`${ERROR_MESSAGES.rollback} ${rollbackError}`);
      }
    }
    throw err;
  }
  finally {
    driverManager.closeSession(session);
  }
  logger.debug('<< deleteUser()');
  return returnValue;
};

/**
 *Validates all required inputs given in API and Object containing validated scope, role, user information read to be passed to changeRole node API.
 *Checks provided role and scope are right.
 *Validate role being applied is valid for given scope.
 *In the context of project role, if user role is ProjectManager and user is the only ProjectManager then user role would not change.
 *
 * @param {*} tx
 * @param {*} args
 * @returns {*} {
 *                  user:{userId },
 *                  scope:{
                            labels: [scope LABELS],
                            properties: {
                                        scopeId
                                        }
                          },
                    role:newRole
 *          }
 */
const prepareChangeRoleInput = async (tx, args, context) => {
  logger.debug('>> prepareChangeRoleInput()');
  const returnValue = {};

  if (!args.userId) {
    const errorMsg = 'userId is mandatory to change the user role on given scope.';
    logger.error(errorMsg);
    throw errors.Mandatory('USER_ID', errorMsg);
  }
  returnValue.user = { userId: args.userId };

  if (!args.role) {
    const errorMsg = 'role is mandatory to change the user role on given scope.';
    logger.error(errorMsg);
    throw errors.Mandatory('ROLE', errorMsg);
  }

  if (args.scopeInput && !args.scopeInput.name) {
    const errorMsg = 'Scope name is mandatory to change the user role on given scope.';
    logger.error(errorMsg);
    throw errors.Mandatory('SCOPE_NAME', errorMsg);
  }

  if (!args.scopeInput.id) {
    const errorMsg = 'Scope id is mandatory to change the user role on given scope.';
    logger.error(errorMsg);
    throw errors.Mandatory('SCOPE_ID', errorMsg);
  }

  const isProjectScope = stringUtils.equalsIgnoreCase(args.scopeInput.name, srpNode.SCOPES.Project);
  if (!isProjectScope) {
    // At this moment only project role is allowed to be changed.
    const errorMsg = `Changing user role on the scope ${args.scopeInput.name} is not allowed.`;
    logger.error(errorMsg);
    throw errors.NotAllowed('CHANGING_ROLE', errorMsg);
  }

  // Validate if user has privilege to change user role on project
  context.projectId = args.scopeInput.id;
  await srpService.hasChangeUserRoleOnProjectPrivilege(context, tx);

  returnValue.scope = {
    labels: [projectLabels.project],
    properties: {
      projectId: args.scopeInput.id,
    },
  };

  // Check role to be set is valid or not for Project scope
  let validRoleName = '';
  const projectRoles = await srpNode.getProjectRoles();
  for (let index = 0; index < projectRoles.length; index++) {
    if (stringUtils.equalsIgnoreCase(args.role, projectRoles[index])) {
      // user role name can be in any case in input (lowercase, camelCase, etc). So do not use input role as it is.
      validRoleName = projectRoles[index];
      break;
    }
  }
  if (!validRoleName) {
    const errorMsg = `Changing user role to ${args.role} on scope ${args.scopeInput.name} is not allowed.`;
    logger.error(errorMsg);
    throw errors.NotAllowed('CHANGING_ROLE', errorMsg);
  }
  returnValue.role = validRoleName;

  logger.debug('<< prepareChangeRoleInput()');
  return returnValue;
};

const sendRoleUpdateNotification = async (project, user, role) => {
  logger.debug('>> sendRoleUpdateNotification()');
  try {
    const options = {
      method: 'POST',
      uri: `${config.get('notificationEndpoint')}${config.get('notificationPrefix')}/project/role/update`,
      body: {
        recipients: [`${user.name} <${user.email}>`],
        user: {
          name: `${user.name}`,
        },
        project: {
          name: `${project.name}`,
          lastRole: `${user.roleDisplayName}`,
          updatedRole: `${role}`,
        },
        link: `${config.get('uiLink')}/quick-starter-page?projectId=${project.projectId}`,
      },
      json: true,
    };
    await request(options);
    logger.debug('<< sendRoleUpdateNotification()');
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.projectRoleUpdateMail} ${err}`);
  }
};

/**
 *Changes user role on the specified scope
 *
 * @param {*} args
 * @param {*} context
 * @returns {*} Boolean
 */
const changeRole = async (args, context) => {
  logger.debug('>> changeRole()');
  let tx = null;
  let session = null;
  try {
    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;

    const preparedInput = await prepareChangeRoleInput(tx, args, context);
    const projectDetails = await projectNode.readProjectFromOrganization(context.organizationId, args.scopeInput.id);
    const userDetails = projectDetails[0].users.filter((user) => user.userId === preparedInput.user.userId);
    await userNode.changeRole(context, preparedInput.user, preparedInput.scope, preparedInput.role);
    const roleDetails = await srpNode.readRoleByName(preparedInput.role);
    await sendRoleUpdateNotification(projectDetails[0], userDetails[0], roleDetails.displayName);

    await tx.commit();
    logger.debug('<< changeRole()');
    return true;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.changeRole} \nMessage=> ${err} \nStack=> ${err.stack}`);
    if (tx !== null) {
      try {
        await tx.rollback();
      }
      catch (rollbackError) {
        logger.error(`${ERROR_MESSAGES.rollback} ${rollbackError}`);
      }
    }
    throw err;
  }
  finally {
    driverManager.closeSession(session);
  }
};

module.exports = {
  getUser,
  getUsers,
  getUsersByStatus,
  getNonProjectMembers,
  createUsers,
  allocateUsersToProject,
  deallocateUsersFromProject,
  changeRole,
  deleteUser,
};

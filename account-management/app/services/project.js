const srpService = require('./scopeRolePrivilege');
const driverManager = require('../dal/graph-db/driver-manager');
const projectNode = require('../dal/graph-db/models/nodes').project;
const userNode = require('../dal/graph-db/models/nodes').user;
const configurationNode = require('../dal/graph-db/models/nodes').configuration;
const generalUtils = require('../utils');
const errors = require('../errors');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);
const date = require('../utils/date-time');
const request = require('request-promise');
const config = require('config');

const { stringUtils } = generalUtils;

const ERROR_MESSAGES = {
  createProjectGeneric: 'Exception occurred while creating project.',
  updateProjectGeneric: 'Exception occurred while updating project.',
  deleteProjectGeneric: 'Exception occurred while deleting project.',
  rollback: 'Exception occurred while rolling back DB operation.',
  projectManagerMailSend: 'Exception occurred while sending notification to project manager.',
  userIdMandatory: 'UserId is mandatory to get project details.',
  orgIdMandatory: 'OrganizationId is mandatory to get project details.',
  projectIdMandatory: 'ProjectId is mandatory to get project details.',
};

const validateGetProjectInput = async (args, context) => {
  logger.debug('>> validateGetProjectInput()');
  if (!context.userId) {
    const errMsg = ERROR_MESSAGES.userIdMandatory;
    logger.error(errMsg);
    throw errors.Mandatory('USER', errMsg);
  }

  if (!context.organizationId) {
    const errMsg = ERROR_MESSAGES.orgIdMandatory;
    logger.error(errMsg);
    throw errors.Mandatory('ORGANIZATION', errMsg);
  }

  if (!args.projectId) {
    const errMsg = ERROR_MESSAGES.projectIdMandatory;
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT', errMsg);
  }
  logger.debug('<< validateGetProjectInput()');
};

/**
 *Fetches single project details based on project Id and organization Id.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getUserProject = async (args, context) => {
  logger.debug('>> getUserProject()');
  try {
    await validateGetProjectInput(args, context);

    let returnValue = null;
    const { userId } = context;
    const { projectId } = args;
    const { organizationId } = context;
    returnValue = await projectNode.readUserProjectFromOrganization(userId, projectId, organizationId);
    logger.debug('<< getUserProject()');
    return { ...returnValue[0] };
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

/**
 *Fetches single project details based on project Id and organization Id.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getOrganizationProject = async (args, context) => {
  logger.debug('>> getOrganizationProject()');
  try {
    await validateGetProjectInput(args, context);

    let returnValue = null;
    const { organizationId } = context;
    const { projectId } = args;
    returnValue = await projectNode.readProjectFromOrganization(organizationId, projectId);
    logger.debug('<< getOrganizationProject()');
    return { ...returnValue[0] };
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

/**
 *If organizationId is provided, this service reads all projects allocated to specified organization with names.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getOrganizationProjects = async (args, context) => {
  logger.debug('>> getOrganizationProjects()');
  if (!context.organizationId) {
    const errMsg = ERROR_MESSAGES.orgIdMandatory;
    logger.error(errMsg);
    throw errors.NotFound('ORGANIZATION', errMsg);
  }

  if (!context.userId) {
    const errMsg = ERROR_MESSAGES.userIdMandatory;
    logger.error(errMsg);
    throw errors.NotFound('USER', errMsg);
  }

  const { userId } = context;
  let page = 1;
  let count = 10;
  const { page: pg, count: limit } = args;
  const validOrganizationUser = await userNode.exists({ userId, organizationId: context.organizationId });

  if (!validOrganizationUser) {
    const errMsg = 'User is not present in the organization.';
    logger.error(errMsg);
    throw errors.NotFound('USER', errMsg);
  }

  if (pg) {
    page = pg;
  }

  if (limit) {
    count = limit;
  }

  let totalProjectCount = 0;
  let data = [];
  totalProjectCount = await projectNode.readTotalProjectCountByOrganizationId(context.organizationId);
  if (args.all) {
    count = totalProjectCount;
  }
  data = await projectNode.readProjectsFromOrganization(context.organizationId, 'Active', page, count);
  logger.debug('<< getOrganizationProjects()');
  return { totalCount: totalProjectCount, data };
};

/**
 *If userId is provided, this service reads all projects allocated to specified user with names.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getUserProjectsDetails = async (args, context) => {
  logger.debug('>> getUserProjectsDetails()');
  if (!context.organizationId) {
    const errMsg = ERROR_MESSAGES.orgIdMandatory;
    logger.error(errMsg);
    throw errors.NotFound('ORGANIZATION', errMsg);
  }

  if (!context.userId) {
    const errMsg = ERROR_MESSAGES.userIdMandatory;
    logger.error(errMsg);
    throw errors.NotFound('USER', errMsg);
  }

  const { userId } = context;
  const validOrganizationUser = await userNode.exists({ userId, organizationId: context.organizationId });

  if (!validOrganizationUser) {
    const errMsg = 'User is not present in the organization.';
    logger.error(errMsg);
    throw errors.NotFound('USER', errMsg);
  }

  let returnValue = null;
  returnValue = await projectNode.readUserProjectsFromOrganization(context.userId);
  returnValue.sort((a, b) => {
    if (date.isBefore(a.createdAt, b.createdAt)) {
      return 1;
    }
    else {
      return -1;
    }
  });
  logger.debug('<< getUserProjectsDetails()');
  return returnValue;
};

const getUserProjects = async (args, context) => {
  logger.debug('>> getUserProjects()');
  let page = 1;
  let count = 10;
  const { page: pg, count: limit } = args;
  if (pg) {
    page = pg;
  }

  if (limit) {
    count = limit;
  }

  let totalProjectCount = 0;
  let data = [];
  totalProjectCount = await projectNode.readUserProjectCountByUserId(context.userId);
  if (args.all) {
    count = totalProjectCount;
  }
  data = await projectNode.readUserProjects(context.userId, page, count);
  logger.debug('<< getUserProjects()');
  return { totalCount: totalProjectCount, data };
};

const validateCreateProjectInput = async (args, context, tx) => {
  logger.debug('>> validateCreateProjectInput()');
  if (!context.userId) {
    const errMsg = 'UserId is mandatory to create project.';
    logger.error(errMsg);
    throw errors.Mandatory('USER', errMsg);
  }

  if (!args.organizationId) {
    const errMsg = 'OrganizationId is mandatory to create project.';
    logger.error(errMsg);
    throw errors.Mandatory('ORGANIZATION', errMsg);
  }

  if (!args.projectInput) {
    const errMsg = 'Project Details not found.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT', errMsg);
  }

  if (!args.projectInput.name) {
    const errMsg = 'Project name is mandatory.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT_NAME', errMsg);
  }
  else {
    const isExist = await projectNode.exists({ projectName: args.projectInput.name, organizationId: args.organizationId }, 'Active', tx);
    if (isExist) {
      const errMsg = `A project with the name ${args.projectInput.name} was created in the past. Please use a different project name.`;
      logger.error(errMsg);
      throw errors.Mandatory('PROJECT_NAME', errMsg);
    }
  }

  if (args.projectInput.key) {
    const isKeyExist = await projectNode.exists({ projectKey: args.projectInput.key, organizationId: args.organizationId }, 'Active', tx);
    if (isKeyExist) {
      const errMsg = `A project with the key ${args.projectInput.key} was created in the past. Please use a different key name.`;
      logger.error(errMsg);
      throw errors.Mandatory('PROJECT_KEY', errMsg);
    }
  }

  if (stringUtils.equals(context.userId, args.projectInput.projectManagerId)) {
    const errMsg = 'Allocating admin user as project manager is not allowed.';
    logger.error(errMsg);
    throw errors.NotAllowed('ALLOCATING_ADMIN_AS_PROJECT_MANAGER', errMsg);
  }
  logger.debug('<< validateCreateProjectInput()');
};

const getUniqueKey = async (args, context) => {
  logger.debug('>> getUniqueKey()');
  const { organizationId } = context;
  let { key } = args.projectInput;
  let index = 0;
  let isKeyUnique = false;
  while (!isKeyUnique) {
    const result = await projectNode.readProjectByKeyFromOrganization(key, organizationId, context.tx);
    if (result.length === 0) {
      isKeyUnique = true;
    }
    else {
      index++;
      key = key + index;
    }
  }
  logger.debug('<< getUniqueKey()');
  return key;
};

const sendMailToProjectManager = async (relation) => {
  logger.debug('>> sendMailToProjectManager()');
  try {
    const project = relation.project.properties;
    const user = relation.user.properties;
    const options = {
      method: 'POST',
      uri: `${config.get('notificationEndpoint')}${config.get('notificationPrefix')}/project/creation`,
      body: {
        recipients: [`${user.name} <${user.email}>`],
        project: {
          manager: {
            name: `${user.name}`,
          },
          name: `${project.name}`,
          description: `${project.description}`,
        },
        link: `${config.get('uiLink')}/quick-starter-page?projectId=${project.projectId}`,
      },
      json: true,
    };
    await request(options);
    logger.debug('<< sendMailToProjectManager()');
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.projectManagerMailSend} ${err}`);
  }
};

/**
 *This service creates a project with asked details and establish a relationship between organization and the project.
 * It also sets the user as project manager to the project and establish relationship between each other.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const createProject = async (args, context) => {
  logger.debug('>> createProject()');
  let tx = null;
  let session = null;

  try {
    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;

    await validateCreateProjectInput(args, context, tx);
    if (!args.projectInput.key) {
      args.projectInput.key = '';
      const strArray = args.projectInput.name.split(' ');
      for (let i = 0; i < strArray.length; i++) {
        args.projectInput.key = args.projectInput.key + strArray[i].charAt(0).toUpperCase();
      }
      args.projectInput.key = await getUniqueKey(args, context);
    }
    else {
      args.projectInput.key = args.projectInput.key.toUpperCase();
    }
    args.projectInput.keyCounter = 0;
    const { organizationId } = args;
    const { businessUnitId } = args.projectInput;
    const { projectInput } = args;
    projectInput.name = projectInput.name.toString();
    projectInput.status = 'Active';
    const projectProps = { ...projectInput };
    delete projectProps.projectManagerId;
    delete projectProps.projectManager;
    delete projectProps.businessUnitId;

    const returnValue = true;

    // Validate if user has privilege to create project
    await srpService.hasCreateProjectPrivilege(context, tx);

    // Continue. User has privilege to create project
    let project = null;
    project = await projectNode.create(context, { project: projectProps, organization: { organizationId } });
    project = project.properties;
    const configuration = await configurationNode.create(context);

    await projectNode.createBusinessUnitRelation(context, { businessUnitId, organizationId }, { projectId: project.projectId });
    await projectNode.createProjectConfigurationRelation(context, { projectId: project.projectId }, { configurationId: configuration.properties.configurationId });

    if (projectInput.projectManagerId) {
      const projectManagerRelation = await userNode.createProjectRelation(context, { userId: projectInput.projectManagerId }, { projectId: project.projectId }, { role: 'ProjectManager' });
      await sendMailToProjectManager(projectManagerRelation);
    }
    else {
      await userNode.createProjectRelation(context, { userId: context.userId }, { projectId: project.projectId }, { role: 'Root' });
    }

    await tx.commit();
    logger.debug('<< createProject()');
    return returnValue;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.createProjectGeneric} \nMessage=> ${err} \nStack=> ${err.stack}`);

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

const validateUpdateProjectInput = async (args, context) => {
  logger.debug('>> validateUpdateProjectInput()');
  if (!context.organizationId) {
    const errMsg = 'OrganizationId is mandatory to update project.';
    logger.error(errMsg);
    throw errors.Mandatory('ORGANIZATION', errMsg);
  }

  if (!args.projectId) {
    const errMsg = 'Project Id is mandatory to update project.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT', errMsg);
  }

  if (!args.updateProjectInput.name) {
    const errMsg = 'Project name is mandatory.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT_NAME', errMsg);
  }
  logger.debug('<< validateUpdateProjectInput()');
};

/**
 *
 * The project name and description for a particular project gets updated.
 * @param {*} args
 * @param {*} context
 */
const updateProject = async (args, context) => {
  logger.debug('>> updateProject()');
  let tx = null;
  let session = null;
  let returnValue = false;

  try {
    await validateUpdateProjectInput(args, context);
    const { organizationId } = args;
    const { projectId } = args;
    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;

    context.projectId = projectId;
    srpService.hasUpdateProjectPrivilege(context, tx);

    let project = null;
    project = await projectNode.readById(projectId, organizationId);
    if (project.name !== args.updateProjectInput.name) {
      const isExist = await projectNode.exists({ projectName: args.updateProjectInput.name, organizationId: args.organizationId });
      if (isExist) {
        const errMsg = `A project with the name ${args.updateProjectInput.name} was created in the past. Please use a different project name.`;
        logger.error(errMsg);
        throw errors.Mandatory('PROJECT_NAME', errMsg);
      }
    }
    const projectProps = { ...project };
    projectProps.name = args.updateProjectInput.name;
    projectProps.description = args.updateProjectInput.description || '';

    await projectNode.updateProject(context, { projectId }, projectProps);
    await tx.commit();

    returnValue = true;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.updateProjectGeneric} \nMessage=> ${err} \nStack=> ${err.stack}`);

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
  logger.debug('<< updateProject()');
  return returnValue;
};

/**
 * This service soft deletes the project with the asked details by changing the status as Inactive.
 * @param {*} args
 * @param {*} context
 */
const deleteProject = async (args, context) => {
  logger.debug('>> deleteProject()');
  let tx = null;
  let session = null;

  try {
    if (!args.organizationId) {
      const errMsg = 'OrganizationId is mandatory to delete project.';
      logger.error(errMsg);
      throw errors.Mandatory('ORGANIZATION', errMsg);
    }

    if (!args.projectId) {
      const errMsg = 'ProjectId is mandatory to delete project.';
      logger.error(errMsg);
      throw errors.Mandatory('PROJECT', errMsg);
    }

    // Validate if user has privilege to delete project
    srpService.hasDeleteProjectPrivilege(context, tx);

    // Continue. User has privilege to delete project
    const project = await projectNode.readById(args.projectId, args.organizationId);

    const projectProps = { ...project };
    projectProps.status = 'Inactive';
    projectProps.updatedAt = date.current();

    const returnValue = true;

    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;
    await projectNode.updateProject(context, { projectId: args.projectId }, projectProps);
    await tx.commit();
    logger.debug('<< deleteProject()');
    return returnValue;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.deleteProjectGeneric} \nMessage=> ${err} \nStack=> ${err.stack}`);

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

/**
 *Checks if project exist based on project name and organization Id.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const checkIfProjectExists = async (args) => {
  logger.debug('>> checkIfProjectExists()');
  let returnValue = null;
  const { organizationId } = args;
  const { projectName } = args;

  returnValue = await projectNode.readProjectByNameFromOrganization(projectName, organizationId);
  if (returnValue.length === 0) {
    return returnValue;
  }
  logger.debug('<< checkIfProjectExists()');
  return returnValue[0];
};

/**
 *Checks if project exist based on project key and organization Id.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const checkIfProjectKeyExists = async (args, context) => {
  logger.debug('>> checkIfProjectKeyExists()');
  let returnValue = null;
  const { organizationId } = context;
  const { projectKey } = args;

  returnValue = await projectNode.readProjectByKeyFromOrganization(projectKey, organizationId);
  if (returnValue.length === 0) {
    return returnValue;
  }
  logger.debug('<< checkIfProjectKeyExists()');
  return returnValue[0];
};

module.exports = {
  getUserProject,
  getOrganizationProject,
  getOrganizationProjects,
  getUserProjectsDetails,
  getUserProjects,
  createProject,
  checkIfProjectExists,
  checkIfProjectKeyExists,
  deleteProject,
  updateProject,
};

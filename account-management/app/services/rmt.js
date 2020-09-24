const driverManager = require('../dal/graph-db/driver-manager');
const srpService = require('./scopeRolePrivilege');
const rmtNode = require('../dal/graph-db/models/nodes').rmt;
const rmtTypeNode = require('../dal/graph-db/models/nodes').rmtType;
const configurationNode = require('../dal/graph-db/models/nodes').configuration;
const connectionNode = require('../dal/graph-db/models/nodes').connection;
const connectionAuthNode = require('../dal/graph-db/models/nodes').connectionAuth;
const connectionUrlNode = require('../dal/graph-db/models/nodes').connectionUrl;
const rmtProjectNode = require('../dal/graph-db/models/nodes').rmtProject;
const rmtIssueTypeNode = require('../dal/graph-db/models/nodes').rmtIssueType;
const issueGroupNode = require('../dal/graph-db/models/nodes').issueGroup;
const issueNode = require('../dal/graph-db/models/nodes').issue;
const projectNode = require('../dal/graph-db/models/nodes').project;
const errors = require('../errors');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);
const integration = require('./integration');
const { crypto } = require('../utils');
const { uniqBy } = require('lodash');
const { clone } = require('lodash');
const { sortBy } = require('lodash');
const { dateTime } = require('../utils');
const { uuid } = require('../utils');
const { differenceBy } = require('lodash');
let lastUpdatedDateTime = '2000-01-01T00:00:00';

const ERROR_MESSAGES = {
  createRMTGeneric: 'Exception occurred while creating rmt.',
  deleteRMTGeneric: 'Exception occurred while deleting rmt.',
  updateRMTGeneric: 'Exception occurred while updating rmt.',
  rollback: 'Exception occurred while rolling back DB operation.',
  projectIdMandatory: 'ProjectId is mandatory to test rmt connection.',
  rmtNotExist: 'RMT does not exist for the given project id.',
};

/**
 *Fetches list of all rmts supported by product.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getRMTList = async (args) => {
  logger.debug('>> getRMTList()');
  let productName = null;
  const { productName: prodName } = args;
  if (!prodName) {
    productName = 'Design Studio';
  }
  else {
    productName = prodName;
  }
  let returnValue = null;
  returnValue = await rmtNode.readSupportedRMTS(productName);
  logger.debug('<< getRMTList()');
  return returnValue;
};

const validateConnectionDetails = (args) => {
  logger.debug('>> getConnectionDetails()');
  if (!args.projectId) {
    const errMsg = ERROR_MESSAGES.projectIdMandatory;
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT_ID', errMsg);
  }
  logger.debug('<< getConnectionDetails()');
};

/**
 *Fetches rmt connection details.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getConnectionDetails = async (args, context) => {
  logger.debug('>> getConnectionDetails()');
  try {
    validateConnectionDetails(args);

    // Validate if user has privilege to read RMT
    context.projectId = args.projectId;
    await srpService.hasReadRMTPrivilege(context);

    const rmt = await rmtNode.readRMTDetailsByProjectId(args.projectId);
    if (rmt.length <= 0) {
      const errMsg = 'Project id is not connected to any rmt.';
      logger.error(errMsg);
      throw errors.NotFound('RMT', errMsg);
    }
    const typeExists = await rmtTypeNode.exists(rmt[0].rmtId, args.type);
    if (!typeExists) {
      const errMsg = 'Type does not exist for RMT connection.';
      logger.error(errMsg);
      throw errors.NotFound('RMT_TYPE', errMsg);
    }
    const type = await rmtTypeNode.readRMTTypeLabel(rmt[0].rmtId);
    const connectionDetails = await rmtNode.readConnectionDetailsByRMTId(rmt[0].rmtId);
    const rmtProjectDetails = await rmtProjectNode.readByRMTId(rmt[0].rmtId);
    let issueTypeDetails = await rmtIssueTypeNode.readByRMTProjectId(rmtProjectDetails.rmtProjectId);
    issueTypeDetails = sortBy(issueTypeDetails, 'level');
    let passwordLength = 0;
    if (connectionDetails.password) {
      const password = await crypto.decrypt(connectionDetails.password);
      passwordLength = password.length;
    }
    const result = {
      type: type[0],
      username: connectionDetails.username,
      password: connectionDetails.password,
      serverUrl: connectionDetails.serverUrl,
      pat: connectionDetails.pat,
      rmtProjectSourceId: rmtProjectDetails.id,
      rmtProjectId: rmtProjectDetails.rmtProjectId,
      rmtProjectName: rmtProjectDetails.name,
      issueTypes: issueTypeDetails,
      passwordLength,
    };
    logger.debug('<< getConnectionDetails()');
    return result;
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

const validateTestConnectionInput = (args) => {
  logger.debug('>> validateTestConnectionInput()');
  if (!args.rmtInput.serverUrl) {
    const errMsg = 'ServerUrl is mandatory to test rmt connection.';
    logger.error(errMsg);
    throw errors.Mandatory('SERVER', errMsg);
  }

  if (!args.rmtInput.type) {
    const errMsg = 'Integration Type is mandatory to test rmt connection.';
    logger.error(errMsg);
    throw errors.Mandatory('TYPE', errMsg);
  }

  if (args.rmtInput.auth === 'BEARER_TOKEN' && !args.rmtInput.pat) {
    const errMsg = 'Pat is mandatory to test rmt connection.';
    logger.error(errMsg);
    throw errors.Mandatory('BEARER_TOKEN', errMsg);
  }

  if (args.rmtInput.auth === 'BASIC') {
    if (!args.rmtInput.username) {
      const errMsg = 'Username is mandatory to test rmt connection.';
      logger.error(errMsg);
      throw errors.Mandatory('BASIC', errMsg);
    }
    if (!args.rmtInput.password && !args.rmtInput.encryptedPassword) {
      const errMsg = 'Password is mandatory to test rmt connection.';
      logger.error(errMsg);
      throw errors.Mandatory('BASIC', errMsg);
    }
  }
  logger.debug('<< validateTestConnectionInput()');
};

/**
 * Test the connection of rmt.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const testConnection = async (args, context) => {
  logger.debug('>> testConnection()');
  let returnValue = null;
  let session = null;
  let tx = null;
  try {
    if (!args.projectId) {
      const errMsg = ERROR_MESSAGES.projectIdMandatory;
      logger.error(errMsg);
      throw errors.Mandatory('PROJECT_ID', errMsg);
    }
    validateTestConnectionInput(args);
    let pass = null;
    if (args.rmtInput.encryptedPassword) {
      pass = await crypto.decrypt(args.rmtInput.encryptedPassword);
    }
    else {
      pass = args.rmtInput.password;
    }

    // Validate if user has privilege to update RMT
    context.projectId = args.projectId;
    await srpService.hasUpdateRMTPrivilege(context, tx);

    returnValue = await integration.testRMTConnection(args.rmtInput.serverUrl, args.rmtInput.username, pass, args.rmtInput.projectName, args.rmtInput.type, args.rmtInput.pat);
    if (returnValue.status) {
      const exists = await rmtNode.exists(args.projectId, tx);
      if (!exists) {
        try {
          session = driverManager.getWriteSession();
          tx = session.beginTransaction();
          let password = pass;
          if (password) {
            password = await crypto.encrypt(password);
          }

          const configuration = await configurationNode.readConfigurationByProjectId(args.projectId, tx);
          context.tx = tx;
          const rmt = await rmtNode.create(context);
          const connection = await connectionNode.create(context);
          const connectionAuth = await connectionAuthNode.create(args.rmtInput.pat, args.rmtInput.username, password, context);
          const connectionUrl = await connectionUrlNode.create(args.rmtInput.serverUrl, context);
          await configurationNode.createRMTConfigurationRelation(
            context,
            {
              configurationId: configuration[0].configurationId,
            },
            {
              rmtId: rmt.properties.rmtId,
            },
          );
          await rmtNode.createRMTConnectionRelation(
            context,
            {
              rmtId: rmt.properties.rmtId,
            },
            {
              connectionId: connection.properties.connectionId,
            },
          );
          await connectionNode.createConnectionAuthRelation(
            context,
            {
              connectionId: connection.properties.connectionId,
            },
            {
              connectionAuthId: connectionAuth.properties.connectionAuthId,
            },
          );
          await connectionNode.createConnectionUrlRelation(
            context,
            {
              connectionId: connection.properties.connectionId,
            },
            {
              connectionUrlId: connectionUrl.properties.connectionUrlId,
            },
          );
          await rmtNode.createRMTTypeRelation(
            context,
            {
              rmtId: rmt.properties.rmtId,
            },
            args.rmtInput.type,
          );
          await tx.commit();
          await integration.closeRMTConnection(args.rmtInput.serverUrl, args.rmtInput.username, pass, args.rmtInput.type, args.rmtInput.pat);
        }
        catch (err) {
          logger.error(`${ERROR_MESSAGES.createRMTGeneric} \nMessage=> ${err} \nStack=> ${err.stack}`);
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
      }
    }
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
  logger.debug('<< testConnection()');
  return returnValue;
};

/**
 *Delete RMT connection assosiated with the project.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const deleteRMTConnection = async (args, context) => {
  logger.debug('>> deleteRMTConnection()');
  let session;
  let tx = null;
  let returnValue = false;
  try {
    session = driverManager.getWriteSession();
    tx = session.beginTransaction();

    // Validate if user has privilege to update RMT
    context.projectId = args.projectId;
    await srpService.hasUpdateRMTPrivilege(context, tx);

    const rmtDetails = await rmtNode.readRMTDetailsByProjectId(args.projectId, tx);
    if (rmtDetails.length === 0) {
      const errMsg = ERROR_MESSAGES.rmtNotExist;
      logger.error(errMsg);
      throw errors.NotFound('RMT', errMsg);
    }
    const configuration = await configurationNode.readConfigurationByProjectId(args.projectId, tx);
    const connection = await connectionNode.readConnectionByRMTId(rmtDetails[0].rmtId, tx);
    const connectionUrl = await connectionUrlNode.readConnectionURLByConnectionId(connection[0].connectionId, tx);
    const connectionAuth = await connectionAuthNode.readConnectionAuthByConnectionId(connection[0].connectionId, tx);
    const rmtType = await rmtTypeNode.readRMTTypeDetails(rmtDetails[0].rmtId, args.type, tx);

    await configurationNode.deleteConfigurationRMTRelationship(
      tx,
      {
        configurationId: configuration[0].configurationId,
      },
      {
        rmtId: rmtDetails[0].rmtId,
      },
    );
    await rmtNode.deleteRMTConnectionRelationship(
      tx,
      {
        rmtId: rmtDetails[0].rmtId,
      },
      {
        connectionId: connection[0].connectionId,
      },
    );
    await rmtNode.deleteRMTTypeRelationship(
      tx,
      {
        rmtId: rmtDetails[0].rmtId,
      },
      rmtType[0],
      args.type,
    );
    await connectionNode.deleteConnectionAuthRelationship(
      tx,
      {
        connectionId: connection[0].connectionId,
      },
      {
        connectionAuthId: connectionAuth[0].connectionAuthId,
      },
    );
    await connectionNode.deleteConnectionUrlRelationship(
      tx,
      {
        connectionId: connection[0].connectionId,
      },
      {
        connectionUrlId: connectionUrl[0].connectionUrlId,
      },
    );
    await rmtNode.deleteByRMTId(rmtDetails[0].rmtId, tx);
    await connectionNode.deleteByConnectionId(connection[0].connectionId, tx);
    await connectionAuthNode.deleteByConnectionAuthId(connectionAuth[0].connectionAuthId, tx);
    await connectionUrlNode.deleteByConnectionUrlId(connectionUrl[0].connectionUrlId, tx);
    await tx.commit();
    returnValue = true;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.deleteRMTGeneric} \nMessage=> ${err} \nStack=> ${err.stack}`);
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
  logger.debug('<< deleteRMTConnection()');
  return returnValue;
};

const deleteExistingRMTIssueTypes = async (context, rmtIssueTypes) => {
  logger.debug('>> deleteExistingRMTIssueTypes()');
  for (let i = 0; i < rmtIssueTypes.length; i++) {
    await rmtIssueTypeNode.deleteByRMTIssueTypeId(context.tx, rmtIssueTypes[i].rmtIssueTypeId);
  }
  logger.debug('<< deleteExistingRMTIssueTypes()');
};

const getSelectedEntities = async (tx, args) => {
  logger.debug('>> getSelectedEntities()');
  const { rmtInput } = args;
  const parentData = await integration.readRMTProjectEntity(rmtInput.serverUrl, rmtInput.username, rmtInput.password, rmtInput.projectName, rmtInput.type, rmtInput.pat, args.rmtIssueInput.parentIssue, null);
  const selectedParentData = [];
  for (let i = 0; i < args.rmtIssueInput.selectedId.length; i++) {
    const index = parentData.findIndex((data) => data.id === args.rmtIssueInput.selectedId[i]);
    if (index !== -1) {
      selectedParentData.push(parentData[index]);
    }
  }
  logger.debug('<< getSelectedEntities()');
  return selectedParentData;
};

const createOrphanStoryRelation = async (tx, issueGroupId, orphanIssueGroupId, parentData) => {
  logger.debug('>> createOrphanStoryRelation()');
  for (let i = 0; i < parentData.length; i++) {
    const item = parentData[i];
    await issueGroupNode.deleteIssueRelation(tx.tx, { issueGroupId }, { issueId: item.issueId });
    const hasOrphanIssueRelation = await issueNode.isOrphanIssueGroupRelationExists(orphanIssueGroupId, item.issueId, tx.projectId, tx.tx);
    if (!hasOrphanIssueRelation) {
      await issueGroupNode.createOrphanIssueRelation(tx, { orphanIssueGroupId }, { issueId: item.issueId });
    }
  }
  logger.debug('>> createOrphanStoryRelation()');
};

const createOldStoryRelation = async (tx, issueGroupId, parentData, parentIssueIds = []) => {
  logger.debug('>> createOldStoryRelation()');
  for (let i = 0; i < parentData.length; i++) {
    const item = parentData[i];
    if (parentIssueIds.length > 0) {
      for (let j = 0; j < parentIssueIds.length; j++) {
        await issueNode.createChildIssueRelation(
          tx,
          { issueId: parentIssueIds[j] },
          {
            issueId: item.issueId,
          },
        );
      }
    }
  }
  logger.debug('<< createOldStoryRelation()');
};

const removeCyclicRMTData = async (data, parentLabel, rmtIssueTypes) => {
  if (!data) {
    return data;
  }
  else {
    let returnData = [];
    let filteredRMTIssueTypes = [];
    const parentIssueTypeData = rmtIssueTypes.filter((type) => type.type === parentLabel);
    if (parentIssueTypeData[0].level.low) {
      filteredRMTIssueTypes = rmtIssueTypes.filter((type) => type.level.low > parentIssueTypeData[0].level.low);
    }
    else {
      filteredRMTIssueTypes = rmtIssueTypes.filter((type) => type.level > parentIssueTypeData[0].level);
    }
    for (let i = 0; i < filteredRMTIssueTypes.length; i++) {
      const issueType = filteredRMTIssueTypes[i];
      const filteredData = data.filter((item) => item.type === issueType.type);
      returnData = [...returnData, ...filteredData];
    }
    return returnData;
  }
};

const setUpNewHierarchy = async (tx, rmtIssueTypes, rmtInput, stories, storyType, parentLabel, parentData, issueGroupId, parentIssueIds = []) => {
  logger.debug('>> setUpNewHierarchy()');
  try {
    const { length } = rmtIssueTypes;
    let orphanStories = clone(stories);
    let rmtIssueType = null;
    const parentIssueNodes = [];
    rmtIssueTypes.forEach((type, index) => {
      if (type.type === parentLabel) {
        rmtIssueType = rmtIssueTypes[index];
      }
    });
    for (let i = 0; i < parentData.length; i++) {
      const item = parentData[i];
      if (rmtIssueType) {
        const issue = await issueNode.create(tx, tx.projectId, item.type, item, rmtIssueType.level.low, rmtIssueTypes.length);
        await issueGroupNode.createIssueRelation(tx, { issueGroupId }, { issueId: issue.properties.issueId });
        parentIssueNodes.push(issue.properties);
        if (parentIssueIds.length > 0) {
          for (let j = 0; j < parentIssueIds.length; j++) {
            await issueNode.createChildIssueRelation(
              tx,
              { issueId: parentIssueIds[j] },
              {
                issueId: issue.properties.issueId,
              },
            );
          }
        }
      }
    }
    if (rmtIssueType && rmtIssueType.level.low !== length) {
      for (let i = 0; i < parentIssueNodes.length; i++) {
        const parentIds = [];
        const node = parentIssueNodes[i];
        parentIds.push(node.issueId);
        let childData = await integration.readRMTChildEntity(rmtInput.serverUrl, rmtInput.username, rmtInput.password, rmtInput.projectName, rmtInput.type, rmtInput.pat, parentLabel, node.sourceId, rmtIssueType.searchKey);
        childData = await removeCyclicRMTData(childData, parentLabel, rmtIssueTypes);
        childData = childData || [];
        childData = childData.map((item) => ({ sourceId: item.id, name: item.name, key: item.key, description: item.description, createdDate: item.createdDate, modifiedDate: item.modifiedDate, type: item.type, isDeleted: false }));
        if (childData) {
          const uniqueValues = uniqBy(childData, 'type');
          for (let j = 0; j < uniqueValues.length; j++) {
            const value = uniqueValues[j];
            const filterChildData = childData.filter((data) => data.type === value.type);
            try {
              if (value.type === storyType) {
                const oldStoryData = [];
                let newStoryData = [];
                for (let m = 0; m < orphanStories.length; m++) {
                  for (let n = 0; n < filterChildData.length; n++) {
                    if (parseInt(orphanStories[m].sourceId, 10) === parseInt(filterChildData[n].sourceId, 10)) {
                      oldStoryData.push(orphanStories[m]);
                      break;
                    }
                  }
                }
                if (oldStoryData.length === 0) {
                  for (let m = 0; m < filterChildData.length; m++) {
                    for (let n = 0; n < orphanStories.length; n++) {
                      if (parseInt(orphanStories[n].sourceId, 10) !== parseInt(filterChildData[m].sourceId, 10)) {
                        newStoryData.push(filterChildData[m]);
                        break;
                      }
                    }
                  }
                }
                else {
                  await createOldStoryRelation(tx, issueGroupId, oldStoryData, parentIds);
                  newStoryData = differenceBy(filterChildData, oldStoryData, 'key');
                }
                orphanStories = differenceBy(orphanStories, oldStoryData, 'sourceId');
                if (newStoryData.length > 0) {
                  orphanStories = await setUpNewHierarchy(tx, rmtIssueTypes, rmtInput, orphanStories, storyType, value.type, newStoryData, issueGroupId, parentIds);
                }
              }
              else {
                orphanStories = await setUpNewHierarchy(tx, rmtIssueTypes, rmtInput, orphanStories, storyType, value.type, filterChildData, issueGroupId, parentIds);
              }
            }
            catch (err) {
              logger.error(err);
              throw err;
            }
          }
        }
      }
    }
    logger.debug('<< setUpNewHierarchy()');
    return orphanStories;
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

const resetIssues = async (context, oldRMTIssueTypes, rmtIssueTypes, rmtInput, parentLabel, parentData, issueGroupId) => {
  logger.debug('>> resetIssues()');
  const { length } = rmtIssueTypes;
  const { type } = rmtIssueTypes[length - 1];
  let stories = await issueNode.readIssues(context.projectId, context.organizationId, { type }, context.tx);
  if (stories.length > 0) {
    for (let i = 0; i < stories.length; i++) {
      await issueNode.deleteStoryRelationship(context.tx, stories[i].issueId, type);
    }
  }
  for (let i = 0; i < oldRMTIssueTypes.length; i++) {
    const issueType = oldRMTIssueTypes[i];
    if (issueType.type !== type) {
      const issueExists = await issueNode.readIssues(context.projectId, context.organizationId, { type: issueType.type }, context.tx);
      if (issueExists.length > 0) {
        await issueNode.deleteIssues(context.tx, context.convertedProjectId, issueType.type);
      }
    }
  }
  stories = uniqBy(stories, 'sourceId');
  const orphanStories = await setUpNewHierarchy(context, rmtIssueTypes, rmtInput, stories, type, parentLabel, parentData, issueGroupId);
  if (orphanStories.length > 0) {
    const orphanIssueGroup = await issueGroupNode.readOrphanIssueGroupByProjectId(context.projectId, context.tx);
    await createOrphanStoryRelation(context, issueGroupId, orphanIssueGroup.orphanIssueGroupId, orphanStories);
  }
  logger.debug('<< resetIssues()');
};

const createIssues = async (tx, projectId, organizationId, rmtInput, parentLabel, parentData, issueGroupId, rmtIssueTypes, parentIssueIds = []) => {
  logger.debug('>> createIssues()');
  try {
    const { length } = rmtIssueTypes;
    let rmtIssueType = null;
    const parentIssueNodes = [];
    const sortedRMTIssueTypes = rmtIssueTypes.map((type) => type.properties);
    rmtIssueTypes.forEach((type, index) => {
      if (type.properties.type === parentLabel) {
        rmtIssueType = rmtIssueTypes[index];
      }
    });
    if (rmtIssueType) {
      for (let i = 0; i < parentData.length; i++) {
        const item = parentData[i];
        if (dateTime.isBefore(lastUpdatedDateTime, item.modifiedDate)) {
          lastUpdatedDateTime = item.modifiedDate;
        }
        let issue = await issueNode.readByRMTSourceId(item.id, projectId);
        if (issue.length > 0) {
          issue = issue[0];
          const orphanIssueGroup = await issueGroupNode.readOrphanIssueGroupByProjectId(projectId);
          await issueGroupNode.deleteOrphanIssueRelation(tx.tx, { orphanIssueGroupId: orphanIssueGroup.orphanIssueGroupId }, { issueId: issue.issueId });
          await issueGroupNode.createIssueRelation(tx, { issueGroupId }, { issueId: issue.issueId });
          parentIssueNodes.push(issue);
          if (parentIssueIds.length > 0) {
            for (let j = 0; j < parentIssueIds.length; j++) {
              await issueNode.createChildIssueRelation(
                tx,
                { issueId: parentIssueIds[j] },
                {
                  issueId: issue.issueId,
                },
              );
            }
          }
        }
        else {
          issue = await issueNode.create(
            tx,
            projectId,
            item.type,
            { sourceId: item.id, name: item.name, key: item.key, description: item.description, createdDate: item.createdDate, modifiedDate: item.modifiedDate, type: item.type, isDeleted: false },
            rmtIssueType.properties.level.low,
            rmtIssueTypes.length,
          );
          await issueGroupNode.createIssueRelation(tx, { issueGroupId }, { issueId: issue.properties.issueId });
          parentIssueNodes.push(issue.properties);
          if (parentIssueIds.length > 0) {
            for (let j = 0; j < parentIssueIds.length; j++) {
              await issueNode.createChildIssueRelation(
                tx,
                { issueId: parentIssueIds[j] },
                {
                  issueId: issue.properties.issueId,
                },
              );
            }
          }
        }
      }
      if (rmtIssueType && rmtIssueType.properties.level.low !== length) {
        for (let i = 0; i < parentIssueNodes.length; i++) {
          const parentIds = [];
          const node = parentIssueNodes[i];
          parentIds.push(node.issueId);
          let childData = await integration.readRMTChildEntity(rmtInput.serverUrl, rmtInput.username, rmtInput.password, rmtInput.projectName, rmtInput.type, rmtInput.pat, parentLabel, node.sourceId, rmtIssueType.properties.searchKey);
          childData = await removeCyclicRMTData(childData, parentLabel, sortedRMTIssueTypes);
          if (childData) {
            const uniqueValues = uniqBy(childData, 'type');
            for (let j = 0; j < uniqueValues.length; j++) {
              const value = uniqueValues[j];
              const filterChildData = childData.filter((data) => data.type === value.type);
              try {
                await createIssues(tx, projectId, organizationId, rmtInput, value.type, filterChildData, issueGroupId, rmtIssueTypes, parentIds);
              }
              catch (err) {
                logger.error(err);
                throw err;
              }
            }
          }
        }
      }
    }
    logger.debug('<< createIssues()');
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

const createRMTIssueNodeAndProjectRelation = async (tx, hierarchy, keys, rmtProject) => {
  logger.debug('>> createRMTIssueNodeAndProjectRelation()');
  const rmtIssueTypes = [];
  for (let i = 0; i < hierarchy.length; i++) {
    const rmtIssueType = await rmtIssueTypeNode.create(
      tx,
      hierarchy[i],
      {
        level: i + 1,
        searchKey: keys[i],
        type: hierarchy[i],
        isDeleted: false,
      },
      i + 1,
      hierarchy.length,
    );
    await rmtProjectNode.createRMTProjectIssueTypeRelation(
      tx,
      {
        rmtProjectId: rmtProject.rmtProjectId,
      },
      {
        rmtIssueTypeId: rmtIssueType.properties.rmtIssueTypeId,
      },
    );
    rmtIssueTypes.push(rmtIssueType);
  }
  logger.debug('<< createRMTIssueNodeAndProjectRelation()');
  return rmtIssueTypes;
};

const createRMTIssueTypeParentChildRelation = async (tx, rmtIssueTypes) => {
  logger.debug('>> createRMTIssueTypeParentChildRelation()');
  for (let i = 0; i < rmtIssueTypes.length; i++) {
    for (let j = i + 1; j < rmtIssueTypes.length; j++) {
      await rmtIssueTypeNode.createRMTProjectIssueTypeRelation(
        tx,
        {
          rmtIssueTypeId: rmtIssueTypes[i].properties.rmtIssueTypeId,
        },
        {
          rmtIssueTypeId: rmtIssueTypes[j].properties.rmtIssueTypeId,
        },
      );
    }
  }
  logger.debug('<< createRMTIssueTypeParentChildRelation()');
};

/**
 * Update the connection of rmt.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const updateRMTConnection = async (args, context) => {
  logger.debug('>> updateRMTConnection()');
  let status;
  try {
    if (!args.projectId) {
      const errMsg = ERROR_MESSAGES.projectIdMandatory;
      logger.error(errMsg);
      throw errors.Mandatory('PROJECT_ID', errMsg);
    }
    validateTestConnectionInput(args);
    let pass = null;
    if (args.rmtInput.encryptedPassword) {
      pass = await crypto.decrypt(args.rmtInput.encryptedPassword);
    }
    else {
      pass = args.rmtInput.password;
    }
    const returnValue = await integration.testRMTConnection(args.rmtInput.serverUrl, args.rmtInput.username, pass, args.rmtInput.projectName, args.rmtInput.type, args.rmtInput.pat);
    if (returnValue.status) {
      let session;
      let tx = null;
      try {
        session = driverManager.getWriteSession();
        tx = session.beginTransaction();
        context.tx = tx;
        // Validate if user has privilege to update RMT
        context.projectId = args.projectId;
        context.convertedProjectId = `prj_${args.projectId}`;
        await srpService.hasUpdateRMTPrivilege(context, tx);

        const rmtDetails = await rmtNode.readRMTDetailsByProjectId(args.projectId, tx);
        if (rmtDetails.length === 0) {
          const errMsg = ERROR_MESSAGES.rmtNotExist;
          logger.error(errMsg);
          throw errors.NotFound('RMT', errMsg);
        }
        const rmtType = await rmtTypeNode.readRMTTypeDetails(rmtDetails[0].rmtId, args.rmtInput.type, tx);
        if (rmtType.length === 0) {
          const errMsg = `${args.rmtInput.type} does not exist for the given project id.`;
          logger.error(errMsg);
          throw errors.NotFound(`${args.rmtInput.type}`, errMsg);
        }
        const connection = await rmtNode.readConnectionDetailsByRMTId(rmtDetails[0].rmtId, tx);
        if (connection.password) {
          const password = await crypto.decrypt(connection.password);
          connection.password = password;
        }
        if (connection.serverUrl !== args.rmtInput.serverUrl || connection.username !== args.rmtInput.username || connection.password !== pass) {
          const newPass = await crypto.encrypt(pass);
          await connectionAuthNode.updateByConnectionAuthId(context, connection.connectionAuthId, { connectionAuthId: connection.connectionAuthId, username: args.rmtInput.username, password: newPass });
          await connectionUrlNode.updateByConnectionUrlId(context, connection.connectionUrlId, { connectionUrlId: connection.connectionUrlId, serverUrl: args.rmtInput.serverUrl });
        }
        const { hierarchy } = args;
        const { keys } = args;
        if (hierarchy.length !== keys.length) {
          const errMsg = 'hierarchy and keys should be of same length';
          logger.error(errMsg);
          throw errors.Mandatory('RMT_HIERARCHY', errMsg);
        }
        const rmtProject = await rmtProjectNode.readByRMTId(rmtDetails[0].rmtId, tx);
        let oldHierarchy = await rmtIssueTypeNode.readByRMTProjectId(rmtProject.rmtProjectId, tx);
        oldHierarchy = sortBy(oldHierarchy, 'level');
        let isUpdationHierarchyRequired = false;
        if (oldHierarchy.length === hierarchy.length) {
          for (let i = 0; i < oldHierarchy.length; i++) {
            if (oldHierarchy[i].type !== hierarchy[i] || oldHierarchy[i].searchKey !== keys[i]) {
              isUpdationHierarchyRequired = true;
            }
          }
        }
        else {
          isUpdationHierarchyRequired = true;
        }
        const issueGroup = await issueGroupNode.readByProjectId(args.projectId, tx);
        let parentData = null;
        args.rmtInput.password = pass;
        if (isUpdationHierarchyRequired) {
          await deleteExistingRMTIssueTypes(context, oldHierarchy);
          let rmtIssueTypes = await createRMTIssueNodeAndProjectRelation(context, hierarchy, keys, rmtProject);
          await createRMTIssueTypeParentChildRelation(context, rmtIssueTypes);
          rmtIssueTypes = rmtIssueTypes.map((issue) => issue.properties);
          if (hierarchy[0] !== oldHierarchy[0].type) {
            parentData = await getSelectedEntities(tx, args);
            parentData = parentData.map((item) => ({ sourceId: item.id, name: item.name, key: item.key, description: item.description, createdDate: item.createdDate, modifiedDate: item.modifiedDate, type: item.type, isDeleted: false }));
          }
          else {
            parentData = await issueNode.readIssues(context.projectId, context.organizationId, { type: hierarchy[0] }, context.tx);
          }
          await resetIssues(context, oldHierarchy, rmtIssueTypes, args.rmtInput, hierarchy[0], parentData, issueGroup.issueGroupId);
        }
        if (args.rmtIssueInput.selectedId.length > 0 && hierarchy[0] === oldHierarchy[0].type) {
          const data = [];
          const rmtIssueTypes = await rmtIssueTypeNode.readByRMTProjectId(rmtProject.rmtProjectId);
          rmtIssueTypes.forEach((issue) => {
            const item = {};
            const object = { ...issue, level: { low: issue.level } };
            item.properties = object;
            data.push(item);
          });
          parentData = await getSelectedEntities(tx, args);
          await createIssues(context, args.projectId, context.organizationId, args.rmtInput, args.rmtIssueInput.parentIssue, parentData, issueGroup.issueGroupId, data);
        }
        await tx.commit();
        await integration.closeRMTConnection(args.rmtInput.serverUrl, args.rmtInput.username, args.rmtInput.password, args.rmtInput.type, args.rmtInput.pat);
        status = true;
      }
      catch (err) {
        logger.error(`${ERROR_MESSAGES.updateRMTGeneric} \nMessage=> ${err} \nStack=> ${err.stack}`);
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
    }
    else {
      const errMsg = 'Invalid RMT credentials.';
      logger.error(errMsg);
      throw errors.NotFound('RMT_CREDENTIALS', errMsg);
    }
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
  logger.debug('<< updateRMTConnection()');
  return status;
};

/**
 * Get the list of projects under rmt connection.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getRMTProjects = async (args) => {
  logger.debug('>> getRMTProjects()');
  let returnValue = null;
  let pass = null;
  if (args.rmtInput.encryptedPassword) {
    pass = await crypto.decrypt(args.rmtInput.encryptedPassword);
  }
  else {
    pass = args.rmtInput.password;
  }
  try {
    validateTestConnectionInput(args);
    returnValue = await integration.readRMTProjects(args.rmtInput.serverUrl, args.rmtInput.username, pass, args.rmtInput.type, args.rmtInput.pat);
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
  logger.debug('<< getRMTProjects()');
  return returnValue;
};

/**
 * Get the list of entity types in project under rmt connection.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getEntityTypesForRMTProject = async (args) => {
  logger.debug('>> getEntityTypesForRMTProject()');
  let returnValue = null;
  let pass = null;
  if (args.rmtInput.encryptedPassword) {
    pass = await crypto.decrypt(args.rmtInput.encryptedPassword);
  }
  else {
    pass = args.rmtInput.password;
  }
  try {
    validateTestConnectionInput(args);
    returnValue = await integration.readRMTProjectEntityTypes(args.rmtInput.serverUrl, args.rmtInput.username, pass, args.rmtInput.projectName, args.rmtInput.type, args.rmtInput.pat);
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
  logger.debug('<< getEntityTypesForRMTProject()');
  return returnValue;
};

/**
 * Get the list of entity in project under rmt connection.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getEntityListForRMTProject = async (args) => {
  logger.debug('>> getEntityListForRMTProject()');
  let returnValue = null;
  let pass = null;
  if (args.rmtInput.encryptedPassword) {
    pass = await crypto.decrypt(args.rmtInput.encryptedPassword);
  }
  else {
    pass = args.rmtInput.password;
  }
  try {
    validateTestConnectionInput(args);
    returnValue = await integration.readRMTProjectEntity(args.rmtInput.serverUrl, args.rmtInput.username, pass, args.rmtInput.projectName, args.rmtInput.type, args.rmtInput.pat, args.entityType, null);
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
  logger.debug('<< getEntityListForRMTProject()');
  return returnValue;
};

const validateSetHierarchyInput = async (args) => {
  if (!args.projectId) {
    const errMsg = 'ProjectId is mandatory to set hierarchy.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT_ID', errMsg);
  }
  if (!args.rmtInput.projectName) {
    const errMsg = 'RMT Project Name is mandatory to set hierarchy.';
    logger.error(errMsg);
    throw errors.Mandatory('RMT_PROJECT_NAME', errMsg);
  }
  if (!args.hierarchy || args.hierarchy.length === 0) {
    const errMsg = 'Hierarchy should be valid.';
    logger.error(errMsg);
    throw errors.Mandatory('HIERARCHY', errMsg);
  }
};

const setupIssues = async (context, projectId, organizationId, rmtInput, parentLabel, parentData, issueGroupId, rmtIssueTypes, rmtDetails, parentIssueIds = []) => {
  logger.debug('>> setupIssues()');
  let tx = null;
  try {
    const session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;
    await createIssues(context, projectId, organizationId, rmtInput, parentLabel, parentData, issueGroupId, rmtIssueTypes, parentIssueIds);
    await rmtNode.update(context, { rmtId: rmtDetails[0].rmtId }, { lastSynced: lastUpdatedDateTime, syncStatus: true });
    await tx.commit();
    logger.debug('<< setupIssues()');
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
  }
};

/**
 * Set the issuetype hierarchy under rmt connection.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const setHierarchyForIssueType = async (args, context) => {
  logger.debug('>> setHierarchyForIssueType()');
  let status;
  let tx = null;
  let rmtIssueTypes = [];
  let issueGroup = null;
  let parentData = null;
  let rmtDetails = null;
  try {
    await validateSetHierarchyInput(args);
    await validateTestConnectionInput(args);
    const returnValue = await integration.testRMTConnection(args.rmtInput.serverUrl, args.rmtInput.username, args.rmtInput.password, args.rmtInput.projectName, args.rmtInput.type, args.rmtInput.pat);
    if (returnValue.status) {
      let session;
      try {
        // Validate if user has privilege to update RMT
        session = driverManager.getWriteSession();
        tx = session.beginTransaction();
        context.tx = tx;

        context.projectId = args.projectId;
        await srpService.hasUpdateRMTPrivilege(context, tx);

        const { hierarchy } = args;
        const { keys } = args;
        if (hierarchy.length !== keys.length) {
          const errMsg = 'hierarchy and keys should be of same length.';
          logger.error(errMsg);
          throw errors.Mandatory('RMT_HIERARCHY', errMsg);
        }
        rmtDetails = await rmtNode.readRMTDetailsByProjectId(args.projectId);
        if (rmtDetails.length === 0) {
          const errMsg = ERROR_MESSAGES.rmtNotExist;
          logger.error(errMsg);
          throw errors.NotFound('RMT', errMsg);
        }
        const isRMTProjectExists = await rmtProjectNode.exists(
          {
            rmtId: rmtDetails[0].rmtId,
          },
          tx,
        );
        if (isRMTProjectExists) {
          const errMsg = 'project already exists for the given rmt connection.';
          logger.error(errMsg);
          throw errors.AlreadyExists('RMT_PROJECT', errMsg);
        }
        let rmtProjectList = await getRMTProjects(args);
        rmtProjectList = rmtProjectList.filter((project) => project.projectId === args.rmtInput.projectName);
        if (rmtProjectList.length === 0) {
          const errMsg = 'rmt project name does not exist for the given rmt connection.';
          logger.error(errMsg);
          throw errors.NotFound('RMT_PROJECT_NAME', errMsg);
        }
        const deleteSubscriberId = uuid.uuidWithoutHyphens();
        const updateSubscriberId = uuid.uuidWithoutHyphens();
        const rmtProjectProps = {
          id: rmtProjectList[0].projectId,
          name: rmtProjectList[0].projectName,
          description: rmtProjectList[0].projectDescription || '',
          key: rmtProjectList[0].key,
          modifiedDate: rmtProjectList[0].modifiedDate,
          deleteSubscriberId,
          updateSubscriberId,
        };
        const rmtProject = await rmtProjectNode.create(context, {
          rmtProject: rmtProjectProps,
        });
        const isDeleteEventCreated = await integration.registerEvent(deleteSubscriberId, args.rmtInput.serverUrl, args.rmtInput.username, args.rmtInput.password, rmtProjectList[0].projectName, args.rmtInput.type, args.rmtInput.pat, 'entityDelete');
        if (!isDeleteEventCreated) {
          logger.error(`DELETE EVENT not created for Project with id ${context.projectId}`);
        }
        else {
          logger.error(`DELETE EVENT created for Project with id ${context.projectId}`);
        }
        const isUpdateEventCreated = await integration.registerEvent(updateSubscriberId, args.rmtInput.serverUrl, args.rmtInput.username, args.rmtInput.password, rmtProjectList[0].projectName, args.rmtInput.type, args.rmtInput.pat, 'linkUpdate');
        if (!isUpdateEventCreated) {
          logger.error(`DELETE EVENT not created for Project with id ${context.projectId}`);
        }
        else {
          logger.error(`DELETE EVENT created for Project with id ${context.projectId}`);
        }
        await rmtNode.createRMTProjectRelation(
          context,
          {
            rmtId: rmtDetails[0].rmtId,
          },
          {
            rmtProjectId: rmtProject.properties.rmtProjectId,
          },
        );
        rmtIssueTypes = await createRMTIssueNodeAndProjectRelation(context, hierarchy, keys, rmtProject.properties);
        await createRMTIssueTypeParentChildRelation(context, rmtIssueTypes);
        issueGroup = await issueGroupNode.create(context, args.projectId);
        const orphanIssueGroup = await issueGroupNode.createOrphanIssueGroup(context, args.projectId);
        await projectNode.createProjectIssueGroupRelation(context, { projectId: args.projectId }, { issueGroupId: issueGroup.properties.issueGroupId });
        await projectNode.createProjectOrphanIssueGroupRelation(context, { projectId: args.projectId }, { orphanIssueGroupId: orphanIssueGroup.properties.orphanIssueGroupId });
        parentData = await getSelectedEntities(tx, args);
        await rmtNode.update(context, { rmtId: rmtDetails[0].rmtId }, { lastSynced: lastUpdatedDateTime, syncStatus: false });
        await tx.commit();
        status = true;
        await integration.closeRMTConnection(args.rmtInput.serverUrl, args.rmtInput.username, args.rmtInput.password, args.rmtInput.type, args.rmtInput.pat);
      }
      catch (err) {
        logger.error(`${ERROR_MESSAGES.updateRMTGeneric} \nMessage=> ${err} \nStack=> ${err.stack}`);
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
        if (issueGroup && parentData) {
          setupIssues(context, args.projectId, context.organizationId, args.rmtInput, args.rmtIssueInput.parentIssue, parentData, issueGroup.properties.issueGroupId, rmtIssueTypes, rmtDetails, []);
        }
      }
    }
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
  logger.debug('<< setHierarchyForIssueType()');
  return status;
};

module.exports = {
  getRMTList,
  testConnection,
  getConnectionDetails,
  deleteRMTConnection,
  updateRMTConnection,
  getRMTProjects,
  getEntityTypesForRMTProject,
  getEntityListForRMTProject,
  setHierarchyForIssueType,
};

const driverManager = require('../dal/graph-db/driver-manager');
const issueNode = require('../dal/graph-db/models/nodes').issue;
const issueGroupNode = require('../dal/graph-db/models/nodes').issueGroup;
const rmtNode = require('../dal/graph-db/models/nodes').rmt;
const projectNode = require('../dal/graph-db/models/nodes').project;
const rmtTypeNode = require('../dal/graph-db/models/nodes').rmtType;
const rmtProjectNode = require('../dal/graph-db/models/nodes').rmtProject;
const rmtIssueTypeNode = require('../dal/graph-db/models/nodes').rmtIssueType;
const integration = require('./integration');
const errors = require('../errors');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);
const { sortBy } = require('lodash');
const { crypto } = require('../utils');
const { dateTime } = require('../utils');
const { uniqBy } = require('lodash');
let lastUpdatedDateTime = '2000-01-01T00:00:00';

const ERROR_MESSAGES = {
  syncIssue: 'Exception occurred while syncing.',
  rollback: 'Exception occurred while rolling back DB operation.',
  autoSync: 'Exception occured while auto syncing issues.',
  entityDeleteCallabck: 'Exception occured while deleting entity.',
  entityUpdateCallabck: 'Exception occured while updating entity.',
};

const validateGetIssuesInput = (args) => {
  logger.debug('>> validateGetIssuesInput()');
  if (!args.projectId) {
    const errMsg = 'ProjectId is mandatory to get issue details.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT', errMsg);
  }
  logger.debug('<< validateGetIssuesInput()');
};

/**
 *Fetches list of issues.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getIssues = async (args, context) => {
  logger.debug('>> getIssues()');
  try {
    await validateGetIssuesInput(args);

    const returnValue = {};
    const { projectId } = args;
    const { organizationId } = context;
    if (args.issueInput.isOrphan) {
      returnValue.childIssues = await issueNode.readOrphanIssues(projectId, args.issueInput);
      returnValue.childIssues = sortBy(returnValue.childIssues, 'name');
      returnValue.childIssues = uniqBy(returnValue.childIssues, 'sourceId');
      if (args.issueInput.parentIssueId) {
        const parentIssues = await issueNode.readParentIssues(projectId, organizationId, args.issueInput);
        returnValue.parentIssues = parentIssues;
        returnValue.parentIssues = sortBy(returnValue.parentIssues, 'name');
        returnValue.parentIssues = uniqBy(returnValue.parentIssues, 'sourceId');
      }
    }
    else {
      returnValue.childIssues = await issueNode.readIssues(projectId, organizationId, args.issueInput);
      returnValue.childIssues = sortBy(returnValue.childIssues, 'name');
      returnValue.childIssues = uniqBy(returnValue.childIssues, 'sourceId');
      if (args.issueInput.parentIssueId) {
        const parentIssues = await issueNode.readParentIssues(projectId, organizationId, args.issueInput);
        returnValue.parentIssues = parentIssues;
        returnValue.parentIssues = sortBy(returnValue.parentIssues, 'name');
        returnValue.parentIssues = uniqBy(returnValue.parentIssues, 'sourceId');
      }
    }
    logger.debug('<< getIssues()');
    return returnValue;
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

/**
 *Fetches list of issue types.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const getIssueTypes = async (args) => {
  logger.debug('>> getIssueTypes()');
  try {
    await validateGetIssuesInput(args);

    let returnValue = null;
    const { projectId } = args;
    const rmt = await rmtNode.readRMTDetailsByProjectId(projectId);
    if (rmt.length === 0) {
      const errMsg = 'RMT does not exist for the given project Id';
      logger.error(errMsg);
      throw errors.NotFound('RMT', errMsg);
    }
    const rmtProject = await rmtProjectNode.readByRMTId(rmt[0].rmtId);
    returnValue = await rmtIssueTypeNode.readByRMTProjectId(rmtProject.rmtProjectId);
    returnValue = sortBy(returnValue, 'level');
    logger.debug('<< getIssueTypes()');
    return returnValue;
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

const checkOrphanIssueLink = async (context, issueGroupId, issue) => {
  try {
    const orphanIssueGroup = await issueGroupNode.readOrphanIssueGroupByProjectId(context.projectId, context.tx);
    const isOrphanRelationExists = await issueGroupNode.isOrphanIssueGroupRelationExists(orphanIssueGroup.orphanIssueGroupId, issue.issueId, context.projectId, context.tx);
    if (isOrphanRelationExists) {
      await issueGroupNode.deleteOrphanIssueRelation(context.tx, { orphanIssueGroupId: orphanIssueGroup.orphanIssueGroupId }, { issueId: issue.issueId });
      await issueGroupNode.createIssueRelation(context, { issueGroupId }, { issueId: issue.issueId });
    }
  }
  catch (err) {
    logger.error(err);
    throw err;
  }
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

const createIssues = async (tx, rmtInput, parentLabel, parentData, issueGroupId, rmtIssueTypes, parentIssueIds = []) => {
  logger.debug('>> createIssues()');
  try {
    const { length } = rmtIssueTypes;
    let rmtIssueType = null;
    const parentIssueNodes = [];
    rmtIssueType = rmtIssueTypes.filter((issue) => issue.type === parentLabel)[0];
    for (let i = 0; i < parentData.length; i++) {
      const item = parentData[i];
      let issue = null;
      const issueDetails = await issueNode.readByKey(item.key, tx.projectId, tx.tx);
      if (issueDetails.length > 0) {
        parentIssueNodes.push(issueDetails[0]);
        await checkOrphanIssueLink(tx, issueGroupId, issueDetails[0]);
      }
      else {
        issue = await issueNode.create(tx, tx.projectId, item.type, item, rmtIssueType.level, rmtIssueTypes.length);
        await issueGroupNode.createIssueRelation(tx, { issueGroupId }, { issueId: issue.properties.issueId });
        parentIssueNodes.push(issue.properties);
      }
      if (parentIssueIds.length > 0) {
        for (let j = 0; j < parentIssueIds.length; j++) {
          const isIssueRelationExists = await issueNode.isIssueRelationExists(parentIssueIds[j], issueDetails.length === 0 ? issue.properties.issueId : issueDetails[0].issueId, tx.projectId, tx.tx);
          if (!isIssueRelationExists) {
            const parentIssues = await issueNode.readParentIssues(tx.projectId, tx.organizationId, { parentIssueId: issueDetails.length === 0 ? issue.properties.issueId : issueDetails[0].issueId }, tx.tx);
            if (parentIssues.length > 0) {
              for (let k = 0; k < parentIssues.length; k++) {
                const parentIssue = parentIssues[k];
                await issueNode.deleteIssueRelation(tx.tx, { issueId: parentIssue.issueId }, { issueId: issueDetails.length === 0 ? issue.properties.issueId : issueDetails[0].issueId });
              }
            }
            await issueNode.createChildIssueRelation(
              tx,
              { issueId: parentIssueIds[j] },
              {
                issueId: issueDetails.length === 0 ? issue.properties.issueId : issueDetails[0].issueId,
              },
            );
          }
        }
      }
    }
    if (rmtIssueType && rmtIssueType.level !== length) {
      for (let i = 0; i < parentIssueNodes.length; i++) {
        const parentIds = [];
        const node = parentIssueNodes[i];
        parentIds.push(node.issueId);
        let childData = await integration.readRMTChildEntity(rmtInput.serverUrl, rmtInput.username, rmtInput.password, rmtInput.projectName, rmtInput.integrationType, rmtInput.pat, parentLabel, node.sourceId, rmtIssueType.searchKey);
        childData = await removeCyclicRMTData(childData, parentLabel, rmtIssueTypes);
        if (childData && childData.length > 0) {
          childData = childData.map((item) => {
            if (dateTime.isBefore(lastUpdatedDateTime, item.modifiedDate)) {
              lastUpdatedDateTime = item.modifiedDate;
            }
            return { sourceId: item.id, name: item.name, key: item.key, description: item.description, createdDate: item.createdDate, modifiedDate: item.modifiedDate, type: item.type, isDeleted: false };
          });
          const uniqueValues = uniqBy(childData, 'type');
          for (let j = 0; j < uniqueValues.length; j++) {
            const value = uniqueValues[j];
            const filterChildData = childData.filter((data) => data.type === value.type);
            try {
              await createIssues(tx, rmtInput, value.type, filterChildData, issueGroupId, rmtIssueTypes, parentIds);
            }
            catch (err) {
              logger.error(err);
              throw err;
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

const updateChildIssues = async (tx, serverUrl, username, password, projectName, integrationType, pat, parentLabel, parentData, issueGroupId, rmtIssueTypes, searchKey, date) => {
  logger.debug('>> updateChildIssues()');
  try {
    let newIssueData = [];
    for (let i = 0; i < parentData.length; i++) {
      const item = parentData[i];
      const currentChildData = await issueNode.readChildIssues(tx.projectId, tx.organizationId, { issueId: item.issueId }, tx.tx);
      let updatedChildData = await integration.readRMTChildEntity(serverUrl, username, password, projectName, integrationType, pat, parentLabel, item.sourceId, searchKey, date);
      updatedChildData = updatedChildData || [];
      updatedChildData = updatedChildData.map((issue) => {
        if (dateTime.isBefore(lastUpdatedDateTime, issue.modifiedDate)) {
          lastUpdatedDateTime = issue.modifiedDate;
        }
        return { sourceId: issue.id, name: issue.name, key: issue.key, description: issue.description, createdDate: issue.createdDate, modifiedDate: issue.modifiedDate, type: issue.type, isDeleted: false };
      });
      if (currentChildData.length > 0) {
        const uniqueValues = uniqBy(currentChildData, 'type');
        for (let j = 0; j < uniqueValues.length; j++) {
          const value = uniqueValues[j];
          const rmtIssueType = rmtIssueTypes.filter((issue) => issue.type === value.type)[0];
          const filterChildData = currentChildData.filter((data) => data.type === value.type);
          try {
            if (rmtIssueTypes.length !== rmtIssueType.level) {
              await updateChildIssues(tx, serverUrl, username, password, projectName, integrationType, pat, value.type, filterChildData, issueGroupId, rmtIssueTypes, rmtIssueType.searchKey, date);
            }
          }
          catch (err) {
            logger.error(err);
            throw err;
          }
        }
      }
      for (let j = 0; j < updatedChildData.length; j++) {
        const updatedIssue = updatedChildData[j];
        const oldIssues = currentChildData.filter((issue) => parseInt(issue.sourceId, 10) === parseInt(updatedIssue.sourceId, 10));
        if (oldIssues.length > 0) {
          const oldIssue = oldIssues[0];
          await issueNode.update(tx, { issueId: oldIssue.issueId }, updatedIssue);
        }
        else {
          newIssueData.push(updatedIssue);
        }
      }
      const parentIds = [];
      parentIds.push(item.issueId);
      if (newIssueData.length > 0) {
        await createIssues(tx, { serverUrl, username, password, projectName, integrationType, pat }, newIssueData[0].type, newIssueData, issueGroupId, rmtIssueTypes, parentIds);
        newIssueData = [];
      }
    }
    logger.debug('<< updateChildIssues()');
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

const syncEntities = async (context, serverUrl, username, password, projectName, searchKey, integrationType, pat, type, issueGroupId, rmtIssueTypes, date, rmtDetails = []) => {
  logger.debug('>> syncEntities()');
  let session;
  let tx = null;
  try {
    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;
    const currentIssues = await issueNode.readIssues(context.projectId, context.organizationId, { type }, context.tx);
    let updatedIssues = await integration.readRMTProjectEntity(serverUrl, username, password, projectName, integrationType, pat, type, date);
    updatedIssues = updatedIssues || [];
    updatedIssues = updatedIssues.map((issueInfo) => {
      if (dateTime.isBefore(lastUpdatedDateTime, issueInfo.modifiedDate)) {
        lastUpdatedDateTime = issueInfo.modifiedDate;
      }
      return { sourceId: issueInfo.id, name: issueInfo.name, key: issueInfo.key, description: issueInfo.description, createdDate: issueInfo.createdDate, modifiedDate: issueInfo.modifiedDate, type: issueInfo.type, isDeleted: false };
    });
    for (let i = 0; i < updatedIssues.length; i++) {
      const updatedIssue = updatedIssues[i];
      const oldIssues = currentIssues.filter((issue) => issue.sourceId === updatedIssue.sourceId);
      if (oldIssues.length > 0) {
        const oldIssue = oldIssues[0];
        await issueNode.update(context, { issueId: oldIssue.issueId }, updatedIssue);
      }
    }
    await updateChildIssues(context, serverUrl, username, password, projectName, integrationType, pat, type, currentIssues, issueGroupId, rmtIssueTypes, searchKey, date);
    await rmtNode.update(context, { rmtId: rmtDetails[0].rmtId }, { lastSynced: lastUpdatedDateTime, syncStatus: true });
    await tx.commit();
    await integration.closeRMTConnection(serverUrl, username, password, integrationType, pat);
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.syncIssue} \nMessage=> ${err} \nStack=> ${err.stack}`);
    if (tx !== null) {
      try {
        await tx.rollback();
      }
      catch (rollbackError) {
        logger.error(`${ERROR_MESSAGES.rollback} ${rollbackError}`);
      }
    }
  }
  finally {
    driverManager.closeSession(session);
  }
  logger.debug('<< syncEntities()');
};

/**
 * Incremental issue sync.
 *
 * @param {*} args
 * @param {*} context
 * @returns
 */
const syncIssues = async (args, context) => {
  logger.debug('>> syncIssues()');
  let status;
  let tx = null;
  try {
    const { projectId } = args;
    const rmtDetails = await rmtNode.readRMTDetailsByProjectId(args.projectId);
    if (rmtDetails.length === 0) {
      const errMsg = 'RMT does not exist for the given project id.';
      logger.error(errMsg);
      throw errors.NotFound('RMT', errMsg);
    }
    const rmtType = await rmtTypeNode.readRMTTypeLabel(rmtDetails[0].rmtId);
    const connectionDetails = await rmtNode.readConnectionDetailsByRMTId(rmtDetails[0].rmtId);
    const rmtProjectDetails = await rmtProjectNode.readByRMTId(rmtDetails[0].rmtId);
    const projectName = rmtProjectDetails.id;
    let rmtIssueTypes = await rmtIssueTypeNode.readByRMTProjectId(rmtProjectDetails.rmtProjectId);
    rmtIssueTypes = sortBy(rmtIssueTypes, 'level');
    const { searchKey } = rmtIssueTypes[0];
    let { serverUrl, username, password, pat } = connectionDetails;
    if (password) {
      password = await crypto.decrypt(password);
    }
    const returnValue = await integration.testRMTConnection(serverUrl, username, password, projectName, rmtType[0], pat);
    if (returnValue.status) {
      let issueGroup;
      let session;
      try {
        session = driverManager.getWriteSession();
        tx = session.beginTransaction();
        context.tx = tx;
        context.projectId = projectId;
        issueGroup = await issueGroupNode.readByProjectId(projectId, tx);
        lastUpdatedDateTime = rmtDetails[0].lastSynced;
        await rmtNode.update(context, { rmtId: rmtDetails[0].rmtId }, { lastSynced: lastUpdatedDateTime, syncStatus: false });
        await tx.commit();
        status = true;
      }
      catch (err) {
        logger.error(`${ERROR_MESSAGES.syncIssue} \nMessage=> ${err} \nStack=> ${err.stack}`);
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
        syncEntities(context, serverUrl, username, password, projectName, searchKey, rmtType[0], pat, rmtIssueTypes[0].type, issueGroup.issueGroupId, rmtIssueTypes, lastUpdatedDateTime, rmtDetails);
      }
    }
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
  logger.debug('<< syncIssues()');
  return status;
};

const autoSyncIssues = async () => {
  logger.debug('>> autoSyncIssues()');
  try {
    logger.info('***********RMT Auto Sync Starts*************');
    logger.info('********************************************');
    logger.info('********************************************');
    const data = await projectNode.readAllProjectsWithRMTIssues();
    for (let i = 0; i < data.length; i++) {
      const project = data[i];
      await syncIssues(project, project);
    }
    logger.info('**********************************************');
    logger.info('**********************************************');
    logger.info('***********RMT Auto Sync Finished*************');
    logger.debug('<< autoSyncIssues()');
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.autoSync} \nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

const createOrphanStoryRelation = async (tx, issueGroupId, orphanIssueGroupId, parentData) => {
  logger.debug('>> createOrphanStoryRelation()');
  for (let i = 0; i < parentData.length; i++) {
    const item = parentData[i];
    await issueGroupNode.deleteIssueRelation(tx.tx, { issueGroupId }, { issueId: item.issueId });
    await issueGroupNode.createOrphanIssueRelation(tx, { orphanIssueGroupId }, { issueId: item.issueId });
    const childIssues = await issueNode.readChildIssues(tx.projectId, tx.organizationId, { issueId: item.issueId }, tx.tx);
    if (childIssues.length > 0) {
      await createOrphanStoryRelation(tx, issueGroupId, orphanIssueGroupId, childIssues);
    }
  }
  logger.debug('<< createOrphanStoryRelation()');
};

const handleCallback = async (req, res) => {
  logger.debug('>> handleCallback()');
  if (req.body.eventType === 'entityDelete') {
    const { key, subscriberId } = req.body;
    let session = null;
    let tx = null;
    const context = {};
    try {
      session = driverManager.getWriteSession();
      tx = session.beginTransaction();
      context.tx = tx;
      const result = await rmtProjectNode.readProjectAndRMTProjectByDeleteSubscriberId(subscriberId, tx);
      if (result) {
        context.projectId = result.project.projectId;
        const metaData = await projectNode.readProjectsWithRMTIssues(context.projectId, 'Active', tx);
        context.userId = metaData[0].userId;
        context.organizationId = metaData[0].organizationId;
        const issueDetails = await issueNode.readByKey(key, context.projectId, tx);
        if (issueDetails.length > 0) {
          const updateProps = issueDetails[0];
          updateProps.isDeleted = true;
          await issueNode.update(context, { issueId: issueDetails[0].issueId }, updateProps);
        }
      }
      await tx.commit();
    }
    catch (err) {
      logger.error(`${ERROR_MESSAGES.entityDeleteCallabck} \nMessage=> ${err} \nStack=> ${err.stack}`);
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
    res.send('Success');
  }
  else if (req.body.eventType === 'issuelink_deleted') {
    const { destinationIssueId, sourceIssueId, subscriberId } = req.body;
    let session = null;
    let tx = null;
    const context = {};
    try {
      session = driverManager.getWriteSession();
      tx = session.beginTransaction();
      context.tx = tx;
      const result = await rmtProjectNode.readProjectAndRMTProjectByUpdateSubscriberId(subscriberId, tx);
      if (result) {
        context.projectId = result.project.projectId;
        const metaData = await projectNode.readProjectsWithRMTIssues(context.projectId, 'Active', tx);
        context.userId = metaData[0].userId;
        context.organizationId = metaData[0].organizationId;
        const destinationIssueDetails = await issueNode.readByRMTSourceId(destinationIssueId, context.projectId, tx);
        const sourceIssueDetails = await issueNode.readByRMTSourceId(sourceIssueId, context.projectId, tx);
        if (destinationIssueDetails.length > 0 && sourceIssueDetails.length > 0) {
          const destinationIssue = destinationIssueDetails[0];
          const sourceIssue = sourceIssueDetails[0];
          const isRelationExists = await issueNode.isIssueRelationExists(sourceIssue.issueId, destinationIssue.issueId, context.projectId, tx);
          if (isRelationExists) {
            await issueNode.deleteStoryRelationship(context.tx, destinationIssue.issueId, destinationIssue.type);
            const issueGroup = await issueGroupNode.readByProjectId(context.projectId, tx);
            const orphanIssueGroup = await issueGroupNode.readOrphanIssueGroupByProjectId(context.projectId, context.tx);
            await issueGroupNode.deleteIssueRelation(context.tx, { issueGroupId: issueGroup.issueGroupId }, { issueId: destinationIssue.issueId });
            await issueGroupNode.createOrphanIssueRelation(context, { orphanIssueGroupId: orphanIssueGroup.orphanIssueGroupId }, { issueId: destinationIssue.issueId });
            const childDestinationIssues = await issueNode.readChildIssues(context.projectId, context.organizationId, { issueId: destinationIssue.issueId }, context.tx);
            if (childDestinationIssues.length > 0) {
              await createOrphanStoryRelation(context, issueGroup.issueGroupId, orphanIssueGroup.orphanIssueGroupId, childDestinationIssues);
            }
          }
        }
      }
      await tx.commit();
    }
    catch (err) {
      logger.error(`${ERROR_MESSAGES.entityUpdateCallabck} \nMessage=> ${err} \nStack=> ${err.stack}`);
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
    res.send('Success');
  }
  else {
    // do nothing
  }
  logger.debug('<< handleCallback()');
};

/**
 *Fetches status of rmt sync.
 *
 * @param {*} args
 * @returns
 */
const getSyncStatus = async (args) => {
  logger.debug('>> getSyncStatus()');
  try {
    if (!args.projectId) {
      throw errors.Mandatory('PROJECT_ID', 'Project id is mandatory to get sync status');
    }
    let returnValue = false;
    const { projectId } = args;
    const rmtDetails = await rmtNode.readRMTDetailsByProjectId(projectId);
    if (rmtDetails.length === 0) {
      const errMsg = 'RMT does not exist for the given project id.';
      logger.error(errMsg);
      throw errors.NotFound('RMT', errMsg);
    }
    returnValue = rmtDetails[0].syncStatus || returnValue;
    logger.debug('<< getSyncStatus()');
    return returnValue;
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
};

module.exports = {
  getIssues,
  getIssueTypes,
  syncIssues,
  autoSyncIssues,
  handleCallback,
  getSyncStatus,
};

const request = require('request-promise');
const config = require('config');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);

const ERROR_MESSAGES = {
  readRMTChildEntity: 'No child entities found.',
  registerEvent: 'Issue occured while registering event.',
};

const getConnectionResponse = async (options) => {
  const result = await request(options);
  let returnVal = null;
  if (result.Result) {
    returnVal = { status: true };
  }
  else {
    returnVal = { status: false };
  }
  return returnVal;
};

const getConnectionData = async (options) => {
  const result = await request(options);
  let returnVal = null;
  if (result.Result) {
    returnVal = result.ReturnObj;
  }
  return returnVal;
};

/**
 *Test RMT Connection.
 *
 * @param {*} serverUrl
 * @param {*} username
 * @param {*} password
 * @param {*} projectName
 * @param {*} type
 * @param {*} pat
 * @returns {*} boolean
 */
const testRMTConnection = async (serverUrl, username, password, projectName, type, pat) => {
  logger.debug('>> testRMTConnection()');
  let options = null;
  options = {
    method: 'POST',
    uri: `${config.get('integrationService')}/testConnection`,
    body: {
      PAT: pat || '',
      userName: username || '',
      password: password || '',
      serverUrl: serverUrl || '',
      integrationType: type || '',
      targetProjectIdentifier: projectName || '',
    },
    json: true,
  };
  logger.debug('<< testRMTConnection()');
  return await getConnectionResponse(options);
};

/**
 *Read projects using RMT Connection.
 *
 * @param {*} serverUrl
 * @param {*} username
 * @param {*} password
 * @param {*} type
 * @param {*} pat
 * @returns {*} Array of projects
 */
const readRMTProjects = async (serverUrl, username, password, type, pat) => {
  logger.debug('>> readRMTProjects()');
  let options = null;
  options = {
    method: 'POST',
    uri: `${config.get('integrationService')}/getProjects`,
    body: {
      PAT: pat || '',
      userName: username || '',
      password: password || '',
      serverUrl: serverUrl || '',
      integrationType: type || '',
    },
    json: true,
  };
  try {
    logger.debug('<< readRMTProjects()');
    return await getConnectionData(options);
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    return null;
  }
};

/**
 *Read RMT Project Entities.
 *
 * @param {*} serverUrl
 * @param {*} username
 * @param {*} password
 * @param {*} projectName
 * @param {*} type
 * @param {*} pat
 * @returns {*} Array of entity types
 */
const readRMTProjectEntityTypes = async (serverUrl, username, password, projectName, type, pat) => {
  logger.debug('>> readRMTProjectEntityTypes()');
  let options = null;
  options = {
    method: 'POST',
    uri: `${config.get('integrationService')}/getEntityTypes`,
    body: {
      PAT: pat || '',
      userName: username || '',
      password: password || '',
      serverUrl: serverUrl || '',
      integrationType: type || '',
      targetProjectIdentifier: projectName || '',
    },
    json: true,
  };
  try {
    logger.debug('<< readRMTProjectEntityTypes()');
    return await getConnectionData(options);
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    return null;
  }
};

/**
 *Read Entity List in RMT Project.
 *
 * @param {*} serverUrl
 * @param {*} username
 * @param {*} password
 * @param {*} projectName
 * @param {*} type
 * @param {*} pat
 * @param {*} entityType
 * @param {*} changedDate
 * @returns {*} Array of entity list
 */
const readRMTProjectEntity = async (serverUrl, username, password, projectName, type, pat, entityType, changedDate) => {
  logger.debug('>> readRMTProjectEntity()');
  let options = null;
  options = {
    method: 'POST',
    uri: `${config.get('integrationService')}/getEntities`,
    body: {
      PAT: pat || '',
      userName: username || '',
      password: password || '',
      serverUrl: serverUrl || '',
      integrationType: type || '',
      targetProjectIdentifier: projectName || '',
      entityType: entityType || '',
      changedDate: changedDate || '2000-01-01',
    },
    json: true,
  };
  try {
    logger.debug('<< readRMTProjectEntity()');
    return await getConnectionData(options);
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    return null;
  }
};

/**
 *Read Child Entity List in RMT Project.
 *
 * @param {*} serverUrl
 * @param {*} username
 * @param {*} password
 * @param {*} projectName
 * @param {*} type
 * @param {*} pat
 * @param {*} entityType
 * @param {*} parentEntityId
 * @returns {*} Array of child entity list
 */
const readRMTChildEntity = async (serverUrl, username, password, projectName, type, pat, entityType, parentEntityId, searchKey, changedDate = null) => {
  logger.debug('>> readRMTChildEntity()');
  let options = null;
  options = {
    method: 'POST',
    uri: `${config.get('integrationService')}/getChildEntities`,
    body: {
      PAT: pat || '',
      userName: username || '',
      password: password || '',
      serverUrl: serverUrl || '',
      integrationType: type || '',
      targetProjectIdentifier: projectName || '',
      entityType: entityType || '',
      ParentEntityId: parentEntityId.low || parentEntityId || '',
      searchKey: searchKey || '',
      changedDate: changedDate || '2000-01-01',
    },
    json: true,
  };
  try {
    logger.debug('<< readRMTChildEntity()');
    return await getConnectionData(options);
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.readRMTChildEntity} \nMessage=> ${err} \nStack=> ${err.stack}`);
    return null;
  }
};

/**
 *Register Delete Event WebHook for RMT Project.
 *
 * @param {*} subscriberId
 * @param {*} callbackUrl
 * @param {*} serverUrl
 * @param {*} username
 * @param {*} password
 * @param {*} projectName
 * @param {*} type
 * @param {*} pat
 * @returns {*} boolean
 */
const registerEvent = async (subscriberId, serverUrl, username, password, projectName, type, pat, eventType) => {
  logger.debug('>> registerEvent()');
  let options = null;
  options = {
    method: 'POST',
    uri: `${config.get('integrationService')}/registerEvent`,
    body: {
      subscriberId: subscriberId || '',
      callBackURL: `${config.get('accountManagementService')}/api/v1/q/ds/integrationmanagement/callback/sync`,
      eventToSubscribe: eventType,
      integrationType: type || '',
      targetProjectIdentifier: projectName || '',
      serverUrl: serverUrl || '',
      PAT: pat || '',
      userName: username || '',
      password: password || '',
    },
    json: true,
  };
  try {
    const result = await request(options);
    let returnVal = null;
    if (result.Result) {
      returnVal = result.ReturnObj;
    }
    else {
      returnVal = false;
    }
    logger.debug('<< registerEvent()');
    return returnVal;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.registerEvent} \nMessage=> ${err} \nStack=> ${err.stack}`);
    return false;
  }
};

/**
 *UnRegister Delete Event WebHook for RMT Project.
 *
 * @param {*} subscriberId
 * @returns {*} boolean
 */
const unregisterEvent = async (subscriberId) => {
  logger.debug('>> unregisterEvent()');
  let options = null;
  options = {
    method: 'POST',
    uri: `${config.get('integrationService')}/unregisterEvent`,
    body: {
      subscriberId: subscriberId || '',
    },
    json: true,
  };
  try {
    const result = await request(options);
    let returnVal = null;
    if (result.Result) {
      returnVal = result.ReturnObj;
    }
    else {
      returnVal = false;
    }
    logger.debug('<< unregisterEvent()');
    return returnVal;
  }
  catch (err) {
    logger.error(`${ERROR_MESSAGES.unregisterEvent} \nMessage=> ${err} \nStack=> ${err.stack}`);
    return false;
  }
};

/**
 *Close RMT Connection.
 *
 * @param {*} serverUrl
 * @param {*} username
 * @param {*} password
 * @param {*} type
 * @param {*} pat
 * @returns {*} boolean
 */
const closeRMTConnection = async (serverUrl, username, password, type, pat) => {
  logger.debug('>> closeRMTConnection()');
  let options = null;
  options = {
    method: 'POST',
    uri: `${config.get('integrationService')}/closeConnection`,
    body: {
      PAT: pat || '',
      userName: username || '',
      password: password || '',
      serverUrl: serverUrl || '',
      integrationType: type || '',
    },
    json: true,
  };
  logger.debug('<< closeRMTConnection()');
  return await getConnectionResponse(options);
};

module.exports = {
  testRMTConnection,
  readRMTProjects,
  readRMTProjectEntityTypes,
  readRMTProjectEntity,
  readRMTChildEntity,
  registerEvent,
  closeRMTConnection,
  unregisterEvent,
};

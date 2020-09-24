const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const utils = require('../../utils');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  connectionAuth: 'ConnectionAuth',
  connection: 'Connection',
};

const RELATIONSHIPS = {
  hasConnectionAuth: 'HAS_CONNECTION_AUTH',
};

/**
 *Creates a new connection auth node
 *
 * @param {*} tx
 * @returns {*} Newly created connection auth node.
 */
const create = async (pat, username, password, tx = null) => {
  logger.debug('>> create()');
  const connectionAuthId = uuid.uuidWithoutHyphens();
  let result = null;
  if (pat) {
    result = await executor.createNode(tx, [LABELS.connectionAuth], { connectionAuthId, pat });
  }
  else {
    result = await executor.createNode(tx, [LABELS.connectionAuth], { connectionAuthId, username, password });
  }
  logger.debug('<< create()');
  return result;
};

/**
 *Reads the connection auth details by rmtId.
 *
 * @returns {*} ConnectionAuth
 */
const readConnectionAuthByConnectionId = async (connectionId, txOrSession = null) => {
  logger.debug('>> readConnectionAuthByConnectionId()');
  const query = `MATCH (:${LABELS.connection} {connectionId: $connectionId})-
    [:${RELATIONSHIPS.hasConnectionAuth}]->(connectionAuth:${LABELS.connectionAuth})  
     RETURN connectionAuth`;
  const params = {
    connectionId,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('connectionAuth').properties));
  logger.debug('<< readConnectionAuthByConnectionId()');
  return returnVal;
};

/**
 *Delete a connection Auth node
 *
 * @param {*} connectionAuthId
 * @param {*} tx
 */
const deleteByConnectionAuthId = async (connectionAuthId, tx = null) => {
  logger.debug('>> deleteByConnectionAuthId()');
  await executor.deleteNode(tx, [LABELS.connectionAuth], { connectionAuthId });
  logger.debug('<< deleteByConnectionAuthId()');
};

/**
 *Updates a connection Auth node
 *
 * @param {*} connectionAuthId
 * @param {*} connectionAuthProps
 * @param {*} tx
 */
const updateByConnectionAuthId = async (context, connectionAuthId, connectionAuthProps) => {
  logger.debug('<< updateByConnectionAuthId()');
  const result = await executor.updateNode(context, [LABELS.connectionAuth], { connectionAuthId }, connectionAuthProps);
  logger.debug('<< updateByConnectionAuthId()');
  return result;
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  create,
  readConnectionAuthByConnectionId,
  deleteByConnectionAuthId,
  updateByConnectionAuthId,
};

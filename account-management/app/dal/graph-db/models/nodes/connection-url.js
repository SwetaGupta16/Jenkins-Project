const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const utils = require('../../utils');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  connectionUrl: 'ConnectionUrl',
  connection: 'Connection',
};

const RELATIONSHIPS = {
  hasConnectionUrl: 'HAS_CONNECTION_URL',
};

/**
 *Creates a new connection url node
 *
 * @param {*} tx
 * @returns {*} Newly created connection url node.
 */
const create = async (serverUrl, tx = null) => {
  logger.debug('>> create()');
  const connectionUrlId = uuid.uuidWithoutHyphens();
  const result = await executor.createNode(tx, [LABELS.connectionUrl], { connectionUrlId, serverUrl });
  logger.debug('<< create()');
  return result;
};

/**
 *Reads the connection url details by rmtId.
 *
 * @returns {*} ConnectionUrl
 */
const readConnectionURLByConnectionId = async (connectionId, txOrSession = null) => {
  logger.debug('>> readConnectionURLByConnectionId()');
  const query = `MATCH (:${LABELS.connection} {connectionId: $connectionId})-
    [:${RELATIONSHIPS.hasConnectionUrl}]->(connectionUrl:${LABELS.connectionUrl})  
     RETURN connectionUrl`;
  const params = {
    connectionId,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnValue = result.records.map((record) => utils.simplifyIntegerTypes(record.get('connectionUrl').properties));
  logger.debug('<< readConnectionURLByConnectionId()');
  return returnValue;
};

/**
 *Delete a connection Url node
 *
 * @param {*} connectionUrlId
 * @param {*} tx
 */
const deleteByConnectionUrlId = async (connectionUrlId, tx = null) => {
  logger.debug('>> deleteByConnectionUrlId()');
  await executor.deleteNode(tx, [LABELS.connectionUrl], { connectionUrlId });
  logger.debug('<< deleteByConnectionUrlId()');
};

/**
 *Updates a connection Url node
 *
 * @param {*} connectionUrlId
 * @param {*} connectionUrlProps
 * @param {*} tx
 */
const updateByConnectionUrlId = async (tx, connectionUrlId, connectionUrlProps) => {
  logger.debug('>> updateByConnectionUrlId()');
  const result = await executor.updateNode(tx, [LABELS.connectionUrl], { connectionUrlId }, connectionUrlProps);
  logger.debug('<< updateByConnectionUrlId()');
  return result;
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  create,
  readConnectionURLByConnectionId,
  deleteByConnectionUrlId,
  updateByConnectionUrlId,
};

const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const connectionUrlNode = require('./connection-url');
const connectionAuthNode = require('./connection-auth');
const utils = require('../../utils');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  connection: 'Connection',
  rmt: 'RMT',
};

const RELATIONSHIPS = {
  hasConnectionUrl: 'HAS_CONNECTION_URL',
  hasConnectionAuth: 'HAS_CONNECTION_AUTH',
  hasConnection: 'HAS_CONNECTION',
};

const connectionUrlLabels = connectionUrlNode.LABELS;
const connectionAuthLabels = connectionAuthNode.LABELS;

/**
 *Creates a new connection node
 *
 * @param {*} tx
 * @returns {*} Newly created connection node.
 */
const create = async (tx = null) => {
  logger.debug('>> create()');
  const connectionId = uuid.uuidWithoutHyphens();
  const result = await executor.createNode(tx, [LABELS.connection], { connectionId });
  logger.debug('<< create()');
  return result;
};

/**
 *Creates HAS_CONNECTION_URL relationship from connection to connection-url node.
 *
 * @param {*} tx
 * @param {*} connectionProps
 * @param {*} connectionUrlProps
 * @param {*} relationshipProps
 * @returns {*} {
            connection,
            connectionUrl,
            relationship
        }
 */
const createConnectionUrlRelation = async (tx, connectionProps, connectionUrlProps, relationshipProps = {}) => {
  logger.debug('>> createConnectionUrlRelation()');
  const connection = { labels: [LABELS.connection], properties: { connectionId: connectionProps.connectionId } };
  const connectionUrl = { labels: [connectionUrlLabels.connectionUrl], properties: { connectionUrlId: connectionUrlProps.connectionUrlId } };

  const result = await executor.createOrUpdateRelationship(tx, connection, connectionUrl, RELATIONSHIPS.hasConnectionUrl, relationshipProps);
  const returnValue = {
    connection: result.source,
    connectionUrl: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createConnectionUrlRelation()');
  return returnValue;
};

/**
 *Creates HAS_CONNECTION_AUTH relationship from connection to connection-auth node.
 *
 * @param {*} tx
 * @param {*} connectionProps
 * @param {*} connectionUrlProps
 * @param {*} relationshipProps
 * @returns {*} {
            connection,
            connectionUrl,
            relationship
        }
 */
const createConnectionAuthRelation = async (tx, connectionProps, connectionAuthProps, relationshipProps = {}) => {
  logger.debug('>> createConnectionAuthRelation()');
  const connection = { labels: [LABELS.connection], properties: { connectionId: connectionProps.connectionId } };
  const connectionAuth = { labels: [connectionAuthLabels.connectionAuth], properties: { connectionAuthId: connectionAuthProps.connectionAuthId } };

  const result = await executor.createOrUpdateRelationship(tx, connection, connectionAuth, RELATIONSHIPS.hasConnectionAuth, relationshipProps);
  const returnValue = {
    connection: result.source,
    connectionAuth: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createConnectionAuthRelation()');
  return returnValue;
};

/**
 *Reads the connection details by rmtId.
 *
 * @returns {*} Connection
 */
const readConnectionByRMTId = async (rmtId, txOrSession = null) => {
  logger.debug('>> readConnectionByRMTId()');
  const query = `MATCH (:${LABELS.rmt} {rmtId: $rmtId})-
    [:${RELATIONSHIPS.hasConnection}]->(connection:${LABELS.connection})  
     RETURN connection`;
  const params = {
    rmtId,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnValue = result.records.map((record) => utils.simplifyIntegerTypes(record.get('connection').properties));
  logger.debug('<< readConnectionByRMTId()');
  return returnValue;
};

/**
 *Deletes HAS_CONNECTION_URL relationship from connection to connectionUrl.
 *
 * @param {*} tx
 * @param {*} connectionProps
 * @param {*} connectionUrlProps
 */
const deleteConnectionUrlRelationship = async (tx, connectionProps, connectionUrlProps) => {
  logger.debug('>> deleteConnectionUrlRelationship()');
  const connection = { labels: [LABELS.connection], properties: connectionProps };
  const connectionUrl = { labels: [connectionUrlNode.LABELS.connectionUrl], properties: connectionUrlProps };
  await executor.deleteRelationship(tx, connection, connectionUrl, RELATIONSHIPS.hasConnectionUrl);
  logger.debug('<< deleteConnectionUrlRelationship()');
};

/**
 *Deletes HAS_CONNECTION_AUTH relationship from connection to connectionAuth.
 *
 * @param {*} tx
 * @param {*} connectionProps
 * @param {*} connectionAuthProps
 */
const deleteConnectionAuthRelationship = async (tx, connectionProps, connectionAuthProps) => {
  logger.debug('>> deleteConnectionAuthRelationship()');
  const connection = { labels: [LABELS.connection], properties: connectionProps };
  const connectionAuth = { labels: [connectionUrlNode.LABELS.connectionAuth], properties: connectionAuthProps };
  await executor.deleteRelationship(tx, connection, connectionAuth, RELATIONSHIPS.hasConnectionAuth);
  logger.debug('<< deleteConnectionAuthRelationship()');
};

/**
 *Delete a connection node
 *
 * @param {*} connectionId
 * @param {*} tx
 */
const deleteByConnectionId = async (connectionId, tx = null) => {
  logger.debug('>> deleteByConnectionId()');
  await executor.deleteNode(tx, [LABELS.connection], { connectionId });
  logger.debug('<< deleteByConnectionId()');
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  create,
  createConnectionUrlRelation,
  createConnectionAuthRelation,
  readConnectionByRMTId,
  deleteConnectionUrlRelationship,
  deleteConnectionAuthRelationship,
  deleteByConnectionId,
};

const executor = require('../../executor');
const utils = require('../../utils');
const { uuid } = require('../../../../utils');
const rmtTypeNode = require('./rmt-type');
const rmtProjectNode = require('./rmt-project');
const connectionNode = require('./connection');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  rmt: 'RMT',
  product: 'Product',
  project: 'Project',
  productConfiguration: 'ProductConfiguration',
  configuration: 'Configuration',
  connectionAuth: 'ConnectionAuth',
  connectionUrl: 'ConnectionUrl',
};

const RELATIONSHIPS = {
  hasConnection: 'HAS_CONNECTION',
  hasProductConfiguration: 'HAS_PRODUCT_CONFIGURATION',
  hasRMTConfiguration: 'HAS_RMT_CONFIGURATION',
  hasConfiguration: 'HAS_CONFIGURATION',
  isOfType: 'IS_OF_TYPE',
  hasRMTProject: 'HAS_RMT_PROJECT',
};

/**
 *Creates a new rmt node
 *
 * @param {*} tx
 * @returns {*} Newly created rmt node.
 */
const create = async (tx = null) => {
  logger.debug('>> create()');
  const rmtId = uuid.uuidWithoutHyphens();
  const result = await executor.createNode(tx, [LABELS.rmt], { rmtId });
  logger.debug('<< create()');
  return result;
};

/**
 *Creates HAS_CONNECTION relationship from rmt to connection node.
 *
 * @param {*} tx
 * @param {*} rmtProps
 * @param {*} connectionProps
 * @param {*} relationshipProps
 * @returns {*} {
            rmt,
            connection,
            relationship
        }
 */
const createRMTConnectionRelation = async (tx, rmtProps, connectionProps, relationshipProps = {}) => {
  logger.debug('>> createRMTConnectionRelation()');
  const rmt = { labels: [LABELS.rmt], properties: { rmtId: rmtProps.rmtId } };
  const connection = { labels: [connectionNode.LABELS.connection], properties: { connectionId: connectionProps.connectionId } };

  const result = await executor.createOrUpdateRelationship(tx, rmt, connection, RELATIONSHIPS.hasConnection, relationshipProps);
  const returnValue = {
    rmt: result.source,
    connection: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createRMTConnectionRelation()');
  return returnValue;
};

/**
 *Creates IS_OF_TYPE relationship from rmt to support type node.
 *
 * @param {*} tx
 * @param {*} rmtProps
 * @param {*} type
 * @param {*} relationshipProps
 * @returns {*} {
            rmt,
            connection,
            relationship
        }
 */
const createRMTTypeRelation = async (tx, rmtProps, type, relationshipProps = {}) => {
  logger.debug('>> createRMTTypeRelation()');
  let rmtType = null;
  let returnValue = null;
  rmtType = await rmtTypeNode.readType(type);
  const rmt = { labels: [LABELS.rmt], properties: { rmtId: rmtProps.rmtId } };
  rmtType = { labels: [type], properties: rmtType[0] };

  const result = await executor.createOrUpdateRelationship(tx, rmt, rmtType, RELATIONSHIPS.isOfType, relationshipProps);
  returnValue = {
    rmt: result.source,
    rmtType: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createRMTTypeRelation()');
  return returnValue;
};

/**
 *Reads the list of all supported RMTs.
 *
 * @returns {*} RMTs List
 */
const readSupportedRMTS = async (productName, txOrSession = null) => {
  logger.debug('>> readSupportedRMTS()');
  const query = `MATCH (product:${LABELS.product} {name: $productName})-
    [:${RELATIONSHIPS.hasProductConfiguration}]->(:${LABELS.productConfiguration})-
    [:${RELATIONSHIPS.hasRMTConfiguration}]->
    (rmt:${LABELS.rmt})-[:${RELATIONSHIPS.isOfType}]->(type)
     RETURN type`;
  const params = {
    productName,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnValue = result.records.map((record) => {
    const obj = { type: record.get('type').labels };
    return utils.simplifyIntegerTypes(obj);
  });
  logger.debug('<< readSupportedRMTS()');
  return returnValue;
};

/**
 *Reads the RMT details by projectId.
 *
 * @returns {*} RMT
 */
const readRMTDetailsByProjectId = async (projectId, txOrSession = null) => {
  logger.debug('>> readRMTDetailsByProjectId()');
  const query = `MATCH (project:${LABELS.project} {projectId: $projectId})-
    [:${RELATIONSHIPS.hasConfiguration}]->(:${LABELS.configuration})-
    [:${RELATIONSHIPS.hasRMTConfiguration}]->(rmt:${LABELS.rmt})   
     RETURN rmt`;
  const params = {
    projectId,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('rmt').properties));
  logger.debug('>> readRMTDetailsByProjectId()');
  return returnVal;
};

/**
 *Read connection details of RMT type by rmtId.
 *
 * @returns {*} RMT
 */
const readConnectionDetailsByRMTId = async (rmtId, txOrSession = null) => {
  logger.debug('>> readConnectionDetailsByRMTId()');
  let returnValue = {};
  const query = `MATCH (:${LABELS.rmt} {rmtId: $rmtId})-
    [:${RELATIONSHIPS.hasConnection}]->(connection:${connectionNode.LABELS.connection})
    WITH connection MATCH (connection)-->(auth:${LABELS.connectionAuth}),(connection)-[]->(url:${LABELS.connectionUrl})
     RETURN auth,url`;
  const params = {
    rmtId,
  };

  const result = await executor.read(query, params, txOrSession);

  result.records.map((record) => {
    const url = utils.simplifyIntegerTypes(record.get('url').properties);
    const auth = utils.simplifyIntegerTypes(record.get('auth').properties);
    returnValue = { ...auth, ...url };
  });
  logger.debug('<< readConnectionDetailsByRMTId()');
  return returnValue;
};

/**
 *Checks if rmt exist or not based on projectId input parameter
 *
 * @param {*} projectId
 * @param {*} [txOrSession=null]
 * @returns {*} Boolean
 */
const exists = async (projectId, txOrSession = null) => {
  logger.debug('>> exists()');
  try {
    const records = await readRMTDetailsByProjectId(projectId, txOrSession);
    let result = false;
    if (records.length > 0) {
      result = true;
    }
    logger.debug('<< exists()');
    return result;
  }
  catch (err) {
    logger.error(err);
    throw err;
  }
};

/**
 *Deletes HAS_CONNECTION relationship from rmt to connection node.
 *
 * @param {*} tx
 * @param {*} rmtProps
 * @param {*} connectionProps
 */
const deleteRMTConnectionRelationship = async (tx, rmtProps, connectionProps) => {
  logger.debug('>> deleteRMTConnectionRelationship()');
  const rmt = { labels: [LABELS.rmt], properties: rmtProps };
  const connection = { labels: [connectionNode.LABELS.connection], properties: connectionProps };
  await executor.deleteRelationship(tx, rmt, connection, RELATIONSHIPS.hasConnection);
  logger.debug('<< deleteRMTConnectionRelationship()');
};

/**
 *Deletes IS_OF_TYPE relationship from rmt to rmtType.
 *
 * @param {*} tx
 * @param {*} rmtProps
 * @param {*} rmtTypeProps
 */
const deleteRMTTypeRelationship = async (tx, rmtProps, rmtTypeProps, type) => {
  logger.debug('>> deleteRMTTypeRelationship()');
  const rmt = { labels: [LABELS.rmt], properties: rmtProps };
  const rmtType = { labels: [type], properties: rmtTypeProps };
  await executor.deleteRelationship(tx, rmt, rmtType, RELATIONSHIPS.isOfType);
  logger.debug('<< deleteRMTTypeRelationship()');
};

/**
 *Delete a rmt node
 *
 * @param {*} rmtId
 * @param {*} tx
 */
const deleteByRMTId = async (rmtId, tx = null) => {
  logger.debug('>> deleteByRMTId()');
  await executor.deleteNode(tx, [LABELS.rmt], { rmtId });
  logger.debug('<< deleteByRMTId()');
};

/**
 *Creates HAS_RMT_PROJECT relationship from rmt to rmtProject.
 *
 * @param {*} context
 * @param {*} rmtProps
 * @param {*} rmtProjectProps
 * @param {*} relationshipProps
 * @returns {*} {
            rmt,
            rmtProject,
            relationship
        }
 */
const createRMTProjectRelation = async (context, rmtProps, rmtProjectProps, relationshipProps = {}) => {
  logger.debug('>> createRMTProjectRelation()');
  const rmt = { labels: [LABELS.rmt], properties: { rmtId: rmtProps.rmtId } };
  const rmtProject = { labels: [rmtProjectNode.LABELS.rmtProject], properties: { rmtProjectId: rmtProjectProps.rmtProjectId } };
  const result = await executor.createOrUpdateRelationship(context, rmt, rmtProject, RELATIONSHIPS.hasRMTProject, relationshipProps);
  const returnValue = {
    rmt: result.source,
    rmtProject: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createRMTProjectRelation()');
  return returnValue;
};

/**
 * Updates the rmt node properties.
 * @param {*} context
 * @param {*} rmtProps
 * @param {*} updatedRMTProps
 */
const update = async (context, rmtProps, updatedRMTProps) => {
  logger.debug('>> update()');
  let rmtNode = null;
  try {
    rmtNode = await executor.updateNode(context, [LABELS.rmt], rmtProps, updatedRMTProps);
  }
  catch (err) {
    logger.error(err);
    throw err;
  }
  logger.debug('<< update()');
  return rmtNode;
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  create,
  createRMTConnectionRelation,
  createRMTTypeRelation,
  readSupportedRMTS,
  readRMTDetailsByProjectId,
  readConnectionDetailsByRMTId,
  exists,
  deleteRMTConnectionRelationship,
  deleteRMTTypeRelationship,
  deleteByRMTId,
  createRMTProjectRelation,
  update,
};

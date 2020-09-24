const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const utils = require('../../utils');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  rmt: 'RMT',
};

const RELATIONSHIPS = {
  isOfType: 'IS_OF_TYPE',
};

/**
 *Creates a rmt type node
 * @param {*} type
 * @param {*} tx
 * @returns {*} Newly created type node.
 */
const create = async (type, tx = null) => {
  logger.debug('>> create()');
  const typeId = uuid.uuidWithoutHyphens();
  const typeProperties = {};
  const typeName = `${type.lowercase}+Id`;
  typeProperties[typeName] = typeId;
  const result = await executor.createNode(tx, [type], typeProperties);
  logger.debug('<< create()');
  return result;
};

/**
 *Reads default rmt type node
 *
 * @param {*} tx
 * @returns {*} Return default rmt type node.
 */
const readType = async (type = null, tx = null) => {
  logger.debug('>> readType()');
  const query = `MATCH (type:${type}) return type`;
  const params = {};

  const result = await executor.read(query, params, tx);

  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('type').properties));
  logger.debug('<< readType()');
  return returnVal;
};

/**
 *Reads the RMT type details by rmtId.
 *
 * @returns {*} RMT-Type
 */
const readRMTTypeDetails = async (rmtId, type, txOrSession = null) => {
  logger.debug('>> readRMTTypeDetails()');
  let query = null;
  if (type) {
    query = `MATCH (:${LABELS.rmt} {rmtId: $rmtId})-
        [:${RELATIONSHIPS.isOfType}]->(type:${type})
         RETURN type`;
  }
  else {
    query = `MATCH (:${LABELS.rmt} {rmtId: $rmtId})-
    [:${RELATIONSHIPS.isOfType}]->(type)
     RETURN type`;
  }
  const params = {
    rmtId,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('type').properties));
  logger.debug('<< readRMTTypeDetails()');
  return returnVal;
};

/**
 *Reads the RMT type label by rmtId.
 *
 * @returns {*} RMT-Type
 */
const readRMTTypeLabel = async (rmtId, txOrSession = null) => {
  logger.debug('>> readRMTTypeLabel()');
  const query = `MATCH (:${LABELS.rmt} {rmtId: $rmtId})-
    [:${RELATIONSHIPS.isOfType}]->(type)
     RETURN type`;
  const params = {
    rmtId,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnVal = result.records.map((record) => record.get('type').labels[0]);
  logger.debug('<< readRMTTypeLabel()');
  return returnVal;
};

/**
 *Checks if rmt type exist or not based on rmtId input parameter
 *
 * @param {*} rmtId
 * @param {*} [txOrSession=null]
 * @returns {*} Boolean
 */
const exists = async (rmtId, type, txOrSession = null) => {
  logger.debug('>> exists()');
  try {
    const records = await readRMTTypeDetails(rmtId, type, txOrSession);
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

module.exports = {
  create,
  readType,
  readRMTTypeDetails,
  exists,
  readRMTTypeLabel,
};

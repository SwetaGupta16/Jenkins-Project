const executor = require('../../executor');
const utils = require('../../utils');
const errors = require('../../../../errors');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

/* Neo4j labels */
const LABELS = {
  organization: 'Organization',
};

/* Neo4j relationships */
const RELATIONSHIPS = {
  hasProject: 'HAS_PROJECT',
  hasDefaultBusinessUnit: 'HAS_DEFAULT_BUSINESS_UNIT',
  hasBusinessUnit: 'HAS_BUSINESS_UNIT',
};

/**
 *Fetches organization details based on its id
 *
 * @param {*} organizationId
 * @param {*} [txOrSession=null]
 * @returns {*} Organization node
 */
const readById = async (organizationId, txOrSession = null) => {
  logger.debug('>> readById()');
  const query = `MATCH (org:${LABELS.organization} {organizationId: $organizationId}) return org`;
  const params = {
    organizationId,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = `Organization with id '${organizationId}' does not exist.`;
    logger.error(errMsg);
    throw errors.NotFound('ORGANIZATION', errMsg);
  }

  const returnVal = utils.simplifyIntegerTypes(result);
  logger.debug('<< readById()');
  return returnVal;
};

/**
 *Checks if organization exists or not based on organizationId input parameter
 *
 * @param {*} input
 * @param {*} txOrSession
 * @returns {*} Boolean
 */
const exists = async (input, txOrSession = null) => {
  logger.debug('>> exists()');
  let returnValue = false;

  if (input.organizationId) {
    try {
      await readById(input.organizationId, txOrSession);
      returnValue = true;
    }
    catch (err) {}
  }
  logger.debug('<< exists()');
  return returnValue;
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  readById,
  exists,
};

const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const utils = require('../../utils');
const errors = require('../../../../errors');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  rmtIssueType: 'RMTIssueType',
  rmtProject: 'RMTProject',
  story: 'Story',
};

const RELATIONSHIPS = {
  hasIssueType: 'HAS_ISSUE_TYPE',
  hasChildIssueType: 'HAS_CHILD_ISSUE_TYPE',
};

/**
 *Creates a new issue type node
 *
 * @param {*} context
 * @returns {*} Newly created issue type node.
 */
const create = async (context, issueType, issueProps, issueLevel, totalIssueTypes) => {
  logger.debug('>> create()');
  const rmtIssueTypeId = uuid.uuidWithoutHyphens();
  let result = null;
  if (issueLevel === totalIssueTypes && issueType !== LABELS.story) {
    result = await executor.createNode(context, [LABELS.rmtIssueType, issueType, LABELS.story], { rmtIssueTypeId, ...issueProps });
    return result;
  }
  result = await executor.createNode(context, [LABELS.rmtIssueType, issueType], { rmtIssueTypeId, ...issueProps });
  logger.debug('<< create()');
  return result;
};

/**
 *Creates HAS_CHILD_ISSUE_TYPE relationship from rmtParentIssueType to rmtChildIssueType.
 *
 * @param {*} context
 * @param {*} rmtParentIssueTypeProps
 * @param {*} rmtChildIssueTypeProps
 * @param {*} relationshipProps
 * @returns {*} {
            rmtProject,
            rmtIssueType,
            relationship
        }
 */
const createRMTProjectIssueTypeRelation = async (context, rmtParentIssueTypeProps, rmtChildIssueTypeProps, relationshipProps = {}) => {
  logger.debug('>> createRMTProjectIssueTypeRelation()');
  const rmtParentIssueType = { labels: [LABELS.rmtIssueType], properties: { rmtIssueTypeId: rmtParentIssueTypeProps.rmtIssueTypeId } };
  const rmtChildIssueType = { labels: [LABELS.rmtIssueType], properties: { rmtIssueTypeId: rmtChildIssueTypeProps.rmtIssueTypeId } };
  const result = await executor.createRelationship(context, rmtParentIssueType, rmtChildIssueType, RELATIONSHIPS.hasChildIssueType, relationshipProps);
  const returnValue = {
    rmtParentIssueType: result.source,
    rmtChildIssueType: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createRMTProjectIssueTypeRelation()');
  return returnValue;
};

/**
 *Reads rmt issue type details based on rmt project id
 *
 * @param {*} rmtProjectId
 * @param {*} [txOrSession=null]
 * @returns
 */
const readByRMTProjectId = async (rmtProjectId, txOrSession = null) => {
  logger.debug('>> readByRMTProjectId()');
  const query = `MATCH (rmtProject:${LABELS.rmtProject} {rmtProjectId: $rmtProjectId})
    -[p:${RELATIONSHIPS.hasIssueType}]->
    (rmtIssueType:${LABELS.rmtIssueType}) return rmtIssueType`;
  const params = {
    rmtProjectId,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = 'RMT Issue Type  not associated with rmt project.';
    logger.error(errMsg);
    throw errors.NotFound('RMT_ISSUE_TYPE', errMsg);
  }
  const returnValue = result.records.map((record) => utils.simplifyIntegerTypes(record.get('rmtIssueType').properties));
  logger.debug('<< readByRMTProjectId()');
  return returnValue;
};

/**
 *Delete rmtIssueType node
 *
 * @param {*} rmtIssueTypeId
 * @param {*} tx
 */
const deleteByRMTIssueTypeId = async (tx, rmtIssueTypeId) => {
  logger.debug('>> deleteByRMTIssueTypeId()');
  await executor.deleteNode(tx, [LABELS.rmtIssueType], { rmtIssueTypeId });
  logger.debug('<< deleteByRMTIssueTypeId()');
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  create,
  createRMTProjectIssueTypeRelation,
  readByRMTProjectId,
  deleteByRMTIssueTypeId,
};

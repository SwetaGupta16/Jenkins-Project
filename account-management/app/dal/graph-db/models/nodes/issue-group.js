const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const utils = require('../../utils');
const errors = require('../../../../errors');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  issueGroup: 'IssueGroup',
  issue: 'Issue',
  orphanIssueGroup: 'OrphanIssueGroup',
};

const RELATIONSHIPS = {
  hasIssue: 'HAS_ISSUE',
};

/**
 *Creates a issue node
 *
 * @param {*} tx
 * @returns {*} Newly created issue node.
 */
const create = async (tx, projId) => {
  logger.debug('>> create()');
  const issueGroupId = uuid.uuidWithoutHyphens();
  const projectId = `prj_${projId}`;
  const result = await executor.createNode(tx, [LABELS.issueGroup, projectId], { issueGroupId });
  logger.debug('<< create()');
  return result;
};

/**
 *Creates a orphan issue group node
 *
 * @param {*} tx
 * @returns {*} Newly created orphan issue group node.
 */
const createOrphanIssueGroup = async (tx, projId) => {
  logger.debug('>> createOrphanIssueGroup()');
  const orphanIssueGroupId = uuid.uuidWithoutHyphens();
  const projectId = `prj_${projId}`;
  const result = await executor.createNode(tx, [LABELS.orphanIssueGroup, projectId], { orphanIssueGroupId });
  logger.debug('<< createOrphanIssueGroup()');
  return result;
};

/**
 *Creates HAS_ISSUE relationship from IssueGroup to Issue.
 *
 * @param {*} tx
 * @param {*} issueGroupProps
 * @param {*} issueProps
 * @param {*} relationshipProps
 * @returns {*} {
            issueGroup,
            issue,
            relationship
        }
 */
const createIssueRelation = async (tx, issueGroupProps, issueProps, relationshipProps = {}) => {
  logger.debug('>> createIssueRelation()');
  const issueGroup = { labels: [LABELS.issueGroup], properties: { issueGroupId: issueGroupProps.issueGroupId } };
  const issue = { labels: [LABELS.issue], properties: { issueId: issueProps.issueId } };
  const result = await executor.createRelationship(tx, issueGroup, issue, RELATIONSHIPS.hasIssue, relationshipProps);
  const returnValue = {
    issueGroup: result.source,
    issue: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createIssueRelation()');
  return returnValue;
};

/**
 *DELETES HAS_ISSUE relationship from IssueGroup to Issue.
 *
 * @param {*} tx
 * @param {*} issueGroupProps
 * @param {*} issueProps
 * @param {*} relationshipProps
 */
const deleteIssueRelation = async (tx, issueGroupProps, issueProps) => {
  logger.debug('>> deleteIssueRelation()');
  const issueGroup = { labels: [LABELS.issueGroup], properties: { issueGroupId: issueGroupProps.issueGroupId } };
  const issue = { labels: [LABELS.issue], properties: { issueId: issueProps.issueId } };
  await executor.deleteRelationship(tx, issueGroup, issue, RELATIONSHIPS.hasIssue);
  logger.debug('<< deleteIssueRelation()');
};

/**
 *DELETES HAS_ISSUE relationship from OrphanIssueGroup to Issue.
 *
 * @param {*} tx
 * @param {*} orphanIssueGroupProps
 * @param {*} issueProps
 * @param {*} relationshipProps
 */
const deleteOrphanIssueRelation = async (tx, orphanIssueGroupProps, issueProps) => {
  logger.debug('>> deleteOrphanIssueRelation()');
  const issueGroup = { labels: [LABELS.orphanIssueGroup], properties: { orphanIssueGroupId: orphanIssueGroupProps.orphanIssueGroupId } };
  const issue = { labels: [LABELS.issue], properties: { issueId: issueProps.issueId } };
  await executor.deleteRelationship(tx, issueGroup, issue, RELATIONSHIPS.hasIssue);
  logger.debug('<< deleteOrphanIssueRelation()');
};

/**
 *Creates HAS_ISSUE relationship from OrphanIssueGroup to Issue.
 *
 * @param {*} tx
 * @param {*} orphanIssueGroupProps
 * @param {*} issueProps
 * @param {*} relationshipProps
 * @returns {*} {
            orphanIssueGroup,
            issue,
            relationship
        }
 */
const createOrphanIssueRelation = async (tx, orphanIssueGroupProps, issueProps, relationshipProps = {}) => {
  logger.debug('>> createOrphanIssueRelation()');
  const orphanIssueGroup = { labels: [LABELS.orphanIssueGroup], properties: { orphanIssueGroupId: orphanIssueGroupProps.orphanIssueGroupId } };
  const issue = { labels: [LABELS.issue], properties: { issueId: issueProps.issueId } };
  const result = await executor.createRelationship(tx, orphanIssueGroup, issue, RELATIONSHIPS.hasIssue, relationshipProps);
  const returnValue = {
    orphanIssueGroup: result.source,
    issue: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createOrphanIssueRelation()');
  return returnValue;
};

/**
 *Reads issue group details based on project id
 *
 * @param {*} projectI
 * @param {*} [txOrSession=null]
 * @returns
 */
const readByProjectId = async (projectId, txOrSession = null) => {
  logger.debug('>> readByProjectId()');
  const query = `MATCH (issueGroup:${LABELS.issueGroup}:\`prj_${projectId}\`) return issueGroup`;
  const params = {};

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = `Issue Group with ${projectId} not found.`;
    logger.error(errMsg);
    throw errors.NotFound('ISSUE_GROUP', errMsg);
  }
  const returnValue = utils.simplifyIntegerTypes(result.records[0].get('issueGroup').properties);
  logger.debug('<< readByProjectId()');
  return returnValue;
};

/**
 *Reads orphan issue group details based on project id
 *
 * @param {*} projectId
 * @param {*} [txOrSession=null]
 * @returns
 */
const readOrphanIssueGroupByProjectId = async (projectId, txOrSession = null) => {
  logger.debug('>> readOrphanIssueGroupByProjectId()');
  const query = `MATCH (orphanIssueGroup:${LABELS.orphanIssueGroup}:\`prj_${projectId}\`) return orphanIssueGroup`;
  const params = {};

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = `Orphan Issue Group with ${projectId} not found.`;
    logger.error(errMsg);
    throw errors.NotFound('ORPHAN_ISSUE_GROUP', errMsg);
  }
  const returnValue = utils.simplifyIntegerTypes(result.records[0].get('orphanIssueGroup').properties);
  logger.debug('<< readOrphanIssueGroupByProjectId()');
  return returnValue;
};

/**
 *Check relation exist or not
 *
 * @param {*} sourceIssueId
 * @param {*} destinationIssueId
 * @param {*} [txOrSession=null]
 * @returns Array
 */
const isOrphanIssueGroupRelationExists = async (orphanIssueGroupId, destinationIssueId, projectId, txOrSession = null) => {
  logger.debug('>> isOrphanIssueGroupRelationExists()');
  let query = null;
  const params = {};
  query = `MATCH (orphanIssueGroup:${LABELS.orphanIssueGroup}:\`prj_${projectId}\`{orphanIssueGroupId:$orphanIssueGroupId})-[r:${RELATIONSHIPS.hasIssue}]->(destinationIssue:${LABELS.issue}:\`prj_${projectId}\`{issueId:$destinationIssueId}) RETURN destinationIssue`;
  params.orphanIssueGroupId = orphanIssueGroupId;
  params.destinationIssueId = destinationIssueId;
  const result = await executor.read(query, params, txOrSession);
  let status = false;
  result.records.map((record) => {
    if (record.get('destinationIssue') && record.get('destinationIssue').properties) {
      status = true;
    }
  });
  logger.debug('<< isOrphanIssueGroupRelationExists()');
  return status;
};

/**
 *Checks if issue group exist or not based on projectId input parameter
 *
 * @param {*} input
 * @param {*} [txOrSession=null]
 * @returns {*} Boolean
 */
const exists = async (input, txOrSession = null) => {
  logger.debug('>> exists()');
  let returnValue = false;
  if (input.projectId) {
    await readByProjectId(input.projectId, txOrSession);
    returnValue = true;
  }
  logger.debug('<< exists()');
  return returnValue;
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  create,
  createOrphanIssueGroup,
  createIssueRelation,
  deleteIssueRelation,
  deleteOrphanIssueRelation,
  createOrphanIssueRelation,
  readByProjectId,
  readOrphanIssueGroupByProjectId,
  isOrphanIssueGroupRelationExists,
  exists,
};

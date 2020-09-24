const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const utils = require('../../utils');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);
const LABELS = {
  issue: 'Issue',
  story: 'Story',
  orphanIssueGroup: 'OrphanIssueGroup',
};

const RELATIONSHIPS = {
  hasIssue: 'HAS_ISSUE',
};

/**
 *Creates a new issue type node
 *
 * @param {*} tx
 * @returns {*} Newly created issue type node.
 */
const create = async (tx, projId, issueType, issueProps, issueLevel, totalIssueTypes) => {
  logger.debug('>> create()');
  const issueId = uuid.uuidWithoutHyphens();
  const projectId = `prj_${projId}`;
  let result = null;
  if (issueLevel === totalIssueTypes && issueType !== LABELS.story) {
    result = await executor.createNode(tx, [LABELS.issue, issueType, LABELS.story, projectId], { issueId, ...issueProps });
    return result;
  }
  result = await executor.createNode(tx, [LABELS.issue, issueType, projectId], { issueId, ...issueProps });
  logger.debug('<< create()');
  return result;
};

/**
 *Creates HAS_ISSUE relationship from parentIssue to childIssue.
 *
 * @param {*} tx
 * @param {*} parentIssueProps
 * @param {*} childIssueProps
 * @param {*} relationshipProps
 * @returns {*} {
            parentIssue,
            childIssue,
            relationship
        }
 */
const createChildIssueRelation = async (tx, parentIssueProps, childIssueProps, relationshipProps = {}) => {
  logger.debug('>> createChildIssueRelation()');
  const parentIssue = { labels: [LABELS.issue], properties: { issueId: parentIssueProps.issueId } };
  const childIssue = { labels: [LABELS.issue], properties: { issueId: childIssueProps.issueId } };
  const result = await executor.createRelationship(tx, parentIssue, childIssue, RELATIONSHIPS.hasIssue, relationshipProps);
  const returnValue = {
    parentIssue: result.source,
    childIssue: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createChildIssueRelation()');
  return returnValue;
};

/**
 *Deletes HAS_ISSUE relationship from issue to story.
 *
 * @param {*} tx
 * @param {*} issueId
 * @param {*} type
 */
const deleteStoryRelationship = async (tx, issueId, type) => {
  logger.debug('>> deleteStoryRelationship()');
  const issue = { labels: [LABELS.issue], properties: {} };
  const story = { labels: [LABELS.issue, type], properties: { issueId } };
  await executor.deleteRelationship(tx, issue, story, RELATIONSHIPS.hasIssue);
  logger.debug('<< deleteStoryRelationship()');
};

/**
 *DELETES HAS_ISSUE relationship from issue to Issue.
 *
 * @param {*} tx
 * @param {*} parentIssueProps
 * @param {*} issueProps
 * @param {*} relationshipProps
 */
const deleteIssueRelation = async (tx, parentIssueProps, issueProps) => {
  logger.debug('>> deleteIssueRelation()');
  const parentIssue = { labels: [LABELS.issue], properties: { issueId: parentIssueProps.issueId } };
  const issue = { labels: [LABELS.issue], properties: { issueId: issueProps.issueId } };
  await executor.deleteRelationship(tx, parentIssue, issue, RELATIONSHIPS.hasIssue);
  logger.debug('<< deleteIssueRelation()');
};

/**
 *Reads issue details
 *
 * @param {*} projectId
 * @param {*} organizationId
 * @param {*} input
 * @param {*} [txOrSession=null]
 * @returns
 */
const readIssues = async (projectId, organizationId, input, txOrSession = null) => {
  logger.debug('>> readIssues()');
  let query = null;
  const params = {
    type: input.type,
  };
  if (input.parentIssueId) {
    query = `MATCH (issue:${LABELS.issue}:\`prj_${projectId}\`:\`org_${organizationId}\` {issueId: $issueId}) 
                WITH issue MATCH (issue)-[:${RELATIONSHIPS.hasIssue}]->(i:${LABELS.issue}:\`prj_${projectId}\`:\`org_${organizationId}\`:\`${input.type}\`)
                RETURN i`;
    params.issueId = input.parentIssueId;
  }
  else {
    query = `MATCH (i:${LABELS.issue}:\`prj_${projectId}\`:\`org_${organizationId}\`:\`${input.type}\`)
                RETURN i`;
  }

  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('i').properties));
  logger.debug('<< readIssues()');
  return returnVal;
};

/**
 *Reads orphan issue details
 *
 * @param {*} projectId
 * @param {*} [txOrSession=null]
 * @returns
 */
const readOrphanIssues = async (projectId, input, txOrSession = null) => {
  logger.debug('>> readOrphanIssues()');
  let query = `MATCH (orphanIssueGroup:${LABELS.orphanIssueGroup}:\`prj_${projectId}\`) 
    WITH orphanIssueGroup MATCH (orphanIssueGroup)-[:${RELATIONSHIPS.hasIssue}]->(i:${LABELS.issue}:\`prj_${projectId}\`:\`${input.type}\`)
    RETURN i`;
  const params = {};
  if (input.parentIssueId) {
    query = `MATCH (orphanIssueGroup:${LABELS.orphanIssueGroup}:\`prj_${projectId}\`) 
        WITH orphanIssueGroup MATCH (orphanIssueGroup)-[:${RELATIONSHIPS.hasIssue}]->(issue:${LABELS.issue}:\`prj_${projectId}\` {issueId:$issueId})
        WITH issue MATCH (issue)-[:${RELATIONSHIPS.hasIssue}]->(i:${LABELS.issue}:\`prj_${projectId}\`:\`${input.type}\`)
        RETURN i`;
    params.issueId = input.parentIssueId;
  }
  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('i').properties));
  logger.debug('<< readOrphanIssues()');
  return returnVal;
};

/**
 *Delete issues of a particular type
 *
 * @param {*} tx
 * @param {*} projectId
 * @param {*} issueType
 */
const deleteIssues = async (tx, projectId, issueType) => {
  logger.debug('>> deleteIssues()');
  await executor.deleteNode(tx, [LABELS.issue, projectId, issueType], {});
  logger.debug('<< deleteIssues()');
};

/**
 *Reads parent issue details based on child issue id
 *
 * @param {*} projectId
 * @param {*} organizationId
 * @param {*} input
 * @param {*} [txOrSession=null]
 * @returns
 */
const readParentIssues = async (projectId, organizationId, input, txOrSession = null) => {
  logger.debug('>> readParentIssues()');
  let query = null;
  const params = {};
  query = `MATCH (issue:${LABELS.issue}:\`prj_${projectId}\`:\`org_${organizationId}\` {issueId: $issueId}) 
                WITH issue MATCH (i:${LABELS.issue}:\`prj_${projectId}\`:\`org_${organizationId}\`)-[:${RELATIONSHIPS.hasIssue}]->(issue)
                RETURN i`;
  params.issueId = input.parentIssueId;

  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('i').properties));
  logger.debug('<< readParentIssues()');
  return returnVal;
};

/**
 *Reads child issue details based on parent issue id
 *
 * @param {*} projectId
 * @param {*} organizationId
 * @param {*} input
 * @param {*} [txOrSession=null]
 * @returns
 */
const readChildIssues = async (projectId, organizationId, input, txOrSession = null) => {
  logger.debug('>> readChildIssues()');
  let query = null;
  const params = {};
  query = `MATCH (issue:${LABELS.issue}:\`prj_${projectId}\`:\`org_${organizationId}\` {issueId: $issueId}) 
                WITH issue MATCH (issue)-[:${RELATIONSHIPS.hasIssue}]->(i:${LABELS.issue}:\`prj_${projectId}\`:\`org_${organizationId}\`)
                RETURN i`;
  params.issueId = input.issueId;

  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('i').properties));
  logger.debug('<< readChildIssues()');
  return returnVal;
};

/**
 *Reads issue details based on rmt key
 *
 * @param {*} key
 * @param {*} projectId
 * @param {*} [txOrSession=null]
 * @returns Array
 */
const readByKey = async (key, projectId, txOrSession = null) => {
  logger.debug('>> readByKey()');
  let query = null;
  const params = {};
  query = `MATCH (issue:${LABELS.issue}:\`prj_${projectId}\` {key: $key}) RETURN issue`;
  params.key = key;

  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('issue').properties));
  logger.debug('<< readByKey()');
  return returnVal;
};

/**
 *Reads issue details based on rmt sourceID
 *
 * @param {*} sourceId
 * @param {*} projectId
 * @param {*} [txOrSession=null]
 * @returns Array
 */
const readByRMTSourceId = async (sourceId, projectId, txOrSession = null) => {
  logger.debug('>> readByRMTSourceId()');
  let query = null;
  const params = {};
  query = `MATCH (issue:${LABELS.issue}:\`prj_${projectId}\`) WHERE issue.sourceId=$sourceId RETURN issue`;
  params.sourceId = parseInt(sourceId.toString(), 10);

  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('issue').properties));
  logger.debug('<< readByRMTSourceId()');
  return returnVal;
};

/**
 *Check relation exist or not
 *
 * @param {*} sourceIssueId
 * @param {*} destinationIssueId
 * @param {*} [txOrSession=null]
 * @returns Array
 */
const isIssueRelationExists = async (sourceIssueId, destinationIssueId, projectId, txOrSession = null) => {
  logger.debug('>> isIssueRelationExists()');
  let query = null;
  const params = {};
  query = `MATCH (issue:${LABELS.issue}:\`prj_${projectId}\`{issueId:$sourceIssueId})-[r:${RELATIONSHIPS.hasIssue}]->(destinationIssue:${LABELS.issue}:\`prj_${projectId}\`{issueId:$destinationIssueId}) RETURN destinationIssue`;
  params.sourceIssueId = sourceIssueId;
  params.destinationIssueId = destinationIssueId;
  const result = await executor.read(query, params, txOrSession);
  let status = false;
  result.records.map((record) => {
    if (record.get('destinationIssue') && record.get('destinationIssue').properties) {
      status = true;
    }
  });
  logger.debug('<< isIssueRelationExists()');
  return status;
};

/**
 *Check issue has relation with orphan issue group
 *
 * @param {*} orphanIssueGroupId
 * @param {*} destinationIssueId
 * @param {*} [txOrSession=null]
 * @returns Boolean
 */
const isOrphanIssueGroupRelationExists = async (orphanIssueGroupId, destinationIssueId, projectId, txOrSession = null) => {
  logger.debug('>> isOrphanIssueGroupRelationExists()');
  let query = null;
  const params = {};
  query = `MATCH (oig:${LABELS.orphanIssueGroup}:\`prj_${projectId}\`{orphanIssueGroupId:$orphanIssueGroupId})-[r:${RELATIONSHIPS.hasIssue}]->(destinationIssue:${LABELS.issue}:\`prj_${projectId}\`{issueId:$destinationIssueId}) RETURN destinationIssue`;
  params.orphanIssueGroupId = orphanIssueGroupId;
  params.destinationIssueId = destinationIssueId;
  const result = await executor.read(query, params, txOrSession);
  let status = false;
  result.records.map((recordData) => {
    if (recordData.get('destinationIssue') && recordData.get('destinationIssue').properties) {
      status = true;
    }
  });
  logger.debug('<< isOrphanIssueGroupRelationExists()');
  return status;
};

/**
 * Updates the issue node properties.
 * @param {*} context
 * @param {*} issueProps
 * @param {*} updatedIssueProps
 */
const update = async (context, issueProps, updatedIssueProps) => {
  logger.debug('>> update()');
  let issueNode = null;
  try {
    issueNode = await executor.updateNode(context, [LABELS.issue, `prj_${context.projectId}`, `org_${context.organizationId}`], issueProps, updatedIssueProps);
  }
  catch (err) {
    logger.error(`\nMessage=> ${err} \nStack=> ${err.stack}`);
    throw err;
  }
  logger.debug('<< update()');
  return issueNode;
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  create,
  createChildIssueRelation,
  readIssues,
  readOrphanIssues,
  readParentIssues,
  readChildIssues,
  update,
  deleteStoryRelationship,
  deleteIssueRelation,
  deleteIssues,
  readByKey,
  readByRMTSourceId,
  isIssueRelationExists,
  isOrphanIssueGroupRelationExists,
};

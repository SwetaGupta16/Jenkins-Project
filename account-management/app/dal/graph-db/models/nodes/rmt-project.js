const executor = require('../../executor');
const utils = require('../../utils');
const errors = require('../../../../errors');
const rmtIssueTypeNode = require('./rmt-issue-type');
const { uuid } = require('../../../../utils');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  rmt: 'RMT',
  rmtProject: 'RMTProject',
  project: 'Project',
  configuration: 'Configuration',
};

const RELATIONSHIPS = {
  hasIssueType: 'HAS_ISSUE_TYPE',
  hasRMTProject: 'HAS_RMT_PROJECT',
  hasConfiguration: 'HAS_CONFIGURATION',
  hasRMTConfiguration: 'HAS_RMT_CONFIGURATION',
};

const validateCreateRMTProjectInput = async (rmtProject) => {
  logger.debug('>> validateCreateRMTProjectInput()');
  if (!rmtProject.name) {
    const errMsg = 'Project name is mandatory.';
    logger.error(errMsg);
    throw errors.Mandatory('RMT_PROJECT_NAME', errMsg);
  }
  logger.debug('<< validateCreateRMTProjectInput()');
};

/**
 *Creates a new rmt project node
 *
 * @param {*} context
 * @param {*} user
 * @returns {*} Newly created rmt project node.
 */
const create = async (context, input) => {
  logger.debug('>> create()');
  const rmtProjectProps = input.rmtProject;
  await validateCreateRMTProjectInput(rmtProjectProps);
  rmtProjectProps.rmtProjectId = uuid.uuidWithoutHyphens();
  let rmtProjectNode = null;
  try {
    rmtProjectNode = await executor.createNode(context, [LABELS.rmtProject], rmtProjectProps);
  }
  catch (err) {
    if (err.code === 'Neo.ClientError.Schema.ConstraintValidationFailed' && err.message.includes('already exists with label')) {
      const errMsg = `Project for the current rmt with name ${rmtProjectProps.name} already exists.\nMessage=> ${err} \nStack=> ${err.stack}`;
      logger.error(errMsg);
      throw errors.AlreadyExists('RMT_PROJECT', errMsg);
    }
    throw err;
  }

  rmtProjectNode = utils.simplifyIntegerTypes(rmtProjectNode);
  logger.debug('<< create()');
  return rmtProjectNode;
};

/**
 *Creates HAS_ISSUE_TYPE relationship from rmtProject to rmtIssueType.
 *
 * @param {*} context
 * @param {*} rmtProjectProps
 * @param {*} rmtIssueTypeProps
 * @param {*} relationshipProps
 * @returns {*} {
            rmtProject,
            rmtIssueType,
            relationship
        }
 */
const createRMTProjectIssueTypeRelation = async (context, rmtProjectProps, rmtIssueTypeProps, relationshipProps = {}) => {
  logger.debug('>> createRMTProjectIssueTypeRelation()');
  const rmtProject = { labels: [LABELS.rmtProject], properties: { rmtProjectId: rmtProjectProps.rmtProjectId } };
  const rmtIssueType = { labels: [rmtIssueTypeNode.LABELS.rmtIssueType], properties: { rmtIssueTypeId: rmtIssueTypeProps.rmtIssueTypeId } };
  const result = await executor.createOrUpdateRelationship(context, rmtProject, rmtIssueType, RELATIONSHIPS.hasIssueType, relationshipProps);
  const returnValue = {
    rmtProject: result.source,
    rmtIssueType: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createRMTProjectIssueTypeRelation()');
  return returnValue;
};

/**
 *Reads the rmt project details based on its name within rmt.
 *
 * @param {*} rmtProjectName
 * @param {*} rmtId
 * @param {*} [txOrSession=null]
 * @returns {*} Project details
 */
const readProjectByNameFromRMT = async (rmtProjectName, rmtId, txOrSession = null) => {
  logger.debug('>> readProjectByNameFromRMT()');
  const query = `MATCH (rmt:${LABELS.rmt} {rmtId: $rmtId})
    -[p:${RELATIONSHIPS.hasRMTProject}]->
    (rmtProject:${LABELS.rmtProject})
     WHERE toLower(toString(rmtProject.name)) = toLower(toString($rmtProjectName))
     RETURN rmtProject`;
  const params = {
    rmtId,
    rmtProjectName,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnValue = result.records.map((record) => utils.simplifyIntegerTypes(record.get('rmtProject').properties));
  logger.debug('<< readProjectByNameFromRMT()');
  return returnValue;
};

/**
 *Reads rmt project details based on it's id
 *
 * @param {*} rmtProjectId
 * @param {*} rmtId
 * @param {*} [txOrSession=null]
 * @returns
 */
const readByRMTProjectId = async (rmtProjectId, rmtId, txOrSession = null) => {
  logger.debug('>> readByRMTProjectId()');
  const query = `MATCH (rmt:${LABELS.rmt} {rmtId: $rmtId})
    -[p:${RELATIONSHIPS.hasRMTProject}]->
    (rmtProject:${LABELS.rmtProject} {rmtProjectId: $rmtProjectId}) return rmtProject`;
  const params = {
    rmtProjectId,
    rmtId,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = `RMT Project with id '${rmtProjectId}' not found.`;
    logger.error(errMsg);
    throw errors.NotFound('RMT_PROJECT', errMsg);
  }
  const returnValue = utils.simplifyIntegerTypes(result.records[0].get('rmtProject').properties);
  logger.debug('<< readByRMTProjectId()');
  return returnValue;
};

/**
 *Reads rmt project details based on delete subscriber Id
 *
 * @param {*} deleteSubscriberId
 * @param {*} [txOrSession=null]
 * @returns
 */
const readProjectAndRMTProjectByDeleteSubscriberId = async (deleteSubscriberId, txOrSession = null) => {
  logger.debug('>> readProjectAndRMTProjectByDeleteSubscriberId()');
  const query = ` MATCH (rmtProject:${LABELS.rmtProject} {deleteSubscriberId: $deleteSubscriberId}) WITH rmtProject
    MATCH (project:${LABELS.project})
    -[:${RELATIONSHIPS.hasConfiguration}]->(:${LABELS.configuration})
    -[:${RELATIONSHIPS.hasRMTConfiguration}]->(:${LABELS.rmt})
    -[:${RELATIONSHIPS.hasRMTProject}]->(rmtProject)
    RETURN  project,rmtProject`;
  const params = {
    deleteSubscriberId,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = `RMT Project with delete Subscriber id '${deleteSubscriberId}' not found.`;
    logger.error(errMsg);
    throw errors.NotFound('RMT_PROJECT', errMsg);
  }
  const rmtProject = utils.simplifyIntegerTypes(result.records[0].get('rmtProject').properties);
  const project = utils.simplifyIntegerTypes(result.records[0].get('project').properties);

  logger.debug('<< readProjectAndRMTProjectByDeleteSubscriberId()');
  return { rmtProject, project };
};

/**
 *Reads rmt project details based on update subscriber Id
 *
 * @param {*} updateSubscriberId
 * @param {*} [txOrSession=null]
 * @returns
 */
const readProjectAndRMTProjectByUpdateSubscriberId = async (updateSubscriberId, txOrSession = null) => {
  logger.debug('>> readProjectAndRMTProjectByUpdateSubscriberId()');
  const query = ` MATCH (rmtProject:${LABELS.rmtProject} {updateSubscriberId: $updateSubscriberId}) WITH rmtProject
    MATCH (project:${LABELS.project})
    -[:${RELATIONSHIPS.hasConfiguration}]->(:${LABELS.configuration})
    -[:${RELATIONSHIPS.hasRMTConfiguration}]->(:${LABELS.rmt})
    -[:${RELATIONSHIPS.hasRMTProject}]->(rmtProject)
    RETURN  project,rmtProject`;
  const params = {
    updateSubscriberId,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = `RMT Project with update Subscriber id '${updateSubscriberId}' not found.`;
    logger.error(errMsg);
    throw errors.NotFound('RMT_PROJECT', errMsg);
  }
  const rmtProject = utils.simplifyIntegerTypes(result.records[0].get('rmtProject').properties);
  const project = utils.simplifyIntegerTypes(result.records[0].get('project').properties);
  logger.debug('<< readProjectAndRMTProjectByUpdateSubscriberId()');
  return { rmtProject, project };
};

/**
 *Reads rmt project details based on rmt id
 *
 * @param {*} rmtId
 * @param {*} [txOrSession=null]
 * @returns
 */
const readByRMTId = async (rmtId, txOrSession = null) => {
  logger.debug('>> readByRMTId()');
  const query = `MATCH (rmt:${LABELS.rmt} {rmtId: $rmtId})
    -[p:${RELATIONSHIPS.hasRMTProject}]->
    (rmtProject:${LABELS.rmtProject}) return rmtProject`;
  const params = {
    rmtId,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = 'RMT Project not associated with rmt.';
    logger.error(errMsg);
    throw errors.NotFound('RMT_PROJECT', errMsg);
  }
  const returnVal = utils.simplifyIntegerTypes(result.records[0].get('rmtProject').properties);
  logger.debug('<< readByRMTId()');
  return returnVal;
};

/**
 *Checks if rmtProject exist or not based on rmtProjectId input parameter
 *
 * @param {*} input
 * @param {*} [txOrSession=null]
 * @returns {*} Boolean
 */
const exists = async (input, txOrSession = null) => {
  logger.debug('>> exists()');
  let returnValue = false;

  if (!input.rmtId) {
    return returnValue;
  }
  try {
    await readByRMTId(input.rmtId, txOrSession);
    returnValue = true;
  }
  catch (err) {}
  logger.debug('<< exists()');
  return returnValue;
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  create,
  createRMTProjectIssueTypeRelation,
  readProjectByNameFromRMT,
  readByRMTProjectId,
  readByRMTId,
  readProjectAndRMTProjectByDeleteSubscriberId,
  readProjectAndRMTProjectByUpdateSubscriberId,
  exists,
};

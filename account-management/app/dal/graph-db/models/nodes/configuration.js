const executor = require('../../executor');
const utils = require('../../utils');
const { uuid } = require('../../../../utils');
const rmtNode = require('./rmt');
const severityNode = require('./severity');
const priorityNode = require('./priority');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  configuration: 'Configuration',
  project: 'Project',
  severities: 'Severities',
  priorities: 'Priorities',
};

const RELATIONSHIPS = {
  hasConfiguration: 'HAS_CONFIGURATION',
  hasRMTConfiguration: 'HAS_RMT_CONFIGURATION',
  hasSeverities: 'HAS_SEVERITIES',
  hasPriorities: 'HAS_PRIORITIES',
};

const rmtLabels = rmtNode.LABELS;

/**
 *
 * @param {*} context
 * @param {*} configuration
 */
const createCollectionNodes = async (context, configuration) => {
  logger.debug('>> createCollectionNodes()');
  // create severity collection
  const severityCollection = await executor.createNode(context, [LABELS.severities], { severitiesId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, configuration, severityCollection, RELATIONSHIPS.hasSeverities, {});
  await severityNode.createSeverityNodes(context, severityCollection);

  // create priority collection
  const priorityCollection = await executor.createNode(context, [LABELS.priorities], { prioritiesId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, configuration, priorityCollection, RELATIONSHIPS.hasPriorities, {});
  await priorityNode.createPriorityNodes(context, priorityCollection);

  logger.debug('<< createCollectionNodes()');
};

/**
 *Creates a new configuration node
 *
 * @param {*} context
 * @returns {*} Newly created configuration node.
 */
const create = async (context) => {
  logger.debug('>> create()');
  const configurationId = uuid.uuidWithoutHyphens();
  const result = await executor.createNode(context, [LABELS.configuration], { configurationId });
  await createCollectionNodes(context, result);
  logger.debug('<< create()');
  return result;
};

/**
 *Creates HAS_RMT_CONFIGURATION relationship from configuration to rmt node.
 *
 * @param {*} tx
 * @param {*} configurationProps
 * @param {*} rmtProps
 * @param {*} relationshipProps
 * @returns {*} {
            project,
            configuration,
            relationship
        }
 */
const createRMTConfigurationRelation = async (tx, configurationProps, rmtProps, relationshipProps = {}) => {
  logger.debug('>> createRMTConfigurationRelation()');
  const configuration = { labels: [LABELS.configuration], properties: { configurationId: configurationProps.configurationId } };
  const rmt = { labels: [rmtLabels.rmt], properties: { rmtId: rmtProps.rmtId } };

  const result = await executor.createOrUpdateRelationship(tx, configuration, rmt, RELATIONSHIPS.hasRMTConfiguration, relationshipProps);
  const returnValue = {
    configuration: result.source,
    rmt: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createRMTConfigurationRelation()');
  return returnValue;
};

/**
 *Reads the configuration details by projectId.
 *
 * @returns {*} Configuration
 */
const readConfigurationByProjectId = async (projectId, txOrSession = null) => {
  logger.debug('>> readConfigurationByProjectId()');
  const query = `MATCH (project:${LABELS.project} {projectId: $projectId})-
    [:${RELATIONSHIPS.hasConfiguration}]->(config:${LABELS.configuration})  
     RETURN config`;
  const params = {
    projectId,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('config').properties));
  logger.debug('<< readConfigurationByProjectId()');
  return returnVal;
};

/**
 *Deletes HAS_RMT_CONFIGURATION relationship from configuration to rmt node.
 *
 * @param {*} tx
 * @param {*} configurationProps
 * @param {*} rmtProps
 */
const deleteConfigurationRMTRelationship = async (tx, configurationProps, rmtProps) => {
  logger.debug('>> deleteConfigurationRMTRelationship()');
  const configuration = { labels: [LABELS.configuration], properties: configurationProps };
  const rmt = { labels: [rmtLabels.rmt], properties: rmtProps };
  await executor.deleteRelationship(tx, configuration, rmt, RELATIONSHIPS.hasRMTConfiguration);
  logger.debug('<< deleteConfigurationRMTRelationship()');
};

/**
 *Delete a configuration node
 *
 * @param {*} configurationId
 * @param {*} tx
 */
const deleteByConfigurationId = async (configurationId, tx = null) => {
  logger.debug('>> deleteByConfigurationId()');
  await executor.deleteNode(tx, [LABELS.configuration], { configurationId });
  logger.debug('<< deleteByConfigurationId()');
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  create,
  createRMTConfigurationRelation,
  readConfigurationByProjectId,
  deleteConfigurationRMTRelationship,
  deleteByConfigurationId,
};

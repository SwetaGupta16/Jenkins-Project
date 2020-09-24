const executor = require('../../executor');
const errors = require('../../../../errors');
const { uuid } = require('../../../../utils');
const projectNode = require('./project');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

/* Neo4j labels */
const LABELS = {
  project: 'Project',
  configuration: 'Configuration',
  severities: 'Severities',
  severityNode: 'Severity',
};

/* Neo4j relationships */
const RELATIONSHIPS = {
  hasSeverity: 'HAS_SEVERITY',
  hasSeverities: 'HAS_SEVERITIES',
  hasConfiguration: 'HAS_CONFIGURATION',
};

/* Values for Severity Node */
const severityData = [
  { name: 'S1', value: 'Critical' },
  { name: 'S2', value: 'High' },
  { name: 'S3', value: 'Medium' },
  { name: 'S4', value: 'Low' },
];

/**
 * Creates severity nodes under SeverityCollection node
 * @param {*} context
 * @param {*} severityCollection
 */

const createSeverityNodes = async (context, severityCollection) => {
  logger.debug('>> createSeverityNodes()');
  for (let index = 0; index < severityData.length; index++) {
    const severityProps = {
      severityId: uuid.uuidWithoutHyphens(),
      name: severityData[index].name,
      value: severityData[index].value,
    };

    const severityNode = await executor.createNode(context, [LABELS.severityNode], severityProps);
    await executor.createRelationship(context, severityCollection, severityNode, RELATIONSHIPS.hasSeverity, {});
  }
  logger.debug('<< createSeverityNodes()');
};

const readSeverityNodesByProjectId = async (projectId, context) => {
  logger.debug('>> readSeverityNodesByProjectId()');
  const query = `MATCH (prj : ${LABELS.project} {projectId : $projectId})
    -[r1:${RELATIONSHIPS.hasConfiguration}]->(conf : ${LABELS.configuration}) WITH conf
    MATCH (conf)-[r2:${RELATIONSHIPS.hasSeverities}]->(severities : ${LABELS.severities}) WITH severities
    MATCH (severities)-[r3:${RELATIONSHIPS.hasSeverity}]->(severity : ${LABELS.severityNode}) WITH collect({severity : severity{.*}})
     as severityCollection RETURN severityCollection
    `;

  const params = {
    projectId,
  };

  const result = await executor.read(query, params, context.tx);
  const severityCollection = result.records[0].get('severityCollection');
  const severityMap = new Map();
  if (severityCollection && severityCollection.length > 0) {
    for (let index = 0; index < severityCollection.length; index++) {
      severityMap.set(severityCollection[index].severity.severityId, severityCollection[index].severity);
    }
  }
  else {
    const project = await projectNode.readById(projectId, context.organizationId);
    if (!project) {
      const errMsg = `Project with id '${projectId}' not found.`;
      logger.error(errMsg);
      throw errors.NotFound('PROJECT', errMsg);
    }
  }
  logger.debug('<< readSeverityNodesByProjectId()');
  return severityMap;
};

const updateSeverity = async (context, severityId, severityProps) => {
  logger.debug('>> updateSeverity()');
  const returnVal = await executor.updateNode(context, [LABELS.severityNode], { severityId }, severityProps);
  logger.debug('<< updateSeverity()');
  return returnVal;
};

module.exports = {
  createSeverityNodes,
  readSeverityNodesByProjectId,
  updateSeverity,
};

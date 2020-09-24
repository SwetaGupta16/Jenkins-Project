const executor = require('../../executor');
const errors = require('../../../../errors');
const { uuid } = require('../../../../utils');
const projectNode = require('./project');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

/* Neo4j labels */
const LABELS = {
  priorityNode: 'Priority',
  priorities: 'Priorities',
  project: 'Project',
  configuration: 'Configuration',
};

/* Neo4j relationships */
const RELATIONSHIPS = {
  hasPriority: 'HAS_PRIORITY',
  hasPriorities: 'HAS_PRIORITIES',
  hasConfiguration: 'HAS_CONFIGURATION',
};

/* Values for Priority Node */
const priorityData = [
  { name: 'P1', value: 'Highest' },
  { name: 'P2', value: 'High' },
  { name: 'P3', value: 'Medium' },
  { name: 'P4', value: 'Low' },
];

/**
 * Create priority nodes under Priority Collection node
 * @param {*} context
 * @param {*} priorityCollection
 */

const createPriorityNodes = async (context, priorityCollection) => {
  logger.debug('>> createPriorityNodes()');
  for (let index = 0; index < priorityData.length; index++) {
    const priorityProps = {
      priorityId: uuid.uuidWithoutHyphens(),
      name: priorityData[index].name,
      value: priorityData[index].value,
    };

    const priorityNode = await executor.createNode(context, [LABELS.priorityNode], priorityProps);
    await executor.createRelationship(context, priorityCollection, priorityNode, RELATIONSHIPS.hasPriority, {});
  }
  logger.debug('<< createPriorityNodes()');
};
const readPriorityNodesByProjectId = async (projectId, context) => {
  logger.debug('>> readPriorityNodesByProjectId()');
  const query = `MATCH (prj : ${LABELS.project} {projectId : $projectId})
    -[r1:${RELATIONSHIPS.hasConfiguration}]->(conf : ${LABELS.configuration}) WITH conf
    MATCH (conf)-[r2:${RELATIONSHIPS.hasPriorities}]->(priorities : ${LABELS.priorities}) WITH priorities
    MATCH (priorities)-[r3:${RELATIONSHIPS.hasPriority}]->(priority : ${LABELS.priorityNode}) WITH collect({priority : priority{.*}}) 
    as priorityCollection RETURN priorityCollection`;

  const params = {
    projectId,
  };

  const result = await executor.read(query, params, context.tx);

  const priorityCollection = result.records[0].get('priorityCollection');
  const priorityMap = new Map();
  if (priorityCollection && priorityCollection.length > 0) {
    for (let index = 0; index < priorityCollection.length; index++) {
      priorityMap.set(priorityCollection[index].priority.priorityId, priorityCollection[index].priority);
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
  logger.debug('<< readPriorityNodesByProjectId()');
  return priorityMap;
};

const updatePriority = async (context, priorityId, priorityProps) => {
  logger.debug('>> updatePriority()');
  const returnVal = await executor.updateNode(context, [LABELS.priorityNode], { priorityId }, priorityProps);
  logger.debug('<< updatePriority()');
  return returnVal;
};
module.exports = {
  createPriorityNodes,
  readPriorityNodesByProjectId,
  updatePriority,
};

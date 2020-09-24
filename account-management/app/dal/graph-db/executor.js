const logManager = require('../../../log-manager');
const driverManager = require('./driver-manager');
const errors = require('../../errors');
const utils = require('./utils');
const generalUtils = require('../../utils');

const logger = logManager.logger(__filename);
const ERR_MESSAGES = {
  nodeCreationFailure: 'Failed to create a new node.',
  relationshipCreationFailure: 'Failed to create a relationship between two nodes.',
  relationshipRemovalFailure: 'Failed to remove a relationship between two nodes.',
  dataReadingFailure: 'Failed to read data from database.',
  nodeDeletionFailure: 'Failed to delete a node.',
  nodeUpdationFailure: 'Failed to update a node.',
};

const { dateTime } = generalUtils;

const { convertIntoCypherLabels } = utils;
const { convertIntoCypherProps } = utils;
const { convertIntoCypherParams } = utils;
const { convertIntoCypherSet } = utils;

const LABELS = {
  user: 'User',
};

const RELATIONSHIPS = {
  createdBy: 'CREATED_BY',
  updatedBy: 'UPDATED_BY',
};

const runRelationshipQuery = async (tx, query, params) => {
  logger.debug('>> runRelationshipQuery()');
  let result = null;
  try {
    result = await tx.run(query, params);
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.relationshipCreationFailure}\nCode=> ${err.code}\nMessage=> ${err}\nStack=> ${err.stack}`);
    throw err;
  }

  if (!result || result.records.length <= 0) {
    const errMsg = `${ERR_MESSAGES.relationshipCreationFailure}`;
    logger.error(errMsg);
    throw errors.CreationFailed('RELATIONSHIP', errMsg);
  }

  const returnValue = {
    source: result.records[0].get('s'),
    destination: result.records[0].get('d'),
    relationship: result.records[0].get('r'),
  };
  logger.debug('<< runRelationshipQuery()');
  return returnValue;
};

/**
 *Creates a new relationship between source and destination nodes in a direction from source to destination.
 *While doing so it prefixes neo4j param names with _s, _d, _r for sourceProps, destinationProps, relationshipProps respectively.
 *This approach is useful where your source and destination have same property names.
 *
 * @param {*} context
 * @param {*} source
 * @param {*} destination
 * @param {*} relationship
 * @param {*} [relationshipProps={}]
 * @returns {*} {
        source: sourceNode,
        destination: destinationNode,
        relationship: relationship
    }
 */
const createRelationship = async (context, source, destination, relationship, relationshipProps = {}) => {
  logger.debug('>> createRelationship()');
  relationshipProps.createdAt = relationshipProps.updatedAt = dateTime.current();
  relationshipProps.createdBy = relationshipProps.updatedBy = context.userId;

  const query = `MATCH (s${convertIntoCypherLabels(source.labels)} {${convertIntoCypherProps(source.properties, 's_')}})
    WITH s
    MATCH (d${convertIntoCypherLabels(destination.labels)} {${convertIntoCypherProps(destination.properties, 'd_')}})
    CREATE (s)-[r:${relationship} {${convertIntoCypherProps(relationshipProps, 'r_')}}]->(d)
    RETURN s,d,r`;

  const sourceParams = convertIntoCypherParams({ ...source.properties }, 's_');
  const destinationParams = convertIntoCypherParams({ ...destination.properties }, 'd_');
  const relationshipParams = convertIntoCypherParams({ ...relationshipProps }, 'r_');
  const params = { ...sourceParams, ...destinationParams, ...relationshipParams };

  const result = await runRelationshipQuery(context.tx, query, params);
  logger.debug('<< createRelationship()');
  return result;
};

const prepareCreatorNode = (context) => ({
  labels: [LABELS.user],
  properties: {
    userId: context.userId,
  },
});

const createdByRelationship = async (context, createdNode, relationshipProps = {}) => {
  logger.debug('>> createdByRelationship()');
  const creator = prepareCreatorNode(context);
  await createRelationship(context, createdNode, creator, RELATIONSHIPS.createdBy, relationshipProps);
  logger.debug('<< createdByRelationship()');
};

/**
 *Removes relationship between source and destination nodes.
 *
 * @param {*} tx
 * @param {*} source
 * @param {*} destination
 * @param {*} relationship
 */
const deleteRelationship = async (tx, source, destination, relationship) => {
  logger.debug('>> deleteRelationship()');
  try {
    const query = `MATCH(s${convertIntoCypherLabels(source.labels)} {${convertIntoCypherProps(source.properties, 's_')}})
        -[r:${relationship} ]->
        (d${convertIntoCypherLabels(destination.labels)} {${convertIntoCypherProps(destination.properties, 'd_')}})
        DELETE r`;

    const sourceParams = convertIntoCypherParams({ ...source.properties }, 's_');
    const destinationParams = convertIntoCypherParams({ ...destination.properties }, 'd_');
    const params = { ...sourceParams, ...destinationParams };

    await tx.run(query, params);
    logger.debug('<< deleteRelationship()');
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.relationshipRemovalFailure}\nCode=> ${err.code}\nMessage=> ${err}\nStack=> ${err.stack}`);
    throw err;
  }
};

const updatedByRelationship = async (context, updatedNode, relationshipProps = {}) => {
  logger.debug('>> updatedByRelationship()');
  await deleteRelationship(context.tx, updatedNode, { labels: [LABELS.user] }, RELATIONSHIPS.updatedBy);
  const updater = prepareCreatorNode(context);
  await createRelationship(context, updatedNode, updater, RELATIONSHIPS.updatedBy, relationshipProps);
  logger.debug('<< updatedByRelationship()');
};

/**
 *Creates a new node with provided labels and properties.
 *
 * @param {*} context
 * @param {*} labels
 * @param {*} properties
 * @returns {*} Newly created node
 */
const createNode = async (context, labels, properties) => {
  logger.debug('>> createNode()');
  try {
    properties.createdAt = properties.updatedAt = dateTime.current();
    const orgLabel = `org_${context.organizationId}`;

    const query = `CREATE (n${convertIntoCypherLabels([...labels, orgLabel])} {${convertIntoCypherProps(properties)}}) RETURN n`;
    const params = convertIntoCypherParams(properties);
    const result = await context.tx.run(query, params);

    if (!result || result.records.length <= 0) {
      const errMsg = `${ERR_MESSAGES.nodeCreationFailure}`;
      logger.error(errMsg);
      throw errors.CreationFailed('NODE', errMsg);
    }

    const createdNode = result.records[0].get('n');
    await createdByRelationship(context, createdNode);
    await updatedByRelationship(context, createdNode);
    logger.debug('<< createNode()');
    return createdNode;
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.nodeCreationFailure}\nCode=> ${err.code}\nMessage=> ${err}\nStack=> ${err.stack}`);
    throw err;
  }
};

/**
 *Runs a cypher query with provided params.
 *If already opened session or transaction is passed that is used to run the query. Otherwise new read session is created to run the query.
 *
 * @param {*} query
 * @param {*} params
 * @param {*} [txOrSession=null]
 * @returns {*} A stream of Record representing the result of a query execution.
 */
const read = async (query, params, txOrSession = null) => {
  logger.debug('>> read()');
  let returnValue;

  if (txOrSession) {
    try {
      returnValue = await txOrSession.run(query, params);
    }
    catch (err) {
      logger.error(`${ERR_MESSAGES.dataReadingFailure}\nCode=> ${err.code}\nMessage=> ${err}\nStack=> ${err.stack}`);
      throw err;
    }
  }
  else {
    let session = null;
    try {
      session = driverManager.getReadSession();
      returnValue = await session.run(query, params);
    }
    catch (err) {
      logger.error(`${ERR_MESSAGES.dataReadingFailure}\nCode=> ${err.code}\nMessage=> ${err}\nStack=> ${err.stack}`);
      throw err;
    }
    finally {
      driverManager.closeSession(session);
    }
  }
  logger.debug('<< read()');
  return returnValue;
};

/**
 *Creates a new relationship between two nodes if that relationship does not exist already.
 *Otherwise updates existing one.
 *
 * @param {*} context
 * @param {*} source
 * @param {*} destination
 * @param {*} relationship
 * @param {*} [relationshipProps=null]
 * @returns {*}  {
            source,
            destination,
            relationship
        }
 */
const createOrUpdateRelationship = async (context, source, destination, relationship, relationshipProps = {}) => {
  logger.debug('>> createOrUpdateRelationship()');
  relationshipProps.updatedAt = dateTime.current();
  relationshipProps.updatedBy = context.userId;

  const readQuery = `MATCH (s${convertIntoCypherLabels(source.labels)} {${convertIntoCypherProps(source.properties, 's_')}})
    WITH s
    MATCH (s)-[r:${relationship}]-> (d${convertIntoCypherLabels(destination.labels)} {${convertIntoCypherProps(destination.properties, 'd_')}})
    RETURN s,d,r`;

  let sourceParams = convertIntoCypherParams({ ...source.properties }, 's_');
  let destinationParams = convertIntoCypherParams({ ...destination.properties }, 'd_');
  let params = { ...sourceParams, ...destinationParams };

  const readResult = await read(readQuery, params);

  let writeQuery;
  if (readResult.records.length <= 0) {
    relationshipProps.createdAt = relationshipProps.updatedAt;
    relationshipProps.createdBy = relationshipProps.updatedBy;
    writeQuery = `MATCH (s${convertIntoCypherLabels(source.labels)} {${convertIntoCypherProps(source.properties, 's_')}})
    WITH s
    MATCH (d${convertIntoCypherLabels(destination.labels)} {${convertIntoCypherProps(destination.properties, 'd_')}})
    CREATE (s)-[r:${relationship}]->(d)
    SET ${convertIntoCypherSet(relationshipProps, 'r')}
    RETURN s,d,r `;
  }
  else {
    writeQuery = `MATCH (s${convertIntoCypherLabels(source.labels)} {${convertIntoCypherProps(source.properties, 's_')}})
    WITH s
    MATCH (d${convertIntoCypherLabels(destination.labels)} {${convertIntoCypherProps(destination.properties, 'd_')}})
    MERGE (s)-[r:${relationship}]->(d)
    SET ${convertIntoCypherSet(relationshipProps, 'r')}
    RETURN s,d,r `;
  }

  sourceParams = convertIntoCypherParams({ ...source.properties }, 's_');
  destinationParams = convertIntoCypherParams({ ...destination.properties }, 'd_');
  params = { ...sourceParams, ...destinationParams, ...relationshipProps };

  const returnValue = await runRelationshipQuery(context.tx, writeQuery, params);
  logger.debug('<< createOrUpdateRelationship()');
  return returnValue;
};

/**
 *Deletes node based on provided labels and properties. This also deletes any relationships attached to it.
 *
 * @param {*} tx
 * @param {*} labels
 * @param {*} properties
 */
const deleteNode = async (tx, labels, properties) => {
  logger.debug('>> deleteNode()');
  try {
    const query = `MATCH (n${convertIntoCypherLabels(labels)} {${convertIntoCypherProps(properties)}}) DETACH DELETE n RETURN n`;
    const params = convertIntoCypherParams(properties);
    const result = await tx.run(query, params);

    if (result.records.length <= 0) {
      const errorMessage = `Failed to delete node with Labels: ${labels} and Properties: ${JSON.stringify(properties)}`;
      logger.error(errorMessage);
      throw errors.DBQueryFailed('DB', errorMessage);
    }
    logger.debug('<< deleteNode()');
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.nodeDeletionFailure}\nCode=> ${err.code}\nMessage=> ${err}\nStack=> ${err.stack}`);
    throw err;
  }
};

/**
 *Updates a node with provided labels, properties and set properties.
 *
 * @param {*} context
 * @param {*} labels
 * @param {*} properties
 * @param {*} setProperties
 */
const updateNode = async (context, labels, properties, setProperties) => {
  logger.debug('>> updateNode()');
  let result = null;
  try {
    setProperties.updatedAt = dateTime.current();

    const query = `MATCH (n${convertIntoCypherLabels(labels)} {${convertIntoCypherProps(properties, 'n_')}})
        SET ${convertIntoCypherSet(setProperties, 'n')} RETURN n`;

    const nodeParams = convertIntoCypherParams({ ...properties }, 'n_');
    const setParams = convertIntoCypherParams({ ...setProperties }, 's_');
    const params = { ...nodeParams, ...setParams };

    result = await context.tx.run(query, params);
    if (!result || result.records.length <= 0) {
      const errMsg = `${ERR_MESSAGES.nodeUpdationFailure}`;
      logger.error(errMsg);
      throw errors.UpdationFailed('NODE', errMsg);
    }
    const returnValue = result.records[0].get('n');

    await updatedByRelationship(context, returnValue);
    logger.debug('<< updateNode()');
    return returnValue;
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.nodeUpdationFailure}\nCode=> ${err.code}\nMessage=> ${err}\nStack=> ${err.stack}`);
    throw err;
  }
};

module.exports = {
  createNode,
  createRelationship,
  createOrUpdateRelationship,
  createdByRelationship,
  updatedByRelationship,
  read,
  updateNode,
  deleteNode,
  deleteRelationship,
};

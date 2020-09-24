const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);
let objectTypeMap;
const LABELS = {
  objectType: 'ObjectType',
};

const RELATIONSHIPS = {
  hasObjectType: 'HAS_OBJECT_TYPE',
  hasDeviceType: 'HAS_DEVICE_TYPE',
};

const PROPERTIES = {
  mobile: 'Mobile',
  web: 'Web',
  android: 'Android',
  iOS: 'iOS',
};

const createObjectType = async (context, objectTypes) => {
  logger.debug('>> createObjectType()');

  // create Web node
  const webNode = await executor.createNode(context, [LABELS.objectType, context.projectId], { objectTypeId: uuid.uuidWithoutHyphens(), name: PROPERTIES.web });
  await executor.createRelationship(context, objectTypes, webNode, RELATIONSHIPS.hasObjectType, {});

  // create Mobile node
  const mobileNode = await executor.createNode(context, [LABELS.objectType, context.projectId], { objectTypeId: uuid.uuidWithoutHyphens(), name: PROPERTIES.mobile });
  await executor.createRelationship(context, objectTypes, mobileNode, RELATIONSHIPS.hasObjectType, {});

  // create ios node
  const iosNode = await executor.createNode(context, [LABELS.objectType, context.projectId], { objectTypeId: uuid.uuidWithoutHyphens(), name: PROPERTIES.iOS });
  await executor.createRelationship(context, mobileNode, iosNode, RELATIONSHIPS.hasDeviceType, {});

  // create android node
  const androidNode = await executor.createNode(context, [LABELS.objectType, context.projectId], { objectTypeId: uuid.uuidWithoutHyphens(), name: PROPERTIES.android });
  await executor.createRelationship(context, mobileNode, androidNode, RELATIONSHIPS.hasDeviceType, {});

  objectTypeMap = new Map();
  objectTypeMap.set('web', webNode);
  objectTypeMap.set('mobile', mobileNode);
  objectTypeMap.set('ios', iosNode);
  objectTypeMap.set('android', androidNode);
  logger.debug('<< createObjectType()');
};

const getObjectTypeMap = function () {
  return objectTypeMap;
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  createObjectType,
  getObjectTypeMap,
};

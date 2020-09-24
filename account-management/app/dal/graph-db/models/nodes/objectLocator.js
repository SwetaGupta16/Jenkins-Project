const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const objectType = require('./objectType');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  objectLocatorType: 'ObjectLocatorType',
};

const RELATIONSHIPS = {
  hasObjectLocatorType: 'HAS_OBJECT_LOCATOR_TYPE',
};

const objectLocatorDataWeb = ['ID', 'NAME', 'CSS', 'LINK', 'XPATH', 'TITLE'];

const objectLocatorDataMobile = ['ACCESSIBILITY ID', 'CLASS', 'ID', 'XPATH'];

const DEVICE_TYPES = ['iOS', 'Android'];

const DEVICE_TYPES_PROPERTIES = {
  ios: 'iOS',
  android: 'Android',
};

const createObjectLocatorWeb = async (context, objectLocators) => {
  logger.debug('>> createObjectLocatorWeb()');
  const result = await objectType.getObjectTypeMap();
  const web = result.get('web');

  // needs to be improved
  for (let index = 0; index < objectLocatorDataWeb.length; index++) {
    const objectLocatorProps = { objectLocatorTypeId: uuid.uuidWithoutHyphens(), name: objectLocatorDataWeb[index], displayName: objectLocatorDataWeb[index], type: 'Desktop' };

    const objectLocatorNode = await executor.createNode(context, [LABELS.objectLocatorType, context.projectId], objectLocatorProps);
    await executor.createRelationship(context, objectLocators, objectLocatorNode, RELATIONSHIPS.hasObjectLocatorType, {});
    await executor.createRelationship(context, web, objectLocatorNode, RELATIONSHIPS.hasObjectLocatorType, {});
  }
  logger.debug('<< createObjectLocatorWeb()');
};

const createObjectLocatorMobile = async (context, objectLocators) => {
  logger.debug('>> createObjectLocatorMobile()');
  const result = await objectType.getObjectTypeMap();
  const mobile = result.get('mobile');
  const ios = result.get('ios');
  const android = result.get('android');
  // needs to be improved
  for (let index = 0; index < objectLocatorDataMobile.length; index++) {
    for (let j = 0; j < DEVICE_TYPES.length; j++) {
      const objectLocatorProps = { objectLocatorTypeId: uuid.uuidWithoutHyphens(), name: objectLocatorDataMobile[index], displayName: `${DEVICE_TYPES[j]}_${objectLocatorDataMobile[index]}`, type: `${DEVICE_TYPES[j]}` };

      const objectLocatorNode = await executor.createNode(context, [LABELS.objectLocatorType, context.projectId], objectLocatorProps);
      await executor.createRelationship(context, objectLocators, objectLocatorNode, RELATIONSHIPS.hasObjectLocatorType, {});
      await executor.createRelationship(context, mobile, objectLocatorNode, RELATIONSHIPS.hasObjectLocatorType, {});
      if (DEVICE_TYPES[j] === DEVICE_TYPES_PROPERTIES.ios) {
        await executor.createRelationship(context, ios, objectLocatorNode, RELATIONSHIPS.hasObjectLocatorType, {});
      }
      else if (DEVICE_TYPES[j] === DEVICE_TYPES_PROPERTIES.android) {
        await executor.createRelationship(context, android, objectLocatorNode, RELATIONSHIPS.hasObjectLocatorType, {});
      }
      else {
        // do nothing
      }
    }
  }
  logger.debug('<< createObjectLocatorMobile()');
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  createObjectLocatorWeb,
  createObjectLocatorMobile,
};

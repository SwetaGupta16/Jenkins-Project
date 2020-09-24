const executor = require('../../executor');
const { uuid } = require('../../../../utils');
const objectType = require('./objectType');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);
const LABELS = {
  objectClass: 'ObjectClass',
  objectType: 'ObjectType',
};

const RELATIONSHIPS = {
  hasObjectClass: 'HAS_OBJECT_CLASS',
  hasObjectType: 'HAS_OBJECT_TYPE',
};

const objectClassesDataWeb = ['WebEdit', 'WebButton', 'WebFile', 'WebTable', 'WebElement', 'WebLink', 'WebCheckbox', 'WebList', 'Frame', 'WebRadioButton', 'Page', 'WebImage'];

const objectClassesDataMobile = ['MobileElement', 'MobileButton', 'MobileRadioButton', 'MobileList', 'MobileDropDown', 'MobileCheckbox', 'MobileText'];

const createObjectClassWeb = async (context, objectClasses) => {
  logger.debug('>> createObjectClassWeb()');
  const result = await objectType.getObjectTypeMap();
  const web = result.get('web');

  for (let index = 0; index < objectClassesDataWeb.length; index++) {
    const objectClassProps = { objectClassId: uuid.uuidWithoutHyphens(), name: objectClassesDataWeb[index] };

    const objectClassNode = await executor.createNode(context, [LABELS.objectClass, context.projectId], objectClassProps);
    await executor.createRelationship(context, objectClasses, objectClassNode, RELATIONSHIPS.hasObjectClass, {});
    await executor.createRelationship(context, web, objectClassNode, RELATIONSHIPS.hasObjectClass, {});
  }
  logger.debug('<< createObjectClassWeb()');
};

const createObjectClassMobile = async (context, objectClasses) => {
  logger.debug('>> createObjectClassMobile()');
  const result = await objectType.getObjectTypeMap();
  const mobile = result.get('mobile');

  for (let index = 0; index < objectClassesDataMobile.length; index++) {
    const objectClassProps = { objectClassId: uuid.uuidWithoutHyphens(), name: objectClassesDataMobile[index] };

    const objectClassNode = await executor.createNode(context, [LABELS.objectClass, context.projectId], objectClassProps);
    await executor.createRelationship(context, objectClasses, objectClassNode, RELATIONSHIPS.hasObjectClass, {});
    await executor.createRelationship(context, mobile, objectClassNode, RELATIONSHIPS.hasObjectClass, {});
  }
  logger.debug('<< createObjectClassMobile()');
};

module.exports = {
  LABELS,
  RELATIONSHIPS,
  createObjectClassWeb,
  createObjectClassMobile,
};

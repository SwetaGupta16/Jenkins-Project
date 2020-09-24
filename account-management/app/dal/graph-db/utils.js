const driverManager = require('./driver-manager');
const stringUtils = require('../../utils/string-utils');

/**
 *Iterates over array of labels(String) and prefix each label with colon(:) to make it neo4j Label.
 *
 *Example: ["Label1","Label2"] converted into ":Label1:Label2"
 *
 * @param {*} labels
 * @returns {*} neo4j cypher labels
 */
const convertIntoCypherLabels = (labels) => {
  let returnValue = '';
  for (let i = 0; i < labels.length; i++) {
    returnValue += `${':' + '`'}${labels[i]}\``;
  }
  return returnValue;
};

const isDateTimeProp = (key) => stringUtils.equalsIgnoreCase(key, 'createdAt') || stringUtils.equalsIgnoreCase(key, 'updatedAt');

/**
 *Iterates over JavaScript object properties and convert them into a single neo4j properties string.
 *For that unlike JSON.stringify(), it does not wrap property key with single quotes('') or double quotes("").
 *
 *Example without keyPrefix:  {"prop1":"value1","prop2":"value2"} converted into "prop1:$prop1,prop2:$prop2"
 *Example with keyPrefix:  {"prop1":"value1","prop2":"value2"} converted into "prop1:$keyPrefixprop1,prop2:$keyPrefixprop2"
 *
 * @param {*} properties
 * @param {*} [keyPrefix=null]
 * @returns neo4j cypher properties
 */

const convertIntoCypherProps = (properties, keyPrefix = null) => {
  let returnValue = '';
  for (const key in properties) {
    if (properties.hasOwnProperty(key)) {
      if (keyPrefix) {
        if (isDateTimeProp(key)) {
          returnValue = `${returnValue + key}:datetime($${keyPrefix}${key}),`;
        }
        else {
          returnValue = `${returnValue + key}:$${keyPrefix}${key},`;
        }
      }
      else {
        if (isDateTimeProp(key)) {
          returnValue = `${returnValue + key}:datetime($${key}),`;
        }
        else {
          returnValue = `${returnValue + key}:$${key},`;
        }
      }
    }
  }
  if (returnValue.length > 0) {
    returnValue = returnValue.substring(0, returnValue.length - 1); // remove last character i.e. ,
  }
  return returnValue;
};

/**
 *
 *
 * @param {*} properties
 * @param {*} prefix
 * @returns
 */
const convertIntoCypherSet = (properties, prefix) => {
  let returnValue = '';
  for (const key in properties) {
    if (properties.hasOwnProperty(key)) {
      if (isDateTimeProp(key)) {
        returnValue = `${returnValue + prefix}.${key}=datetime($${key}),`;
      }
      else {
        returnValue = `${returnValue + prefix}.${key}=$${key},`;
      }
    }
  }
  if (returnValue.length > 0) {
    returnValue = returnValue.substring(0, returnValue.length - 1); // remove last character i.e. ,
  }
  return returnValue;
};

/**
 *Iterates over where object and convert it into cypher where clause.
 *
 * @param {*} where => { name: {}, tcId: { NOT: {} } }
 * @param {*} nodeVariable => cn
 * @param {*} prefix => cn_
 * @param {boolean} [ignoreCase=true]
 * @returns {*} ignoreCase=true => "(toLower(cn.name)=toLower($cn_name)) AND NOT (toLower(cn.tcId)=toLower($cn_tcId))"
 *              ignoreCase=false => "cn.name=$cn_name AND NOT cn.tcId=$cn_tcId"

 */
const convertIntoCypherWhere = (where, nodeVariable, prefix, ignoreCase = true) => {
  let returnValue = '';
  for (const key in where) {
    if (where.hasOwnProperty(key)) {
      const value = where[key];
      const NOT = value.NOT ? 'NOT' : '';
      if (ignoreCase) {
        returnValue = `${returnValue} ${NOT} (toLower(toString(${nodeVariable}.${key}))=toLower(toString($${prefix}${key}))) AND`;
      }
      else {
        returnValue = `${returnValue} ${NOT} ${nodeVariable}.${key}=$${prefix}${key} AND`;
      }
    }
  }
  if (returnValue.length > 0) {
    returnValue = returnValue.substring(0, returnValue.length - 3).trim(); // remove last word i.e. AND
  }
  return returnValue;
};

const isInt = (value) => {
  if (isNaN(value)) {
    return false;
  }
  const x = parseFloat(value);
  return (x | 0) === x;
};

/**
 *Converts neo4j Integer type into primitive integer by iterating over each and every property of provided object (including nested objects).
 *
 * @param {*} obj
 * @returns {*} An object with primitive integer values if any.
 */
const simplifyIntegerTypes = (obj) => {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (driverManager.isInt(value)) {
        obj[key] = value.toNumber();
      }
      else if (typeof value === 'object' && value !== null) {
        simplifyIntegerTypes(value);
      }
      else {
        // do nothing
      }
    }
  }
  return obj;
};

/**
 *Converts JavaScript object into neo4j params object.
 *In this process it converts JavaScript Integer type into neo4j Integer type. Other types of properties remain same.
 *
 * @param {*} obj
 * @param {*} [keyPrefix=null]
 * @returns
 */
const convertIntoCypherParams = (obj, keyPrefix = null) => {
  const returnValue = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (isInt(value)) {
        returnValue[key] = driverManager.getInt(value);
      }
      else {
        returnValue[key] = value;
      }

      if (keyPrefix) {
        returnValue[`${keyPrefix}${key}`] = returnValue[key];
      }
    }
  }
  return returnValue;
};

const projectLabel = (projectId) => `prj_${projectId}`;

const storyLabel = (storyId) => `story_${storyId}`;

const organizationLabel = (organizationId) => `org_${organizationId}`;

module.exports = {
  convertIntoCypherLabels,
  convertIntoCypherProps,
  simplifyIntegerTypes,
  convertIntoCypherParams,
  convertIntoCypherSet,
  organizationLabel,
  projectLabel,
  convertIntoCypherWhere,
  storyLabel,
};

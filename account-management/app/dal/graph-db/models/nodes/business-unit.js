const executor = require('../../executor');
const organization = require('./organization');
const utils = require('../../utils');
const errors = require('../../../../errors');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const LABELS = {
  businessUnit: 'BusinessUnit',
  defaultBusinessUnit: 'DefaultBusinessUnit',
  pricingPlanStrategy: 'PricingPlanStrategy',
  licenseCount: 'LicenseCount',
};

/* Neo4j relationships */
const RELATIONSHIPS = {
  currentPricingPlanStrategy: 'CURRENT_PRICING_PLAN_STRATEGY',
  currentLicenseCount: 'CURRENT_LICENSE_COUNT',
};

const orgLabels = organization.LABELS;
const orgRelationships = organization.RELATIONSHIPS;

const readDefaultBusinessUnit = async (organizationId, txOrSession = null) => {
  logger.debug('>> readDefaultBusinessUnit()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId:$organizationId})
    WITH org MATCH (org)-[${orgRelationships.hasDefaultBusinessUnit}]->(dbu:${LABELS.defaultBusinessUnit}) 
    return dbu;`;
  const defaultBusinessUnit = await executor.read(query, { organizationId }, txOrSession);
  const defaultBusinessUnitNode = defaultBusinessUnit.records[0].get('dbu');
  const result = utils.simplifyIntegerTypes(defaultBusinessUnitNode);
  logger.debug('<< readDefaultBusinessUnit()');
  return result;
};

const readPricingPlanStrategy = async (organizationId, txOrSession = null) => {
  logger.debug('>> readPricingPlanStrategy()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId:$organizationId})
    WITH org MATCH (org)-[r1:${orgRelationships.hasDefaultBusinessUnit}]->(dbu:${LABELS.defaultBusinessUnit})
    WITH dbu MATCH (dbu)-[r2:${RELATIONSHIPS.currentPricingPlanStrategy}]->(pps:${LABELS.pricingPlanStrategy})
    WITH pps MATCH(pps)-[r3:${RELATIONSHIPS.currentLicenseCount}]->(lc:${LABELS.licenseCount})
    RETURN pps,lc`;
  const pricingPlanStrategy = await executor.read(query, { organizationId }, txOrSession);

  if (pricingPlanStrategy.records.length <= 0) {
    const orgExist = await organization.exists({ organizationId });
    if (!orgExist) {
      const errMsg = 'PricingPlanStrategy node not found';
      logger.error(errMsg);
      throw errors.NotFound('PRICING_PLAN_STRATEGY', errMsg);
    }
  }

  const pricingPlanStrategyNode = pricingPlanStrategy.records[0].get('pps');
  const licenseCount = pricingPlanStrategy.records[0].get('lc');
  pricingPlanStrategyNode.properties.maxLicenses = licenseCount.properties.maxLicenses;
  const result = utils.simplifyIntegerTypes(pricingPlanStrategyNode.properties);
  logger.debug('>> readPricingPlanStrategy()');
  return result;
};

module.exports = {
  LABELS,
  readDefaultBusinessUnit,
  readPricingPlanStrategy,
};

const executor = require('../../executor');
const utils = require('../../utils');
const errors = require('../../../../errors');
const organizationNode = require('./organization');
const businessUnitNode = require('./business-unit');
const objectClassNode = require('./objectClass');
const objectLocatorNode = require('./objectLocator');
const objectTypeNode = require('./objectType');
const { uuid } = require('../../../../utils');
const { uniqWith, isEqual } = require('lodash');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);
const nodes = require('.');
const userNode = nodes.user;

const LABELS = {
  project: 'Project',
  user: 'User',
  issueGroup: 'IssueGroup',
  orphanIssueGroup: 'OrphanIssueGroup',
  testCaseCollection: 'TestCaseCollection',
  taskCollection: 'TaskCollection',
  objectCollection: 'ObjectCollection',
  ownership: 'Ownership',
  objectMetadata: 'ObjectMetadata',
  objectClasses: 'ObjectClasses',
  objectLocatorTypes: 'ObjectLocatorTypes',
  objectTypes: 'ObjectTypes',
  organization: 'Organization',
  configuration: 'Configuration',
  severities: 'Severities',
  priorities: 'Priorities',
  severity: 'Severity',
  priority: 'Priority',
  markedForAutomationEntities: 'MarkedForAutomationEntities',
  role: 'Role',
};

const RELATIONSHIPS = {
  isMemberOf: 'IS_MEMBER_OF',
  hasProject: 'HAS_PROJECT',
  updatedBy: 'UPDATED_BY',
  createdBy: 'CREATED_BY',
  hasConfiguration: 'HAS_CONFIGURATION',
  hasIssueGroup: 'HAS_ISSUE_GROUP',
  hasOrphanIssueGroup: 'HAS_ORPHAN_ISSUE_GROUP',
  hasTestCaseCollection: 'HAS_TEST_CASE_COLLECTION',
  hasTaskCollection: 'HAS_TASK_COLLECTION',
  hasObjectCollection: 'HAS_OBJECT_COLLECTION',
  hasOwnershipType: 'HAS_OWNERSHIP_TYPE',
  hasObjectMetadata: 'HAS_OBJECT_METADATA',
  hasObjectTypes: 'HAS_OBJECT_TYPES',
  hasObjectLocatorTypes: 'HAS_OBJECT_LOCATOR_TYPES',
  hasObjectClasses: 'HAS_OBJECT_CLASSES',
  hasSeverities: 'HAS_SEVERITIES',
  hasSeverity: 'HAS_SEVERITY',
  hasPriorities: 'HAS_PRIORITIES',
  hasPriority: 'HAS_PRIORITY',
  hasMarkedForAutomationEntities: 'HAS_MARKED_FOR_AUTOMATION_ENTITIES',
};

const PROPERTIES = {
  projectManagerRole: { role: 'ProjectManager' },
  adminRole: { role: 'Admin' },
  qdsOwner: 'QDS',
  qasOwner: 'QAS',
  qdsName: 'Design Studio',
  qasName: 'Automation Studio',
  qdsDisplayName: 'Qualitia Design Studio',
  qasDisplayName: 'Qualitia Automation Studio',
  root: 'Root',
};

const orgLabels = organizationNode.LABELS;
const businessUnitLabels = businessUnitNode.LABELS;
const orgRelationships = organizationNode.RELATIONSHIPS;

const validateCreateProjectInput = async (project) => {
  logger.debug('>> validateCreateProjectInput()');
  if (!project.name) {
    const errMsg = 'Project name is mandatory.';
    logger.error(errMsg);
    throw errors.Mandatory('PROJECT_NAME', errMsg);
  }
  logger.debug('<< validateCreateProjectInput()');
};

/**
 *Reads the project details based on its id within specified organization.
 *
 * @param {*} projectName
 * @param {*} organizationId
 * @param {*} [txOrSession=null]
 * @returns {*} Project details
 */
const readProjectByNameFromOrganization = async (projectName, organizationId, txOrSession = null) => {
  logger.debug('>> readProjectByNameFromOrganization()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
    -[p:${orgRelationships.hasProject}]->
    (project:${LABELS.project})
     WHERE toLower(toString(project.name)) = toLower(toString($projectName))
     RETURN {project:project{.*,createdAt:toString(project.createdAt),updatedAt:toString(project.updatedAt)}} AS result`;
  const params = {
    organizationId,
    projectName,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('result').project));
  logger.debug('<< readProjectByNameFromOrganization()');
  return returnVal;
};

/**
 *Reads the project details based on its key within specified organization.
 *
 * @param {*} projectKey
 * @param {*} organizationId
 * @param {*} [txOrSession=null]
 * @returns {*} Project details
 */
const readProjectByKeyFromOrganization = async (projectKey, organizationId, txOrSession = null) => {
  logger.debug('>> readProjectByKeyFromOrganization()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
    -[p:${orgRelationships.hasProject}]->
    (project:${LABELS.project})
     WHERE toLower(toString(project.key)) = toLower(toString($key))
     RETURN {project:project{.*,createdAt:toString(project.createdAt),updatedAt:toString(project.updatedAt)}} AS result`;
  const params = {
    organizationId,
    key: projectKey,
  };

  const result = await executor.read(query, params, txOrSession);

  const returnVal = result.records.map((record) => utils.simplifyIntegerTypes(record.get('result').project));
  logger.debug('<< readProjectByKeyFromOrganization()');
  return returnVal;
};

/**
 *Reads project details based on it's id
 *
 * @param {*} projectId
 * @param {*} organizationId
 * @param {*} status
 * @param {*} [txOrSession=null]
 * @returns
 */
const readById = async (projectId, organizationId, status = 'Active', txOrSession = null) => {
  logger.debug('>> readById()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
    -[p:${orgRelationships.hasProject}]->
    (project:${LABELS.project} {projectId: $projectId, status: $status}) return project`;
  const params = {
    projectId,
    organizationId,
    status,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = `Project with id '${projectId}' not found.`;
    logger.error(errMsg);
    throw errors.NotFound('PROJECT', errMsg);
  }
  const returnVal = utils.simplifyIntegerTypes(result.records[0].get('project').properties);
  logger.debug('<< readById()');
  return returnVal;
};

/**
 *Checks if project exist or not based on projectId input parameter
 *
 * @param {*} input
 * @param {*} status
 * @param {*} [txOrSession=null]
 * @returns {*} Boolean
 */
const exists = async (input, status = 'Active', txOrSession = null) => {
  logger.debug('>> exists()');
  let returnValue = false;

  if (!input.organizationId) {
    return returnValue;
  }

  if (input.projectName) {
    try {
      const records = await readProjectByNameFromOrganization(input.projectName, input.organizationId, txOrSession);
      if (records.length > 0) {
        returnValue = true;
      }
    }
    catch (err) {
      return returnValue;
    }
  }

  if (input.projectKey) {
    try {
      const records = await readProjectByKeyFromOrganization(input.projectKey, input.organizationId, txOrSession);
      if (records.length > 0) {
        returnValue = true;
      }
    }
    catch (err) {
      return returnValue;
    }
  }

  if (input.projectId) {
    try {
      await readById(input.projectId, input.organizationId, status, txOrSession);
      returnValue = true;
    }
    catch (err) {
      return returnValue;
    }
  }
  logger.debug('<< exists()');
  return returnValue;
};

const createOrganizationRelation = async (context, organization, project, relationshipProps = {}) => {
  logger.debug('>> createOrganizationRelation()');
  try {
    const result = await executor.createOrUpdateRelationship(context, organization, project, RELATIONSHIPS.hasProject, relationshipProps);
    const returnValue = {
      organization: result.source,
      project: result.destination,
      relationship: result.relationship,
    };
    logger.debug('<< createOrganizationRelation()');
    return returnValue;
  }
  catch (err) {
    if (err.code === 'ServiceError.RELATIONSHIP_CREATION_FAILED') {
      const orgExist = await organizationNode.exists({ organizationId: organization.organizationId }, context.tx);
      if (!orgExist) {
        const errMsg = `Organization does not exist. Cannot create user relationship with organization.\nMessage=> ${err} \nStack=> ${err.stack}`;
        logger.error(errMsg);
        throw errors.NotFound('ORGANIZATION', errMsg);
      }
      const projectExist = await exists({ project: project.projectId, organizationId: organization.organizationId }, context.tx);
      if (!projectExist) {
        const errMsg = `Project does not exist. Cannot create project relationship with organization.\nMessage=> ${err} \nStack=> ${err.stack}`;
        logger.error(errMsg);
        throw errors.NotFound('Project', errMsg);
      }
    }
    throw err;
  }
};

const createObjectMetadata = async (context, project) => {
  logger.debug('>> createObjectMetadata()');
  // Create object metadata
  const objectMetadata = await executor.createNode(context, [LABELS.objectMetadata, context.projectId], { objectMetadataId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, project, objectMetadata, RELATIONSHIPS.hasObjectMetadata, {});

  // create objectTypes
  const objectTypes = await executor.createNode(context, [LABELS.objectTypes, context.projectId], { objectTypesId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, objectMetadata, objectTypes, RELATIONSHIPS.hasObjectTypes, {});
  await objectTypeNode.createObjectType(context, objectTypes);

  // create objectClasses
  const objectClasses = await executor.createNode(context, [LABELS.objectClasses, context.projectId], { objectClassesId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, objectMetadata, objectClasses, RELATIONSHIPS.hasObjectClasses, {});
  await objectClassNode.createObjectClassWeb(context, objectClasses);
  await objectClassNode.createObjectClassMobile(context, objectClasses);

  // create objectLocators
  const objectLocators = await executor.createNode(context, [LABELS.objectLocatorTypes, context.projectId], { objectLocatorTypesId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, objectMetadata, objectLocators, RELATIONSHIPS.hasObjectLocatorTypes, {});
  await objectLocatorNode.createObjectLocatorWeb(context, objectLocators);
  await objectLocatorNode.createObjectLocatorMobile(context, objectLocators);
  logger.debug('<< createObjectMetadata()');
};

const createCollectionNodes = async (context, project) => {
  logger.debug('>> createCollectionNodes()');
  // Create test case collection
  const testCaseCollection = await executor.createNode(context, [LABELS.testCaseCollection, context.projectId], { testCaseCollectionId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, project, testCaseCollection, RELATIONSHIPS.hasTestCaseCollection, {});

  // Create task collection
  const taskCollection = await executor.createNode(context, [LABELS.taskCollection, context.projectId], { taskCollectionId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, project, taskCollection, RELATIONSHIPS.hasTaskCollection, {});

  // Create object collection
  const objectCollection = await executor.createNode(context, [LABELS.objectCollection, context.projectId], { objectCollectionId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, project, objectCollection, RELATIONSHIPS.hasObjectCollection, {});

  await createObjectMetadata(context, project);
  logger.debug('<< createCollectionNodes()');
};

const createOwnershipNodes = async (context, project) => {
  logger.debug('>> createOwnershipNodes()');
  // Create Qualitia Design Studio Ownership
  const qdsOwner = await executor.createNode(context, [LABELS.ownership, context.projectId], { ownershipId: uuid.uuidWithoutHyphens(), type: PROPERTIES.qdsOwner, name: PROPERTIES.qdsName, displayName: PROPERTIES.qdsDisplayName });
  await executor.createRelationship(context, project, qdsOwner, RELATIONSHIPS.hasOwnershipType);

  // Create Qualitia Automation Studio Ownership
  const qasOwner = await executor.createNode(context, [LABELS.ownership, context.projectId], { ownershipId: uuid.uuidWithoutHyphens(), type: PROPERTIES.qasOwner, name: PROPERTIES.qasName, displayName: PROPERTIES.qasDisplayName });
  await executor.createRelationship(context, project, qasOwner, RELATIONSHIPS.hasOwnershipType);
  logger.debug('<< createOwnershipNodes()');
};

const createMarkForAutomationEntitiesNode = async (context, project) => {
  logger.debug('>> createMarkForAutomationEntitiesNode()');
  const markedForAutomationNode = await executor.createNode(context, [LABELS.markedForAutomationEntities], { markedForAutomationEntitiesId: uuid.uuidWithoutHyphens() });
  await executor.createRelationship(context, project, markedForAutomationNode, RELATIONSHIPS.hasMarkedForAutomationEntities);
  logger.debug('<< createMarkForAutomationEntitiesNode()');
};

/**
 *Creates a new project node and associates that with organization node
 *
 * @param {*} context
 * @param {*} user
 * @returns {*} Newly created user node.
 */
const create = async (context, input) => {
  logger.debug('>> create()');
  const projectProps = input.project;
  const organization = {
    properties: input.organization,
    labels: [organizationNode.LABELS.organization],
  };
  await validateCreateProjectInput(projectProps);

  projectProps.projectId = uuid.uuidWithoutHyphens();

  let projectNode = null;
  try {
    projectNode = await executor.createNode(context, [LABELS.project], projectProps);

    const prjNode = { labels: [LABELS.project], properties: { projectId: projectProps.projectId } };
    context.projectId = `prj_${projectProps.projectId}`;
    await createOrganizationRelation(context, organization, prjNode);

    await createCollectionNodes(context, prjNode);

    await createOwnershipNodes(context, prjNode);

    await createMarkForAutomationEntitiesNode(context, prjNode);
  }
  catch (err) {
    if (err.code === 'Neo.ClientError.Schema.ConstraintValidationFailed' && err.message.includes('already exists with label')) {
      const errMsg = `Project with name ${projectProps.name} already exists.\nMessage=> ${err} \nStack=> ${err.stack}`;
      logger.error(errMsg);
      throw errors.AlreadyExists('PROJECT', errMsg);
    }
    throw err;
  }

  projectNode = utils.simplifyIntegerTypes(projectNode);
  logger.debug('<< create()');
  return projectNode;
};

/**
 *Creates IS_MEMBER_OF relationship from user to business unit node.
 *If businessUnitId is specified in input, relationship is created with that. Otherwise  default business unit is used.
 *
 * @param {*} context
 * @param {*} userProps
 * @param {*} businessUnitProps
 * @param {*} relationshipProps
 * @returns {*} {
            user,
            businessUnit,
            relationship
        }
 */
const createBusinessUnitRelation = async (context, businessUnitProps, projectProps, relationshipProps = {}) => {
  logger.debug('>> createBusinessUnitRelation()');
  const project = { labels: [LABELS.project], properties: { projectId: projectProps.projectId } };
  const businessUnit = { labels: [businessUnitLabels.businessUnit] };

  if (businessUnitProps.businessUnitId) {
    businessUnit.properties = { businessUnitId: businessUnitProps.businessUnitId };
  }
  else {
    const defaultBusinessUnit = await businessUnitNode.readDefaultBusinessUnit(businessUnitProps.organizationId, context.tx);
    businessUnit.properties = { businessUnitId: defaultBusinessUnit.properties.businessUnitId };
  }

  const result = await executor.createOrUpdateRelationship(context, businessUnit, project, RELATIONSHIPS.hasProject, relationshipProps);
  const returnValue = {
    businessUnit: result.source,
    project: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createBusinessUnitRelation()');
  return returnValue;
};

/**
 *Creates HAS_CONFIGURATION relationship from project to configuration node.
 *
 * @param {*} context
 * @param {*} projectProps
 * @param {*} configurationProps
 * @param {*} relationshipProps
 * @returns {*} {
            project,
            configuration,
            relationship
        }
 */
const createProjectConfigurationRelation = async (context, projectProps, configurationProps, relationshipProps = {}) => {
  logger.debug('>> createProjectConfigurationRelation()');
  const project = { labels: [LABELS.project], properties: { projectId: projectProps.projectId } };
  const configuration = { labels: [LABELS.configuration], properties: { configurationId: configurationProps.configurationId } };

  const result = await executor.createOrUpdateRelationship(context, project, configuration, RELATIONSHIPS.hasConfiguration, relationshipProps);
  const returnValue = {
    project: result.source,
    configuration: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createProjectConfigurationRelation()');
  return returnValue;
};

/**
 *Reads the project details based on its id within specified organization.
 *
 * @param {*} userId
 * @param {*} projectId
 * @param {*} status
 * @param {*} [txOrSession=null]
 * @returns {*} Project details
 */
const readUserProjectFromOrganization = async (userId, projectId, organizationId, status = 'Active', txOrSession = null) => {
  logger.debug('>> readUserProjectFromOrganization()');
  let result;

  const projectInfoQuery = `MATCH (project)-[:${RELATIONSHIPS.hasConfiguration}]->(conf:${LABELS.configuration}) WITH users, project, conf
    MATCH(project)-[:${RELATIONSHIPS.hasOwnershipType}]->(owner:${LABELS.ownership}) WITH users, project, conf, owner
    MATCH (conf)-[r3:${RELATIONSHIPS.hasSeverities}]->(severities:${LABELS.severities}) WITH users, project, severities,conf, owner
    MATCH (conf)-[r4:${RELATIONSHIPS.hasPriorities}]->(priorities:${LABELS.priorities}) WITH  users, project, severities, priorities, owner
    MATCH (severities)-[r5:${RELATIONSHIPS.hasSeverity}]->(severity:${LABELS.severity}) WITH users, project, severities, priorities, severity, owner
    MATCH (priorities)-[r6:${RELATIONSHIPS.hasPriority}]->(priority:${LABELS.priority}) WITH users, project, severities,owner, priorities,severity, priority order by priority.name, severity.name
    RETURN {users: users, 
        project: project{.*,createdAt:toString(project.createdAt),updatedAt:toString(project.updatedAt)}, 
        ownerTypes: collect({owner : owner{.*,createdAt:toString(owner.createdAt),updatedAt:toString(owner.updatedAt)}}), 
        severities: collect({severity : severity{.*,createdAt:toString(severity.createdAt),updatedAt:toString(severity.updatedAt)}}), 
        priorities: collect({priority : priority{.*,createdAt:toString(priority.createdAt),updatedAt:toString(priority.updatedAt)}})}
        AS projectInfo`;

  const query = `MATCH (user:${LABELS.user}{userId: $userId, status:"Active" }) WITH user
    MATCH(user)-[r1:${RELATIONSHIPS.isMemberOf}]->(project: ${LABELS.project} {projectId: $projectId, status: $status}) WITH project 
    MATCH (u: ${LABELS.user}{status: "Active"})-[r2:${RELATIONSHIPS.isMemberOf}]->(project) WITH collect({user:u{.*,createdAt:toString(u.createdAt),updatedAt:toString(u.updatedAt)},prjRel:r2{.*}}) as users, project 
    ${projectInfoQuery}
 `;

  const params = {
    userId,
    projectId,
    status,
  };
  result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const secondQuery = `MATCH (user:${LABELS.user}{userId: $userId})-[r1:${RELATIONSHIPS.isMemberOf} {role:'${PROPERTIES.root}'}]->(org :${LABELS.organization}{organizationId: $organizationId})
        WITH org MATCH (u:${LABELS.user}{status:"Active"})-[r2:${RELATIONSHIPS.isMemberOf}]->(project:${LABELS.project}{projectId: $projectId, status: "Active"})  WITH collect({user:u{.*,createdAt:toString(u.createdAt),updatedAt:toString(u.updatedAt)},prjRel:r2{.*}}) as users, project 
        ${projectInfoQuery}`;

    const secondParams = {
      userId,
      organizationId,
      projectId,
      status,
    };

    result = await executor.read(secondQuery, secondParams, txOrSession);

    if (result.records.length <= 0) {
      const projectExist = await exists({ projectId, organizationId });
      if (!projectExist) {
        const errMsg = `Project with id '${projectId}' not found in this organization id '${organizationId}'.`;
        logger.error(errMsg);
        throw errors.NotFound('Project', errMsg);
      }
      const userIdExist = await userNode.exists({ userId });
      if (!userIdExist) {
        const errMsg = 'User does not exist.';
        logger.error(errMsg);
        throw errors.NotFound('USER_ID', errMsg);
      }
    }
  }
  const projectInfo = result.records[0].get('projectInfo');
  const returnValue = result.records.map(() => {
    const { project } = projectInfo;
    let users = projectInfo.users.map((user) => ({ role: user.prjRel.role, ...user.user }));
    let severities = projectInfo.severities.map((severity) => ({ ...severity.severity }));
    let priorities = projectInfo.priorities.map((priority) => ({ ...priority.priority }));
    let ownerTypes = projectInfo.ownerTypes.map((owner) => ({ ...owner.owner }));

    users = uniqWith(users, isEqual);
    severities = uniqWith(severities, isEqual);
    priorities = uniqWith(priorities, isEqual);
    ownerTypes = uniqWith(ownerTypes, isEqual);
    return utils.simplifyIntegerTypes({ ...project, users, severities, priorities, ownerTypes });
  });
  logger.debug('<< readUserProjectFromOrganization()');
  return returnValue;
};

/**
 *Reads the project details based on its id within specified organization.
 *
 * @param {*} organizationId
 * @param {*} projectId
 * @param {*} status
 * @param {*} [txOrSession=null]
 * @returns {*} Project details
 */
const readProjectFromOrganization = async (organizationId, projectId, status = 'Active', txOrSession = null) => {
  logger.debug('>> readProjectFromOrganization()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
     WITH org MATCH(org)-[r1:${orgRelationships.hasProject}]->(project:${LABELS.project} {projectId: $projectId, status: $status})
     WITH project OPTIONAL MATCH (user:${LABELS.user} {status:"Active"})-[r2:${RELATIONSHIPS.isMemberOf}]->(project) WITH project, user, r2
     OPTIONAL MATCH(role:${LABELS.role} {name:r2.role})
     RETURN {project:project{.*,createdAt:toString(project.createdAt),updatedAt:toString(project.updatedAt)},
      users: collect({user:user{.*,createdAt:toString(user.createdAt),updatedAt:toString(user.updatedAt)},prjRel:r2{.*,displayName:role.displayName}})} as proj`;

  const params = {
    organizationId,
    projectId,
    status,
  };

  const result = await executor.read(query, params, txOrSession);

  if (result.records.length <= 0) {
    const errMsg = `Project with id '${projectId}' not found in this organization.`;
    logger.error(errMsg);
    throw errors.NotFound('PROJECT', errMsg);
  }

  const returnVal = result.records.map((record) => {
    const projectProps = record.get('proj');
    const { project } = projectProps;
    let users = projectProps.users.map((user) => {
      if (user.prjRel) {
        return { role: user.prjRel.role, roleDisplayName: user.prjRel.displayName, ...user.user };
      }
      else {
        return user;
      }
    });
    users = uniqWith(users, isEqual);
    return utils.simplifyIntegerTypes({ ...project, users });
  });
  logger.debug('<< readProjectFromOrganization()');
  return returnVal;
};

/**
 *Reads the project details based on specified organization id.
 *
 * @param {*} userId
 * @param {*} status
 * @param {*} [txOrSession=null]
 * @returns {*} Project details
 */
const readUserProjectsFromOrganization = async (userId, status = 'Active', txOrSession = null) => {
  logger.debug('>> readUserProjectsFromOrganization()');
  const query = `MATCH (:${LABELS.user} {userId: $userId, status:"Active"})
    -[r1:${RELATIONSHIPS.isMemberOf}]->
    (project:${LABELS.project} {status: $status}) 
    WITH project MATCH (user:${LABELS.user}{status:"Active"})-[r2:${RELATIONSHIPS.isMemberOf}]->(project)
    RETURN {project:project{.*,createdAt:toString(project.createdAt),updatedAt:toString(project.updatedAt)}, 
    users: collect({user:user{.*,createdAt:toString(user.createdAt),updatedAt:toString(user.updatedAt)},prjRel:r2{.*}})}
     AS proj`;
  const params = {
    userId,
    status,
  };
  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => {
    const projectProps = record.get('proj');
    const { project } = projectProps;
    let users = projectProps.users.map((user) => ({ role: user.prjRel.role, ...user.user }));
    users = uniqWith(users, isEqual);
    return utils.simplifyIntegerTypes({ ...project, users });
  });
  logger.debug('<< readUserProjectsFromOrganization()');
  return returnVal;
};

/**
 *Fetches total project count by userId from database.
 *
 * @param {*} userId
 * @param {*} status
 * @param {*} [txOrSession=null]
 * @returns {*} count of projects
 */
const readUserProjectCountByUserId = async (userId, txOrSession = null) => {
  logger.debug('>> readUserProjectCountByUserId()');
  const query = `MATCH (user:${LABELS.user} {userId: $userId})
    WITH user MATCH (user)-[r1:${RELATIONSHIPS.isMemberOf}]->
    (project:${LABELS.project} {status:"Active"}) 
     RETURN count(project) as count`;
  const params = {
    userId,
  };
  let returnValue = 0;
  const result = await executor.read(query, params, txOrSession);
  if (result.records.length > 0) {
    returnValue = result.records[0].get('count');
    returnValue = returnValue.low;
  }
  logger.debug('<< readUserProjectCountByUserId()');
  return returnValue;
};

/**
 *Reads the project details based on specified organization id.
 *
 * @param {*} organizationId
 * @param {*} status
 * @param {*} [txOrSession=null]
 * @returns {*} Project details
 */
const readProjectsFromOrganization = async (organizationId, status = 'Active', page = 1, count = 10, txOrSession = null) => {
  logger.debug('>> readProjectsFromOrganization()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
     WITH org MATCH(org)-[r1:${orgRelationships.hasProject}]->(project:${LABELS.project} {status: $status})
     WITH project OPTIONAL MATCH (user:${LABELS.user} {status:"Active"})-[r2:${RELATIONSHIPS.isMemberOf}]->(project)
     WITH project,user,r2
    ORDER BY toLower(toString(project.name)) ASC
    RETURN {project:project{.*,createdAt:toString(project.createdAt),updatedAt:toString(project.updatedAt)}
    , users: collect({user:user{.*,createdAt:toString(user.createdAt),updatedAt:toString(user.updatedAt)},prjRel:r2})} as proj 
    SKIP toInteger(${page - 1}*${count}) LIMIT toInteger(${count})`;

  const params = {
    organizationId,
    status,
  };
  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => {
    const projectProps = record.get('proj');
    const { project } = projectProps;
    let users = [];
    if (projectProps.users) {
      users = projectProps.users.map((user) => {
        if (user.user) {
          return { role: user.prjRel.properties.role, ...user.user };
        }
      });
    }
    users = uniqWith(users, isEqual);
    return utils.simplifyIntegerTypes({ ...project, users });
  });
  logger.debug('<< readProjectsFromOrganization()');
  return returnVal;
};

/**
 *Fetches total project count by organizationId from database.
 *
 * @param {*} organizationId
 * @param {*} status
 * @param {*} [txOrSession=null]
 * @returns {*} count of projects
 */
const readTotalProjectCountByOrganizationId = async (organizationId, status = 'Active', txOrSession = null) => {
  logger.debug('>> readTotalProjectCountByreadUserProjectsOrganizationId()');
  const query = `MATCH (org:${orgLabels.organization} {organizationId: $organizationId})
    WITH org MATCH(org)-[r1:${orgRelationships.hasProject}]->(project:${LABELS.project} {status: $status})
     RETURN count(project) as count`;
  const params = {
    organizationId,
    status,
  };
  let returnValue = 0;
  const result = await executor.read(query, params, txOrSession);
  if (result.records.length > 0) {
    returnValue = result.records[0].get('count');
    returnValue = returnValue.low;
  }
  logger.debug('<< readTotalProjectCountByOrganizationId()');
  return returnValue;
};

/**
 *Returns user's active projects with role on that projects
 *
 * @param {*} userId
 * @param {*} page
 * @param {*} count
 * @param {*} [txOrSession=null]
 * @returns {*} [{
                    project {
                                projectId
                                name
                                description
                                status
                                createdAt
                            }
                    role
                }]
 */
const readUserProjects = async (userId, page = 1, count = 10, txOrSession = null) => {
  logger.debug('>> readUserProjects()');
  const query = `MATCH (user:${LABELS.user} {userId: $userId})
WITH user MATCH (user)-[r1:${RELATIONSHIPS.isMemberOf}]->
(project:${LABELS.project} {status:"Active"})
WITH user, project, r1 MATCH(role:${LABELS.role} {name:r1.role})
WITH user, project, role
ORDER BY toLower(toString(project.name)) ASC
RETURN {user:user, projects:collect({project:project{.*,createdAt:toString(project.createdAt),updatedAt:toString(project.updatedAt)}, rel:role{.*}})} as userProjects
SKIP toInteger(${page - 1}*${count}) LIMIT toInteger(${count})`;

  const params = {
    userId,
  };

  const dbResult = await executor.read(query, params, txOrSession);

  if (dbResult.records.length <= 0) {
    const errMsg = `There are no active projects for user(${userId})`;
    logger.error(errMsg);
    throw errors.NotFound('PROJECT', errMsg);
  }

  const userProjects = dbResult.records[0].get('userProjects');

  const projects = [];
  for (let index = 0; index < userProjects.projects.length; index++) {
    const projectAndRole = {};
    projectAndRole.project = userProjects.projects[index].project;
    projectAndRole.role = userProjects.projects[index].rel.displayName;
    projects.push(projectAndRole);
  }

  const returnValue = utils.simplifyIntegerTypes(projects);
  logger.debug('<< readUserProjects()');
  return returnValue;
};

const readAllProjectsWithRMTIssues = async (status = 'Active', txOrSession = null) => {
  logger.debug('>> readAllProjectsWithRMTIssues()');
  const query = `MATCH (org:${orgLabels.organization})
    -[p:${orgRelationships.hasProject}]->
    (project:${LABELS.project} {status: $status})-[i:${RELATIONSHIPS.hasIssueGroup}]->(issueGroup:${LABELS.issueGroup})-[:${RELATIONSHIPS.createdBy}]
    ->(user:${LABELS.user}) RETURN {org:org,project:project,user:user} AS projectData
    `;
  const params = {
    status,
  };

  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => {
    const projectData = record.get('projectData');
    const { organizationId } = projectData.org.properties;
    const { projectId } = projectData.project.properties;
    const { userId } = projectData.user.properties;
    return { organizationId, projectId, userId };
  });
  logger.debug('<< readAllProjectsWithRMTIssues()');
  return returnVal;
};

const readProjectsWithRMTIssues = async (projectId, status = 'Active', txOrSession = null) => {
  logger.debug('>> readProjectsWithRMTIssues()');
  const query = `MATCH (org:${orgLabels.organization})
    -[p:${orgRelationships.hasProject}]->
    (project:${LABELS.project} {projectId: $projectId, status: $status})-[i:${RELATIONSHIPS.hasIssueGroup}]->(issueGroup:${LABELS.issueGroup})-[:${RELATIONSHIPS.createdBy}]
    ->(user:${LABELS.user}) RETURN {org:org,project:project,user:user} AS projectData
    `;
  const params = {
    status,
    projectId,
  };

  const result = await executor.read(query, params, txOrSession);
  const returnVal = result.records.map((record) => {
    const projectData = record.get('projectData');
    const { organizationId } = projectData.org.properties;
    const { projectId: prjId } = projectData.project.properties;
    const { userId } = projectData.user.properties;
    return { organizationId, userId, projectId: prjId };
  });
  logger.debug('<< readProjectsWithRMTIssues()');
  return returnVal;
};

/**
 * Updates the project properties like name, description and status.
 * @param {*} context
 * @param {*} projectProps
 * @param {*} updatedProjectProps
 */
const updateProject = async (context, projectProps, updatedProjectProps) => {
  logger.debug('>> updateProject()');
  let projectNode = null;
  projectNode = await executor.updateNode(context, [LABELS.project], projectProps, updatedProjectProps);
  logger.debug('<< updateProject()');
  return projectNode;
};

/**
 *Creates HAS_ISSUE_GROUP relationship from project to issue group node.
 *
 * @param {*} tx
 * @param {*} projectProps
 * @param {*} issueGroupProps
 * @param {*} relationshipProps
 * @returns {*} {
            project,
            issueGroup,
            relationship
        }
 */
const createProjectIssueGroupRelation = async (tx, projectProps, issueGroupProps, relationshipProps = {}) => {
  logger.debug('>> createProjectIssueGroupRelation()');
  const project = { labels: [LABELS.project], properties: { projectId: projectProps.projectId } };
  const issueGroup = { labels: [LABELS.issueGroup], properties: { issueGroupId: issueGroupProps.issueGroupId } };

  const result = await executor.createOrUpdateRelationship(tx, project, issueGroup, RELATIONSHIPS.hasIssueGroup, relationshipProps);
  const returnValue = {
    project: result.source,
    issueGroup: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createProjectIssueGroupRelation()');
  return returnValue;
};

/**
 *Creates HAS_ORPHAN_ISSUE_GROUP relationship from project to orphanIssueGroup node.
 *
 * @param {*} tx
 * @param {*} projectProps
 * @param {*} orphanIssueGroupProps
 * @param {*} relationshipProps
 * @returns {*} {
            project,
            orphanIssueGroup,
            relationship
        }
 */
const createProjectOrphanIssueGroupRelation = async (tx, projectProps, orphanIssueGroupProps, relationshipProps = {}) => {
  logger.debug('>> createProjectOrphanIssueGroupRelation()');
  const project = { labels: [LABELS.project], properties: { projectId: projectProps.projectId } };
  const orphanIssueGroup = { labels: [LABELS.orphanIssueGroup], properties: { orphanIssueGroupId: orphanIssueGroupProps.orphanIssueGroupId } };

  const result = await executor.createOrUpdateRelationship(tx, project, orphanIssueGroup, RELATIONSHIPS.hasOrphanIssueGroup, relationshipProps);
  const returnValue = {
    project: result.source,
    orphanIssueGroup: result.destination,
    relationship: result.relationship,
  };
  logger.debug('<< createProjectOrphanIssueGroupRelation()');
  return returnValue;
};

module.exports = {
  LABELS,
  readUserProjectFromOrganization,
  readProjectFromOrganization,
  readProjectByNameFromOrganization,
  readProjectByKeyFromOrganization,
  readUserProjectsFromOrganization,
  readProjectsFromOrganization,
  readUserProjects,
  readById,
  exists,
  create,
  createBusinessUnitRelation,
  createProjectConfigurationRelation,
  updateProject,
  createProjectIssueGroupRelation,
  createProjectOrphanIssueGroupRelation,
  createObjectMetadata,
  readAllProjectsWithRMTIssues,
  readProjectsWithRMTIssues,
  readTotalProjectCountByOrganizationId,
  readUserProjectCountByUserId,
};

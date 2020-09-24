const user = require('./user').defs;
const project = require('./project').defs;
const organization = require('./organization').defs;
const rmt = require('./rmt').defs;
const scopeRolePrivilege = require('./scopeRolePrivilege').defs;
const issue = require('./issue').defs;
const owner = require('./owner').defs;

// Combine all GraphQL queries, mutations, schemas and expose them as type definitions of GraphQL
const Query = `
    type Query {
        user(organizationId:String, email:String, name:String):UserType 
        users(organizationId:String!, projectId:String, page: Int, count: Int, all: Boolean): UserData
        usersByStatus(organizationId:String!, status:String!):[UsersType]
        nonProjectMembers(projectId:String!):[UserType]
        userProjects(page: Int, count: Int, all: Boolean): UserProjectData
        project(projectId:String!): ProjectType
        organizationProject(projectId:String!): ProjectType
        projects: [ProjectType]
        organizationProjects(page: Int, count: Int, all: Boolean): ProjectData
        projectExist(organizationId:String! , projectName:String!): ProjectType
        projectKeyExist(projectKey:String!): ProjectType
        remainingLicenses(organizationId:String!):Int!
        rmts(productName:String): [RMTType]
        rmtConnect(projectId:String!, rmtInput:RMTInput!): ConnectionStatus
        scopesRolesPrivileges:[ScopeRolePrivilegeType]
        projectRolesPrivileges(projectId:String!):[RoleType]
        roleDetails(projectId:String):[RoleType]
        rmtConnectDetails(projectId:String!, type:RMTSupport): RMTDetails
        rmtProjects(rmtInput:RMTInput!): [RMTProjectType]
        rmtProjectEntityTypes(rmtInput:RMTInput!): [RMTProjectEntityType]
        rmtProjectEntityDetails(entityType:String!, rmtInput:RMTInput!): [RMTProjectEntityDetail]
        issues(projectId:String!, issueInput:IssueInput!): IssueType
        rmtIssueTypes(projectId:String!): [RMTIssueType]
        syncStatus(projectId:String!): Boolean!
     }
`;

const Mutation = `
    type Mutation {
        createUsers(organizationId:String!, usersInput:UsersInput!):Boolean!
        createProject(organizationId:String!, projectInput:ProjectInput!):Boolean! 
        allocateUsersToProject(projectId:String!, organizationId:String!, usersInput:UsersInput!):Boolean!
        deallocateUsersFromProject(projectId:String!, usersInput:UsersInput!):Boolean!
        changeUserRole(userId:String!,role:String!,scopeInput:ScopeInput!):Boolean!
        deleteRMTConnection(projectId:String!, type:RMTSupport! ):Boolean!
        updateRMTConnection(projectId:String!, hierarchy:[String]!, keys:[String]!, rmtInput:RMTInput!, rmtIssueInput:RMTIssueInput! ):Boolean!
        setRMTProjectIssueTypeHierarchy(projectId:String!, hierarchy:[String]!, keys:[String]!, rmtInput:RMTInput!, rmtIssueInput:RMTIssueInput!):Boolean!
        deleteProject(projectId:String!, organizationId:String!):Boolean!
        deleteUser(userId:String!, organizationId:String!):Boolean!
        updateProject(projectId:String!, organizationId:String!, updateProjectInput:UpdateProjectInput!):Boolean!
        syncRMTIssues(projectId:String!):Boolean!
        updateSeverities(projectId:String, updateSeverityInput:[UpdateSeverityInput]):Boolean!,
        updatePriorities(projectId:String, updatePriorityInput:[UpdatePriorityInput]):Boolean!
    }
`;

const schema = `
    schema {
        query: Query
        mutation:Mutation 
    }
`;

const typeDefs = [schema, Query, Mutation, ...user, ...project, ...organization, ...rmt, ...scopeRolePrivilege, ...issue, ...owner];

module.exports = {
  typeDefs,
};

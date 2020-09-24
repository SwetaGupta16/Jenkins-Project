const user = require('./user');
const project = require('./project');
const organization = require('./organization');
const severity = require('./severity');
const priority = require('./priority');
const rmt = require('./rmt');
const scopeRolePrivilege = require('./scopeRolePrivilege');
const issue = require('./issue');

const resolvers = {
  Query: {
    user: (obj, args, context, info) => user.getUser(obj, args, context, info),
    users: (obj, args, context, info) => user.getUsers(obj, args, context, info),
    usersByStatus: (obj, args, context, info) => user.getUsersByStatus(obj, args, context, info),
    nonProjectMembers: (obj, args, context, info) => user.getNonProjectMembers(obj, args, context, info),
    userProjects: (obj, args, context, info) => project.getUserProjects(obj, args, context, info),
    project: (obj, args, context, info) => project.getProject(obj, args, context, info),
    organizationProject: (obj, args, context, info) => project.getOrganizationProject(obj, args, context, info),
    projects: (obj, args, context, info) => project.getProjects(obj, args, context, info),
    organizationProjects: (obj, args, context, info) => project.getOrganizationProjects(obj, args, context, info),
    projectExist: (obj, args, context, info) => project.checkIfProjectExists(obj, args, context, info),
    projectKeyExist: (obj, args, context, info) => project.checkIfProjectKeyExists(obj, args, context, info),
    remainingLicenses: (obj, args, context, info) => organization.getRemainingLicenses(obj, args, context, info),
    rmts: (obj, args, context, info) => rmt.getRMTList(obj, args, context, info),
    rmtConnect: (obj, args, context, info) => rmt.testConnection(obj, args, context, info),
    scopesRolesPrivileges: (obj, args, context, info) => scopeRolePrivilege.getAllScopesRolesPrivileges(obj, args, context, info),
    projectRolesPrivileges: (obj, args, context, info) => scopeRolePrivilege.getProjectRolesPrivileges(obj, args, context, info),
    roleDetails: (obj, args, context, info) => scopeRolePrivilege.getRoleDetails(obj, args, context, info),
    rmtConnectDetails: (obj, args, context, info) => rmt.getConnectionDetails(obj, args, context, info),
    rmtProjects: (obj, args, context, info) => rmt.getRMTProjects(obj, args, context, info),
    rmtProjectEntityTypes: (obj, args, context, info) => rmt.getRMTProjectEntityTypes(obj, args, context, info),
    rmtProjectEntityDetails: (obj, args, context, info) => rmt.getRMTProjectEntityDetails(obj, args, context, info),
    issues: (obj, args, context, info) => issue.getIssues(obj, args, context, info),
    rmtIssueTypes: (obj, args, context, info) => issue.getRMTIssueTypes(obj, args, context, info),
    syncStatus: (obj, args, context, info) => issue.getSyncStatus(obj, args, context, info),
  },
  Mutation: {
    createUsers: (obj, args, context, info) => user.create(obj, args, context, info),
    createProject: (obj, args, context, info) => project.create(obj, args, context, info),
    allocateUsersToProject: (obj, args, context, info) => user.allocateUsersToProject(obj, args, context, info),
    deallocateUsersFromProject: (obj, args, context, info) => user.deallocateUsersFromProject(obj, args, context, info),
    changeUserRole: (obj, args, context, info) => user.changeRole(obj, args, context, info),
    deleteRMTConnection: (obj, args, context, info) => rmt.deleteRMTConnection(obj, args, context, info),
    updateRMTConnection: (obj, args, context, info) => rmt.updateRMTConnection(obj, args, context, info),
    setRMTProjectIssueTypeHierarchy: (obj, args, context, info) => rmt.setRMTProjectIssueTypeHierarchy(obj, args, context, info),
    deleteProject: (obj, args, context, info) => project.deleteProject(obj, args, context, info),
    deleteUser: (obj, args, context, info) => user.deleteUser(obj, args, context, info),
    updateProject: (obj, args, context, info) => project.updateProject(obj, args, context, info),
    syncRMTIssues: (obj, args, context, info) => issue.syncIssues(obj, args, context, info),
    updateSeverities: (obj, args, context, info) => severity.updateSeverities(obj, args, context, info),
    updatePriorities: (obj, args, context, info) => priority.updatePriorities(obj, args, context, info),
  },
};

module.exports = { resolvers };

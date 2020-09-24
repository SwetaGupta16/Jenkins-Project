const projectService = require('../../services').project;

const getProject = async (obj, args, context) => await projectService.getUserProject(args, context);

const getOrganizationProject = async (obj, args, context) => await projectService.getOrganizationProject(args, context);

const getProjects = async (obj, args, context) => await projectService.getUserProjectsDetails(args, context);

const getOrganizationProjects = async (obj, args, context) => await projectService.getOrganizationProjects(args, context);

const getUserProjects = async (obj, args, context) => await projectService.getUserProjects(args, context);

const checkIfProjectExists = async (obj, args, context) => await projectService.checkIfProjectExists(args, context);

const checkIfProjectKeyExists = async (obj, args, context) => await projectService.checkIfProjectKeyExists(args, context);

const create = async (obj, args, context) => await projectService.createProject(args, context);

const deleteProject = async (obj, args, context) => await projectService.deleteProject(args, context);

const updateProject = async (obj, args, context) => await projectService.updateProject(args, context);

module.exports = {
  getProject,
  getOrganizationProject,
  getProjects,
  getOrganizationProjects,
  getUserProjects,
  checkIfProjectExists,
  checkIfProjectKeyExists,
  create,
  deleteProject,
  updateProject,
};

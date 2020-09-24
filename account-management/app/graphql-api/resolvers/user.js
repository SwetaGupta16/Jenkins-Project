const userService = require('../../services').user;

const getUser = async (obj, args, context) => await userService.getUser(args, context);

const getUsers = async (obj, args, context) => await userService.getUsers(args, context);

const getUsersByStatus = async (obj, args, context) => await userService.getUsersByStatus(args, context);

const getNonProjectMembers = async (obj, args, context) => await userService.getNonProjectMembers(args, context);

const create = async (obj, args, context) => await userService.createUsers(args, context);

const allocateUsersToProject = async (obj, args, context) => await userService.allocateUsersToProject(args, context);

const deallocateUsersFromProject = async (obj, args, context) => await userService.deallocateUsersFromProject(args, context);

const changeRole = async (obj, args, context) => await userService.changeRole(args, context);

const deleteUser = async (obj, args, context) => await userService.deleteUser(args, context);

module.exports = {
  getUser,
  getUsers,
  getUsersByStatus,
  getNonProjectMembers,
  create,
  allocateUsersToProject,
  deallocateUsersFromProject,
  changeRole,
  deleteUser,
};

const executor = require('../../executor');
const utils = require('../../utils');
const generalUtils = require('../../../../utils');
const logManager = require('../../../../../log-manager');
const logger = logManager.logger(__filename);

const { uuid } = generalUtils;
const { dateTime } = generalUtils;

const LABELS = {
  userInvitationToken: 'UserInvitationToken',
  user: 'User',
};

const RELATIONSHIPS = {
  hasInvitationToken: 'HAS_INVITATION_TOKEN',
};

/**
 *Creates a new InvitationToken for invited user
 *
 * @param {*} context
 * @param {*} user
 * @returns {*} User invitation token with accessId
 */
const create = async (context) => {
  logger.debug('>> create()');
  const tokenProps = {
    accessId: uuid.uuidWithoutHyphens(),
    generatedAt: dateTime.current(),
  };

  const invitationToken = await executor.createNode(context, [LABELS.userInvitationToken], tokenProps);
  const result = utils.simplifyIntegerTypes(invitationToken);
  logger.debug('>> create()');
  return result;
};

/**
 *Deletes user invitation token node with it's relationships
 *
 * @param {*} tx
 * @param {*} tokenProps
 */
const deleteNode = async (tx, tokenProps) => {
  logger.debug('>> deleteNode()');
  await executor.deleteNode(tx, [LABELS.userInvitationToken], tokenProps);
  logger.debug('<< deleteNode()');
};

/**
 *Reads user invitation token node
 *
 * @param {*} tx
 * @param {*} userProps
 */
const readByUserId = async (tx, userProps) => {
  logger.debug('>> readByUserId()');
  const query = `MATCH (user:${LABELS.user}{userId:$userId})-[r1:${RELATIONSHIPS.hasInvitationToken}]->(token:${LABELS.userInvitationToken}) RETURN token`;
  const params = {
    userId: userProps.userId,
  };

  const result = await executor.read(query, params, tx);

  const returnValue = result.records.map((record) => utils.simplifyIntegerTypes(record.get('token').properties));
  logger.debug('<< readByUserId()');
  return returnValue;
};

module.exports = {
  create,
  deleteNode,
  readByUserId,
  LABELS,
};

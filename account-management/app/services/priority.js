const srpService = require('./scopeRolePrivilege');
const driverManager = require('../dal/graph-db/driver-manager');
const { priority } = require('../dal/graph-db/models/nodes');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);
const errors = require('../errors');

const ERROR_MESSAGES = {
  rollback: 'Exception occurred while rolling back DB operation.',
};

const updatePriorities = async (args, context) => {
  logger.debug('>> updatePriorities()');
  let tx = null;
  let session = null;
  let returnValue = false;

  try {
    srpService.hasUpdateProjectPrivilege(context, tx);
    const { projectId } = args;
    const prioritiesInput = args.updatePriorityInput;
    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;

    const priorityMap = await priority.readPriorityNodesByProjectId(projectId, context);
    for (let index = 0; index < prioritiesInput.length; index++) {
      const priorityNode = priorityMap.get(prioritiesInput[index].priorityId);
      if (priorityNode) {
        const priorityProps = { ...priorityNode };
        priorityProps.value = prioritiesInput[index].value;
        await priority.updatePriority(context, prioritiesInput[index].priorityId, priorityProps);
      }
      else {
        const errMsg = `Priority with id '${prioritiesInput[index].priorityId}' not found.`;
        logger.error(errMsg);
        throw errors.NotFound('PRIORITY', errMsg);
      }
    }

    await tx.commit();
    returnValue = true;
  }
  catch (err) {
    if (tx !== null) {
      try {
        await tx.rollback();
      }
      catch (rollbackError) {
        logger.error(`${ERROR_MESSAGES.rollback} ${rollbackError}`);
      }
    }
    throw err;
  }
  finally {
    driverManager.closeSession(session);
  }
  logger.debug('<< updatePriorities()');
  return returnValue;
};

module.exports = {
  updatePriorities,
};

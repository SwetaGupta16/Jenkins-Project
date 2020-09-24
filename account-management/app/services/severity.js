const srpService = require('./scopeRolePrivilege');
const driverManager = require('../dal/graph-db/driver-manager');
const { severity } = require('../dal/graph-db/models/nodes');
const errors = require('../errors');
const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);

const ERROR_MESSAGES = {
  rollback: 'Exception occurred while rolling back DB operation.',
};

const updateSeverities = async (args, context) => {
  logger.debug('>> updateSeverities()');
  let tx = null;
  let session = null;
  let returnValue = false;

  try {
    srpService.hasUpdateProjectPrivilege(context, tx);
    const { projectId } = args;
    const severitiesInput = args.updateSeverityInput;
    session = driverManager.getWriteSession();
    tx = session.beginTransaction();
    context.tx = tx;

    const severityMap = await severity.readSeverityNodesByProjectId(projectId, context);
    for (let index = 0; index < severitiesInput.length; index++) {
      const severityNode = severityMap.get(severitiesInput[index].severityId);
      if (severityNode) {
        const severityProps = { ...severityNode };
        severityProps.value = severitiesInput[index].value;
        await severity.updateSeverity(context, severitiesInput[index].severityId, severityProps);
      }
      else {
        const errMsg = `Severity with id '${severitiesInput[index].severityId}' not found.`;
        logger.error(errMsg);
        throw errors.NotFound('SEVERITY', errMsg);
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
  logger.debug('<< updateSeverities()');
  return returnValue;
};

module.exports = {
  updateSeverities,
};

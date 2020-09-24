const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);
const srpNode = require('../dal/graph-db/models/nodes').scopeRolePrivilege;

let isSetupDone = false;
/**
 * This middleware is for setting up roles privileges in in-memory data structure
 */
module.exports = async function (req, res, next) {
  logger.debug('Scope role privilege middleware >>');
  try {
    if (!isSetupDone) {
      isSetupDone = await srpNode.setup();
    }
    logger.debug('calling next()');
    next();
  }
  catch (err) {
    logger.error(`Exception occurred while setting up role privileges in in-memory data structure.\nMessage=> ${err}\nStack=> ${err.stack}`);
    res.status(500).send('DB response failed');
  }
};

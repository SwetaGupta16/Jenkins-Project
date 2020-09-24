const config = require('config');

const logManager = require('../../log-manager');
const logger = logManager.logger(__filename);

/**
 * Its a middleware which extracts userId from the headers of a request.
 */
module.exports = function (req, res, next) {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development';
    req.userId = isDevelopment ? config.get('local.userId') : JSON.parse(req.headers.user).scope.user_id;
    req.organizationId = isDevelopment ? config.get('local.organizationId') : JSON.parse(req.headers.user).scope.organization_id;
    req.businessUnitId = isDevelopment ? config.get('local.businessUnitId') : JSON.parse(req.headers.user).scope.business_unit_id;

    logger.debug(`req.userId: ${req.userId}`);
    logger.debug(`req.organizationId: ${req.organizationId}`);
    logger.debug(`req.businessUnitId: ${req.businessUnitId}`);

    logger.debug('calling next()');
    next();
  }
  catch (err) {
    logger.debug(err);
    res.status(403).send('Forbidden');
  }
};

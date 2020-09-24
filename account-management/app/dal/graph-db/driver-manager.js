const logManager = require('../../../log-manager');
const neo4j = require('neo4j-driver').v1;
const config = require('config');

const logger = logManager.logger(__filename);
const ERR_MESSAGES = {
  setupFailure: 'Failed to create neo4j driver object.',
  tearDownFailure: 'Failed to close neo4j driver.',
  readSessionFailure: 'Failed to create read session.',
  writeSessionFailure: 'Failed to create write session.',
  closeSessionFailure: 'Failed to close session..',
};

// Neo4j credentials
const neo4jConfig = config.get('neo4j');
const URI = neo4jConfig.boltURI;
const USER_NAME = neo4jConfig.userName;
const PASSWORD = neo4jConfig.password;

let driver = null;

/**
 *Creates a neo4j driver object if it is already not created.
 *
 * @returns {*} neo4j driver object
 */
const setup = () => {
  try {
    if (driver === null) {
      driver = neo4j.driver(URI, neo4j.auth.basic(USER_NAME, PASSWORD), {
        maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 10 * 60 * 1000, // 120 seconds,
        maxTransactionRetryTime: 60 * 1000, // 15 seconds
      });
    }
    return driver;
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.setupFailure} ${err}`);
    throw err;
  }
};

/**
 *Returns neo4j driver.
 *
 * @returns neo4j driver
 */
const getDriver = () => driver;

/**
 *Closes neo4j driver. Along with this all open sessions also get closed.
 *
 * @returns
 */
const tearDown = () => {
  try {
    if (driver === null) {
      return;
    }
    driver.close();
    driver = null;
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.tearDownFailure} ${err}`);
    throw err;
  }
};

/**
 *Creates and returns a new read session.
 *
 * @returns Read session
 */
const getReadSession = () => {
  try {
    return driver.session(neo4j.session.READ);
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.readSessionFailure} ${err}`);
    throw err;
  }
};

/**
 *Creates and returns  a new write session
 *
 * @returns Write session
 */
const getWriteSession = () => {
  try {
    return driver.session(neo4j.session.WRITE);
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.writeSessionFailure} ${err}`);
    throw err;
  }
};

/**
 *Closes an open session.
 *
 * @param {*} session
 */
const closeSession = (session) => {
  try {
    if (session !== null) {
      session.close();
    }
  }
  catch (err) {
    logger.error(`${ERR_MESSAGES.closeSessionFailure} ${err}`);
    throw err;
  }
};

/**
 *Checks if provided object is an neo4j Integer type or not
 *
 * @param {*} obj
 * @returns {*} Boolean
 */
const isInt = (obj) => neo4j.isInt(obj);

/**
*Converts javascript Integer type into neo4j Integer type so it is ready to be saved in neo4j DB.
*If not converted neo4j driver stores javascript Integer type as float
*
@param {} obj
* @returns
*/
const getInt = (obj) => neo4j.int(obj);

module.exports = {
  setup,
  getDriver,
  getReadSession,
  getWriteSession,
  closeSession,
  tearDown,
  isInt,
  getInt,
};

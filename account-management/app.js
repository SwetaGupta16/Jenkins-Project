const config = require('config');
const cron = require('node-cron');

/*
Configure log-manager immediately as it first loaded in app.js
So when other modules gets loaded which use logger they will throw exception due to missing configuration.
Configuration is one time.
*/
const logManager = require('./log-manager');
logManager.configure(config.get('accountManagement.logging'));

const express = require('express');
const dbDriverManager = require('./app/dal/graph-db/driver-manager');
// const srpNode = require('./app/dal/graph-db/models/nodes').scopeRolePrivilege;

const logger = logManager.logger(__filename);

process.on('uncaughtException', (error) => {
  logger.error(`Exception occurred while starting Account Management service. ${error}`);
});

dbDriverManager.setup();

// Configure and start service
const PORT = config.get('accountManagement.port');
const app = express();
// <development-script> <set-cors> Dont remove this comment
app.use('/', require('./app/router'));
const server = app.listen(PORT, () => logger.info(`Account Management service is running on port: ${PORT}`));
server.setTimeout(30 * 60 * 1000); // 30 minutes timeout on every request
module.exports = server;
// srpNode.setup();

const { issue } = require('./app/services');
cron.schedule(`${config.get('syncTime')}`, () => {
  try {
    issue.autoSyncIssues();
  }
  catch (err) {
    logger.error(`Message=> ${err} \nStack=> ${err.stack}`);
  }
});

// Close all resources while application gets closed
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) =>
  process.on(signal, () => {
    if (server !== null) {
      server.close();
    }
    dbDriverManager.tearDown();
    process.exit();
  }),
);

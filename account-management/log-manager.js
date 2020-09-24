const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const path = require('path');
let logFilename;
let logLevel;

/**
 *Configures settings required by logger like - LogDirectory, LogFile, LogLevel
 *
 * @param {*} configuration
 */
const configure = (configuration) => {
  const { logDir, logFileName, logLevel: level } = configuration;
  // Create the log directory if it does not exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  logFilename = path.join(logDir, logFileName);
  logLevel = level;
};

/**
 *Based on configuration settings provided in configure() function creates and returns logger object.
 *
 * @param {*} caller
 * @returns {*} Logger object
 */
const logger = (caller) =>
  createLogger({
    level: logLevel,
    format: format.combine(format.label({ label: path.basename(caller) }), format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })),
    transports: [
      new transports.File({
        filename: logFilename,
        format: format.combine(
          format.printf((info) => {
            console.log(`${info.timestamp} ${info.level} [${info.label}]: ${info.message}`);
            return `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`;
          }),
        ),
      }),
    ],
  });

module.exports = {
  logger,
  configure,
};

// Do all the setup required before running unit test here
const mock = require('mock-require');

const noop = () => null;

// Mock logger whenever running unit test cases
mock('../../log-manager', {
  configure: noop,
  logger: () => ({
    debug: noop,
    error: noop,
    info: noop,
    log: noop,
    warn: noop,
  }),
});

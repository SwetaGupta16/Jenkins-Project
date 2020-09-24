const chai = require('chai');
const factories = require('chai-js-factories');
const merge = require('deepmerge');

chai.use(factories);

chai.factory.define('user', (data = {}) => {
  const mock = require('./user').generate();
  return merge(mock, data);
});

chai.factory.define('organization', (data = {}) => {
  const mock = require('./organization').generate();
  return merge(mock, data);
});

chai.factory.define('client', (data = {}) => {
  const mock = require('./client').generate();
  return merge(mock, data);
});

chai.factory.define('project', (data = {}) => {
  const mock = require('./project').generate();
  return merge(mock, data);
});

chai.factory.define('configuration', (data = {}) => {
  const mock = require('./configuration').generate();
  return merge(mock, data);
});

chai.factory.define('rmt', (data = {}) => {
  const mock = require('./rmt').generate();
  return merge(mock, data);
});

module.exports = chai.factory;

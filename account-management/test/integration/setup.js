const prepare = require('mocha-prepare');
const mock = require('mock-require');
const request = require('supertest');

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

const factory = require('../factories');
const driverManager = require('../../app/dal/graph-db/driver-manager');
const executor = require('../../app/dal/graph-db/executor');
const { createDefaultRolesAndPrivileges } = require('./defaultRolesAndPrivileges');
const server = require('../../app');

const userId = 'int-test-admin';
const userEmail = 'admin@qualitiasoft.com';
const projectId = 'int-test-project';
const organizationId = 'int-test-organization';
const businessUnitId = 'int-test-businessUnitId';
const clientId = 'int-test-client';

global.qds = {
  userId,
  projectId,
  organizationId,
  businessUnitId,
  clientId,
  userEmail,
  context: {
    userId,
    projectId,
    organizationId,
    businessUnitId,
    clientId,
  },
  scope: {
    scope: { user_id: userId, organization_id: organizationId, business_unit_id: businessUnitId, client_id: clientId },
  },
};

const user = factory.create('user', { name: 'Admin', userId: global.qds.userId, email: global.qds.userEmail });
const project = factory.create('project', { projectId: global.qds.projectId });
const organization = factory.create('organization', { organizationId: global.qds.organizationId });
const client = factory.create('client', { clientId: global.qds.clientId });

prepare(
  async (done) => {
    // Setup fake client, organization, user, roles and privileges every time we run integration tests
    await driverManager.setup();
    const session = driverManager.getWriteSession();
    const tx = session.beginTransaction();
    const context = Object.assign({}, global.qds.context, { tx });
    const userExists = !!(await executor.read(`MATCH (n :User {userId: '${userId}'}) RETURN n`)).records.length;
    const projectExists = !!(await executor.read(`MATCH (n :Project {projectId: '${projectId}'}) RETURN n`)).records.length;
    const organizationExists = !!(await executor.read(`MATCH (n :Organization {organizationId: '${organizationId}'}) RETURN n`)).records.length;
    const clientExists = !!(await executor.read(`MATCH (n :Client {clientId: '${clientId}'}) RETURN n`)).records.length;

    if (!userExists) {
      await executor.createNode(context, ['User'], user);
    }
    if (!projectExists) {
      await executor.createNode(context, ['Project'], project);
    }
    if (!organizationExists) {
      await executor.createNode(context, ['Organization'], organization);
    }
    if (!clientExists) {
      await executor.createNode(context, ['Client'], client);
    }
    await tx.commit();
    await createDefaultRolesAndPrivileges();
    // spin up the test server
    const testServer = request(server);
    const post = new Proxy(testServer.post, {
      apply: (target, _thisArg, argumentsList) =>
        target(...argumentsList).set(
          'user',
          JSON.stringify({
            scope: {
              user_id: userId,
              organization_id: organizationId,
              business_unit_id: businessUnitId,
            },
          }),
        ),
    });
    testServer.graphql = (query) =>
      testServer
        .post('/api/v1/q/ds/accountmanagement')
        .type('form')
        .send({ query });
    global.qds.server = Object.assign(testServer, { post });
    done();
  },
  async (done) => {
    console.log('Finished running integration test');
    done();
    process.exit();
  },
);

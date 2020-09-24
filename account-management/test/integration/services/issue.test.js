const { expect } = require('chai');
const sinon = require('sinon');
const faker = require('faker');
const { userId, userEmail, projectId, organizationId, server } = global.qds;
const { dataCreator, createNodeObject } = require('../utils');
const { projectLabel, organizationLabel } = require('../../../app/dal/graph-db/utils');
const { LABELS, RELATIONSHIPS } = require('../../../app/dal/graph-db/labelsAndRelations');
const project = projectLabel(projectId);
const organization = organizationLabel(organizationId);
const factory = require('../../factories');

describe('ISSUE API INTEGRATION TESTS', () => {
  beforeEach(async () => {
    this.sandbox = sinon.createSandbox();
    const { createNode, createRelationship, cleanup } = await dataCreator();
    this.createNode = createNode;
    this.createRelationship = createRelationship;
    this.cleanup = cleanup;
  });

  afterEach(async () => {
    this.sandbox.restore();
    await this.cleanup();
  });

  it('#POST /syncStatus - should return sync status true if not in sync state.', async () => {
    const configuration = factory.create('configuration');
    await this.createNode([LABELS.configuration], configuration);
    this.createRelationship(createNodeObject([LABELS.project], { projectId }), createNodeObject([LABELS.configuration], { configurationId: configuration.configurationId }), RELATIONSHIPS.hasConfiguration);

    const rmt = factory.create('rmt', { syncStatus: true });
    await this.createNode([LABELS.rmt], rmt);
    this.createRelationship(createNodeObject([LABELS.configuration], { configurationId: configuration.configurationId }), createNodeObject([LABELS.rmt], { rmtId: rmt.rmtId }), RELATIONSHIPS.hasRMTConfiguration);
    const response = await server.graphql(`
            query {
                syncStatus(projectId: "${projectId}")
            }
        `);
    expect(response.body.data).to.not.be.empty;
    expect(response.body.data.syncStatus).to.be.true;
  });

  it('#POST /syncStatus - should return error if project id is invalid.', async () => {
    const response = await server.graphql(`
            query {
                syncStatus(projectId: "")
            }
        `);
    expect(response.body.errors).to.not.be.empty;
    expect(response.body.errors).to.be.length(1);
    expect(response.body.errors[0].error).to.be.equal('ValidationError.PROJECT_ID_MANDATORY');
  });

  it('#POST /syncStatus - should return error if project not associated with any rmt.', async () => {
    const response = await server.graphql(`
            query {
                syncStatus(projectId: "${projectId}")
            }
        `);
    expect(response.body.errors).to.not.be.empty;
    expect(response.body.errors).to.be.length(1);
    expect(response.body.errors[0].error).to.be.equal('ServiceError.RMT_NOT_FOUND');
  });
});

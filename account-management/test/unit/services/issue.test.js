const { expect } = require('chai');
const sinon = require('sinon');
const faker = require('faker');
const { getSyncStatus } = require('../../../app/services/issue');
const { rmt: rmtNode } = require('../../../app/dal/graph-db/models/nodes');
const factory = require('../../factories');
const rmt = factory.create('rmt');

describe('Issue Service Operations', () => {
  beforeEach(() => {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    this.sandbox.restore();
  });
  describe('Get Sync Status', () => {
    it('should return true if project in not performing sync operation.', async () => {
      const args = { projectId: faker.random.uuid() };
      const data = [];
      const rmtDetails = Object.assign({}, rmt, { syncStatus: true });
      data.push(rmtDetails);
      this.sandbox.stub(rmtNode, 'readRMTDetailsByProjectId').returns(data);
      const result = await getSyncStatus(args);
      expect(result).to.be.true;
    });

    it('should return false if project in not performing sync operation.', async () => {
      const args = { projectId: faker.random.uuid() };
      const data = [];
      const rmtDetails = Object.assign({}, rmt, { syncStatus: false });
      data.push(rmtDetails);
      this.sandbox.stub(rmtNode, 'readRMTDetailsByProjectId').returns(data);
      const result = await getSyncStatus(args);
      expect(result).to.be.false;
    });

    it('should give an error if project id is not passed.', async () => {
      const args = {};
      try {
        await getSyncStatus(args);
      } catch (err) {
        expect(err).to.include.keys('message');
        expect(err.code).to.contain('PROJECT_ID');
      }
    });

    it('should give an error if no rmt is associated with the project.', async () => {
      try {
        const args = { projectId: faker.random.uuid() };
        const data = [];
        this.sandbox.stub(rmtNode, 'readRMTDetailsByProjectId').returns(data);
        await getSyncStatus(args);
      } catch (err) {
        expect(err).to.include.keys('message');
        expect(err.code).to.contain('RMT');
      }
    });
  });
});

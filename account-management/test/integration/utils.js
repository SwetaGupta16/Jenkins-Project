const driverManager = require('../../app/dal/graph-db/driver-manager');
const executor = require('../../app/dal/graph-db/executor');

const getTransaction = async () => {
  const session = driverManager.getWriteSession();
  return session.beginTransaction();
};

const createNodeObject = (labels, properties) => ({ labels, properties });

const dataCreator = async () => {
  const nodes = [];
  const relationships = [];
  await driverManager.setup();
  return {
    createNode: async (labels, properties, qdsContext = global.qds.context) => {
      const tx = await getTransaction();
      const context = Object.assign({}, qdsContext, { tx });
      nodes.push({ labels, properties });
      await executor.createNode(context, labels, properties);
      await tx.commit();
    },
    createRelationship: async (source, destination, relationship, properties, qdsContext = global.qds.context) => {
      const tx = await getTransaction();
      const context = Object.assign({}, qdsContext, { tx });
      relationships.push({ source, destination, relationship });
      await executor.createRelationship(context, source, destination, relationship, properties);
      await tx.commit();
    },
    cleanup: async () => {
      const deleteRelationshipsRequst = relationships.map(async ({ source, destination, relationship }) => {
        const tx = await getTransaction();
        await executor.deleteRelationship(tx, source, destination, relationship);
        await tx.commit();
      });
      await Promise.all(deleteRelationshipsRequst);
      const deleteNodesRequest = nodes.map(async ({ labels, properties }) => {
        const tx = await getTransaction();
        await executor.deleteNode(tx, labels, properties);
        await tx.commit();
      });
      // delete all relationships before deleting nodes
      await Promise.all(deleteNodesRequest);
    },
    nodes,
    relationships,
  };
};

module.exports = {
  createNodeObject,
  dataCreator,
};

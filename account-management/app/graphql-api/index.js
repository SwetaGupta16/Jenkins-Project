const logManager = require('../../log-manager');
const graphqlHTTP = require('express-graphql');
const graphqlTools = require('graphql-tools');
const { makeExecutableSchema } = graphqlTools;
const typedefs = require('./schemas').typeDefs;
const { resolvers } = require('./resolvers');

const logger = logManager.logger(__filename);

const site = (request, response) => {
  response.send('Welcome to Account Management Server.');
};

// Combine all stringized Schema types and their resolvers into executable and return as middleware.
const graphQLSchema = makeExecutableSchema({
  typeDefs: typedefs,
  resolvers,
});

// This middleware is used to intercept all graphql request and invoking respective resolver.
const middleware = graphqlHTTP({
  schema: graphQLSchema,
  graphiql: true,
  formatError (err) {
    const logMsg = err.stack || err;
    logger.error(logMsg);

    return {
      error_description: err.message,
      error: (err.originalError && err.originalError.code) || 'ServiceError',
      locations: err.locations,
      path: err.path,
    };
  },
});

module.exports = {
  site,
  middleware,
};

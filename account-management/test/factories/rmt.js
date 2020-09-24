const faker = require('faker');

const generate = () => ({
  rmtId: faker.random.alphaNumeric(32),
  createdAt: faker.date.past().toString(),
  updatedAt: faker.date.past().toString(),
  lastSynced: faker.date.past().toString(),
  syncStatus: faker.random.boolean(),
});

module.exports = { generate };

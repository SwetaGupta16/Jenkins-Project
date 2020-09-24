const faker = require('faker');

const generate = () => ({
  organizationId: faker.random.alphaNumeric(32),
  createdAt: faker.date.past().toString(),
  name: faker.random.word(),
  updatedAt: faker.date.past().toString(),
});

module.exports = { generate };

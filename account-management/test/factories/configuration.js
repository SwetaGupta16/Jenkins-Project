const faker = require('faker');

const generate = () => ({
  configurationId: faker.random.alphaNumeric(32),
  createdAt: faker.date.past().toString(),
  updatedAt: faker.date.past().toString(),
});

module.exports = { generate };

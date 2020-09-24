const faker = require('faker');

const generate = () => ({
  createdAt: faker.date.past().toString(),
  name: faker.random.words(5),
  description: faker.random.words(15),
  projectId: faker.random.alphaNumeric(32),
  keyCounter: faker.random.number(),
  key: faker.random.word(),
  updatedAt: faker.date.past().toString(),
  status: 'Active',
});

module.exports = { generate };

const faker = require('faker');

const generate = () => ({
  name: faker.random.words(2),
  clientId: faker.random.alphaNumeric(32),
  id: faker.random.alphaNumeric(32),
  redirectURI: faker.internet.url(),
  clientSecret: faker.random.alphaNumeric(20),
  type: faker.random.word(),
});

module.exports = { generate };

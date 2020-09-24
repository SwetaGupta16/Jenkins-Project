const faker = require('faker');

const generate = () => ({
  createdAt: faker.date.past().toString(),
  updatedAt: faker.date.past().toString(),
  name: faker.name.findName(),
  phoneNumber: faker.phone.phoneNumber(),
  email: faker.internet.email(),
  status: 'Active',
  lastLoggedIn: faker.date.past().toString(),
  userId: faker.internet.userName(),
  password: faker.internet.password(),
});

module.exports = { generate };

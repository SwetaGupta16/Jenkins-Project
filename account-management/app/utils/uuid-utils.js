const uuidv4 = require('uuid/v4');

/**
 *Creates a new v4 uuid and returns it without hyphens
 *
 * @returns {*} uuid without hyphens
 */
const uuidWithoutHyphens = () => {
  const uuid = uuidv4();
  return uuid.replace(/-/g, '');
};

module.exports = {
  uuidWithoutHyphens,
};

/**
 *Compares if two strings are equal or not.
 *This is case insensitive comparison
 *
 * @param {*} string1
 * @param {*} string2
 * @returns {*} Boolean
 */
const equalsIgnoreCase = (string1, string2) => string1.toLowerCase() === string2.toLowerCase();

/**
 *Compares if two strings are equal or not.
 *This is case sensitive comparison
 *
 * @param {*} string1
 * @param {*} string2
 * @returns {*} Boolean
 */
const equals = (string1, string2) => string1 === string2;

module.exports = {
  equals,
  equalsIgnoreCase,
};

const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;
const config = require('config');
const crypto = require('crypto');
const ENCRYPTION_KEY = config.get('encryptionKey'); // Must be 256 bytes (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

/**
 *Creates a hashed version of provided plain text
 *
 * @param {*} text
 * @returns
 */
const hash = async (text) => {
  const result = await bcrypt.hash(text, SALT_ROUNDS);
  return result;
};

const encrypt = async (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = async (text) => {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

module.exports = {
  hash,
  encrypt,
  decrypt,
};

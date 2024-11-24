const bcrypt = require('bcrypt');z
const crypto = require('crypto');
require('dotenv').config(); // Ensure .env variables are loaded

// Secret key for encryption (from .env file)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte key for AES-256
const IV_LENGTH = 16; // For AES, the IV length is 16 bytes

// Encryption function
const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH); // Generate random IV
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

// Decryption function
const decrypt = (encrypted) => {
  const [iv, encryptedText] = encrypted.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Middleware to encrypt specific fields before saving
exports.encryptFieldsMiddleware = (fields) => {
  return function (next) {
    fields.forEach(field => {
      if (this[field]) {
        this[field] = encrypt(this[field]);
      }
    });
    next();
  };
};

// Middleware to decrypt fields after retrieving data
exports.decryptFieldsMiddleware = (fields) => {
  return function (doc) {
    if (doc) {
      fields.forEach(field => {
        if (doc[field]) {
          doc[field] = decrypt(doc[field]);
        }
      });
    }
    return doc;
  };
};

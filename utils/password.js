const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'Password123!';

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, verifyPassword, DEFAULT_PASSWORD };

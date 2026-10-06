/** JWT issuing/verification. Secrets never leave this module. */
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

function issueToken(user) {
  return jwt.sign(
    { role: user.role },
    config.jwt.secret,
    {
      subject: user._id.toString(),
      expiresIn: config.jwt.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

module.exports = { issueToken, verifyToken };

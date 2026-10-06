/** JWT issuing/verification. Secrets never leave this module. */
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

function issueToken(user) {
  return jwt.sign(
    // `tv` is the session generation. auth.middleware compares it against the
    // stored value, so revoking tokens does not require a server-side list.
    { role: user.role, tv: user.tokenVersion || 0 },
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

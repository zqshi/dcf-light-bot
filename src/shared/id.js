const { randomUUID } = require('crypto');

function newId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

module.exports = { newId };

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function newTempStorePath(prefix = 'dcf-light-bot-test') {
  const p = path.join('/tmp', `${prefix}-${randomUUID()}.json`);
  return p;
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {}
}

module.exports = { newTempStorePath, safeUnlink };

#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

function main() {
  const lock = JSON.parse(fs.readFileSync('versions.lock.json', 'utf8'));
  const openclaw = lock && lock.openclaw ? lock.openclaw : {};
  const sourcePath = String(openclaw.sourcePath || '').trim();
  const expectedCommit = String(openclaw.commit || '').trim();

  if (!sourcePath || !expectedCommit) {
    throw new Error('versions.lock.json missing openclaw sourcePath or commit');
  }

  const actualCommit = execSync(`git -C "${sourcePath}" rev-parse HEAD`, { stdio: ['ignore', 'pipe', 'pipe'] })
    .toString('utf8')
    .trim();

  if (actualCommit !== expectedCommit) {
    throw new Error(`OpenClaw lock mismatch. expected=${expectedCommit} actual=${actualCommit}`);
  }

  console.log(JSON.stringify({ ok: true, sourcePath, commit: actualCommit }));
}

main();

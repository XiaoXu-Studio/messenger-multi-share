const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const files = require('./files.cjs');
const { safePath, validateArchiveNames } = require('./package-safety.cjs');
const root = path.resolve(__dirname, '..');
const archives = fs.readdirSync(root).filter(name => /^messenger-multi-share-v\d+\.\d+\.\d+\.zip$/.test(name));
assert.equal(archives.length, 1, 'Exactly one release ZIP expected');
const archive = path.join(root, archives[0]);
assert.ok(safePath(root, archives[0]).isFile(), 'Expected regular archive');
const names = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split(/\r?\n/);
validateArchiveNames(names);
for (const file of files) {
  assert.ok(safePath(root, file).isFile(), 'Expected regular source');
  const packaged = execFileSync('unzip', ['-p', archive, file]);
  assert.ok(packaged.equals(fs.readFileSync(path.join(root, file))), 'ZIP contents mismatch: ' + file);
}
console.log('Verified ZIP structure and every file against source.');

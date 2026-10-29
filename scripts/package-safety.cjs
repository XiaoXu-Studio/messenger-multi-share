const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const files = require('./files.cjs');
const directories = new Set(files.flatMap(file => {
  const parts = file.split('/'); parts.pop();
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
}));

function safePath(root, relative, allowMissing = false) {
  assert.ok(relative && !path.isAbsolute(relative) && !relative.includes('\\') &&
    relative.split('/').every(part => part && part !== '.' && part !== '..'), 'Invalid package path');
  let current = root;
  const parts = relative.split('/');
  for (let index = -1; index < parts.length; index++) {
    if (index >= 0) current = path.join(current, parts[index]);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat && allowMissing) return null;
    assert.ok(stat && !stat.isSymbolicLink(), 'Missing path or symbolic link: ' + relative);
    if (index < parts.length - 1) assert.ok(stat.isDirectory(), 'Expected directory: ' + relative);
    else return stat;
  }
}

function validateDist(root) {
  const stat = safePath(root, 'dist', true);
  if (!stat) return;
  assert.ok(stat.isDirectory(), 'dist must be a directory');
  const walk = relative => {
    for (const name of fs.readdirSync(path.join(root, 'dist', relative))) {
      const entry = relative ? relative + '/' + name : name;
      const metadata = safePath(root, 'dist/' + entry);
      if (metadata.isDirectory()) {
        assert.ok(directories.has(entry), 'Unexpected directory in dist: ' + entry);
        walk(entry);
      } else {
        assert.ok(files.includes(entry) && metadata.isFile() && metadata.nlink === 1,
          'Unexpected, linked or non-regular file in dist: ' + entry);
      }
    }
  };
  walk('');
}

function validateArchiveNames(names) {
  assert.equal(new Set(names).size, names.length, 'Duplicate ZIP entries');
  for (const name of names.filter(name => name.endsWith('/')))
    assert.ok(directories.has(name.slice(0, -1)), 'Unexpected ZIP directory: ' + name);
  assert.deepEqual(names.filter(name => !name.endsWith('/')).sort(), [...files].sort(),
    'ZIP must have the manifest at root and only release files');
}
module.exports = { safePath, validateDist, validateArchiveNames };

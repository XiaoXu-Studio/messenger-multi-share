// byUS小序
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const files = require('./files.cjs');
const { safePath, validateDist } = require('./package-safety.cjs');
const root = path.resolve(__dirname, '..');
for (const file of ['manifest.json', 'package.json']) assert.ok(safePath(root, file).isFile(), 'Expected regular file');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
assert.ok(manifest.background && manifest.action, 'Not a browser extension');
if (process.env.GITHUB_REF_TYPE === 'tag') assert.equal(process.env.GITHUB_REF_NAME, 'v' + manifest.version, 'Tag and manifest version must match');
const dist = path.join(root, 'dist');
// Preflight everything before writing; never follow directory junctions or output hardlinks.
validateDist(root);
const prepared = files.map(file => {
  const source = path.join(root, file);
  const stat = safePath(root, file);
  assert.ok(stat.isFile() && stat.size <= 2 * 1024 * 1024, 'Invalid or oversized source file: ' + file);
  const bytes = fs.readFileSync(source);
  if (!file.endsWith('.png')) {
    const text = bytes.toString('utf8');
    assert.ok(!/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN .*PRIVATE KEY-----)/.test(text), 'Possible credential in package');
    if (file.endsWith('.js')) new vm.Script(text, { filename: file });
  }
  return { file, bytes };
});
for (const { file, bytes } of prepared) {
  const destination = path.join(dist, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const stat = safePath(root, 'dist/' + file, true);
  assert.ok(!stat || (stat.isFile() && stat.nlink === 1), 'Unsafe build destination');
  fs.writeFileSync(destination, bytes);
}
console.log(`Built extension v${manifest.version}: ${files.length} allowlisted files; no runtime dependencies.`);

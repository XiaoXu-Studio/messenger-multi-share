// Verify the installed tree AND the inputs actually used to build each action.
// An audit of package-lock alone is not evidence about an old prebuilt bundle.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const base = __dirname;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const normalized = value => value.replaceAll('\\', '/');
const local = new Map([
  ['deepmerge', ['@browser-audio/deepmerge-security-backport', '4.3.1-patch.1']],
  ['http-cache-semantics', ['@browser-audio/http-cache-semantics-security-backport', '4.3.0-patch.1']]
]);
const results = [];
for (const tool of ['attest', 'release']) {
  const root = path.join(base, tool);
  const manifest = read(path.join(root, 'package.json'));
  const lockFile = path.join(root, 'package-lock.json');
  const lock = read(lockFile);
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.packages[''].version, manifest.version);
  for (const field of ['dependencies', 'devDependencies'])
    assert.deepEqual(lock.packages[''][field], manifest[field]);
  const inventory = [];
  for (const [entry, pkg] of Object.entries(lock.packages)) {
    if (!entry) continue;
    assert.ok(!pkg.deprecated, `Deprecated dependency requires review: ${entry}`);
    assert.match(entry, /^node_modules\//, `Unexpected lock path: ${entry}`);
    assert.ok(!entry.split('/').some(part => part === '..' || part === '.'), entry);
    assert.ok(!pkg.link, `Symlink dependency: ${entry}`);
    if (pkg.resolved?.startsWith('file:')) {
      const name = entry.slice('node_modules/'.length);
      assert.ok(local.has(name), `Unreviewed local dependency: ${entry}`);
      assert.equal(pkg.resolved, `file:../${name}`);
      assert.equal(pkg.name, local.get(name)[0]);
      assert.equal(pkg.version, local.get(name)[1]);
      for (const file of ['index.js', 'package.json'])
        assert.equal(sha256(path.join(root, entry, file)), sha256(path.join(base, name, file)), `Stale local package: ${name}/${file}`);
    } else {
      assert.match(pkg.resolved || '', /^https:\/\/registry\.npmjs\.org\//, entry);
      assert.match(pkg.integrity || '', /^sha512-[A-Za-z0-9+/]+={0,2}$/, entry);
    }
    const packageFile = path.join(root, entry, 'package.json');
    const installed = fs.existsSync(packageFile);
    assert.ok(installed || pkg.optional, `Missing required package: ${entry}`);
    if (installed) assert.equal(read(packageFile).version, pkg.version, `Version mismatch: ${entry}`);
    inventory.push({path: entry, name: pkg.name || entry.split('node_modules/').at(-1), version: pkg.version,
      development: !!pkg.dev, optional: !!pkg.optional, installed, integrity: pkg.integrity || null});
  }
  const inputs = new Set();
  if (tool === 'attest') {
    const stats = read(path.join(root, 'dist/stats.json'));
    assert.equal(stats.errorsCount, 0);
    function visit(modules) {
      for (const mod of modules || []) {
        if (mod.nameForCondition) inputs.add(normalized(path.relative(root, mod.nameForCondition)));
        visit(mod.modules);
      }
    }
    visit(stats.modules);
  } else {
    for (const file of Object.keys(read(path.join(root, 'dist/metafile.json')).inputs)) inputs.add(normalized(file));
  }
  const packages = new Set();
  for (const file of inputs) {
    assert.ok(!path.isAbsolute(file) && !file.startsWith('../'), `External build input: ${file}`);
    if (!file.startsWith('node_modules/')) continue;
    const entry = file.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)(?:\/|$)/)?.[1];
    assert.ok(lock.packages[entry], `Unlocked bundle input: ${file}`);
    packages.add(entry);
  }
  assert.ok([...packages].some(entry => entry.endsWith('/undici')));
  for (const entry of packages) {
    if (entry.endsWith('/undici')) assert.equal(lock.packages[entry].version, '6.29.1');
  }
  if (tool === 'attest') {
    assert.ok(packages.has('node_modules/http-cache-semantics'));
    assert.ok(packages.has('node_modules/@sigstore/core'));
    assert.equal(lock.packages['node_modules/@sigstore/core'].version, '3.2.1');
    assert.ok(inputs.has('node_modules/http-cache-semantics/index.js'));
    assert.match(fs.readFileSync(path.join(root, 'dist/index.js'), 'utf8'), /a request's max-stale must not bypass/);
  }
  const outputs = fs.readdirSync(path.join(root, 'dist')).filter(file => /\.(?:js|json|txt)$/.test(file) && !['stats.json', 'metafile.json', 'verification.json'].includes(file));
  assert.ok(outputs.includes('index.js'));
  const result = {tool, lockSha256: sha256(lockFile), installedPackageCount: inventory.filter(p => p.installed).length,
    bundledPackageCount: packages.size, bundledPackages: [...packages].sort(),
    files: outputs.map(file => ({file, sha256: sha256(path.join(root, 'dist', file))})), dependencies: inventory};
  fs.writeFileSync(path.join(root, 'dist/verification.json'), JSON.stringify(result, null, 2) + '\n');
  results.push({tool, installed: result.installedPackageCount, bundled: packages.size});
}
console.log('Verified locked, installed and bundled dependencies:', JSON.stringify(results));

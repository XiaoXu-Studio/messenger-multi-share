// Isolated, reproducible npm 12.2.1 with two official patch releases substituted.
// Never modifies the user's/global npm. No package lifecycle scripts are run.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const archives = [
  ['npm', '12.2.1', 'bKCmFRVT/BB+YPEYbZwQ1XUI3N5t4xKSpU1MxOjo7z3iWzKBJ0ZXRC1xFdEN+TC7N5TdywaBzf2dMXGJq/e2PQ=='],
  ['undici', '6.29.1', 'EvRlUt/QqAEvXdQeRMYUfwOQsfzpDztykrG2owGEE/rBOBoYv9uF39ZzsNDh4lTFHhTr2XOZjKkYgueD12ZmGA=='],
  ['ip-address', '10.7.4', 'DWBMKyeM25D70nrIiTkgQth59/G+naKOTep6huF9j+GmeK3DMD60Zvxg5d5qQnz+38AHgou6ean2LECX+lrKDg==']
];
async function setup(parent) {
  assert.ok(fs.statSync(parent).isDirectory());
  const directory = fs.mkdtempSync(path.join(path.resolve(parent), 'mms-npm-'));
  for (const [name, version, hash] of archives) {
    const response = await fetch(`https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`, { redirect: 'error', signal: AbortSignal.timeout(60000) });
    assert.ok(response.ok, `${name} download failed`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length < 16000000, 'Unexpected archive size');
    assert.equal(crypto.createHash('sha512').update(bytes).digest('base64'), hash, `${name} integrity failed`);
    const archive = path.join(directory, `${name}.tgz`), unpack = path.join(directory, name);
    fs.writeFileSync(archive, bytes, { flag: 'wx' });
    fs.mkdirSync(unpack);
    execFileSync('tar', ['-xzf', archive, '-C', unpack], { stdio: 'pipe' });
    const manifest = JSON.parse(fs.readFileSync(path.join(unpack, 'package/package.json'), 'utf8'));
    assert.equal(manifest.name, name);
    assert.equal(manifest.version, version);
  }
  const root = path.join(directory, 'npm/package');
  for (const [name] of archives.slice(1)) {
    const target = path.join(root, 'node_modules', name);
    // Keep original packages outside the runnable tree for traceability.
    fs.renameSync(target, path.join(directory, `original-${name}`));
    fs.renameSync(path.join(directory, name, 'package'), target);
  }
  const cli = path.join(root, 'bin/npm-cli.js');
  assert.equal(execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }).trim(), '12.2.1');
  const modules = [];
  function inventory(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      const entry = path.join(dir, item.name);
      if (item.name.startsWith('@')) { inventory(entry); continue; }
      const manifest = JSON.parse(fs.readFileSync(path.join(entry, 'package.json'), 'utf8'));
      modules.push({ name: manifest.name, version: manifest.version, path: path.relative(root, entry).replaceAll('\\', '/') });
      if (fs.existsSync(path.join(entry, 'node_modules'))) inventory(path.join(entry, 'node_modules'));
    }
  }
  inventory(path.join(root, 'node_modules'));
  fs.writeFileSync(path.join(directory, 'inventory.json'), JSON.stringify({ base: 'npm@12.2.1', patches: archives.slice(1), modules }, null, 2));
  if (process.env.GITHUB_PATH) {
    assert.equal(process.platform, 'linux');
    const bin = path.join(directory, 'bin'); fs.mkdirSync(bin);
    fs.chmodSync(cli, 0o755);
    fs.symlinkSync(cli, path.join(bin, 'npm'));
    fs.appendFileSync(process.env.GITHUB_PATH, bin + '\n');
    fs.appendFileSync(process.env.GITHUB_ENV, `MMS_NPM_ROOT=${root}\nAUDIT_NPM_CLI=${cli}\n`);
  }
  console.log(JSON.stringify({ npmRoot: root, npmCli: cli, inventory: path.join(directory, 'inventory.json') }));
}
if (require.main === module) setup(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { archives };

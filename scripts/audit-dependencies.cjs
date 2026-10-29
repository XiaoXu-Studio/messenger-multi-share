// Audit evidence only. No credentials sent to package/advisory APIs.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const npm = process.env.AUDIT_NPM_CLI;
if (!npm) throw new Error('Set AUDIT_NPM_CLI to the reviewed npm-cli.js');
const results = {at: new Date().toISOString(), audits: [], osv: []};
const unique = new Map();
for (const tool of ['', 'release-tools/attest', 'release-tools/release']) {
  const root = path.join(repo, tool);
  const run = spawnSync(process.execPath, [npm, 'audit', '--ignore-scripts', '--json', '--audit-level=low'], {cwd: root, encoding: 'utf8', maxBuffer: 16e6});
  const audit = JSON.parse(run.stdout);
  results.audits.push({tool: tool || 'extension', exitCode: run.status, audit});
  if (run.status !== 0 || audit.error || !audit.metadata) throw new Error('Audit did not pass: ' + tool);
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
  for (const [key, pkg] of Object.entries(lock.packages)) {
    if (!key || pkg.resolved?.startsWith('file:')) continue;
    const name = pkg.name || key.split('node_modules/').at(-1);
    unique.set(name + '@' + pkg.version, {package: {ecosystem: 'npm', name}, version: pkg.version});
  }
}
(async () => {
  if (process.env.MMS_NPM_ROOT) {
    const root = path.resolve(process.env.MMS_NPM_ROOT);
    function inventory(dir) {
      for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
        if (!item.isDirectory()) continue;
        const entry = path.join(dir, item.name);
        if (item.name.startsWith('@')) { inventory(entry); continue; }
        const pkg = JSON.parse(fs.readFileSync(path.join(entry, 'package.json'), 'utf8'));
        unique.set(pkg.name + '@' + pkg.version, {package:{ecosystem:'npm',name:pkg.name},version:pkg.version});
        if (fs.existsSync(path.join(entry, 'node_modules'))) inventory(path.join(entry, 'node_modules'));
      }
    }
    inventory(path.join(root, 'node_modules'));
  }
  const queries = [...unique.values(), {package:{ecosystem:'PyPI',name:'Pillow'},version:'13.0.0'}];
  for (let i = 0; i < queries.length; i += 100) {
    const batch = queries.slice(i, i + 100);
    const response = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({queries: batch}), signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) throw new Error('OSV HTTP ' + response.status);
    const data = await response.json();
    if (data.results?.length !== batch.length) throw new Error('Incomplete OSV results');
    data.results.forEach((result, n) => results.osv.push({...batch[n], ...result}));
    console.log('OSV checked ' + results.osv.length + '/' + queries.length);
  }
  fs.mkdirSync(path.join(repo, 'test-results'), {recursive:true});
  fs.writeFileSync(path.join(repo, 'test-results/final-dependency-scan.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({audits: results.audits.map(r=>({tool:r.tool, vulnerabilities:r.audit.metadata.vulnerabilities})),
    osvQueries: results.osv.length, osvMatches: results.osv.filter(r=>r.vulns?.length)}));
  if (results.osv.some(r=>r.vulns?.length)) throw new Error('Unresolved OSV matches; publication is blocked');
})().catch(error => {console.error(error.message); process.exitCode=1;});

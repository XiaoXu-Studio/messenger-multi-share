const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '..');
const reviewed = require('./codeql-reviewed.json');
function review(result) {
  if (result.ruleId !== 'js/http-to-file-access' || result.locations?.length !== 1) return undefined;
  const location = result.locations[0].physicalLocation;
  const entry = reviewed.find(item => item.file === location?.artifactLocation?.uri);
  if (!entry) return undefined;
  const source = fs.readFileSync(path.join(repo, entry.file), 'utf8').replaceAll('\r\n', '\n');
  if (crypto.createHash('sha256').update(source).digest('hex') !== entry.sha256) return undefined;
  if (!entry.sinks.includes(source.split('\n')[location.region?.startLine - 1]?.trim())) return undefined;
  return entry.reason;
}
function check(document) {
  assert.ok(document.runs?.length, 'No CodeQL runs');
  const unresolved = [], accepted = [];
  for (const run of document.runs) for (const result of run.results || []) {
    const reason = review(result);
    if (reason) {
      result.suppressions = [{ kind: 'external', status: 'accepted', justification: reason }];
      accepted.push({rule: result.ruleId, locations: result.locations, reason});
    } else {
      // A suppression not present in our exact-source review must not bypass the gate.
      unresolved.push({rule: result.ruleId, locations: result.locations});
    }
  }
  return {unresolved, reviewedInformational: accepted};
}
if (require.main === module) {
  const file = process.argv[2], document = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = check(document);
  console.log(JSON.stringify(result, null, 2));
  fs.writeFileSync(file, JSON.stringify(document));
  assert.equal(result.unresolved.length, 0, 'CodeQL found unresolved findings; publication is blocked');
}
module.exports = {check};

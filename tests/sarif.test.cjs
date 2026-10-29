const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {check} = require('../scripts/check-sarif.cjs');
test('CodeQL gate blocks findings even with unreviewed external suppressions', () => {
  assert.throws(() => check({}));
  assert.equal(check({runs:[{results:[]}]}).unresolved.length, 0);
  assert.equal(check({runs:[{results:[{ruleId:'js/xss',suppressions:[{status:'accepted'}]}]}]}).unresolved.length, 1);
});
test('only exact reviewed evidence-write locations are accepted', () => {
  for (const entry of require('../scripts/codeql-reviewed.json')) {
    const lines = fs.readFileSync(path.join(__dirname, '..', entry.file), 'utf8').split(/\r?\n/);
    for (const sink of entry.sinks) {
      const line = lines.findIndex(value => value.trim() === sink) + 1;
      assert.ok(line);
      const finding = {ruleId:'js/http-to-file-access',locations:[{physicalLocation:{artifactLocation:{uri:entry.file},region:{startLine:line}}}]};
      assert.equal(check({runs:[{results:[finding]}]}).reviewedInformational.length, 1);
      finding.locations[0].physicalLocation.region.startLine++;
      assert.equal(check({runs:[{results:[finding]}]}).unresolved.length, 1);
    }
  }
});

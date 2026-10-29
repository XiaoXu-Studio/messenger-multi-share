const fs=require('node:fs'),assert=require('node:assert/strict');
const document=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert.ok(document.runs?.length,'No CodeQL runs');
const findings=document.runs.flatMap(run=>(run.results||[]).filter(result=>
  !(result.suppressions||[]).some(s=>s.status==='accepted')));
console.log(JSON.stringify({runs:document.runs.length,unsuppressedFindings:findings.map(f=>({
  rule:f.ruleId,level:f.level||'warning',locations:f.locations?.map(l=>l.physicalLocation)}))},null,2));
assert.equal(findings.length,0,'CodeQL found unresolved findings; publication is blocked');

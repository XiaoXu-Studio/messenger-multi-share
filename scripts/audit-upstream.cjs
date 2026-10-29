// Snapshot mutable upstream references into an external evidence directory, without installing code.
const fs=require('node:fs/promises'),path=require('node:path'),{spawnSync}=require('node:child_process');
const evidence=path.resolve(process.env.AUDIT_EVIDENCE_DIR||'test-results/upstream');
const refs=[['actions/checkout','11d5960a326750d5838078e36cf38b85af677262'],
 ['actions/attest-build-provenance','e8998f949152b193b063cb0ec769d69d929409be'],
 ['softprops/action-gh-release','3bb12739c298aeb8a4eeaf626c5b8d85266b0e65'],
 ['github/codeql-action','9b3254085494b55a0f7c4c2b3d2d52cc712ce370']];
(async()=>{await fs.mkdir(evidence,{recursive:true});const results=[];
 for(const [repo,sha]of refs){const dir=path.join(evidence,repo.replace('/','--'));await fs.mkdir(dir,{recursive:true});
  let pkg,lock;
  for(const name of ['package.json','package-lock.json']){const url=`https://raw.githubusercontent.com/${repo}/${sha}/${name}`;
   const response=await fetch(url);if(!response.ok)throw Error(`${repo}/${name}: ${response.status}`);const body=await response.text();const parsed=JSON.parse(body);
   await fs.writeFile(path.join(dir,name),body);if(name==='package.json')pkg=parsed;else lock=parsed;}
  const audit=spawnSync(process.execPath,[process.env.AUDIT_NPM_CLI,'audit','--json','--ignore-scripts'],{cwd:dir,encoding:'utf8',maxBuffer:16*1024*1024,timeout:120000});
  await fs.writeFile(path.join(dir,'npm-audit.json'),audit.stdout||audit.stderr);
  let parsed;try{parsed=JSON.parse(audit.stdout);}catch{parsed={error:'No JSON response'};}
  const result={repo,sha,packageVersion:pkg.version,directDependencies:pkg.dependencies||{},devDependencies:pkg.devDependencies||{},
   actualPackages:Object.entries(lock.packages||{}).filter(([k])=>k).map(([location,p])=>({location,version:p.version,deprecated:p.deprecated||undefined})),
   audit:parsed.metadata?.vulnerabilities||parsed.error,auditExit:audit.status};
  results.push(result);console.log(JSON.stringify({repo,version:pkg.version,packages:result.actualPackages.length,audit:result.audit}));
 }
 await fs.writeFile(path.join(evidence,'inventory.json'),JSON.stringify(results,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});

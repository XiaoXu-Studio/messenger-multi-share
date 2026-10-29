// Read-only heuristic scan; print locations/categories, never credential values.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const rules=[
 ['github-token',/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g],
 ['private-key',/-----BEGIN (?:[A-Z0-9 ]* )?PRIVATE KEY-----/g],
 ['aws-key',/(?:AKIA|ASIA)[A-Z0-9]{16}/g],
 ['google-key',/AIza[0-9A-Za-z_-]{35}/g],
 ['service-token',/(?:xox[baprs]-[0-9A-Za-z-]{16,}|sk-(?:proj-)?[0-9A-Za-z_-]{24,})/g],
 ['credential-uri',/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|https?):\/\/[^\s/:@]+:[^\s/@]{4,}@/g],
 ['webhook',/https:\/\/(?:hooks\.slack\.com\/services|discord(?:app)?\.com\/api\/webhooks)\/[^\s"'<>]+/g],
 ['assigned-secret',/(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|client[_-]?secret)\s*[:=]\s*["'][^"'\r\n]{8,}["']/gi]
];
const hits=[],reviewedNonSecrets=[];let textObjects=0;
function scan(file,bytes){if(bytes.length>16*1024*1024||bytes.subarray(0,4096).includes(0))return;textObjects++;
 const text=bytes.toString('utf8');for(const [kind,pattern]of rules){pattern.lastIndex=0;for(const m of text.matchAll(pattern)){
  const line=text.slice(0,m.index).split('\n').length, record={file,line,kind};
  const normalized=file.replaceAll('\\','/');
  const fixture=/release-tools\/attest\/__tests__\/(fixtures\/mocks\.ts|integration\/attest\.test\.ts)$/.test(normalized);
  const sourceLine=text.split('\n')[line-1].trim();
  if(kind==='assigned-secret'&&fixture&&m[0]===("password: '"+'test-pass'+"'"))reviewedNonSecrets.push({...record,reason:'Public mock registry password, not a real credential'});
  else if(kind==='private-key'&&normalized.endsWith('release-tools/attest/dist/index.js')&&sourceLine===("if (typeof pkcs8 !== 'string' || pkcs8.indexOf('"+['-----BEGIN','PRIVATE KEY-----'].join(' ')+"') !== 0) {"))
    reviewedNonSecrets.push({...record,reason:'PEM parser header check, no key body'});
  else hits.push(record);
 }}}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','test-results'].includes(e.name)||e.isSymbolicLink())continue;
 const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.isFile())scan(path.relative(root,f),fs.readFileSync(f));}}
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:32*1024*1024});
walk(root);const commits=git('rev-list','--all').toString().trim().split('\n'),seen=new Set();
for(const commit of commits)for(const entry of git('ls-tree','-rz',commit).toString().split('\0').filter(Boolean)){
 const [,type,hash,file]=/^\d+ (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
 if(type!=='blob'||seen.has(hash))continue;seen.add(hash);scan('history:'+commit.slice(0,8)+':'+file,git('cat-file','blob',hash));
}
const trackedSensitive=git('ls-files','-z').toString().split('\0').filter(f=>/(^|\/)\.env(?:\.|$)|\.(pem|key|pfx|p12)$/.test(f));
const ignored=git('check-ignore','.env','.env.local','audit.key','audit.pem').toString().trim().split('\n');
console.log(JSON.stringify({textObjects,historicalCommits:commits.length,historicalUniqueBlobs:seen.size,trackedSensitive,ignored,reviewedNonSecrets,hits},null,2));
if(hits.length||trackedSensitive.length)process.exitCode=1;

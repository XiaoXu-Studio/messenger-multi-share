const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');const root=path.resolve(__dirname,'..');const files=require('../scripts/files.cjs');
function fixture(t){const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mms-package-'));const repo=path.join(temp,'repo');
 for(const file of [...files,'package.json',...['build.cjs','files.cjs','package-safety.cjs'].map(n=>'scripts/'+n)]){
  fs.mkdirSync(path.dirname(path.join(repo,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(repo,file));}
 // Only this test-owned, resolved temporary directory may be removed. Junctions are unlinked first.
 t.after(()=>{for(const p of ['dist','icons']){const f=path.join(repo,p);if(fs.lstatSync(f,{throwIfNoEntry:false})?.isSymbolicLink())fs.unlinkSync(f);}
  assert.ok(temp.startsWith(path.join(os.tmpdir(),'mms-package-')));fs.rmSync(temp,{recursive:true});});
 return {temp,repo,run:()=>spawnSync(process.execPath,['scripts/build.cjs'],{cwd:repo,encoding:'utf8',env:{...process.env,GITHUB_REF_TYPE:'',GITHUB_REF_NAME:''}})};
}
test('build succeeds with exactly the runtime allowlist',t=>{const f=fixture(t);assert.equal(f.run().status,0);assert.equal(files.length,11);});
test('build refuses output junction and leaves outside sentinel intact',t=>{const f=fixture(t);const outside=path.join(f.temp,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'manifest.json'),'sentinel');
 fs.symlinkSync(outside,path.join(f.repo,'dist'),'junction');assert.notEqual(f.run().status,0);assert.equal(fs.readFileSync(path.join(outside,'manifest.json'),'utf8'),'sentinel');});
test('build refuses source parent junction before output',t=>{const f=fixture(t);fs.renameSync(path.join(f.repo,'icons'),path.join(f.temp,'external-icons'));fs.symlinkSync(path.join(f.temp,'external-icons'),path.join(f.repo,'icons'),'junction');
 assert.notEqual(f.run().status,0);assert.equal(fs.existsSync(path.join(f.repo,'dist')),false);});
test('build refuses hardlinked output',t=>{const f=fixture(t);fs.mkdirSync(path.join(f.repo,'dist'));const outside=path.join(f.temp,'sentinel');fs.writeFileSync(outside,'safe');fs.linkSync(outside,path.join(f.repo,'dist','manifest.json'));
 assert.notEqual(f.run().status,0);assert.equal(fs.readFileSync(outside,'utf8'),'safe');});
test('build rejects unexpected files in dist',t=>{const f=fixture(t);fs.mkdirSync(path.join(f.repo,'dist'));fs.writeFileSync(path.join(f.repo,'dist','.env'),'not a real credential');assert.notEqual(f.run().status,0);});
test('ZIP rejects traversal, duplicate entries and unreviewed files',()=>{const {validateArchiveNames}=require('../scripts/package-safety.cjs');
 assert.doesNotThrow(()=>validateArchiveNames([...files,'icons/']));for(const entry of ['../','/absolute/','extra/','icons/../../','icons\\','.env','inject.js'])assert.throws(()=>validateArchiveNames([...files,entry]));});
test('packaged PNG dimensions agree with manifest',()=>{const manifest=require('../manifest.json');for(const [size,file]of Object.entries(manifest.icons)){const b=fs.readFileSync(path.join(root,file));assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),Number(size));assert.equal(b.readUInt32BE(20),Number(size));}});

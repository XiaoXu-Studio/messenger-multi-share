const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function background() {
  let handler, removed;
  const messages = [], scripts = [];
  const tabs = Array.from({length:12},(_,i)=>({id:i+1, windowId:1,
    url:'https://www.messenger.com/groupcall/'+(i+1),title:'PRIVATE TITLE'}));
  const chrome = {runtime:{id:'test-extension',getURL:p=>'chrome-extension://test-extension/'+p,
    onMessage:{addListener:fn=>handler=fn},sendMessage:async()=>{},getPlatformInfo:()=>{},getManifest:()=>({version:'2.6.18'})},
    tabs:{onRemoved:{addListener:fn=>removed=fn},get:async id=>{
      const tab=tabs.find(t=>t.id===id); if(!tab)throw Error('Missing tab'); return tab;
    },query:async()=>tabs,sendMessage:async(id,msg,options)=>{messages.push({id,msg,options});return {ok:true,found:true};}},
    windows:{get:async()=>({width:900,height:700,left:0,top:0}),update:async()=>{}},
    system:{display:{getInfo:async()=>[]}},scripting:{executeScript:async value=>scripts.push(value)}};
  const ctx=vm.createContext({chrome,URL,console:{log(){}},crypto:{randomUUID},setTimeout,clearTimeout,setInterval,clearInterval});
  ctx.importScripts=()=>vm.runInContext(read('security.js'),ctx);
  vm.runInContext(read('background.js'),ctx);
  vm.runInContext('sleep = async () => {}',ctx);
  const popup={id:chrome.runtime.id,url:chrome.runtime.getURL('popup.html')};
  const sender=id=>({id:chrome.runtime.id,tab:{id},url:tabs.find(t=>t.id===id)?.url,frameId:0});
  return {ctx,chrome,messages,scripts,tabs,popup,sender,removed,
    send:(msg,from=popup)=>{let response; const result=handler(msg,from,v=>response=v);return {result,get response(){return response;}};},
    run:code=>vm.runInContext(code,ctx)};
}
function validator(){const c=vm.createContext({URL});vm.runInContext(read('security.js'),c);return c.MMSecurity;}
test('call URLs must be exact HTTPS hosts and pathname segments',()=>{
  const s=validator();
  for(const url of ['https://www.facebook.com/groupcall/123','https://www.messenger.com/groupcall'])assert.equal(s.callUrl(url),true);
  for(const url of ['https://evil.test/groupcall','http://www.facebook.com/groupcall','https://www.facebook.com.evil.test/groupcall',
    'https://www.facebook.com/?x=groupcall','https://www.facebook.com/notgroupcall','https://www.facebook.com:8443/groupcall','not a URL'])assert.equal(s.callUrl(url),false,url);
  assert.equal(s.callUrl('https://www.messenger.com/call/1'),false);
  assert.equal(s.callUrl('https://www.messenger.com/call/1',true),true);
});
test('tab lists reject duplicate, oversized and malformed IDs',()=>{
  const s=validator(); for(const value of [[1,1],[-1],[1.2],['2'],null,Array.from({length:129},(_,i)=>i)])assert.equal(s.tabIds(value),false);
  assert.equal(s.tabIds([0,1,2]),true);assert.equal(s.tabIds([]),true);
});
test('signal projection bounds data and excludes extra fields',()=>{
  const s=validator();assert.equal(s.signal({type:'offer',sdp:'x'.repeat(131073)}),null);
  assert.equal(s.signal({type:'answer',sdp:''}),null);assert.equal(s.signal({type:'evil'}),null);
  assert.equal(s.signal({type:'candidate',candidate:{candidate:'x'.repeat(8193)}}),null);
  assert.equal(s.signal({type:'candidate',candidate:{candidate:'x',sdpMLineIndex:-1}}),null);
  assert.equal(s.signal({type:'offer',sdp:'ok',password:'secret'}).password,undefined);
});
test('diagnostic text removes URLs, emails, tokens and control characters',()=>{
  const value=validator().text('https://private.test/call a@example.test ghp_'+'a'.repeat(36)+'\n');
  assert.equal(value,'[url] [email] [token] ');assert.equal(validator().text('a'.repeat(3000)).length,2048);
});
test('only the extension popup may change selected tabs',()=>{
  const h=background();for(const sender of [h.sender(1),{...h.popup,id:'foreign'},{...h.popup,url:'https://evil.test'}]){
    h.send({type:'UPDATE_SELECTION',tabIds:[1]},sender);assert.equal(h.run('selectedTabIds'),null);
  }
  h.send({type:'UPDATE_SELECTION',tabIds:[1,2]});assert.deepEqual([...h.run('selectedTabIds')],[1,2]);
  h.send({type:'UPDATE_SELECTION',tabIds:[2]}, {...h.popup,tab:{id:50}});assert.deepEqual([...h.run('selectedTabIds')],[2]);
});
test('content sender must be an allowed top-level call page',()=>{
  const h=background();for(const sender of [{...h.sender(1),frameId:1},{...h.sender(1),url:'https://www.facebook.com/?groupcall=1'},
    {...h.sender(1),url:'https://evil.test/groupcall'},{...h.sender(1),id:'foreign'}])assert.equal(h.send({type:'GET_STATE'},sender).response,undefined);
  assert.equal(h.send({type:'GET_STATE'},h.sender(1)).response.sharing,false);
});
test('start validates all targets before any privileged operation',async()=>{
  const h=background();h.tabs[1].url='https://evil.test/groupcall';
  await assert.rejects(h.run('startSharing([1,2])'),/离开/);assert.equal(h.messages.length,0);assert.equal(h.run('sharing'),false);
});
test('concurrent starts cannot create two sessions',async()=>{
  const h=background();const first=h.run('startSharing([1,2])');await assert.rejects(h.run('startSharing([3,4])'),/正在/);await first;
  assert.equal(h.run('sourceTabId'),1);assert.equal(h.run('receiverTabs.has(2)'),true);
});
test('explicit empty selection never expands to every call',async()=>{
  const h=background();h.send({type:'UPDATE_SELECTION',tabIds:[]});const result=await h.run('toggleSharing(1)');
  assert.equal(result.ok,false);assert.equal(h.run('sharing'),false);assert.equal(h.messages.length,0);
});
test('unselected source cannot enlarge a saved selection',async()=>{
  const h=background();h.send({type:'UPDATE_SELECTION',tabIds:[2,3]});assert.equal((await h.run('toggleSharing(1)')).ok,false);
});
test('source-to-selected receiver signaling only; stale sessions and cross receivers rejected',async()=>{
  const h=background();await h.run('startSharing([1,2,3])');await tick();const session=h.run('activeSession');h.messages.length=0;
  for(const [from,to,type,s] of [[1,4,'offer',session],[2,3,'offer',session],[2,1,'offer',session],[1,2,'answer',session],[1,2,'offer','old']])
    h.send({type:'SIGNAL',targetTabId:to,signal:{type,sdp:'test'},session:s},h.sender(from));
  await tick();assert.equal(h.messages.length,0);
  h.send({type:'SIGNAL',targetTabId:2,signal:{type:'offer',sdp:'test',secret:1},session},h.sender(1));
  await tick();assert.equal(h.messages.length,1);assert.equal(h.messages[0].id,2);assert.equal(h.messages[0].msg.signal.secret,undefined);
  assert.equal(h.messages[0].options.frameId,0);
});
test('source-ended event from receiver cannot stop the session',async()=>{
  const h=background();await h.run('startSharing([1,2])');h.send({type:'SOURCE_ENDED',session:h.run('activeSession')},h.sender(2));
  await tick();assert.equal(h.run('sharing'),true);
});
test('signal flooding is bounded per authorized pair',async()=>{
  const h=background();await h.run('startSharing([1,2])');await tick();h.messages.length=0;
  h.run("for(let i=0;i<600;i++) relaySignal(1,2,{type:'candidate',candidate:{candidate:'x'}})");
  await tick();assert.equal(h.messages.length,512);
});
test('stopping releases pending waiters and rejects late messages',async()=>{
  const h=background();await h.run('startSharing([1,2])');const session=h.run('activeSession');
  const wait=h.run('waitForReceiverReady(2,10000)');await h.run('stopSharing()');assert.equal(await wait,false);
  await tick();h.messages.length=0;h.send({type:'SIGNAL',session,targetTabId:2,signal:{type:'offer',sdp:'late'}},h.sender(1));
  await tick();assert.equal(h.messages.length,0);assert.equal(h.run('activeSession'),null);
});
test('navigation away prevents delivery of queued signaling',async()=>{
  const h=background();await h.run('startSharing([1,2])');await tick();h.messages.length=0;h.tabs[1].url='https://evil.test/groupcall';
  h.run("relaySignal(1,2,{type:'offer',sdp:'x'})");await tick();assert.equal(h.messages.length,0);
});
test('diagnostic export omits titles and sanitizes errors',async()=>{
  const h=background();h.run("markTab(1,{error:'https://secret.test/a'})");const data=await h.run('collectDiagnostics()');
  assert.equal(JSON.stringify(data).includes('PRIVATE TITLE'),false);assert.equal(data.tabs[0].error,'[url]');
});
test('only two justified API permissions; no remote code or external messaging',()=>{
  const m=JSON.parse(read('manifest.json'));assert.deepEqual(m.permissions,['scripting','system.display']);
  assert.equal(m.externally_connectable,undefined);assert.equal(m.web_accessible_resources,undefined);
  assert.deepEqual(m.host_permissions,['https://www.messenger.com/*','https://www.facebook.com/*']);
  assert.equal(m.version,JSON.parse(read('package.json')).version);
});

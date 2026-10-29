const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../inject.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function stream(){const track={stopped:false,stop(){this.stopped=true;},addEventListener(){}};
  return {get active(){return !track.stopped;},getTracks:()=>[track],getVideoTracks:()=>[track],clone:()=>stream(),addEventListener(){},track};}
function media(native=async()=>stream()){
  const handlers=[],posts=[],pcs=[],timers=new Set();let calls=0;
  const window={addEventListener:(type,fn)=>handlers.push(fn),postMessage:value=>posts.push(value)};
  class PC{constructor(){pcs.push(this);this.added=[];}close(){this.closed=true;}addTrack(){}async createOffer(){return {type:'offer',sdp:'offer'};}
    async createAnswer(){return {type:'answer',sdp:'answer'};}async setLocalDescription(d){this.localDescription=d;}
    async setRemoteDescription(d){this.remoteDescription=d;}async addIceCandidate(c){this.added.push(c);}}
  const ctx=vm.createContext({window,location:{origin:'https://www.messenger.com'},navigator:{mediaDevices:{getDisplayMedia:async c=>{calls++;return native(c);}}},
    DOMException,RTCPeerConnection:PC,RTCIceCandidate:function(c){Object.assign(this,c);},MediaStream:function(){return stream();},
    setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn)});
  vm.runInContext(source,ctx);
  const send=(type,data={},session='session',origin='https://www.messenger.com')=>handlers.forEach(fn=>fn({source:window,origin,data:{type:'MMS_'+type,data,session,direction:'to-page'}}));
  return {ctx,posts,pcs,timers,get calls(){return calls;},send,
    role:(role='source',peers=[2])=>send('SET_ROLE',{role,peers}),capture:()=>ctx.navigator.mediaDevices.getDisplayMedia({video:true})};
}
test('unconfigured adapter preserves native picker',async()=>{const h=media();const result=await h.capture();assert.equal(h.calls,1);assert.equal(result.active,true);});
test('repeated injection does not wrap capture twice',async()=>{const h=media();const before=h.ctx.navigator.mediaDevices.getDisplayMedia;vm.runInContext(source,h.ctx);assert.equal(before,h.ctx.navigator.mediaDevices.getDisplayMedia);});
test('late capture after cancellation stops original track and rejects',async()=>{
  let resolve;const h=media(()=>new Promise(r=>resolve=r));h.role();const pending=h.capture();h.send('STOP_SHARING');const input=stream();resolve(input);
  await assert.rejects(pending,{name:'AbortError'});assert.equal(input.active,false);assert.equal(h.posts.length,0);
});
test('stop closes captured and all delivered clones',async()=>{
  const input=stream(),h=media(async()=>input);h.role();const clone=await h.capture();assert.notEqual(clone,input);
  h.send('STOP_SHARING');assert.equal(input.active,false);assert.equal(clone.active,false);
});
test('old stop cannot terminate a newer session',async()=>{
  const h=media();h.role();const clone=await h.capture();h.send('STOP_SHARING',{},'old');assert.equal(clone.active,true);
  h.send('STOP_SHARING');assert.equal(clone.active,false);
});
test('canceling receiver wait does not fall through to native screen picker',async()=>{
  const h=media();h.role('receiver',[1]);const pending=h.capture();h.send('STOP_SHARING');for(const fn of h.timers)fn();
  await assert.rejects(pending,{name:'AbortError'});assert.equal(h.calls,0);assert.equal(h.timers.size,0);
});
test('unselected peer, stale session and foreign origin cannot create PC',async()=>{
  const h=media();h.role();await h.capture();h.send('CREATE_OFFER',{targetTabId:99});h.send('CREATE_OFFER',{targetTabId:2},'old');
  h.send('CREATE_OFFER',{targetTabId:2},'session','https://evil.test');await tick();assert.equal(h.pcs.length,0);
  h.send('CREATE_OFFER',{targetTabId:2});await tick();assert.equal(h.pcs.length,1);assert.equal(h.posts.filter(p=>p.type==='MMS_SIGNAL_OUT').length,1);
});
test('early ICE buffer is limited and retained until offer arrives',async()=>{
  const h=media();h.role('receiver',[1]);for(let i=0;i<300;i++)h.send('HANDLE_SIGNAL',{fromTabId:1,signal:{type:'candidate',candidate:{candidate:'c'+i}}});
  h.send('HANDLE_SIGNAL',{fromTabId:1,signal:{type:'offer',sdp:'offer'}});await tick();assert.equal(h.pcs[0].added.length,256);
});
test('receiver receives cloned media and stops it on disconnect',async()=>{
  const h=media();h.role('receiver',[1]);h.send('HANDLE_SIGNAL',{fromTabId:1,signal:{type:'offer',sdp:'offer'}});await tick();
  const input=stream(),pc=h.pcs[0];pc.ontrack({track:input.track,streams:[input]});const output=await h.capture();assert.equal(h.calls,0);assert.equal(output.active,true);
  pc.connectionState='failed';pc.onconnectionstatechange();assert.equal(input.active,false);assert.equal(output.active,false);
});
test('picker denial signals source-ended without exposing error detail',async()=>{
  const h=media(async()=>{throw new DOMException('private detail','NotAllowedError');});h.role();await assert.rejects(h.capture(),{name:'NotAllowedError'});
  assert.equal(h.posts[0].type,'MMS_SOURCE_STREAM_ENDED');assert.equal(JSON.stringify(h.posts).includes('private detail'),false);
});

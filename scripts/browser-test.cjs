// Isolated, synthetic regression. Never captures the real desktop or contacts Facebook.
// Supply PLAYWRIGHT_MODULE and PLAYWRIGHT_BROWSERS_PATH from a separately audited test installation.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const root=path.resolve(__dirname,'..');
const fixture=`(() => {
  window.testNativeCaptures = 0;
  navigator.mediaDevices.getDisplayMedia = async () => {
    window.testNativeCaptures++;
    const canvas = document.createElement('canvas');canvas.width=320;canvas.height=240;
    const ctx=canvas.getContext('2d');let frame=0;
    const timer=setInterval(()=>{ctx.fillStyle=frame++%2?'#0084ff':'#222';ctx.fillRect(0,0,320,240);},50);
    const stream=canvas.captureStream(10);
    stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(timer));
    return stream;
  };
  const NativePC = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends NativePC {constructor(){super({iceServers:[]});}};
})();\n`;
const html=`<!doctype html><meta charset="utf-8"><title>TEST CALL</title>
<button role="button" aria-label="Share screen" id="share">Share screen</button>
<script>
window.testStreams=[];window.testErrors=[];
document.getElementById('share').onclick=async()=>{try {
 const s=await navigator.mediaDevices.getDisplayMedia({video:true});window.testStreams.push(s);
 const v=document.createElement('video');v.muted=true;v.autoplay=true;v.srcObject=s;document.body.append(v);
}catch(e){window.testErrors.push(e.name);}};
</script>`;
(async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'mms-audit-'));
  const extension=path.join(temp,'extension');await fs.mkdir(extension);
  for(const file of require('./files.cjs')){await fs.mkdir(path.dirname(path.join(extension,file)),{recursive:true});await fs.copyFile(path.join(root,file),path.join(extension,file));}
  // Test-only copy: fake native picker and local-only ICE before the unchanged adapter.
  await fs.writeFile(path.join(extension,'inject.js'),fixture+await fs.readFile(path.join(root,'inject.js'),'utf8'));
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/token|secret|password|api.?key|credential/i.test(k)));
  const context=await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,env,
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1000,height:750}});
  const results=[];const check=(name,value)=>{assert.ok(value,name);results.push(name);console.log('PASS '+name);};
  try{
    context.setDefaultTimeout(30000);
    await context.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(['www.facebook.com','www.messenger.com'].includes(u.hostname))return route.fulfill({body:html,contentType:'text/html'});
      if(u.protocol==='chrome-extension:')return route.continue();return route.abort();
    });
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    // Windows headless Chromium does not support native display/focus management.
    // Exercise that path in unit tests; this run focuses on real WebRTC/media behavior.
    await worker.evaluate(()=>{
      chrome.windows.update=async()=>({});
      chrome.system.display.getInfo=async()=>[];
    });
    const id=new URL(worker.url()).host;
    const pages=[];for(let i=0;i<11;i++){const p=await context.newPage();await p.goto('https://www.messenger.com/groupcall/test-'+i);pages.push(p);}
    const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
    try { await popup.waitForFunction(()=>document.querySelectorAll('#tabList input').length===11); }
    catch(error){console.log('Popup:',await popup.locator('body').innerText());console.log('Tabs:',await worker.evaluate(()=>chrome.tabs.query({})));throw error;}
    check('minimal permissions still discover all 11 synthetic call tabs',true);
    const ids=await popup.locator('#tabList input').evaluateAll(inputs=>inputs.map(input=>Number(input.value)));
    await popup.locator('#tabList input').last().uncheck();
    await popup.locator('#btnStart').click();
    await popup.waitForFunction(()=>document.querySelector('#viewSharing').classList.contains('active'));
    const started=Date.now();
    while(Date.now()-started<90000){const count=await worker.evaluate(()=>Array.from(tabDiagnostics.values()).filter(t=>t.consumed).length);if(count>=9)break;await new Promise(r=>setTimeout(r,500));}
    const liveCounts=await Promise.all(pages.map(p=>p.evaluate(()=>testStreams.filter(s=>s.active).length)));
    check('one source plus nine receivers share real peer connections',liveCounts.filter(n=>n>0).length===10);
    check('unselected eleventh call never receives media',liveCounts[10]===0);
    const native=await Promise.all(pages.map(p=>p.evaluate(()=>testNativeCaptures)));
    check('only one synthetic native picker; receiver calls reuse media',native.reduce((a,b)=>a+b,0)===1);
    const diag=await popup.evaluate(()=>chrome.runtime.sendMessage({type:'GET_DIAGNOSTICS'}));
    check('exported diagnostics do not contain page titles or call URLs',!JSON.stringify(diag).includes('TEST CALL')&&!JSON.stringify(diag).includes('/groupcall/'));
    const session=await worker.evaluate(()=>activeSession);
    await pages[0].evaluate(({session,target})=>window.postMessage({type:'MMS_SIGNAL_OUT',direction:'from-page',session,data:{targetTabId:target,signal:{type:'offer',sdp:'not-sdp'}}},location.origin),{session,target:ids[10]});
    check('forged message cannot add an unselected receiver',!(await worker.evaluate(id=>receiverTabs.has(id),ids[10])));
    await popup.locator('#btnStop').click();
    await popup.waitForFunction(()=>document.querySelector('#viewIdle').classList.contains('active'));
    for(const p of pages)await p.waitForFunction(()=>testStreams.every(s=>!s.active));
    check('stop ends all ten delivered streams',true);
    const errors=(await Promise.all(pages.map(p=>p.evaluate(()=>testErrors)))).flat();check('no capture errors in the successful multi-tab scenario',errors.length===0);
    console.log(JSON.stringify({browser:context.browser().version(),results,testOnlyNativePicker:true,testOnlyLocalICE:true,artifactDirectory:temp},null,2));
  }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

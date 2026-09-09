const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../../main/resources/static');
class Element {
  constructor(){this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';this.children=[];this.events={};}
  addEventListener(name,fn){this.events[name]=fn;}
  async fire(name,event={}){return this.events[name]?.(event);}
  showModal(){this.open=true;}
  close(){this.open=false;this.events.close?.();}
  focus(){}
  getBoundingClientRect(){return {left:100,right:600,top:100,bottom:700};}
  replaceChildren(){this.children=[];this.value='';}
  append(...items){for(const child of items){this.children.push(child);if(this.children.length===1 && child.value!==undefined)this.value=child.value;}}
}
const elements=new Map(), el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const document=new Element();Object.assign(document,{getElementById:el,createElement:()=>new Element(),createTextNode:text=>({textContent:text}),hidden:false,documentElement:{classList:{add(){},remove(){}}}});
let now=0,seq=0,timers=new Map(),captureCalls=[],tracks=[],pendingCapture=null;
let devices=[{kind:'audioinput',deviceId:'mic1',label:'Desk microphone'},{kind:'audioinput',deviceId:'usb1',label:'Rocksmith USB Guitar Adapter'}];
const media=new Element();media.enumerateDevices=async()=>devices;
media.getUserMedia=async options=>{
  captureCalls.push(options);if(pendingCapture)return pendingCapture;
  const id=options.audio.deviceId?.exact||'mic1';
  const track=new Element();Object.assign(track,{readyState:'live',muted:false,label:devices.find(d=>d.deviceId===id).label,getSettings:()=>({deviceId:id}),stop(){this.readyState='ended';}});tracks.push(track);
  return {getAudioTracks:()=>[track],getTracks:()=>[track]};
};
let audible=false,match=false;
class AudioContext extends Element {
  constructor(){super();this.state='running';this.sampleRate=48000;}
  async resume(){} async close(){this.state='closed';}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createAnalyser(){return {fftSize:8192,frequencyBinCount:4096,getFloatTimeDomainData:a=>a.fill(audible?.05:0),getFloatFrequencyData:a=>a.fill(-40)};}
}
const card={id:1,voicing:0,data:{symbol:'C',voicings:[{frets:[-1,3,2,0,1,0]}]}};
const context=vm.createContext({document,navigator:{mediaDevices:media},window:Object.assign(new Element(),{AudioContext}),performance:{now:()=>now},console,structuredClone,state:{chords:[card,{...card,id:2}]},buildSvg:()=>'<svg></svg>',stopPlayback(){},setTimeout(fn,ms){const id=++seq;timers.set(id,{at:now+ms,fn});return id;},clearTimeout:id=>timers.delete(id)});
vm.runInContext(fs.readFileSync(path.join(root,'chord-detection.js'),'utf8'),context);
context.ChordDetection.createDetector=()=>()=>({fit:.95,strongest:1,total:1,chroma:[0,0,0,0,1,0,0,0,0,0,0,0],notes:['E']});context.ChordDetection.matches=()=>match;
el('practice-source').value='mic';el('practice-seconds').value='2';el('practice-countin-seconds').value='0';
vm.runInContext(fs.readFileSync(path.join(root,'practice.js'),'utf8'),context);
async function flush(){for(let i=0;i<5;i++)await Promise.resolve();}
function advance(ms){const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
(async()=>{
  await flush();assert.match(el('practice-usb').textContent,/detected/);
  await el('listen-enable').fire('click');advance(1600);
  assert.equal(captureCalls[0].audio.deviceId.exact,'mic1');
  assert.equal(captureCalls[0].audio.echoCancellation,false);
  assert.equal(el('practice-start').disabled,false);
  await el('practice-start').fire('click');advance(400);
  assert.equal(el('practice-modal').open,true,'Starting the deck opens the modal');
  assert.match(el('practice-target-tones').textContent,/C \/ E \/ G/);
  assert.match(el('practice-result').textContent,/Ready for your strum/);
  audible=true;match=true;advance(160);
  assert.match(el('practice-result').textContent,/Confirming chord/);
  assert.ok(el('practice-confirmation').value>0 && el('practice-confirmation').value<100);
  advance(400);
  assert.match(el('practice-result').textContent,/Chord matched/);
  advance(1600);assert.equal(el('practice-progress').textContent,'Card 2 of 2');
  // A ringing previous chord cannot win the next card until strings are muted.
  advance(600);assert.match(el('practice-result').textContent,/Waiting for a quiet gap/);
  audible=false;advance(400);audible=true;match=false;advance(160);
  assert.match(el('practice-result').textContent,/Not hearing C \/ G clearly/);
  advance(940);
  assert.match(el('practice-result').textContent,/Not quite/);
  advance(2000);assert.equal(el('practice-progress').textContent,'Card 2 of 2','Auto-next off leaves timeout on its card');
  await el('practice-close').fire('click');assert.equal(el('practice-modal').open,false);
  advance(3000);assert.match(el('practice-countdown').textContent,/Paused/);
  await el('practice-start').fire('click');assert.equal(el('practice-modal').open,true);
  assert.equal(el('practice-progress').textContent,'Card 2 of 2','Reopening preserves position');
  let prevented=false;
  const space={code:'Space',target:{closest:()=>null},preventDefault(){prevented=true;}};
  await document.fire('keydown',space);assert.ok(prevented);assert.equal(el('practice-countdown').textContent,'2.0 seconds left');
  advance(400);const countdown=el('practice-countdown').textContent;
  await document.fire('keydown',{...space,repeat:true});assert.equal(el('practice-countdown').textContent,countdown);
  await document.fire('keydown',{...space,target:{closest:()=>({})}});assert.equal(el('practice-countdown').textContent,countdown,'Typing does not retry');
  await el('practice-modal').fire('cancel',{preventDefault(){}});assert.equal(el('practice-modal').open,false,'Escape closes');
  await document.fire('keydown',space);assert.equal(el('practice-modal').open,false,'Space outside modal does not retry');
  await el('practice-start').fire('click');
  const backdrop={target:el('practice-modal'),clientX:10,clientY:10};
  await el('practice-modal').fire('pointerdown',backdrop);await el('practice-modal').fire('click',backdrop);
  assert.equal(el('practice-modal').open,false,'Click away closes');
  await el('practice-start').fire('click');
  await el('practice-retry').fire('click');
  context.pausePracticeForPlayback();advance(3000);assert.match(el('practice-result').textContent,/Paused for playback/);
  await el('practice-retry').fire('click');document.hidden=true;await document.fire('visibilitychange');advance(3000);assert.match(el('practice-result').textContent,/tab was away/);document.hidden=false;
  devices=devices.filter(d=>d.deviceId!=='mic1');await media.fire('devicechange');assert.equal(tracks[0].readyState,'ended');assert.match(el('listen-status').textContent,/disconnected/);
  el('practice-source').value='usb';await el('practice-source').fire('change');await flush();
  await el('listen-enable').fire('click');assert.equal(captureCalls.at(-1).audio.deviceId.exact,'usb1');advance(1600);
  await el('practice-retry').fire('click');assert.equal(el('practice-countdown').textContent,'2.0 seconds left');
  await el('practice-end').fire('click');assert.equal(el('practice-end').disabled,true);
  // Timeout auto-next advances, but Space retry cancels a pending advance.
  el('practice-auto-next').checked=true;audible=false;
  await el('practice-start').fire('click');advance(2100);
  await document.fire('keydown',space);advance(1700);assert.equal(el('practice-progress').textContent,'Card 1 of 2');
  advance(2100);assert.equal(el('practice-progress').textContent,'Card 2 of 2');
  advance(2100);await el('practice-close').fire('click');advance(2000);
  assert.equal(el('practice-end').disabled,false,'Dismiss cancels pending auto-next and completion');
  await el('practice-start').fire('click');await document.fire('keydown',space);advance(3800);
  assert.equal(el('practice-end').disabled,true,'Final timeout completes deck');
  // Count-in opens immediately but neither scores nor consumes card time.
  el('practice-countin-seconds').value='3';el('practice-repeat').checked=true;
  await el('practice-start').fire('click');
  assert.equal(el('practice-countin-text').textContent,'READY!');assert.equal(el('practice-stage').hidden,true);
  audible=true;match=true;
  advance(850);assert.equal(el('practice-countin-text').textContent,'','Each cue disappears before the next');
  advance(150);assert.equal(el('practice-countin-text').textContent,'3');
  advance(1000);assert.equal(el('practice-countin-text').textContent,'2');
  advance(1000);assert.equal(el('practice-countin-text').textContent,'1');
  assert.doesNotMatch(el('practice-result').textContent,/Chord matched/);
  advance(1000);assert.equal(el('practice-countin').hidden,true);assert.equal(el('practice-stage').hidden,false);
  assert.equal(el('practice-countdown').textContent,'2.0 seconds left','Card gets its full time after countdown');
  audible=false;match=false;advance(7300);
  assert.equal(el('practice-cycle').textContent,'Pass 2');assert.equal(el('practice-progress').textContent,'Card 1 of 2');
  assert.equal(el('practice-countin').hidden,true,'Repeat does not replay initial preparation');
  await el('practice-end').fire('click');
  await el('practice-start').fire('click');advance(1000);
  await el('practice-close').fire('click');advance(5000);
  assert.equal(el('practice-modal').open,false);assert.equal(el('practice-countin').hidden,true);
  assert.equal(el('practice-countdown').textContent,'Paused','Closing cancels preparation');
  await el('practice-start').fire('click');await document.fire('keydown',space);
  assert.equal(el('practice-countin-text').textContent,'READY!','Retry restarts cancelled preparation');
  document.hidden=true;await document.fire('visibilitychange');advance(5000);
  assert.equal(el('practice-countin').hidden,true);document.hidden=false;
  await document.fire('keydown',space);assert.equal(el('practice-countin-text').textContent,'READY!');
  await el('practice-end').fire('click');advance(5000);
  assert.equal(el('practice-end').disabled,true,'Ending cancels countdown callbacks');
  await el('listen-disable').fire('click');assert.equal(tracks.at(-1).readyState,'ended');
  const original=media.getUserMedia;media.getUserMedia=async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});};
  await el('listen-enable').fire('click');assert.match(el('listen-status').textContent,/permission was denied/);assert.equal(el('listen-enable').disabled,false);media.getUserMedia=original;
  let resolve;pendingCapture=new Promise(r=>resolve=r);
  const waiting=el('listen-enable').fire('click');await flush();await el('listen-disable').fire('click');
  let stopped=false;resolve({getTracks:()=>[{stop(){stopped=true;}}]});await waiting;assert.ok(stopped,'Cancelled permission request must release late stream');
  console.log('Practice UI state checks passed: inputs, permission errors, late cancellation, scoring, timeout, retry, next, playback/visibility pauses, and disconnect.');
})().catch(error=>{console.error(error);process.exitCode=1;});

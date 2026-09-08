const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../../main/resources/static');
class Element {
  constructor(){this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';this.children=[];this.events={};}
  addEventListener(name,fn){this.events[name]=fn;}
  async fire(name){return this.events[name]?.();}
  replaceChildren(){this.children=[];this.value='';}
  append(...items){for(const child of items){this.children.push(child);if(this.children.length===1 && child.value!==undefined)this.value=child.value;}}
}
const elements=new Map(), el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const document=new Element();Object.assign(document,{getElementById:el,createElement:()=>new Element(),createTextNode:text=>({textContent:text}),hidden:false});
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
el('practice-source').value='mic';el('practice-seconds').value='2';
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
  assert.match(el('practice-target-tones').textContent,/C \/ E \/ G/);
  assert.match(el('practice-result').textContent,/Ready for your strum/);
  audible=true;match=true;advance(160);
  assert.match(el('practice-result').textContent,/Let it ring/);
  advance(400);
  assert.match(el('practice-result').textContent,/Chord matched/);
  advance(1600);assert.equal(el('practice-progress').textContent,'Card 2 of 2');
  // A ringing previous chord cannot win the next card until strings are muted.
  advance(600);assert.match(el('practice-result').textContent,/Waiting for a quiet gap/);
  audible=false;advance(400);audible=true;match=false;advance(160);
  assert.match(el('practice-result').textContent,/Not hearing C \/ G clearly/);
  advance(940);
  assert.match(el('practice-result').textContent,/Not quite/);
  await el('practice-retry').fire('click');
  context.pausePracticeForPlayback();advance(3000);assert.match(el('practice-result').textContent,/Paused for playback/);
  await el('practice-retry').fire('click');document.hidden=true;await document.fire('visibilitychange');advance(3000);assert.match(el('practice-result').textContent,/tab was away/);document.hidden=false;
  devices=devices.filter(d=>d.deviceId!=='mic1');await media.fire('devicechange');assert.equal(tracks[0].readyState,'ended');assert.match(el('listen-status').textContent,/disconnected/);
  el('practice-source').value='usb';await el('practice-source').fire('change');await flush();
  await el('listen-enable').fire('click');assert.equal(captureCalls.at(-1).audio.deviceId.exact,'usb1');advance(1600);
  await el('practice-retry').fire('click');assert.equal(el('practice-countdown').textContent,'2.0 seconds left');
  await el('practice-end').fire('click');assert.equal(el('practice-end').disabled,true);
  await el('listen-disable').fire('click');assert.equal(tracks.at(-1).readyState,'ended');
  const original=media.getUserMedia;media.getUserMedia=async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});};
  await el('listen-enable').fire('click');assert.match(el('listen-status').textContent,/permission was denied/);assert.equal(el('listen-enable').disabled,false);media.getUserMedia=original;
  let resolve;pendingCapture=new Promise(r=>resolve=r);
  const waiting=el('listen-enable').fire('click');await flush();await el('listen-disable').fire('click');
  let stopped=false;resolve({getTracks:()=>[{stop(){stopped=true;}}]});await waiting;assert.ok(stopped,'Cancelled permission request must release late stream');
  console.log('Practice UI state checks passed: inputs, permission errors, late cancellation, scoring, timeout, retry, next, playback/visibility pauses, and disconnect.');
})().catch(error=>{console.error(error);process.exitCode=1;});

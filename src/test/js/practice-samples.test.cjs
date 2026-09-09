// Additional integration check using the real bundled steel-guitar samples.
// Requires ffmpeg on PATH; it is a test tool only, never an application dependency.
const {spectrum,chords}=require('./practice.test.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const box={MIDI:{Soundfont:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../main/resources/static/soundfonts/acoustic_guitar_steel-mp3.js'),'utf8'),box);
const font=box.MIDI.Soundfont.acoustic_guitar_steel,decoded=new Map(),rate=44100;
const names=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
function sample(midi){
  if(!decoded.has(midi)) {
    const key=names[midi%12]+(Math.floor(midi/12)-1);
    const input=Buffer.from(font[key].split(',')[1],'base64');
    const result=spawnSync('ffmpeg',['-v','error','-i','pipe:0','-f','f32le','-ac','1','-ar',String(rate),'pipe:1'],{input,maxBuffer:4*1024*1024,windowsHide:true});
    if(result.error)throw result.error;
    assert.equal(result.status,0,result.stderr.toString());
    const audio=new Float32Array(result.stdout.length/4);
    for(let i=0;i<audio.length;i++)audio[i]=result.stdout.readFloatLE(i*4);
    decoded.set(midi,audio);
  }
  return decoded.get(midi);
}
const detect=ChordDetection.createDetector(rate,8192);
function estimateNotes(notes,time=.5) {
  const samples=Float32Array.from({length:8192},(_,i)=>notes.reduce((sum,n,string)=>sum+(sample(n)[Math.floor((time-string*.035)*rate)+i]||0)/notes.length,0));
  return detect(spectrum([],rate,{samples}));
}
for(const [name,notes,pcs] of chords){
  let passes=0;
  for(const time of [.35,.5,.8]) {
    const estimate=estimateNotes(notes,time);
    if(ChordDetection.matches(estimate,pcs))passes++;
    for(const [wrong,,other] of chords)if(wrong!==name)assert.equal(ChordDetection.matches(estimate,other),false,name+' sample must not pass as '+wrong);
  }
  assert.ok(passes>=2,name+' actual steel-guitar samples should match in at least two windows; matched '+passes);
  assert.equal(ChordDetection.matches(estimateNotes([notes[0]]),pcs),false,name+' root alone must not pass');
}
assert.equal(ChordDetection.matches(estimateNotes([48,55,60]),[0,4,7]),false,'Sampled C without third must not pass');
assert.equal(ChordDetection.matches(estimateNotes([48,52,55,61]),[0,4,7]),false,'Sampled C with wrong extra note must not pass');
for(const [name,notes,pcs] of chords.filter(c=>['E','A','D'].includes(c[0]))) {
  const hold=new ChordDetection.MatchHold();let confirmed=false;
  for(let frame=0;frame<20;frame++) {
    const estimate=estimateNotes(notes,.15+frame*.08);
    if(hold.update(ChordDetection.matches(estimate,pcs),frame*80)){confirmed=true;break;}
  }
  assert.ok(confirmed,name+' sampled strum reaches confirmed success across successive audio frames');
}
console.log('Bundled steel-guitar sample checks passed for '+chords.length+' chords at three points in a strum.');

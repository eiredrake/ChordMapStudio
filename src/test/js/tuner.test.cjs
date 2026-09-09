const assert=require('node:assert/strict');
require('../../main/resources/static/tuner.js');
const T=globalThis.GuitarTuner;
for(const rate of [44100,48000,96000])for(const midi of [40,45,50,55,59,64])for(const cents of [-35,0,35]) {
  const frequency=440*2**((midi-69)/12+cents/1200);
  const samples=Float32Array.from({length:8192},(_,i)=>{
    const phase=2*Math.PI*frequency*i/rate;
    return .12*(Math.sin(phase)+.6*Math.sin(2*phase)+.3*Math.sin(3*phase))*Math.exp(-i/rate*2)+.01;
  });
  const pitch=T.pitch(samples,rate);
  assert.ok(pitch,`Detected MIDI ${midi}, ${cents} cents at ${rate}`);
  assert.ok(Math.abs(1200*Math.log2(pitch.frequency/frequency))<3,`Pitch accuracy: ${JSON.stringify(pitch)}`);
  const reading=T.reading(pitch.frequency,[40,45,50,55,59,64].indexOf(midi));
  assert.equal(reading.direction,cents===0?'in-tune':cents<0?'up':'down');
}
assert.equal(T.pitch(new Float32Array(8192),48000),null);
assert.equal(T.pitch(new Float32Array(8192).fill(.1),48000),null,'DC is not a note');
let seed=1;
const noise=Float32Array.from({length:8192},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2**32-.5)*.2;});
assert.equal(T.pitch(noise,48000),null,'Broadband noise is not a stable note');
assert.equal(T.reading(110,0).direction,'wrong-string');
assert.equal(T.reading(82.4069,0).name,'E2');
console.log('Tuner pitch, tuning direction, silence and noise checks passed.');

const hold=new T.TuningHold();let confirmed=false;
for(let frame=0;frame<19;frame++)if(hold.update(frame!==5 && frame!==11,frame*80))confirmed=true;
assert.ok(confirmed,'Brief dropouts do not discard all in-tune evidence');
hold.reset();for(let frame=0;frame<40;frame++)assert.equal(hold.update(frame%2===0,frame*80),false,'Sparse matches do not pass');
hold.reset();hold.update(true,0);hold.update(true,160);assert.equal(hold.update(true,2000),false,'Stalled audio cannot pass');
assert.equal(hold.progress,0);

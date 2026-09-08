const assert=require('node:assert/strict');
require('../../main/resources/static/chord-detection.js');
const D=globalThis.ChordDetection;
// Generate time-domain plucks and take an independent radix-2 FFT, as the browser
// does. Test signals vary harmonic rolloff, tuning, gain, and sample rate.
function spectrum(notes,rate,{gain=.08,cents=0,rolloff=1.3,noise=0,samples}={}) {
  const size=8192,re=new Float64Array(size),im=new Float64Array(size);
  let seed=42;
  for(let i=0;i<size;i++) {
    let value=0;
    for(const [n,midi] of notes.entries())for(let h=1;h<=8;h++) {
      const f=440*2**((midi-69+cents/100)/12)*h;
      value+=gain/(notes.length||1)/h**rolloff*Math.sin(2*Math.PI*f*i/rate+n*.72+h*.13)*Math.exp(-i/rate*2);
    }
    seed=(1664525*seed+1013904223)>>>0;
    value+=noise*(seed/2**32-.5);
    if(samples)value=samples[i]||0;
    re[i]=value*(.42-.5*Math.cos(2*Math.PI*i/size)+.08*Math.cos(4*Math.PI*i/size));
  }
  for(let i=1,j=0;i<size;i++) {
    let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
    if(i<j)[re[i],re[j]]=[re[j],re[i]];
  }
  for(let len=2;len<=size;len*=2)for(let i=0;i<size;i+=len)for(let j=0;j<len/2;j++) {
    const a=-2*Math.PI*j/len,c=Math.cos(a),s=Math.sin(a),b=i+j+len/2;
    const tr=re[b]*c-im[b]*s,ti=re[b]*s+im[b]*c;
    re[b]=re[i+j]-tr;im[b]=im[i+j]-ti;re[i+j]+=tr;im[i+j]+=ti;
  }
  return Float32Array.from({length:size/2},(_,i)=>20*Math.log10(Math.hypot(re[i],im[i])/size));
}
const chords=[['C',[48,52,55,60,64],[0,4,7]],['Am',[45,52,57,60,64],[9,0,4]],['E',[40,47,52,56,59,64],[4,8,11]],['Em',[40,47,52,55,59,64],[4,7,11]],['G',[43,47,50,55,59,67],[7,11,2]],['D',[50,57,62,66],[2,6,9]],['A5',[45,52,57],[9,4]]];
for(const rate of [44100,48000]) {
  const detect=D.createDetector(rate,8192);
  for(const [name,notes,pcs] of chords)for(const options of [{},{gain:.01,rolloff:1.7,cents:8},{gain:.12,rolloff:1.1,cents:-8,noise:.0005}]) {
    const e=detect(spectrum(notes,rate,options));
    assert.ok(D.matches(e,pcs),name+' should match at '+rate+': '+JSON.stringify(e));
    for(const [wrong,,other] of chords)if(wrong!==name)assert.equal(D.matches(e,other),false,name+' must not pass as '+wrong);
  }
  assert.equal(D.matches(detect(spectrum([48],rate)),[0,4,7]),false,'Root alone cannot pass C');
  assert.equal(D.matches(detect(spectrum([48,55,60],rate)),[0,4,7]),false,'Missing third cannot pass C');
  assert.equal(D.matches(detect(spectrum([48,52,55,61],rate)),[0,4,7]),false,'Extra wrong note cannot pass C');
  assert.equal(D.matches(detect(spectrum([],rate)),[0,4,7]),false,'Silence cannot pass');
  assert.equal(D.matches(detect(spectrum([],rate,{noise:.1})),[0,4,7]),false,'Noise cannot pass');
}
const hold=new D.MatchHold();
const singleE={fit:.95,strongest:1,total:1,chroma:[0,0,0,0,1,0,0,0,0,0,0,0]};
assert.match(D.feedback(singleE,[4,8,11]),/G# \/ B/,'Explain why a single E is not E major');
assert.match(D.feedback(null,[4,8,11]),/not clear/);
for(const now of [0,80,160,240,320,400])assert.equal(hold.update(true,now),false);
assert.equal(hold.update(true,480),true);
hold.reset();hold.update(true,0);assert.equal(hold.update(true,1000),false,'Stalled tab cannot pass');
hold.update(false,1080);assert.equal(hold.update(true,1160),false,'Mismatch resets hold');
console.log('Detection checks passed: varied plucks, wrong chords, missing/extra tones, noise, silence, and sustained-match timing.');
module.exports={spectrum,chords};

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const elements=new Map();
const context=vm.createContext({document:{querySelector(selector){
  if(!elements.has(selector))elements.set(selector,{value:selector==='#scale-root'?'A':selector==='#scale-type'?'minor-pentatonic':'5',addEventListener(){}});
  return elements.get(selector);
},addEventListener(){}},fetch:()=>new Promise(()=>{})});
for(const file of ['app.js','scales.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../main/resources/static',file),'utf8'),context);
const scale=context.createScale('A','minor-pentatonic');
assert.deepEqual(Array.from(scale.notes),['A','C','D','E','G']);
assert.deepEqual(Array.from(context.createScale('Bb','major').notes),['Bb','C','D','Eb','F','G','A']);
assert.deepEqual(Array.from(context.createScale('F#','major').notes),['F#','G#','A#','B','C#','D#','E#']);
assert.deepEqual(Array.from(context.createScale('A','minor-blues').notes),['A','C','D','Eb','E','G']);
assert.throws(()=>context.createScale('H','major'));
assert.throws(()=>context.createScale('A','unknown'));
const opens=[64,59,55,50,45,40];
for(const root of ['C','F#','Bb','A'])for(const type of ['minor-pentatonic','major-pentatonic','major','minor','harmonic-minor','minor-blues']){
  const data=context.createScale(root,type);
  for(const [start,end] of [[0,5],[5,10],[10,15],[15,20],[0,15]]){
    const svg=context.buildScaleSvg(data,start,end);
    const expected=opens.reduce((count,open)=>count+Array.from({length:end-start+1},(_,i)=>start+i).filter(fret=>data.pitches.includes((open+fret)%12)).length,0);
    assert.equal([...svg.matchAll(/<circle /g)].length,expected);
    for(const match of svg.matchAll(/<text x="[\d.]+" y="[\d.]+" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="white"><title>String (\d), fret (\d+)(, root)?<\/title>([^<]+)<\/text>/g)){
      const pitch=(opens[Number(match[1])-1]+Number(match[2]))%12;
      assert.equal(match[4],data.notes[data.pitches.indexOf(pitch)]);
      assert.equal(Boolean(match[3]),pitch===data.root);
    }
  }
}
assert.match(elements.get('#scale-notes').textContent,/A minor pentatonic/);
console.log('Scale notes and fretboard checks passed.');

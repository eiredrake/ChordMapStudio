const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/main/resources/static/app.js','utf8');
const key='chord-map-studio.board.v1',stored=new Map();
const chord=symbol=>({symbol,name:symbol+' major',tones:['A','C#','E'],voicings:[{frets:[-1,0,2,2,2,0],fingers:[0,0,1,2,3,0]},{frets:[5,7,7,6,5,5],fingers:[1,3,4,2,1,1]}]});
function launch(blocked=false){
  const elements=new Map(),get=s=>{if(!elements.has(s))elements.set(s,{addEventListener(t,fn){this[t]=fn;}});return elements.get(s);};
  const calls=[];
  const box=vm.createContext({document:{querySelector:get,addEventListener(){}},stopPlayback(){},fetch(url){calls.push(url);return new Promise(()=>{});},localStorage:{getItem(k){if(blocked)throw Error('blocked');return stored.get(k)??null;},setItem(k,v){if(blocked)throw Error('blocked');stored.set(k,v);}}});
  vm.runInContext(source,box);return {box,calls,get};
}
assert.equal(launch().calls.length,1,'First visit loads the starter chord');
stored.set(key,JSON.stringify({version:1,cards:[{data:chord('D'),voicing:1,practiceSelected:false},{data:chord('A'),voicing:0}]}));
let app=launch();assert.equal(app.calls.length,0,'Restoring does not add C or require a fetch');
assert.equal(vm.runInContext('state.chords[0].data.symbol',app.box),'D');
assert.equal(vm.runInContext('state.chords[0].voicing',app.box),1);
assert.equal(vm.runInContext('state.chords[0].practiceSelected',app.box),false);
vm.runInContext('state.chords.reverse();renderBoard()',app.box);
app=launch();assert.equal(vm.runInContext('state.chords[0].data.symbol',app.box),'A','Order survives reload');
app.get('#clear-button').click();app=launch();assert.equal(app.calls.length,0);assert.equal(vm.runInContext('state.chords.length',app.box),0,'An intentionally empty board stays empty');
stored.set(key,'{bad');assert.equal(launch().calls.length,1,'Malformed storage falls back safely');
stored.set(key,JSON.stringify({version:1,cards:[{data:chord('A'),voicing:9}]}));assert.equal(launch().calls.length,1,'Invalid voicing rejected');
app=launch(true);assert.equal(app.calls.length,1);assert.doesNotThrow(()=>app.box.saveBoard(),'Blocked storage does not break editing');
console.log('Board persistence checks passed: reload, ordering, voicings, selections, empty deck and unavailable/corrupt storage.');

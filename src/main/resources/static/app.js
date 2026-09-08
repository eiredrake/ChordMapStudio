const state={chords:[],nextId:1};
const tuning=['E','A','D','G','B','E'],stringColors=['#ec4a2d','#e3b626','#3465b0','#dd7636','#76a45d','#8a5a9d'],midiOpen=[40,45,50,55,59,64];
const $=s=>document.querySelector(s);
function escapeXml(value){return String(value).replace(/[<>&\"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','\"':'&quot;',"'":'&apos;'}[c]));}

async function addChord(symbol){
  const error=$('#error');error.hidden=true;
  try{const response=await fetch('/api/chords?symbol='+encodeURIComponent(symbol)),data=await response.json();if(!response.ok)throw new Error(data.error||'Could not generate that chord.');state.chords.push({id:state.nextId++,data,voicing:0});renderBoard();return data;}
  catch(e){error.textContent=e.message;error.hidden=false;throw e;}
}

function renderBoard(){
  const board=$('#chord-board');$('#chord-count').textContent=`${state.chords.length} ${state.chords.length===1?'chord':'chords'}`;$('#clear-button').disabled=state.chords.length===0;
  board.innerHTML=state.chords.length?state.chords.map(buildCard).join(''):'<div class="empty-board">Add a chord above to start your board.</div>';
}

function buildCard(card){
  const chord=card.data,voicing=chord.voicings[card.voicing],name=chord.name.split(' ').slice(1).join(' ');
  return `<article class="chord-card" data-card="${card.id}"><header><div><span class="section-label">CHORD</span><h3>${escapeXml(chord.symbol)}<i>${escapeXml(name)}</i></h3></div><button class="remove-card" type="button" data-remove="${card.id}" aria-label="Remove ${escapeXml(chord.symbol)}">×</button></header><div class="card-diagram">${buildSvg(chord,voicing)}</div><div class="card-meta"><div class="card-meta-row"><span class="card-tones">${chord.tones.map(escapeXml).join(' · ')}</span><div class="card-actions"><button type="button" class="icon-button" data-play="${card.id}" aria-label="Play ${escapeXml(chord.symbol)}">▶</button><button type="button" class="icon-button" data-download="${card.id}" aria-label="Download ${escapeXml(chord.symbol)}">↓</button></div></div><div class="card-voicings voicings" aria-label="Voicings for ${escapeXml(chord.symbol)}">${chord.voicings.map((_,i)=>`<button type="button" class="${i===card.voicing?'active':''}" data-voice="${card.id}:${i}" aria-label="Voicing ${i+1}">${i+1}</button>`).join('')}</div></div></article>`;
}

function buildSvg(chord,voicing){
  const fretted=voicing.frets.filter(f=>f>0),min=fretted.length?Math.min(...fretted):1,max=fretted.length?Math.max(...fretted):1,shown=4,start=max>shown?min:1,x0=66,gap=48,top=65,row=49,width=gap*5,bottom=top+row*shown;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 372 300" role="img" aria-label="${escapeXml(chord.symbol)} chord diagram"><rect width="372" height="300" fill="#f8f5ee"/>`;
  for(let f=0;f<=shown;f++){const y=top+f*row;s+=`<line x1="${x0}" y1="${y}" x2="${x0+width}" y2="${y}" stroke="#17120e" stroke-width="${f===0&&start===1?7:3}"/>`;}
  for(let i=0;i<shown;i++)s+=`<text x="31" y="${top+i*row+31}" text-anchor="middle" font-family="Arial" font-size="13" fill="#786f64">${start+i}</text>`;
  const groups=new Map();voicing.frets.forEach((f,i)=>{if(f<=0)return;const key=f+':'+voicing.fingers[i],g=groups.get(key)||[];g.push(i);groups.set(key,g)});
  for(const[key,strings]of groups){if(strings.length<2)continue;const[fret,finger]=key.split(':').map(Number),first=Math.min(...strings),last=Math.max(...strings);if(last-first<2)continue;const cy=top+(fret-start+.5)*row;if(cy>=top&&cy<=bottom)s+=`<line x1="${x0+first*gap}" y1="${cy}" x2="${x0+last*gap}" y2="${cy}" stroke="#ed5b2b" stroke-width="30" stroke-linecap="round"/><text x="${x0+(first+last)*gap/2}" y="${cy-19}" text-anchor="middle" font-family="Arial" font-size="8" font-weight="800" fill="#786f64">BARRE ${finger}</text>`;}
  for(let i=0;i<6;i++){const x=x0+i*gap,fret=voicing.frets[i];s+=`<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${stringColors[i]}" stroke-width="4"/><text x="${x}" y="${bottom+26}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="${stringColors[i]}">${tuning[i]}</text>`;if(fret<0)s+=`<text x="${x}" y="${top-16}" text-anchor="middle" font-family="Arial" font-size="22">×</text>`;else if(fret===0)s+=`<circle cx="${x}" cy="${top-20}" r="7" fill="none" stroke="#17120e" stroke-width="2"/>`;else{const cy=top+(fret-start+.5)*row;if(cy>=top&&cy<=bottom)s+=`<circle cx="${x}" cy="${cy}" r="16" fill="#ed5b2b" stroke="#f8f5ee" stroke-width="3"/><text x="${x}" y="${cy+5}" text-anchor="middle" font-family="Arial" font-weight="800" font-size="14" fill="white">${voicing.fingers[i]}</text>`;}}
  return s+'</svg>';
}

function findCard(id){return state.chords.find(c=>c.id===Number(id));}
let playbackContext,playbackGeneration=0;
const playingStrings=new Set(),pluckBuffers=new Map();
function stringFrequency(string,fret){return 440*Math.pow(2,(midiOpen[string]+fret-69)/12);}

// A picked string has a bright attack; its upper harmonics fade faster than its fundamental.
// Render locally so playback needs no audio downloads or additional dependencies.
function createPluckSamples(sampleRate,frequency,string){
  const duration=3.2,samples=new Float32Array(Math.ceil(sampleRate*duration));
  const partials=Math.min(28,Math.floor(sampleRate*.45/frequency));
  const pickPosition=.19+string*.012;
  for(let harmonic=1;harmonic<=partials;harmonic++){
    const amplitude=Math.sin(Math.PI*harmonic*pickPosition)/harmonic;
    const decaySeconds=(1.25-string*.075)/(1+harmonic*.24);
    const decay=Math.exp(-1/(sampleRate*decaySeconds));
    const angle=2*Math.PI*frequency*harmonic/sampleRate;
    const rotationReal=Math.cos(angle)*decay,rotationImag=Math.sin(angle)*decay;
    let real=amplitude,imag=0;
    for(let i=0;i<samples.length;i++){
      samples[i]+=imag;
      const nextReal=real*rotationReal-imag*rotationImag;
      imag=imag*rotationReal+real*rotationImag;real=nextReal;
    }
  }
  let peak=0;
  for(let i=0;i<samples.length;i++){
    samples[i]*=Math.min(1,i/(sampleRate*.002))*Math.min(1,(samples.length-1-i)/(sampleRate*.04));
    peak=Math.max(peak,Math.abs(samples[i]));
  }
  if(peak>0)for(let i=0;i<samples.length;i++)samples[i]*=.14/peak;
  return samples;
}

async function playCard(card){
  const generation=++playbackGeneration;
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error('Audio playback is not supported in this browser.');
    if(!playbackContext||playbackContext.state==='closed'){
      playbackContext=new AudioCtx();pluckBuffers.clear();
    }
    const ctx=playbackContext;
    if(ctx.state==='suspended')await ctx.resume();
    if(generation!==playbackGeneration)return;
    // Fade the previous strum before starting another, including rapid repeated clicks.
    for(const voice of playingStrings){
      voice.gain.gain.cancelScheduledValues(ctx.currentTime);
      voice.gain.gain.setTargetAtTime(0,ctx.currentTime,.008);
      voice.source.stop(ctx.currentTime+.04);
    }
    playingStrings.clear();
    const notes=card.data.voicings[card.voicing].frets.flatMap((fret,string)=>{
      if(fret<0)return [];
      const key=string+':'+fret;
      if(!pluckBuffers.has(key)){
        const samples=createPluckSamples(ctx.sampleRate,stringFrequency(string,fret),string);
        const buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);
        buffer.copyToChannel(samples,0);
        if(pluckBuffers.size>=48)pluckBuffers.delete(pluckBuffers.keys().next().value);
        pluckBuffers.set(key,buffer);
      }
      return [{string,buffer:pluckBuffers.get(key)}];
    });
    const now=ctx.currentTime+.045;
    for(const note of notes){
      const source=ctx.createBufferSource(),gain=ctx.createGain(),voice={source,gain};
      source.buffer=note.buffer;source.connect(gain);gain.connect(ctx.destination);
      source.onended=()=>{source.disconnect();gain.disconnect();playingStrings.delete(voice);};
      playingStrings.add(voice);source.start(now+note.string*.035);
    }
  }catch(e){const error=$('#error');error.textContent='Could not play chord: '+e.message;error.hidden=false;}
}
function downloadCard(card){const svg=buildSvg(card.data,card.data.voicings[card.voicing]),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));a.download=card.data.symbol.replace(/[^a-z0-9#]+/gi,'-')+'-chord-map.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}

$('#chord-form').addEventListener('submit',async e=>{e.preventDefault();try{await addChord($('#chord-input').value);$('#chord-input').select()}catch{}});
$('#clear-button').addEventListener('click',()=>{state.chords=[];renderBoard();});
document.addEventListener('click',async e=>{const quick=e.target.closest('[data-chord]');if(quick){$('#chord-input').value=quick.dataset.chord;try{await addChord(quick.dataset.chord)}catch{}}const remove=e.target.closest('[data-remove]');if(remove){state.chords=state.chords.filter(c=>c.id!==Number(remove.dataset.remove));renderBoard();}const voice=e.target.closest('[data-voice]');if(voice){const[id,index]=voice.dataset.voice.split(':').map(Number),card=findCard(id);if(card){card.voicing=index;renderBoard();}}const play=e.target.closest('[data-play]');if(play){const card=findCard(play.dataset.play);if(card)playCard(card);}const down=e.target.closest('[data-download]');if(down){const card=findCard(down.dataset.download);if(card)downloadCard(card);}});

if(document.modelContext?.registerTool)document.modelContext.registerTool({name:'add_guitar_chords',title:'Add guitar chords',description:'Add one or more guitar chord maps to the visible chord board.',inputSchema:{type:'object',properties:{symbols:{type:'array',items:{type:'string'}}},required:['symbols'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async({symbols})=>{const added=[];for(const symbol of symbols){const chord=await addChord(symbol);added.push(chord.symbol);}return{added,total:state.chords.length};}});
addChord('C');

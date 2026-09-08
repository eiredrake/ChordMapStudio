// smplr and the soundfonts are served locally, behind the same authentication as the app.
let audioContext, instrumentPromise, instrumentName, activeInstrument;
let playbackRun=0, playbackTimer, playbackActive=false;
let instrumentLoad=0;
const scheduledStops=[];
const openStringMidi=[40,45,50,55,59,64];
const audioElement=id=>document.getElementById(id);
const audioStatus=text=>{audioElement('playback-status').textContent=text;};

function stopPlayback(message='Playback stopped.'){
  playbackRun++;
  clearTimeout(playbackTimer);
  scheduledStops.splice(0).forEach(stop=>stop());
  activeInstrument?.stop();
  playbackActive=false;
  audioElement('stop-playback').disabled=true;
  document.querySelectorAll('.is-playing').forEach(el=>el.classList.remove('is-playing'));
  audioStatus(message);
}

async function loadInstrument(name){
  if(instrumentName!==name||!instrumentPromise){
    activeInstrument?.dispose();activeInstrument=undefined;
    instrumentName=name;
    const load=++instrumentLoad;
    instrumentPromise=(async()=>{
      const {Soundfont}=await import('/vendor/smplr.js');
      const instrument=Soundfont(audioContext,{
        instrumentUrl:'/soundfonts/'+name+'-mp3.js',volume:70,
      });
      try{await instrument.ready;}catch(error){instrument.dispose();throw error;}
      if(load!==instrumentLoad){instrument.dispose();return null;}
      activeInstrument=instrument;
      return instrument;
    })();
    const pending=instrumentPromise;
    pending.catch(()=>{if(instrumentPromise===pending)instrumentPromise=undefined;});
  }
  return instrumentPromise;
}

function chordNotes(frets){
  return frets.flatMap((fret,string)=>fret<0?[]:[{note:openStringMidi[string]+fret,string}]);
}

async function playCards(cards){
  stopPlayback('');
  if(!cards.length){audioStatus('Add a chord to start playback.');return;}
  const run=playbackRun;
  const selection=audioElement('instrument');
  const name=selection.value;
  // Snapshot the selected voicings and order for this performance.
  const sequence=cards.map(card=>({id:card.id,symbol:card.data.symbol,notes:chordNotes(card.data.voicings[card.voicing].frets)}));
  const tempo=audioElement('tempo');
  const bpm=Math.round(Math.max(40,Math.min(240,Number(tempo.value)||100)));
  tempo.value=bpm;
  const chordSeconds=240/bpm;
  playbackActive=true;audioElement('stop-playback').disabled=false;
  audioStatus('Loading '+selection.selectedOptions[0].textContent+'…');
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error('This browser does not support audio playback.');
    if(!audioContext||audioContext.state==='closed'){
      audioContext=new AudioCtx();instrumentPromise=undefined;
    }
    await audioContext.resume();
    if(run!==playbackRun)return;
    const instrument=await loadInstrument(name);
    if(run!==playbackRun||!instrument)return;
    const start=audioContext.currentTime+.08;
    for(let index=0;index<sequence.length;index++){
      for(const {note,string} of sequence[index].notes){
        scheduledStops.push(instrument.start({note,time:start+index*chordSeconds+string*.035,
          duration:Math.max(.2,chordSeconds-.22),velocity:78-string*2}));
      }
    }
    // Audio uses the Web Audio clock; the timer only updates the visible progress.
    function updateProgress(){
      if(run!==playbackRun)return;
      const elapsed=audioContext.currentTime-start;
      if(elapsed>=sequence.length*chordSeconds+.25){stopPlayback('Composition finished.');return;}
      const index=Math.max(0,Math.min(sequence.length-1,Math.floor(elapsed/chordSeconds)));
      document.querySelectorAll('[data-card]').forEach(el=>el.classList.toggle('is-playing',Number(el.dataset.card)===sequence[index].id));
      audioStatus('Playing '+(index+1)+' of '+sequence.length+' · '+sequence[index].symbol);
      playbackTimer=setTimeout(updateProgress,80);
    }
    updateProgress();
  }catch(error){
    if(run!==playbackRun)return;
    stopPlayback('Could not load or play this instrument. Please try again.');
    console.error('Chord playback failed',error);
  }
}

function playCard(card){return playCards([card]);}
audioElement('stop-playback').addEventListener('click',()=>stopPlayback());
audioElement('instrument').addEventListener('change',()=>stopPlayback('Sound changed. Press Play to listen.'));
audioElement('tempo').addEventListener('change',()=>{if(playbackActive)stopPlayback('Tempo changed. Press Play to restart.');});

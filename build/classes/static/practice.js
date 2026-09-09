(() => {
  const el=id=>document.getElementById(id), D=ChordDetection;
  const chosen=new Set(), known=new Set();
  const modal=el('practice-modal'), tunerModal=el('tuner-modal');
  let tunerHistory=[], tunerString=0, tunerComplete=false;
  const tuningHold=new GuitarTuner.TuningHold();
  function tunerReset(message='Pluck the selected string.',resetHold=true) {
    tunerHistory=[];if(resetHold)tuningHold.reset();el('tuner-note').textContent='—';el('tuner-direction').textContent=message;
    el('tuner-direction').className='';el('tuner-cents').value=0;el('tuner-measured').textContent='';
  }
  function tunerTarget() {
    const string=tunerString;
    const target=GuitarTuner.reading(440,string).target;
    el('tuner-target').textContent='Play '+GuitarTuner.names[string]+' open · '+target.toFixed(2)+' Hz';
    tunerReset();tunerDiagram();
  }
  function tunerDiagram() {
    const columns=['E','A','D','G','B','E'].map((name,i)=>{
      const x=66+i*48,done=tunerComplete||i<tunerString,active=!tunerComplete&&i===tunerString;
      return `<g class="${active?'tuner-string-active':done?'tuner-string-done':'tuner-string-idle'}">
        ${active?`<rect x="${x-19}" y="25" width="38" height="207" rx="12" class="tuner-highlight"/>`:''}
        <text x="${x}" y="47">${done?'✓':'○'}</text>
        <line x1="${x}" y1="65" x2="${x}" y2="212" stroke-width="${3-i*.35}"/>
        <text x="${x}" y="239">${name}</text><text x="${x}" y="261" class="tuner-string-number">${6-i}</text></g>`;
    }).join('');
    el('tuner-neck').innerHTML=`<svg viewBox="0 0 372 275" role="img" aria-label="${tunerComplete?'All six strings tuned':'Play '+GuitarTuner.names[tunerString]}"><path d="M66 114H306 M66 163H306 M66 212H306" class="tuner-frets"/>${columns}<path d="M64 65H308" class="tuner-nut"/></svg>`;
    el('tuner-progress').textContent=tunerComplete?'✓ All six strings tuned!':'String '+(tunerString+1)+' of 6 · Hold in tune for one second to advance.';
  }
  function tunerUpdate(audible,clipped) {
    if(!tunerModal.open || tunerComplete)return;
    if(!ready() || document.hidden){tunerReset('Listening paused. Select an audio input to continue.');return;}
    const pitch=audible && !clipped?GuitarTuner.pitch(waveform,ctx.sampleRate):null;
    if(!pitch){tuningHold.update(false,performance.now());tunerReset(clipped?'Input is clipping. Lower the input gain.':audible?'No stable single note. Mute the other strings and pluck again.':'Pluck the selected string.',false);tunerConfirmation();return;}
    tunerHistory.push(pitch.frequency);if(tunerHistory.length>3)tunerHistory.shift();
    const frequency=[...tunerHistory].sort((a,b)=>a-b)[Math.floor(tunerHistory.length/2)];
    const reading=GuitarTuner.reading(frequency,tunerString);
    el('tuner-note').textContent=reading.name;
    const message=reading.direction==='in-tune'?'✓ In tune':reading.direction==='up'?'↑ Flat — tune up':reading.direction==='down'?'↓ Sharp — tune down':'Different note. Check that you are plucking the selected open string.';
    if(el('tuner-direction').textContent!==message)el('tuner-direction').textContent=message;
    el('tuner-direction').className=reading.direction==='in-tune'?'tuner-in-tune':'';
    el('tuner-cents').value=Math.max(-50,Math.min(50,reading.cents));
    el('tuner-measured').textContent=frequency.toFixed(1)+' Hz · '+(reading.cents>=0?'+':'')+Math.round(reading.cents)+' cents from target';
    const raw=GuitarTuner.reading(pitch.frequency,tunerString);
    const confirmed=tuningHold.update(reading.direction==='in-tune' && raw.direction==='in-tune',performance.now());
    tunerConfirmation();
    if(confirmed) {
      if(tunerString<5){tunerString++;tunerTarget();}
      else {tunerComplete=true;tunerDiagram();el('tuner-target').textContent='Tuning complete';el('tuner-direction').textContent='? All six strings tuned!';}
    }
  }
  function tunerConfirmation() {
    el('tuner-progress').textContent='String '+(tunerString+1)+' of 6 ? In-tune confirmation: '+Math.round(tuningHold.progress*100)+'%';
  }

  let devices=[], permitted=false, stream, ctx, source, analyser, detector, spectrum, waveform;
  let inputRun=0, busy=false, loop, transition, round, deck=[], index=0, successes=new Set(), attempts=new Set();
  let quietSince=null, armed=false, noise=.002, calibratingUntil=0, quietSamples=[];
  const hold=new D.MatchHold();
  let countInTimer, countInRun=0, pendingStart=false, cycle=1;
  let retriesUsed=0;
  function retrySettings() {
    const input=el('practice-retry-limit'),value=Number(input.value);
    const limit=input.value.trim()==='' || !Number.isFinite(value)?3:Math.max(0,Math.min(10,Math.round(value)));
    input.value=String(limit);input.disabled=!el('practice-auto-retry').checked;
    el('practice-retry-help').textContent=(limit===0?'Infinite retries until matched.':limit+' extra attempt'+(limit===1?'':'s')+'. After the limit, Auto next card decides whether to advance or wait.');
    return {enabled:el('practice-auto-retry').checked,limit};
  }
  function cancelCountIn() {
    countInRun++;clearTimeout(countInTimer);
    el('practice-countin').hidden=true;el('practice-countin-text').textContent='';
    el('practice-stage').hidden=false;
  }
  function startCountIn() {
    cancelCountIn();round=null;hold.reset();
    const input=el('practice-countin-seconds'),value=Number(input.value);
    const seconds=input.value.trim()==='' || !Number.isFinite(value)?3:Math.round(Math.max(0,Math.min(30,value)));
    input.value=String(seconds);
    if(seconds===0){pendingStart=false;beginCard();return;}
    const run=countInRun;
    el('practice-stage').hidden=true;el('practice-countin').hidden=false;
    function show(remaining) {
      if(run!==countInRun)return;
      if(!modal.open || document.hidden || !ready()){pause('Preparation paused. Press Space or Retry card when ready.');return;}
      if(remaining===0){pendingStart=false;cancelCountIn();beginCard();return;}
      el('practice-countin-text').textContent=remaining===seconds+1?'READY!':String(remaining);
      countInTimer=setTimeout(()=>{
        if(run!==countInRun)return;
        el('practice-countin-text').textContent='';
        countInTimer=setTimeout(()=>show(remaining-1),150);
      },850);
    }
    show(seconds+1);
  }
  const status=text=>{el('listen-status').textContent=text;el('tuner-status').textContent=text;};
  const result=text=>{if(el('practice-result').textContent!==text)el('practice-result').textContent=text;};
  const rocksmith=device=>/rocksmith|real\s*tone/i.test(device.label);
  function ready() { return !!stream && stream.getAudioTracks().some(t=>t.readyState==='live' && !t.muted) && ctx?.state==='running'; }
  function buttons() {
    el('practice-start').textContent=deck.length?'OPEN PRACTICE':'START DECK';
    el('practice-start').disabled=!deck.length && (busy || !ready() || performance.now()<calibratingUntil || !state.chords.some(c=>chosen.has(c.id) && D.supported(c)));
    el('practice-end').disabled=!deck.length;
    el('practice-modal-end').disabled=!deck.length;
  }
  function openPractice() {
    if(tunerModal.open)tunerModal.close();
    if(!modal.open)modal.showModal();
    document.documentElement.classList.add('practice-modal-open');
    el('practice-modal-title').focus({preventScroll:true});
  }
  function closePractice() {
    pause('Practice paused. Press Space or Retry card when you are ready.');
    modal.close();
  }
  globalThis.refreshPracticeDeck=()=>{
    const container=el('practice-deck');
    container.replaceChildren();
    for(const card of state.chords) {
      const supported=D.supported(card);
      if(!known.has(card.id)) {known.add(card.id);if(supported && card.practiceSelected!==false)chosen.add(card.id);}
      const label=document.createElement('label');label.className='check-label';
      const check=document.createElement('input');check.type='checkbox';check.checked=chosen.has(card.id);check.disabled=!supported;
      check.addEventListener('change',()=>{check.checked?chosen.add(card.id):chosen.delete(card.id);card.practiceSelected=check.checked;globalThis.saveBoard?.();buttons();});
      label.append(check,document.createTextNode(card.data.symbol+(supported?'':' (not yet supported)')));container.append(label);
    }
    if(!state.chords.length) container.textContent='Add chords to the board above to build your deck.';
    buttons();
  };
  async function refreshDevices() {
    if(!navigator.mediaDevices?.enumerateDevices) {status('Listening needs HTTPS (or localhost) and a browser with audio input support.');return;}
    try {
      devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
      permitted=permitted || devices.some(d=>d.label);
      el('practice-usb').textContent=!permitted?'Allow audio access to check for a Rocksmith cable.':devices.some(rocksmith)?'Rocksmith USB cable detected.':'Rocksmith cable not detected. A generically named USB input can be selected under Microphone / other audio input.';
      const select=el('practice-device'), previous=select.value;
      select.replaceChildren();
      const visible=devices.filter(d=>el('practice-source').value!=='usb'||rocksmith(d));
      for(const [i,d] of visible.entries()) {const option=document.createElement('option');option.value=d.deviceId;option.textContent=d.label||'Audio input '+(i+1);select.append(option);}
      if(!visible.length) {const option=document.createElement('option');option.value='';option.textContent=permitted?'No matching input available':'Select an audio input to list inputs';select.append(option);}
      if(visible.some(d=>d.deviceId===previous))select.value=previous;
      if(previous && !visible.some(d=>d.deviceId===previous)) {
        const option=document.createElement('option');option.value=previous;option.textContent='Selected input unavailable';option.disabled=true;select.append(option);select.value=previous;
      }
    } catch {status('Could not list audio inputs. Check browser permissions and try Refresh inputs.');}
    buttons();
  }
  function pause(message) {
    cancelCountIn();
    clearTimeout(transition);
    if(!deck.length) return;
    round=null;hold.reset();
    el('practice-confirmation').value=0;
    el('practice-result').className='';el('practice-result').textContent=message;
    el('practice-retry').disabled=false;el('practice-next').disabled=false;
    el('practice-countdown').textContent='Paused';
  }
  globalThis.pausePracticeForPlayback=()=>{pause('Paused for playback. When ready, mute the strings and retry this card.');if(tunerModal.open)tunerModal.close();};
  function releaseInput() {
    inputRun++;busy=false;clearTimeout(loop);
    const old=stream;stream=null;old?.getTracks().forEach(t=>t.stop());
    source?.disconnect();source=null;analyser=null;
    const oldContext=ctx;ctx=null;oldContext?.close().catch(()=>{});
    el('practice-level').value=0;
    tunerReset('Waiting for the selected input.');
    pause('Listening stopped. Select an audio input, then retry this card.');buttons();
  }
  async function enable() {
    releaseInput();
    if(!navigator.mediaDevices?.getUserMedia) {status('Open this app over HTTPS (or localhost) to start listening.');return;}
    const run=inputRun;busy=true;buttons();status('Waiting for audio permission...');
    try {
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      ctx=new AudioCtx();resumeAudio();
      if(!permitted) {
        const permission=await navigator.mediaDevices.getUserMedia({audio:true});
        permission.getTracks().forEach(t=>t.stop());
        if(run!==inputRun)return;
        permitted=true;await refreshDevices();
      }
      if(run!==inputRun)return;
      const deviceId=el('practice-device').value;
      if(!deviceId)throw new Error('Select an available input. If the cable has a generic name, choose Microphone / other audio input.');
      const capture=await navigator.mediaDevices.getUserMedia({audio:{deviceId:{exact:deviceId},echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}});
      if(run!==inputRun){capture.getTracks().forEach(t=>t.stop());return;}
      stream=capture;
      if(run!==inputRun)return;
      source=ctx.createMediaStreamSource(stream);analyser=ctx.createAnalyser();
      analyser.fftSize=8192;analyser.smoothingTimeConstant=0;
      source.connect(analyser); // Deliberately no speaker connection: avoid monitoring feedback.
      spectrum=new Float32Array(analyser.frequencyBinCount);waveform=new Float32Array(analyser.fftSize);
      detector=D.createDetector(ctx.sampleRate,analyser.fftSize);
      const track=stream.getAudioTracks()[0];
      track.addEventListener('ended',()=>{if(run===inputRun){releaseInput();status('Input disconnected. Reconnect it and select the input again or reopen the tuner.');void refreshDevices();}});
      track.addEventListener('mute',()=>{if(run===inputRun){pause('Input became unavailable. Check the device, then retry.');buttons();}});
      track.addEventListener('unmute',buttons);
      ctx.addEventListener('statechange',()=>{if(run===inputRun){
        if(!ready())pause('Audio paused. Click the page to resume, then retry.');
        else {quietSamples=[];calibratingUntil=performance.now()+1500;status('Listening: '+track.label+'. Keep strings quiet briefly to measure room noise.');}
        buttons();
      }});
      noise=.002;quietSamples=[];calibratingUntil=performance.now()+1500;
      status(ctx.state==='running'?'Listening: '+track.label+'. Keep strings quiet briefly to measure room noise.':'Audio input connected. Click anywhere on the page to start audio.');
      busy=false;buttons();tick(run);
    } catch(error) {
      if(run!==inputRun)return;
      releaseInput();
      const messages={NotAllowedError:'Audio permission was denied. Allow microphone access in your browser, then select the input again or reopen the tuner.',NotFoundError:'That input is unavailable. Plug it in and refresh the input list.',NotReadableError:'Cannot open that input. Close other apps using it and try again.',OverconstrainedError:'That input is no longer available. Refresh inputs and choose it again.'};
      status(messages[error.name]||error.message||'Could not start listening.');
    }
  }
  function beginCard() {
    cancelCountIn();
    clearTimeout(transition);
    if(!ready()) {status('Select an audio input before retrying.');return;}
    if(performance.now()<calibratingUntil) {status('Wait for the brief quiet input check, then retry.');return;}
    stopPlayback('Practice mode: playback stopped.');
    openPractice();
    const seconds=Math.round(Math.max(2,Math.min(60,Number(el('practice-seconds').value)||10)));el('practice-seconds').value=seconds;
    const card=deck[index];
    round={deadline:performance.now()+seconds*1000,seconds,heard:false};quietSince=null;armed=false;hold.reset();
    el('practice-confirmation').value=0;
    el('practice-stage').hidden=false;
    el('practice-live-input').textContent='Input: '+stream.getAudioTracks()[0].label;
    el('practice-live-notes').textContent='Waiting for your strum.';
    el('practice-live-detail').textContent='';
    el('practice-progress').textContent='Card '+(index+1)+' of '+deck.length;
    const retry=retrySettings();
    el('practice-attempt').textContent=retry.enabled?(retriesUsed?'Retry '+retriesUsed+' of '+(retry.limit===0?'Infinite':retry.limit):'First attempt · '+(retry.limit===0?'Infinite retries':retry.limit+' extra attempts')):'';
    el('practice-cycle').textContent='Pass '+cycle;
    el('practice-chord').textContent=card.data.symbol;
    el('practice-target-tones').textContent='Listening for '+D.pitches(card).map(D.noteName).join(' / ')+'. Play the whole chord.';
    el('practice-diagram').innerHTML=buildSvg(card.data,card.data.voicings[card.voicing]);
    el('practice-diagram').hidden=!el('practice-hint').checked;
    el('practice-time').max=seconds;el('practice-time').value=seconds;
    el('practice-countdown').textContent=seconds.toFixed(1)+' seconds left';
    el('practice-result').className='';el('practice-result').textContent='Mute the strings briefly, then strum.';
    el('practice-retry').disabled=true;el('practice-next').disabled=true;
    if(pendingStart)startCountIn();
  }
  function finishCard(success) {
    if(!round)return;
    el('practice-confirmation').value=success?100:0;
    const attempt=cycle+':'+index;
    attempts.add(attempt);if(success)successes.add(attempt);
    const heard=round.heard,wasArmed=armed;round=null;
    el('practice-result').className=success?'practice-success':'';
    result(success?'\u2713  Chord matched!':heard&&!wasArmed?'I heard audio, but need a quiet gap first. Mute the strings, then retry.':heard?'Not quite this time. Try again whenever you like.':'I could not hear a clear attempt. Check the input level and try again.');
    el('practice-countdown').textContent=success?'Nice work.':'Time for another try?';
    el('practice-retry').disabled=false;el('practice-next').disabled=false;
    const retry=retrySettings();
    if(!success && retry.enabled && (retry.limit===0 || retriesUsed<retry.limit)) {
      el('practice-countdown').textContent='Trying this chord again shortly. Mute the strings, then strum.';
      transition=setTimeout(()=>{
        if(!modal.open || document.hidden || !ready())return;
        const current=retrySettings();
        if(!current.enabled || (current.limit!==0 && retriesUsed>=current.limit))return;
        retriesUsed++;beginCard();
      },1600);
    } else if(success || el('practice-auto-next').checked)transition=setTimeout(()=>{if(modal.open && !document.hidden)nextCard();},1600);
  }
  function tick(run) {
    if(run!==inputRun || !analyser)return;
    if(!ready()) {
      if(tunerModal.open)tunerReset('Waiting for audio. Click the page to resume, or check the selected input.');
      loop=setTimeout(()=>tick(run),80);return;
    }
    try {
      const now=performance.now();
      analyser.getFloatTimeDomainData(waveform);analyser.getFloatFrequencyData(spectrum);
      const rms=Math.sqrt(waveform.reduce((sum,v)=>sum+v*v,0)/waveform.length);
      const clipped=waveform.some(v=>Math.abs(v)>.98);
      el('practice-level').value=Math.min(1,rms*8);
      if(now<calibratingUntil) {
        if(tunerModal.open)tunerReset('Measuring background level. Keep strings quiet...');
        quietSamples.push(rms);el('practice-heard').textContent='Measuring background level. Keep the strings quiet...';
      } else {
        if(quietSamples.length) {
          quietSamples.sort((a,b)=>a-b);noise=Math.max(.0004,Math.min(.015,quietSamples[Math.floor(quietSamples.length*.2)]));quietSamples=[];
          status('Listening. Start a deck to score your chords. The input preview alone does not grade collection cards.');
          buttons();
        }
        const audible=rms>Math.max(.002,noise*3);
        tunerUpdate(audible,clipped);
        const estimate=audible && !clipped && !tunerModal.open?detector(spectrum):null;
        el('practice-heard').textContent=clipped?'Input is clipping. Lower the input gain.':estimate?.fit>=.72?'Heard pitch classes: '+estimate.notes.join(' / '):audible?'Listening, but the chord is not clear yet.':'Ready. Strum your guitar.';
        if(round && modal.open && ready()) {
          const expected=D.pitches(deck[index]);
          const clear=estimate?.fit>=.72 && estimate.strongest>1e-6;
          const heard=clear?Array.from({length:12},(_,pc)=>pc).filter(pc=>estimate.chroma[pc]>=estimate.strongest*.08):[];
          const missing=expected.filter(pc=>!heard.includes(pc)),extra=heard.filter(pc=>!expected.includes(pc));
          el('practice-live-notes').textContent=clipped?'Signal too loud — clipping.':!audible?'Signal quiet.':clear?'Heard notes: '+heard.map(D.noteName).join(' / '):'Audio detected, but no clear notes yet.';
          el('practice-live-detail').textContent=clear?(missing.length?'Missing or weak: '+missing.map(D.noteName).join(' / ')+'. ':'All target notes heard. ')+(extra.length?'Other notes: '+extra.map(D.noteName).join(' / ')+'. ':'')+'Notes are estimates; confirmation needs a sustained match.':'';
          const remaining=Math.max(0,(round.deadline-now)/1000);
          el('practice-time').value=remaining;el('practice-countdown').textContent=remaining.toFixed(1)+' seconds left';
          if(!audible) {quietSince??=now;if(now-quietSince>=250)armed=true;} else quietSince=null;
          if(audible)round.heard=true;
          const match=armed && !!estimate && D.matches(estimate,D.pitches(deck[index]));
          const confirmed=hold.update(match,now);
          el('practice-confirmation').value=Math.round(hold.progress*100);
          if(!armed)result('Waiting for a quiet gap. Mute the strings briefly, then strum.');
          else if(clipped)result('Input is too loud. Lower the amp or input level and try again.');
          else if(!audible)result('Ready for your strum. Play the whole '+deck[index].data.symbol+' chord.');
          else if(match)result('Confirming chord... '+Math.round(hold.progress*100)+'%. Keep it ringing.');
          else result(D.feedback(estimate,D.pitches(deck[index])));
          if(now>=round.deadline)finishCard(false);
          else if(confirmed)finishCard(true);
        }
      }
    } catch {releaseInput();status('Listening was interrupted. Select an audio input to try again.');return;}
    loop=setTimeout(()=>tick(run),80);
  }
  function endSession() {
    cancelCountIn();pendingStart=false;
    el('practice-confirmation').value=0;
    clearTimeout(transition);
    round=null;deck=[];hold.reset();buttons();
    el('practice-retry').disabled=true;el('practice-next').disabled=true;
    el('practice-countdown').textContent='';el('practice-time').value=0;
    el('practice-result').className='';el('practice-result').textContent=successes.size+' cards matched across '+attempts.size+' cards attempted. Keep practicing at your own pace.';
  }
  function nextCard() {
    clearTimeout(transition);
    if(!deck.length)return;
    if(index+1===deck.length && !el('practice-repeat').checked){endSession();return;}
    if(!ready()){pause('Select an audio input before the next card.');return;}
    if(index+1===deck.length){index=0;cycle++;}else index++;
    retriesUsed=0;
    beginCard();
  }
  function resumeAudio() {
    if(ctx?.state==='suspended')void ctx.resume().catch(()=>status('Audio could not resume. Select the input again or reopen the tuner.'));
  }
  async function ensureListening() {
    resumeAudio();
    if(busy)return;
    if(stream?.getAudioTracks().some(t=>t.readyState==='live') && stream.getAudioTracks()[0].getSettings().deviceId===el('practice-device').value)return;
    await enable();
  }
  el('listen-refresh').addEventListener('click',refreshDevices);
  el('practice-source').addEventListener('change',async()=>{el('practice-device').value='';await refreshDevices();await ensureListening();});
  el('practice-device').addEventListener('change',enable);
  document.addEventListener('pointerdown',resumeAudio);
  document.addEventListener('keyup',resumeAudio);
  el('practice-hint').addEventListener('change',()=>{el('practice-diagram').hidden=!el('practice-hint').checked;});
  el('practice-start').addEventListener('click',()=>{
    if(deck.length){openPractice();return;}
    if(!ready())return;
    if(performance.now()<calibratingUntil){status('Keep quiet for the brief input check, then start the deck.');return;}
    deck=state.chords.filter(c=>chosen.has(c.id)&&D.supported(c)).map(c=>({id:c.id,voicing:c.voicing,data:structuredClone(c.data)}));
    if(!deck.length)return;
    if(el('practice-shuffle').checked)for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    index=0;cycle=1;retriesUsed=0;pendingStart=true;successes=new Set();attempts=new Set();buttons();beginCard();
  });
  el('practice-retry').addEventListener('click',()=>{if(deck.length)beginCard();});
  el('practice-auto-retry').addEventListener('change',retrySettings);
  el('practice-retry-limit').addEventListener('change',retrySettings);
  el('practice-next').addEventListener('click',nextCard);
  el('practice-end').addEventListener('click',endSession);
  el('practice-modal-end').addEventListener('click',endSession);
  el('practice-close').addEventListener('click',closePractice);
  modal.addEventListener('cancel',e=>{e.preventDefault();closePractice();});
  modal.addEventListener('close',()=>{
    if(modal.open)return;
    pause('Practice paused. Press Space or Retry card when you are ready.');
    if(!tunerModal.open){document.documentElement.classList.remove('practice-modal-open');el('practice-start').focus({preventScroll:true});}
  });
  const outside=e=>{
    const rect=modal.getBoundingClientRect();
    return e.clientX<rect.left || e.clientX>rect.right || e.clientY<rect.top || e.clientY>rect.bottom;
  };
  let backdropPress=false;
  modal.addEventListener('pointerdown',e=>{backdropPress=e.target===modal && outside(e);});
  modal.addEventListener('click',e=>{if(backdropPress && e.target===modal && outside(e))closePractice();backdropPress=false;});
  document.addEventListener('keydown',e=>{
    if(e.code!=='Space' || e.repeat || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || !modal.open || !deck.length)return;
    if(e.target.closest('input, textarea, select, button, [contenteditable]:not([contenteditable="false"])'))return;
    e.preventDefault();beginCard();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('Paused while this tab was away. Retry when you are ready.');else void refreshDevices();});
  window.addEventListener('pagehide',releaseInput);
  el('tuner-open').addEventListener('click',()=>{
    stopPlayback('Tuner: playback stopped.');
    pause('Paused for tuning. Retry the card when ready.');
    if(modal.open)modal.close();
    if(!tunerModal.open)tunerModal.showModal();
    document.documentElement.classList.add('practice-modal-open');
    tunerString=0;tunerComplete=false;tunerTarget();el('tuner-title').focus({preventScroll:true});void ensureListening();
  });
  el('tuner-close').addEventListener('click',()=>tunerModal.close());
  tunerModal.addEventListener('cancel',e=>{e.preventDefault();tunerModal.close();});
  tunerModal.addEventListener('close',()=>{
    tunerReset();
    if(!modal.open){document.documentElement.classList.remove('practice-modal-open');el('tuner-open').focus({preventScroll:true});}
  });
  let tunerBackdrop=false;
  const outsideTuner=e=>{const r=tunerModal.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  tunerModal.addEventListener('pointerdown',e=>{tunerBackdrop=e.target===tunerModal&&outsideTuner(e);});
  tunerModal.addEventListener('click',e=>{if(tunerBackdrop&&e.target===tunerModal&&outsideTuner(e))tunerModal.close();tunerBackdrop=false;});
  el('tuner-restart').addEventListener('click',()=>{tunerString=0;tunerComplete=false;tunerTarget();});
  navigator.mediaDevices?.addEventListener('devicechange',refreshDevices);
  refreshPracticeDeck();void refreshDevices().then(ensureListening);
})();

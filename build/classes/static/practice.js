(() => {
  const el=id=>document.getElementById(id), D=ChordDetection;
  const chosen=new Set(), known=new Set();
  let devices=[], permitted=false, stream, ctx, source, analyser, detector, spectrum, waveform;
  let inputRun=0, busy=false, loop, transition, round, deck=[], index=0, successes=new Set(), attempts=new Set();
  let quietSince=null, armed=false, noise=.002, calibratingUntil=0, quietSamples=[];
  const hold=new D.MatchHold();
  const status=text=>{el('listen-status').textContent=text;};
  const rocksmith=device=>/rocksmith|real\s*tone/i.test(device.label);
  function ready() { return !!stream && stream.getAudioTracks().some(t=>t.readyState==='live' && !t.muted) && ctx?.state==='running'; }
  function buttons() {
    el('practice-start').disabled=busy || !ready() || performance.now()<calibratingUntil || !!deck.length || !state.chords.some(c=>chosen.has(c.id) && D.supported(c));
    el('listen-enable').disabled=busy;
    el('listen-disable').disabled=!stream && !busy;
    el('practice-end').disabled=!deck.length;
  }
  globalThis.refreshPracticeDeck=()=>{
    const container=el('practice-deck');
    container.replaceChildren();
    for(const card of state.chords) {
      const supported=D.supported(card);
      if(!known.has(card.id)) {known.add(card.id);if(supported)chosen.add(card.id);}
      const label=document.createElement('label');label.className='check-label';
      const check=document.createElement('input');check.type='checkbox';check.checked=chosen.has(card.id);check.disabled=!supported;
      check.addEventListener('change',()=>{check.checked?chosen.add(card.id):chosen.delete(card.id);buttons();});
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
      if(!visible.length) {const option=document.createElement('option');option.value='';option.textContent=permitted?'No matching input available':'Enable listening to list inputs';select.append(option);}
      if(visible.some(d=>d.deviceId===previous))select.value=previous;
      if(stream) {
        const active=stream.getAudioTracks()[0].getSettings().deviceId;
        if(active && !devices.some(d=>d.deviceId===active)) {releaseInput();status('Input disconnected. Reconnect it, then enable listening and retry the card.');}
      }
    } catch {status('Could not list audio inputs. Check browser permissions and try Refresh inputs.');}
    buttons();
  }
  function pause(message) {
    clearTimeout(transition);
    if(!deck.length) return;
    round=null;hold.reset();
    el('practice-result').className='';el('practice-result').textContent=message;
    el('practice-retry').disabled=false;el('practice-next').disabled=false;
    el('practice-countdown').textContent='Paused';
  }
  globalThis.pausePracticeForPlayback=()=>pause('Paused for playback. When ready, mute the strings and retry this card.');
  function releaseInput() {
    inputRun++;busy=false;clearTimeout(loop);
    const old=stream;stream=null;old?.getTracks().forEach(t=>t.stop());
    source?.disconnect();source=null;analyser=null;
    const oldContext=ctx;ctx=null;oldContext?.close().catch(()=>{});
    el('practice-level').value=0;
    pause('Listening stopped. Enable listening, then retry this card.');buttons();
  }
  async function enable() {
    releaseInput();
    if(!navigator.mediaDevices?.getUserMedia) {status('Open this app over HTTPS (or localhost) to enable listening.');return;}
    const run=inputRun;busy=true;buttons();status('Waiting for audio permission...');
    try {
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
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      ctx=new AudioCtx();await ctx.resume();
      if(run!==inputRun)return;
      source=ctx.createMediaStreamSource(stream);analyser=ctx.createAnalyser();
      analyser.fftSize=8192;analyser.smoothingTimeConstant=0;
      source.connect(analyser); // Deliberately no speaker connection: avoid monitoring feedback.
      spectrum=new Float32Array(analyser.frequencyBinCount);waveform=new Float32Array(analyser.fftSize);
      detector=D.createDetector(ctx.sampleRate,analyser.fftSize);
      const track=stream.getAudioTracks()[0];
      track.addEventListener('ended',()=>{if(run===inputRun){releaseInput();status('Input disconnected. Reconnect it and enable listening again.');void refreshDevices();}});
      track.addEventListener('mute',()=>{if(run===inputRun){pause('Input became unavailable. Check the device, then retry.');buttons();}});
      track.addEventListener('unmute',buttons);
      ctx.addEventListener('statechange',()=>{if(run===inputRun){if(!ready())pause('Audio paused. Enable listening again, then retry.');buttons();}});
      noise=.002;quietSamples=[];calibratingUntil=performance.now()+1500;
      status('Listening: '+track.label+'. Keep strings quiet briefly to measure room noise.');
      busy=false;buttons();tick(run);
    } catch(error) {
      if(run!==inputRun)return;
      releaseInput();
      const messages={NotAllowedError:'Audio permission was denied. Allow microphone access in your browser, then enable listening again.',NotFoundError:'That input is unavailable. Plug it in and refresh the input list.',NotReadableError:'Cannot open that input. Close other apps using it and try again.',OverconstrainedError:'That input is no longer available. Refresh inputs and choose it again.'};
      status(messages[error.name]||error.message||'Could not start listening.');
    }
  }
  function beginCard() {
    clearTimeout(transition);
    if(!ready()) {status('Enable listening before retrying.');return;}
    if(performance.now()<calibratingUntil) {status('Wait for the brief quiet input check, then retry.');return;}
    stopPlayback('Practice mode: playback stopped.');
    const seconds=Math.round(Math.max(2,Math.min(60,Number(el('practice-seconds').value)||10)));el('practice-seconds').value=seconds;
    const card=deck[index];
    round={deadline:performance.now()+seconds*1000,seconds,heard:false};quietSince=null;armed=false;hold.reset();
    el('practice-stage').hidden=false;
    el('practice-progress').textContent='Card '+(index+1)+' of '+deck.length;
    el('practice-chord').textContent=card.data.symbol;
    el('practice-diagram').innerHTML=buildSvg(card.data,card.data.voicings[card.voicing]);
    el('practice-diagram').hidden=!el('practice-hint').checked;
    el('practice-time').max=seconds;el('practice-time').value=seconds;
    el('practice-countdown').textContent=seconds.toFixed(1)+' seconds left';
    el('practice-result').className='';el('practice-result').textContent='Mute the strings briefly, then strum.';
    el('practice-retry').disabled=true;el('practice-next').disabled=true;
  }
  function finishCard(success) {
    if(!round)return;
    attempts.add(index);if(success)successes.add(index);
    const heard=round.heard;round=null;
    el('practice-result').className=success?'practice-success':'';
    el('practice-result').textContent=success?'\u2713  Chord matched!':heard?'Not quite this time. Try again whenever you like.':'I could not hear a clear attempt. Check the input level and try again.';
    el('practice-countdown').textContent=success?'Nice work.':'Time for another try?';
    el('practice-retry').disabled=false;el('practice-next').disabled=false;
    if(success)transition=setTimeout(nextCard,1600);
  }
  function tick(run) {
    if(run!==inputRun || !analyser)return;
    try {
      const now=performance.now();
      analyser.getFloatTimeDomainData(waveform);analyser.getFloatFrequencyData(spectrum);
      const rms=Math.sqrt(waveform.reduce((sum,v)=>sum+v*v,0)/waveform.length);
      const clipped=waveform.some(v=>Math.abs(v)>.98);
      el('practice-level').value=Math.min(1,rms*8);
      if(now<calibratingUntil) {
        quietSamples.push(rms);el('practice-heard').textContent='Measuring background level. Keep the strings quiet...';
      } else {
        if(quietSamples.length) {
          quietSamples.sort((a,b)=>a-b);noise=Math.max(.0004,Math.min(.015,quietSamples[Math.floor(quietSamples.length*.2)]));quietSamples=[];
          status('Listening. Strum a chord to check the input. Stop listening releases the microphone.');
          buttons();
        }
        const audible=rms>Math.max(.002,noise*3);
        const estimate=audible && !clipped?detector(spectrum):null;
        el('practice-heard').textContent=clipped?'Input is clipping. Lower the input gain.':estimate?.fit>=.72?'Heard pitch classes: '+estimate.notes.join(' / '):audible?'Listening, but the chord is not clear yet.':'Ready. Strum your guitar.';
        if(round && ready()) {
          const remaining=Math.max(0,(round.deadline-now)/1000);
          el('practice-time').value=remaining;el('practice-countdown').textContent=remaining.toFixed(1)+' seconds left';
          if(!audible) {quietSince??=now;if(now-quietSince>=250)armed=true;} else quietSince=null;
          if(armed && audible) {round.heard=true;el('practice-result').textContent='Listening...';}
          if(now>=round.deadline)finishCard(false);
          else if(hold.update(armed && !!estimate && D.matches(estimate,D.pitches(deck[index])),now))finishCard(true);
        }
      }
    } catch {releaseInput();status('Listening was interrupted. Enable listening to try again.');return;}
    loop=setTimeout(()=>tick(run),80);
  }
  function endSession() {
    clearTimeout(transition);
    round=null;deck=[];hold.reset();buttons();
    el('practice-retry').disabled=true;el('practice-next').disabled=true;
    el('practice-countdown').textContent='';el('practice-time').value=0;
    el('practice-result').className='';el('practice-result').textContent=successes.size+' cards matched across '+attempts.size+' cards attempted. Keep practicing at your own pace.';
  }
  function nextCard() {
    clearTimeout(transition);
    if(!deck.length)return;
    if(index+1===deck.length){endSession();return;}
    if(!ready()){pause('Enable listening before the next card.');return;}
    index++;beginCard();
  }
  el('listen-enable').addEventListener('click',enable);
  el('listen-disable').addEventListener('click',()=>{releaseInput();status('Listening off. Audio input released.');});
  el('listen-refresh').addEventListener('click',refreshDevices);
  el('practice-source').addEventListener('change',()=>{releaseInput();void refreshDevices();status('Choose an input, then enable listening.');});
  el('practice-device').addEventListener('change',()=>{releaseInput();status('Input changed. Enable listening to use it.');});
  el('practice-hint').addEventListener('change',()=>{el('practice-diagram').hidden=!el('practice-hint').checked;});
  el('practice-start').addEventListener('click',()=>{
    if(!ready()||deck.length)return;
    if(performance.now()<calibratingUntil){status('Keep quiet for the brief input check, then start the deck.');return;}
    deck=state.chords.filter(c=>chosen.has(c.id)&&D.supported(c)).map(c=>({id:c.id,voicing:c.voicing,data:structuredClone(c.data)}));
    if(!deck.length)return;
    if(el('practice-shuffle').checked)for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    index=0;successes=new Set();attempts=new Set();buttons();beginCard();
  });
  el('practice-retry').addEventListener('click',()=>{if(deck.length)beginCard();});
  el('practice-next').addEventListener('click',nextCard);
  el('practice-end').addEventListener('click',endSession);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('Paused while this tab was away. Retry when you are ready.');else void refreshDevices();});
  window.addEventListener('pagehide',releaseInput);
  navigator.mediaDevices?.addEventListener('devicechange',refreshDevices);
  refreshPracticeDeck();void refreshDevices();
})();

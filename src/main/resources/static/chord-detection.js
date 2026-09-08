/* Conservative, target-independent polyphonic estimate for clean guitar audio.
   Fit non-negative harmonic templates to the Blackman-windowed Web Audio FFT.
   Chord matching requires every pitch class; a root alone cannot pass a card. */
(() => {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const open = [40,45,50,55,59,64];
  const supported = card => /^[A-G][#b]?(?:maj|min|m|5)?$/.test(card.data.symbol);
  const pitches = card => [...new Set(card.data.voicings[card.voicing].frets.flatMap((f,s) => f < 0 ? [] : [(open[s]+f)%12]))];
  const sinc = x => Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI*x)/(Math.PI*x);
  const windowPeak = x => Math.abs(.42*sinc(x)+.25*(sinc(x-1)+sinc(x+1))+.04*(sinc(x-2)+sinc(x+2)));
  function createDetector(sampleRate, fftSize) {
    const size = Math.min(fftSize/2, Math.ceil(3500*fftSize/sampleRate));
    const templates = [];
    for(let midi=40; midi<=88; midi++) for(const rolloff of [.5,1.3,2.5]) {
      const bins = new Map(), frequency = 440*2**((midi-69)/12);
      for(let h=1; h<=6; h++) {
        const center = frequency*h*fftSize/sampleRate;
        for(let b=Math.max(1,Math.ceil(center-3)); b<=Math.min(size-1,Math.floor(center+3)); b++)
          bins.set(b,(bins.get(b)||0)+windowPeak(b-center)/h**rolloff);
      }
      const norm = Math.sqrt([...bins.values()].reduce((a,b)=>a+b*b,0));
      templates.push({midi, bins:[...bins].map(([b,v])=>[b,v/norm])});
    }
    return db => {
      const residual = Float64Array.from({length:size},(_,i)=>i*sampleRate/fftSize < 65 || !Number.isFinite(db[i]) ? 0 : 10**(db[i]/20));
      const energy = residual.reduce((a,b)=>a+b*b,0);
      const weights = new Float64Array(templates.length);
      for(let pass=0; pass<24; pass++) for(let n=0;n<templates.length;n++) {
        const bins=templates[n].bins;
        const delta=Math.max(-weights[n],bins.reduce((a,[b,v])=>a+residual[b]*v,0));
        weights[n]+=delta;
        for(const [b,v] of bins) residual[b]-=delta*v;
      }
      const chroma = new Array(12).fill(0);
      const noteWeights=new Array(89).fill(0);
      weights.forEach((w,n)=>{noteWeights[templates[n].midi]+=w;});
      const peak=Math.max(...noteWeights);
      for(let midi=40;midi<=88;midi++) {
        // A bright string's upper partials can otherwise masquerade as extra
        // notes (e.g. the third harmonic of E looks like B). Keep evidence from
        // the lowest independent occurrence of each pitch class.
        let harmonic=false;
        for(let lower=40;lower<midi;lower++) if(noteWeights[lower]>peak*.02) {
          const ratio=2**((midi-lower)/12),h=Math.round(ratio);
          if(h>=3 && h<=8 && Math.abs(12*Math.log2(ratio/h))<.4)harmonic=true;
        }
        chroma[midi%12]+=noteWeights[midi]*(harmonic?.08:1);
      }
      const strongest=Math.max(...chroma);
      const total=chroma.reduce((a,b)=>a+b,0);
      const fit=energy>1e-12 ? Math.max(0,1-residual.reduce((a,b)=>a+b*b,0)/energy) : 0;
      return {chroma,total,strongest,fit,notes:names.filter((_,i)=>chroma[i]>strongest*.18 && strongest>1e-6)};
    };
  }
  function matches(estimate, expected) {
    if(!expected.length || estimate.fit < .72 || estimate.strongest < 1e-6) return false;
    const inside=expected.reduce((sum,pc)=>sum+estimate.chroma[pc],0);
    return inside/estimate.total >= .88 && expected.every(pc=>estimate.chroma[pc]>=estimate.strongest*.08);
  }
  function feedback(estimate, expected) {
    if(!estimate || estimate.fit<.72 || estimate.strongest<1e-6)
      return 'I hear audio, but the notes are not clear yet. Try a clean strum.';
    const missing=expected.filter(pc=>estimate.chroma[pc]<estimate.strongest*.08);
    if(missing.length)return 'Not hearing '+missing.map(pc=>names[pc]).join(' / ')+' clearly yet. Try another strum.';
    return 'Hearing other tones too. Try again with a clean sound.';
  }
  // An uninterrupted hold is required, with a gap cap so a stalled tab cannot pass.
  class MatchHold {
    reset() { this.since=null; this.last=null; }
    constructor() { this.reset(); }
    update(match, now) {
      if(!match) {this.reset();return false;}
      if(this.last===null || now-this.last>220) this.since=now;
      this.last=now;
      return now-this.since>=450;
    }
  }
  globalThis.ChordDetection={createDetector,matches,feedback,pitches,supported,MatchHold,noteName:pc=>names[pc]};
})();


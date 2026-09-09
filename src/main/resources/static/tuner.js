// YIN-style periodicity estimate for one clean, open guitar string.
// The selected target never biases the measured frequency.
(() => {
  const midi=[40,45,50,55,59,64],names=['Low E (6)','A (5)','D (4)','G (3)','B (2)','High E (1)'];
  function pitch(samples,sampleRate) {
    const step=Math.max(1,Math.floor(sampleRate/12000)),rate=sampleRate/step;
    const data=new Float64Array(Math.floor(samples.length/step));
    let energy=0,mean=0;
    for(let i=0;i<data.length;i++){for(let j=0;j<step;j++)data[i]+=samples[i*step+j]/step;mean+=data[i];}
    mean/=data.length;
    for(let i=0;i<data.length;i++){data[i]-=mean;energy+=data[i]*data[i];}
    if(energy/data.length<1e-7)return null;
    const max=Math.min(Math.floor(rate/60),Math.floor(data.length/2)),min=Math.floor(rate/420),length=data.length-max;
    const difference=new Float64Array(max+1);let sum=0;
    for(let lag=1;lag<=max;lag++) {
      let value=0;for(let i=0;i<length;i++){const delta=data[i]-data[i+lag];value+=delta*delta;}
      sum+=value;difference[lag]=sum?value*lag/sum:1;
    }
    for(let lag=min;lag<max-1;lag++)if(difference[lag]<.15) {
      while(lag<max-1 && difference[lag+1]<difference[lag])lag++;
      // A decaying low string can have a stronger second harmonic. Prefer a
      // longer period only when it explains substantially more of the signal.
      const first=lag;
      const trough=i=>{
        const a=difference[i-1],b=difference[i],c=difference[i+1],curve=a-2*b+c;
        return curve>0?Math.max(0,b-(a-c)**2/(8*curve)):b;
      };
      for(const multiple of [2,3]) {
        let candidate=Math.round(first*multiple);
        if(candidate>=max-2)continue;
        for(let nearby=candidate-2;nearby<=Math.min(max-1,first*multiple+2);nearby++)
          if(difference[nearby]<difference[candidate])candidate=nearby;
        if(trough(candidate)<trough(lag)*.4 && trough(lag)-trough(candidate)>.025)lag=candidate;
      }
      const a=difference[lag-1],b=difference[lag],c=difference[lag+1],denominator=a-2*b+c;
      const offset=denominator?Math.max(-.5,Math.min(.5,.5*(a-c)/denominator)):0;
      return {frequency:rate/(lag+offset),confidence:1-b};
    }
    return null;
  }
  function reading(frequency,string) {
    const target=440*2**((midi[string]-69)/12),cents=1200*Math.log2(frequency/target);
    const nearest=Math.round(69+12*Math.log2(frequency/440));
    const name=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((nearest%12)+12)%12]+(Math.floor(nearest/12)-1);
    return {target,cents,name,direction:Math.abs(cents)>150?'wrong-string':Math.abs(cents)<=5?'in-tune':cents<0?'up':'down'};
  }
  class TuningHold {
    constructor(){this.reset();}
    reset(){this.frames=[];this.last=null;this.progress=0;}
    update(match,now){
      if(this.last===null || now-this.last>350 || now<=this.last){this.reset();this.last=now;return false;}
      this.frames.push({start:now-Math.min(160,now-this.last),end:now,match});this.last=now;
      const cutoff=now-1500;
      this.frames=this.frames.filter(f=>f.end>cutoff);
      while(this.frames.length && !this.frames[0].match)this.frames.shift();
      let matched=0,total=0;
      for(const f of this.frames){const duration=f.end-Math.max(cutoff,f.start);total+=duration;if(f.match)matched+=duration;}
      const ratio=total?matched/total:0;
      const confirmed=match && matched>=1000 && ratio>=.8;
      this.progress=confirmed?1:Math.min(.99,matched/1000,ratio/.8);
      return confirmed;
    }
  }
  globalThis.GuitarTuner={pitch,reading,names,TuningHold};
})();

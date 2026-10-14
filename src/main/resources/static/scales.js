const scaleTypes={
  'minor-pentatonic':{name:'Minor pentatonic',intervals:[0,3,5,7,10],degrees:[0,2,3,4,6],formula:'1, ♭3, 4, 5, ♭7'},
  'major-pentatonic':{name:'Major pentatonic',intervals:[0,2,4,7,9],degrees:[0,1,2,4,5],formula:'1, 2, 3, 5, 6'},
  major:{name:'Major',intervals:[0,2,4,5,7,9,11],degrees:[0,1,2,3,4,5,6],formula:'1, 2, 3, 4, 5, 6, 7'},
  minor:{name:'Natural minor',intervals:[0,2,3,5,7,8,10],degrees:[0,1,2,3,4,5,6],formula:'1, 2, ♭3, 4, 5, ♭6, ♭7'},
  'harmonic-minor':{name:'Harmonic minor',intervals:[0,2,3,5,7,8,11],degrees:[0,1,2,3,4,5,6],formula:'1, 2, ♭3, 4, 5, ♭6, 7'},
  'minor-blues':{name:'Minor blues',intervals:[0,3,5,6,7,10],degrees:[0,2,3,4,4,6],formula:'1, ♭3, 4, ♭5, 5, ♭7'},
};
const scaleRoots=['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];
const scaleNaturalPitches={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function scalePitch(note){return (scaleNaturalPitches[note[0]]+(note[1]==='#'?1:note[1]==='b'?-1:0)+12)%12;}
function createScale(root,type){
  const definition=scaleTypes[type];
  if(!scaleRoots.includes(root)||!definition)throw new Error('Choose a supported root and scale.');
  const rootPitch=scalePitch(root),letters='CDEFGAB',rootIndex=letters.indexOf(root[0]);
  const notes=definition.intervals.map((interval,index)=>{
    const letter=letters[(rootIndex+definition.degrees[index])%7],pitch=(rootPitch+interval)%12;
    let accidental=(pitch-scaleNaturalPitches[letter]+12)%12;
    if(accidental>6)accidental-=12;
    return letter+(accidental>0?'#'.repeat(accidental):'b'.repeat(-accidental));
  });
  return {name:root+' '+definition.name.toLowerCase(),root:rootPitch,notes,pitches:definition.intervals.map(i=>(rootPitch+i)%12),formula:definition.formula};
}
function buildScaleSvg(scale,start=5,end=10){
  const step=64,left=70,top=65,row=44,width=left+(end-start+1)*step+35,height=340;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(scale.name)} fretboard, frets ${start} to ${end}"><title>${escapeXml(scale.name)}: ${escapeXml(scale.notes.join(', '))}. Orange notes are roots.</title><rect width="${width}" height="${height}" fill="#f8f5ee"/>`;
  for(let fret=start;fret<=end;fret++){
    const x=left+(fret-start)*step;
    svg+=`<text x="${x}" y="32" text-anchor="middle" font-family="Arial" font-size="14">${fret}</text>`;
    if(fret>0)svg+=`<line x1="${x+step/2}" y1="${top}" x2="${x+step/2}" y2="${top+5*row}" stroke="#b7aea1" stroke-width="2"/>`;
  }
  for(let string=0;string<6;string++){
    const index=5-string,y=top+string*row;
    svg+=`<text x="24" y="${y+5}" font-family="Arial" font-size="15">${tuning[index]}${string+1}</text><line x1="${left-step/2}" y1="${y}" x2="${width-25}" y2="${y}" stroke="${stringColors[index]}" stroke-width="${1+index*.4}"/>`;
    for(let fret=start;fret<=end;fret++){
      const pitch=(midiOpen[index]+fret)%12,noteIndex=scale.pitches.indexOf(pitch);
      if(noteIndex<0)continue;
      const x=left+(fret-start)*step,root=pitch===scale.root;
      svg+=`<circle cx="${x}" cy="${y}" r="18" fill="${root?'#ed5b2b':'#17120e'}"/><text x="${x}" y="${y+5}" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="white"><title>String ${string+1}, fret ${fret}${root?', root':''}</title>${escapeXml(scale.notes[noteIndex])}</text>`;
    }
  }
  return svg+'</svg>';
}
function selectedScale(){return createScale($('#scale-root').value,$('#scale-type').value);}
function selectedScaleSvg(){const [start,end]=$('#scale-position').value.split(':').map(Number);return buildScaleSvg(selectedScale(),start,end??start+5);}
function renderScale(){const scale=selectedScale();$('#scale-notes').textContent=`${scale.name}: ${scale.notes.join(' · ')} — ${scale.formula}`;const diagram=$('#scale-diagram');diagram.innerHTML=selectedScaleSvg();diagram.className='scale-diagram'+($('#scale-position').value.includes(':')?' scale-full-neck':'');}
$('#scale-root').innerHTML=scaleRoots.map(root=>`<option${root==='A'?' selected':''}>${root}</option>`).join('');
$('#scale-type').innerHTML=Object.entries(scaleTypes).map(([key,type])=>`<option value="${key}">${type.name}</option>`).join('');
for(const selector of ['#scale-root','#scale-type','#scale-position'])$(selector).addEventListener('change',renderScale);
$('#scale-download').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([selectedScaleSvg()],{type:'image/svg+xml'})),link=document.createElement('a');
  link.href=url;link.download=selectedScale().name.replace(/\s+/g,'-')+'-scale-map.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),500);
});
renderScale();

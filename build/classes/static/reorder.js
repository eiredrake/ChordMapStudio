// Pointer events support mouse, pen and touch without interfering with card buttons.
(() => {
  const board=document.getElementById('chord-board');
  let drag=null;
  function clearDrag() {
    if(!drag)return;
    const old=drag;drag=null;
    cancelAnimationFrame(old.frame);
    old.card.classList.remove('is-dragging');
    old.target?.classList.remove('drop-target');
    if(old.handle.hasPointerCapture(old.pointer))old.handle.releasePointerCapture(old.pointer);
  }
  globalThis.cancelChordDrag=clearDrag;
  function move(id,to) {
    const from=state.chords.findIndex(c=>c.id===id);
    if(from<0 || to<0 || to>=state.chords.length || from===to)return;
    const [card]=state.chords.splice(from,1);state.chords.splice(to,0,card);
    renderBoard();
    document.querySelector('[data-reorder="'+id+'"]').focus({preventScroll:true});
    document.getElementById('reorder-status').textContent=card.data.symbol+' moved to position '+(to+1)+' of '+state.chords.length+'.';
  }
  function targetAt(x,y) {
    const card=document.elementFromPoint(x,y)?.closest('[data-card]');
    const target=card && board.contains(card) && card!==drag.card?card:null;
    if(target!==drag.target){drag.target?.classList.remove('drop-target');drag.target=target;target?.classList.add('drop-target');}
  }
  function scrollFrame() {
    if(!drag?.started)return;
    const edge=65,y=drag.y;
    const step=y<edge?-12:y>window.innerHeight-edge?12:0;
    if(step) {window.scrollBy(0,step);targetAt(drag.x,drag.y);}
    drag.frame=requestAnimationFrame(scrollFrame);
  }
  board.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-reorder]');
    if(!handle || e.button!==0 || !e.isPrimary || state.chords.length<2)return;
    clearDrag();
    drag={handle,card:handle.closest('[data-card]'),id:Number(handle.dataset.reorder),pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,started:false,target:null};
    handle.setPointerCapture(e.pointerId);
  });
  board.addEventListener('pointermove',e=>{
    if(!drag || e.pointerId!==drag.pointer)return;
    drag.x=e.clientX;drag.y=e.clientY;
    if(!drag.started && Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6) {
      drag.started=true;drag.card.classList.add('is-dragging');scrollFrame();
    }
    if(drag.started){e.preventDefault();targetAt(e.clientX,e.clientY);}
  });
  board.addEventListener('pointerup',e=>{
    if(!drag || e.pointerId!==drag.pointer)return;
    if(drag.started)targetAt(e.clientX,e.clientY);
    const id=drag.id,targetId=drag.started && drag.target?Number(drag.target.dataset.card):null;
    clearDrag();
    if(targetId!==null)move(id,state.chords.findIndex(c=>c.id===targetId));
  });
  board.addEventListener('pointercancel',clearDrag);
  board.addEventListener('lostpointercapture',clearDrag);
  board.addEventListener('keydown',e=>{
    if(e.key==='Escape'){clearDrag();return;}
    const handle=e.target.closest('[data-reorder]');if(!handle)return;
    const id=Number(handle.dataset.reorder),from=state.chords.findIndex(c=>c.id===id);
    const positions={ArrowLeft:from-1,ArrowUp:from-1,ArrowRight:from+1,ArrowDown:from+1,Home:0,End:state.chords.length-1};
    if(Object.hasOwn(positions,e.key)){e.preventDefault();clearDrag();move(id,positions[e.key]);}
  });
  window.addEventListener('blur',clearDrag);
})();

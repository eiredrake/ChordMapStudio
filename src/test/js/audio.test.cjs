const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../../main/resources/static');
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { value: '', disabled: false, selectedOptions: [{textContent: 'Guitar'}], addEventListener(type, fn) { this[type] = fn; } });
  return elements.get(id);
};
element('instrument').value = 'acoustic_guitar_steel';
element('tempo').value = '120';
const instruments = [];
let contexts = 0;
const context = vm.createContext({
  window: { AudioContext: class {
    constructor() { contexts++; this.state = 'suspended'; this.currentTime = 1; }
    async resume() { this.state = 'running'; }
  } },
  document: { getElementById: element, querySelector: s => element(s.slice(1)), querySelectorAll: () => [], addEventListener() {} },
  fetch: () => new Promise(() => {}), console,
  setTimeout: () => 1, clearTimeout() {},
  loadSampler: async () => ({ Soundfont(ctx, options) {
    const instrument = { options, notes: [], ready: Promise.resolve(),
      start(note) { this.notes.push(note); return () => { note.stopped = true; }; },
      stop() { this.notes.forEach(note => note.stopped = true); }, dispose() { this.disposed = true; }
    };
    instruments.push(instrument); return instrument;
  } })
});
vm.runInContext(fs.readFileSync(path.join(root, 'playback.js'), 'utf8').replace("import('/vendor/smplr.js')", 'loadSampler()'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
(async () => {
  const card = { id: 1, voicing: 1, data: { symbol: 'A', voicings: [{frets: [0,0,0,0,0,0]}, {frets: [-1,0,2,2,2,0]}] } };
  await context.playCard(card);
  assert.equal(instruments[0].options.instrumentUrl, '/soundfonts/acoustic_guitar_steel-mp3.js');
  assert.deepEqual(instruments[0].notes.map(n => n.note), [45,52,57,61,64]);
  assert.equal(element('stop-playback').disabled, false);
  context.card = card;
  vm.runInContext('state.chords = [card, {...card, id: 2}]', context);
  await element('play-composition').click();
  assert.equal(instruments[0].notes.length, 15, 'Play All schedules both cards');
  assert.ok(instruments[0].notes.slice(0,5).every(n => n.stopped), 'Replay stops previous notes');
  assert.ok(Math.abs(instruments[0].notes[10].time - instruments[0].notes[5].time - 2) < 1e-9, 'Four beats per chord at 120 BPM');
  element('stop-playback').click();
  assert.ok(instruments[0].notes.every(n => n.stopped));
  assert.equal(element('stop-playback').disabled, true);
  element('instrument').value = 'electric_guitar_clean';
  element('instrument').change();
  await context.playCard(card);
  assert.equal(instruments[1].options.instrumentUrl, '/soundfonts/electric_guitar_clean-mp3.js');
  assert.ok(instruments[0].disposed);
  assert.equal(contexts, 1);
  await context.playCards([]);
  assert.match(element('playback-status').textContent, /Add a chord/);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /playback\.js\?v=practice-1/);
  assert.match(html, /app\.js\?v=string-notes-1/);
  const instrumentOptions=html.match(/<select id="instrument">([\s\S]*?)<\/select>/)[1];
  for (const [,name] of instrumentOptions.matchAll(/option value="([^"]+)"/g)) {
    const sample = fs.readFileSync(path.join(root, 'soundfonts', name + '-mp3.js'), 'utf8');
    assert.ok(sample.includes('MIDI.Soundfont.' + name));
  }
  console.log('Sampled playback, Play All wiring, tempo, Stop, instrument switching, and packaged sample checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });

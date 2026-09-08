const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let contexts = 0;
const sources = [];
class AudioContext {
  constructor() { contexts++; this.state = 'suspended'; this.sampleRate = 44100; this.currentTime = 1; }
  async resume() { this.state = 'running'; }
  createBuffer(channels, length) { return { copyToChannel(samples) { this.samples = samples; } }; }
  createBufferSource() {
    const source = { connect() {}, disconnect() {}, start(time) { this.started = time; }, stop() { this.stopped = true; } };
    sources.push(source); return source;
  }
  createGain() { return { connect() {}, disconnect() {}, gain: { cancelScheduledValues() {}, setTargetAtTime() {} } }; }
}
const context = vm.createContext({
  window: { AudioContext },
  document: { querySelector: () => ({ addEventListener() {} }), addEventListener() {} },
  fetch: () => new Promise(() => {}),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/static/app.js'), 'utf8'), context);
const near = (a, b) => assert.ok(Math.abs(a - b) < .01, `${a} should equal ${b}`);
near(context.stringFrequency(0, 0), 82.4069);
near(context.stringFrequency(1, 0), 110);
near(context.stringFrequency(0, 5), 110);
near(context.stringFrequency(5, 0), 329.6276);

// Measure the actual generated waveforms, not just the frequency helper.
for (const rate of [44100, 48000]) {
  for (const [string, expected] of [[0, 82.4069], [1, 110]]) {
    const samples = context.createPluckSamples(rate, context.stringFrequency(string, 0), string);
    let bestFrequency = 0, bestPower = 0;
    for (let frequency = 75; frequency <= 118; frequency += .25) {
      let real = 0, imag = 0;
      for (let i = Math.floor(rate * .03); i < rate * .65; i += 4) {
        const angle = 2 * Math.PI * frequency * i / rate;
        real += samples[i] * Math.cos(angle); imag += samples[i] * Math.sin(angle);
      }
      const power = real * real + imag * imag;
      if (power > bestPower) { bestPower = power; bestFrequency = frequency; }
    }
    assert.ok(Math.abs(bestFrequency - expected) < .4, `Measured pitch ${bestFrequency}, expected ${expected}`);
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= .141));
    assert.ok(samples[0] === 0 && samples.at(-1) === 0);
    const energy = start => samples.slice(rate * start, rate * (start + .1)).reduce((sum, n) => sum + n*n, 0);
    assert.ok(energy(.1) > energy(2) * 10, 'Pluck should decay naturally');
  }
}
(async () => {
  const card = { voicing: 1, data: { voicings: [{ frets: [0, 0, 0, 0, 0, 0] }, { frets: [-1, 0, 2, 2, 2, 0] }] } };
  await context.playCard(card);
  assert.equal(sources.length, 5, 'Selected voicing skips muted strings');
  assert.ok(sources.every(source => source.started >= 1.045));
  const first = [...sources];
  await context.playCard(card);
  assert.equal(contexts, 1, 'Reuse audio context');
  assert.ok(first.every(source => source.stopped), 'Previous chord stops on replay');
  assert.equal(sources[5].buffer, first[0].buffer, 'Reuse synthesized notes');
  console.log('Audio pitch, waveform, and playback checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });

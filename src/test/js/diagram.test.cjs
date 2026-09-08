const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({
  document: { querySelector: () => ({ addEventListener() {} }), addEventListener() {} },
  fetch: () => new Promise(() => {}),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/static/app.js'), 'utf8'), context);

function verify(frets, fingers, expectedLabels) {
  const svg = context.buildSvg({ symbol: 'Bsus4' }, { frets, fingers });
  const dots = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="16"/g)];
  assert.equal(dots.length, frets.filter(f => f > 0).length, 'Every fretted note must be visible');
  for (let string = 0; string < frets.length; string++) {
    if (frets[string] <= 0) continue;
    const dot = dots.find(dot => Number(dot[1]) === 66 + string * 48);
    assert.ok(dot, `Missing note on string ${string}`);
    assert.equal(Number(dot[2]), 65 + (frets[string] - expectedLabels[0] + 0.5) * 49);
  }
  for (const label of expectedLabels) {
    assert.match(svg, new RegExp(`<text x="31"[^>]*>${label}</text>`));
  }
}

// The reported fourth Bsus4 voicing used to omit the B-string note at fret 5.
verify([-1, 2, 4, 4, 5, 2], [0, 1, 2, 3, 4, 1], [2, 3, 4, 5]);
verify([-1, 2, 4, 4, 0, 0], [0, 1, 2, 3, 0, 0], [1, 2, 3, 4]);
verify([7, 7, 4, 4, 5, 7], [3, 4, 1, 1, 2, 4], [4, 5, 6, 7]);
// Cover every four-fret window searched by the chord engine.
for (let min = 1; min <= 9; min++) {
  verify([-1, min, min + 1, min + 2, min + 3, -1], [0, 1, 2, 3, 4, 0],
    Array.from({ length: 4 }, (_, i) => (min + 3 > 4 ? min : 1) + i));
}
console.log('Diagram regression checks passed.');

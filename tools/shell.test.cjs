const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('continuous resize suppresses layout transitions until two quiet frames, including interrupted settling', () => {
  let factory;
  let serial = 0;
  const frames = new Map();
  const classes = new Set();
  const context = {
    document: {
      documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
      addEventListener: (_, listener) => listener(),
    },
    Alpine: { data: (_, value) => { factory = value; } },
    requestAnimationFrame: callback => { frames.set(++serial, callback); return serial; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/app_shell.js'), 'utf8'), context);
  const state = factory();
  const step = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback());
  };
  state.onViewportResize();
  state.onViewportResize();
  assert.equal(classes.has('is-resizing'), true);
  assert.equal(frames.size, 1);
  step();
  assert.equal(classes.has('is-resizing'), true);
  state.onViewportResize();
  assert.equal(frames.size, 1);
  step();
  assert.equal(classes.has('is-resizing'), true);
  step();
  assert.equal(classes.has('is-resizing'), false);
  assert.equal(frames.size, 0);
  assert.equal(state.resizeFrame, 0);
});

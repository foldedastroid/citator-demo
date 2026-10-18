const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(reduced = false) {
  let factory;
  const animations = [];
  let inputFocus = 0;
  let buttonFocus = 0;
  let currentWidth = 32;
  const style = { getPropertyValue: name => name === '--find-duration' ? '200ms' : 'ease-out' };
  const card = {
    getBoundingClientRect: () => ({ width: currentWidth }),
    animate(keyframes, options) {
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const animation = { keyframes, options, finished, resolve, cancelled: false, cancel() { this.cancelled = true; reject(); } };
      animations.push(animation);
      return animation;
    },
  };
  const context = {
    document: { addEventListener: (_, listener) => listener(), querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 148 }) }) },
    Alpine: { data: (_, value) => { factory = value; } },
    window: { innerWidth: 375, innerHeight: 812, matchMedia: () => ({ matches: reduced }) },
    getComputedStyle: () => style,
    stickyBottom: () => 148,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/opinion_tabs.js'), 'utf8'), context);
  const state = factory();
  state.$nextTick = callback => callback();
  state.$refs = {
    findCard: card,
    findAnchor: { offsetParent: {}, getBoundingClientRect: () => ({ left: 16, bottom: 232 }) },
    findButton: { offsetParent: {}, getBoundingClientRect: () => ({ left: 280, right: 308, top: 200, height: 28, width: 28 }), focus: () => buttonFocus++ },
    findInput: { focus: () => inputFocus++, select() {} },
  };
  return { state, card, animations, setWidth: width => { currentWidth = width; }, focus: () => ({ input: inputFocus, button: buttonFocus }) };
}

test('Find expands right from one control, focuses after completion, and reverses from its actual width', async () => {
  const { state, animations, setWidth, focus } = fixture();
  state.openFind();
  assert.equal(state.findBox.width, 320);
  assert.equal(state.findBox.height, 572);
  assert.equal(animations[0].keyframes[0].width, '32px');
  assert.equal(animations[0].keyframes[1].width, '320px');
  assert.equal(focus().input, 0);
  setWidth(147.2);
  state.closeFind();
  assert.equal(animations[0].cancelled, true);
  assert.equal(animations[1].keyframes[0].width, '147.2px');
  assert.equal(animations[1].keyframes[1].width, '32px');
  assert.ok(Math.abs(animations[1].options.duration - 80) < 0.001);
  assert.equal(focus().button, 1);
  state.openFind();
  assert.equal(animations[1].cancelled, true);
  animations[2].resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(focus().input, 1);
  assert.equal(state.findVisible, true);
  assert.equal(state.findOpen, true);
});

test('reduced-motion Find settles immediately and Escape retains the query', () => {
  const { state, animations, focus } = fixture(true);
  state.find.query = 'opinion';
  state.openFind();
  assert.equal(animations.length, 0);
  assert.equal(focus().input, 1);
  const keys = [];
  state.findKeydown({ key: 'Escape', preventDefault: () => keys.push('prevent'), stopPropagation: () => keys.push('stop') });
  assert.equal(state.findOpen, false);
  assert.equal(state.findVisible, false);
  assert.equal(state.find.query, 'opinion');
  assert.deepEqual(keys, ['prevent', 'stop']);
  assert.equal(focus().button, 1);
});

test('Find clamps to the right edge without moving its anchor', () => {
  const { state, animations } = fixture(true);
  state.$refs.findAnchor.getBoundingClientRect = () => ({ left: 100, bottom: 232 });
  state.openFind();
  assert.equal(state.findBox.width, 267);
  assert.equal(state.findStyle['--find-width'], '267px');
  assert.equal(animations.length, 0);
});

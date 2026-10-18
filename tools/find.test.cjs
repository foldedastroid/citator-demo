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
  let bodyReads = 0;
  const history = [];
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
    document: { addEventListener: (_, listener) => listener(), querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 148 }) }), querySelectorAll: () => [], getElementById: () => null, documentElement: { scrollHeight: 1000 } },
    Alpine: { data: (_, value) => { factory = value; } },
    window: { innerWidth: 375, innerHeight: 812, scrollY: 0, scrollTo() {}, matchMedia: () => ({ matches: reduced }), getSelection: () => ({ removeAllRanges() {} }) },
    history: { pushState: (_, __, value) => history.push(value), replaceState: (_, __, value) => history.push(value) },
    cancelAnimationFrame() {},
    requestAnimationFrame: callback => { callback(); return 1; },
    getComputedStyle: () => style,
    stickyBottom: () => 148,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/opinion_tabs.js'), 'utf8'), context);
  const state = factory();
  state.$nextTick = callback => callback();
  state.$refs = {
    findCard: card,
    findMatches: { replaceChildren() {} },
    findAnchor: { offsetParent: {}, getBoundingClientRect: () => ({ left: 16, bottom: 232 }) },
    findButton: { offsetParent: {}, getBoundingClientRect: () => ({ left: 280, right: 308, top: 200, height: 28, width: 28 }), focus: () => buttonFocus++ },
    findInput: { focus: () => inputFocus++, select() {} },
  };
  state.pageRoot = { querySelector: selector => {
    if (selector === '.find__input') return state.$refs.findInput;
    if (selector === '.opinion-body') bodyReads++;
    return null;
  } };
  state.findShow = () => {};
  return { state, card, animations, history, bodyReads: () => bodyReads, select: text => vm.runInNewContext(`selText = ${JSON.stringify(text)}`, context), setWidth: width => { currentWidth = width; }, focus: () => ({ input: inputFocus, button: buttonFocus }) };
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

function deferTicks(state) {
  const pending = [];
  state.$nextTick = callback => pending.push(callback);
  return () => {
    while (pending.length) pending.shift()();
  };
}

test('delayed input cannot reopen a tab or search after Find is closed', () => {
  const { state, history, bodyReads } = fixture(true);
  state.openFind();
  state.showTab('authorities');
  state.findInput({ target: { value: 'Henry' } });
  assert.equal(state.activeTab, 'authorities');
  assert.equal(state.findOpen, false);
  assert.equal(state.find.query, '');
  assert.deepEqual(history, ['#authorities']);
  assert.equal(bodyReads(), 0);
  state.showTab('opinion');
  state.openFind();
  state.closeFind();
  state.$refs.findInput.value = 'Henry';
  state.findInput({ target: state.$refs.findInput });
  assert.equal(bodyReads(), 0);
  state.openFind();
  assert.equal(state.find.query, 'Henry');
  assert.equal(bodyReads(), 1);
});

test('queued matching is cancelled by close or a later tab selection before the next tick', () => {
  for (const leave of ['close', 'tab']) {
    const { state, bodyReads } = fixture(true);
    state.openFind();
    const flush = deferTicks(state);
    state.findInput({ target: { value: 'Henry' } });
    if (leave === 'close') state.closeFind();
    else state.showTab('authorities');
    flush();
    assert.equal(bodyReads(), 0, leave);
    assert.equal(state.findOpen, false, leave);
    assert.equal(state.activeTab, leave === 'tab' ? 'authorities' : 'opinion');
  }
});

test('only the newest queued query searches the document', () => {
  const { state, bodyReads } = fixture(true);
  state.openFind();
  const flush = deferTicks(state);
  state.findInput({ target: { value: 'Henry' } });
  state.findInput({ target: { value: 'Purnell' } });
  flush();
  assert.equal(bodyReads(), 1);
  assert.equal(state.find.query, 'Purnell');
});

test('explicit selected-text Find opens and searches while a stale queued opening cannot steal another tab', () => {
  const { state, bodyReads, select } = fixture(true);
  state.activeTab = 'authorities';
  const flush = deferTicks(state);
  select('selected passage');
  state.selFind();
  flush();
  assert.equal(state.activeTab, 'opinion');
  assert.equal(state.findOpen, true);
  assert.equal(state.find.query, 'selected passage');
  assert.equal(state.$refs.findInput.value, 'selected passage');
  assert.equal(bodyReads(), 1);
  state.closeFind();
  flush();
  state.openFind();
  state.showTab('history');
  flush();
  assert.equal(state.activeTab, 'history');
  assert.equal(state.findOpen, false);
});

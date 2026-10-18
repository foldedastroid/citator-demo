const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadReader, readerScripts } = require('./reader-harness.cjs');

function events(extra = {}) {
  const listeners = new Map();
  return Object.assign({
    listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    count() { return [...listeners.values()].reduce((n, group) => n + group.size, 0); },
  }, extra);
}

function fixture(reduced = true) {
  const media = events({ matches: reduced });
  const document = events({
    activeElement: null,
    documentElement: { scrollHeight: 1000 },
    querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 148 }) }),
    querySelectorAll: () => [],
    getElementById: () => null,
  });
  const add = document.addEventListener;
  document.addEventListener = (type, listener) => type === 'alpine:init' ? listener() : add.call(document, type, listener);
  let selection = { isCollapsed: true };
  let disconnected = 0;
  class ResizeObserver {
    observe() {}
    disconnect() { disconnected++; }
  }
  const window = events({ innerWidth: 375, innerHeight: 812, scrollY: 0, location: { hash: '' }, matchMedia: () => media, getSelection: () => selection, ResizeObserver });
  const scope = {
    document, window, ResizeObserver,
    getComputedStyle: () => ({ getPropertyValue: name => name === '--find-duration' ? '200ms' : 'ease-out' }),
    cancelAnimationFrame() {}, requestAnimationFrame: () => 1,
    clearTimeout() {}, setTimeout: () => 1,
    highlightElement() {}, queueMicrotask,
  };
  const reader = loadReader(scope);
  function create() {
    const state = reader.create();
    const root = events({ querySelector: selector => selector === '.case-head' ? { getBoundingClientRect: () => ({ bottom: 148 }) } : { contains: () => true } });
    state.$root = root;
    state.pageRoot = root;
    state.$watch = () => {};
    state.$nextTick = callback => callback();
    state.$refs = {
      findAnchor: { offsetParent: {}, getBoundingClientRect: () => ({ left: 16, bottom: 232 }) },
      findCard: { getBoundingClientRect: () => ({ width: 32 }) },
      findInput: { value: '', focus() {} },
      findMatches: { replaceChildren() {} },
      occPills: { replaceChildren() {} }, occPillsPlain: { replaceChildren() {} },
      fnBody: { replaceChildren() {} }, occCard: {},
    };
    return state;
  }
  return { ...reader, create, document, window, media, select: value => { selection = value; }, disconnected: () => disconnected };
}

test('production reader scripts compose live getters without evaluating them or silently overriding members', () => {
  const { context } = fixture();
  let reads = 0;
  const controller = context.composeReaderFeatures({ value: 1 }, { example: { get doubled() { reads++; return this.value * 2; } } });
  assert.equal(reads, 0);
  assert.equal(controller.doubled, 2);
  controller.value = 3;
  assert.equal(controller.doubled, 6);
  assert.throws(() => context.composeReaderFeatures({ value: 1 }, { example: { value: 2 } }), /Duplicate reader member: example.value/);
  assert.equal(readerScripts().at(-1), 'assets/js/alpine/components/opinion_tabs.js');
  assert.equal(readerScripts().length, 6);
});

test('each reader owns its animation and destroying one does not cancel another', () => {
  const { create } = fixture(false);
  const first = create(), second = create();
  const animations = [];
  for (const state of [first, second]) {
    state.$refs.findCard.animate = () => {
      let reject;
      const animation = { finished: new Promise((_, no) => { reject = no; }), cancelled: false, cancel() { this.cancelled = true; reject(); } };
      animations.push(animation);
      return animation;
    };
    state.initReaderFind();
    state.openFind();
  }
  assert.equal(animations[0].cancelled, false);
  assert.equal(animations[1].cancelled, false);
  first.destroy();
  assert.equal(animations[0].cancelled, true);
  assert.equal(animations[1].cancelled, false);
  second.destroy();
  assert.equal(animations[1].cancelled, true);
});

test('selected passages remain private and delegate Find through their own reader', () => {
  const { create, select } = fixture();
  const first = create(), second = create();
  const selected = text => ({ isCollapsed: false, rangeCount: 1, toString: () => text, getRangeAt: () => ({ commonAncestorContainer: {} }), removeAllRanges() {} });
  for (const [state, text] of [[first, 'First passage'], [second, 'Second passage']]) {
    state.$nextTick = () => {};
    select(selected(text));
    state.onSelection();
    state.openFind = () => {};
    state.findRun = query => { state.searched = query; };
    state.pageRoot.querySelector = () => state.$refs.findInput;
  }
  first.selFind();
  second.selFind();
  assert.equal(first.searched, 'First passage');
  assert.equal(second.searched, 'Second passage');
});

test('treatment stepping cannot read the other reader’s evidence items', () => {
  const { create, document } = fixture();
  const pill = { classList: { contains: value => value === 'severity-badge--caution', remove() {} }, cloneNode() { return this; }, removeAttribute() {}, querySelectorAll: () => [] };
  const row = name => ({ querySelectorAll: () => [1, 2].map(n => ({ querySelector: selector => selector === '.severity-badge' ? pill : { textContent: `${name} ${n}` } })) });
  const rows = { 'authority-1': row('First'), 'authority-2': row('Second') };
  document.getElementById = id => rows[id];
  const first = create(), second = create();
  for (const [state, n] of [[first, 1], [second, 2]]) {
    const link = { dataset: { group: String(n), name: 'Example' }, getAttribute: () => `#authority-${n}` };
    state.pageRoot.querySelectorAll = () => [link];
    state.occLocate = () => {};
    state.occOpen(link);
  }
  first.occItemNext();
  second.occItemNext();
  assert.equal(first.occNavRationale, 'First 2');
  assert.equal(second.occNavRationale, 'Second 2');
});

test('footnote Escape restores the anchor belonging to that reader', () => {
  const { create, document } = fixture();
  document.getElementById = () => ({ querySelector: () => ({ childNodes: [] }) });
  const first = create(), second = create();
  const anchors = [];
  for (const [state, label] of [[first, '1'], [second, '2']]) {
    const link = { textContent: label, getAttribute: () => `#fn-${label}`, focus() { this.focused = true; } };
    anchors.push(link);
    state.fnLocate = () => {};
    state.$refs.fnCard = { contains: () => true };
    state.onFootnoteClick({ target: { closest: () => link }, detail: 1, preventDefault() {} });
  }
  first.fnEscape();
  assert.equal(anchors[0].focused, true);
  assert.equal(anchors[1].focused, undefined);
});

test('mounting is idempotent and destroy removes listeners, observers and queued feature work', () => {
  const { create, document, window, media, disconnected } = fixture();
  const state = create();
  state.init();
  const counts = [document.count(), window.count(), media.count(), state.$root.count()];
  assert.ok(counts.every(n => n > 0));
  state.init();
  assert.deepEqual([document.count(), window.count(), media.count(), state.$root.count()], counts);
  const pending = [];
  state.$nextTick = callback => pending.push(callback);
  state.openFind();
  state.destroy();
  state.destroy();
  pending.forEach(callback => callback());
  assert.equal(state.findOpen, false);
  assert.deepEqual([document.count(), window.count(), media.count(), state.$root.count()], [0, 0, 0, 0]);
  assert.equal(disconnected(), 1);
});

test('destroy prevents queued frames and next ticks from touching a detached reader', () => {
  const { context } = fixture();
  const callbacks = new Map(), cancelled = [];
  let nextId = 0, effects = 0;
  context.requestAnimationFrame = callback => { callbacks.set(++nextId, callback); return nextId; };
  context.cancelAnimationFrame = id => cancelled.push(id);
  const lifecycle = context.createReaderLifecycle();
  const ticks = [];
  lifecycle.nextTick({ $nextTick: callback => ticks.push(callback) }, () => effects++);
  const frame = lifecycle.frame(() => effects++);
  lifecycle.destroy();
  ticks.forEach(callback => callback());
  callbacks.get(frame)();
  assert.deepEqual(cancelled, [frame]);
  assert.equal(effects, 0);
});

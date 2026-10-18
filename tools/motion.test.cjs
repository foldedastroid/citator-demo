





const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');


function eventBus(extra = {}) {
  return Object.assign(
    {
      handlers: {},
      addEventListener(type, fn) {
        (this.handlers[type] ??= []).push(fn);
      },
      emit(type, event = {}) {
        for (const fn of this.handlers[type] ?? []) fn(event);
      },
    },
    extra
  );
}

test('expandable text: measured clamp, distance-scaled durations, reduced motion, coalesced resizes', () => {
  const motion = eventBus({ matches: false });
  const style = {
    values: {},
    setProperty(key, value) {
      this.values[key] = value;
    },
  };
  const inner = { scrollHeight: 156 };
  const body = {
    style,
    classList: { add() {}, toggle() {} },
    current: 39,
    getBoundingClientRect() {
      return { height: this.current };
    },
    querySelector: () => inner,
  };
  const button = eventBus({
    setAttribute(key, value) {
      this[key] = value;
    },
  });
  const root = {
    dataset: { lines: '2' },
    querySelector: (selector) => (selector === '.expand__body' ? body : button),
  };
  const frames = [];
  let resize = null;
  class ResizeObserver {
    constructor(fn) {
      resize = fn;
    }
    observe() {}
  }
  const context = {
    document: eventBus({ readyState: 'complete', querySelectorAll: () => [root] }),
    window: { matchMedia: () => motion, ResizeObserver },
    getComputedStyle: () => ({ lineHeight: '19.5px', fontSize: '13px', getPropertyValue: () => '200ms' }),
    requestAnimationFrame(fn) {
      frames.push(fn);
      return frames.length;
    },
    ResizeObserver,
    parseInt,
    parseFloat,
  };
  vm.runInNewContext(source('assets/js/expandable.js'), context);


  assert.equal(style.height, '39px');
  button.emit('click');
  assert.equal(style.height, '156px');
  assert.equal(style.values['--expand-duration'], '200ms');


  body.current = 90;
  button.emit('click');
  assert.equal(style.height, '39px');
  const reverse = Number.parseFloat(style.values['--expand-duration']);
  assert.ok(reverse > 80 && reverse < 150, `reverse duration ${reverse}`);


  body.current = 60;
  motion.matches = true;
  motion.emit('change');
  assert.equal(style.values['--expand-duration'], '0ms');
  assert.equal(style.height, '39px');


  inner.scrollHeight = 39;
  resize();
  resize();
  resize();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(button.hidden, true);
});

test('cited-by call to action: a touch press is held, then released on every way out', () => {
  const motion = eventBus({ matches: false });
  const el = {
    held: false,
    closest() {
      return this;
    },
    setAttribute() {
      this.held = true;
    },
    removeAttribute() {
      this.held = false;
    },
  };
  const document = eventBus({ hidden: false, querySelectorAll: () => (el.held ? [el] : []) });
  const window = eventBus({ matchMedia: () => motion });
  const timers = new Map();
  let timerId = 0;
  vm.runInNewContext(source('assets/js/cite_cta.js'), {
    document,
    window,
    getComputedStyle: () => ({ getPropertyValue: () => '450ms' }),
    setTimeout(fn) {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    WeakMap,
    Map,
    parseFloat,
    Number,
  });
  const press = () => document.emit('pointerdown', { pointerType: 'touch', isPrimary: true, pointerId: 1, target: el });


  press();
  assert.ok(el.held);
  document.emit('pointerup', { pointerId: 1, target: {} });
  assert.ok(el.held);
  for (const fn of timers.values()) fn();
  assert.ok(!el.held);


  press();
  document.emit('pointercancel', { pointerId: 1, type: 'pointercancel' });
  assert.ok(!el.held);
  press();
  window.emit('blur');
  assert.ok(!el.held);
  press();
  motion.matches = true;
  motion.emit('change');
  assert.ok(!el.held);


  press();
  document.emit('pointerup', { pointerId: 1, type: 'pointerup' });
  assert.ok(!el.held);
});

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

test('sidebar edge drag settles, persists, reopens, and restores on cancellation', () => {
  let factory;
  const classes = new Set();
  const styles = new Map();
  const saved = new Map();
  let visibleWidth;
  const root = { classList: { add: x => classes.add(x), remove: x => classes.delete(x), toggle: (x, on) => on ? classes.add(x) : classes.delete(x) },
    style: { setProperty: (k, v) => styles.set(k, v), removeProperty: k => styles.delete(k) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/app_shell.js'), 'utf8'), {
    document: { documentElement: root, addEventListener: (_, f) => f(),
      getElementById: () => ({ getBoundingClientRect: () => ({ width: 248, right: visibleWidth ?? (state.sidebarOpen ? 248 : 0) }) }) },
    clearTimeout() {},
    localStorage: { setItem: (k, v) => saved.set(k, v) },
    Alpine: { data: (_, f) => { factory = f; } },
  });
  const state = factory();
  state.apply = () => {};
  let captured = false;
  const target = { getBoundingClientRect: () => ({ left: state.sidebarOpen ? 242 : 0 }), setPointerCapture() { captured = true; }, hasPointerCapture: () => captured,
    releasePointerCapture() { captured = false; } };
  const event = x => ({ button: 0, pointerId: 1, clientX: x, currentTarget: target, preventDefault() {} });
  state.startSidebarDrag(event(248));
  state.moveSidebarDrag(event(80));
  assert.equal(styles.get('--sidebar-drag-width'), '80px');
  state.endSidebarDrag(event(10));
  assert.equal(state.sidebarOpen, false);
  assert.equal(saved.get('citator-sidebar'), 'closed');
  assert.equal(captured, false);
  state.startSidebarDrag(event(0));
  state.endSidebarDrag(event(200));
  assert.equal(state.sidebarOpen, true);
  state.startSidebarDrag(event(248));
  state.moveSidebarDrag(event(0));
  state.cancelSidebarDrag();
  assert.equal(state.sidebarOpen, true);
  assert.equal(classes.has('is-sidebar-dragging'), false);
  assert.equal(styles.has('--sidebar-drag-width'), false);
  state.sidebarOpen = false;
  state.sidebarPeek = true;
  visibleWidth = 120;
  state.startSidebarDrag(event(5));
  assert.equal(styles.get('--sidebar-drag-width'), '120px');
  assert.equal(styles.get('--sidebar-drag-edge'), '0px');
  assert.equal(classes.has('is-sidebar-preview-drag'), true);
  state.moveSidebarDrag(event(45));
  assert.equal(styles.get('--sidebar-drag-width'), '160px');
  assert.equal(styles.get('--sidebar-drag-edge'), '40px');
  state.endSidebarDrag(event(145));
  assert.equal(state.sidebarOpen, true);
  assert.equal(classes.has('is-sidebar-preview-drag'), false);
  assert.equal(styles.has('--sidebar-drag-edge'), false);

});

test('hover preview closes after leaving, preserves focused content, and never persists its state', () => {
  let factory, pending;
  const sidebar = { contains: el => el === 'inside' };
  const document = { activeElement: null, getElementById: () => sidebar, addEventListener: (_, fn) => fn() };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/app_shell.js'), 'utf8'), {
    document, Alpine: { data: (_, fn) => { factory = fn; } },
    clearTimeout() { pending = null; }, setTimeout(fn) { pending = fn; return 1; },
    localStorage: { setItem() { throw new Error('Hover must not persist state'); } },
  });
  const state = factory();
  state.apply = () => {};
  state.sidebarOpen = false;
  state.holdSidebarPeek();
  assert.equal(state.sidebarPeek, true);
  assert.equal(state.sidebarOpen, false);
  state.releaseSidebarPeek();
  document.activeElement = 'inside';
  pending();
  assert.equal(state.sidebarPeek, true);
  document.activeElement = null;
  state.releaseSidebarPeek();
  pending();
  assert.equal(state.sidebarPeek, false);
  state.sidebarOpen = true;
  state.holdSidebarPeek();
  assert.equal(state.sidebarPeek, false);
});

test('page interaction dismisses only a temporary preview without redirecting focus', () => {
  let factory;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/app_shell.js'), 'utf8'), {
    document: { addEventListener: (_, fn) => fn() },
    Alpine: { data: (_, fn) => { factory = fn; } }, clearTimeout() {},
    localStorage: { setItem() {} },
  });
  const state = factory();
  state.apply = () => {};
  let focused = 0;
  state.focusToggle = () => focused++;
  state.sidebarOpen = false;
  state.sidebarPeek = true;
  state.dismissSidebarPeek({ target: { closest: () => true } });
  assert.equal(state.sidebarPeek, true);
  state.dismissSidebarPeek({ target: { closest: () => null } });
  assert.equal(state.sidebarPeek, false);
  assert.equal(state.sidebarOpen, false);
  assert.equal(focused, 0);
  state.toggleSidebar({ detail: 1 });
  assert.equal(state.sidebarOpen, true);
  assert.equal(focused, 0);
  state.dismissSidebarPeek({ target: { closest: () => null } });
  assert.equal(state.sidebarOpen, true);
  state.toggleSidebar({ detail: 0 });
  assert.equal(focused, 1);
});

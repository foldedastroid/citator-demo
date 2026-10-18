// Keep property descriptors: spreading feature objects would evaluate their reactive getters once.
function composeReaderFeatures(controller, features) {
  for (const [feature, members] of Object.entries(features)) {
    const descriptors = Object.getOwnPropertyDescriptors(members);
    for (const name of Object.keys(descriptors)) {
      if (Object.hasOwn(controller, name)) throw new Error(`Duplicate reader member: ${feature}.${name}`);
    }
    Object.defineProperties(controller, descriptors);
  }
  return controller;
}

// One registry owns every listener and disposal action for a mounted opinion.
function createReaderLifecycle() {
  const cleanups = [];
  const frames = new Set();
  let active = true;
  return {
    get active() { return active; },
    listen(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      cleanups.push(() => target.removeEventListener(type, listener, options));
    },
    cleanup(callback) { cleanups.push(callback); },
    nextTick(owner, callback) {
      owner.$nextTick(() => { if (active) callback(); });
    },
    frame(callback) {
      const id = requestAnimationFrame(() => {
        frames.delete(id);
        if (active) callback();
      });
      frames.add(id);
      return id;
    },
    cancelFrame(id) {
      cancelAnimationFrame(id);
      frames.delete(id);
    },
    destroy() {
      if (!active) return;
      active = false;
      frames.forEach(id => cancelAnimationFrame(id));
      frames.clear();
      while (cleanups.length) cleanups.pop()();
    },
  };
}

function readerHeaderBottom(root = document) {
  const head = root.querySelector('.case-head');
  if (head) return head.getBoundingClientRect().bottom;
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-px')) || 48;
}

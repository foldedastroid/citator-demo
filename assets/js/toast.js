





(function () {
  const DURATION = 4000;
  const VISIBLE = 3;
  const LEAVE_MS = 160;

  const ICONS = {
    positive:
      '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.86-9.81a.75.75 0 00-1.22-.87l-3.24 4.53-1.63-1.63a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.14-.1l3.76-5.24z" clip-rule="evenodd"/></svg>',
    destructive:
      '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>',
    neutral:
      '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5 2.75A1.75 1.75 0 016.75 1h6.5A1.75 1.75 0 0115 2.75v14.5a.75.75 0 01-1.2.6L10 15.06l-3.8 2.79a.75.75 0 01-1.2-.6V2.75z" clip-rule="evenodd"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>',
  };

  let list = null;

  function viewport() {
    if (list && list.isConnected) return list;
    const region = document.createElement('section');
    region.className = 'toast-viewport';
    region.setAttribute('aria-label', 'Notifications');
    list = document.createElement('ol');
    list.className = 'toast-stack';
    list.setAttribute('role', 'status');
    list.setAttribute('aria-live', 'polite');
    region.append(list);
    document.body.append(region);
    return list;
  }

  function leave(item) {
    if (!item.isConnected || item.dataset.leaving) return;
    item.dataset.leaving = 'true';
    clearTimeout(item._timer);
    setTimeout(() => item.remove(), LEAVE_MS);
  }

  function arm(item, ms) {
    clearTimeout(item._timer);
    if (ms > 0) item._timer = setTimeout(() => leave(item), ms);
  }

  function toast({ title, message = '', intent = 'neutral', duration = DURATION, action = null } = {}) {
    if (!title) return null;
    const stack = viewport();
    const item = document.createElement('li');
    item.className = 'toast';
    item.dataset.intent = intent;

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.innerHTML = ICONS[intent === 'destructive' || intent === 'neutral' ? intent : 'positive'];
    const copy = document.createElement('div');
    copy.className = 'toast__copy';
    const strong = document.createElement('strong');
    strong.className = 'toast__title';
    strong.textContent = title;
    copy.append(strong);
    if (message) {
      const p = document.createElement('p');
      p.className = 'toast__message';
      p.textContent = message;
      copy.append(p);
    }
    if (action && action.label) {
      const act = document.createElement('button');
      act.type = 'button';
      act.className = 'toast__action';
      act.textContent = action.label;
      act.addEventListener('click', () => {
        leave(item);
        if (typeof action.run === 'function') action.run();
      });
      item._action = act;
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__dismiss';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.innerHTML = ICONS.close;
    close.addEventListener('click', () => leave(item));

    item.append(icon, copy);
    if (item._action) item.append(item._action);
    item.append(close);
    stack.append(item);

    const live = Array.from(stack.children).filter((el) => !el.dataset.leaving);
    live.slice(0, Math.max(0, live.length - VISIBLE)).forEach(leave);

    let remaining = duration;
    let started = Date.now();
    const pause = () => {
      remaining = Math.max(0, remaining - (Date.now() - started));
      clearTimeout(item._timer);
    };
    const resume = () => {
      started = Date.now();
      arm(item, remaining || (duration > 0 ? LEAVE_MS * 6 : 0));
    };
    item.addEventListener('pointerenter', pause);
    item.addEventListener('pointerleave', resume);
    item.addEventListener('focusin', pause);
    item.addEventListener('focusout', resume);
    arm(item, duration);
    return item;
  }

  window.citatorToast = toast;
})();

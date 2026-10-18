





(function () {
  const match = window.location.pathname.match(/^\/opinion\/(\d+)\/?/);
  if (!match) return;
  const show = (selector, visible) => {
    const el = document.querySelector(selector);
    if (el) el.hidden = !visible;
  };
  show('[data-not-found-opinion]', true);
  show('[data-not-found-other]', false);
  const link = document.querySelector('[data-not-found-cl]');
  if (link) {
    link.href = `https://www.courtlistener.com/opinion/${match[1]}/x/`;
    link.hidden = false;
  }
})();

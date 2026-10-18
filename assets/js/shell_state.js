





(function () {
  var root = document.documentElement;
  var wide = window.matchMedia('(min-width: 1024px)').matches;
  function stored(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  if (!wide || stored('citator-sidebar') === 'closed') root.classList.add('sidebar-closed');
  if (!wide || stored('citator-panel') === 'closed') root.classList.add('panel-closed');
  if (stored('citator-text-signals') === 'off') root.classList.add('text-signals-off');
})();

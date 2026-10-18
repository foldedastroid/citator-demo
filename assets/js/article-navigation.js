(function () {
  function init() {
    const article = document.querySelector('[data-article-content]');
    const navigation = document.querySelector('[data-article-navigation]');
    const footer = document.getElementById('footer');
    if (!article || !navigation) return;
    const toggle = navigation.querySelector('[data-article-toggle]');
    const contents = navigation.querySelector('[data-article-contents]');
    const previous = navigation.querySelector('[data-article-previous]');
    const next = navigation.querySelector('[data-article-next]');
    const label = navigation.querySelector('[data-article-label]');
    const number = navigation.querySelector('[data-article-number]');
    const percent = navigation.querySelector('[data-article-percent]');
    const progress = navigation.querySelector('[data-article-progress]');
    if (!toggle || !contents || !previous || !next || !label || !number || !percent || !progress) return;

    const links = [...contents.querySelectorAll('a[href^="#"]')].filter((link) =>
      document.getElementById(link.hash.slice(1))
    );
    const sections = links.map((link) => document.getElementById(link.hash.slice(1)));
    if (!sections.length) return;

    let current = 0;
    let frame = 0;
    let footerTop = '';

    function sectionTitle(index) {
      const text = links[index].querySelector('[data-article-section-label]') || links[index];
      return text.textContent.trim();
    }

    function close(returnFocus = false) {
      contents.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus({ preventScroll: true });
    }

    function open() {
      contents.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }



    function render() {
      frame = 0;
      const box = article.getBoundingClientRect();
      if (footer) {
        const edge = `${footer.getBoundingClientRect().top}px`;
        if (edge !== footerTop) {
          footerTop = edge;
          navigation.style.setProperty('--article-footer-top', edge);
        }
      }
      const top = box.top + window.scrollY;
      const bottom = top + box.height;
      const line = Math.max(90, window.innerHeight * 0.2);
      let index = 0;
      sections.forEach((section, n) => {
        if (section.getBoundingClientRect().top <= line) index = n;
      });
      const atBottom = bottom <= window.innerHeight + window.scrollY + 3;
      current = atBottom ? sections.length - 1 : index;

      const start = Math.max(0, top - 64);
      const value = Math.max(0, Math.min(1, (window.scrollY - start) / Math.max(1, bottom - window.innerHeight - start)));
      const rounded = Math.round(value * 100);
      const title = sectionTitle(current);
      label.textContent = title;
      number.textContent = `${String(current + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}`;
      percent.textContent = `${rounded}%`;
      navigation.style.setProperty('--article-progress', String(value));
      progress.setAttribute('aria-valuenow', String(rounded));
      progress.setAttribute('aria-valuetext', `${title}, ${rounded}% through the article`);
      toggle.setAttribute('aria-label', `Article sections: ${title}, section ${current + 1} of ${sections.length}`);
      previous.disabled = current === 0;
      next.disabled = current === sections.length - 1;
      links.forEach((link, n) => {
        if (n === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(render);
    }

    function go(index, focusContent = false) {
      const section = sections[Math.max(0, Math.min(sections.length - 1, index))];
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${section.id}`);
      close();
      section.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
      if (focusContent) {
        const target = section.matches('h1, h2, h3') ? section : section.querySelector('h2, h3') || section;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
      schedule();
    }

    const modified = (event) => event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

    toggle.addEventListener('click', () => {
      if (contents.hidden) open();
      else close();
    });
    toggle.addEventListener('keydown', (event) => {
      if (modified(event)) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        open();
        links[current].focus();
      }
    });
    previous.addEventListener('click', () => go(current - 1));
    next.addEventListener('click', () => go(current + 1));
    links.forEach((link, index) =>
      link.addEventListener('click', (event) => {
        event.preventDefault();
        go(index, true);
      })
    );

    contents.addEventListener('keydown', (event) => {
      if (modified(event)) return;
      const at = links.indexOf(document.activeElement);
      let destination;
      if (event.key === 'ArrowDown') destination = (at + 1) % links.length;
      else if (event.key === 'ArrowUp') destination = (at - 1 + links.length) % links.length;
      else if (event.key === 'Home') destination = 0;
      else if (event.key === 'End') destination = links.length - 1;
      else return;
      event.preventDefault();
      links[destination].focus();
    });

    navigation.addEventListener('keydown', (event) => {
      if (modified(event)) return;
      if (event.key === 'Escape' && !contents.hidden) {
        event.preventDefault();
        close(true);
        return;
      }
      if (!contents.hidden) return;
      const moves = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: sections.length - 1 };
      if (!(event.key in moves)) return;
      event.preventDefault();
      go(moves[event.key]);
    });

    document.addEventListener('click', (event) => {
      if (!navigation.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !contents.hidden) close(true);
    });
    navigation.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!navigation.contains(document.activeElement)) close();
      });
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('hashchange', schedule);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(schedule);
      observer.observe(article);
      if (footer) observer.observe(footer);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

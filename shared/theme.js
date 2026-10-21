// light/dark theme
(() => {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let saved = null;
  const read = () => { try { saved = localStorage.getItem('sh-theme'); } catch (error) { } };
  read();
  const apply = () => { root.dataset.theme = saved || (system.matches ? 'dark' : 'light'); };
  apply();
  const changed = () => dispatchEvent(new Event('themechange'));
  system.addEventListener('change', () => { if (!saved) { apply(); changed(); } });
  window.shTheme = {
    get: () => root.dataset.theme,
    set(theme) {
      saved = theme;
      try { localStorage.setItem('sh-theme', theme); } catch (error) { }
      apply();
      changed();
    },
    toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
  };

  function sync() {
    const was = root.dataset.theme;
    read();
    apply();
    dispatchEvent(new Event('settingschange'));
    if (root.dataset.theme !== was) changed();
  }
  addEventListener('pageshow', event => { if (event.persisted) sync(); });
  addEventListener('storage', event => { if (!event.key || event.key.startsWith('sh-')) sync(); });

  // chrome paint hold
  const hold = document.createElement('link');
  hold.rel = 'expect';
  hold.href = '#parsed';
  hold.setAttribute('blocking', 'render');
  document.head.append(hold);
  // firefox paint hold
  root.classList.add('unscaled');
  document.addEventListener('readystatechange', () => root.classList.remove('unscaled'), { once: true });

  // fresh visit hold
  const type = performance.getEntriesByType('navigation')[0]?.type;
  let from = '';
  try { from = new URL(document.referrer).origin; } catch (error) { }
  if (type === 'navigate' && from !== location.origin && location.protocol !== 'file:') root.classList.add('held');
})();

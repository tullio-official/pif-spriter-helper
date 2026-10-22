// site skeleton
(() => {
  // --- tools in workflow order ---
  const TOOLS = [
    { key: 'unsprited-finder', name: 'Unsprited Finder', icon: 'find', built: true, about: 'Random fusions that are still unsprited' },
    { key: 'sprite-gallery', name: 'Sprite Gallery', icon: 'references' },
    { key: 'palette-library', name: 'Palette Library', icon: 'palette', built: true, about: 'All palettes used to sprite a Pokémon' },
    { key: 'drawing-tool', name: 'Drawing Tool', icon: 'draw' },
    { key: 'sprite-checker', name: 'Sprite Checker', icon: 'check' },
  ];
  const SITE = 'Spriter Helper';
  const FEEDBACK = 'https://discord.com/users/555046719406997552';

  const home = new URL('../', document.currentScript.src).href;
  const here = new URL('./', location.href).href;
  const page = here.startsWith(home) ? here.slice(home.length).replace(/\/$/, '') : '';
  const prefix = page ? '../'.repeat(page.split('/').length) : '';
  const tool = TOOLS.find(entry => entry.key === page);

  function make(tag, props, ...kids) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  }
  const icon = (name, alt = '') => make('img', { src: `${prefix}assets/icons/${name}.png`, alt });

  // --- #nativetooltipsareoverparty ---
  function untitle(node) {
    if (node.nodeType !== 1) return;
    const found = node.hasAttribute('title') ? [node] : [];
    found.push(...node.querySelectorAll('[title]'));
    found.forEach(hinted => {
      const text = hinted.getAttribute('title');
      hinted.removeAttribute('title');
      if (text) hinted.dataset.tip = text;
      else delete hinted.dataset.tip;
    });
  }
  new MutationObserver(changes => changes.forEach(change => {
    if (change.type === 'attributes') { if (change.target.hasAttribute('title')) untitle(change.target); }
    else change.addedNodes.forEach(untitle);
  })).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });
  untitle(document.body);

  // --- sidebar ---
  function item(href, name, current, kid) {
    const link = make('a', { className: 'item', href, title: name }, kid);
    if (current) link.setAttribute('aria-current', 'page');
    return link;
  }

  const theme = make('button', { className: 'item', type: 'button' }, icon('moon'));
  function drawTheme() {
    const dark = window.shTheme?.get() === 'dark';
    const text = dark ? 'Switch to light theme' : 'Switch to dark theme';
    theme.firstChild.src = `${prefix}assets/icons/${dark ? 'sun' : 'moon'}.png`;
    theme.title = text;
    theme.setAttribute('aria-label', text);
  }
  theme.addEventListener('click', () => window.shTheme?.toggle());
  addEventListener('themechange', drawTheme);
  drawTheme();
  // preloading theme icons
  ['sun', 'moon'].forEach(name => { new Image().src = `${prefix}assets/icons/${name}.png`; });

  const feedback = make('a', { className: 'item', href: FEEDBACK, target: '_blank', rel: 'noopener', title: 'Feedback on Discord' }, icon('feedback'));
  feedback.setAttribute('aria-label', 'Feedback on Discord');

  const built = TOOLS.filter(entry => entry.built);
  const side = make('nav', { id: 'side' },
    make('div', { id: 'side-art' },
      item(prefix || './', SITE, !page, icon('logo', SITE)),
      make('div', { id: 'steps' }, ...built.map(entry => item(`${prefix}${entry.key}/`, entry.name, entry === tool, icon(entry.icon, entry.name)))),
      make('div', { id: 'side-foot' }, theme, feedback)));
  // no reloading current page
  side.addEventListener('click', event => { if (event.target.closest('[aria-current]')) event.preventDefault(); });
  window.siteTools = TOOLS;
  window.siteFeedback = FEEDBACK;

  const narrow = make('div', { id: 'desktop-only' }, make('p', { textContent: "I've only made this for landscape so far, so this site doesn't work on narrow ratios yet. I'm working on it :D" }));
  document.body.prepend(narrow, side);

  // --- title row ---
  const titleRow = make('header', { id: 'title-row' }, make('h1', { className: 'x2', textContent: tool ? tool.name : SITE }));
  titleRow.dataset.box = '';
  document.getElementById('art').prepend(titleRow);

  // --- bubbles ---
  const GAP = 3;
  const TAIL = 3;
  const LINE = 40; // max letters per line

  function wrap(text) {
    const words = text.split(' ');
    const fill = width => words.reduce((lines, word) => {
      const last = lines.length - 1;
      if (last >= 0 && lines[last].length + 1 + word.length <= width) lines[last] += ' ' + word;
      else lines.push(word);
      return lines;
    }, []);
    const count = fill(LINE).length;
    let width = Math.ceil(text.length / count);
    while (fill(width).length > count) width++;
    return fill(width);
  }

  function bubble(layer, text, spot) {
    const lines = wrap(text);
    const width = Math.max(...lines.map(line => line.length)) * 6 + 15;
    const height = lines.length * 12 + 8;
    const shape = make('div', { className: 'bubble' }, make('span', { textContent: lines.join('\n') }));
    if (spot.right != null) {
      shape.classList.add('right');
      shape.style.width = width + TAIL + 'px';
      shape.style.left = Math.round(spot.right) + GAP + 'px';
      shape.style.top = Math.max(2, Math.min(layer.rows - height - 2, Math.round(spot.middle) - height / 2)) + 'px';
    } else {
      const left = Math.max(2, Math.min(layer.cols - width - 2, Math.round(spot.x - width / 2)));
      shape.style.width = width + 'px';
      shape.style.setProperty('--tail', Math.max(8, Math.min(width - 8, Math.round(spot.x) - left)) + 'px');
      let top = Math.round(spot.top) - GAP - TAIL - height;
      if (top < 2) {
        shape.classList.add('under');
        top = Math.round(spot.bottom) + GAP;
      }
      shape.style.left = left + 'px';
      shape.style.top = top + 'px';
    }
    layer.append(shape);
    return shape;
  }
  window.siteBubble = bubble;

  // --- tooltips ---
  const DELAY = 500;
  const GRACE = 400; // next tip shows instantly
  const tips = make('div', { id: 'tips' });
  document.body.append(tips);
  let target = null, shown = null, muted = null, timer = 0, closed = 0;

  function show(hinted) {
    clearTimeout(timer);
    shown?.remove();
    const text = hinted.dataset.tip;
    const state = window.pixelState;
    if (!text || !hinted.isConnected || !state) return;
    const rect = hinted.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const scale = state.ratio;
    tips.style.transform = `scale(${scale})`;
    tips.cols = state.cols;
    tips.rows = state.rows;
    shown = hinted.closest('#side')
      ? bubble(tips, text, { right: state.sideW, middle: (rect.top + rect.height / 2) / scale })
      : bubble(tips, text, { x: (rect.left + rect.width / 2) / scale, top: rect.top / scale, bottom: rect.bottom / scale });
    shown.append(make('div', { className: 'bridge' }));
  }
  const onTip = node => !!node && !!shown?.contains(node);
  function hide() {
    clearTimeout(timer);
    if (shown) closed = performance.now();
    shown?.remove();
    shown = null;
  }
  function enter(hinted) {
    if (hinted === target) return;
    hide();
    target = hinted;
    if (!hinted || hinted === muted) return;
    if (hinted.closest('#side') || performance.now() - closed < GRACE) show(hinted);
    else timer = setTimeout(() => show(hinted), DELAY);
  }
  function leave() {
    hide();
    target = muted = null;
  }

  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'mouse' && !onTip(event.target)) enter(event.target.closest?.('[data-tip]') || null);
  });
  document.addEventListener('pointerout', event => {
    const next = event.relatedTarget;
    if (target && !(next && (target.contains(next) || onTip(next)))) leave();
  });
  document.addEventListener('pointerdown', () => {
    hide();
    muted = target;
  }, true);
  document.addEventListener('focusin', event => {
    const hinted = event.target.closest?.('[data-tip]');
    if (hinted && hinted.matches(':focus-visible')) enter(hinted);
  });
  document.addEventListener('focusout', () => { if (target && !target.matches(':hover') && !shown?.matches(':hover')) leave(); });
  addEventListener('keydown', event => { if (event.key !== 'Tab') hide(); }, true);
  addEventListener('scroll', hide, true);
  addEventListener('blur', leave);
  addEventListener('pageswap', leave);

  // --- page swap (firefox.. girl....) ---
  const LIMIT = 400;
  const assets = `${home}assets/`;

  function settled() {
    const until = performance.now() + LIMIT;
    const fonts = ['16px monogram', '20px jersey'].map(font => document.fonts.load(font).catch(() => { }));
    const icons = [...document.images].filter(image => image.src.startsWith(assets)).map(image => image.decode().catch(() => {}));
    const skins = new Promise(resolve => {
      const check = () => ([...document.querySelectorAll('.textbox')].every(textbox => textbox.firstElementChild || !textbox.getClientRects().length)
        || performance.now() > until ? resolve() : requestAnimationFrame(check));
      check();
    });
    return Promise.race([Promise.all([...fonts, ...icons, skins]), new Promise(resolve => setTimeout(resolve, LIMIT))]);
  }

  addEventListener('pagereveal', event => {
    const swap = event.viewTransition;
    if (swap) settled().then(() => swap.skipTransition());
  });
  const root = document.documentElement;
  if (root.classList.contains('held')) addEventListener('DOMContentLoaded', () => settled().then(() => root.classList.remove('held')));
})();

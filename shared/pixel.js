// pixel grid engine
(() => {
  const root = document.documentElement;
  const stage = document.getElementById('stage');
  const art = document.getElementById('art');
  const page = document.getElementById('page');
  const side = document.getElementById('side');
  const sideArt = document.getElementById('side-art');
  const titleRow = document.getElementById('title-row');
  const TILE = 8;
  // wider pages
  const MAX_WIDTH = +page.dataset.max || 480;
  // full screen pages
  const FULL = page.hasAttribute('data-full');

  const saved = key => { try { return localStorage.getItem(key); } catch (error) { return null; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch (error) {} };

  // debug overlay
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  const asked = new URLSearchParams(location.search).get('debug');
  if (asked !== null) save('sh-debug', asked === '0' ? '0' : '1');
  // saved settings
  let step, debug, forced, checker, mini, hidden;
  function load() {
    const sticky = saved('sh-debug');
    debug = sticky === null ? local : sticky === '1';
    step = +saved('sh-step') || 0;
    forced = +saved('sh-scale') || 0;
    checker = saved('sh-checker') !== '0';
    mini = saved('sh-hud-mini') === '1';
    hidden = saved('sh-hud-hidden') === '1';
    document.body.classList.toggle('clean', saved('sh-clean') === '1');
    root.classList.toggle('debug', debug);
    window.pixelDebug = debug;
  }
  load();
  let state = {};

  // debug size labels
  const labels = document.createElement('div');
  stage.append(labels);

  // auto scale
  const FIT = 736;
  const TALL = 520;
  function autoScale(deviceWidth, screenHeight) {
    return Math.max(1, Math.min(Math.max(2, Math.floor(screenHeight / TALL)), Math.floor(deviceWidth / FIT)));
  }
  const screenSize = () => [screen.width, screen.height].map(size => Math.round(size * (window.devicePixelRatio || 1)));

  function pattern(scale) {
    const dark = root.dataset.theme === 'dark';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE * scale;
    const context = canvas.getContext('2d');
    for (let down = 0; down < TILE; down++) {
      for (let across = 0; across < TILE; across++) {
        context.fillStyle = (across + down) % 2 ? (dark ? '#1d1a27' : '#e9e3dd') : (dark ? '#17141f' : '#f6f2ee');
        context.fillRect(across * scale, down * scale, scale, scale);
      }
    }
    context.fillStyle = dark ? '#4a4460' : '#9a9a9a';
    context.fillRect(0, 0, TILE * scale, 1);
    context.fillRect(0, 0, 1, TILE * scale);
    return canvas.toDataURL();
  }

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = root.clientWidth;
    const deviceWidth = Math.floor(cssWidth * dpr);
    const [screenWidth, screenHeight] = screenSize();
    const auto = autoScale(deviceWidth, screenHeight);
    const scale = forced || Math.min(Math.max(auto + step, Math.ceil(auto / 2)), auto * 2);
    const ratio = scale / dpr;
    // too narrow message >w<
    root.classList.toggle('narrow', (innerWidth < 800 && screen.width < 800) || deviceWidth < FIT);
    const cols = Math.floor(deviceWidth / scale);
    const rows = Math.ceil(innerHeight * dpr / scale);
    const sideW = parseInt(getComputedStyle(sideArt).getPropertyValue('--side'));
    const avail = cols - sideW;

    let width, left;
    if (FULL) {
      width = avail;
      left = sideW;
      page.style.height = rows + 'px';
    } else {
      width = Math.min(MAX_WIDTH, avail - TILE * 2);
      width = Math.max(TILE, Math.floor(width / TILE) * TILE);
      left = sideW + TILE;
    }
    titleRow.style.left = sideW + TILE * 2 + 'px';

    // sidebar
    side.style.width = sideW * ratio + 'px';
    sideArt.style.transform = `scale(${ratio})`;
    sideArt.style.height = rows + 'px';
    sideArt.style.setProperty('--sliver', rows % TILE + 'px');

    art.style.transform = `scale(${ratio})`;
    art.style.width = cols + 'px';
    art.style.minHeight = rows + 'px';
    page.style.width = width + 'px';
    page.style.marginLeft = left + 'px';
    const background = debug && checker ? `url(${pattern(scale)})` : 'none';
    art.style.backgroundImage = background;
    art.style.backgroundSize = `${TILE}px ${TILE}px`;

    // sidebar debug checker
    const tint = debug && !document.body.classList.contains('clean');
    sideArt.style.backgroundImage = tint ? `linear-gradient(rgba(255, 60, 150, .14), rgba(255, 60, 150, .14)), ${background}` : background;
    sideArt.style.backgroundSize = tint ? `auto, ${TILE}px ${TILE}px` : `${TILE}px ${TILE}px`;

    state = { dpr, scale, auto, ratio, cols, rows, width, left, sideW, screenWidth, screenHeight };
    window.pixelState = state;
    fit();
  }

  function fit() {
    const tall = art.offsetHeight;
    stage.style.height = (tall > state.rows ? tall * state.ratio : innerHeight) + 'px';
    if (debug) requestAnimationFrame(measure);
  }

  function measure() {
    queued = false;
    const { dpr, scale } = state;
    const base = stage.getBoundingClientRect();
    const clean = document.body.classList.contains('clean');
    let worst = 0;
    labels.innerHTML = '';
    document.querySelectorAll('[data-box]').forEach(box => {
      if (!box.getClientRects().length) return;
      const rect = box.getBoundingClientRect();
      const origin = box.closest('[data-art]')?.getBoundingClientRect() || base;
      const values = [rect.left - origin.left, rect.top - origin.top, rect.width, rect.height].map(value => value * dpr / scale);
      const off = Math.max(...values.map(value => Math.abs(value - Math.round(value))));
      worst = Math.max(worst, off);
      if (clean) return;
      const clip = box.closest('[data-clip]')?.getBoundingClientRect();
      if (clip && (rect.right <= clip.left || rect.right > clip.right + 0.5 || rect.bottom <= clip.top || rect.bottom > clip.bottom + 0.5)) return;
      const tag = document.createElement('span');
      tag.className = 'label' + (off > 0.02 ? ' bad' : '');
      tag.textContent = `${Math.round(values[2])}×${Math.round(values[3])}`;
      tag.style.left = (rect.right - base.left) + 'px';
      tag.style.top = (rect.bottom - base.top) + 'px';
      tag.style.transform = 'translate(-100%, -100%)';
      labels.append(tag);
    });
    const rect = sideArt.getBoundingClientRect();
    const sideValues = [rect.left, rect.top, rect.width].map(value => value * dpr / scale);
    worst = Math.max(worst, ...sideValues.map(value => Math.abs(value - Math.round(value))));
    state.worst = worst;
    hud();
  }

  let queued = false;
  window.pixelMeasure = () => {
    if (!debug || queued || !state.scale) return;
    queued = true;
    requestAnimationFrame(measure);
  };

  // debug panel (hides with g)
  const panel = document.createElement('div');
  panel.id = 'hud';
  panel.hidden = !debug || hidden;
  document.body.append(panel);

  function hud() {
    if (!debug) return;
    const { dpr, scale, auto, ratio, cols, width, left, sideW, worst, screenWidth, screenHeight } = state;
    const buttons = ['auto', 1, 2, 3, 4, 5, 6, 8].map(option => {
      const on = (option === 'auto' ? 0 : option) === forced;
      return `<button data-s="${option}"${on ? ' class="on"' : ''}>${option === 'auto' ? 'Auto' : option + 'x'}</button>`;
    }).join('');
    const snap = `Snap ${worst > 0.02 ? `<b class="bad">off by ${worst.toFixed(2)} art px</b>` : '<b class="good">ok</b>'}`;
    if (mini) {
      panel.innerHTML = `<div>${snap} <button data-t="mini" title="Show debug panel">+</button></div>`;
      return;
    }
    panel.innerHTML = `
      <button data-t="mini" class="min" title="Shrink debug panel">-</button>
      <div>Screen <b>${screenWidth}×${screenHeight}</b> DPR <b>${+dpr.toFixed(3)}</b> · auto <b>${auto}x</b>${step ? ` · Ctrl <b>${step > 0 ? '+' : ''}${step}</b>` : ''}</div>
      <div>Scale <b>${scale}x</b> (1 art px = ${scale} screen px = ${+ratio.toFixed(3)} CSS px)</div>
      <div>Viewport <b>${cols}</b> art px wide · sidebar <b>${sideW}</b> · content <b>${width}</b> wide, starts at ${left}</div>
      <div>${snap}</div>
      <div>${buttons}</div>
      <div><button data-t="checker"${checker ? ' class="on"' : ''}>Checker</button><button data-t="boxes"${document.body.classList.contains('clean') ? '' : ' class="on"'}>Boxes</button></div>`;
  }

  panel.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.s) {
      forced = button.dataset.s === 'auto' ? 0 : +button.dataset.s;
      save('sh-scale', forced);
    }
    if (button.dataset.t === 'checker') {
      checker = !checker;
      save('sh-checker', checker ? '1' : '0');
    }
    if (button.dataset.t === 'mini') {
      mini = !mini;
      save('sh-hud-mini', mini ? '1' : '0');
      return hud();
    }
    if (button.dataset.t === 'boxes') save('sh-clean', document.body.classList.toggle('clean') ? '1' : '0');
    layout();
  });

  addEventListener('keydown', event => {
    if (!debug || event.key !== 'g' || event.target.closest('input, textarea')) return;
    hidden = !hidden;
    save('sh-hud-hidden', hidden ? '1' : '0');
    panel.hidden = hidden;
  });

  function zoom(direction) {
    const { auto, scale } = state;
    const next = Math.min(Math.max(scale + direction, Math.ceil(auto / 2)), auto * 2);
    if (Math.sign(next - scale) !== direction) return;
    step = next - auto;
    forced = 0;
    save('sh-step', step);
    save('sh-scale', 0);
    layout();
  }
  function unzoom() {
    step = forced = 0;
    save('sh-step', 0);
    save('sh-scale', 0);
    layout();
  }
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
  addEventListener('keydown', event => {
    if (!(MAC ? event.metaKey : event.ctrlKey) || event.altKey) return;
    if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') zoom(1);
    else if (event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract') zoom(-1);
    else if (event.key === '0' || event.code === 'Digit0' || event.code === 'Numpad0') return unzoom();
    else return;
    event.preventDefault();
  });
  // ctrl wheel + pinch zoom
  let wheeled = -Infinity;
  addEventListener('wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.timeStamp - wheeled > 200 && event.deltaY) zoom(event.deltaY < 0 ? 1 : -1);
    wheeled = event.timeStamp;
  }, { capture: true, passive: false });

  // settings sync across pages
  addEventListener('settingschange', () => {
    load();
    panel.hidden = !debug || hidden;
    if (!debug) labels.replaceChildren();
    layout();
  });

  function watchDpr() {
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`)
      .addEventListener('change', () => { layout(); watchDpr(); }, { once: true });
  }

  // screen change check
  setInterval(() => {
    const [screenWidth, screenHeight] = screenSize();
    if (screenWidth !== state.screenWidth || screenHeight !== state.screenHeight) layout();
  }, 1000);

  addEventListener('resize', layout);
  addEventListener('themechange', layout);
  new ResizeObserver(() => state.ratio && fit()).observe(art);
  watchDpr();
  layout();
})();

// disk opening fix
if (location.protocol === 'file:') {
  document.querySelectorAll('a[href$="/"]').forEach(link => {
    const href = link.getAttribute('href');
    if (!/^[a-z]+:/i.test(href)) link.setAttribute('href', href + 'index.html');
  });
}

// pixel caret
document.querySelectorAll('.field input').forEach(input => {
  const caret = document.createElement('div');
  caret.className = 'caret';
  input.parentElement.append(caret);
  const context = document.createElement('canvas').getContext('2d');
  const pad = parseInt(getComputedStyle(input).paddingLeft);

  function draw() {
    const show = document.activeElement === input && input.selectionStart === input.selectionEnd;
    caret.classList.remove('on');
    if (!show) return;
    context.font = getComputedStyle(input).font;
    const width = Math.round(context.measureText(input.value.slice(0, input.selectionStart)).width);
    caret.style.left = (pad - 1 + width - input.scrollLeft) + 'px';
    void caret.offsetWidth; // restart blink
    caret.classList.add('on');
  }
  ['focus', 'blur', 'input', 'scroll'].forEach(type => input.addEventListener(type, draw));
  document.addEventListener('selectionchange', draw);
  document.fonts.ready.then(draw);
});

// 9-slicing textbox
(() => {
  const base = document.currentScript.src;
  const NIGHT = new Set(['dark', 'dark-pressed']);
  const file = name => `textbox-${name}${NIGHT.has(name) && document.documentElement.dataset.theme === 'dark' ? '-night' : ''}.png`;
  const loads = {};
  const images = {};
  function load(name) {
    if (!loads[name]) {
      const image = new Image();
      loads[name] = new Promise(resolve => {
        image.onload = () => resolve(images[name] = image);
      });
      image.src = new URL(`../assets/textboxes/${name}`, base);
      if (image.complete && image.naturalWidth) images[name] = image;
    }
    return loads[name];
  }

  const slices = new Map();
  function tile(context, image, name, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height) {
    if (width <= 0 || height <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return;
    const key = `${name} ${sourceX},${sourceY},${sourceWidth},${sourceHeight}`;
    let slice = slices.get(key);
    if (!slice) {
      slice = document.createElement('canvas');
      slice.width = sourceWidth;
      slice.height = sourceHeight;
      slice.getContext('2d').drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
      slices.set(key, slice);
    }
    const pattern = context.createPattern(slice, 'repeat');
    pattern.setTransform(new DOMMatrix([1, 0, 0, 1, x, y]));
    context.fillStyle = pattern;
    context.fillRect(x, y, width, height);
  }

  function draw(image, name, width, height, slice) {
    // slice like css
    let [top, right, bottom, left] = slice.split(/\s+/).map(Number);
    right ??= top;
    bottom ??= top;
    left ??= right;
    const imageWidth = image.width, imageHeight = image.height, middleWidth = imageWidth - left - right, middleHeight = imageHeight - top - bottom;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, left, top, 0, 0, left, top);
    context.drawImage(image, imageWidth - right, 0, right, top, width - right, 0, right, top);
    context.drawImage(image, 0, imageHeight - bottom, left, bottom, 0, height - bottom, left, bottom);
    context.drawImage(image, imageWidth - right, imageHeight - bottom, right, bottom, width - right, height - bottom, right, bottom);
    tile(context, image, name, left, 0, middleWidth, top, left, 0, width - left - right, top);
    tile(context, image, name, left, imageHeight - bottom, middleWidth, bottom, left, height - bottom, width - left - right, bottom);
    tile(context, image, name, 0, top, left, middleHeight, 0, top, left, height - top - bottom);
    tile(context, image, name, imageWidth - right, top, right, middleHeight, width - right, top, right, height - top - bottom);
    tile(context, image, name, left, top, middleWidth, middleHeight, left, top, width - left - right, height - top - bottom);
    return canvas;
  }

  // skin cache
  const done = new Map();
  const painted = new WeakMap();
  function paint(box, width = box.offsetWidth, height = box.offsetHeight) {
    const name = file(box.dataset.skin);
    const loading = load(name);
    const image = images[name];
    if (!image) {
      loading.then(() => { if (name === file(box.dataset.skin)) paint(box, width, height); });
      return;
    }
    if (!width || !height) return;
    const slice = box.dataset.slice || '7';
    const key = `${name} ${width}x${height} ${slice}`;
    let source = done.get(key);
    if (!source) {
      if (done.size > 300) done.clear();
      done.set(key, source = draw(image, name, width, height, slice));
    }
    // no toDataURL
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(source, 0, 0);
    canvas.style.display = 'block';
    box.replaceChildren(canvas);
    painted.set(box, name);
  }
  window.pixelSkin = box => paint(box);

  const observer = new ResizeObserver(entries => entries.forEach(entry => {
    const size = entry.borderBoxSize && entry.borderBoxSize[0];
    if (size) paint(entry.target, Math.round(size.inlineSize), Math.round(size.blockSize));
    else paint(entry.target);
  }));
  const watch = box => {
    load(file(box.dataset.skin));
    observer.observe(box);
  };
  document.querySelectorAll('.textbox').forEach(watch);
  // textboxes added later
  new MutationObserver(changes => changes.forEach(change => change.addedNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    if (node.matches('.textbox')) watch(node);
    node.querySelectorAll('.textbox').forEach(watch);
  }))).observe(document.body, { childList: true, subtree: true });
  // theme switch
  addEventListener('themechange', () => document.querySelectorAll('.textbox').forEach(box => {
    if (painted.get(box) !== file(box.dataset.skin)) paint(box);
  }));
})();

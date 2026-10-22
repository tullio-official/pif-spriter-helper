// palette library
(() => {
  const DATA = '../data/palettes/';
  const DEX = 'https://infinitefusiondex.com/details/';
  const SHEETS = 'https://infinitefusion.net/customsprites/spritesheets/';
  const FILES = 'https://infinitefusion.net/customsprites/';
  const MAX = 8;
  // side panel width
  const PANEL = 232;
  const DONE_MS = 700; // copy feedback time

  const { oklch, darker, ink } = window.siteColour;
  const { scroller, scale } = window.siteScroll;

  const byId = name => document.getElementById(name);
  const art = byId('art');
  const main = byId('main');
  const input = byId('pick');
  const drop = byId('drop');
  const bar = byId('bar');
  const heading = byId('heading');
  const title = byId('title');
  const stats = byId('stats');
  const body = byId('body');
  const list = byId('list');
  const panel = byId('panel');
  const panelView = byId('pview');
  const panelContent = byId('pcontent');

  const store = {
    get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch (error) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (error) { } },
  };

  function make(tag, props, ...kids) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  }
  function textbox(skin = 'dark', extra) {
    const box = make('div', { className: 'textbox' + (extra ? ' ' + extra : '') });
    box.dataset.skin = skin;
    box.dataset.slice = '7';
    return box;
  }
  function brackets(skin = 'brackets', extra = 'brk') {
    const box = textbox(skin);
    box.dataset.slice = '10';
    box.classList.add(extra);
    return box;
  }
  function credit(name, x, top) {
    const text = `Sprite by ${name}`, width = text.length * 6 + 15, tail = Math.floor(width / 2);
    const bubble = make('div', { className: 'bubble credit' }, make('span', { textContent: text }));
    Object.assign(bubble.style, { width: width + 'px', left: x - tail + 'px', top: top - 26 + 'px' });
    bubble.style.setProperty('--tail', tail + 'px');
    return bubble;
  }
  const emptyList = text => make('div', { className: 'msg art' },
    make('div', { className: 'drawing' }, make('img', { src: '../assets/icons/empty.png', width: 48, height: 48, alt: '' }), credit('Blaquaza', 24, 6)),
    make('p', { textContent: text }));
  function emptyPanel(text) {
    const well = make('div', { className: 'well' }, textbox('dark-pressed'), make('img', { src: '../assets/icons/silhouette.png', width: 96, height: 96, alt: '' }),
      credit('.rayzard', 96, 0));
    well.dataset.box = '';
    return make('div', { className: 'msg art' }, well, make('p', { textContent: text }));
  }
  const dotted = (...parts) => parts.flatMap((part, index) => (index ? [make('span', { className: 'dot' }), part] : [part]));
  const format = count => count.toLocaleString('en-US');
  const plural = (count, word) => `${format(count)} ${word}${count === 1 ? '' : 's'}`;

  // --- pokémon list ---
  const fold = text => [...text].map(letter => letter.normalize('NFD')[0].toLowerCase()).join('');
  function loose(text) {
    const key = [], spots = [];
    [...fold(text)].forEach((letter, index) => {
      const kept = letter === '♀' ? 'f' : letter === '♂' ? 'm' : letter;
      if (/[a-z0-9]/.test(kept)) {
        key.push(kept);
        spots.push(index);
      }
    });
    return { key: key.join(''), spots };
  }
  const slug = text => loose(text).key;
  const padded = number => String(number).padStart(3, '0');
  const MONS = NAMES.map((name, index) => {
    const parts = loose(name);
    return { name, dex: index + 1, low: fold(name), slug: parts.key, spots: parts.spots };
  });
  const byName = (first, second) => first.name.localeCompare(second.name);

  function findMons(query) {
    const text = fold(query.trim());
    if (!text) return [];
    const number = text.replace(/^#/, '');
    if (/^\d+$/.test(number)) {
      const exact = MONS.filter(mon => mon.dex === +number);
      const starts = MONS.filter(mon => mon.dex !== +number && (String(mon.dex).startsWith(number) || padded(mon.dex).startsWith(number)));
      return [...exact, ...starts].slice(0, MAX).map(mon => ({ mon, at: -1, length: 0 }));
    }
    const starts = MONS.filter(mon => mon.low.startsWith(text)).sort(byName);
    const contains = MONS.filter(mon => !mon.low.startsWith(text) && mon.low.includes(text)).sort(byName);
    let found = [...starts, ...contains].map(mon => ({ mon, at: mon.low.indexOf(text), length: text.length }));
    // loose search
    const key = slug(query);
    if (!found.length && key) {
      const keyStarts = MONS.filter(mon => mon.slug.startsWith(key)).sort(byName);
      const keyContains = MONS.filter(mon => !mon.slug.startsWith(key) && mon.slug.includes(key)).sort(byName);
      found = [...keyStarts, ...keyContains].map(mon => {
        const index = mon.slug.indexOf(key), at = mon.spots[index];
        return { mon, at, length: mon.spots[index + key.length - 1] + 1 - at };
      });
    }
    return found.slice(0, MAX);
  }

  function lookup(param) {
    if (!param) return null;
    const text = param.replace(/^#/, '');
    if (/^\d+$/.test(text)) return MONS[+text - 1] || null;
    return MONS.find(mon => mon.slug === slug(text)) || null;
  }

  // --- search dropdown ---
  let typed = '';
  let items = [];
  let lit = -1;

  function label({ mon, at, length }) {
    const full = mon.name;
    if (at < 0) return [make('span', { className: 'muted', textContent: full })];
    return [
      at > 0 ? make('span', { className: 'muted', textContent: full.slice(0, at) }) : '',
      full.slice(at, at + length),
      at + length < full.length ? make('span', { className: 'muted', textContent: full.slice(at + length) }) : '',
    ];
  }

  function show() {
    if (!typed.trim()) return close();
    drop.replaceChildren(textbox());
    if (!items.length) drop.append(make('div', { className: 'opt none muted', textContent: 'No Pokémon found' }));
    items.forEach((item, index) => {
      const row = make('div', { className: 'opt' + (index === lit ? ' on' : '') },
        make('span', {}, ...label(item)), make('span', { className: 'muted', textContent: '#' + padded(item.mon.dex) }));
      row.addEventListener('mousedown', event => event.preventDefault());
      row.addEventListener('click', () => open(item.mon));
      drop.append(row);
    });
    drop.hidden = false;
  }

  function close() {
    drop.hidden = true;
    lit = -1;
  }

  function put(value) {
    input.value = value;
    input.setSelectionRange(value.length, value.length);
  }

  input.addEventListener('input', () => {
    typed = input.value;
    items = findMons(typed);
    lit = -1;
    show();
  });
  // keeping selection
  let keepSelection = false;
  input.addEventListener('focus', () => {
    closeSort();
    if (current && input.value === current.name) {
      input.select();
      keepSelection = true;
      return;
    }
    if (input.value) {
      typed = input.value;
      items = findMons(typed);
      show();
    }
  });
  input.addEventListener('mouseup', event => {
    if (keepSelection) event.preventDefault();
    keepSelection = false;
  });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', event => {
    const count = items.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (drop.hidden) {
        if (input.value) {
          typed = input.value;
          items = findMons(typed);
          lit = -1;
          show();
        }
        return;
      }
      if (!count) return;
      lit = event.key === 'ArrowDown' ? (lit + 1 >= count ? -1 : lit + 1) : (lit - 1 < -1 ? count - 1 : lit - 1);
      put(lit < 0 ? typed : items[lit].mon.name);
      show();
    } else if (event.key === 'Escape') {
      if (drop.hidden) return;
      event.preventDefault();
      put(typed);
      close();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (drop.hidden && !input.value) return;
      if (drop.hidden) {
        typed = input.value;
        items = findMons(typed);
      }
      if (!items.length) return;
      const mon = (lit >= 0 ? items[lit] : items[0]).mon;
      if (mon === current && drop.hidden) {
        input.select();
        return;
      }
      open(mon);
    }
  });
  // / to search
  addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select')) return;
    event.preventDefault();
    input.focus();
    input.select();
  });

  // --- sprites ---
  const letters = text => [...text].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 96, 0);

  function describe(id) {
    let match = id.match(/^(\d+)([a-z]*)$/);
    if (match) {
      const head = +match[1];
      return {
        name: NAMES[head - 1], link: DEX + head, url: `${SHEETS}spritesheets_base/${head}.png`, cell: letters(match[2]), cols: 10,
        file: `${FILES}Other/BaseSprites/${id}.png`
      };
    }
    match = id.match(/^(\d+)\.(\d+)([a-z]*)$/);
    const head = +match[1], body = +match[2];
    return {
      name: `${NAMES[head - 1]}/${NAMES[body - 1]}`, link: `${DEX}${head}.${body}`, body,
      url: `${SHEETS}spritesheets_custom/${head}/${head}${match[3]}.png`, cell: body, cols: 20, file: `${FILES}CustomBattlers/${id}.png`
    };
  }

  function holder(box, entry, zoom) {
    box.dataset.id = entry[0];
    box.dataset.z = zoom;
    if (entry[2]) box.dataset.loose = '1';
    else delete box.dataset.loose;
  }

  // lazy loading sheets
  const watchers = new Map();
  function watch(box, area) {
    let watcher = watchers.get(area);
    if (!watcher) {
      watcher = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        watcher.unobserve(entry.target);
        paint(entry.target);
      }), { root: area, rootMargin: '400px 0px' });
      watchers.set(area, watcher);
    }
    watcher.observe(box);
  }

  function paint(box) {
    const id = box.dataset.id;
    const info = describe(id);
    const zoom = +box.dataset.z || 1;
    const pic = box.querySelector('.pic');
    const stale = () => box.dataset.id !== id;
    const image = new Image();
    if (box.dataset.loose) {
      image.onload = () => {
        if (stale()) return;
        const canvas = make('canvas', { width: 96, height: 96 });
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        const step = Math.max(1, Math.round(image.width / 96));
        for (let down = 0; down < 96; down++) {
          for (let across = 0; across < 96; across++) context.drawImage(image, across * step, down * step, 1, 1, across, down, 1, 1);
        }
        canvas.style.width = canvas.style.height = 96 * zoom + 'px';
        pic.style.backgroundImage = '';
        pic.replaceChildren(canvas);
      };
      image.src = info.file;
      return;
    }
    image.onload = () => {
      if (stale()) return;
      pic.replaceChildren();
      pic.style.backgroundImage = `url("${info.url}")`;
      pic.style.backgroundSize = `${image.naturalWidth * zoom}px ${image.naturalHeight * zoom}px`;
      pic.style.backgroundPosition = `-${info.cell % info.cols * 96 * zoom}px -${Math.floor(info.cell / info.cols) * 96 * zoom}px`;
    };
    image.src = info.url;
  }

  // --- palette ---
  const hexes = text => text.match(/.{6}/g) || [];
  const upper = hex => '#' + hex.toUpperCase();
  const rows = ramps => ramps.flatMap(ramp => {
    const list = hexes(ramp), out = [];
    for (let at = 0; at < list.length; at += 10) out.push(list.slice(at, at + 10));
    return out;
  });

  function image(ramps) {
    const lines = rows(ramps), width = Math.max(...lines.map(line => line.length));
    const canvas = make('canvas', { width: width * 2, height: lines.length * 2 });
    const context = canvas.getContext('2d');
    // padding short rows
    lines.forEach((line, down) => {
      for (let across = 0; across < width; across++) {
        context.fillStyle = '#' + line[Math.min(across, line.length - 1)];
        context.fillRect(across * 2, down * 2, 2, 2);
      }
    });
    return canvas;
  }
  const blob = canvas => new Promise((resolve, reject) => canvas.toBlob(blobbed => blobbed ? resolve(blobbed) : reject(), 'image/png'));

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const area = make('textarea', { value: text });
      document.body.append(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      if (!copied) throw error;
    }
  }

  // copy feedback
  const DONE = '../assets/icons/done.png';
  new Image().src = DONE; // preload
  function confirmed(button) {
    const icon = button.querySelector(':scope > img'), text = button.querySelector(':scope > span');
    if (!button.doneTimer) {
      if (icon) button.dataset.icon = icon.getAttribute('src');
      if (text) button.dataset.text = text.textContent;
    }
    clearTimeout(button.doneTimer);
    if (icon) icon.src = DONE;
    if (text) text.textContent = 'Copied!';
    button.doneTimer = setTimeout(() => {
      button.doneTimer = 0;
      if (icon) icon.src = button.dataset.icon;
      if (text) text.textContent = button.dataset.text;
    }, DONE_MS);
  }

  function copyHex(hex, square) {
    copyText(upper(hex)).then(() => {
      square.classList.add('done');
      clearTimeout(square.doneTimer);
      square.doneTimer = setTimeout(() => square.classList.remove('done'), DONE_MS);
    }, () => toast("Couldn't copy", square));
  }

  function copyLines(list, anchor) {
    copyText(list.map(upper).join('\n')).then(() => confirmed(anchor), () => toast("Couldn't copy", anchor));
  }

  function copyImage(ramps, anchor) {
    const blobbed = blob(image(ramps));
    Promise.resolve()
      .then(() => navigator.clipboard.write([new ClipboardItem({ 'image/png': blobbed })]))
      .then(() => confirmed(anchor), () => toast("Couldn't copy", anchor));
  }

  async function download(ramps, id) {
    const link = make('a', { download: `${current.slug}-${id}-palette.png` });
    link.href = URL.createObjectURL(await blob(image(ramps)));
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function iconButton(icon, text, action) {
    const button = make('button', { className: 'btn', type: 'button', title: text, ariaLabel: text },
      textbox('dark'), textbox('dark-pressed'), make('img', { src: `../assets/icons/${icon}.png`, width: 16, height: 16, alt: '' }));
    button.addEventListener('click', action);
    return button;
  }
  function textButton(text, hint, action) {
    const button = make('button', { className: 'tbtn', type: 'button', title: hint }, textbox('dark'), textbox('dark-pressed'), make('span', { textContent: text }));
    button.addEventListener('click', action);
    return button;
  }

  // ramp chips
  const CORNER = [5, 3, 2, 1, 1]; // rounded corner shape
  const chipArt = new Map();
  function chipCanvas(row) {
    const key = row.join('');
    let source = chipArt.get(key);
    if (!source) {
      const count = row.length, width = count * 16 + 2, height = 18;
      source = make('canvas', { width, height });
      const context = source.getContext('2d');
      row.forEach((hex, index) => {
        context.fillStyle = '#' + hex;
        context.fillRect(1 + index * 16, 1, 16, 16);
      });
      context.fillStyle = '#121b26';
      for (let line = 0; line < height; line++) {
        const edge = CORNER[Math.min(line, height - 1 - line)] ?? 0;
        if (edge) {
          context.clearRect(0, line, edge, 1);
          context.clearRect(width - edge, line, edge, 1);
        }
        if (line === 0 || line === height - 1) context.fillRect(edge, line, width - 2 * edge, 1);
        else if (line === 1 || line === height - 2) {
          context.fillRect(edge, line, CORNER[0] - edge, 1);
          context.fillRect(width - CORNER[0], line, CORNER[0] - edge, 1);
        } else {
          context.fillRect(edge, line, 1, 1);
          context.fillRect(width - 1 - edge, line, 1, 1);
        }
      }
      chipArt.set(key, source);
    }
    const canvas = make('canvas', { width: source.width, height: source.height });
    canvas.getContext('2d').drawImage(source, 0, 0);
    return canvas;
  }
  function chip(row, pic) {
    const canvas = chipCanvas(row);
    const box = make('div', { className: 'chip' }, canvas, ...row.map((hex, index) => {
      const square = make('button', { className: 'sq ' + ink(hex), type: 'button', title: 'Copy ' + upper(hex), ariaLabel: 'Copy ' + upper(hex) });
      square.style.left = 1 + index * 16 + 'px';
      square.addEventListener('click', () => copyHex(hex, square));
      xrayOn(square, pic, [hex], row);
      return square;
    }));
    return box;
  }

  function strip(palette, width) {
    const colours = palette.ramps.flatMap(hexes);
    const canvas = make('canvas', { className: 'pstrip', width, height: 8 });
    const context = canvas.getContext('2d');
    context.fillStyle = '#121b26';
    context.fillRect(0, 0, width, 8);
    const inner = width - 2, count = colours.length, base = Math.floor(inner / count);
    let extra = inner - base * count, at = 1;
    colours.forEach(hex => {
      const each = base + (extra-- > 0 ? 1 : 0);
      context.fillStyle = '#' + hex;
      context.fillRect(at, 1, each, 6);
      at += each;
    });
    return canvas;
  }

  // --- x-ray ---
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const filterNode = document.createElementNS(SVGNS, 'filter');
  filterNode.id = 'xray';
  filterNode.setAttribute('color-interpolation-filters', 'sRGB');
  filterNode.setAttribute('x', '0');
  filterNode.setAttribute('y', '0');
  filterNode.setAttribute('width', '1');
  filterNode.setAttribute('height', '1');
  svg.append(filterNode);
  document.body.append(svg);
  const element = (tag, attributes, ...kids) => {
    const node = document.createElementNS(SVGNS, tag);
    for (const key in attributes) node.setAttribute(key, attributes[key]);
    node.append(...kids);
    return node;
  };
  const only = value => Array.from({ length: 256 }, (_, index) => (index === value ? 1 : 0)).join(' ');

  function setFilter(colours) {
    const parts = [];
    colours.forEach((hex, index) => {
      const [red, green, blue] = [0, 2, 4].map(at => parseInt(hex.slice(at, at + 2), 16));
      parts.push(
        element('feComponentTransfer', { in: 'SourceGraphic', result: `eq${index}` },
          element('feFuncR', { type: 'discrete', tableValues: only(red) }),
          element('feFuncG', { type: 'discrete', tableValues: only(green) }),
          element('feFuncB', { type: 'discrete', tableValues: only(blue) })),
        element('feColorMatrix', {
          in: `eq${index}`, type: 'matrix', result: `avg${index}`,
          values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .25 .25 .25 .25 0'
        }),
        element('feComponentTransfer', { in: `avg${index}`, result: index ? `m${index}` : 'u0' },
          element('feFuncA', { type: 'discrete', tableValues: '0 0 0 0 1' })));
      if (index) parts.push(element('feComposite', { in: `u${index - 1}`, in2: `m${index}`, operator: 'arithmetic', k2: 1, k3: 1, result: `u${index}` }));
    });
    const last = `u${colours.length - 1}`;
    parts.push(
      element('feComposite', { in: 'SourceGraphic', in2: last, operator: 'in', result: 'kept' }),
      element('feFlood', { 'flood-color': '#c6bed0', result: 'flat' }),
      element('feComposite', { in: 'flat', in2: 'SourceAlpha', operator: 'in', result: 'rest' }),
      element('feMerge', {}, element('feMergeNode', { in: 'rest' }), element('feMergeNode', { in: 'kept' })));
    filterNode.replaceChildren(...parts);
  }

  let filtered = null;
  function xray(pic, colours) {
    if (filtered && filtered !== pic) filtered.style.filter = '';
    setFilter(colours);
    pic.style.filter = 'url(#xray)';
    filtered = pic;
  }
  // x-ray hover (whole ramp with ctrl)
  let hovered = null;
  const chosen = (hover, event) => (hover.ramp && (event.ctrlKey || event.metaKey) ? hover.ramp : hover.colours);
  function xrayOn(node, pic, colours, ramp) {
    node.addEventListener('mouseenter', event => {
      hovered = { pic, colours, ramp };
      xray(pic, chosen(hovered, event));
    });
    node.addEventListener('mouseleave', () => {
      hovered = null;
      if (filtered) filtered.style.filter = '';
      filtered = null;
    });
  }
  ['keydown', 'keyup'].forEach(type => addEventListener(type, event => {
    if (hovered && (event.key === 'Control' || event.key === 'Meta')) xray(hovered.pic, chosen(hovered, event));
  }));

  // accent button skins
  const SKIN = {
    raised: ['.....bbbbb.....', '...bbccccdbb...', '..bcccccccddb..', '.bcccccccccddb.', '.bcccccccccddb.',
      'bcccccccccccddb', 'bcccccccccccddb', 'bcccccccccccddb', 'bccccccccccdddb', 'bdcccccccccdddb',
      '.bdcccccccdddb.', '.bdddcccdddddb.', '..bdddddddddb..', '...bbdddddbb...', '.....bbbbb.....'],
    pressed: ['.....bbbbb.....', '...bbdddddbb...', '..bdddddddddb..', '.bdddddccccddb.', '.bdddcccccccdb.',
      'bdddcccccccccdb', 'bdddcccccccccdb', 'bddcccccccccccb', 'bddcccccccccccb', 'bddcccccccccccb',
      '.bdccccccccccb.', '.bddcccccccccb.', '..bddcccccccb..', '...bbddcccbb...', '.....bbbbb.....'],
  };
  const skinArt = new Map();
  function skin(width, height, fill, shade, kind = 'raised') {
    const key = `${width} ${height} ${fill} ${shade} ${kind}`;
    let source = skinArt.get(key);
    if (!source) {
      source = make('canvas', { width, height });
      const context = source.getContext('2d');
      const colours = { b: '#121b26', c: '#' + fill, d: '#' + shade };
      const at = (index, size) => (index < 7 ? index : index >= size - 7 ? index - (size - 15) : 7);
      for (let down = 0; down < height; down++) {
        for (let across = 0; across < width; across++) {
          const letter = SKIN[kind][at(down, height)][at(across, width)];
          if (letter === '.') continue;
          context.fillStyle = colours[letter];
          context.fillRect(across, down, 1, 1);
        }
      }
      skinArt.set(key, source);
    }
    const canvas = make('canvas', { width, height });
    canvas.getContext('2d').drawImage(source, 0, 0);
    return canvas;
  }

  // --- ramp names ---
  function rampName(ramp) {
    const colours = hexes(ramp).map(oklch);
    const average = pick => colours.reduce((sum, colour) => sum + pick(colour), 0) / colours.length;
    const lightness = average(colour => colour.lightness), chroma = average(colour => colour.chroma);
    if (colours.every(colour => colour.lightness < 0.4) && Math.min(...colours.map(colour => colour.lightness)) < 0.25 && chroma < 0.08) return 'Outline';
    if (chroma < 0.03) return lightness > 0.85 ? 'White' : lightness > 0.65 ? 'Light grey' : lightness < 0.3 ? 'Black' : 'Grey';
    const hue = colours.reduce((best, colour) => (colour.chroma > best.chroma ? colour : best)).hue;
    let name;
    if (hue < 40 || hue >= 345) name = lightness > 0.75 ? 'Pink' : 'Red';
    else if (hue < 75) name = lightness < 0.5 ? 'Brown' : 'Orange';
    else if (hue < 110) name = lightness >= 0.8 ? 'Yellow' : lightness < 0.5 ? 'Olive' : 'Gold';
    else if (hue < 165) name = 'Green';
    else if (hue < 210) name = 'Teal';
    else if (hue < 280) name = 'Blue';
    else if (hue < 320) name = 'Purple';
    else name = lightness > 0.65 ? 'Pink' : 'Magenta';
    if (chroma < 0.06) return (lightness >= 0.6 ? 'Pale ' : 'Dull ') + name.toLowerCase();
    if (lightness >= 0.82 && !['Yellow', 'Pink'].includes(name)) return 'Light ' + name.toLowerCase();
    if (lightness < 0.42 && !['Brown', 'Olive'].includes(name)) return 'Dark ' + name.toLowerCase();
    return name;
  }
  function rampNames(ramps) {
    const seen = {};
    return ramps.map(ramp => {
      const name = rampName(ramp);
      seen[name] = (seen[name] || 0) + 1;
      return seen[name] > 1 ? `${name} ${seen[name]}` : name;
    });
  }

  // --- data ---
  const cache = {};
  const waiting = {};
  window.palettes = data => {
    cache[data.id] = data;
    (waiting[data.id] || []).forEach(waiter => waiter(data));
    delete waiting[data.id];
  };
  function load(id) {
    if (cache[id]) return Promise.resolve(cache[id]);
    return new Promise((resolve, reject) => {
      (waiting[id] ||= []).push(resolve);
      if (waiting[id].length > 1) return;
      const script = make('script', { src: `${DATA}${id}.js` });
      script.onerror = () => {
        delete waiting[id];
        script.remove();
        reject();
      };
      document.body.append(script);
    });
  }

  // --- state ---
  let current = null; // open pokémon
  let all = []; // its palettes
  let shown = []; // filtered + sorted
  let selected = null; // side panel palette
  let viewing = 0; // panel sprite index
  let filter = 'all';
  let accent = '121b26'; // band colour
  let shade = '0d121b'; // band shadow
  let ticket = 0;
  const SORTS = {
    shared: { label: 'Most popular', compare: (first, second) => second.sprites.length - first.sprites.length || first.number - second.number },
    fewest: { label: 'Fewest colours', compare: (first, second) => first.colours - second.colours || second.sprites.length - first.sprites.length || first.number - second.number },
    most: { label: 'Most colours', compare: (first, second) => second.colours - first.colours || second.sprites.length - first.sprites.length || first.number - second.number },
    body: { label: 'Body dex', compare: (first, second) => first.body - second.body || first.number - second.number },
  };
  let sortKey = store.get('pal-sort', 'shared');
  if (!SORTS[sortKey]) sortKey = 'shared';
  let view = store.get('pal-view', 'grid') === 'list' ? 'list' : 'grid';
  let size = store.get('pal-size', '1') === '2' ? 2 : 1;

  function prep(groups) {
    return groups.map(([ramps, sprites], index) => {
      const base = sprites.some(entry => !entry[0].includes('.'));
      const bodies = sprites.filter(entry => entry[0].includes('.')).map(entry => +entry[0].split('.')[1].match(/^\d+/)[0]);
      return { number: index + 1, ramps, sprites, base, colours: new Set(ramps.flatMap(hexes)).size, body: base ? 0 : Math.min(...bodies) };
    });
  }
  function accentOf(data) {
    if (data.accent) return data.accent;
    const counts = {};
    data.groups.forEach(([ramps, sprites, main]) => {
      const key = main || hexes(ramps[0])[0];
      counts[key] = (counts[key] || 0) + sprites.length;
    });
    const keys = Object.keys(counts), colourful = keys.filter(hex => oklch(hex).chroma >= 0.06);
    const pool = colourful.length ? colourful : keys;
    return pool.reduce((best, hex) => (counts[hex] > counts[best] ? hex : best), pool[0]) || '121b26';
  }
  function apply() {
    shown = all.filter(palette => filter === 'all' || palette.base === (filter === 'base')).sort(SORTS[sortKey].compare);
  }

  // --- top bar ---
  const filterBox = byId('filter');
  const viewBox = byId('view');
  const sizeBox = byId('size');
  const sortButton = byId('sort-btn');
  const sortMenu = byId('sort-menu');

  function seg(box, options, picked, onPick, off) {
    box.classList.toggle('off', !!off);
    box.replaceChildren(textbox('dark-pressed'), ...options.map(option => {
      const on = option.key === picked && !off;
      const button = make('button', { type: 'button', title: option.title || '', disabled: !!off });
      if (option.icon) button.setAttribute('aria-label', option.title);
      button.setAttribute('aria-pressed', String(on));
      if (on) button.append(textbox('sunny'));
      button.append(option.icon ? make('img', { src: `../assets/icons/${option.icon}.png`, width: 16, height: 16, alt: '' }) : make('span', { textContent: option.text }));
      button.style.width = (option.width || Math.ceil((option.text.length * 6 + 16) / 8) * 8) + 'px';
      button.addEventListener('click', () => { if (!on && !off) onPick(option.key); });
      return button;
    }));
  }

  function drawControls() {
    const bases = all.filter(palette => palette.base).length, count = all.length;
    seg(filterBox, [
      { key: 'all', text: count ? `All ${format(count)}` : 'All', title: current && `All ${current.name} palettes` },
      { key: 'base', text: count ? `Base ${format(bases)}` : 'Base', title: current && `Palettes used by ${current.name} base sprites` },
      { key: 'fusion', text: count ? `Fusions ${format(count - bases)}` : 'Fusions', title: current && `Palettes only used by fusions with ${current.name} as the head` },
    ], filter, key => { filter = key; drawControls(); reshow(); }, !count);
    seg(viewBox, [
      { key: 'grid', icon: 'grid', width: 24, title: 'Grid' },
      { key: 'list', icon: 'list', width: 24, title: 'List' },
    ], view, key => { view = key; store.set('pal-view', key); drawControls(); rebuild(); });
    seg(sizeBox, [
      { key: 1, text: '1x', width: 24, title: 'Sprites at 1x' },
      { key: 2, text: '2x', width: 24, title: 'Sprites at 2x' },
    ], size, key => { size = key; store.set('pal-size', key); drawControls(); rebuild(); }, view !== 'grid');
    sortButton.querySelector('span').textContent = SORTS[sortKey].label;
    sortButton.title = 'Sort palettes';
    fit();
  }

  // sort menu
  const sortKeys = Object.keys(SORTS);
  let sortLit = -1;
  function lightSort(index) {
    sortLit = index;
    sortMenu.querySelectorAll('.opt').forEach((row, other) => row.classList.toggle('on', other === index));
  }
  function pickSort(key) {
    closeSort();
    if (key === sortKey) return;
    sortKey = key;
    store.set('pal-sort', key);
    drawControls();
    reshow();
  }
  function openSort() {
    sortMenu.replaceChildren(textbox(), ...sortKeys.map((key, index) => {
      const row = make('div', { className: 'opt', textContent: SORTS[key].label });
      row.addEventListener('mouseenter', () => lightSort(index));
      row.addEventListener('click', () => pickSort(key));
      return row;
    }));
    lightSort(sortKeys.indexOf(sortKey));
    sortMenu.hidden = false;
  }
  function closeSort() {
    sortMenu.hidden = true;
  }
  sortButton.addEventListener('click', () => (sortMenu.hidden ? openSort() : closeSort()));
  addEventListener('pointerdown', event => { if (!sortMenu.hidden && !event.target.closest('#sort')) closeSort(); });
  // sort menu keys
  addEventListener('keydown', event => {
    if (sortMenu.hidden) {
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && document.activeElement === sortButton) {
        event.preventDefault();
        openSort();
      }
      return;
    }
    const count = sortKeys.length;
    if (event.key === 'Escape') {
      closeSort();
      sortButton.focus();
    } else if (event.key === 'Tab') closeSort();
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      lightSort((sortLit + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (sortLit >= 0) pickSort(sortKeys[sortLit]);
      sortButton.focus();
    }
  });

  // --- list ---
  const CHUNK = { grid: 60, list: 24 };
  // row packing
  const LAYOUTS = { grid1: { width: 112, gap: 8 }, grid2: { width: 208, gap: 8 }, cards: { width: 304, gap: 16 } };
  function pack(room, layout) {
    const columns = Math.max(1, Math.floor((room + layout.gap) / (layout.width + layout.gap)));
    const spare = Math.floor((room - columns * layout.width - (columns - 1) * layout.gap) / 8);
    let best = null;
    for (let extraGap = 0; extraGap <= (columns > 1 ? 1 : 0); extraGap++) {
      const left = spare - (columns - 1) * extraGap;
      if (left < 0) break;
      const grow = Math.floor(left / columns), rem = left - columns * grow;
      if (!best || rem < best.rem) best = { columns, width: layout.width + 8 * grow, gap: layout.gap + 8 * extraGap, rem };
    }
    return best;
  }
  let listWidth = 112;
  let cell = 112; // tile / card width
  const palettesOf = new WeakMap();
  function sizeCells() {
    const packed = pack(listWidth, LAYOUTS[list.dataset.layout] || LAYOUTS.grid1);
    list.style.gridTemplateColumns = `repeat(${packed.columns}, ${packed.width}px)`;
    list.style.gap = packed.gap + 'px';
    list.style.setProperty('--cell', packed.width + 'px');
    const changed = packed.width !== cell;
    cell = packed.width;
    return changed;
  }
  function resizeCells() {
    list.querySelectorAll('.tile').forEach(node => node.querySelector('.pstrip').replaceWith(strip(palettesOf.get(node), cell - 16)));
    list.querySelectorAll('.pcard').forEach(sizeChips);
  }
  let drawn = 0;
  let listMessage = '';
  const sentinel = make('div', { className: 'sentinel' });
  const more = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) chunk();
  }, { root: list, rootMargin: '0px 0px 600px 0px' });

  function rebuild() {
    more.unobserve(sentinel);
    sentinel.remove();
    list.dataset.layout = view === 'list' ? 'cards' : size === 2 ? 'grid2' : 'grid1';
    sizeCells();
    list.replaceChildren();
    list.scrollTop = 0;
    drawn = 0;
    const message = all.length ? 'No palettes here yet' : listMessage;
    if (current && !shown.length && message) list.append(emptyList(message));
    chunk();
  }

  function chunk() {
    more.unobserve(sentinel);
    sentinel.remove();
    const next = shown.slice(drawn, drawn + CHUNK[view]);
    drawn += next.length;
    list.append(...next.map(palette => (view === 'list' ? card(palette) : tile(palette))));
    if (drawn < shown.length) {
      list.append(sentinel);
      more.observe(sentinel);
    }
    listScroll.sync();
    window.pixelMeasure?.();
  }

  function reshow() {
    apply();
    if (!shown.includes(selected)) select(shown[0] || null);
    rebuild();
  }

  function band(...kids) {
    const node = make('div', { className: 'strip ' + ink(accent) }, ...kids);
    node.style.background = '#' + accent;
    const shadow = make('div', { className: 'shade' });
    shadow.style.background = '#' + shade;
    return [node, shadow, make('div', { className: 'divider' })];
  }

  function plus(palette) {
    const others = palette.sprites.length - 1;
    const text = '+' + format(others), width = Math.ceil((text.length * 6 + 8) / 8) * 8;
    const node = make('span', { className: 'plus ' + ink(accent), title: `${plural(others, 'other sprite')} using this palette` },
      skin(width, 16, accent, shade), skin(width, 16, accent, shade, 'pressed'), make('span', { textContent: text }));
    node.style.width = width + 'px';
    node.setAttribute('role', 'button');
    node.addEventListener('click', event => {
      event.stopPropagation();
      select(palette);
      revealShared();
    });
    return node;
  }

  function tile(palette) {
    const first = palette.sprites[0];
    const name = describe(first[0]).name;
    const box = make('div', { className: 'spr' }, make('div', { className: 'pic' }));
    holder(box, first, size);
    watch(box, list);
    const node = make('button', {
      className: 'tile' + (size === 2 ? ' big' : '') + (palette === selected ? ' on' : ''), type: 'button',
      title: `${name} by ${first[1] || 'unknown artist'}`
    },
      textbox('dark'), textbox('dark-pressed', 'pressed'), ...band(make('span', { textContent: `Palette #${padded(palette.number)}` })), box,
      ...(palette.sprites.length > 1 ? [plus(palette)] : []), strip(palette, cell - 16),
      make('span', { className: 'cc', textContent: plural(palette.colours, 'colour') }), brackets(), brackets('brackets-hover', 'hov'));
    node.dataset.n = palette.number;
    node.dataset.box = '';
    palettesOf.set(node, palette);
    node.addEventListener('click', () => select(palette));
    return node;
  }

  function card(palette) {
    const { ramps, sprites } = palette;
    const first = sprites[0];
    const box = make('div', { className: 'sprite' }, textbox('dark-pressed'), make('div', { className: 'pic' }));
    holder(box, first, 1);
    box.dataset.box = '';
    watch(box, list);
    const pic = box.querySelector('.pic');
    const count = make('button', { type: 'button', textContent: plural(sprites.length, 'sprite') });
    if (sprites.length > 1) count.title = 'See all sprites using this palette';
    count.addEventListener('click', () => {
      select(palette);
      if (sprites.length > 1) revealShared();
    });
    const top = band(make('span', { textContent: `Palette #${padded(palette.number)}` }), count);
    const chips = make('div', { className: 'chips' }, ...rows(ramps).map(row => chip(row, pic)));
    const column = make('div', { className: 'pal' }, chips, make('div', { className: 'colors', textContent: plural(palette.colours, 'colour') }));
    const node = make('div', { className: 'pcard' + (palette === selected ? ' on' : '') },
      textbox('dark'), ...top,
      make('div', { className: 'who' }, box, make('div', { className: 'artist', textContent: `by ${first[1] || 'unknown artist'}`, title: first[1] || '' })),
      column,
      make('div', { className: 'tools' },
        iconButton('copy', 'Copy palette as PNG', event => copyImage(ramps, event.currentTarget)),
        iconButton('download', 'Save palette as PNG', () => download(ramps, first[0]))), brackets(), brackets('brackets-hover', 'hov'));
    node.dataset.n = palette.number;
    node.dataset.box = '';
    node.addEventListener('click', event => { if (!event.target.closest('button')) select(palette); });
    palettesOf.set(node, palette);
    sizeChips(node);
    return node;
  }
  function sizeChips(node) {
    const room = cell - 136;
    let at = 0, lines = 1;
    for (const row of rows(palettesOf.get(node).ramps)) {
      const width = row.length * 16 + 2;
      if (at && at + width > room) {
        at = 0;
        lines++;
      }
      at += width + 6;
    }
    const height = Math.max(96, lines * 24);
    node.querySelector('.chips').style.height = height + 'px';
    node.querySelector('.pal').style.height = height + 32 + 'px';
  }

  // --- side panel ---
  let panelWell = null;

  function select(palette) {
    selected = palette;
    viewing = 0;
    list.querySelectorAll('.on').forEach(node => node.classList.remove('on'));
    const node = palette && list.querySelector(`[data-n="${palette.number}"]`);
    if (node) node.classList.add('on');
    renderPanel();
  }

  function renderPanel() {
    panelWell = null;
    panelView.scrollTop = 0;
    if (!selected) {
      panelContent.replaceChildren(emptyPanel(current ? (all.length ? 'Nothing here' : 'Loading palettes…') : 'Pick a Pokémon to see its palettes'));
      panelScroll.sync();
      return;
    }
    const palette = selected;
    const count = make('button', { className: 'count', type: 'button', textContent: plural(palette.sprites.length, 'sprite') });
    const head = make('div', { className: 'phead' }, make('h2', { className: 'x2', textContent: `#${padded(palette.number)}` }), count);
    const nameLink = make('a', { className: 'pname', target: '_blank', rel: 'noopener' });
    const credit = make('div', { className: 'pby' });
    const box = make('div', { className: 'spr' }, make('div', { className: 'pic' }));
    const well = make('div', { className: 'well' }, textbox('dark-pressed'), box);
    well.dataset.box = '';
    panelWell = { box, pic: box.querySelector('.pic'), nameLink, credit };
    const every = palette.ramps.flatMap(hexes);
    const buttons = make('div', { className: 'pbtns' },
      textButton('Copy as PNG', 'Copy the palette image (2x2 px per colour)', event => copyImage(palette.ramps, event.currentTarget)),
      textButton('Save as PNG', 'Download the palette image', () => download(palette.ramps, palette.sprites[0][0])),
      textButton('Copy all hex codes', 'Every hex code, one per line', event => copyLines(every, event.currentTarget)));
    const names = rampNames(palette.ramps);
    const ramps = make('div', { className: 'ramps' }, ...palette.ramps.map((ramp, index) => {
      const list = hexes(ramp);
      return make('div', { className: 'ramp' },
        make('div', { className: 'chips' }, ...rows([ramp]).map(row => chip(row, panelWell.pic))),
        make('span', { className: 'rname', textContent: names[index], title: list.map(upper).join(' ') }));
    }));
    const colours = make('div', { className: 'pcolors', textContent: plural(palette.colours, 'colour') });
    const parts = [head, nameLink, well, credit, ramps, colours, buttons];
    if (palette.sprites.length > 1) {
      parts.push(make('div', { className: 'shared' },
        make('div', { className: 'lab', textContent: 'All sprites using this palette' }),
        make('div', { className: 'crops' }, ...palette.sprites.map((entry, index) => {
          const clip = make('div', { className: 'clip' }, make('div', { className: 'pic' }));
          holder(clip, entry, 1);
          watch(clip, panelView);
          const who = `${describe(entry[0]).name} by ${entry[1] || 'unknown artist'}`;
          const frame = textbox('dark-pressed');
          frame.classList.add('frame');
          const button = make('button', { className: 'crop' + (index === viewing ? ' on' : ''), type: 'button', title: who }, frame, clip, brackets(), brackets('brackets-hover', 'hov'));
          button.setAttribute('aria-label', who);
          button.addEventListener('click', () => showSprite(index));
          return button;
        }))));
      count.title = 'See all sprites using this palette';
      count.addEventListener('click', revealShared);
    } else {
      count.disabled = true;
    }
    panelContent.replaceChildren(...parts);
    showSprite(viewing);
    panelScroll.sync();
    window.pixelMeasure?.();
  }

  function showSprite(index) {
    if (!panelWell) return;
    viewing = index;
    const entry = selected.sprites[index];
    const info = describe(entry[0]);
    holder(panelWell.box, entry, 1);
    panelWell.pic.style.backgroundImage = '';
    panelWell.pic.replaceChildren();
    paint(panelWell.box);
    panelWell.nameLink.textContent = info.name;
    panelWell.nameLink.href = info.link;
    panelWell.nameLink.title = 'Open in Infinite Fusion Dex';
    panelWell.credit.textContent = `Sprite by ${entry[1] || 'unknown artist'}`;
    panelWell.credit.title = entry[1] || '';
    panelContent.querySelectorAll('.crop').forEach((crop, other) => crop.classList.toggle('on', other === index));
  }

  function revealShared() {
    const shared = panelContent.querySelector('.shared');
    if (shared) panelScroll.go(shared.offsetTop - 16);
  }

  // --- opening a pokémon ---
  async function open(mon, push = true) {
    close();
    put(mon.name);
    typed = mon.name;
    items = findMons(typed);
    if (document.activeElement === input) input.select();
    current = mon;
    store.set('pal-last', mon.slug);
    if (push) url(mon);
    document.title = `${mon.name} · Palette Library`;
    const mine = ++ticket;
    title.textContent = mon.name;
    stats.classList.add('loading');
    stats.replaceChildren('Loading palettes…');
    all = [];
    shown = [];
    selected = null;
    filter = 'all';
    listMessage = '';
    drawControls();
    rebuild();
    renderPanel();
    let data;
    try {
      data = await load(mon.dex);
    } catch (error) {
      if (mine === ticket) {
        stats.classList.remove('loading');
        stats.replaceChildren("Couldn't load the palettes");
        listMessage = "Couldn't load the palettes";
        rebuild();
      }
      return;
    }
    if (mine !== ticket) return;
    all = prep(data.groups);
    accent = accentOf(data);
    shade = darker(accent);
    const spriteCount = all.reduce((sum, palette) => sum + palette.sprites.length, 0);
    stats.classList.remove('loading');
    stats.replaceChildren(...dotted(plural(all.length, 'palette'), plural(spriteCount, 'sprite')));
    listMessage = 'No palettes yet';
    apply();
    selected = all[0] || null;
    viewing = 0;
    drawControls();
    rebuild();
    renderPanel();
  }

  function landing() {
    ticket++;
    current = null;
    all = [];
    shown = [];
    selected = null;
    document.title = 'Palette Library';
    title.textContent = '';
    stats.classList.remove('loading');
    stats.replaceChildren("Select a Pokémon to see every palette it's been sprited with");
    put('');
    typed = '';
    drawControls();
    rebuild();
    renderPanel();
    input.focus();
  }

  function url(mon) {
    if (param() === mon.slug) return;
    try {
      history.pushState({ p: mon.slug }, '', `?p=${mon.slug}`);
    } catch (error) {
      location.hash = `p=${mon.slug}`;
    }
  }
  const param = () => new URLSearchParams(location.search).get('p') || new URLSearchParams(location.hash.slice(1)).get('p');

  function route(first) {
    const mon = lookup(param());
    if (mon) {
      if (mon !== current) open(mon, false);
      return;
    }
    // reopening last pokémon
    const last = first && lookup(store.get('pal-last', ''));
    if (last) {
      try { history.replaceState({ p: last.slug }, '', `?p=${last.slug}`); } catch (error) { }
      return open(last, false);
    }
    landing();
  }
  addEventListener('popstate', () => route(false));
  addEventListener('hashchange', () => {
    const mon = lookup(param());
    if (mon && mon !== current) open(mon, false);
  });

  // --- scrollbars ---
  const listBar = body.querySelector('.bar');
  const listScroll = scroller(list, listBar);
  const panelBar = panel.querySelector(':scope > .bar');
  const panelScroll = scroller(panelView, panelBar);

  const check = panel.querySelector('.check');
  const copyChecker = () => { check.style.backgroundImage = art.style.backgroundImage; };
  new MutationObserver(copyChecker).observe(art, { attributes: true, attributeFilter: ['style'] });
  copyChecker();

  // --- layout ---
  function fit() {
    const state = window.pixelState;
    if (!state || !state.cols) return;
    const { cols, rows, sideW } = state;
    const panelLeft = Math.max(0, Math.floor((cols - PANEL) / 8) * 8 - sideW);
    panel.style.left = panelLeft + 'px';
    panel.style.width = cols - sideW - panelLeft + 'px';
    panel.style.height = rows + 'px';
    main.style.width = panelLeft + 'px';
    main.style.height = rows + 'px';
    const room = Math.max(112, panelLeft - 40);
    const width = room - 8 * pack(room, LAYOUTS.grid1).rem;
    bar.style.width = width + 16 + 'px';
    const top = bar.offsetTop + bar.offsetHeight + 16;
    heading.style.top = top + 'px';
    stats.style.left = (title.offsetWidth && title.offsetWidth + 8) + 'px';
    const listTop = top + 32;
    body.style.top = listTop - 8 + 'px';
    list.style.width = width + 16 + 'px';
    const listHeight = Math.max(64, rows - listTop + 8);
    list.style.height = listHeight + 'px';
    list.style.paddingBottom = 8 + listHeight % 8 + 'px';
    listBar.style.height = Math.max(16, listHeight - 24) + 'px';
    listWidth = width;
    if (sizeCells()) resizeCells();
    panelView.style.height = rows + 'px';
    panelBar.style.height = rows - 32 + 'px';
    panelContent.style.paddingBottom = 16 + rows % 8 + 'px';
    listScroll.sync();
    panelScroll.sync();
    layer.fit();
    window.pixelMeasure?.();
  }

  // --- toast layer ---
  const layer = make('div', { id: 'layer' });
  layer.dataset.art = '';
  document.body.append(layer);
  layer.fit = () => {
    const ratio = scale();
    const cols = parseInt(art.style.width) || innerWidth;
    const rows = Math.ceil(innerHeight / ratio);
    layer.style.transform = `scale(${ratio})`;
    layer.style.width = cols + 'px';
    layer.style.height = rows + 'px';
    layer.cols = cols;
    layer.rows = rows;
  };

  // copy failed toast
  let toastTimer, pointer = null;
  addEventListener('pointerdown', event => { pointer = [event.clientX, event.clientY]; }, true);
  addEventListener('keydown', () => { pointer = null; }, true);
  function toast(text, anchor) {
    layer.querySelector('.toast')?.remove();
    const ratio = scale();
    let middle = layer.cols / 2, top = layer.rows - 16, bottom = top;
    if (pointer) [middle, top, bottom] = [pointer[0] / ratio, pointer[1] / ratio, pointer[1] / ratio + 9];
    else if (anchor) {
      const spot = anchor.getBoundingClientRect();
      [middle, top, bottom] = [(spot.left + spot.width / 2) / ratio, spot.top / ratio, spot.bottom / ratio];
    }
    const shape = window.siteBubble(layer, text, { x: middle, top, bottom });
    shape.classList.add('toast');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => shape.remove(), 1600);
  }

  addEventListener('resize', () => requestAnimationFrame(fit));
  addEventListener('themechange', () => requestAnimationFrame(fit));
  new ResizeObserver(() => fit()).observe(art);
  document.fonts.load('20px jersey').then(fit);
  layer.fit();
  route(true);
})();

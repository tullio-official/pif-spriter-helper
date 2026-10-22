// unsprited finder
(() => {
  const finder = window.Finder;
  const { darker, ink, oklch } = window.siteColour;
  const { scroller, scale } = window.siteScroll;
  // autogen sheets
  const SHEETS = 'https://raw.githubusercontent.com/infinitefusion/infinitefusion-e18/releases/Graphics/Battlers/spritesheets_autogen/';
  const DEX_URL = 'https://infinitefusiondex.com/details/';
  // base sprites
  const BASES = 'https://infinitefusion.net/customsprites/spritesheets/spritesheets_base/';
  // tiles per chunk
  const CHUNK = 24;
  // max loads at once
  const LOADS = 8;
  // cell cache size
  const KEPT = 1200;
  // max wait on previous tile
  const ORDER_MS = 1000;
  // side panel width
  const PANEL = 232;
  const DONE_MS = 700; // copy feedback time

  const name = id => NAMES[id - 1] || `#${id}`;
  let data, choices;

  // --- ui bits ---
  const byId = id => document.getElementById(id);
  const art = byId('art');
  const main = byId('main');
  const bar = byId('bar');
  const heading = byId('heading');
  const title = byId('title');
  const stats = byId('stats');
  const tools = byId('tools');
  const listArea = byId('body');
  const list = byId('list');
  const panel = byId('panel');
  const panelView = byId('pview');
  const panelContent = byId('pcontent');
  const filtersButton = byId('filters-btn');
  const shuffleButton = byId('shuffle');

  function make(tag, props, ...kids) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids.filter(kid => kid !== false && kid != null));
    return node;
  }
  function textbox(skin = 'dark', extra) {
    const box = make('div', { className: 'textbox' + (extra ? ' ' + extra : '') });
    box.dataset.skin = skin;
    box.dataset.slice = '7';
    return box;
  }
  const icon = name => make('img', { src: `../assets/icons/${name}.png`, width: 16, height: 16, alt: '' });
  function tinted(name) {
    const mark = make('i', { className: 'tint' });
    mark.style.maskImage = `url(../assets/icons/${name}.png)`;
    return mark;
  }
  const format = count => count.toLocaleString('en-US');
  const plural = (count, word) => `${format(count)} ${word}${count === 1 ? '' : 's'}`;
  const capital = text => text[0].toUpperCase() + text.slice(1);
  const textWidth = text => Math.ceil((text.length * 6 + 16) / 8) * 8;
  const isPicked = button => button.getAttribute('aria-pressed') === 'true';
  const setPicked = (button, on) => button.setAttribute('aria-pressed', String(!!on));
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
    const well = make('div', { className: 'pwell' }, textbox('dark-pressed'), make('img', { src: '../assets/icons/silhouette.png', width: 96, height: 96, alt: '' }),
      credit('.rayzard', 96, 0));
    well.dataset.box = '';
    return make('div', { className: 'msg art' }, well, make('p', { textContent: text }));
  }
  // tab memory
  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch (error) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch (error) {} },
  };

  function iconButton(name, tip) {
    const button = make('button', { type: 'button', className: 'ibtn', title: tip }, textbox('dark'), textbox('dark-pressed'), icon(name));
    button.setAttribute('aria-label', tip);
    button.dataset.box = '';
    return button;
  }
  function textButton(text, tip, width) {
    const button = make('button', { type: 'button', className: 'tbtn', title: tip || '' },
      textbox('dark'), textbox('dark-pressed'), make('span', { textContent: text }));
    button.style.width = (width || textWidth(text)) + 'px';
    button.dataset.box = '';
    return button;
  }

  function toggle(value, text, tip, image) {
    const button = make('button', { type: 'button', className: 'tog', value },
      textbox('dark'), textbox('dark-pressed'), textbox('sunny'), text ? make('span', { textContent: text }) : tinted(image));
    button.dataset.label = text || tip;
    if (tip) {
      button.title = tip;
      if (!text) button.setAttribute('aria-label', tip);
    }
    setPicked(button, false);
    button.dataset.box = '';
    button.addEventListener('click', () => setPicked(button, !isPicked(button)));
    return button;
  }

  function segmented(options, single) {
    const buttons = options.map(option => {
      const button = make('button', { type: 'button', value: option.key, title: option.title || '' },
        textbox('sunny'), make('span', { textContent: option.text }));
      button.dataset.label = option.text;
      button.style.width = (option.width || textWidth(option.text)) + 'px';
      setPicked(button, false);
      button.addEventListener('click', () => {
        if (button.disabled) return;
        if (single) {
          const was = isPicked(button);
          buttons.forEach(other => setPicked(other, other === button && !was));
        } else setPicked(button, !isPicked(button));
      });
      return button;
    });
    const box = make('div', { className: 'seg' }, textbox('dark-pressed'), ...buttons);
    box.dataset.box = '';
    return { box, buttons };
  }

  function caret(input) {
    const mark = make('div', { className: 'caret' });
    input.parentElement.append(mark);
    const context = document.createElement('canvas').getContext('2d');
    function draw() {
      const show = document.activeElement === input && input.selectionStart === input.selectionEnd;
      mark.classList.remove('on');
      if (!show) return;
      const padding = parseInt(getComputedStyle(input).paddingLeft);
      context.font = getComputedStyle(input).font;
      const width = Math.round(context.measureText(input.value.slice(0, input.selectionStart)).width);
      mark.style.left = (padding - 1 + width - input.scrollLeft) + 'px';
      void mark.offsetWidth; // restart blink
      mark.classList.add('on');
    }
    ['focus', 'blur', 'input', 'scroll'].forEach(type => input.addEventListener(type, draw));
    document.addEventListener('selectionchange', draw);
    document.fonts.ready.then(draw);
  }

  // --- pokémon search ---
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
  const MONS = NAMES.map((full, index) => {
    const parts = loose(full);
    return { name: full, dex: index + 1, low: fold(full), slug: parts.key, spots: parts.spots };
  });
  const byName = (first, second) => first.name.localeCompare(second.name);
  function findMons(query) {
    const text = fold(query.trim());
    if (!text) return [];
    const number = text.replace(/^#/, '');
    if (/^\d+$/.test(number)) {
      const exact = MONS.filter(mon => mon.dex === +number);
      const starts = MONS.filter(mon => mon.dex !== +number && (String(mon.dex).startsWith(number) || padded(mon.dex).startsWith(number)));
      return [...exact, ...starts].slice(0, 8).map(mon => ({ mon, at: -1, length: 0 }));
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
    return found.slice(0, 8);
  }
  function lookup(param) {
    if (!param) return null;
    const text = param.replace(/^#/, '');
    if (/^\d+$/.test(text)) return MONS[+text - 1] || null;
    return MONS.find(mon => mon.slug === slug(text)) || null;
  }

  let pick = null; // searched pokémon
  let pickSide = 'all';
  function searchBox() {
    const input = make('input', { id: 'pick', autocomplete: 'off', spellcheck: false, placeholder: 'Select a Pokémon' });
    const drop = make('div', { id: 'drop', hidden: true });
    drop.dataset.box = '';
    const field = make('div', { className: 'field', id: 'search' }, textbox('dark-pressed'), make('i', { className: 'glass' }), input, drop);
    field.dataset.box = '';
    let typed = '', items = [], lit = -1;
    const label = ({ mon, at, length }) => {
      const full = mon.name;
      if (at < 0) return [make('span', { className: 'muted', textContent: full })];
      return [at > 0 ? make('span', { className: 'muted', textContent: full.slice(0, at) }) : '', full.slice(at, at + length),
        at + length < full.length ? make('span', { className: 'muted', textContent: full.slice(at + length) }) : ''];
    };
    const close = () => {
      drop.hidden = true;
      lit = -1;
    };
    const show = () => {
      if (!typed.trim()) return close();
      drop.replaceChildren(textbox());
      if (!items.length) drop.append(make('div', { className: 'opt none muted', textContent: 'No Pokémon found' }));
      items.forEach((item, index) => {
        const row = make('div', { className: 'opt' + (index === lit ? ' on' : '') },
          make('span', {}, ...label(item)), make('span', { className: 'muted', textContent: '#' + padded(item.mon.dex) }));
        row.addEventListener('mousedown', event => event.preventDefault());
        row.addEventListener('click', () => choose(item.mon));
        drop.append(row);
      });
      drop.hidden = false;
    };
    const put = value => {
      input.value = value;
      input.setSelectionRange(value.length, value.length);
    };
    const choose = mon => {
      close();
      put(mon ? mon.name : '');
      typed = mon ? mon.name : '';
      setPick(mon, pickSide);
    };
    input.addEventListener('input', () => {
      typed = input.value;
      items = findMons(typed);
      lit = -1;
      show();
      if (!typed.trim() && pick) setPick(null, pickSide);
    });
    input.addEventListener('focus', () => { if (pick && input.value === name(pick.id)) input.select(); });
    input.addEventListener('blur', () => {
      close();
      put(pick ? name(pick.id) : '');
      typed = input.value;
    });
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
        if (drop.hidden) return input.blur();
        event.preventDefault();
        put(typed);
        close();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (drop.hidden) {
          typed = input.value;
          items = findMons(typed);
        }
        if (!items.length) return;
        choose((lit >= 0 ? items[lit] : items[0]).mon);
        input.select();
      }
    });
    // / to search
    addEventListener('keydown', event => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select')) return;
      event.preventDefault();
      input.focus();
      input.select();
    });
    caret(input);
    return { field, show: mon => put(mon ? mon.name : '') };
  }

  // top bar
  const search = searchBox();
  const sides = segmented([
    { key: 'head', text: 'Head', title: 'As the head' },
    { key: 'body', text: 'Body', title: 'As the body' },
  ]);
  sides.buttons.forEach(button => button.addEventListener('click', () => {
    if (!pick) return;
    const [head, body] = sides.buttons.map(isPicked);
    if (!head && !body) setPicked(button, true);
    pickSide = head && body ? 'all' : head ? 'head' : !head && !body ? button.value : 'body';
    setPick(MONS[pick.id - 1], pickSide);
  }));
  bar.append(search.field, sides.box);
  function drawSides() {
    sides.box.classList.toggle('off', !pick);
    sides.buttons.forEach(button => {
      button.disabled = !pick;
      setPicked(button, !!pick && (pickSide === 'all' || button.value === pickSide));
    });
  }
  drawSides();
  function setPick(mon, side) {
    pickSide = side;
    pick = mon ? { id: mon.dex, side } : null;
    drawSides();
    changed();
  }

  function onOffRow(label, tip) {
    const value = make('span', { className: 'gsum', textContent: 'Off' });
    const button = make('button', { type: 'button', className: 'grp onoff', title: tip || '' },
      make('span', { className: 'glab', textContent: label }), value, make('i', { className: 'box' }));
    button.dataset.box = '';
    button.set = on => {
      setPicked(button, on);
      button.classList.toggle('on', on);
      value.textContent = on ? 'On' : 'Off';
    };
    button.set(false);
    button.addEventListener('click', () => button.set(!isPicked(button)));
    return button;
  }

  // --- side filters ---
  const LEGEND = { only: ['Only', 'Only legendary and mythical'], hide: ['Exclude', 'No legendary or mythical'] };
  function column() {
    const types = choices.type.map(type => toggle(type, capital(String(type).toLowerCase())));
    const sizes = segmented(choices.size.map(key => ({ key, text: key, width: 24, title: finder.SIZES[key] })));
    const regions = choices.region.map(region => toggle(region, region));
    const colours = choices.color.map(colour => toggle(colour, String(colour) === 'Gray' ? 'Grey' : String(colour)));
    const shapes = choices.shape.map(shape => toggle(shape, '', capital(finder.shapeName(shape)), 'shape-' + String(shape).toLowerCase()));
    const stages = segmented(choices.stage.map(key => ({ key, text: capital(key), width: key.length * 6 + 12, title: finder.STAGES[key] })));
    const legends = segmented(choices.legend.map(key => ({ key, text: LEGEND[key][0], title: LEGEND[key][1] })), true);
    const groups = { type: types, size: sizes.buttons, region: regions, color: colours, shape: shapes, stage: stages.buttons, legend: legends.buttons };
    const grid = (extra, kids) => make('div', { className: 'grid' + (extra ? ' ' + extra : '') }, ...kids);

    // filter rows
    const rows = [];
    const row = (key, text, ...kids) => {
      const summary = make('span', { className: 'gsum' });
      const button = make('button', { type: 'button', className: 'grp' },
        make('span', { className: 'glab', textContent: text }), summary, make('i', { className: 'arrow' }));
      button.setAttribute('aria-expanded', 'false');
      button.dataset.box = '';
      const box = make('div', { className: 'fopts', hidden: true }, ...kids);
      button.addEventListener('click', () => {
        box.hidden = !box.hidden;
        button.setAttribute('aria-expanded', String(!box.hidden));
        panelScroll.sync();
      });
      rows.push({ button, box, draw() {
        const picks = groups[key].filter(isPicked).map(option => option.dataset.label);
        summary.textContent = picks.length ? picks.join(', ') : 'Any';
        button.classList.toggle('on', picks.length > 0);
      } });
    };
    row('type', 'Type', grid('', types));
    row('size', 'Size', sizes.box);
    row('region', 'Region', grid('', regions));
    row('color', 'Colour', grid('', colours));
    row('shape', 'Body shape', grid('icons', shapes));
    row('stage', 'Evolution', stages.box);
    row('legend', 'Legendary', legends.box);
    const least = onOffRow('Least sprited', `Pokémon in ${format(data.cutoff)} or fewer sprited fusions, so the bottom 10%`);
    const draw = () => rows.forEach(entry => entry.draw());
    const section = make('section', { className: 'side' },
      make('div', { className: 'groups' }, textbox('dark-pressed'), ...rows.flatMap(entry => [entry.button, entry.box]), least));
    section.addEventListener('click', () => requestAnimationFrame(draw));

    const side = {
      section,
      get state() {
        const on = {}, picked = {};
        for (const key in groups) {
          picked[key] = groups[key].filter(isPicked).map(option => option.value);
          on[key] = picked[key].length > 0;
        }
        on.under = isPicked(least);
        return { on, picked, mons: [] };
      },
      set state(state) {
        for (const key in groups) groups[key].forEach(option => setPicked(option, !!state.on[key] && (state.picked[key] || []).includes(option.value)));
        least.set(!!state.on.under);
        draw();
      },
      count() {
        return Object.values(side.state.on).filter(Boolean).length;
      },
    };
    side.state = finder.blank();
    return side;
  }

  // --- filters ---
  let headSide, bodySide, lineToggle, reversesToggle, tabs, filtersRoot, sideShown = 'head';
  function buildFilters() {
    lineToggle = onOffRow('Same evolution line');
    reversesToggle = onOffRow('Include reverses', 'Head and body swapped, like the DNA Reverser');
    headSide = column();
    bodySide = column();
    const swap = iconButton('swap', 'Switch head and body filters');
    swap.addEventListener('click', () => {
      [headSide.state, bodySide.state] = [bodySide.state, headSide.state];
      drawTabs();
    });
    tabs = segmented([{ key: 'head', text: 'Head' }, { key: 'body', text: 'Body' }]);
    tabs.buttons.forEach(button => button.addEventListener('click', () => {
      sideShown = button.value;
      drawTabs();
      panelScroll.sync();
    }));
    const reset = iconButton('reset', 'Reset filters');
    reset.classList.add('end');
    reset.addEventListener('click', () => resetFilters());
    filtersRoot = make('div', { id: 'filters' },
      make('div', { className: 'groups' }, textbox('dark-pressed'), lineToggle, reversesToggle),
      make('div', { className: 'tabs' }, tabs.box, swap, reset), headSide.section, bodySide.section);
    filtersRoot.addEventListener('click', () => requestAnimationFrame(drawTabs));
    drawTabs();
  }
  function drawTabs() {
    if (!tabs) return;
    tabs.buttons.forEach(button => {
      const count = (button.value === 'head' ? headSide : bodySide).count();
      const text = capital(button.value) + (count ? ' ' + count : '');
      button.querySelector('span').textContent = text;
      button.style.width = textWidth(text) + 'px';
      setPicked(button, button.value === sideShown);
    });
    headSide.section.hidden = sideShown !== 'head';
    bodySide.section.hidden = sideShown !== 'body';
    drawFiltersButton();
  }
  function resetFilters() {
    headSide.state = finder.blank();
    bodySide.state = finder.blank();
    lineToggle.set(false);
    reversesToggle.set(false);
    drawTabs();
    changed();
  }
  function drawFiltersButton() {
    const count = headSide ? headSide.count() + bodySide.count() + isPicked(lineToggle) + isPicked(reversesToggle) : 0;
    const text = count ? `Filters ${count}` : 'Filters';
    filtersButton.querySelector('span').textContent = text;
    filtersButton.style.width = textWidth(text) + 'px';
    setPicked(filtersButton, panelShows === 'filters');
  }

  // --- matching + shuffle ---
  let fusions = new Uint32Array(0); // matching fusion codes
  let total = 0; // match count
  let picked = null; // panel fusion
  let deck = null;
  let seed = +session.get('finder-seed') || newSeed();
  function newSeed() {
    const fresh = 1 + Math.floor(Math.random() * 4294967294);
    session.set('finder-seed', fresh);
    return fresh;
  }
  function shuffledDeck() {
    const size = (data.nb + 1) * (data.nb + 1);
    const codes = new Uint32Array(size);
    for (let code = 0; code < size; code++) codes[code] = code;
    let state = seed >>> 0;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
    for (let index = size - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      const held = codes[index];
      codes[index] = codes[other];
      codes[other] = held;
    }
    return codes;
  }
  const matchPool = () => finder.pool(data, headSide.state, bodySide.state, isPicked(lineToggle), isPicked(reversesToggle), pick);
  const encode = pair => pair[0] * (data.nb + 1) + pair[1];
  const decode = code => [Math.floor(code / (data.nb + 1)), code % (data.nb + 1)];
  function refresh(dealt) {
    if (!deck) deck = shuffledDeck();
    const pool = matchPool();
    total = pool.length;
    const matching = new Uint8Array(deck.length);
    for (const code of pool) matching[code] = 1;
    fusions = deck.filter(code => matching[code]);
    drawHeading();
    unpeek();
    rebuild();
    const keep = !dealt && picked && matching[encode(picked)];
    select(keep ? picked : fusions.length ? decode(fusions[0]) : null);
    window.pixelMeasure?.();
  }
  function shuffle() {
    if (!data) return;
    seed = newSeed();
    deck = shuffledDeck();
    refresh(true);
  }

  // --- autogens ---
  const cells = new Map(); // cell cache
  const evicted = new Set();
  // pending cells
  const asked = new Map();
  // worker fails (she tried)
  const plain = new Set();
  const workers = Array.from({ length: Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) }, () => {
    const worker = new Worker('sheets.js');
    worker.onmessage = ({ data }) => (data.type === 'cell' ? arrived(data) : failed(data.head));
    worker.onerror = () => {
      worker.dead = true;
      const heads = [...asked.keys()].map(id => +id.split('.')[0]).filter(head => workerFor(head) === worker);
      new Set(heads).forEach(failed);
    };
    return worker;
  });
  const workerFor = head => workers[head % workers.length];
  function keep(id, pixels) {
    cells.delete(id);
    cells.set(id, pixels);
    evicted.delete(id);
    if (cells.size <= KEPT) return;
    const oldest = cells.keys().next().value;
    cells.delete(oldest);
    evicted.add(oldest);
  }
  function arrived({ head, body, pixels }) {
    const id = `${head}.${body}`;
    keep(id, pixels);
    asked.get(id)?.forEach(waiter => waiter.resolve(pixels));
    asked.delete(id);
  }
  function failed(head) {
    plain.add(head);
    asked.forEach((waiters, id) => {
      if (+id.split('.')[0] !== head) return;
      waiters.forEach(waiter => waiter.reject());
      asked.delete(id);
    });
  }
  function autogen(head, body, tile = null) {
    const id = `${head}.${body}`;
    if (cells.has(id)) {
      const pixels = cells.get(id);
      keep(id, pixels);
      return Promise.resolve(pixels);
    }
    const worker = workerFor(head);
    if (plain.has(head) || worker.dead) return sheet(head);
    return new Promise((resolve, reject) => {
      if (!asked.has(id)) {
        asked.set(id, []);
        worker.postMessage({ type: 'want', url: `${SHEETS}${head}.png`, head, body, again: evicted.has(id) });
      }
      asked.get(id).push({ resolve, reject, tile });
    }).catch(() => sheet(head));
  }
  function forget(gone, wait) {
    const dropped = new Map();
    asked.forEach((waiters, id) => {
      const left = waiters.filter(waiter => !gone(waiter));
      if (left.length === waiters.length) return;
      if (left.length) return asked.set(id, left);
      asked.delete(id);
      const [head, body] = id.split('.').map(Number), worker = workerFor(head);
      if (!dropped.has(worker)) dropped.set(worker, []);
      dropped.get(worker).push([head, body]);
    });
    dropped.forEach((cells, worker) => worker.postMessage({ type: 'drop', cells, wait }));
  }
  const sheets = new Map();
  function sheet(head) {
    if (!sheets.has(head)) {
      const get = cors => new Promise((resolve, reject) => {
        const image = new Image();
        if (cors) image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = `${SHEETS}${head}.png`;
      });
      sheets.set(head, get(true).catch(() => get(false)).catch(error => {
        sheets.delete(head);
        throw error;
      }));
    }
    return sheets.get(head);
  }
  function cell(source, body) {
    const canvas = make('canvas', { width: 96, height: 96 });
    const context = canvas.getContext('2d');
    if (source instanceof Uint8ClampedArray) context.putImageData(new ImageData(source, 96, 96), 0, 0);
    else context.drawImage(source, body % 10 * 96, Math.floor(body / 10) * 96, 96, 96, 0, 0, 96, 96);
    return canvas;
  }
  function paint(box, head, body, done) {
    const id = `${head}.${body}`;
    box.dataset.id = id;
    box.querySelector(':scope > canvas')?.remove();
    autogen(head, body).then(source => {
      if (box.dataset.id !== id) return;
      box.querySelector(':scope > canvas')?.remove();
      const canvas = cell(source, body);
      box.append(canvas);
      done?.(canvas);
    }, () => {});
  }

  // --- tile loading order ---
  let waiting = [], loading = 0, lastShown = Promise.resolve(), round = 0;
  const pause = time => new Promise(resolve => setTimeout(resolve, time));
  const rank = tile => (tile.seen ? 0 : 1e9) + tile.order;
  function want(tile) {
    if (tile.round !== round || tile.state) return;
    tile.state = 'waiting';
    waiting.push(tile);
    pump();
  }
  function unwant(tile) {
    if (tile.state === 'waiting') waiting.splice(waiting.indexOf(tile), 1);
    else if (tile.state === 'loading') {
      loading--;
      tile.ticket = null;
      tile.unlink();
      forget(waiter => waiter.tile === tile, false);
      pump();
    } else return;
    tile.state = '';
  }
  function pump() {
    while (loading < LOADS && waiting.length) {
      const tile = waiting.reduce((best, other) => (rank(other) < rank(best) ? other : best));
      waiting.splice(waiting.indexOf(tile), 1);
      tile.state = 'loading';
      loading++;
      const ticket = tile.ticket = {}, since = performance.now();
      const ready = autogen(tile.head, tile.body, tile);
      const settled = () => {
        if (tile.ticket !== ticket) return;
        tile.state = 'ready';
        loading--;
        pump();
      };
      ready.then(settled, settled);
      const before = lastShown;
      let unlink;
      lastShown = new Promise(resolve => { unlink = resolve; });
      tile.unlink = unlink;
      ready.then(source => Promise.race([before, pause(since + ORDER_MS - performance.now())]).then(() => {
        if (tile.ticket === ticket) tile.show(source);
        unlink();
      }), unlink);
    }
  }
  function restartLoads() {
    round++;
    waiting = [];
    loading = 0;
    lastShown = Promise.resolve();
    forget(waiter => waiter.tile, true);
  }

  // --- band colour ---
  function accentOf(canvas) {
    let pixels;
    try {
      pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    } catch (error) {
      return null;
    }
    const counts = new Map();
    for (let at = 0; at < pixels.length; at += 4) {
      if (pixels[at + 3] < 128) continue;
      const hex = [pixels[at], pixels[at + 1], pixels[at + 2]].map(value => value.toString(16).padStart(2, '0')).join('');
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
    let best = null, most = 0;
    for (const [hex, count] of counts) {
      if (count > most && oklch(hex).chroma >= 0.06) {
        best = hex;
        most = count;
      }
    }
    return best;
  }

  // --- copying ---
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
  function confirmed(button) {
    const label = button.querySelector(':scope > span');
    if (!button.doneTimer) button.dataset.text = label.textContent;
    clearTimeout(button.doneTimer);
    label.textContent = 'Copied!';
    button.doneTimer = setTimeout(() => {
      button.doneTimer = 0;
      label.textContent = button.dataset.text;
    }, DONE_MS);
  }

  // --- grid ---
  // row packing
  const GRID = { width: 112, gap: 8 };
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
  function sizeCells() {
    const packed = pack(listWidth, GRID);
    list.style.gridTemplateColumns = `repeat(${packed.columns}, ${packed.width}px)`;
    list.style.gap = packed.gap + 'px';
    list.style.setProperty('--cell', packed.width + 'px');
  }
  let drawn = 0;
  const sentinel = make('div', { className: 'sentinel' });
  const more = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) chunk(); },
    { root: list, rootMargin: '0px 0px 200px 0px' });
  // on screen tiles
  const seen = new IntersectionObserver(entries => entries.forEach(entry => { entry.target.seen = entry.isIntersecting; }),
    { root: list });
  // lazy loading autogens
  const near = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) want(entry.target);
    else unwant(entry.target);
  }), { root: list, rootMargin: '96px 0px' });

  function rebuild() {
    more.unobserve(sentinel);
    sentinel.remove();
    seen.disconnect();
    near.disconnect();
    restartLoads();
    sizeCells();
    list.replaceChildren();
    list.scrollTop = 0;
    drawn = 0;
    if (!fusions.length) list.append(emptyList('No unsprited fusions match these filters'));
    chunk();
  }
  function chunk() {
    more.unobserve(sentinel);
    sentinel.remove();
    const next = [...fusions.subarray(drawn, drawn + CHUNK)];
    list.append(...next.map((code, index) => tile(code, drawn + index)));
    drawn += next.length;
    if (drawn < fusions.length) {
      list.append(sentinel);
      more.observe(sentinel);
    }
    listScroll.sync();
    window.pixelMeasure?.();
  }

  function band(...kids) {
    const strip = make('div', { className: 'strip' }, ...kids);
    const shade = make('div', { className: 'shade' });
    return {
      parts: [strip, shade, make('div', { className: 'divider' })],
      color(hex) {
        if (!hex) return;
        strip.style.background = '#' + hex;
        strip.classList.add(ink(hex));
        shade.style.background = '#' + darker(hex);
      },
    };
  }
  function tile(code, order) {
    const [head, body] = decode(code);
    const id = `${head}.${body}`, pair = `${name(head)}/${name(body)}`;
    const top = band(make('span', { textContent: pair }));
    const sprite = make('div', { className: 'spr' });
    const button = make('button', { type: 'button', className: 'ftile', title: pair }, textbox('dark'), textbox('dark-pressed', 'pressed'), ...top.parts, sprite,
      make('span', { className: 'fid', textContent: id }),
      brackets(), brackets('brackets-hover', 'hov'));
    const on = !!picked && picked[0] === head && picked[1] === body;
    button.classList.toggle('on', on);
    button.dataset.id = id;
    button.dataset.box = '';
    button.addEventListener('click', () => select([head, body], true));
    Object.assign(button, { head, body, order, round, seen: false, state: '', show(source) {
      button.state = 'shown';
      sprite.dataset.id = id;
      const canvas = cell(source, body);
      sprite.replaceChildren(canvas);
      top.color(accentOf(canvas));
    } });
    seen.observe(button);
    near.observe(button);
    sprite.addEventListener('mouseenter', () => peek(sprite, head, body));
    sprite.addEventListener('mouseleave', unpeek);
    return button;
  }
  function brackets(skin = 'brackets', extra = 'brk') {
    const box = textbox(skin);
    box.dataset.slice = '10';
    box.classList.add(extra);
    return box;
  }

  // --- side panel ---
  let panelShows = 'fusion';
  function select(pair, clicked) {
    picked = pair;
    session.set('finder-picked', pair ? pair.join('.') : '');
    list.querySelectorAll('.ftile.on').forEach(old => old.classList.remove('on'));
    const current = pair && list.querySelector(`.ftile[data-id="${pair[0]}.${pair[1]}"]`);
    if (current) current.classList.add('on');
    if (clicked) panelShows = 'fusion';
    renderPanel();
  }
  function panelHead(text, ...extra) {
    return make('div', { className: 'phead' }, make('h2', { className: 'x2', textContent: text }), ...extra);
  }
  const tally = (text, tip) => make('span', { className: 'total', textContent: text, title: tip });
  function renderPanel() {
    panelView.scrollTop = 0;
    drawFiltersButton();
    if (panelShows === 'filters') {
      panelContent.replaceChildren(panelHead('Filters', tally(plural(total, 'fusion'), 'Unsprited fusions that match these filters')), filtersRoot);
    } else if (!picked) {
      panelContent.replaceChildren(emptyPanel(data ? 'No fusion picked' : 'Loading sprites…'));
    } else {
      const [head, body] = picked, id = `${head}.${body}`;
      const link = make('a', { className: 'pname', href: DEX_URL + id, target: '_blank', rel: 'noopener',
        title: 'Open in Infinite Fusion Dex', textContent: `${name(head)}/${name(body)}` });
      const sprite = make('div', { className: 'spr' });
      const well = make('div', { className: 'pwell' }, textbox('dark-pressed'), sprite);
      well.dataset.box = '';
      paint(sprite, head, body);
      sprite.addEventListener('mouseenter', () => peek(sprite, head, body));
      sprite.addEventListener('mouseleave', unpeek);
      const copy = textButton('Copy ID', `For the file name, ${id}.png`, 88);
      copy.addEventListener('click', () => copyText(id).then(() => confirmed(copy), () => toast("Couldn't copy", copy)));
      const save = textButton('Save autogen', 'Download the autogen, 96×96', 88);
      save.addEventListener('click', () => saveAutogen(sprite, id, save));
      const palettes = make('a', { className: 'tbtn', href: `../palette-library/?p=${slug(name(head))}`, target: '_blank', rel: 'noopener',
        title: 'Open in Palette Library' }, textbox('dark'), textbox('dark-pressed'), make('span', { textContent: `${name(head)} palettes` }));
      palettes.style.width = '192px';
      palettes.dataset.box = '';
      panelContent.replaceChildren(panelHead(id), link, well,
        make('div', { className: 'pby', textContent: 'Autogen, no custom sprite yet' }),
        make('div', { className: 'pbtns' }, copy, save, palettes), references(head, body));
    }
    panelScroll.sync();
    window.pixelMeasure?.();
  }
  function saveAutogen(sprite, id, button) {
    const canvas = sprite.querySelector('canvas');
    if (!canvas) return;
    try {
      canvas.toBlob(blob => {
        if (!blob) return toast("Couldn't save", button);
        const link = make('a', { download: `${id}-autogen.png`, href: URL.createObjectURL(blob) });
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      });
    } catch (error) {
      toast("Couldn't save", button);
    }
  }
  function references(head, body) {
    const part = pokemon => {
      const picture = make('div', { className: 'pic' });
      const image = new Image();
      image.onload = () => {
        picture.style.backgroundImage = `url("${image.src}")`;
        picture.style.backgroundSize = `${image.naturalWidth}px ${image.naturalHeight}px`;
      };
      image.src = `${BASES}${pokemon}.png`;
      return picture;
    };
    const box = make('div', { className: 'bwell' }, part(head), part(body));
    box.dataset.box = '';
    return make('div', { className: 'bases' }, make('div', { className: 'lab', textContent: 'Head and body' }), box,
      make('div', { className: 'bnames' }, make('span', { textContent: name(head) }), make('span', { textContent: name(body) })));
  }
  filtersButton.addEventListener('click', () => {
    panelShows = panelShows === 'filters' ? 'fusion' : 'filters';
    renderPanel();
  });

  // --- heading ---
  let counted = false;
  function drawHeading() {
    const progress = pick ? finder.progress(data, pick.id, pick.side) : { sprited: data.sprited, total: data.nb * data.nb };
    title.textContent = pick ? name(pick.id) : '';
    stats.classList.remove('loading');
    stats.title = `${format(progress.sprited)} of ${format(progress.total)} fusions are sprited`;
    counted = true;
    fit();
  }
  function layoutHeading(room) {
    if (!counted) return;
    const long = plural(total, 'unsprited fusion');
    stats.replaceChildren(long.length * 6 <= room ? long : `${format(total)} unsprited`);
  }

  // --- overlay layer ---
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

  // hover zoom
  const zoom = make('div', { className: 'zoom' }, textbox('dark'));
  zoom.style.visibility = 'hidden';
  layer.append(zoom);
  function peek(box, head, body) {
    if (!matchMedia('(hover: hover)').matches) return;
    const ratio = scale(), size = 200, padding = 8, gap = 8;
    const spot = box.getBoundingClientRect(), around = (box.closest('.ftile') || box).getBoundingClientRect();
    const left = Math.round(around.left / ratio), right = Math.round(around.right / ratio);
    const middleX = Math.round((spot.left + spot.width / 2) / ratio), middleY = Math.round((spot.top + spot.height / 2) / ratio);
    const zoomLeft = left - gap - size >= padding ? left - gap - size
      : right + gap + size <= layer.cols - padding ? right + gap
        : Math.min(Math.max(middleX - size / 2, padding), layer.cols - size - padding);
    zoom.style.left = zoomLeft + 'px';
    zoom.style.top = Math.min(Math.max(middleY - size / 2, padding), layer.rows - size - padding) + 'px';
    paint(zoom, head, body);
    zoom.style.visibility = '';
  }
  function unpeek() {
    zoom.style.visibility = 'hidden';
  }
  addEventListener('scroll', unpeek, true);

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

  // --- scrollbars ---
  const listBar = listArea.querySelector('.bar');
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
    const width = room - 8 * pack(room, GRID).rem;
    bar.style.width = width + 16 + 'px';
    const top = bar.offsetTop + Math.max(24, bar.offsetHeight) + 16;
    heading.style.top = top + 'px';
    heading.style.width = width + 'px';
    const statsLeft = title.offsetWidth && title.offsetWidth + 8;
    stats.style.left = statsLeft + 'px';
    layoutHeading(width - statsLeft - tools.offsetWidth - 8);
    const listTop = top + 32;
    listArea.style.top = listTop - 8 + 'px';
    list.style.width = width + 16 + 'px';
    const listHeight = Math.max(64, rows - listTop + 8);
    list.style.height = listHeight + 'px';
    list.style.paddingBottom = 8 + listHeight % 8 + 'px';
    listBar.style.height = Math.max(16, listHeight - 24) + 'px';
    if (listWidth !== width) {
      listWidth = width;
      sizeCells();
    }
    panelView.style.height = rows + 'px';
    panelBar.style.height = rows - 32 + 'px';
    panelContent.style.paddingBottom = 16 + rows % 8 + 'px';
    listScroll.sync();
    panelScroll.sync();
    layer.fit();
    window.pixelMeasure?.();
  }

  // --- url ---
  function share() {
    const params = new URLSearchParams();
    if (pick) {
      params.set('p', slug(name(pick.id)));
      if (pick.side !== 'all') params.set('side', pick.side);
    }
    const head = finder.stringify(headSide.state, choices), body = finder.stringify(bodySide.state, choices);
    if (head) params.set('head', head);
    if (body) params.set('body', body);
    if (isPicked(lineToggle)) params.set('line', '1');
    if (isPicked(reversesToggle)) params.set('reverses', '1');
    const text = params.toString();
    try { history.replaceState(null, '', text ? '?' + text : location.pathname); } catch (error) {}
  }

  // list redraw
  let pendingChange = 0, lastKey = '';
  function changed() {
    if (!data) return;
    clearTimeout(pendingChange);
    pendingChange = setTimeout(() => {
      drawTabs();
      share();
      const key = JSON.stringify([headSide.state, bodySide.state, isPicked(lineToggle), isPicked(reversesToggle), pick]);
      if (key === lastKey) return;
      lastKey = key;
      refresh();
    }, 0);
  }
  for (const type of ['click', 'change']) panel.addEventListener(type, changed);

  // --- startup ---
  async function start() {
    fit();
    renderPanel();
    try {
      data = await finder.load(NAMES.length);
    } catch (error) {
      stats.classList.remove('loading');
      stats.textContent = /^Couldn't/.test(error.message) ? error.message : "Couldn't load the sprite list";
      panelContent.replaceChildren(emptyPanel("Couldn't load the sprite list"));
      return;
    }
    choices = finder.options(data);
    buildFilters();

    // url filters
    const params = new URLSearchParams(location.search);
    const head = params.has('head') ? finder.parse(params.get('head'), choices, data.nb) : null;
    const body = params.has('body') ? finder.parse(params.get('body'), choices, data.nb) : null;
    if (head) headSide.state = head;
    if (body) bodySide.state = body;
    if (params.get('line') === '1') lineToggle.set(true);
    if (params.get('reverses') === '1') reversesToggle.set(true);
    if (!pick) {
      let mon = lookup(params.get('p') || ''), side = ['head', 'body'].includes(params.get('side')) ? params.get('side') : 'all';
      const old = head?.on.mon && head.mons[0] ? [head.mons[0], 'head'] : body?.on.mon && body.mons[0] ? [body.mons[0], 'body'] : null;
      if (!mon && old) {
        mon = MONS[old[0] - 1];
        side = isPicked(reversesToggle) ? 'all' : old[1];
      }
      if (mon) {
        pickSide = side;
        pick = { id: mon.dex, side };
        search.show(mon);
        drawSides();
      }
    }
    // restoring picked fusion
    const was = (session.get('finder-picked') || '').split('.').map(Number);
    if (was.length === 2 && was[0] && was[1]) picked = was;

    filtersButton.disabled = false;
    shuffleButton.disabled = false;
    shuffleButton.addEventListener('click', shuffle);
    // space to shuffle
    addEventListener('keydown', event => {
      if (event.key !== ' ' || event.target.closest('input, textarea, button, a, select')) return;
      event.preventDefault();
      shuffle();
    });
    changed();
  }

  addEventListener('resize', () => requestAnimationFrame(fit));
  addEventListener('themechange', () => requestAnimationFrame(fit));
  new ResizeObserver(() => fit()).observe(art);
  document.fonts.load('20px jersey').then(fit);
  layer.fit();
  start();
})();

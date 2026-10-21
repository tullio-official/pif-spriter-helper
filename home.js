(() => {
  // daily pick
  const SEED = 42392;
  const DAY_MS = 86400000;
  // base sprites
  const SHEETS = 'https://infinitefusion.net/customsprites/spritesheets/spritesheets_base/';
  const FILES = 'https://infinitefusion.net/customsprites/Other/BaseSprites/';
  const PALETTES = 'data/palettes/';
  // side panel width
  const PANEL = 248;
  const UNDER = 64;
  // 2x sprite breakpoint
  const DOUBLE = { rows: 464, width: 576 };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const { darker, ink } = window.siteColour;
  const { scroller } = window.siteScroll;
  const byId = name => document.getElementById(name);
  const art = byId('art');
  const page = byId('page');
  const main = byId('main');
  const view = byId('view');
  const content = byId('content');
  const panel = byId('panel');
  const panelView = byId('pview');
  const cards = byId('cards');
  const daily = byId('daily');

  function make(type, props, ...kids) {
    const node = Object.assign(document.createElement(type), props);
    node.append(...kids);
    return node;
  }
  function textbox(skin) {
    const frame = make('div', { className: 'textbox' });
    frame.dataset.skin = skin;
    frame.dataset.slice = '7';
    return frame;
  }
  const format = count => count.toLocaleString('en-US');
  const folder = name => name + (location.protocol === 'file:' ? '/index.html' : '/');
  const slug = name => [...name].map(letter => letter.normalize('NFD')[0].toLowerCase())
    .map(letter => (letter === '♀' ? 'f' : letter === '♂' ? 'm' : letter)).filter(letter => /[a-z0-9]/.test(letter)).join('');
  const finderLink = name => `${folder('unsprited-finder')}?p=${slug(name)}`;

  function cut(node, text) {
    document.fonts.ready.then(() => {
      node.title = node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight + 6 ? text : '';
    });
  }

  const titleRow = byId('title-row');
  const byline = make('span', { id: 'byline', textContent: 'by tullio' });
  byline.style.visibility = 'hidden';
  titleRow.append(byline);
  const sign = () => {
    byline.style.left = titleRow.querySelector('h1').offsetWidth + 8 + 'px';
    byline.style.visibility = '';
  };
  if (document.fonts.check('40px jersey')) sign();
  else document.fonts.load('40px jersey').then(sign);

  // --- tool cards ---
  cards.append(...window.siteTools.filter(tool => tool.built).map(tool => {
    const about = make('p', { textContent: tool.about || '' });
    const card = make('a', { className: 'tool', href: folder(tool.key) }, textbox('dark'), textbox('dark-pressed'),
      make('img', { src: `assets/icons/${tool.icon}.png`, width: 24, height: 24, alt: '' }), make('h2', { textContent: tool.name }), about);
    card.dataset.box = '';
    cut(about, tool.about || '');
    return card;
  }));

  // --- what's new ---
  const dated = stamp => {
    const [year, month, date] = stamp.split('-').map(Number);
    return `${date} ${MONTHS[month - 1]} ${year}`;
  };
  byId('updates').append(...[...NEWS].sort((first, second) => second[0].localeCompare(first[0])).map(([stamp, text]) =>
    make('li', {}, make('i', { className: 'node' }), make('time', { dateTime: stamp, textContent: dated(stamp) }), make('p', { textContent: text }))));

  byId('discord').href = window.siteFeedback;

  // --- daily pick ---
  function scramble(value) {
    let mixed = (value + 0x6d2b79f5) | 0;
    mixed = Math.imul(mixed ^ (mixed >>> 15), 1 | mixed);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return (mixed ^ (mixed >>> 14)) >>> 0;
  }
  function choose(counts, today) {
    const least = [];
    for (let pokemon = 1; pokemon <= counts.nb; pokemon++) if (counts.served[pokemon] <= counts.cutoff) least.push(pokemon);
    const turn = least.filter(pokemon => scramble(SEED ^ pokemon) % 2 === today % 2);
    const rank = pokemon => scramble(scramble(SEED + today) ^ pokemon);
    return (turn.length ? turn : least).sort((first, second) => rank(first) - rank(second))[0];
  }

  // pick tile
  const parts = { name: make('span'), shade: make('div', { className: 'shade' }), sprite: make('div', { className: 'sprite' }),
    count: make('p', { className: 'count' }), credit: make('p', { className: 'credit clamp' }),
    status: make('p', { className: 'status loading', textContent: 'Loading sprites…' }) };
  parts.band = make('div', { className: 'strip' }, parts.name);
  parts.link = make('a', { className: 'pick' }, textbox('dark'), parts.band, parts.shade, make('div', { className: 'divider' }),
    parts.sprite, parts.count, parts.credit, parts.status);
  parts.link.dataset.box = '';
  daily.append(parts.link);

  function fill(pokemon, counts) {
    const name = NAMES[pokemon - 1];
    parts.status.remove();
    parts.name.textContent = name;
    parts.count.textContent = `${format(counts.served[pokemon])} of ${format(2 * counts.nb - 1)} sprited`;
    parts.link.href = finderLink(name);
    parts.link.title = 'Open in Unsprited Finder';
    byId('today-title').title = `A new one every day, from the Pokémon in ${format(counts.cutoff)} or fewer sprited fusions`;
    library(pokemon).then(data => {
      const base = data.groups.flatMap(group => group[1]).find(sprite => sprite[0] === String(pokemon));
      const artist = (base && base[1]) || 'unknown artist';
      parts.credit.textContent = `by ${artist}`;
      cut(parts.credit, artist);
      if (data.accent) {
        parts.band.style.background = '#' + data.accent;
        parts.band.classList.add(ink(data.accent));
        parts.shade.style.background = '#' + darker(data.accent);
      }
      draw(parts.sprite, pokemon, !!(base && base[2]));
    }, () => draw(parts.sprite, pokemon, false));
  }

  // palette library data
  const asked = {};
  window.palettes = data => asked[data.id]?.(data);
  function library(pokemon) {
    return new Promise((resolve, reject) => {
      asked[pokemon] = resolve;
      const script = make('script', { src: `${PALETTES}${pokemon}.js` });
      script.onerror = () => {
        script.remove();
        reject();
      };
      document.body.append(script);
    });
  }

  function draw(frame, pokemon, loose) {
    const image = new Image();
    image.onload = () => {
      const canvas = make('canvas', { width: 96, height: 96 });
      const context = canvas.getContext('2d');
      if (loose) {
        const step = Math.max(1, Math.round(image.width / 96));
        for (let down = 0; down < 96; down++) {
          for (let across = 0; across < 96; across++) context.drawImage(image, across * step, down * step, 1, 1, across, down, 1, 1);
        }
      } else context.drawImage(image, 0, 0, 96, 96, 0, 0, 96, 96);
      frame.replaceChildren(canvas);
    };
    if (!loose) image.onerror = () => draw(frame, pokemon, true);
    image.src = `${loose ? FILES : SHEETS}${pokemon}.png`;
  }

  // --- bottom band ---
  const band = make('div', { id: 'band', hidden: true });
  const sofar = make('div', { id: 'sofar' }, make('div', { className: 'line' }, make('span', { className: 'lab', textContent: 'Sprited so far' }), make('span', { className: 'num' })),
    make('canvas', { width: 336, height: 8 }));
  sofar.dataset.box = '';
  const leastRow = make('div', { id: 'leastrow' }, make('span', { className: 'lab', textContent: 'Least sprited' }));
  band.append(sofar, leastRow);
  byId('columns').after(band);
  let counted = null, leastIds = [];
  function drawSofar() {
    if (!counted) return;
    const total = counted.nb * counted.nb, share = counted.sprited / total;
    sofar.querySelector('.num').textContent = `${format(counted.sprited)} of ${format(total)} fusions, ${(share * 100).toFixed(1)}%`;
    const canvas = sofar.querySelector('canvas'), width = content.clientWidth - 40;
    canvas.width = width;
    const context = canvas.getContext('2d'), dark = document.documentElement.dataset.theme === 'dark';
    context.fillStyle = dark ? '#3a3450' : '#121b26';
    context.fillRect(0, 0, width, 8);
    context.fillStyle = dark ? '#17141f' : '#f6f2ee';
    context.fillRect(1, 1, width - 2, 6);
    context.fillStyle = '#f6cf42';
    context.fillRect(1, 1, Math.max(1, Math.round((width - 2) * share)), 6);
  }
  function drawLeast() {
    if (!counted) return;
    let room = content.clientWidth - 40 - 13 * 6 - 8;
    const chips = [];
    for (const pokemon of leastIds) {
      const name = NAMES[pokemon - 1], count = format(counted.served[pokemon]);
      const width = Math.ceil(((name + ' ' + count).length * 6 + 16) / 8) * 8;
      if (width > room) break;
      room -= width + 8;
      const chip = make('a', { className: 'chip', href: finderLink(name), title: `${name}, ${count} sprited fusions` },
        textbox('dark'), textbox('dark-pressed'), make('span', {}, name + ' ', make('i', { textContent: count })));
      chip.style.width = width + 'px';
      chip.dataset.box = '';
      chips.push(chip);
    }
    leastRow.replaceChildren(leastRow.firstChild, ...chips);
  }

  // --- scrollbars ---
  const mainBar = main.querySelector(':scope > .bar');
  const mainScroll = scroller(view, mainBar);
  const panelBar = panel.querySelector(':scope > .bar');
  const panelScroll = scroller(panelView, panelBar);

  const check = panel.querySelector('.check');
  const copyChecker = () => { check.style.backgroundImage = art.style.backgroundImage; };
  new MutationObserver(copyChecker).observe(art, { attributes: true, attributeFilter: ['style'] });
  copyChecker();

  // --- layout (just.. it works. that's all.) ---
  function fit() {
    const state = window.pixelState;
    if (!state || !state.cols) return;
    const { cols, rows, sideW } = state;
    const panelLeft = Math.max(0, Math.floor((cols - PANEL) / 8) * 8 - sideW);
    const bottom = 16 + rows % 8;
    panel.style.left = panelLeft + 'px';
    panel.style.width = cols - sideW - panelLeft + 'px';
    panel.style.setProperty('--inset', Math.floor((cols - sideW - panelLeft - 208) / 2) + 'px');
    panel.style.height = rows + 'px';
    main.style.width = panelLeft + 'px';
    main.style.height = rows + 'px';
    page.style.setProperty('--bottom', bottom + 'px');
    const double = rows - rows % 8 >= DOUBLE.rows && panelLeft - 40 >= DOUBLE.width;
    page.classList.toggle('double', double);
    // card packing
    const room = panelLeft - 40 - (double ? 216 : 184) - 24;
    const count = cards.children.length;
    const columns = Math.max(1, Math.min(count, Math.floor((room + 8) / 344)));
    const last = count % columns || columns;
    [...cards.children].forEach((card, index) => {
      const share = index >= count - last ? last : columns;
      card.style.width = (336 + Math.floor((room - share * 336 - (share - 1) * 8) / 8 / share) * 8) + 'px';
    });
    // compact cards
    const lines = Math.ceil(count / columns), top = 128, limit = rows - bottom - 48;
    const stack = height => lines * height + (lines - 1) * (count > 2 || height === 48 ? 8 : 16);
    const compact = top + stack(80) > limit;
    page.classList.toggle('compact', compact);
    const under = top + Math.max(stack(compact ? 48 : 80), double ? 272 : 176);
    band.hidden = !counted || under + 16 + 24 + 16 + 24 > limit;
    view.style.width = panelLeft + 'px';
    view.style.height = rows - UNDER + 'px';
    content.style.minHeight = rows - UNDER + 'px';
    if (!band.hidden) {
      drawSofar();
      drawLeast();
    }
    mainBar.style.left = panelLeft - 16 + 'px';
    mainBar.style.top = UNDER + 'px';
    mainBar.style.height = rows - UNDER - bottom + 'px';
    // updates height
    const updates = rows - bottom - 110 - 16;
    panelView.style.height = updates + 'px';
    panelBar.style.height = updates - 32 + 'px';
    mainScroll.sync();
    panelScroll.sync();
    window.pixelMeasure?.();
  }

  addEventListener('resize', () => requestAnimationFrame(fit));
  addEventListener('themechange', () => requestAnimationFrame(fit));
  new ResizeObserver(() => fit()).observe(art);
  fit();

  window.counts = counts => {
    counted = counts;
    fill(choose(counts, Math.floor(Date.now() / DAY_MS)), counts);
    leastIds = [];
    for (let pokemon = 1; pokemon <= counts.nb; pokemon++) leastIds.push(pokemon);
    leastIds.sort((first, second) => counts.served[first] - counts.served[second] || first - second);
    leastIds = leastIds.slice(0, 12);
    fit();
  };
  const script = make('script', { src: 'data/counts.js' });
  script.onerror = () => {
    script.remove();
    parts.status.classList.remove('loading');
    parts.status.textContent = "Couldn't load the sprite list";
  };
  document.body.append(script);
})();

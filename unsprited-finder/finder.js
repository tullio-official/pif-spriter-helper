// unsprited finder data + matching
(root => {
  // sprited fusions list
  const LIST_URLS = [
    'https://raw.githubusercontent.com/infinitefusion/pif-downloadables/refs/heads/master/CUSTOM_SPRITES',
    'https://raw.githubusercontent.com/infinitefusion/infinitefusion-e18/main/Data/sprites/CUSTOM_SPRITES',
  ];
  // pokémon count and species data files
  const GAME_RAW = 'https://raw.githubusercontent.com/infinitefusion/infinitefusion-e18/releases/';
  const GAME = GAME_RAW + 'Data/';
  const SETTINGS_URL = GAME + 'Scripts/001_Settings.rb';
  const SPECIES_URL = GAME + 'species.dat';
  const KEY_URL = GAME + 'Scripts/001_Technical/000_Encryption.rb';
  // sprite filename
  const SPRITE = /^(\d+)\.(\d+)[a-z]*\.png$/;

  // national dex numbers
  const DEX = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
    61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
    81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
    101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
    121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140,
    141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160,
    161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180,
    181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200,
    201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220,
    221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240,
    241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 298, 360, 424, 429, 430, 438, 439, 440, 446,
    458, 461, 462, 463, 464, 465, 466, 467, 468, 469, 470, 471, 472, 473, 474, 252, 253, 254, 255, 256,
    257, 258, 259, 260, 280, 281, 282, 475, 292, 352, 374, 375, 376, 399, 442, 448, 443, 444, 445, 303,
    345, 346, 347, 348, 408, 409, 410, 411, 289, 359, 355, 356, 477, 321, 493, 387, 388, 389, 390, 391,
    392, 393, 394, 395, 299, 476, 679, 680, 681, 624, 625, 405, 306, 330, 350, 373, 601, 571, 700, 382,
    383, 384, 483, 484, 487, 486, 491, 649, 643, 644, 646, 407, 426, 428, 286, 291, 354, 479, 579, 547,
    553, 563, 596, 598, 607, 608, 609, 612, 623, 771, 707, 663, 778, 637, 633, 634, 635, 380, 381, 386,
    385, 290, 400, 447, 287, 288, 320, 403, 404, 304, 305, 328, 329, 349, 371, 372, 599, 600, 570, 406,
    315, 425, 427, 285, 353, 577, 578, 546, 551, 552, 562, 595, 597, 610, 611, 622, 661, 662, 636, 618,
    302, 543, 544, 545, 696, 697, 361, 362, 478, 741, 741, 741, 741, 568, 569, 318, 319, 708, 709, 714,
    715, 333, 334, 704, 705, 706, 377, 378, 379, 800, 759, 760, 781, 747, 748, 701, 331, 332, 769, 770,
    698, 699, 744, 745, 745, 648, 648, 488, 779, 800, 782, 783, 784, 767, 768, 753, 754, 703, 650, 651,
    652, 653, 654, 655, 656, 657, 658, 324, 710, 711, 684, 685, 559, 560, 270, 271, 272, 774, 774, 719,
    370, 261, 262, 263, 264, 265, 266, 267, 268, 269, 273, 274, 275, 276, 277, 278, 279, 283, 284, 293,
    294, 295, 296, 297, 300, 301, 307, 308, 309, 310, 311, 312, 313, 314, 316, 317, 322, 323, 325, 326,
    327, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 351, 351, 351, 351, 357, 433, 358, 363, 364,
    365, 366, 367, 368, 369, 527, 528, 602, 603, 604, 690, 691, 422, 423, 422, 423,
  ];
  // legendaries and mythicals
  const LEGENDS = [
    144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385,
    386, 483, 484, 486, 487, 488, 491, 493, 643, 644, 646, 648, 649, 719, 800,
  ];
  // last national dex number per region
  const REGIONS = { Kanto: 151, Johto: 251, Hoenn: 386, Sinnoh: 493, Unova: 649, Kalos: 721, Alola: 809 };
  // height buckets
  const SIZES = { XS: 'Under 0.5 m', S: '0.5 to 1 m', M: '1 to 1.5 m', L: '1.5 to 2 m', XL: 'Over 2 m' };
  // shape names
  const SHAPES = {
    Head: 'head only', Serpentine: 'serpentine', Finned: 'finned', HeadArms: 'head and arms', HeadBase: 'head and base',
    BipedalTail: 'bipedal with tail', HeadLegs: 'head and legs', Quadruped: 'quadruped', Winged: 'winged',
    Multiped: 'tentacles or many legs', MultiBody: 'multiple bodies', Bipedal: 'bipedal, no tail',
    MultiWinged: 'multiple wings', Insectoid: 'insectoid',
  };
  const STAGES = { base: 'First of its line', middle: 'Middle of its line', final: 'Last of its line', single: "Doesn't evolve" };
  // type + colour order
  const TYPES = ['NORMAL', 'FIGHTING', 'FLYING', 'POISON', 'GROUND', 'ROCK', 'BUG', 'GHOST', 'STEEL', 'FIRE', 'WATER',
    'GRASS', 'ELECTRIC', 'PSYCHIC', 'ICE', 'DRAGON', 'DARK', 'FAIRY'];
  const COLORS = ['Red', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'Brown', 'Black', 'Gray', 'White'];
  // filter order
  const KEYS = ['mon', 'type', 'size', 'region', 'color', 'shape', 'stage', 'legend', 'under'];

  async function get(url, bytes) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`got ${response.status} from ${url}`);
    return bytes ? new Uint8Array(await response.arrayBuffer()) : response.text();
  }

  async function spriteList() {
    for (const url of LIST_URLS) {
      try {
        return (await get(url)).split(/\s+/);
      } catch (error) {}
    }
    throw new Error("Couldn't load the sprite list");
  }

  async function pokemonCount(fallback) {
    try {
      const match = (await get(SETTINGS_URL)).match(/NB_POKEMON\s*=\s*(\d+)\s*$/m);
      if (match) return +match[1];
    } catch (error) {}
    return fallback;
  }

  function marshal(bytes) {
    let at = 2;
    const symbols = [], objects = [], text = new TextDecoder();
    const long = () => {
      const code = (bytes[at++] << 24) >> 24;
      if (code === 0) return 0;
      if (code > 4) return code - 5;
      if (code < -4) return code + 5;
      let value = 0;
      for (let index = 0; index < Math.abs(code); index++) value += bytes[at++] * 2 ** (8 * index);
      return code < 0 ? value - 2 ** (-8 * code) : value;
    };
    const string = () => {
      const length = long();
      at += length;
      return text.decode(bytes.subarray(at - length, at));
    };
    const object = value => {
      objects.push(value);
      return value;
    };
    const read = () => {
      const type = String.fromCharCode(bytes[at++]);
      switch (type) {
        case '0': return null;
        case 'T': return true;
        case 'F': return false;
        case 'i': return long();
        case ':': {
          const symbol = string();
          symbols.push(symbol);
          return symbol;
        }
        case ';': return symbols[long()];
        case '@': return objects[long()];
        case '"': return object(string());
        case 'f': return object(parseFloat(string()));
        case 'I': {
          const value = read();
          for (let count = long(); count > 0; count--) {
            read();
            read();
          }
          return value;
        }
        case '[': {
          const array = object([]);
          for (let count = long(); count > 0; count--) array.push(read());
          return array;
        }
        case '{':
        case '}': {
          const hash = object(new Map());
          for (let count = long(); count > 0; count--) {
            const key = read();
            hash.set(key, read());
          }
          if (type === '}') read();
          return hash;
        }
        case 'o': {
          const instance = object({});
          read();
          for (let count = long(); count > 0; count--) {
            const key = read();
            instance[key] = read();
          }
          return instance;
        }
      }
      throw new Error(`don't know how to read "${type}" in species.dat (byte ${at - 1})`);
    };
    return read();
  }

  async function species() {
    const bytes = await get(SPECIES_URL, true);
    if (bytes[0] !== 4 || bytes[1] !== 8) {
      const source = await get(KEY_URL);
      const key = source.match(/ENCRYPTION_KEY\s*=\s*\[([^\]]*)\]/)?.[1].match(/0x[0-9a-f]+/gi);
      if (!key) throw new Error("can't find the key for species.dat");
      for (let index = 0; index < bytes.length; index++) bytes[index] ^= Number(key[index % key.length]);
    }
    return marshal(bytes);
  }

  function build(list, count, data) {
    const nb = count;
    // sprited lookup
    const done = new Uint8Array((nb + 1) * (nb + 1));
    const served = new Uint32Array(nb + 1);
    let sprited = 0;
    for (const file of list) {
      const match = SPRITE.exec(file);
      if (!match) continue;
      const head = +match[1], body = +match[2];
      if (head <= nb && body <= nb && !done[head * (nb + 1) + body]) {
        done[head * (nb + 1) + body] = 1;
        sprited++;
        served[head]++;
        if (body !== head) served[body]++;
      }
    }
    // least sprited cutoff (bottom 10%)
    const cutoff = served.slice(1).sort()[Math.ceil(nb / 10) - 1];
    const types = [];
    const height = [];
    const color = [];
    const shape = [];
    const region = [];
    const stage = [];
    const legend = [];
    const family = [];
    const prev = new Uint8Array(nb + 1), next = new Uint8Array(nb + 1), seen = new Map();
    const root = pokemon => family[pokemon] === pokemon ? pokemon : (family[pokemon] = root(family[pokemon]));
    const join = (one, other) => {
      family[root(one)] = root(other);
    };
    for (let pokemon = 1; pokemon <= nb; pokemon++) {
      family[pokemon] = pokemon;
      const dex = DEX[pokemon - 1];
      region[pokemon] = Object.keys(REGIONS).find(name => dex <= REGIONS[name]) || '';
      legend[pokemon] = LEGENDS.includes(dex);
      // forms sharing a dex number = same family
      if (dex) {
        if (seen.has(dex)) join(pokemon, seen.get(dex));
        else seen.set(dex, pokemon);
      }
    }
    for (let pokemon = 1; pokemon <= nb; pokemon++) {
      const entry = data.get(pokemon);
      if (!entry) {
        types[pokemon] = [];
        continue;
      }
      const first = entry['@type1'], second = entry['@type2'];
      types[pokemon] = second && second !== first ? [first, second] : [first];
      height[pokemon] = entry['@height'] / 10;
      color[pokemon] = entry['@color'];
      shape[pokemon] = entry['@shape'];
      for (const [to, , , back] of entry['@evolutions'] || []) {
        const other = data.get(to)?.['@id_number'];
        if (!(other >= 1 && other <= nb)) continue;
        // back = pre-evolution entry
        if (back) {
          prev[pokemon] = next[other] = 1;
        } else {
          next[pokemon] = prev[other] = 1;
        }
        join(pokemon, other);
      }
    }
    for (let pokemon = 1; pokemon <= nb; pokemon++) {
      family[pokemon] = root(pokemon);
      stage[pokemon] = !data.get(pokemon) ? [] : !prev[pokemon] && !next[pokemon] ? ['single']
        : [prev[pokemon] ? '' : 'base', prev[pokemon] && next[pokemon] ? 'middle' : '', next[pokemon] ? '' : 'final'].filter(Boolean);
    }
    return { nb, done, served, cutoff, sprited, types, height, color, shape, region, stage, legend, family };
  }

  async function load(fallback) {
    const [list, count, data] = await Promise.all([
      spriteList(),
      pokemonCount(fallback),
      species().catch(() => { throw new Error("Couldn't load the game data"); }),
    ]);
    return build(list, count, data);
  }

  async function loadCounts(fallback) {
    const [list, count] = await Promise.all([spriteList(), pokemonCount(fallback)]);
    return build(list, count, new Map());
  }

  const shapeName = shape => SHAPES[shape] || shape.replace(/\B[A-Z]/g, letter => ' ' + letter).toLowerCase();

  function size(db, pokemon) {
    const height = db.height[pokemon];
    if (!(height >= 0)) return '';
    if (height < 0.5) return 'XS';
    if (height < 1) return 'S';
    if (height < 1.5) return 'M';
    if (height <= 2) return 'L';
    return 'XL';
  }

  function options(db) {
    const rank = (order, value) => (order.indexOf(String(value)) + 99) % 99;
    const values = list => [...new Set(list.filter(Boolean))];
    const shapes = Object.keys(SHAPES);
    return {
      type: [...new Set(db.types.flat())].sort().sort((one, other) => rank(TYPES, String(one).toUpperCase()) - rank(TYPES, String(other).toUpperCase())),
      size: Object.keys(SIZES),
      region: Object.keys(REGIONS),
      color: values(db.color).sort().sort((one, other) => rank(COLORS, one) - rank(COLORS, other)),
      shape: values(db.shape).sort((one, other) => shapeName(one).localeCompare(shapeName(other))).sort((one, other) => rank(shapes, one) - rank(shapes, other)),
      stage: Object.keys(STAGES),
      legend: ['only', 'hide'],
    };
  }

  const blank = () => ({ on: {}, picked: { legend: ['only'] }, mons: [] });

  function stringify(side, opts) {
    return KEYS.filter(key => side.on[key]).map(key =>
      [key, ...(key === 'mon' ? side.mons : (opts[key] || []).filter(value => (side.picked[key] || []).includes(value)).map(value => String(value).toLowerCase()))].join('.')).join('_');
  }
  function parse(text, opts, nb) {
    const side = blank();
    for (const part of text.split('_')) {
      const [key, ...values] = part.split('.');
      if (!KEYS.includes(key)) continue;
      side.on[key] = true;
      if (key === 'mon') values.map(Number).filter(pokemon => pokemon >= 1 && pokemon <= nb).forEach(pokemon => side.mons.includes(pokemon) || side.mons.push(pokemon));
      else if (opts[key] && values.length) side.picked[key] = opts[key].filter(value => values.includes(String(value).toLowerCase()));
    }
    return side;
  }

  function fits(db, side) {
    const { nb, types, region, color, shape, stage, legend, served, cutoff } = db;
    const ticked = key => (side.on[key] ? side.picked[key] || [] : []);
    const wantedTypes = ticked('type'), wantedSizes = ticked('size'), wantedRegions = ticked('region'), wantedColors = ticked('color');
    const wantedShapes = ticked('shape'), wantedStages = ticked('stage');
    const legends = side.on.legend ? ticked('legend')[0] : 'any', under = !!side.on.under;
    const mons = new Set(side.on.mon ? side.mons : []);
    const ok = new Uint8Array(nb + 1);
    for (let pokemon = 1; pokemon <= nb; pokemon++) {
      if (mons.size && !mons.has(pokemon)) continue;
      if (wantedTypes.length && !types[pokemon].some(type => wantedTypes.includes(type))) continue;
      if (wantedSizes.length && !wantedSizes.includes(size(db, pokemon))) continue;
      if (wantedRegions.length && !wantedRegions.includes(region[pokemon])) continue;
      if (wantedColors.length && !wantedColors.includes(color[pokemon])) continue;
      if (wantedShapes.length && !wantedShapes.includes(shape[pokemon])) continue;
      if (wantedStages.length && !stage[pokemon].some(entry => wantedStages.includes(entry))) continue;
      if ((legends === 'hide' && legend[pokemon]) || (legends === 'only' && !legend[pokemon])) continue;
      if (under && served[pokemon] > cutoff) continue;
      ok[pokemon] = 1;
    }
    return ok;
  }

  function pool(db, headSide, bodySide, line, either, pick) {
    const { nb, done, family } = db, width = nb + 1;
    const headOk = fits(db, headSide), bodyOk = fits(db, bodySide), out = [];
    const pokemon = pick ? pick.id : 0, side = pick ? pick.side : 'all';
    for (let head = 1; head <= nb; head++) {
      for (let body = 1; body <= nb; body++) {
        if (done[head * width + body]) continue;
        if (line && family[head] !== family[body]) continue;
        if (pokemon && !((side !== 'body' && head === pokemon) || (side !== 'head' && body === pokemon))) continue;
        if ((headOk[head] && bodyOk[body]) || (either && headOk[body] && bodyOk[head])) out.push(head * width + body);
      }
    }
    return out;
  }

  function progress(db, pokemon, side = 'all') {
    const { nb, done } = db, width = nb + 1;
    let sprited = 0, total = 0;
    for (let other = 1; other <= nb; other++) {
      if (side !== 'body') {
        total++;
        sprited += done[pokemon * width + other];
      }
      if (side === 'body' || (side === 'all' && other !== pokemon)) {
        total++;
        sprited += done[other * width + pokemon];
      }
    }
    return { sprited, total };
  }

  const api = { SIZES, SHAPES, STAGES, KEYS, load, loadCounts, build, marshal, options, blank, parse, stringify, fits, pool, progress, size, shapeName };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Finder = api;
})(this);

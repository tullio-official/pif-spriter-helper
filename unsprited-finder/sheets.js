// autogen sheet streamer
const CELL = 96, COLUMNS = 10;
// idle stop delay
const IDLE_MS = 150;
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const jobs = new Map();

onmessage = ({ data }) => {
  if (data.type === 'want') want(data.url, data.head, data.body, data.again);
  if (data.type === 'drop') data.cells.forEach(([head, body]) => drop(head, body, data.wait));
};

function want(url, head, body, again) {
  let job = jobs.get(head);
  const row = Math.floor(body / COLUMNS);
  if (job && !job.over && row < job.passed) {
    if (job.whole && row >= job.wholeFrom && !again) return;
    job = null;
  }
  if (!job || job.over) {
    job = { url, head, wants: new Set(), asks: 0, whole: false, wholeFrom: 0, passed: 0, over: false, timer: 0,
      stopper: new AbortController() };
    jobs.set(head, job);
    run(job);
  }
  clearTimeout(job.timer);
  job.timer = 0;
  job.wants.add(body);
  if (++job.asks > 1 && !job.whole) {
    job.whole = true;
    job.wholeFrom = job.passed;
  }
}
function drop(head, body, wait) {
  const job = jobs.get(head);
  if (!job || !job.wants.delete(body) || job.wants.size) return;
  job.whole = false;
  job.asks = 0;
  if (wait) job.timer = setTimeout(() => stop(job), IDLE_MS);
  else stop(job);
}
function stop(job) {
  if (job.over) return;
  job.over = true;
  clearTimeout(job.timer);
  job.stopper.abort();
  job.writer?.abort().catch(() => {});
  if (jobs.get(job.head) === job) jobs.delete(job.head);
}

async function run(job) {
  let failed = false;
  try {
    const response = await fetch(job.url, { signal: job.stopper.signal });
    if (!response.ok) throw new Error(`Got ${response.status}`);
    await decode(job, response.body.getReader());
  } catch (error) {
    failed = !job.over;
  }
  // missing cells
  const left = [...job.wants];
  stop(job);
  if (left.length || failed) postMessage({ type: 'failed', head: job.head, bodies: left });
}

async function decode(job, reader) {
  const inflater = new DecompressionStream('deflate');
  const writer = job.writer = inflater.writable.getWriter();
  let rows = null, ended = false;
  const unpacked = (async () => {
    const output = inflater.readable.getReader();
    for (;;) {
      const { done, value } = await output.read();
      if (done) return;
      if (job.over) return output.cancel().catch(() => {});
      rows(value);
    }
  })();
  unpacked.catch(() => {});

  // png chunk parser (don't ask)
  let part = 'signature', need = 8, kind = '', top = new Uint8Array(8), header = null, filled = 0;
  function feed(bytes) {
    const pixels = [];
    let at = 0;
    while (at < bytes.length && !ended) {
      const step = Math.min(need, bytes.length - at), piece = bytes.subarray(at, at + step);
      at += step;
      need -= step;
      if (part === 'signature' && piece.some((byte, index) => byte !== SIGNATURE[filled + index])) throw new Error('Not a png');
      if (part === 'top') top.set(piece, filled);
      if (part === 'data' && kind === 'IDAT') pixels.push(piece);
      if (part === 'data' && kind === 'IHDR') header.set(piece, filled);
      filled += step;
      while (!need && !ended) next();
    }
    return pixels;
  }
  function next() {
    filled = 0;
    if (part === 'top') {
      need = new DataView(top.buffer).getUint32(0);
      kind = String.fromCharCode(...top.subarray(4));
      if (kind === 'IHDR') header = new Uint8Array(need);
      if (kind === 'IEND') ended = true;
      part = 'data';
    } else if (part === 'data') {
      if (kind === 'IHDR') rows = rowReader(job, header);
      part = 'crc';
      need = 4;
    } else {
      part = 'top';
      need = 8;
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || job.over) break;
      for (const piece of feed(value)) {
        await writer.ready;
        writer.write(piece).catch(() => {});
      }
      if (ended) break;
    }
  } finally {
    if (job.over || !ended) {
      reader.cancel().catch(() => {});
      writer.abort().catch(() => {});
    } else writer.close().catch(() => {});
  }
  if (!job.over) await unpacked;
}

function rowReader(job, header) {
  const info = new DataView(header.buffer);
  const width = info.getUint32(0), height = info.getUint32(4);
  // 8 bit rgba only
  if (header[8] !== 8 || header[9] !== 6 || header[12] !== 0 || width !== CELL * COLUMNS) throw new Error('Unexpected png');
  const stride = width * 4, band = new Uint8Array(CELL * stride), empty = new Uint8Array(stride);
  const line = new Uint8Array(stride + 1);
  let filled = 0, row = 0;
  function done(filter, bytes) {
    const slot = row % CELL;
    const out = band.subarray(slot * stride, (slot + 1) * stride);
    const prior = row ? band.subarray(((row - 1) % CELL) * stride, ((row - 1) % CELL + 1) * stride) : empty;
    unfilter(filter, bytes, prior, out);
    row++;
    if (row % CELL) return;
    const passed = row / CELL;
    for (let column = 0; column < COLUMNS; column++) {
      const body = (passed - 1) * COLUMNS + column;
      if (job.whole || job.wants.has(body)) send(job, body, band, stride, column);
    }
    job.passed = passed;
    if (!job.wants.size && !job.whole && !job.timer) stop(job);
  }
  return chunk => {
    let at = 0;
    while (at < chunk.length && !job.over && row < height) {
      if (!filled && chunk.length - at > stride) {
        done(chunk[at], chunk.subarray(at + 1, at + 1 + stride));
        at += stride + 1;
        continue;
      }
      const step = Math.min(stride + 1 - filled, chunk.length - at);
      line.set(chunk.subarray(at, at + step), filled);
      filled += step;
      at += step;
      if (filled < stride + 1) return;
      filled = 0;
      done(line[0], line.subarray(1));
    }
  };
}
function send(job, body, band, stride, column) {
  job.wants.delete(body);
  const pixels = new Uint8ClampedArray(CELL * CELL * 4), width = CELL * 4;
  for (let line = 0; line < CELL; line++) {
    const from = line * stride + column * width;
    pixels.set(band.subarray(from, from + width), line * width);
  }
  postMessage({ type: 'cell', head: job.head, body, pixels }, [pixels.buffer]);
}

function unfilter(filter, bytes, prior, out) {
  const size = out.length;
  if (filter === 0) out.set(bytes);
  else if (filter === 1) {
    for (let at = 0; at < 4; at++) out[at] = bytes[at];
    for (let at = 4; at < size; at++) out[at] = bytes[at] + out[at - 4];
  } else if (filter === 2) {
    for (let at = 0; at < size; at++) out[at] = bytes[at] + prior[at];
  } else if (filter === 3) {
    for (let at = 0; at < 4; at++) out[at] = bytes[at] + (prior[at] >> 1);
    for (let at = 4; at < size; at++) out[at] = bytes[at] + ((out[at - 4] + prior[at]) >> 1);
  } else if (filter === 4) {
    for (let at = 0; at < 4; at++) out[at] = bytes[at] + prior[at];
    for (let at = 4; at < size; at++) {
      const left = out[at - 4], up = prior[at], corner = prior[at - 4];
      // transparent fast path
      if (!(left | up | corner)) {
        out[at] = bytes[at];
        continue;
      }
      // paeth filter
      let toLeft = up - corner, toUp = left - corner, toCorner = toLeft + toUp;
      if (toLeft < 0) toLeft = -toLeft;
      if (toUp < 0) toUp = -toUp;
      if (toCorner < 0) toCorner = -toCorner;
      out[at] = bytes[at] + (toLeft <= toUp && toLeft <= toCorner ? left : toUp <= toCorner ? up : corner);
    }
  } else throw new Error(`Bad filter ${filter}`);
}

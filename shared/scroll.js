// pixel scrollbar (prison honey)
(() => {
  const art = document.getElementById('art');
  const scale = () => art.getBoundingClientRect().width / art.offsetWidth || 1;

  function step() {
    const ratio = devicePixelRatio || 1;
    for (let size = 8; size <= 64; size += 8) if (Math.abs(size * ratio - Math.round(size * ratio)) < 0.01) return size;
    return 8;
  }

  function scroller(area, track) {
    const thumb = track.querySelector('.thumb');
    area.classList.add('scroll');
    area.dataset.clip = '';
    const max = () => area.scrollHeight - area.clientHeight;
    const go = target => {
      const size = step();
      target = Math.max(0, Math.min(max(), target));
      area.scrollTop = target >= max() ? max() : Math.round(target / size) * size;
    };
    const sync = () => {
      const seen = area.clientHeight, whole = area.scrollHeight, length = track.clientHeight;
      track.hidden = whole <= seen;
      if (whole <= seen) return;
      const thumbHeight = Math.max(16, Math.round(length * seen / whole));
      thumb.style.height = thumbHeight + 'px';
      thumb.style.top = Math.round((length - thumbHeight) * area.scrollTop / (whole - seen)) + 'px';
    };
    area.addEventListener('scroll', () => {
      sync();
      window.pixelMeasure?.();
    }, { passive: true });
    // snap after scrolling
    area.addEventListener('scrollend', () => {
      const size = step();
      if (area.scrollTop < max() && area.scrollTop % size) go(area.scrollTop);
    });
    let pending = 0;
    area.addEventListener('wheel', event => {
      if (max() <= 0) return;
      event.preventDefault();
      pending += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * area.clientHeight : event.deltaY / scale();
      const size = step();
      const move = Math.trunc(pending / size) * size || (Math.abs(pending) >= size / 2 ? Math.sign(pending) * size : 0);
      pending = move ? 0 : pending;
      if (move) go(area.scrollTop + move);
    }, { passive: false });
    thumb.addEventListener('pointerdown', event => {
      event.preventDefault();
      thumb.setPointerCapture(event.pointerId);
      thumb.classList.add('drag');
      const startY = event.clientY, startTop = area.scrollTop;
      const seen = area.clientHeight, whole = area.scrollHeight, length = track.clientHeight, thumbHeight = thumb.offsetHeight;
      const move = moved => go(startTop + (moved.clientY - startY) / scale() * (whole - seen) / (length - thumbHeight));
      const up = () => {
        thumb.classList.remove('drag');
        thumb.removeEventListener('pointermove', move);
        thumb.removeEventListener('pointerup', up);
      };
      thumb.addEventListener('pointermove', move);
      thumb.addEventListener('pointerup', up);
    });
    // track = page up / down
    track.addEventListener('pointerdown', event => {
      if (event.target !== track) return;
      const down = event.clientY > thumb.getBoundingClientRect().top;
      go(area.scrollTop + (down ? 1 : -1) * (area.clientHeight - 24));
    });
    return { sync, go };
  }

  window.siteScroll = { scroller, step, scale };
})();

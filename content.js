const { chooseDisplayUrl, isBadgeImage, shouldOpenLightbox } = globalThis.GHLBDetect;
const { MAX_SCALE, MIN_SCALE, clampPan, nextTransform } = globalThis.GHLBGeom;
const { LIGHTBOX_CSS } = globalThis.GHLBStyles;

const TRIGGER = 'ghlb-zoom';

const CONTENT_SELECTOR = [
  '.markdown-body',
  '.js-comment-body',
  '.comment-body',
  '.wiki-body',
  '.js-preview-body',
  '[data-testid="markdown-body"]',
  '[data-testid*="comment-body"]',
  '[class*="MarkdownBody"]',
].join(',');

const CONTENT_QUERY = `:is(${CONTENT_SELECTOR})`;

const CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PREV_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>';
const NEXT_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5L16 12l-6.5 6.5"/></svg>';
const OPEN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6h4v4M18 6l-8 8"/><path d="M8 8H6v10h10v-2"/></svg>';

function boot() {
  const lightbox = new Lightbox();
  const scan = (root) => scanRoot(root);
  scan(document);

  const observer = new MutationObserver((records) => {
    if (!lightbox.host.isConnected) {
      document.documentElement.appendChild(lightbox.host);
    }
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) scan(node);
        continue;
      }
      const target = record.target;
      if (target instanceof HTMLImageElement) classify(target);
      else if (target instanceof HTMLAnchorElement) {
        target.querySelectorAll('img').forEach(classify);
      }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'href', 'data-canonical-src'],
  });

  for (const name of ['turbo:render', 'turbo:load', 'pjax:end']) {
    document.addEventListener(name, () => scan(document));
  }
  window.navigation?.addEventListener('navigatesuccess', () => {
    lightbox.close();
    scan(document);
  });

  document.addEventListener('mouseover', (event) => {
    const img = imageFromEvent(event);
    if (img) classify(img);
  }, true);

  document.addEventListener('click', (event) => onClick(event, lightbox), true);
  document.addEventListener('keydown', (event) => lightbox.onKey(event), true);
}

function scanRoot(root) {
  if (root instanceof HTMLImageElement) {
    classify(root);
    return;
  }
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('img').forEach(classify);
}

function classify(img) {
  if (!(img instanceof HTMLImageElement) || !img.isConnected) return;
  const anchor = img.closest('a[href]');
  const want = !!(anchor && eligible(img, anchor));
  if (anchor) anchor.classList.toggle(TRIGGER, want);
}

function eligible(img, anchor) {
  return shouldOpenLightbox({
    href: anchor.getAttribute('href') || '',
    base: location.href,
    inContent: !!img.closest(CONTENT_QUERY),
    excluded: isChromeOrAvatar(img),
    isEmoji: isEmoji(img),
    isBadge: isBadgeImage({
      src: img.getAttribute('src') || '',
      canonical: img.getAttribute('data-canonical-src') || '',
      base: location.href,
    }),
  });
}

function isEmoji(img) {
  if (img.closest('g-emoji, .emoji') || img.classList.contains('emoji')) return true;
  const width = parseFloat(img.getAttribute('width') || '');
  const height = parseFloat(img.getAttribute('height') || '');
  if (Number.isFinite(width) && Number.isFinite(height) && width <= 24 && height <= 24) return true;
  const haystack = `${img.getAttribute('src') || ''} ${img.getAttribute('data-canonical-src') || ''}`;
  return /\/emoji(?:s)?\//i.test(haystack);
}

function isChromeOrAvatar(img) {
  if (img.closest('.avatar, .avatar-user, .Avatar, .AvatarStack, .js-header-wrapper')) return true;
  const chrome = img.closest('header, nav, .Header, .AppHeader, .js-site-header, .gh-header');
  if (!chrome) return false;
  const content = img.closest(CONTENT_QUERY);
  return !(content && content.contains(chrome));
}

function imageFromEvent(event) {
  for (const node of event.composedPath()) {
    if (node instanceof HTMLImageElement) return node;
  }
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest('a[href]');
  if (!anchor || target !== anchor) return null;
  const img = anchor.querySelector(':scope > img, :scope > picture img');
  if (!img) return null;
  for (const node of anchor.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return null;
  }
  return img;
}

function onClick(event, lightbox) {
  if (event.composedPath().includes(lightbox.host)) return;
  if (event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const img = imageFromEvent(event);
  if (!img) return;
  const anchor = img.closest('a[href]');
  if (!anchor || !eligible(img, anchor)) return;
  const url = urlFor(img, anchor);
  if (!url) return;
  event.preventDefault();
  event.stopPropagation();
  lightbox.openFrom(img, anchor);
}

function urlFor(img, anchor) {
  return chooseDisplayUrl({
    href: anchor.href || anchor.getAttribute('href') || '',
    src: img.currentSrc || img.src || img.getAttribute('src') || '',
    canonical: img.getAttribute('data-canonical-src') || '',
    base: location.href,
  });
}

function cleanAlt(alt) {
  const text = (alt || '').replace(/\s+/g, ' ').trim();
  if (!text || /^(image|screenshot|picture|img|photo)$/i.test(text)) return '';
  return text.length > 300 ? `${text.slice(0, 299)}…` : text;
}

function isShown(img) {
  if (!img.isConnected) return false;
  if (img.closest('details:not([open])')) return false;
  const style = getComputedStyle(img);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = img.getBoundingClientRect();
  return rect.width >= 8 && rect.height >= 8;
}

class Lightbox {
  constructor() {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.index = 0;
    this.items = [];
    this.open = false;
    this.pointer = null;
    this.suppressClick = false;
    this.generation = 0;
    this.savedFocus = null;
    this.savedOverflow = null;
    this.host = document.createElement('div');
    this.host.id = 'ghlb-root';
    this.host.className = 'is-closed';
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.build();
    this.paintHost(false, false);
    document.documentElement.appendChild(this.host);
    window.addEventListener('resize', () => {
      if (this.open) this.apply(false);
    });
  }

  build() {
    const style = document.createElement('style');
    style.textContent = LIGHTBOX_CSS;
    const root = document.createElement('div');
    root.className = 'root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Image preview');
    root.innerHTML = `
      <div class="stage">
        <img class="photo" alt="">
        <div class="spinner" hidden><i></i></div>
        <div class="error" hidden><p>Couldn't load this image.</p></div>
      </div>
      <div class="topbar">
        <div class="counter" aria-live="polite"></div>
        <div class="actions">
          <a class="icon-btn open-tab" target="_blank" rel="noopener noreferrer" title="Open in a new tab" aria-label="Open in a new tab">${OPEN_SVG}</a>
          <button type="button" class="icon-btn close" title="Close (Esc)" aria-label="Close">${CLOSE_SVG}</button>
        </div>
      </div>
      <button type="button" class="nav prev" aria-label="Previous image" title="Previous image">${PREV_SVG}</button>
      <button type="button" class="nav next" aria-label="Next image" title="Next image">${NEXT_SVG}</button>
      <div class="caption">
        <p class="alt" hidden></p>
        <p class="hint"></p>
      </div>
    `;
    this.shadow.append(style, root);
    this.root = root;
    this.stage = root.querySelector('.stage');
    this.photo = root.querySelector('.photo');
    this.spinner = root.querySelector('.spinner');
    this.error = root.querySelector('.error');
    this.counter = root.querySelector('.counter');
    this.alt = root.querySelector('.alt');
    this.hint = root.querySelector('.hint');
    this.openTab = root.querySelector('.open-tab');
    this.closeBtn = root.querySelector('.close');
    this.prevBtn = root.querySelector('.prev');
    this.nextBtn = root.querySelector('.next');

    this.photo.draggable = false;
    this.photo.addEventListener('dragstart', (event) => event.preventDefault());
    this.photo.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.photo.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.photo.addEventListener('pointerup', (event) => this.onPointerUp(event));
    this.photo.addEventListener('pointercancel', (event) => this.onPointerUp(event));
    this.photo.addEventListener('dblclick', (event) => this.onDoubleClick(event));
    this.root.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
    this.root.addEventListener('click', (event) => this.onBackdropClick(event));
    this.closeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.close();
    });
    this.prevBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.step(-1);
    });
    this.nextBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.step(1);
    });
  }

  openFrom(img, anchor) {
    const items = collectGallery();
    let index = items.findIndex((item) => item.img === img);
    if (index === -1) {
      const url = urlFor(img, anchor);
      if (!url) return;
      items.unshift({
        url,
        alt: cleanAlt(img.getAttribute('alt') || ''),
        img,
        anchor,
      });
      index = 0;
    }
    this.items = items;
    this.index = index;
    this.present();
  }

  present() {
    if (!this.open) {
      this.savedFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.lockScroll();
      this.host.classList.remove('is-closed');
      this.paintHost(true, false);
      this.open = true;
      requestAnimationFrame(() => {
        if (!this.open) return;
        this.host.classList.add('is-open');
        this.paintHost(true, true);
      });
    }
    this.resetTransform();
    this.renderChrome();
    this.loadCurrent();
    this.closeBtn.focus({ preventScroll: true });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.pointer = null;
    this.host.classList.remove('is-open');
    this.paintHost(true, false);
    this.unlockScroll();
    const hide = () => {
      if (this.open) return;
      this.host.classList.add('is-closed');
      this.paintHost(false, false);
    };
    this.host.addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 200);
    const focus = this.savedFocus;
    if (focus && focus.isConnected) focus.focus({ preventScroll: true });
  }

  paintHost(displayed, visible) {
    const style = this.host.style;
    style.setProperty('position', 'fixed', 'important');
    style.setProperty('inset', '0', 'important');
    style.setProperty('z-index', '2147483646', 'important');
    style.setProperty('margin', '0', 'important');
    style.setProperty('padding', '0', 'important');
    style.setProperty('border', '0', 'important');
    style.setProperty('width', '100%', 'important');
    style.setProperty('height', '100%', 'important');
    style.setProperty('max-width', 'none', 'important');
    style.setProperty('background', 'transparent', 'important');
    style.setProperty('transition', 'opacity 140ms ease', 'important');
    style.setProperty('display', displayed ? 'block' : 'none', 'important');
    style.setProperty('opacity', visible ? '1' : '0', 'important');
    style.setProperty('pointer-events', visible ? 'auto' : 'none', 'important');
  }

  step(delta) {
    const next = this.index + delta;
    if (next < 0 || next >= this.items.length) return;
    this.index = next;
    this.resetTransform();
    this.renderChrome();
    this.loadCurrent();
  }

  loadCurrent() {
    const item = this.items[this.index];
    if (!item) return;
    const generation = ++this.generation;
    this.photo.classList.remove('is-ready');
    this.spinner.hidden = false;
    this.error.hidden = true;
    this.photo.alt = item.alt || 'Expanded image';
    this.openTab.href = item.url;
    this.preload(this.index - 1);
    this.preload(this.index + 1);

    const finish = (ok) => {
      if (generation !== this.generation) return;
      this.spinner.hidden = true;
      this.error.hidden = ok;
      this.photo.classList.toggle('is-ready', ok);
      if (ok) this.apply(false);
    };
    this.photo.onload = () => finish(true);
    this.photo.onerror = () => finish(false);
    this.photo.src = item.url;
    if (this.photo.complete && this.photo.naturalWidth > 0) finish(true);
  }

  preload(index) {
    const item = this.items[index];
    if (!item) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = item.url;
  }

  renderChrome() {
    const count = this.items.length;
    const item = this.items[this.index];
    const multi = count > 1;
    const percent = Math.round(this.scale * 100);
    const bits = [];
    if (multi) bits.push(`${this.index + 1} / ${count}`);
    if (percent !== 100) bits.push(`${percent}%`);
    this.counter.textContent = bits.join('  ·  ');
    this.alt.textContent = item?.alt || '';
    this.alt.hidden = !item?.alt;
    this.hint.textContent = multi
      ? 'Scroll to zoom · drag to pan · ← → to browse · esc to close'
      : 'Scroll to zoom · drag to pan · esc to close';
    this.prevBtn.hidden = !multi;
    this.nextBtn.hidden = !multi;
    this.prevBtn.disabled = this.index <= 0;
    this.nextBtn.disabled = this.index >= count - 1;
    this.root.setAttribute(
      'aria-label',
      item?.alt ? `Image preview: ${item.alt}` : 'Image preview',
    );
  }

  resetTransform() {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.apply(false);
  }

  state() {
    return { scale: this.scale, tx: this.tx, ty: this.ty };
  }

  viewport() {
    const rect = this.stage.getBoundingClientRect();
    return { w: rect.width, h: rect.height, left: rect.left, top: rect.top };
  }

  layout() {
    return { w: this.photo.offsetWidth, h: this.photo.offsetHeight };
  }

  commit(next, animate) {
    const pan = clampPan(next.tx, next.ty, next.scale, this.layout(), this.viewport());
    this.scale = next.scale;
    this.tx = pan.tx;
    this.ty = pan.ty;
    this.apply(animate);
    this.renderChrome();
  }

  apply(animate) {
    this.photo.style.setProperty('--tx', `${this.tx}px`);
    this.photo.style.setProperty('--ty', `${this.ty}px`);
    this.photo.style.setProperty('--scale', String(this.scale));
    this.photo.classList.toggle('can-pan', this.scale > 1);
    this.photo.classList.toggle('is-settling', !!animate);
  }

  onWheel(event) {
    if (!this.open) return;
    event.preventDefault();
    event.stopPropagation();
    let delta = event.deltaY;
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= 400;
    delta = Math.max(-200, Math.min(200, delta));
    const factor = Math.exp(-delta * 0.0016);
    const next = nextTransform(this.state(), { x: event.clientX, y: event.clientY }, this.viewport(), factor, MIN_SCALE, MAX_SCALE);
    this.commit(next, false);
  }

  onDoubleClick(event) {
    if (!this.open) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.scale > 1.01) {
      this.commit({ scale: 1, tx: 0, ty: 0 }, true);
      return;
    }
    const next = nextTransform(this.state(), { x: event.clientX, y: event.clientY }, this.viewport(), 2, MIN_SCALE, MAX_SCALE);
    this.commit(next, true);
  }

  onPointerDown(event) {
    if (!this.open || event.button !== 0) return;
    this.pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      tx: this.tx,
      ty: this.ty,
      moved: false,
    };
    this.photo.setPointerCapture(event.pointerId);
  }

  onPointerMove(event) {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    const dx = event.clientX - this.pointer.x;
    const dy = event.clientY - this.pointer.y;
    if (!this.pointer.moved && Math.hypot(dx, dy) < 4) return;
    this.pointer.moved = true;
    this.suppressClick = true;
    if (this.scale <= 1) return;
    this.photo.classList.add('is-dragging');
    const pan = clampPan(this.pointer.tx + dx, this.pointer.ty + dy, this.scale, this.layout(), this.viewport());
    this.tx = pan.tx;
    this.ty = pan.ty;
    this.apply(false);
  }

  onPointerUp(event) {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    const dx = event.clientX - this.pointer.x;
    const dy = event.clientY - this.pointer.y;
    const moved = this.pointer.moved;
    this.pointer = null;
    this.photo.classList.remove('is-dragging');
    if (this.scale <= 1 && moved && Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      this.step(dx < 0 ? 1 : -1);
    }
  }

  onBackdropClick(event) {
    if (this.suppressClick) {
      this.suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('button, a, img')) return;
    this.close();
  }

  onKey(event) {
    if (!this.open) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.step(-1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.step(1);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomAtCenter(1.25);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomAtCenter(0.8);
      return;
    }
    if (event.key === '0') {
      event.preventDefault();
      this.commit({ scale: 1, tx: 0, ty: 0 }, true);
      return;
    }
    if (event.key === 'Tab') {
      this.trapTab(event);
      return;
    }
    const origin = event.composedPath()[0];
    const onControl = origin instanceof Element && !!origin.closest('button, a');
    if (!onControl && (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'PageUp' || event.key === 'PageDown' || event.key === 'Home' || event.key === 'End')) {
      event.preventDefault();
    }
  }

  zoomAtCenter(factor) {
    const viewport = this.viewport();
    const pointer = {
      x: viewport.left + viewport.w / 2,
      y: viewport.top + viewport.h / 2,
    };
    this.commit(nextTransform(this.state(), pointer, viewport, factor, MIN_SCALE, MAX_SCALE), true);
  }

  trapTab(event) {
    const nodes = [...this.root.querySelectorAll('button, a')].filter((el) => {
      return !el.disabled && !el.hidden && el.getClientRects().length > 0;
    });
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = this.shadow.activeElement;
    if (event.shiftKey && (active === first || !nodes.includes(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !nodes.includes(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  lockScroll() {
    this.savedOverflow = {
      html: document.documentElement.style.overflow,
      body: document.body.style.overflow,
    };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  unlockScroll() {
    if (!this.savedOverflow) return;
    document.documentElement.style.overflow = this.savedOverflow.html;
    document.body.style.overflow = this.savedOverflow.body;
    this.savedOverflow = null;
  }
}

function collectGallery() {
  const items = [];
  const seen = new Set();
  for (const img of document.querySelectorAll(`${CONTENT_QUERY} img`)) {
    if (!(img instanceof HTMLImageElement) || seen.has(img)) continue;
    const anchor = img.closest('a[href]');
    if (!anchor || !eligible(img, anchor) || !isShown(img)) continue;
    const url = urlFor(img, anchor);
    if (!url) continue;
    seen.add(img);
    items.push({
      url,
      alt: cleanAlt(img.getAttribute('alt') || ''),
      img,
      anchor,
    });
  }
  return items;
}

if (!globalThis.__GHLB_LOADED__) {
  globalThis.__GHLB_LOADED__ = true;
  boot();
}

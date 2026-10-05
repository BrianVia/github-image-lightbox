(function () {
const LIGHTBOX_CSS = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  display: block;
  color-scheme: dark;
  pointer-events: none;
  opacity: 0;
  transition: opacity 140ms ease;
}
:host(.is-open) {
  pointer-events: auto;
  opacity: 1;
}
:host(.is-closed) {
  display: none !important;
}

.root {
  position: absolute;
  inset: 0;
  background: rgba(6, 8, 12, 0.94);
  color: #f4f5f7;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1.4;
  user-select: none;
  -webkit-user-select: none;
  overscroll-behavior: contain;
}

.stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: none;
}

.photo {
  max-width: calc(100vw - 128px);
  max-height: calc(100vh - 148px);
  width: auto;
  height: auto;
  object-fit: contain;
  transform: translate(var(--tx, 0px), var(--ty, 0px)) scale(var(--scale, 1));
  transform-origin: center center;
  box-shadow: 0 18px 70px rgba(0, 0, 0, 0.45);
  opacity: 0;
  cursor: zoom-in;
  -webkit-user-drag: none;
  user-select: none;
}
.photo.is-ready {
  opacity: 1;
}
.photo.can-pan {
  cursor: grab;
}
.photo.is-dragging {
  cursor: grabbing;
}
.photo.is-settling {
  transition: transform 160ms ease, opacity 140ms ease;
}

.spinner,
.error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  pointer-events: none;
}
.spinner[hidden],
.error[hidden],
.alt[hidden],
.nav[hidden] {
  display: none !important;
}
.spinner i {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.18);
  border-top-color: #fff;
  animation: ghlb-spin 0.7s linear infinite;
}
.error p {
  margin: 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 14px;
}

.topbar {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  left: max(16px, env(safe-area-inset-left));
  right: max(16px, env(safe-area-inset-right));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
  z-index: 2;
}
.counter {
  min-height: 1.2em;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  color: rgba(255, 255, 255, 0.78);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
.actions {
  display: flex;
  gap: 8px;
  pointer-events: auto;
}

.icon-btn,
.nav {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 999px;
  width: 40px;
  height: 40px;
  padding: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
  text-decoration: none;
}
.icon-btn:hover,
.nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.18);
}
.icon-btn:focus-visible,
.nav:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.icon-btn svg,
.nav svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 44px;
  height: 44px;
}
.nav.prev { left: max(14px, env(safe-area-inset-left)); }
.nav.next { right: max(14px, env(safe-area-inset-right)); }
.nav:disabled {
  opacity: 0.28;
  cursor: default;
}

.caption {
  position: absolute;
  left: 72px;
  right: 72px;
  bottom: max(16px, env(safe-area-inset-bottom));
  text-align: center;
  pointer-events: none;
  z-index: 2;
}
.alt {
  margin: 0 auto 4px;
  max-width: 720px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hint {
  margin: 0;
  color: rgba(255, 255, 255, 0.48);
  font-size: 12px;
}

@media (max-width: 700px) {
  .photo {
    max-width: calc(100vw - 28px);
    max-height: calc(100vh - 132px);
  }
  .caption {
    left: 16px;
    right: 16px;
  }
  .hint { display: none; }
}

@keyframes ghlb-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  :host,
  .photo,
  .spinner i {
    transition: none !important;
    animation: none !important;
  }
}
`;
globalThis.GHLBStyles = { LIGHTBOX_CSS };
})();

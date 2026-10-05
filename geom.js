(function () {
const MIN_SCALE = 1;
const MAX_SCALE = 8;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Zoom toward the pointer. `translate()` is in screen pixels and is applied
 * after `scale()`, so an existing pan grows when the cursor is not on the
 * image center.
 */
function nextTransform(state, pointer, viewport, factor, min = MIN_SCALE, max = MAX_SCALE) {
  const width = viewport.w || 0;
  const height = viewport.h || 0;
  if (width < 1 || height < 1 || !Number.isFinite(factor) || factor <= 0) {
    return { scale: state.scale, tx: state.tx, ty: state.ty };
  }

  const scale = clamp(state.scale * factor, min, max);
  if (scale === min) return { scale: min, tx: 0, ty: 0 };
  if (scale === state.scale) return { scale, tx: state.tx, ty: state.ty };

  const ratio = scale / state.scale;
  const cx = pointer.x - ((viewport.left || 0) + width / 2);
  const cy = pointer.y - ((viewport.top || 0) + height / 2);
  return {
    scale,
    tx: cx * (1 - ratio) + state.tx * ratio,
    ty: cy * (1 - ratio) + state.ty * ratio,
  };
}

/** Keep a zoomed image from being dragged entirely off screen. Scale 1 stays centered. */
function clampPan(tx, ty, scale, layout, viewport, margin = 24) {
  if (scale <= 1) return { tx: 0, ty: 0 };
  const layoutW = layout.w || 0;
  const layoutH = layout.h || 0;
  const viewW = viewport.w || 0;
  const viewH = viewport.h || 0;
  if (layoutW < 2 || layoutH < 2 || viewW < 2 || viewH < 2) return { tx: 0, ty: 0 };

  const maxX = Math.max(0, (layoutW * scale - viewW) / 2 + margin);
  const maxY = Math.max(0, (layoutH * scale - viewH) / 2 + margin);
  return {
    tx: clamp(tx, -maxX, maxX),
    ty: clamp(ty, -maxY, maxY),
  };
}

globalThis.GHLBGeom = { MIN_SCALE, MAX_SCALE, nextTransform, clampPan };
})();

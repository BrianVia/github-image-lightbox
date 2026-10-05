/**
 * Decide which GitHub anchors are "this image opens in a new tab" versus
 * badges, avatars, and pictures that intentionally link to a webpage.
 *
 * GitHub's markdown renderer turns ![alt](url) into:
 *   <a target="_blank" href="IMAGE_OR_CAMO"><img src="..." data-canonical-src="..."></a>
 * Repo-relative pictures link to the blob HTML page and put the bytes on the <img>.
 * Badges and logos link to a project page, not to the image file.
 */

(function () {
const IMAGE_EXT = /\.(?:png|jpe?g|gif|webp|bmp|svg|avif|apng|ico)$/i;

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com', 'gist.github.com']);

function parseUrl(value, base = 'https://github.com/') {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  try {
    return new URL(trimmed, base);
  } catch {
    return null;
  }
}

function isHttpOrData(url) {
  return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:';
}

function hasImageExt(pathname) {
  return IMAGE_EXT.test(pathname);
}

function isCamoUrl(value, base) {
  const url = typeof value === 'string' ? parseUrl(value, base) : value;
  return !!url && url.hostname === 'camo.githubusercontent.com';
}

function isPrivateUserImage(value, base) {
  const url = typeof value === 'string' ? parseUrl(value, base) : value;
  return !!url && url.hostname === 'private-user-images.githubusercontent.com';
}

function isDirectImageUrl(value, base) {
  const url = typeof value === 'string' ? parseUrl(value, base) : value;
  if (!url || !isHttpOrData(url)) return false;
  if (url.protocol === 'data:') return url.pathname.startsWith('image/');

  const host = url.hostname;
  const path = url.pathname;

  if (host === 'camo.githubusercontent.com') return true;
  if (host === 'user-images.githubusercontent.com') return true;
  if (host === 'private-user-images.githubusercontent.com') return true;

  if (GITHUB_HOSTS.has(host)) {
    if (path.includes('/user-attachments/assets/')) return true;
    if (path.includes('/raw/') && hasImageExt(path)) return true;
    if (path.includes('/releases/download/') && hasImageExt(path)) return true;
    return false;
  }

  if (host.endsWith('githubusercontent.com') && hasImageExt(path)) return true;
  if (hasImageExt(path)) return true;
  return false;
}

/** Blob URLs are HTML pages that happen to end in an image extension. */
function isBlobImagePage(value, base) {
  const url = typeof value === 'string' ? parseUrl(value, base) : value;
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) return false;
  if (!GITHUB_HOSTS.has(url.hostname)) return false;
  if (url.pathname.includes('/raw/')) return false;
  return /\/blob\//.test(url.pathname) && hasImageExt(url.pathname);
}

function decodeCamoTarget(url) {
  if (!url || url.hostname !== 'camo.githubusercontent.com') return '';
  const hex = url.pathname.split('/').pop() || '';
  if (hex.length < 8 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return '';
  try {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function urlIsBadge(url) {
  if (!url) return false;
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'img.shields.io' || host === 'shields.io' || host.endsWith('.shields.io')) return true;
  if (/\/badge\.svg$/i.test(url.pathname)) return true;
  return false;
}

function isBadgeImage({ src = '', canonical = '', base } = {}) {
  for (const value of [src, canonical]) {
    const url = parseUrl(value, base);
    if (!url) continue;
    if (urlIsBadge(url)) return true;
    const decoded = parseUrl(decodeCamoTarget(url), base);
    if (urlIsBadge(decoded)) return true;
  }
  return false;
}

function shouldOpenLightbox({
  href,
  base,
  inContent,
  excluded,
  isEmoji,
  isBadge,
}) {
  if (!inContent || excluded || isEmoji || isBadge) return false;
  if (!href) return false;
  return isDirectImageUrl(href, base) || isBlobImagePage(href, base);
}

function absolute(value, base) {
  const url = typeof value === 'string' ? parseUrl(value, base) : value;
  if (!url || !isHttpOrData(url)) return '';
  return url.href;
}

/**
 * Pick the URL to put in the lightbox. Prefer a URL the browser can paint:
 * signed private images, then a direct original, then the camo/src already on the page.
 */
function chooseDisplayUrl({ href = '', src = '', canonical = '', base } = {}) {
  const srcAbs = absolute(src, base);
  const hrefAbs = absolute(href, base);
  const canonAbs = absolute(canonical, base);

  if (srcAbs && isPrivateUserImage(srcAbs)) return srcAbs;
  if (hrefAbs && isDirectImageUrl(hrefAbs) && !isCamoUrl(hrefAbs)) return hrefAbs;
  if (srcAbs && isDirectImageUrl(srcAbs)) return srcAbs;
  if (canonAbs && isDirectImageUrl(canonAbs) && !isCamoUrl(canonAbs)) return canonAbs;
  if (srcAbs) return srcAbs;
  return hrefAbs || '';
}

globalThis.GHLBDetect = {
  parseUrl,
  hasImageExt,
  isCamoUrl,
  isPrivateUserImage,
  isDirectImageUrl,
  isBlobImagePage,
  isBadgeImage,
  shouldOpenLightbox,
  chooseDisplayUrl,
};
})();

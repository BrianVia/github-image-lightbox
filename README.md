# GitHub Image Lightbox

A small Chrome extension that opens screenshots and other images in GitHub issues, pull requests, comments, READMEs, discussions, and gists in an on-page lightbox. You stay on the page instead of losing your place to a new tab.

Badges, avatars, emoji, and pictures that link to a website keep their normal click behavior. Command-click, control-click, shift-click, and middle-click still open a new tab.

## Install

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this folder (the one that contains `manifest.json`).

Reload any open GitHub tab after installing. Click a screenshot in an issue, pull request, README, or discussion to try it.

## Use

- **Esc**, the close button, or a click on the dark backdrop closes the lightbox.
- **Scroll** to zoom toward the cursor. When zoomed, **drag** to pan. Double-click toggles a closer view.
- **← / →** or the arrow buttons move between images on the current page.
- **Open in a new tab** is still there, in the top-right of the lightbox, when you want the old behavior.

The extension only runs on `github.com` and `gist.github.com`. It does not add a toolbar button, make network calls, or ask for any other permissions.

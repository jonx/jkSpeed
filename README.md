# jkSpeed

Control the speed of any HTML5 video — including YouTube Shorts and videos inside iframes. Speed up, slow down, play/pause, and pop any video into real Picture-in-Picture.

![jkSpeed screenshot](store/screenshot.png)

## Features

- Detects all HTML5 videos on the current page, including Shorts and iframes
- Speed presets (1x, 1.5x) and fine-tune controls (+/- 0.25x)
- Play/pause toggle
- **Real Picture-in-Picture** — pops the video out into a native OS window, unlike YouTube's built-in "miniplayer" that stays trapped inside the page
- **Customizable keyboard shortcuts** (default: S to slow down, D to speed up) — overrides page shortcuts, fixing issues with YouTube shortcuts not working on non-US keyboards (e.g. French AZERTY MacBooks)
- Icon lights up when a video is detected on the page
- Auto-refreshes to catch dynamically loaded videos

## Install

### Chrome Web Store

[Install jkSpeed](https://jkn.me/chrome)

### Manual

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the project folder

## Permissions

- **activeTab** — access the current tab when you click the extension icon
- **webNavigation** — enumerate frames to find videos inside iframes
- **storage** — save your keyboard shortcut preferences

No data is collected, stored, or transmitted. See [Privacy Policy](PRIVACY.md).

## License

MIT

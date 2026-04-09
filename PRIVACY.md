# Privacy Policy — jkSpeed

**Last updated:** April 9, 2026

## Data Collection

jkSpeed does **not** collect or transmit any user data. All data stays locally in your browser.

When the optional "Remember speed per site" feature is enabled, jkSpeed stores a salted SHA-256 hash of the site hostname alongside your preferred playback speed. The actual URL or hostname is never stored — only a salted hash that can't be easily reversed. The salt is unique to your browser install and stored locally, making it impractical to match hashes against known domains.

## Permissions

- **activeTab**: Used to communicate with the current page's content script when you click the extension icon, in order to detect and control video players.
- **webNavigation**: Used to enumerate all frames (including iframes) on the current tab so the extension can discover video players embedded in iframes.
- **storage**: Used to store user preferences locally: custom keyboard shortcuts and optional per-site playback speed settings. All data stays in your browser via Chrome's sync storage. No data is transmitted externally.
- **Host permissions (content scripts on all URLs)**: The content script runs on all pages to detect HTML5 video elements and respond to speed change commands. It must run in all frames (including iframes) to find embedded video players.

## Remote Code

jkSpeed does not use any remote code. All JavaScript is bundled locally in the extension package.

## Third-Party Services

jkSpeed does not communicate with any external servers or third-party services. No analytics, no tracking, no ads.

## Contact

For questions about this privacy policy, visit [jkn.me/chrome](https://jkn.me/chrome).

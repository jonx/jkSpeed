function deriveTitle(video, index, isLargest) {
  // 1. Explicit attributes
  const label = video.title || video.getAttribute('aria-label');
  if (label) return label;

  // 2. Nearby heading in a player container
  const parent = video.closest('figure, article, section, div[class*="player"], div[class*="video"]');
  if (parent) {
    const heading = parent.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"]');
    if (heading && heading.textContent.trim()) return heading.textContent.trim().slice(0, 80);
  }

  // 3. Page title — only for the largest (main) video
  //    Use document.title (always current) over og:title (stale on SPAs)
  if (isLargest && document.title) {
    const clean = document.title.replace(/\s*[-|]\s*[^-|]+$/, '').trim();
    if (clean) return clean.slice(0, 80);
  }

  // 4. Filename from src URL (skip blob/data URLs)
  const src = video.currentSrc || video.src || '';
  if (src && !src.startsWith('blob:') && !src.startsWith('data:')) {
    try {
      const url = new URL(src);
      const filename = url.pathname.split('/').pop();
      if (filename) return decodeURIComponent(filename).slice(0, 60);
      return url.hostname;
    } catch {
      return src.slice(0, 60);
    }
  }

  // 5. Describe by size
  const w = video.videoWidth || video.clientWidth;
  const h = video.videoHeight || video.clientHeight;
  if (w && h) return `Video ${index + 1} (${w}x${h})`;

  return `Video ${index + 1}`;
}

function discoverVideos() {
  const videos = Array.from(document.querySelectorAll('video')).filter(v => {
    // Must have a source loaded
    if (!v.currentSrc && !v.src) return false;
    // Skip videos with no data (stale elements from SPA navigation)
    if (v.readyState === 0) return false;
    // Always keep playing or PiP videos
    if (!v.paused || document.pictureInPictureElement === v) return true;
    // Filter out tiny/hidden preview thumbnails
    const w = v.videoWidth || v.clientWidth || 0;
    const h = v.videoHeight || v.clientHeight || 0;
    return w > 150 && h > 150;
  });

  // Find the largest video to give it the page title
  let largestArea = 0;
  let largestIdx = -1;
  videos.forEach((v, i) => {
    const area = (v.videoWidth || 0) * (v.videoHeight || 0);
    if (area > largestArea) { largestArea = area; largestIdx = i; }
  });
  return videos.map((video, index) => ({
    index,
    src: video.currentSrc || video.src || '',
    title: deriveTitle(video, index, index === largestIdx),
    duration: isFinite(video.duration) ? video.duration : 0,
    currentTime: video.currentTime || 0,
    playbackRate: video.playbackRate,
    paused: video.paused,
    pipEnabled: document.pictureInPictureEnabled && !video.disablePictureInPicture,
    inPip: document.pictureInPictureElement === video,
    width: video.videoWidth || video.clientWidth || 0,
    height: video.videoHeight || video.clientHeight || 0
  }));
}

// Keyboard shortcuts — override page shortcuts
const DEFAULT_SHORTCUTS = {
  speedUp: { key: 'd', ctrl: false, shift: false, alt: false },
  speedDown: { key: 's', ctrl: false, shift: false, alt: false }
};

let shortcuts = { ...DEFAULT_SHORTCUTS };
let siteSpeed = null;       // remembered speed for current site
let siteKey = null;         // hashed hostname
let rememberEnabled = false;

// Hash hostname so we never store readable URLs
async function hashHostname(host) {
  const data = new TextEncoder().encode(host);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// Load saved shortcuts and site speed
hashHostname(location.hostname).then(key => {
  siteKey = key;
  chrome.storage.sync.get(['shortcuts', 'siteSpeeds', 'rememberSpeed'], (result) => {
    if (result.shortcuts) shortcuts = result.shortcuts;
    rememberEnabled = result.rememberSpeed === true;
    if (rememberEnabled && result.siteSpeeds && result.siteSpeeds[siteKey]) {
      siteSpeed = result.siteSpeeds[siteKey];
      applyRememberedSpeed();
    }
  });
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.shortcuts) shortcuts = changes.shortcuts.newValue;
  if (changes.rememberSpeed) rememberEnabled = changes.rememberSpeed.newValue === true;
  if (changes.siteSpeeds && siteKey) {
    const speeds = changes.siteSpeeds.newValue || {};
    siteSpeed = speeds[siteKey] || null;
  }
});

// Apply remembered speed to all current and future videos
function applyRememberedSpeed() {
  if (!siteSpeed) return;
  document.querySelectorAll('video').forEach(v => {
    if (v.readyState > 0 && v.playbackRate !== siteSpeed) {
      v.playbackRate = siteSpeed;
    }
  });
}

// Save current speed for this site (called when user changes speed)
function rememberSpeedForSite(speed) {
  try {
    if (!rememberEnabled || !chrome.runtime?.id || !siteKey) return;
    chrome.storage.sync.get('siteSpeeds', (result) => {
      const speeds = result.siteSpeeds || {};
      if (speed === 1) {
        delete speeds[siteKey]; // don't store 1x, it's the default
      } else {
        speeds[siteKey] = speed;
      }
      chrome.storage.sync.set({ siteSpeeds: speeds });
    });
  } catch { /* context invalidated */ }
}

// Watch for new videos and apply remembered speed
const speedObserver = new MutationObserver(() => {
  if (rememberEnabled && siteSpeed) applyRememberedSpeed();
});
speedObserver.observe(document.documentElement, { childList: true, subtree: true });

function keyMatchesShortcut(e, sc) {
  return e.key === sc.key &&
    e.ctrlKey === sc.ctrl &&
    e.shiftKey === sc.shift &&
    e.altKey === sc.alt;
}

// Speed overlay on video
function showSpeedOverlay(video, speed) {
  let overlay = video._jkSpeedOverlay;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'padding:12px 24px;background:rgba(0,0,0,0.7);color:#fff;' +
      'font:bold 42px system-ui,sans-serif;border-radius:10px;' +
      'z-index:999999;pointer-events:none;transition:opacity 0.3s ease;opacity:0;';
    video._jkSpeedOverlay = overlay;
  }
  // Position overlay relative to the video itself
  if (video.style.position === '' || video.style.position === 'static') {
    video.style.position = 'relative';
  }
  if (!overlay.parentElement || overlay.parentElement !== video.parentElement) {
    // Use an absolutely positioned overlay anchored to the video's bounding box
    const rect = video.getBoundingClientRect();
    overlay.style.position = 'fixed';
    overlay.style.top = (rect.top + rect.height / 2) + 'px';
    overlay.style.left = (rect.left + rect.width / 2) + 'px';
    document.body.appendChild(overlay);
  } else {
    const rect = video.getBoundingClientRect();
    overlay.style.top = (rect.top + rect.height / 2) + 'px';
    overlay.style.left = (rect.left + rect.width / 2) + 'px';
  }
  overlay.textContent = speed + 'x';
  overlay.style.opacity = '1';
  clearTimeout(overlay._hideTimer);
  overlay._hideTimer = setTimeout(() => { overlay.style.opacity = '0'; }, 800);
}

// Capture phase = runs before the page's own listeners
document.addEventListener('keydown', (e) => {
  try {
    if (!chrome.runtime?.id) return;
  } catch { return; }

  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;

  const videos = document.querySelectorAll('video');
  if (videos.length === 0) return;

  let matched = null;
  if (keyMatchesShortcut(e, shortcuts.speedUp)) matched = 'speedUp';
  else if (keyMatchesShortcut(e, shortcuts.speedDown)) matched = 'speedDown';

  if (!matched) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // Target: playing videos first, or the largest one if all paused
  const allVideos = Array.from(videos);
  let targets = allVideos.filter(v => !v.paused);
  if (targets.length === 0) {
    targets = [allVideos.reduce((a, b) =>
      (b.videoWidth * b.videoHeight) > (a.videoWidth * a.videoHeight) ? b : a
    )];
  }

  const step = 0.25;
  targets.forEach(video => {
    if (matched === 'speedUp') {
      video.playbackRate = Math.min(16, video.playbackRate + step);
    } else {
      video.playbackRate = Math.max(0.25, video.playbackRate - step);
    }
    showSpeedOverlay(video, Math.round(video.playbackRate * 100) / 100);
  });
  // Remember speed for this site
  if (targets.length > 0) {
    rememberSpeedForSite(Math.round(targets[0].playbackRate * 100) / 100);
  }
}, true);

// Notify service worker about video presence on this page
function notifyVideoStatus() {
  try {
    if (!chrome.runtime?.id) return;
    const hasVideo = document.querySelectorAll('video').length > 0;
    chrome.runtime.sendMessage({ action: 'VIDEO_STATUS', hasVideo }).catch(() => {});
  } catch { /* extension context invalidated */ }
}

// Initial check
notifyVideoStatus();

// Watch for dynamically added/removed videos
const observer = new MutationObserver(() => notifyVideoStatus());
observer.observe(document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'GET_VIDEOS': {
      sendResponse({ videos: discoverVideos(), url: location.href });
      return false;
    }

    case 'SET_SPEED': {
      const video = document.querySelectorAll('video')[message.videoIndex];
      if (video) {
        video.playbackRate = message.speed;
        rememberSpeedForSite(Math.round(video.playbackRate * 100) / 100);
        sendResponse({ success: true, newSpeed: video.playbackRate });
      } else {
        sendResponse({ success: false, error: 'Video not found' });
      }
      return false;
    }

    case 'TOGGLE_PLAY': {
      const video = document.querySelectorAll('video')[message.videoIndex];
      if (video) {
        if (video.paused) {
          video.play();
        } else {
          video.pause();
        }
        sendResponse({ success: true, paused: video.paused });
      } else {
        sendResponse({ success: false, error: 'Video not found' });
      }
      return false;
    }

    case 'TOGGLE_PIP': {
      const video = document.querySelectorAll('video')[message.videoIndex];
      if (!video) {
        sendResponse({ success: false, error: 'Video not found' });
        return true;
      }
      if (document.pictureInPictureElement === video) {
        document.exitPictureInPicture()
          .then(() => sendResponse({ success: true, inPip: false }))
          .catch(e => sendResponse({ success: false, error: e.message }));
      } else {
        video.requestPictureInPicture()
          .then(() => sendResponse({ success: true, inPip: true }))
          .catch(e => sendResponse({ success: false, error: e.message }));
      }
      return true;
    }
  }
});

const SPEED_PRESETS = [1, 1.5];
const FINE_STEP = 0.25;

const DEFAULT_SHORTCUTS = {
  speedUp: { key: 'd', ctrl: false, shift: false, alt: false },
  speedDown: { key: 's', ctrl: false, shift: false, alt: false }
};

let currentTabId = null;
let refreshInterval = null;
const videoFirstSeen = new Map(); // key -> timestamp
let lastSeenUrl = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showError('No active tab found.');
      return;
    }
    currentTabId = tab.id;
    await refreshVideos();
    refreshInterval = setInterval(refreshVideos, 2000);
    initShortcuts();
  } catch (err) {
    showError('Could not connect to the page. Try reloading it.');
  }
}

window.addEventListener('unload', () => {
  if (refreshInterval) clearInterval(refreshInterval);
});

async function getAllVideos() {
  let frames;
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId: currentTabId });
  } catch {
    return [];
  }

  const results = await Promise.allSettled(
    frames.map(frame =>
      chrome.tabs.sendMessage(
        currentTabId,
        { action: 'GET_VIDEOS' },
        { frameId: frame.frameId }
      )
    )
  );

  const allVideos = [];
  let currentUrl = null;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      if (frames[i].frameId === 0 && result.value.url) {
        currentUrl = result.value.url;
      }
      if (result.value.videos?.length > 0) {
        result.value.videos.forEach(video => {
          allVideos.push({
            ...video,
            frameId: frames[i].frameId,
            frameUrl: frames[i].url
          });
        });
      }
    }
  });

  // SPA navigation detected — clear tracking state
  if (currentUrl && currentUrl !== lastSeenUrl) {
    lastSeenUrl = currentUrl;
    videoFirstSeen.clear();
  }

  return allVideos;
}

async function refreshVideos() {
  const videos = await getAllVideos();

  // Track first-seen timestamp per video, sort newest first
  const now = Date.now();
  const currentKeys = new Set();
  videos.forEach(v => {
    const key = `${v.frameId}:${v.index}`;
    currentKeys.add(key);
    if (!videoFirstSeen.has(key)) videoFirstSeen.set(key, now);
    v._key = key;
    v._firstSeen = videoFirstSeen.get(key);
  });

  // Clean up stale entries
  for (const key of videoFirstSeen.keys()) {
    if (!currentKeys.has(key)) videoFirstSeen.delete(key);
  }

  videos.sort((a, b) => b._firstSeen - a._firstSeen);
  renderVideos(videos);
}

function renderVideos(videos) {
  const container = document.getElementById('video-list');

  if (videos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
            <line x1="7" y1="2" x2="7" y2="22"/>
            <line x1="17" y1="2" x2="17" y2="22"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="2" y1="7" x2="7" y2="7"/>
            <line x1="2" y1="17" x2="7" y2="17"/>
            <line x1="17" y1="7" x2="22" y2="7"/>
            <line x1="17" y1="17" x2="22" y2="17"/>
          </svg>
        </div>
        <p>No videos found on this page</p>
        <p class="hint">Navigate to a page with HTML5 video players</p>
      </div>
    `;
    return;
  }

  const existingCards = container.querySelectorAll('.video-card');
  const newKeys = videos.map(v => v._key).join(',');
  const oldKeys = Array.from(existingCards).map(c => c.dataset.videoKey || '').join(',');

  if (newKeys !== oldKeys) {
    container.innerHTML = '';
    videos.forEach((video, i) => {
      const card = createVideoCard(video, i);
      card.dataset.videoKey = video._key;
      container.appendChild(card);
    });
  } else {
    videos.forEach((video, i) => {
      updateVideoCard(existingCards[i], video);
    });
  }
}

function createVideoCard(video, index) {
  const card = document.createElement('div');
  card.className = 'video-card';
  card.dataset.index = index;
  card.dataset.currentRate = video.playbackRate;

  const isIframe = video.frameId !== 0;
  const duration = formatTime(video.duration);
  const rate = roundRate(video.playbackRate);
  const addedAt = formatTimeOfDay(video._firstSeen);

  card.innerHTML = `
    <div class="video-header">
      <div class="video-info">
        <div class="video-title" title="${escapeAttr(video.title)}">${escapeHtml(video.title)}${duration ? ` <span class="duration">${duration}</span>` : ''}${isIframe ? ' <span class="badge">iframe</span>' : ''} <span class="duration">${addedAt}</span></div>
      </div>
      <div class="current-speed" data-role="speed-display">${rate}x</div>
    </div>
    <div class="controls-row">
      ${SPEED_PRESETS.map(s => `
        <button class="speed-btn ${roundRate(video.playbackRate) === s ? 'active' : ''}"
                data-speed="${s}">${s}x</button>
      `).join('')}
      <button class="ctrl-btn" data-delta="${-FINE_STEP}">-.25</button>
      <button class="ctrl-btn" data-delta="${FINE_STEP}">+.25</button>
      <button class="ctrl-btn play-btn ${video.paused ? '' : 'active'}" data-play>
        ${video.paused ? `
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="6 3 20 12 6 21 6 3"/>
          </svg>
        ` : `
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <rect x="5" y="3" width="4" height="18" rx="1"/>
            <rect x="15" y="3" width="4" height="18" rx="1"/>
          </svg>
        `}
      </button>
      <button class="ctrl-btn pip-btn ${video.inPip ? 'active' : ''}" ${!video.pipEnabled ? 'disabled' : ''} data-pip>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <rect x="11" y="9" width="9" height="7" rx="1" ry="1" fill="currentColor" opacity="0.3"/>
        </svg>
      </button>
    </div>
  `;

  card.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setSpeed(video.frameId, video.index, parseFloat(btn.dataset.speed));
    });
  });

  card.querySelectorAll('[data-delta]').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseFloat(btn.dataset.delta);
      const currentRate = parseFloat(card.dataset.currentRate);
      const newSpeed = Math.max(0.25, Math.min(16, roundRate(currentRate + delta)));
      setSpeed(video.frameId, video.index, newSpeed);
    });
  });

  const playBtn = card.querySelector('[data-play]');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      togglePlay(video.frameId, video.index);
    });
  }

  const pipBtn = card.querySelector('[data-pip]');
  if (pipBtn) {
    pipBtn.addEventListener('click', () => {
      togglePip(video.frameId, video.index);
    });
  }

  return card;
}

function updateVideoCard(card, video) {
  const rate = roundRate(video.playbackRate);
  card.dataset.currentRate = video.playbackRate;

  const titleEl = card.querySelector('.video-title');
  if (titleEl && titleEl.dataset.src !== video.title) {
    const duration = formatTime(video.duration);
    const isIframe = video.frameId !== 0;
    titleEl.dataset.src = video.title;
    titleEl.title = video.title;
    titleEl.innerHTML = `${escapeHtml(video.title)}${duration ? ` <span class="duration">${duration}</span>` : ''}${isIframe ? ' <span class="badge">iframe</span>' : ''}`;
  }

  const display = card.querySelector('[data-role="speed-display"]');
  if (display) display.textContent = `${rate}x`;

  card.querySelectorAll('.speed-btn').forEach(btn => {
    const s = parseFloat(btn.dataset.speed);
    btn.classList.toggle('active', s === rate);
  });

  const playBtn = card.querySelector('[data-play]');
  if (playBtn) {
    playBtn.classList.toggle('active', !video.paused);
    playBtn.innerHTML = video.paused
      ? `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>`;
  }

  const pipBtn = card.querySelector('[data-pip]');
  if (pipBtn) {
    pipBtn.classList.toggle('active', video.inPip);
    pipBtn.disabled = !video.pipEnabled;
  }
}

async function setSpeed(frameId, videoIndex, speed) {
  try {
    await chrome.tabs.sendMessage(
      currentTabId,
      { action: 'SET_SPEED', videoIndex, speed },
      { frameId }
    );
    await refreshVideos();
  } catch (err) {
    console.error('Failed to set speed:', err);
  }
}

async function togglePlay(frameId, videoIndex) {
  try {
    await chrome.tabs.sendMessage(
      currentTabId,
      { action: 'TOGGLE_PLAY', videoIndex },
      { frameId }
    );
    await refreshVideos();
  } catch (err) {
    console.error('Failed to toggle play:', err);
  }
}

async function togglePip(frameId, videoIndex) {
  try {
    await chrome.tabs.sendMessage(
      currentTabId,
      { action: 'TOGGLE_PIP', videoIndex },
      { frameId }
    );
    await refreshVideos();
  } catch (err) {
    console.error('Failed to toggle PiP:', err);
  }
}

function showError(message) {
  document.getElementById('video-list').innerHTML = `
    <div class="error-state">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimeOfDay(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function roundRate(rate) {
  return Math.round(rate * 100) / 100;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Shortcuts ---

function formatShortcut(sc) {
  const parts = [];
  if (sc.ctrl) parts.push('Ctrl');
  if (sc.alt) parts.push('Alt');
  if (sc.shift) parts.push('Shift');
  let key = sc.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join(' + ');
}

async function initShortcuts() {
  const result = await chrome.storage.sync.get('shortcuts');
  const shortcuts = result.shortcuts || DEFAULT_SHORTCUTS;

  document.querySelectorAll('.shortcut-key').forEach(btn => {
    const action = btn.dataset.action;
    btn.textContent = formatShortcut(shortcuts[action]);

    btn.addEventListener('click', () => {
      // If another button is recording, cancel it
      document.querySelectorAll('.shortcut-key.recording').forEach(other => {
        if (other !== btn) {
          other.classList.remove('recording');
          other.textContent = formatShortcut(shortcuts[other.dataset.action]);
        }
      });

      btn.classList.add('recording');
      btn.textContent = 'Press a key...';

      function onKey(e) {
        e.preventDefault();
        e.stopPropagation();

        // Ignore lone modifier presses
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

        // Escape cancels
        if (e.key === 'Escape') {
          btn.classList.remove('recording');
          btn.textContent = formatShortcut(shortcuts[action]);
          document.removeEventListener('keydown', onKey, true);
          return;
        }

        const newShortcut = {
          key: e.key,
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          alt: e.altKey
        };

        shortcuts[action] = newShortcut;
        chrome.storage.sync.set({ shortcuts });

        btn.classList.remove('recording');
        btn.textContent = formatShortcut(newShortcut);
        document.removeEventListener('keydown', onKey, true);
      }

      document.addEventListener('keydown', onKey, true);
    });
  });
}

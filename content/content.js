function deriveTitle(video) {
  const label = video.title || video.getAttribute('aria-label');
  if (label) return label;

  const parent = video.closest('figure, article, section, div[class*="player"], div[class*="video"]');
  if (parent) {
    const heading = parent.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"]');
    if (heading && heading.textContent.trim()) return heading.textContent.trim().slice(0, 80);
  }

  const src = video.currentSrc || video.src || '';
  if (src) {
    try {
      const url = new URL(src);
      const filename = url.pathname.split('/').pop();
      if (filename && filename !== '' && !filename.startsWith('blob:')) {
        return decodeURIComponent(filename).slice(0, 60);
      }
      return url.hostname;
    } catch {
      return src.slice(0, 60);
    }
  }

  return 'Video';
}

function discoverVideos() {
  const videos = document.querySelectorAll('video');
  return Array.from(videos).map((video, index) => ({
    index,
    src: video.currentSrc || video.src || '',
    title: deriveTitle(video),
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

// Notify service worker about video presence on this page
function notifyVideoStatus() {
  const hasVideo = document.querySelectorAll('video').length > 0;
  chrome.runtime.sendMessage({ action: 'VIDEO_STATUS', hasVideo }).catch(() => {});
}

// Initial check
notifyVideoStatus();

// Watch for dynamically added/removed videos
const observer = new MutationObserver(() => notifyVideoStatus());
observer.observe(document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'GET_VIDEOS': {
      sendResponse({ videos: discoverVideos() });
      return false;
    }

    case 'SET_SPEED': {
      const video = document.querySelectorAll('video')[message.videoIndex];
      if (video) {
        video.playbackRate = message.speed;
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

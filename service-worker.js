const ICON_ACTIVE = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png'
};

const ICON_INACTIVE = {
  16: 'icons/icon16-inactive.png',
  32: 'icons/icon32-inactive.png',
  48: 'icons/icon48-inactive.png',
  128: 'icons/icon128-inactive.png'
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('jkSpeed extension installed');
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'VIDEO_STATUS' && sender.tab) {
    const tabId = sender.tab.id;
    chrome.action.setIcon({
      tabId,
      path: message.hasVideo ? ICON_ACTIVE : ICON_INACTIVE
    });
  }
});

async function checkTabForVideos(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (!frames) return;
    const results = await Promise.allSettled(
      frames.map(frame =>
        chrome.tabs.sendMessage(tabId, { action: 'GET_VIDEOS' }, { frameId: frame.frameId })
      )
    );
    const hasVideo = results.some(
      r => r.status === 'fulfilled' && r.value?.videos?.length > 0
    );
    chrome.action.setIcon({ tabId, path: hasVideo ? ICON_ACTIVE : ICON_INACTIVE });
  } catch {
    // Tab may not have content script yet
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  checkTabForVideos(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    checkTabForVideos(tabId);
  }
});

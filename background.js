// YouTube Ad Skipper - Background Service Worker (Manifest V3)

const DEFAULT_SETTINGS = {
  autoSkip: true,
  muteAds: true,
  speedUp: true,
  skipInterval: 0,
  showNotifications: false,
  blockBanners: true
};

const DEFAULT_STATS = {
  adsSkipped: 0,
  timeSavedSeconds: 0
};

// Inject content scripts into any existing YouTube tabs
async function injectIntoExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["css/ad-skipper.css"]
          });
        } catch (_) {}

        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["inpage.js"],
            world: "MAIN"
          });
        } catch (_) {}

        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          });
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn("[AdSkipper] Error injecting into existing tabs:", err);
  }
}

// Extension installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[AdSkipper] Extension ${details.reason}`);

  if (details.reason === "install") {
    chrome.storage.sync.set(DEFAULT_SETTINGS);
    chrome.storage.local.set(DEFAULT_STATS);
  }

  // Inject into open YouTube tabs
  await injectIntoExistingTabs();
});

// Update badge with skipped count
async function updateBadge() {
  try {
    const data = await chrome.storage.local.get("adsSkipped");
    const count = data.adsSkipped || 0;
    if (count > 0) {
      const text = count > 999 ? `${(count / 1000).toFixed(1)}k` : `${count}`;
      chrome.action.setBadgeText({ text });
      chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (_) {}
}

// Handle runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "GET_SETTINGS":
      chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        sendResponse(settings);
      });
      return true;

    case "SAVE_SETTINGS":
      chrome.storage.sync.set(message.settings, () => {
        sendResponse({ success: true });
      });
      return true;

    case "GET_STATS":
      chrome.storage.local.get(DEFAULT_STATS, (stats) => {
        sendResponse(stats);
      });
      return true;

    case "RESET_STATS":
      chrome.storage.local.set(DEFAULT_STATS, () => {
        updateBadge();
        sendResponse({ success: true });
      });
      return true;

    case "AD_SKIPPED":
      updateBadge();
      sendResponse({ success: true });
      return true;

    default:
      sendResponse({ error: "Unknown message type" });
      return false;
  }
});

// Alarms for keep-alive (safely guarded)
if (typeof chrome !== "undefined" && chrome?.alarms?.create) {
  try {
    chrome.alarms.create("keepAlive", { periodInMinutes: 4 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "keepAlive") {
        updateBadge();
      }
    });
  } catch (_) {}
}

// Initial badge update on service worker start
updateBadge();

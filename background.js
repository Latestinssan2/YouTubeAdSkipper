// YouTube Ad Skipper - Background Service Worker
// Handles extension lifecycle and communication

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[AdSkipper] Extension installed");

    // Set default settings
    chrome.storage.sync.set({
      skipInterval: 5,
      muteAds: true,
      autoSkip: true,
      showNotifications: false
    });

    // Open popup on first install
    chrome.tabs.create({ url: "popup.html" });
  } else if (details.reason === "update") {
    console.log("[AdSkipper] Extension updated");
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "GET_SETTINGS":
      chrome.storage.sync.get(
        ["skipInterval", "muteAds", "autoSkip", "showNotifications"],
        (result) => {
          sendResponse(result);
        }
      );
      return true;

    case "SAVE_SETTINGS":
      chrome.storage.sync.set(message.settings, () => {
        sendResponse({ success: true });
      });
      return true;

    case "AD_DETECTED":
      console.log("[AdSkipper] Ad detected on tab:", sender.tab?.url);
      sendResponse({ success: true });
      return true;

    default:
      sendResponse({ error: "Unknown message type" });
      return false;
  }
});

// Keep service worker alive
chrome.alarms.create("keepAlive", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    // Service worker is alive
  }
});
// YouTube Ad Skipper - Popup Script
// Handles the extension popup UI

const Popup = (() => {
  let settings = {
    skipInterval: 5,
    muteAds: true,
    autoSkip: true,
    showNotifications: false
  };

  // DOM elements
  const autoSkipCheckbox = document.getElementById("autoSkip");
  const muteAdsCheckbox = document.getElementById("muteAds");
  const showNotificationsCheckbox = document.getElementById("showNotifications");
  const skipIntervalInput = document.getElementById("skipInterval");
  const statusText = document.getElementById("statusText");
  const testSkipButton = document.getElementById("testSkip");
  const openYoutubeButton = document.getElementById("openYoutube");

  // Load settings
  function loadSettings() {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      if (response) {
        settings = { ...settings, ...response };
        updateUI();
      }
    });
  }

  // Update UI with current settings
  function updateUI() {
    autoSkipCheckbox.checked = settings.autoSkip;
    muteAdsCheckbox.checked = settings.muteAds;
    showNotificationsCheckbox.checked = settings.showNotifications;
    skipIntervalInput.value = settings.skipInterval;
  }

  // Save settings
  function saveSettings() {
    settings.autoSkip = autoSkipCheckbox.checked;
    settings.muteAds = muteAdsCheckbox.checked;
    settings.showNotifications = showNotificationsCheckbox.checked;
    settings.skipInterval = parseInt(skipIntervalInput.value) || 5;

    chrome.runtime.sendMessage(
      { type: "SAVE_SETTINGS", settings: settings },
      (response) => {
        if (response?.success) {
          showStatus("Settings saved");
        }
      }
    );
  }

  // Show status message
  function showStatus(message) {
    statusText.textContent = message;
    setTimeout(() => {
      statusText.textContent = "Ready";
    }, 2000);
  }

  // Test skip on current tab
  function testSkip() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TEST_SKIP" }, (response) => {
          if (chrome.runtime.lastError) {
            showStatus("Not on YouTube");
          } else {
            showStatus("Skip test sent");
          }
        });
      } else {
        showStatus("No active tab");
      }
    });
  }

  // Open YouTube
  function openYoutube() {
    chrome.tabs.create({ url: "https://www.youtube.com" });
  }

  // Event listeners
  function init() {
    loadSettings();

    autoSkipCheckbox.addEventListener("change", saveSettings);
    muteAdsCheckbox.addEventListener("change", saveSettings);
    showNotificationsCheckbox.addEventListener("change", saveSettings);
    skipIntervalInput.addEventListener("change", saveSettings);

    testSkipButton.addEventListener("click", testSkip);
    openYoutubeButton.addEventListener("click", openYoutube);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => Popup.init());
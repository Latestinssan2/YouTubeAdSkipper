// YouTube Ad Skipper - Options Script
// Handles the extension options page

const Options = (() => {
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
  const saveButton = document.getElementById("save");
  const resetButton = document.getElementById("reset");

  // Load settings
  function loadSettings() {
    chrome.storage.sync.get(
      ["skipInterval", "muteAds", "autoSkip", "showNotifications"],
      (result) => {
        settings = { ...settings, ...result };
        updateUI();
      }
    );
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

    chrome.storage.sync.set(settings, () => {
      showStatus("Settings saved successfully!");
    });
  }

  // Reset to defaults
  function resetSettings() {
    settings = {
      skipInterval: 5,
      muteAds: true,
      autoSkip: true,
      showNotifications: false
    };

    chrome.storage.sync.set(settings, () => {
      updateUI();
      showStatus("Settings reset to defaults!");
    });
  }

  // Show status message
  function showStatus(message) {
    const status = document.createElement("div");
    status.textContent = message;
    status.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(status);
    setTimeout(() => status.remove(), 2000);
  }

  // Event listeners
  function init() {
    loadSettings();

    saveButton.addEventListener("click", saveSettings);
    resetButton.addEventListener("click", resetSettings);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => Options.init());
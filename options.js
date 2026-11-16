// YouTube Ad Skipper - Options Page Script

(() => {
  "use strict";

  const DEFAULTS = {
    autoSkip: true,
    muteAds: true,
    speedUp: true,
    blockBanners: true,
    showNotifications: false
  };

  const autoSkipToggle = document.getElementById("autoSkip");
  const muteAdsToggle = document.getElementById("muteAds");
  const speedUpToggle = document.getElementById("speedUp");
  const blockBannersToggle = document.getElementById("blockBanners");
  const showNotificationsToggle = document.getElementById("showNotifications");

  const optAdsSkipped = document.getElementById("optAdsSkipped");
  const optTimeSaved = document.getElementById("optTimeSaved");

  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const resetStatsBtn = document.getElementById("resetStatsBtn");

  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return "0m";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs > 0 ? secs + 's' : ''}`;
  }

  function loadSettings() {
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      autoSkipToggle.checked = settings.autoSkip;
      muteAdsToggle.checked = settings.muteAds;
      speedUpToggle.checked = settings.speedUp;
      blockBannersToggle.checked = settings.blockBanners;
      showNotificationsToggle.checked = settings.showNotifications;
    });

    loadStats();
  }

  function loadStats() {
    chrome.storage.local.get(["adsSkipped", "timeSavedSeconds"], (stats) => {
      optAdsSkipped.textContent = stats.adsSkipped || 0;
      optTimeSaved.textContent = formatTime(stats.timeSavedSeconds || 0);
    });
  }

  function showBanner(text, isError = false) {
    const existing = document.getElementById("optionsNotice");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = "optionsNotice";
    banner.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      background: ${isError ? "#e74c3c" : "#2ecc71"};
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      z-index: 99999;
      animation: fadeIn 0.2s ease-out;
    `;
    banner.textContent = text;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2500);
  }

  function saveSettings() {
    const newSettings = {
      autoSkip: autoSkipToggle.checked,
      muteAds: muteAdsToggle.checked,
      speedUp: speedUpToggle.checked,
      blockBanners: blockBannersToggle.checked,
      showNotifications: showNotificationsToggle.checked
    };

    chrome.storage.sync.set(newSettings, () => {
      showBanner("Settings saved successfully!");
    });
  }

  function resetSettings() {
    chrome.storage.sync.set(DEFAULTS, () => {
      autoSkipToggle.checked = DEFAULTS.autoSkip;
      muteAdsToggle.checked = DEFAULTS.muteAds;
      speedUpToggle.checked = DEFAULTS.speedUp;
      blockBannersToggle.checked = DEFAULTS.blockBanners;
      showNotificationsToggle.checked = DEFAULTS.showNotifications;
      showBanner("Settings reset to defaults.");
    });
  }

  function resetStats() {
    chrome.storage.local.set({ adsSkipped: 0, timeSavedSeconds: 0 }, () => {
      optAdsSkipped.textContent = "0";
      optTimeSaved.textContent = "0m";
      showBanner("Statistics reset.");
    });
  }

  saveBtn.addEventListener("click", saveSettings);
  resetBtn.addEventListener("click", resetSettings);
  resetStatsBtn.addEventListener("click", resetStats);

  loadSettings();
})();

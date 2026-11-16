// YouTube Ad Skipper - Modern Popup Controller

(() => {
  "use strict";

  // Elements
  const statusBanner = document.getElementById("statusBanner");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const adsSkippedCount = document.getElementById("adsSkippedCount");
  const timeSavedCount = document.getElementById("timeSavedCount");

  const autoSkipToggle = document.getElementById("autoSkip");
  const muteAdsToggle = document.getElementById("muteAds");
  const speedUpToggle = document.getElementById("speedUp");
  const blockBannersToggle = document.getElementById("blockBanners");

  const testSkipBtn = document.getElementById("testSkip");
  const openYoutubeBtn = document.getElementById("openYoutube");
  const optionsBtn = document.getElementById("optionsBtn");

  let currentTab = null;

  // Format seconds into readable time (e.g. 1m 30s)
  function formatTime(seconds) {
    if (!seconds || seconds <= 0) return "0m";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs > 0 ? secs + 's' : ''}`;
  }

  // Update Status Banner UI
  function setStatus(state, message) {
    statusBanner.className = `status-banner ${state}`;
    statusText.textContent = message;
  }

  // Load stats
  function loadStats() {
    chrome.storage.local.get(["adsSkipped", "timeSavedSeconds"], (data) => {
      const skipped = data.adsSkipped || 0;
      const saved = data.timeSavedSeconds || 0;
      adsSkippedCount.textContent = skipped;
      timeSavedCount.textContent = formatTime(saved);
    });
  }

  // Load settings
  function loadSettings() {
    chrome.storage.sync.get(
      ["autoSkip", "muteAds", "speedUp", "blockBanners"],
      (settings) => {
        if (settings) {
          if (settings.autoSkip !== undefined) autoSkipToggle.checked = settings.autoSkip;
          if (settings.muteAds !== undefined) muteAdsToggle.checked = settings.muteAds;
          if (settings.speedUp !== undefined) speedUpToggle.checked = settings.speedUp;
          if (settings.blockBanners !== undefined) blockBannersToggle.checked = settings.blockBanners;
        }
      }
    );
  }

  // Save single setting
  function saveSetting(key, value) {
    const patch = { [key]: value };
    chrome.storage.sync.set(patch);

    // If active on YouTube tab, notify content script immediately
    if (currentTab?.id && isYouTubeUrl(currentTab.url)) {
      chrome.tabs.sendMessage(currentTab.id, {
        type: "UPDATE_SETTINGS",
        settings: patch
      }).catch(() => {});
    }
  }

  // Check URL
  function isYouTubeUrl(url) {
    return Boolean(url && (url.includes("youtube.com") || url.includes("youtu.be")));
  }

  // Ensure content script is injected and check tab state
  async function checkTabStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tab;

      if (!tab || !tab.url) {
        setStatus("inactive", "No active webpage");
        return;
      }

      if (!isYouTubeUrl(tab.url)) {
        setStatus("inactive", "Not on YouTube");
        return;
      }

      // Tab IS YouTube! Send ping or get status
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" });
        if (response && response.isYouTube) {
          if (response.isAd) {
            setStatus("ad-detected", "Ad Detected: Skipping...");
          } else {
            setStatus("active", "Active on YouTube");
          }
          if (response.stats) {
            adsSkippedCount.textContent = response.stats.adsSkipped || 0;
            timeSavedCount.textContent = formatTime(response.stats.timeSavedSeconds || 0);
          }
          return;
        }
      } catch (err) {
        // Content script might not be injected yet (e.g. extension just installed)
        // Inject dynamically:
        try {
          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["css/ad-skipper.css"]
          });
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          });
          setStatus("active", "Active on YouTube");
        } catch (injectionErr) {
          setStatus("active", "YouTube Detected (Refresh to sync)");
        }
      }
    } catch (e) {
      console.warn("checkTabStatus error", e);
      setStatus("inactive", "Extension ready");
    }
  }

  // Test skip action
  async function handleTestSkip() {
    if (!currentTab || !isYouTubeUrl(currentTab.url)) {
      setStatus("inactive", "Open YouTube to test skip");
      setTimeout(() => checkTabStatus(), 2000);
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, { type: "TEST_SKIP" });
      if (response?.success) {
        setStatus("active", response.isAd ? "Ad Skipped!" : "Ad Skipper Active & Ready");
        loadStats();
        setTimeout(() => checkTabStatus(), 2500);
      } else {
        setStatus("active", "Ad Skipper Connected");
      }
    } catch (err) {
      // Try to inject if disconnected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ["content.js"]
        });
        setStatus("active", "Ad Skipper Injected & Ready");
      } catch (_) {
        setStatus("inactive", "Please reload YouTube tab");
      }
    }
  }

  // Open YouTube
  function handleOpenYoutube() {
    chrome.tabs.create({ url: "https://www.youtube.com" });
    window.close();
  }

  // Open Options page
  function handleOpenOptions(e) {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  }

  // Listeners
  autoSkipToggle.addEventListener("change", (e) => saveSetting("autoSkip", e.target.checked));
  muteAdsToggle.addEventListener("change", (e) => saveSetting("muteAds", e.target.checked));
  speedUpToggle.addEventListener("change", (e) => saveSetting("speedUp", e.target.checked));
  blockBannersToggle.addEventListener("change", (e) => saveSetting("blockBanners", e.target.checked));

  testSkipBtn.addEventListener("click", handleTestSkip);
  openYoutubeBtn.addEventListener("click", handleOpenYoutube);
  optionsBtn.addEventListener("click", handleOpenOptions);

  // Init
  loadSettings();
  loadStats();
  checkTabStatus();
})();

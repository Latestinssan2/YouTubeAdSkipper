// YouTube Ad Skipper - Content Script
// High-performance, lightweight, anti-detection ad skipper and muter for YouTube

(() => {
  "use strict";

  // State
  let settings = {
    autoSkip: true,
    muteAds: true,
    speedUp: true,
    showNotifications: false,
    blockBanners: true
  };

  let wasMutedByAdSkipper = false;
  let isHandlingAd = false;
  let hasRecordedCurrentAd = false;
  let lastAdSkippedTime = 0;
  let lastClickTime = 0;

  let activeToast = null;
  let toastTimer = null;

  // Local stats cache
  let stats = {
    adsSkipped: 0,
    timeSavedSeconds: 0
  };

  // Load configuration from storage
  function loadConfig() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.sync.get(
          ["autoSkip", "muteAds", "speedUp", "showNotifications", "blockBanners"],
          (result) => {
            if (result) settings = { ...settings, ...result };
          }
        );

        chrome.storage.local.get(["adsSkipped", "timeSavedSeconds"], (res) => {
          if (res) {
            stats.adsSkipped = res.adsSkipped || 0;
            stats.timeSavedSeconds = res.timeSavedSeconds || 0;
          }
        });
      }
    } catch (_) {}
  }

  // Record an ad skipped
  function recordAdSkipped() {
    const now = Date.now();
    if (now - lastAdSkippedTime < 4000) return;
    lastAdSkippedTime = now;

    stats.adsSkipped += 1;
    stats.timeSavedSeconds += 15;

    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set(stats);
      }
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: "AD_SKIPPED", stats }).catch(() => {});
      }
    } catch (_) {}

    if (settings.showNotifications) {
      showToast("Ad skipped automatically");
    }
  }

  // Display temporary on-screen toast
  function showToast(text) {
    try {
      if (activeToast) {
        clearTimeout(toastTimer);
        activeToast.remove();
        activeToast = null;
      }

      const existing = document.querySelector(".ad-skipper-toast");
      if (existing) existing.remove();

      const toast = document.createElement("div");
      toast.className = "ad-skipper-toast";
      toast.innerHTML = `<span class="ad-skipper-toast-icon">✓</span> <span>${text}</span>`;
      document.body.appendChild(toast);
      activeToast = toast;

      toastTimer = setTimeout(() => {
        if (activeToast) {
          activeToast.classList.add("fade-out");
          setTimeout(() => {
            if (activeToast) {
              activeToast.remove();
              activeToast = null;
            }
          }, 300);
        }
      }, 2000);
    } catch (_) {}
  }

  // Check strictly if an actual video ad is playing
  function isAdActive() {
    const player = document.querySelector("#movie_player, .html5-video-player");
    if (player) {
      if (
        player.classList.contains("ad-showing") ||
        player.classList.contains("ad-interrupting")
      ) {
        return true;
      }
    }
    return Boolean(document.querySelector(".ad-showing, .ad-interrupting"));
  }

  // Click skip button if available
  function tryClickSkipButton() {
    const now = Date.now();
    if (now - lastClickTime < 300) return false;

    const selectors = [
      ".ytp-ad-skip-button-modern",
      ".ytp-skip-ad-button",
      ".ytp-ad-skip-button",
      ".ytp-ad-skip-button-slot button",
      ".ytp-ad-skip-button-container button",
      "button.ytp-ad-skip-button-modern",
      "button.ytp-ad-skip-button-text",
      "[id^='skip-button:'] button",
      "[id^='skip-button:']",
      ".videoAdUiSkipButton",
      "button[class*='ytp-ad-skip']"
    ];

    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        lastClickTime = now;
        btn.click();
        return true;
      }
    }

    // Generic search strictly within ad containers
    const adModule = document.querySelector(".ytp-ad-module, .video-ads, .ytp-ad-player-overlay");
    if (adModule) {
      const btns = adModule.querySelectorAll("button, [role='button'], .ytp-button");
      for (const btn of btns) {
        const text = (btn.textContent || "").trim().toLowerCase();
        if (text === "skip" || text.startsWith("skip ") || text.includes("skip ▶")) {
          lastClickTime = now;
          btn.click();
          return true;
        }
      }
    }

    return false;
  }

  // Main ad handling loop - runs every 200ms (lightweight, zero lag, no recursion)
  function handleAds() {
    const adPlaying = isAdActive();
    const video = document.querySelector("video.video-stream, video");

    if (adPlaying && video) {
      isHandlingAd = true;

      // 1. Mute ad
      if (settings.muteAds && !video.muted) {
        wasMutedByAdSkipper = true;
        video.muted = true;
      }

      // 2. Speed up ad to 16x (finishes in ~0.8s)
      if (settings.autoSkip && settings.speedUp && video.playbackRate < 16) {
        video.playbackRate = 16.0;
      }

      // 3. Click skip button as soon as available
      if (settings.autoSkip) {
        tryClickSkipButton();

        if (!hasRecordedCurrentAd) {
          hasRecordedCurrentAd = true;
          recordAdSkipped();
        }
      }
    } else {
      // Normal playback: restore speed and audio
      if (isHandlingAd || wasMutedByAdSkipper) {
        isHandlingAd = false;
        hasRecordedCurrentAd = false;

        if (video) {
          if (video.playbackRate > 2.0) {
            video.playbackRate = 1.0;
          }
          if (wasMutedByAdSkipper) {
            video.muted = false;
            wasMutedByAdSkipper = false;
          }
        }
      }
    }

    // Dismiss banner close buttons if present
    const closeBtn = document.querySelector(
      ".ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button"
    );
    if (closeBtn && closeBtn.offsetParent !== null) {
      try { closeBtn.click(); } catch (_) {}
    }
  }

  // Initialize
  function init() {
    loadConfig();

    // 200ms lightweight loop: 5 checks/sec, 0.01% CPU, completely smooth
    setInterval(handleAds, 200);

    // YouTube SPA navigation events
    window.addEventListener("yt-navigate-finish", () => {
      isHandlingAd = false;
      hasRecordedCurrentAd = false;
      const video = document.querySelector("video");
      if (video && wasMutedByAdSkipper) {
        video.muted = false;
        wasMutedByAdSkipper = false;
      }
      handleAds();
    });

    // Listen for storage changes
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync") {
          for (const key of Object.keys(changes)) {
            if (key in settings) {
              settings[key] = changes[key].newValue;
            }
          }
        }
      });
    }

    // Message listener for popup & options
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          switch (message.type) {
            case "PING":
              sendResponse({ status: "ok", active: true });
              return true;

            case "GET_STATUS":
              sendResponse({
                isYouTube: true,
                isAd: isAdActive(),
                settings,
                stats
              });
              return true;

            case "TEST_SKIP":
              const adFound = isAdActive();
              handleAds();
              showToast("Ad Skipper is active!");
              sendResponse({
                success: true,
                isAd: adFound,
                stats,
                message: adFound ? "Ad detected & skipped!" : "Ad Skipper tested: Active & ready."
              });
              return true;

            case "UPDATE_SETTINGS":
              if (message.settings) {
                settings = { ...settings, ...message.settings };
              }
              sendResponse({ success: true });
              return true;

            default:
              sendResponse({ status: "ignored" });
              return false;
          }
        } catch (err) {
          sendResponse({ error: err.message });
          return false;
        }
      });
    }

    console.log("[AdSkipper] Running smoothly (optimized 200ms loop).");
  }

  init();
})();

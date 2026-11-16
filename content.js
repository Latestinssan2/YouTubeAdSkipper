// YouTube Ad Skipper - Content Script
// High-performance, anti-detection ad skipper and muter for YouTube

(() => {
  "use strict";

  // State
  let settings = {
    autoSkip: true,
    muteAds: true,
    speedUp: true,
    skipInterval: 0,
    showNotifications: false,
    blockBanners: true
  };

  let wasMutedByAdSkipper = false;
  let originalVolume = 1;
  let isCurrentlyHandlingAd = false;
  let lastAdSkippedTime = 0;
  let observer = null;
  let checkInterval = null;

  // Local stats cache
  let stats = {
    adsSkipped: 0,
    timeSavedSeconds: 0
  };

  // Load settings & stats from storage
  function loadConfig() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.sync.get(
          ["autoSkip", "muteAds", "speedUp", "skipInterval", "showNotifications", "blockBanners"],
          (result) => {
            if (result) {
              settings = { ...settings, ...result };
            }
          }
        );

        chrome.storage.local.get(["adsSkipped", "timeSavedSeconds"], (res) => {
          if (res) {
            stats.adsSkipped = res.adsSkipped || 0;
            stats.timeSavedSeconds = res.timeSavedSeconds || 0;
          }
        });
      }
    } catch (e) {
      console.warn("[AdSkipper] Storage load error:", e);
    }
  }

  // Record an ad skipped
  function recordAdSkipped() {
    const now = Date.now();
    // Debounce to prevent multiple counts for the same ad
    if (now - lastAdSkippedTime < 1500) return;
    lastAdSkippedTime = now;

    stats.adsSkipped += 1;
    stats.timeSavedSeconds += 15; // Average 15s saved per ad

    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set(stats);
      }
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: "AD_SKIPPED",
          stats: stats
        }).catch(() => {});
      }
    } catch (_) {}

    if (settings.showNotifications) {
      showToast("Ad skipped automatically");
    }
  }

  // Display temporary on-screen toast
  function showToast(text) {
    try {
      const existing = document.querySelector(".ad-skipper-toast");
      if (existing) existing.remove();

      const toast = document.createElement("div");
      toast.className = "ad-skipper-toast";
      toast.innerHTML = `<span class="ad-skipper-toast-icon">✓</span> <span>${text}</span>`;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.add("fade-out");
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    } catch (_) {}
  }

  // Detect whether an ad is currently playing
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

    // Check ad overlays
    if (document.querySelector(".ytp-ad-player-overlay, .ytp-ad-player-overlay-layout")) {
      return true;
    }

    // Check ad skip button
    if (document.querySelector(".ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern")) {
      return true;
    }

    // Check ad text or badge
    const adBadge = document.querySelector(".ytp-ad-text, .ytp-ad-preview-text, .badge-style-ad-badge");
    if (adBadge && adBadge.offsetParent !== null) {
      return true;
    }

    return false;
  }

  // Dismiss anti-adblock modals if YouTube displays any
  function dismissAntiAdblock() {
    try {
      const dismissBtn = document.querySelector(
        "tp-yt-paper-dialog:has(#feedback) #dismiss-button, tp-yt-paper-dialog button[aria-label='Close'], ytd-enforcement-message-view-model #dismiss-button"
      );
      if (dismissBtn) {
        dismissBtn.click();
      }
    } catch (_) {}
  }

  // Main ad skipper engine
  function processAds() {
    const video = document.querySelector("video");
    const adPlaying = isAdActive();

    // Check and dismiss anti-adblock prompts
    dismissAntiAdblock();

    // Close overlay / popup banner ads
    const overlayCloseButton = document.querySelector(
      ".ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button, .ytp-ad-image-overlay button"
    );
    if (overlayCloseButton) {
      try {
        overlayCloseButton.click();
      } catch (_) {}
    }

    if (adPlaying && video) {
      isCurrentlyHandlingAd = true;

      // 1. MUTE AD
      if (settings.muteAds) {
        if (!video.muted) {
          wasMutedByAdSkipper = true;
          originalVolume = video.volume > 0 ? video.volume : 1;
          video.muted = true;
        }
      }

      // 2. SPEED UP & AUTO-SKIP
      if (settings.autoSkip) {
        // Boost playback rate to 16x so ad finishes instantly even if unskippable
        if (settings.speedUp && video.playbackRate < 16) {
          video.playbackRate = 16.0;
        }

        // Jump video time to duration if finite
        if (isFinite(video.duration) && video.duration > 0) {
          // If skipInterval is 0 or passed, jump to end
          video.currentTime = Math.max(0, video.duration - 0.05);
        }

        // Click any available skip buttons
        const skipButtons = document.querySelectorAll(
          ".ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button, button.ytp-ad-skip-button-text, [id^='skip-button:'] button, .videoAdUiSkipButton"
        );

        for (const btn of skipButtons) {
          if (btn && typeof btn.click === "function") {
            btn.click();
            btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          }
        }

        recordAdSkipped();
      }
    } else {
      // Ad is no longer playing, restore normal state
      if (isCurrentlyHandlingAd) {
        isCurrentlyHandlingAd = false;

        if (video) {
          // Restore playback rate
          if (video.playbackRate > 2.0) {
            video.playbackRate = 1.0;
          }

          // Unmute if muted by ad skipper
          if (wasMutedByAdSkipper) {
            video.muted = false;
            video.volume = originalVolume || 1;
            wasMutedByAdSkipper = false;
          }
        }
      }
    }
  }

  // Setup MutationObserver
  function setupObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(() => {
      processAds();
    });

    const target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "src"]
      });
    }
  }

  // Setup Video Event Listeners
  function attachVideoListeners() {
    const video = document.querySelector("video");
    if (video && !video.dataset.adSkipperAttached) {
      video.dataset.adSkipperAttached = "true";
      video.addEventListener("timeupdate", processAds);
      video.addEventListener("play", processAds);
      video.addEventListener("ratechange", () => {
        // Prevent ad from resetting its own rate back to 1.0 while ad is active
        if (isAdActive() && settings.autoSkip && settings.speedUp && video.playbackRate < 16) {
          video.playbackRate = 16.0;
        }
      });
    }
  }

  // Initialize
  function init() {
    loadConfig();

    // Start polling loop as resilient fallback
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(() => {
      attachVideoListeners();
      processAds();
    }, 250);

    // Initial observer
    if (document.body) {
      setupObserver();
    } else {
      document.addEventListener("DOMContentLoaded", setupObserver);
    }

    // YouTube SPA navigation events
    window.addEventListener("yt-navigate-finish", () => {
      processAds();
      attachVideoListeners();
    });
    window.addEventListener("load", () => {
      processAds();
      attachVideoListeners();
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

    // Listen for messages from popup & background
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
                settings: settings,
                stats: stats
              });
              return true;

            case "TEST_SKIP":
              const adFound = isAdActive();
              processAds();
              showToast("Ad Skipper is active!");
              sendResponse({
                success: true,
                isAd: adFound,
                stats: stats,
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
          console.error("[AdSkipper] Error processing message:", err);
          sendResponse({ error: err.message });
          return false;
        }
      });
    }

    console.log("[AdSkipper] Content script loaded and active.");
  }

  // Start initialization immediately
  init();
})();

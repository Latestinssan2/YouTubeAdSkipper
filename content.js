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
  let isCurrentlyHandlingAd = false;
  let hasRecordedCurrentAd = false;
  let lastAdSkippedTime = 0;
  let observer = null;
  let checkInterval = null;

  let activeToast = null;
  let toastTimer = null;
  let toastFadeTimer = null;

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
    if (now - lastAdSkippedTime < 4000) return;
    lastAdSkippedTime = now;

    stats.adsSkipped += 1;
    stats.timeSavedSeconds += 15;

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
      if (activeToast) {
        clearTimeout(toastTimer);
        clearTimeout(toastFadeTimer);
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
          toastFadeTimer = setTimeout(() => {
            if (activeToast) {
              activeToast.remove();
              activeToast = null;
            }
          }, 300);
        }
      }, 2200);
    } catch (_) {}
  }

  // Detect strictly whether an actual video ad is currently playing
  function isAdActive() {
    const player = document.querySelector("#movie_player, .html5-video-player");
    if (!player) return false;

    // The official, unambiguous YouTube ad class markers
    return player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting");
  }

  // Simulate human click sequence on button
  function clickElement(el) {
    if (!el) return;
    const target = el.closest("button, [role='button'], .ytp-button") || el;

    const rect = target.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const commonOpts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY,
      buttons: 1
    };

    const events = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];
    for (const evtName of events) {
      try {
        const isPointer = evtName.startsWith("pointer");
        const Evt = isPointer && typeof PointerEvent !== "undefined" ? PointerEvent : MouseEvent;
        target.dispatchEvent(new Evt(evtName, commonOpts));
      } catch (_) {}
    }

    try {
      target.click();
    } catch (_) {}
  }

  // Find and click any skip buttons if an ad is playing
  function clickSkipButtonIfPresent() {
    // Known skip button selectors
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
      "button[class*='ytp-ad-skip']",
      "button[class*='skip-button']"
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        clickElement(el);
        return true;
      }
    }

    // Generic search scoped strictly inside the ad module
    const adModule = document.querySelector(".ytp-ad-module, .video-ads, .ytp-ad-player-overlay");
    if (adModule) {
      const buttons = adModule.querySelectorAll("button, [role='button'], .ytp-button");
      for (const btn of buttons) {
        const text = (btn.textContent || btn.innerText || "").trim().toLowerCase();
        if (text === "skip" || text.startsWith("skip ") || text.includes("skip ▶")) {
          clickElement(btn);
          return true;
        }
      }
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
    const adPlaying = isAdActive();
    const video = document.querySelector("video.video-stream, video");

    if (adPlaying && video) {
      isCurrentlyHandlingAd = true;

      // 1. MUTE AD
      if (settings.muteAds) {
        if (!video.muted) {
          wasMutedByAdSkipper = true;
          video.muted = true;
        }
      }

      // 2. SPEED UP & CLICK SKIP
      if (settings.autoSkip) {
        // Boost playback rate to 16x during ads (finishes in ~0.8s)
        if (settings.speedUp && video.playbackRate < 16) {
          video.playbackRate = 16.0;
        }

        // Click skip button immediately
        clickSkipButtonIfPresent();

        // Record strictly ONCE per ad sequence
        if (!hasRecordedCurrentAd) {
          hasRecordedCurrentAd = true;
          recordAdSkipped();
        }
      }
    } else {
      // Normal video playback: Restore volume and speed immediately
      if (isCurrentlyHandlingAd || wasMutedByAdSkipper) {
        isCurrentlyHandlingAd = false;

        setTimeout(() => {
          hasRecordedCurrentAd = false;
        }, 1500);

        if (video) {
          // Restore 1.0x playback rate
          if (video.playbackRate > 2.0) {
            video.playbackRate = 1.0;
          }

          // Unmute if muted by ad skipper
          if (wasMutedByAdSkipper) {
            video.muted = false;
            wasMutedByAdSkipper = false;
          }
        }
      }
    }

    // Dismiss banner close buttons and anti-adblock if present
    const overlayCloseButtons = document.querySelectorAll(
      ".ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button, .ytp-ad-image-overlay button"
    );
    for (const closeBtn of overlayCloseButtons) {
      try { closeBtn.click(); } catch (_) {}
    }
    dismissAntiAdblock();
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
      video.addEventListener("play", processAds);
      video.addEventListener("ratechange", () => {
        if (isAdActive() && settings.autoSkip && settings.speedUp && video.playbackRate < 16) {
          video.playbackRate = 16.0;
        }
      });
    }
  }

  // Initialize
  function init() {
    loadConfig();

    // High-frequency 50ms polling loop
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(() => {
      attachVideoListeners();
      processAds();
    }, 50);

    // Initial observer
    if (document.body) {
      setupObserver();
    } else {
      document.addEventListener("DOMContentLoaded", setupObserver);
    }

    // YouTube SPA navigation events
    window.addEventListener("yt-navigate-finish", () => {
      // On new video navigation, reset mute flag so normal video isn't muted
      if (!isAdActive()) {
        const video = document.querySelector("video");
        if (video && wasMutedByAdSkipper) {
          video.muted = false;
          wasMutedByAdSkipper = false;
        }
      }
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

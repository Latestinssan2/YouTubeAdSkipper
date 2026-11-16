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

  // Inject in-page helper into Main World as fallback
  function injectMainWorldScript() {
    try {
      if (document.getElementById("ad-skipper-main-script")) return;
      const script = document.createElement("script");
      script.id = "ad-skipper-main-script";
      script.src = chrome.runtime.getURL("inpage.js");
      (document.head || document.documentElement).appendChild(script);
    } catch (_) {}
  }

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
    if (now - lastAdSkippedTime < 1500) return;
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

  // Find any skip button in the DOM across all modern and legacy variants
  function findSkipButton() {
    // 1. Selector list for known modern & legacy YouTube skip buttons
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
      "button[class*='skip-button']",
      "[class*='ytp-ad-skip-button']",
      "[class*='ytp-skip-ad-button']",
      "button[aria-label*='Skip' i]",
      "[aria-label*='Skip' i]",
      ".ytp-ad-skip-button-container *",
      ".ytp-ad-skip-button-slot *"
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        return el;
      }
    }

    // 2. Generic search: Any button or interactive element inside player containing "Skip"
    const player = document.querySelector("#movie_player, .html5-video-player, ytd-player");
    if (player) {
      const candidates = player.querySelectorAll("button, [role='button'], .ytp-button, div, span");
      for (const el of candidates) {
        if (el.children.length > 3) continue;
        const text = (el.textContent || el.innerText || "").trim().toLowerCase();
        if (
          text === "skip" ||
          text.startsWith("skip ") ||
          text.startsWith("skip ad") ||
          text.includes("skip ▶") ||
          text.includes("skip")
        ) {
          if (el.closest(".ytp-ad-module, .video-ads, .ytp-ad-player-overlay, #movie_player, .html5-video-player")) {
            return el;
          }
        }
      }
    }

    return null;
  }

  // Simulate a real human click sequence (pointerdown -> mousedown -> pointerup -> mouseup -> click)
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

  // Detect whether an ad is currently playing
  function isAdActive() {
    const player = document.querySelector("#movie_player, .html5-video-player, ytd-player");
    if (player) {
      if (
        player.classList.contains("ad-showing") ||
        player.classList.contains("ad-interrupting")
      ) {
        return true;
      }
    }

    // Check ad overlays and modules
    if (document.querySelector(".ytp-ad-player-overlay, .ytp-ad-player-overlay-layout, .ytp-ad-action-interstitial")) {
      return true;
    }

    // Check if video-ads container has active children
    const adModule = document.querySelector(".video-ads.ytp-ad-module, .ytp-ad-module");
    if (adModule && adModule.children.length > 0) {
      return true;
    }

    // If skip button is visible, ad is definitely active
    if (findSkipButton()) {
      return true;
    }

    // Check ad badges or sponsored labels
    const adBadge = document.querySelector(
      ".ytp-ad-text, .ytp-ad-preview-text, .ytp-ad-badge, .ytp-ad-simple-attributed-string, .badge-style-ad-badge"
    );
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
    // 1. Immediately click any skip buttons if visible
    const skipBtn = findSkipButton();
    if (skipBtn) {
      clickElement(skipBtn);
    }

    // 2. Close overlay / popup banner ads
    const overlayCloseButtons = document.querySelectorAll(
      ".ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button, .ytp-ad-image-overlay button"
    );
    for (const closeBtn of overlayCloseButtons) {
      try { closeBtn.click(); } catch (_) {}
    }

    // 3. Check and dismiss anti-adblock prompts
    dismissAntiAdblock();

    const adPlaying = isAdActive();
    const video = document.querySelector("video.video-stream, video");

    if (adPlaying && video) {
      isCurrentlyHandlingAd = true;

      // 1. MUTE AD
      if (settings.muteAds) {
        if (!video.muted) {
          wasMutedByAdSkipper = true;
          originalVolume = video.volume > 0 ? video.volume : 1;
          video.muted = true;
        }
        video.volume = 0;
      }

      // 2. SPEED UP & AUTO-SKIP
      if (settings.autoSkip) {
        // Boost playback rate to 16x
        if (settings.speedUp) {
          video.playbackRate = 16.0;
        }

        // Jump video time directly to end
        try {
          if (isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration;
          } else {
            video.currentTime = 999999;
          }
        } catch (_) {}

        // Ensure video is playing so the 'ended' event fires immediately
        if (video.paused) {
          try {
            video.play().catch(() => {});
          } catch (_) {}
        }

        // Re-check skip button after time jump
        const lateSkipBtn = findSkipButton();
        if (lateSkipBtn) {
          clickElement(lateSkipBtn);
        }

        recordAdSkipped();
      }
    } else {
      // Ad is no longer playing, restore normal playback
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
    injectMainWorldScript();

    // High-frequency 50ms polling loop as rock-solid safety net
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
      injectMainWorldScript();
      processAds();
      attachVideoListeners();
    });
    window.addEventListener("load", () => {
      injectMainWorldScript();
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

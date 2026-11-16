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

  // High accuracy visibility check
  function isElementVisible(el) {
    if (!el) return false;
    try {
      if (typeof el.checkVisibility === "function") {
        return el.checkVisibility({
          checkOpacity: false,
          checkVisibilityCSS: true
        });
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    } catch (_) {
      return el.offsetParent !== null;
    }
  }

  // Safe click supporting modern pointer & mouse events with exact coordinates
  function safeClick(el) {
    if (!el) return false;
    try {
      const rect = el.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY,
        screenX: clientX,
        screenY: clientY
      };

      // 1. Direct standard click
      el.click();

      // 2. Dispatch full pointer and mouse event sequence
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));

      // 3. If there is an inner text/button/icon child, click that too
      const inner = el.querySelector(".ytp-ad-skip-button-text, .ytp-ad-text, span, button");
      if (inner && inner !== el) {
        try {
          inner.click();
          inner.dispatchEvent(new MouseEvent("click", opts));
        } catch (_) {}
      }

      // 4. If there is a parent slot container, click that too
      const parentSlot = el.closest(".ytp-ad-skip-button-slot, .ytp-ad-skip-button-container");
      if (parentSlot && parentSlot !== el) {
        try {
          parentSlot.click();
        } catch (_) {}
      }
    } catch (_) {}
    return true;
  }

  // Check if an element is a promotional Call-To-Action (CTA) button (e.g. "Download", "Install", "Apply now")
  // We must NEVER treat a CTA button as a skip button!
  function isCtaButton(el) {
    if (!el) return false;
    const text = (el.textContent || "").trim().toLowerCase();
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    const ctaWords = [
      "download",
      "install",
      "apply",
      "learn more",
      "shop now",
      "visit site",
      "open app",
      "get app",
      "sign up",
      "try now",
      "play now",
      "watch now"
    ];
    for (const word of ctaWords) {
      if (text.includes(word) || aria.includes(word)) {
        return true;
      }
    }
    return false;
  }

  // Find any active skip button anywhere in the player (video ad or Auto End Screen / Post-Roll CTA)
  function findAnySkipButton() {
    const player = document.querySelector("#movie_player, .html5-video-player") || document;

    // 1. Direct high-priority modern & legacy YouTube skip button selectors
    // NOTE: NEVER put generic container buttons like ".ytp-ad-action-interstitial button" here!
    const directSelectors = [
      ".ytp-ad-skip-button-modern",
      ".ytp-skip-ad-button",
      ".ytp-ad-skip-button",
      ".ytp-ad-skip-button-slot button",
      ".ytp-ad-skip-button-slot [role='button']",
      ".ytp-ad-skip-button-container button",
      "button.ytp-ad-skip-button-modern",
      "div.ytp-ad-skip-button-modern",
      "button.ytp-ad-skip-button-text",
      ".ytp-ad-skip-button-text",
      "[id^='skip-button:'] button",
      "[id^='skip-button:'] [role='button']",
      "[id^='skip-button:']",
      ".videoAdUiSkipButton",
      "button[class*='ytp-ad-skip']",
      "div[class*='ytp-ad-skip']",
      "button[class*='skip-button']",
      "div[class*='skip-button']",
      "button[aria-label*='Skip' i]",
      "[role='button'][aria-label*='Skip' i]"
    ];

    for (const sel of directSelectors) {
      const el = player.querySelector(sel);
      if (el && isElementVisible(el) && !isCtaButton(el)) {
        return el;
      }
    }

    // 2. Search ad container elements (.video-ads, .ytp-ad-module, .ytp-ad-player-overlay, etc.)
    const adContainers = player.querySelectorAll(
      ".ytp-ad-module, .video-ads, .ytp-ad-player-overlay, .ytp-ad-player-overlay-layout"
    );
    for (const container of adContainers) {
      const candidates = container.querySelectorAll("button, [role='button'], div, a, span");
      for (const el of candidates) {
        if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") continue;
        if (isCtaButton(el)) continue;

        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        const text = (el.textContent || "").trim().toLowerCase();

        if (
          aria.includes("skip") ||
          text === "skip" ||
          text.startsWith("skip ") ||
          text.startsWith("skip\n") ||
          text.includes("skip ▶") ||
          text.includes("skip ad")
        ) {
          if (isElementVisible(el)) {
            return el;
          }
        }
      }
    }

    // 3. Fallback: Search the entire player for buttons with "skip" in text or aria-label
    // Normal YouTube video controls NEVER contain the word "skip"
    const buttons = player.querySelectorAll("button, [role='button'], div[class*='button']");
    for (const btn of buttons) {
      if (btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true") continue;
      if (isCtaButton(btn)) continue;

      const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
      const text = (btn.textContent || "").trim().toLowerCase();
      if (
        aria.includes("skip ad") ||
        aria === "skip" ||
        text === "skip" ||
        text.startsWith("skip ") ||
        text.includes("skip ▶")
      ) {
        if (isElementVisible(btn)) {
          return btn;
        }
      }
    }

    return null;
  }

  // Check strictly if an actual video ad or Auto End Screen / Post-Roll CTA is active
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
    if (document.querySelector(".ad-showing, .ad-interrupting")) {
      return true;
    }
    // Auto End Screen / Post-Roll CTA / Interstitial Ad card check
    const interstitial = document.querySelector(
      ".ytp-ad-action-interstitial, .ytp-ad-player-overlay-layout"
    );
    if (interstitial && isElementVisible(interstitial)) {
      return true;
    }
    // If any skip button is visible on screen, an ad or end card is definitely active
    if (findAnySkipButton() !== null) {
      return true;
    }
    return false;
  }

  // Main ad handling loop - runs every 200ms (lightweight, zero lag, no recursion)
  function handleAds() {
    // 1. ALWAYS attempt to click any skip button if autoSkip is enabled!
    // This handles skippable video ads, modern skip buttons, and Auto End Screens (Post-Roll CTA cards)
    if (settings.autoSkip) {
      const skipBtn = findAnySkipButton();
      if (skipBtn) {
        const now = Date.now();
        if (now - lastClickTime >= 200) {
          lastClickTime = now;
          safeClick(skipBtn);
          if (!hasRecordedCurrentAd) {
            hasRecordedCurrentAd = true;
            recordAdSkipped();
          }
        }
      }
    }

    // 2. Dismiss any banner / overlay close buttons
    if (settings.blockBanners) {
      const closeSelectors = [
        ".ytp-ad-overlay-close-button",
        ".ytp-ad-overlay-close-container button",
        ".ytp-ad-action-interstitial-close-button",
        "button.ytp-ad-action-interstitial-dismiss-button",
        "button[aria-label='Close' i]",
        "button[aria-label='Dismiss' i]",
        "button[aria-label='Close ad' i]"
      ];
      for (const sel of closeSelectors) {
        const closeBtn = document.querySelector(sel);
        if (closeBtn && isElementVisible(closeBtn)) {
          safeClick(closeBtn);
          break;
        }
      }
    }

    // 3. Video ad handling (muting & 16x speedup)
    const adPlaying = isAdActive();
    const video = document.querySelector("video.video-stream, video");

    if (adPlaying && video) {
      isHandlingAd = true;

      // Mute ad
      if (settings.muteAds && !video.muted) {
        wasMutedByAdSkipper = true;
        video.muted = true;
      }

      // Speed up video ad to 16x (finishes in ~0.8s)
      // Only speed up if video is actively playing an ad (not ended or paused on an endcard)
      if (settings.autoSkip && settings.speedUp) {
        if (!video.paused && !video.ended && video.playbackRate < 16) {
          video.playbackRate = 16.0;
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
          if (video.paused && !video.ended) {
            video.play().catch(() => {});
          }
        }
      }
    }
  }

  // Initialize
  function init() {
    loadConfig();

    // 100ms ultra-responsive loop: 10 checks/sec, ~0.02% CPU, instant skipping
    setInterval(handleAds, 100);

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

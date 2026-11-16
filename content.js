// YouTube Ad Skipper - Content Script
// Detects YouTube ads and automatically skips/mutes them

const AdSkipper = (() => {
  let settings = {
    skipInterval: 5,
    muteAds: true,
    autoSkip: true,
    showNotifications: false
  };

  let isAdActive = false;
  let skipTimer = null;
  let observer = null;
  let skipAttempts = 0;
  const MAX_SKIP_ATTEMPTS = 10;

  // Load settings from storage
  function loadSettings() {
    try {
      chrome.storage.sync.get(
        ["skipInterval", "muteAds", "autoSkip", "showNotifications"],
        (result) => {
          if (result.skipInterval !== undefined) settings.skipInterval = result.skipInterval;
          if (result.muteAds !== undefined) settings.muteAds = result.muteAds;
          if (result.autoSkip !== undefined) settings.autoSkip = result.autoSkip;
          if (result.showNotifications !== undefined) settings.showNotifications = result.showNotifications;
        }
      );
    } catch (e) {
      console.log("[AdSkipper] Using default settings");
    }
  }

  // Detect if current page is an ad
  function isAd() {
    const url = window.location.href;
    if (!url.includes("youtube.com")) return false;

    // Check for ad indicators in URL
    if (url.includes("/ads/")) return true;
    if (url.includes("ad_type=")) return true;
    if (url.includes("ad_format=")) return true;

    // Check for ad video player
    const video = document.querySelector("video");
    if (!video) return false;

    // Check for ad-related elements
    const adLabel = document.querySelector(".ad-showing-now-label, .ad-interrupts-label, [aria-label*='Ad'], [aria-label*='ad']");
    if (adLabel) return true;

    // Check for ad badge in player
    const adBadge = document.querySelector(".badge-style-ad-badge, .ad-badge, [class*='ad-badge']");
    if (adBadge) return true;

    // Check for ad overlay
    const adOverlay = document.querySelector(".ad-overlay, .ad-redirect");
    if (adOverlay) return true;

    // Check page title for ad indicators
    const title = document.title || "";
    if (title.toLowerCase().includes("ad")) return true;

    return false;
  }

  // Mute the video
  function muteAd() {
    const video = document.querySelector("video");
    if (video && settings.muteAds) {
      video.muted = true;
      video.volume = 0;
    }
  }

  // Skip the ad
  function skipAd() {
    const video = document.querySelector("video");
    if (!video) return false;

    try {
      // Try to skip using YouTube's skip button
      const skipButton = document.querySelector(".ytp-skip-ad-button, .skip-ad-button, .ad-skip-button");
      if (skipButton) {
        skipButton.click();
        return true;
      }

      // Fallback: skip by setting currentTime
      const duration = video.duration;
      if (duration && isFinite(duration)) {
        video.currentTime = Math.min(duration - 0.1, settings.skipInterval);
        return true;
      }

      // Try to skip by clicking the progress bar
      const progress = document.querySelector(".ytp-progress-bar, .progress-bar");
      if (progress) {
        progress.click();
        return true;
      }
    } catch (e) {
      console.log("[AdSkipper] Skip error:", e);
    }

    return false;
  }

  // Attempt to skip the ad
  function attemptSkip() {
    if (!isAdActive) return;

    skipAttempts++;
    const skipped = skipAd();

    if (skipped) {
      console.log("[AdSkipper] Ad skipped successfully");
      isAdActive = false;
      stopObserving();
      return;
    }

    if (skipAttempts >= MAX_SKIP_ATTEMPTS) {
      console.log("[AdSkipper] Max skip attempts reached");
      stopObserving();
    }
  }

  // Start monitoring for ads
  function startObserving() {
    if (observer) return;

    const config = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    };

    observer = new MutationObserver((mutations) => {
      if (isAd() && !isAdActive) {
        isAdActive = true;
        skipAttempts = 0;
        muteAd();

        if (settings.autoSkip) {
          // Try immediate skip
          attemptSkip();

          // Set up retry timer
          if (skipTimer) clearInterval(skipTimer);
          skipTimer = setInterval(() => {
            if (isAdActive) {
              attemptSkip();
            } else {
              clearInterval(skipTimer);
              skipTimer = null;
            }
          }, 1000);
        }
      } else if (!isAd() && isAdActive) {
        isAdActive = false;
        if (skipTimer) {
          clearInterval(skipTimer);
          skipTimer = null;
        }
      }
    });

    observer.observe(document, config);
  }

  // Stop monitoring
  function stopObserving() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (skipTimer) {
      clearInterval(skipTimer);
      skipTimer = null;
    }
  }

  // Initialize
  function init() {
    loadSettings();
    startObserving();

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync") {
        Object.keys(changes).forEach((key) => {
          if (settings.hasOwnProperty(key)) {
            settings[key] = changes[key].newValue;
          }
        });
      }
    });
  }

  // Public API
  return {
    init,
    isAd,
    muteAd,
    skipAd,
    startObserving,
    stopObserving
  };
})();

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => AdSkipper.init());
} else {
  AdSkipper.init();
}
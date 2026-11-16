// YouTube Ad Skipper - Main Execution World Script
// Runs directly in YouTube's JavaScript context to interact with the player API

(() => {
  "use strict";

  let lastSkippedTime = 0;

  function handlePlayerAds() {
    const player = document.getElementById("movie_player") || document.querySelector(".html5-video-player");
    if (!player) return;

    // Check if player is currently in an ad state
    const isAd = Boolean(
      player.classList.contains("ad-showing") ||
      player.classList.contains("ad-interrupting") ||
      document.querySelector(".ytp-ad-player-overlay, .ytp-ad-player-overlay-layout, .ytp-ad-action-interstitial") ||
      document.querySelector(".video-ads.ytp-ad-module:not(:empty)")
    );

    if (isAd) {
      // 1. Invoke native player skipAd method
      try {
        if (typeof player.skipAd === "function") {
          player.skipAd();
        }
      } catch (_) {}

      // 2. Mute ad via player API
      try {
        if (typeof player.isMuted === "function" && !player.isMuted()) {
          if (typeof player.mute === "function") {
            player.mute();
          }
        }
      } catch (_) {}

      // 3. Fast-forward video element directly
      const video = player.querySelector("video");
      if (video) {
        // Boost rate to maximum
        try {
          if (video.playbackRate < 16) {
            video.playbackRate = 16.0;
          }
        } catch (_) {}

        // Jump to end of ad
        try {
          if (isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration;
          } else {
            video.currentTime = 999999;
          }
        } catch (_) {}

        // Unpause if paused
        if (video.paused) {
          try {
            video.play().catch(() => {});
          } catch (_) {}
        }
      }

      // 4. Click any modern skip button
      const skipBtn = document.querySelector(
        ".ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-slot button, .ytp-ad-skip-button-container button, [id^='skip-button:'] button, [id^='skip-button:']"
      );
      if (skipBtn) {
        try {
          skipBtn.click();
        } catch (_) {}
      }
    }
  }

  // High-frequency polling loop (50ms) for instantaneous execution
  setInterval(handlePlayerAds, 50);

  // Hook into YouTube navigation
  window.addEventListener("yt-navigate-finish", handlePlayerAds);
})();

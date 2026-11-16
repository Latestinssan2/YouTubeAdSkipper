// YouTube Ad Skipper - Main Execution World Script
// Runs directly in YouTube's JavaScript context to interact with the player API

(() => {
  "use strict";

  function handlePlayerAds() {
    const player = document.getElementById("movie_player") || document.querySelector(".html5-video-player");
    if (!player) return;

    // Strict check: Only act when an actual video ad is interrupting playback
    const isVideoAd = player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting");

    if (isVideoAd) {
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
        try {
          if (video.playbackRate < 16) {
            video.playbackRate = 16.0;
          }
        } catch (_) {}

        try {
          if (isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration;
          }
        } catch (_) {}

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

  // Polling loop (100ms) for player API
  setInterval(handlePlayerAds, 100);

  // Hook into YouTube navigation
  window.addEventListener("yt-navigate-finish", handlePlayerAds);
})();

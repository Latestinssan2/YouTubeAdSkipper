// YouTube Ad Skipper - Main Execution World Script
// Runs directly in YouTube's JavaScript context to interact with the player API

(() => {
  "use strict";

  let wasMutedByScript = false;

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

      // 2. Mute ad via player API and track that we muted it
      try {
        if (typeof player.isMuted === "function" && !player.isMuted()) {
          if (typeof player.mute === "function") {
            wasMutedByScript = true;
            player.mute();
          }
        }
      } catch (_) {}

      // 3. Fast-forward video element directly at 16x speed
      const video = player.querySelector("video");
      if (video) {
        try {
          if (video.playbackRate < 16) {
            video.playbackRate = 16.0;
          }
        } catch (_) {}
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
    } else {
      // Normal playback: UNMUTE immediately if we muted it during the ad
      if (wasMutedByScript) {
        wasMutedByScript = false;
        try {
          if (typeof player.unMute === "function") {
            player.unMute();
          }
        } catch (_) {}
      }

      // Restore normal playback rate
      const video = player.querySelector("video");
      if (video && video.playbackRate > 2.0) {
        video.playbackRate = 1.0;
      }
    }
  }

  // Polling loop (100ms) for player API
  setInterval(handlePlayerAds, 100);

  // Hook into YouTube navigation
  window.addEventListener("yt-navigate-finish", handlePlayerAds);
})();

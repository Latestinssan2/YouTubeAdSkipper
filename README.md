# YouTube Ad Skipper ⚡

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Web Store Ready](https://img.shields.io/badge/Chrome-Extension-red.svg)](https://chrome.google.com/webstore)

> **Lightning-fast, undetectable YouTube ad skipper and smart muter Chrome extension.** Fast-forwards ads at 16x speed, silences ad audio, triggers skip buttons within milliseconds, and removes banner overlays without triggering YouTube's anti-adblock detection.

---

## 🚀 Key Features

- **⚡ 16x Speed-Through**: Cranks video speed to 16.0x (the browser maximum) during ads, turning 30-second unskippable ads into under 2 seconds.
- **🔇 Smart Auto-Mute**: Automatically silences audio the exact millisecond an ad begins, and cleanly restores your volume when content resumes.
- **⏭️ Instant Skip Clicker**: Detects and clicks all YouTube skip button variants (`.ytp-ad-skip-button`, modern skip buttons, countdown overlays) immediately upon availability.
- **🛡️ Anti-Adblock Immune**: Traditional ad blockers block network requests to Google ad servers, which triggers YouTube's block screen. YouTube Ad Skipper orchestrates the HTML5 video element directly — so YouTube treats the ad as played and skipped legitimately!
- **🧹 Banner & Overlay Stripper**: Silently cleans up sponsored cards, banner popups, and sidebar display ads via injected CSS.
- **🔒 100% Privacy & Zero Telemetry**: No analytics, no remote tracking servers, no external dependencies. Runs 100% locally in your browser.

---

## 📦 Quick Installation (Chrome / Brave / Edge)

### Option 1: Load as Unpacked Extension (Developer Mode)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/Latestinssan2/youtube-ad-skipper.git
   ```
   *(Or download `youtube-ad-skipper.zip` from releases / landing page and extract it).*
2. Open Google Chrome (or any Chromium browser) and go to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** on the top-left and select this project directory.
5. Open [YouTube](https://www.youtube.com) and start watching ad-free!

---

## 🛠️ Project Structure

```
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Service worker managing tabs & settings
├── content.js                 # Content script: high-speed ad skipper & muter
├── popup.html / .js / .css    # Extension popup interface & quick controls
├── options.html / .js / .css  # Detailed preferences & stats management
├── css/ad-skipper.css         # Injected CSS for hiding banner/overlay ads
├── icons/                     # Icons (16px, 32px, 48px, 128px)
├── index.html / landing.html  # Modern landing page for Vercel deployment
├── public/                    # Static assets & pre-packaged extension zip
├── scripts/
│   ├── generate-icons.cjs     # Generates high-res PNG icons
│   └── package-extension.cjs  # Packages clean zip for Chrome Web Store
├── vercel.json                # Vercel deployment configuration
└── package.json               # Build scripts & dependencies
```

---

## 🧑‍💻 Development & Building

```bash
# Install dependencies
npm install

# Package the extension zip
npm run package

# Build the landing page & extension package for production
npm run build
```

---

## 🌐 Deploy Landing Page to Vercel

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 📄 License

MIT License. Free to use, modify, and distribute.

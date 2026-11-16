# YouTube Ad Skipper

A Chrome extension for automatically skipping and muting YouTube ads.

## Overview

This extension detects YouTube ad videos and automatically skips them while muting audio to provide a seamless viewing experience.

## Features

- **Automatic Ad Detection**: Detects YouTube ads by URL, video player content, and ad-specific elements
- **Smart Skip**: Automatically skips ads with configurable skip intervals
- **Audio Control**: Mutes audio during ads to prevent interruptions
- **Configurable**: Customize skip timing, mute behavior, and notifications
- **Lightweight**: Minimal resource usage with efficient detection algorithms

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `extension` directory

## Development

- Install dependencies: `npm install`
- Run development server: `npm run dev`
- Build for production: `npm run build`
- Open the extension in Chrome

## Configuration

Edit `manifest.json` to customize extension behavior:

- `skipInterval`: Time in seconds to skip (default: 5)
- `muteAds`: Whether to mute audio during ads (default: true)

## Usage

1. Install the extension
2. Navigate to YouTube
3. When an ad starts playing, it will be automatically detected and skipped
4. Adjust settings in the extension popup or options page as needed

## Development Testing

To test the extension:

1. Open YouTube and simulate an ad environment
2. Check the browser console for AdSkipper debug messages
3. Test manual skip with the extension's popup buttons
4. Verify settings are saved and loaded correctly

## License

MIT
# YouTube Ad Skipper Extension

A Chrome extension for automatically skipping and muting YouTube ads.

## Overview

This extension detects YouTube ad videos and automatically skips them while muting audio to provide a seamless viewing experience.

## Features

- Automatic ad detection and skipping
- Audio muting during ads
- Configurable skip intervals
- Minimal resource usage

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `extension` directory

## Development

- Install dependencies: `npm install`
- Run development server: `npm run dev`
- Build for production: `npm run build`

## Configuration

Edit `manifest.json` to customize extension behavior:

- `skipInterval`: Time in seconds to skip (default: 5)
- `muteAds`: Whether to mute audio during ads (default: true)

## License

MIT
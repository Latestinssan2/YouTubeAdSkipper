// Generate extension icons using sharp
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const sizes = [16, 32, 48, 128];
const outDir = path.join(__dirname, "..", "icons");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function generateIcons() {
  for (const size of sizes) {
    const rx = Math.round(size * 0.22);
    // Draw modern play+skip symbol
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF1A1A"/>
      <stop offset="100%" stop-color="#CC0000"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="${(rx / size) * 100}" fill="url(#grad)"/>
  <!-- Play triangle -->
  <polygon points="28,26 66,50 28,74" fill="#FFFFFF"/>
  <!-- Skip bar -->
  <rect x="68" y="26" width="9" height="48" rx="3" fill="#FFFFFF"/>
</svg>
`;

    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon${size}.png`));

    console.log(`Generated icon${size}.png`);
  }
}

generateIcons().catch(console.error);

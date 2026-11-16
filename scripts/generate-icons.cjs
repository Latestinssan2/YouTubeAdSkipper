// Generate extension icons using sharp
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const sizes = [16, 48, 128];
const outDir = path.join(__dirname, "..", "icons");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function generateIcons() {
  for (const size of sizes) {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#FF0000"/>
  <path d="M${Math.round(size * 0.4)} ${Math.round(size * 0.25)} L${Math.round(size * 0.75)} ${Math.round(size * 0.5)} L${Math.round(size * 0.4)} ${Math.round(size * 0.75)} V${Math.round(size * 0.25)}Z" fill="white"/>
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
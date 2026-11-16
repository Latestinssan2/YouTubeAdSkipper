// Script to package clean Chrome Extension ZIP file for Web Store & Landing Page download
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const zipPath = path.join(publicDir, "youtube-ad-skipper.zip");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Files to include in the extension package
const filesToZip = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "options.html",
  "options.js",
  "options.css",
  "css/ad-skipper.css",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png"
];

console.log("Packaging Chrome Extension into:", zipPath);
try {
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  const fileArgs = filesToZip.join(" ");
  execSync(`zip -r "${zipPath}" ${fileArgs}`, { cwd: rootDir, stdio: "inherit" });
  console.log("Successfully created extension package:", zipPath);
} catch (error) {
  console.warn("Notice: could not run zip command, checking if existing zip is present...", error.message);
  if (fs.existsSync(zipPath)) {
    console.log("Existing zip preserved at:", zipPath);
  } else {
    console.warn("No zip file available.");
  }
}

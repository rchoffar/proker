// sharp is intentionally not in package.json (its install script breaks EAS iOS
// builds); before running this script: npm i --no-save sharp
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');
const brandDir = path.join(assetsDir, 'brand');

const BRAND_DARK = '#0A0A0F';
const VIEWBOX_SIZE = 200;
const BASE_DENSITY = 72;

const colorSvg = readFileSync(path.join(brandDir, 'logo-mark-color.svg'));
const monoSvg = readFileSync(path.join(brandDir, 'logo-mark-mono.svg'));

/** Rasterizes the mark at native resolution (adjusts SVG density so it isn't upscaled from a small bitmap). */
function renderMark(svgBuffer, size) {
  const density = BASE_DENSITY * (size / VIEWBOX_SIZE);
  return sharp(svgBuffer, { density }).resize(size, size);
}

async function main() {
  await renderMark(colorSvg, 1024)
    .flatten({ background: BRAND_DARK })
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));

  await renderMark(colorSvg, 1024).png().toFile(path.join(assetsDir, 'splash-icon.png'));

  await renderMark(colorSvg, 48)
    .flatten({ background: BRAND_DARK })
    .png()
    .toFile(path.join(assetsDir, 'favicon.png'));

  await renderMark(colorSvg, 512).png().toFile(path.join(assetsDir, 'android-icon-foreground.png'));

  await sharp({
    create: { width: 512, height: 512, channels: 3, background: BRAND_DARK },
  })
    .png()
    .toFile(path.join(assetsDir, 'android-icon-background.png'));

  await renderMark(monoSvg, 432).png().toFile(path.join(assetsDir, 'android-icon-monochrome.png'));

  // Google Play listing assets (Play Console → Store listing).
  const playDir = path.join(__dirname, '..', 'store', 'play');
  mkdirSync(playDir, { recursive: true });

  await renderMark(colorSvg, 512)
    .flatten({ background: BRAND_DARK })
    .png()
    .toFile(path.join(playDir, 'icon-512.png'));

  // 1024×500 feature graphic: chip mark + wordmark on the brand background.
  // The chip is redrawn inline (same shapes as logo-mark-color.svg) so the
  // whole graphic renders as one SVG, text included.
  const featureSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E9E62" />
      <stop offset="100%" stop-color="#17E58A" />
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="${BRAND_DARK}" />
  <g transform="translate(230,250) scale(2.6) translate(-100,-100)">
    <circle cx="100" cy="100" r="58" fill="url(#emeraldGrad)" />
    <g fill="${BRAND_DARK}">
      <rect x="-5" y="-56" width="10" height="16" rx="3" transform="translate(100,100) rotate(0)" />
      <rect x="-5" y="-56" width="10" height="16" rx="3" transform="translate(100,100) rotate(45)" />
      <rect x="-5" y="-56" width="10" height="16" rx="3" transform="translate(100,100) rotate(90)" />
      <rect x="-5" y="-56" width="10" height="16" rx="3" transform="translate(100,100) rotate(135)" />
      <rect x="-5" y="-56" width="10" height="16" rx="3" transform="translate(100,100) rotate(180)" />
      <rect x="-5" y="-56" width="10" height="16" rx="3" transform="translate(100,100) rotate(225)" />
      <rect x="-5" y="-56" width="10" height="16" rx="3" transform="translate(100,100) rotate(270)" />
      <rect x="-5" y="-56" width="10" height="16" rx="3" transform="translate(100,100) rotate(315)" />
    </g>
    <circle cx="100" cy="100" r="42" fill="${BRAND_DARK}" />
    <circle cx="100" cy="100" r="34" fill="none" stroke="url(#emeraldGrad)" stroke-width="4" />
  </g>
  <text x="440" y="265" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="bold" font-size="120" fill="#FFFFFF">UPK</text>
  <text x="444" y="325" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="600" font-size="34" letter-spacing="6" fill="#17E58A">ULTIMATE POKER KIT</text>
</svg>`);
  await sharp(featureSvg, { density: 144 })
    .resize(1024, 500)
    .png()
    .toFile(path.join(playDir, 'feature-graphic.png'));

  console.log('Brand assets generated (incl. store/play Google Play assets).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

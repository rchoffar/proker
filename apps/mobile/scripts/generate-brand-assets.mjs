// sharp is intentionally not in package.json (its install script breaks EAS iOS
// builds); before running this script: npm i --no-save sharp
import { readFileSync } from 'node:fs';
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

  console.log('Brand assets generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

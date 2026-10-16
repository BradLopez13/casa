// Exports the app icon, Android adaptive/monochrome icons, splash (light/dark), favicon and
// Android notification icon from the Nido symbol master. Run with `pnpm brand:icons`; output
// is deterministic.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..', '..');
const read = (file: string) => readFileSync(join(root, 'assets/brand', file), 'utf8');
const out = (file: string) => join(root, 'assets/images', file);

const SLATE = '#2E3B41';
const POSIT = '#F2D04B';
const CHALK = '#F3F4F0';
const WHITE = '#FFFFFF';
const SIZE = 1024;
const VIEW = 512;

const master = read('symbol.svg');
const mono = read('symbol-mono.svg');

// Recolours the master by group id (the fill sits on each <g id="...">).
const recolour = (svg: string, left: string, right: string) =>
  svg
    .replace(/(<g id="left" fill=")[^"]+/, `$1${left}`)
    .replace(/(<g id="right" fill=")[^"]+/, `$1${right}`);

// The colour symbol always sits on slate: chalk figure plus pósit figure.
const colour = recolour(master, CHALK, POSIT);
const white = mono.replaceAll('currentColor', WHITE);

// Symbol rasterised at `width` px wide (the viewBox is square, so also `width` px tall).
const raster = (svg: string, width: number) =>
  sharp(Buffer.from(svg), { density: (72 * width) / VIEW })
    .resize(width, width)
    .png()
    .toBuffer();

// Symbol centred on a size x size canvas, optionally over a flat background.
const compose = async (svg: string, symbol: number, size: number, background?: string) => {
  const offset = Math.round((size - symbol) / 2);
  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  return base
    .composite([{ input: await raster(svg, symbol), left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

// Largest symbol width that keeps every painted pixel inside the Android adaptive safe circle
// (66/108 of the canvas), measured on the real shape, not its bounding box.
const safeWidth = async () => {
  const probe = 1024;
  const { data, info } = await sharp(await raster(colour, probe))
    .raw()
    .toBuffer({ resolveWithObject: true });
  let far = 0;
  const centre = (probe - 1) / 2;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if ((data[(y * info.width + x) * info.channels + 3] ?? 0) > 8) {
        far = Math.max(far, Math.hypot(x - centre, y - centre));
      }
    }
  }
  const radius = (SIZE * 66) / 108 / 2;
  return Math.floor((probe * radius * 0.97) / far);
};

const adaptive = await safeWidth();

const files: Record<string, Buffer> = {
  'icon.png': await compose(colour, 620, SIZE, SLATE),
  'adaptive-foreground.png': await compose(colour, adaptive, SIZE),
  'adaptive-monochrome.png': await compose(white, adaptive, SIZE),
  'splash.png': await compose(colour, SIZE, SIZE, SLATE),
  'splash-dark.png': await compose(colour, SIZE, SIZE, SLATE),
  'favicon.png': await compose(colour, 40, 48, SLATE),
  // Android status-bar icon: white on transparent (Android only reads the alpha), ~10% padding.
  'notification-icon.png': await compose(white, 77, 96),
};

for (const [name, data] of Object.entries(files)) {
  writeFileSync(out(name), data);
  process.stdout.write(`${name} ${data.length} bytes
`);
}

// Auth email header symbol, shown at 48 px (3x). The slate background is painted in so mail
// clients in dark mode never recolour it. Uploaded to the public `email-assets` bucket.
const emailSymbol = await compose(colour, 132, 144, SLATE);
writeFileSync(join(root, 'assets/email/nido-symbol-v2.png'), emailSymbol);
process.stdout.write(`email nido-symbol-v2.png ${emailSymbol.length} bytes
`);
process.stdout.write(`adaptive symbol width ${adaptive}px
`);

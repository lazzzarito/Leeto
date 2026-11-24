import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const svgPath = path.join(root, 'public/icons/icon.svg');
const outDir = path.join(root, 'public/icons');
const androidRes = path.join(root, 'android/app/src/main/res');

const BG = '#0B0B0B';
const FG = '#FBB701';

async function svgBuffer(size, paddingRatio, background = BG) {
  const svg = await readFile(svgPath, 'utf8');
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const top = Math.round((size - inner) / 2);
  const rendered = await sharp(Buffer.from(svg)).resize(inner, inner, { fit: 'contain' }).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: rendered, top, left: Math.round((size - inner) / 2) }])
    .png()
    .toBuffer();
}

async function maskable(size) {
  // Safe zone for maskable is ~80% diameter; keep logo comfortably inside.
  return svgBuffer(size, 0.24, BG);
}

async function anyIcon(size) {
  return svgBuffer(size, 0.16, BG);
}

async function writePng(file, buffer) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  console.log('wrote', path.relative(root, file));
}

async function generatePwa() {
  await mkdir(outDir, { recursive: true });
  for (const size of [192, 512]) {
    const png = await anyIcon(size);
    await writePng(path.join(outDir, `icon-${size}.png`), png);
    const webp = await sharp(png).webp({ quality: 92 }).toBuffer();
    await writePng(path.join(outDir, `icon-${size}.webp`), webp);
  }
  await writePng(path.join(outDir, 'icon-maskable-512.png'), await maskable(512));
}

async function generateAndroid() {
  const launcherSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  const fgSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

  const svg = await readFile(svgPath, 'utf8');
  for (const [density, size] of Object.entries(launcherSizes)) {
    const icon = await anyIcon(size);
    await writePng(path.join(androidRes, `mipmap-${density}/ic_launcher.png`), icon);
    await writePng(path.join(androidRes, `mipmap-${density}/ic_launcher_round.png`), icon);
  }

  for (const [density, size] of Object.entries(fgSizes)) {
    const inner = Math.round(size * 0.46); // centered within 66dp safe zone of 108dp
    const rendered = await sharp(Buffer.from(svg)).resize(inner, inner, { fit: 'contain' }).png().toBuffer();
    const top = Math.round((size - inner) / 2);
    const fg = await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: rendered, top, left: Math.round((size - inner) / 2) }])
      .png()
      .toBuffer();
    await writePng(path.join(androidRes, `mipmap-${density}/ic_launcher_foreground.png`), fg);
  }

  const mono = await readFile(path.join(outDir, 'icon-monochrome.svg'), 'utf8');
  const monoPathData = mono.match(/<path d="([^"]+)"/s)?.[1];
  if (!monoPathData) throw new Error('No monochrome path found');
  const monoXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
  <group android:translateX="7.68" android:translateY="14.51" android:scaleX="0.11105" android:scaleY="0.11105">
    <path android:fillColor="#000000" android:pathData="${monoPathData.replace(/\s+/g, ' ')}" />
  </group>
</vector>
`;
  const monoFile = path.join(androidRes, 'drawable/ic_launcher_monochrome.xml');
  await mkdir(path.dirname(monoFile), { recursive: true });
  await writeFile(monoFile, monoXml);
  console.log('wrote', path.relative(root, monoFile));
}

await generatePwa();
await generateAndroid();

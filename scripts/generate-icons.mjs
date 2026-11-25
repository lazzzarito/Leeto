import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourcePath = path.join(root, 'public/icons/icon.png');
const outDir = path.join(root, 'public/icons');
const androidRes = path.join(root, 'android/app/src/main/res');

const BG = { r: 0x0b, g: 0x0b, b: 0x0b, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Anchos del arte respecto al lienzo. El PNG oficial ocupa ~89% del ancho;
// el foreground adaptativo se acerca al diámetro seguro de 66dp/108dp.
const ANY_WIDTH = 0.89;
const MASKABLE_WIDTH = 0.76;
const FOREGROUND_WIDTH = 0.6;

function alphaBBox(data, info) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function loadSource() {
  const source = await readFile(sourcePath);
  const meta = await sharp(source).metadata();
  if (!meta.width || !meta.height) throw new Error('No se pudo leer public/icons/icon.png');

  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bbox = alphaBBox(data, info);
  if (!bbox) throw new Error('El icono oficial no tiene píxeles visibles');

  const padding = 2;
  const left = Math.max(0, bbox.left - padding);
  const top = Math.max(0, bbox.top - padding);
  const width = Math.min(info.width - left, bbox.width + padding * 2);
  const height = Math.min(info.height - top, bbox.height + padding * 2);
  const artwork = await sharp(source).extract({ left, top, width, height }).png().toBuffer();
  return { artwork, bbox, sourceWidth: meta.width, sourceHeight: meta.height };
}

/** Silueta blanca con transparencia, obtenida del canal alfa del arte oficial. */
async function monochromeArtwork(artwork) {
  const { data, info } = await sharp(artwork).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i += 1) {
    if (data[i * info.channels + 3] < 32) continue;
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = 255;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

/** Centra el arte en un lienzo cuadrado, con fondo opaco o transparente. */
async function renderIcon(artwork, size, widthRatio, background) {
  const width = Math.max(1, Math.round(size * widthRatio));
  const scaled = await sharp(artwork).resize({ width, kernel: 'lanczos3' }).png().toBuffer();
  const meta = await sharp(scaled).metadata();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: background ? 3 : 4,
      background: background ?? TRANSPARENT,
    },
  })
    .composite([{ input: scaled, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png()
    .toBuffer();
}

async function writeFileReported(file, buffer) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  console.log('wrote', path.relative(root, file));
}

async function generatePwa({ artwork, mono }) {
  await mkdir(outDir, { recursive: true });
  for (const size of [192, 512]) {
    const png = await renderIcon(artwork, size, ANY_WIDTH, BG);
    await writeFileReported(path.join(outDir, `icon-${size}.png`), png);
    await writeFileReported(path.join(outDir, `icon-${size}.webp`), await sharp(png).webp({ quality: 92 }).toBuffer());
  }
  await writeFileReported(path.join(outDir, 'icon-maskable-512.png'), await renderIcon(artwork, 512, MASKABLE_WIDTH, BG));
  // Los iconos monocromos deben ser una silueta sobre transparente para que
  // PWA y Android themed puedan teñirlos con el color del sistema.
  await writeFileReported(path.join(outDir, 'icon-monochrome.png'), await renderIcon(mono, 512, ANY_WIDTH, null));

  // El PNG oficial es la única fuente: los SVG antiguos quedan obsoletos.
  await rm(path.join(outDir, 'icon.svg'), { force: true });
  await rm(path.join(outDir, 'icon-monochrome.svg'), { force: true });
}

async function generateAndroid({ artwork, mono }) {
  const launcherSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  const fgSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

  for (const [density, size] of Object.entries(launcherSizes)) {
    const icon = await renderIcon(artwork, size, ANY_WIDTH, BG);
    await writeFileReported(path.join(androidRes, `mipmap-${density}/ic_launcher.png`), icon);
    await writeFileReported(path.join(androidRes, `mipmap-${density}/ic_launcher_round.png`), icon);
  }

  for (const [density, size] of Object.entries(fgSizes)) {
    const fg = await renderIcon(artwork, size, FOREGROUND_WIDTH, null);
    await writeFileReported(path.join(androidRes, `mipmap-${density}/ic_launcher_foreground.png`), fg);
  }

  await writeFileReported(
    path.join(androidRes, 'drawable/ic_launcher_monochrome.png'),
    await renderIcon(mono, 432, FOREGROUND_WIDTH, null),
  );

  // Plantillas heredadas de Capacitor: el adaptive icon usa @color y @mipmap.
  await rm(path.join(androidRes, 'drawable-v24/ic_launcher_foreground.xml'), { force: true });
  await rm(path.join(androidRes, 'drawable/ic_launcher_background.xml'), { force: true });
  await rm(path.join(androidRes, 'drawable/ic_launcher_monochrome.xml'), { force: true });
}

const { artwork, bbox, sourceWidth, sourceHeight } = await loadSource();
console.log(
  `official artwork bbox: ${bbox.width}x${bbox.height} (${((bbox.width / sourceWidth) * 100).toFixed(1)}% x ${((bbox.height / sourceHeight) * 100).toFixed(1)}%)`,
);
const mono = await monochromeArtwork(artwork);
await generatePwa({ artwork, mono });
await generateAndroid({ artwork, mono });

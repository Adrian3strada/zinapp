/**
 * Recorta barras de Safari y redimensiona capturas a 1290x2796 (App Store 6.7").
 * Uso: node scripts/prepare-appstore-screenshots.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = 'C:\\Users\\Adria\\.cursor\\projects\\c-dev-zinapp\\assets';
const OUT = path.resolve(__dirname, '../appstore-screenshots');

const SHOTS = [
  { file: 'WhatsApp_Image_2026-07-09_at_11.21.59_AM-802130a9-7608-4752-8878-2c62cbf07121.png', name: '01-login.png' },
  { file: 'WhatsApp_Image_2026-07-09_at_11.21.59_AM__1_-0995732e-4f14-4bad-bfac-3f1f3f75394b.png', name: '02-restaurantes.png' },
  { file: 'WhatsApp_Image_2026-07-09_at_11.22.00_AM-58dee86c-1e21-46b0-acd7-6cc54767748c.png', name: '03-carrito.png' },
  { file: 'WhatsApp_Image_2026-07-09_at_11.22.00_AM__1_-f8c346d6-1f31-474a-9ba7-6abc30c1ac7f.png', name: '04-pedidos.png' },
];

const TARGETS = [
  { w: 1284, h: 2778, dir: 'iphone-6.5' },
  { w: 1290, h: 2796, dir: 'iphone-6.7' },
  { w: 2048, h: 2732, dir: 'ipad-13' },
];
// Recorte aproximado barras Safari (iPhone web): arriba URL+status, abajo nav Safari
const CROP_TOP = 0.105;
const CROP_BOTTOM = 0.155;

async function processOne(srcPath, outPath, targetW, targetH) {
  const meta = await sharp(srcPath).metadata();
  const w = meta.width;
  const h = meta.height;
  const top = Math.round(h * CROP_TOP);
  const bottom = Math.round(h * CROP_BOTTOM);
  const cropH = h - top - bottom;

  await sharp(srcPath)
    .extract({ left: 0, top, width: w, height: cropH })
    .resize(targetW, targetH, { fit: 'cover', position: 'top' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  return { w, h, top, bottom, out: outPath };
}

async function main() {
  const prefix =
    'c__Users_Adria_AppData_Roaming_Cursor_User_workspaceStorage_c2a8a182421efeb5e6d52372f5b9060e_images_';

  for (const target of TARGETS) {
    const outDir = path.join(OUT, target.dir);
    fs.mkdirSync(outDir, { recursive: true });

    for (const shot of SHOTS) {
      const src = path.join(ASSETS, prefix + shot.file);
      if (!fs.existsSync(src)) {
        console.error('No encontrado:', src);
        process.exit(1);
      }
      const out = path.join(outDir, shot.name);
      const info = await processOne(src, out, target.w, target.h);
      console.log(`${target.dir}/${shot.name}: ${info.w}x${info.h} -> ${target.w}x${target.h}`);
    }
  }

  console.log('\nListo. Para App Store Connect (6.5"):', path.join(OUT, 'iphone-6.5'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

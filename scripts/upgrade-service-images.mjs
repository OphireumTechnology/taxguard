import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const publicImagesDir = path.join(ROOT, 'public/images');
const distImagesDir = path.join(ROOT, 'dist/images');

if (!fs.existsSync(distImagesDir)) {
  fs.mkdirSync(distImagesDir, { recursive: true });
}

const specs = [
  {
    id: 'tax-advisory-planning',
    sourceFile: 'tax-consultation-advisory.jpg',
    outputBasename: 'tax-advisory-planning',
    brightness: 1.18,
    saturation: 0.98,
    sharpen: true,
    position: 'center',
  },
  {
    id: 'corporate-business-advisory',
    sourceFile: 'business-tax-strategy.jpg',
    outputBasename: 'corporate-business-advisory',
    brightness: 0.92,
    saturation: 0.95,
    sharpen: true,
    position: 'center',
  },
  {
    id: 'estate-legacy-planning',
    sourceFile: 'estate-legacy-planning.jpg',
    outputBasename: 'estate-legacy-planning',
    brightness: 1.0,
    saturation: 0.98,
    sharpen: true,
    position: 'center',
  },
  {
    id: 'meticulous-tax-preparation',
    sourceFile: 'meticulous-tax-preparation.jpg',
    outputBasename: 'meticulous-tax-preparation',
    brightness: 1.05,
    saturation: 0.98,
    sharpen: true,
    position: 'center',
  },
];

async function run() {
  console.log('Upgrading 4 core corporate service images to 16:9 unified visual system...');

  for (const spec of specs) {
    const srcPath = path.join(publicImagesDir, spec.sourceFile);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Source file missing: ${srcPath}`);
    }

    let pipeline = sharp(srcPath);

    if (spec.brightness !== 1.0 || spec.saturation !== 1.0) {
      pipeline = pipeline.modulate({
        brightness: spec.brightness,
        saturation: spec.saturation,
      });
    }

    pipeline = pipeline.resize(1200, 675, {
      fit: 'cover',
      position: spec.position,
    });

    if (spec.sharpen) {
      pipeline = pipeline.sharpen({ sigma: 1, m1: 0.5, m2: 2 });
    }

    const jpgBuf = await pipeline.clone().jpeg({ quality: 86, progressive: true }).toBuffer();
    const webpBuf = await pipeline.clone().webp({ quality: 84, effort: 4 }).toBuffer();

    const targets = [
      {
        jpg: path.join(publicImagesDir, `${spec.outputBasename}.jpg`),
        webp: path.join(publicImagesDir, `${spec.outputBasename}.webp`),
      },
      {
        jpg: path.join(distImagesDir, `${spec.outputBasename}.jpg`),
        webp: path.join(distImagesDir, `${spec.outputBasename}.webp`),
      },
    ];

    for (const t of targets) {
      fs.writeFileSync(t.jpg, jpgBuf);
      fs.writeFileSync(t.webp, webpBuf);
    }

    const stats = await sharp(jpgBuf).stats();
    console.log(`✓ Processed ${spec.outputBasename}:`, {
      dimensions: '1200x675 (16:9)',
      jpgSize: `${Math.round(jpgBuf.length / 1024)} KB`,
      webpSize: `${Math.round(webpBuf.length / 1024)} KB`,
      meanRGB: stats.channels.slice(0, 3).map((c) => Math.round(c.mean)),
      stdevRGB: stats.channels.slice(0, 3).map((c) => Math.round(c.stdev)),
    });
  }

  console.log('All 4 service images successfully upgraded and synchronized.');
}

run().catch((err) => {
  console.error('Failed to upgrade service images:', err);
  process.exit(1);
});

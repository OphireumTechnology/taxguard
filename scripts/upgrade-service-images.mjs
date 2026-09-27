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
    width: 1200,
    height: 675,
    brightness: 1.18,
    saturation: 0.98,
    sharpen: true,
    position: 'center',
  },
  {
    id: 'corporate-business-advisory',
    sourceFile: 'business-tax-strategy.jpg',
    outputBasename: 'corporate-business-advisory',
    width: 1200,
    height: 675,
    brightness: 0.92,
    saturation: 0.95,
    sharpen: true,
    position: 'center',
  },
  {
    id: 'estate-legacy-planning',
    sourceFile: 'estate-legacy-planning.jpg',
    outputBasename: 'estate-legacy-planning',
    width: 1200,
    height: 675,
    brightness: 1.0,
    saturation: 0.98,
    sharpen: true,
    position: 'center',
  },
  {
    id: 'meticulous-tax-preparation',
    sourceFile: 'meticulous-tax-preparation.jpg',
    outputBasename: 'meticulous-tax-preparation',
    width: 1200,
    height: 675,
    brightness: 1.05,
    saturation: 0.98,
    sharpen: true,
    position: 'center',
  },
  {
    id: 'private-consultation-experience',
    sourceFile: 'tax-consultation-advisory.jpg',
    outputBasename: 'private-consultation-experience',
    width: 1200,
    height: 900,
    brightness: 1.18,
    saturation: 0.98,
    sharpen: true,
    position: 'center',
  },
  {
    id: 'bookkeeping-financial-reporting',
    sourceFile: 'bookkeeping-financial-reporting.jpeg',
    outputBasename: 'bookkeeping-financial-reporting',
    width: 1200,
    height: 900,
    brightness: 1.08,
    saturation: 0.98,
    sharpen: true,
    position: 'center',
  },
  {
    id: 'executive-consultation-suite',
    sourceFile: 'hero-executive-advisory.jpg',
    outputBasename: 'executive-consultation-suite',
    width: 1600,
    height: 900,
    brightness: 1.0,
    saturation: 0.98,
    sharpen: true,
    position: 'center',
  },
];

async function run() {
  console.log('Upgrading corporate images to unified photographic visual system...');

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

    pipeline = pipeline.resize(spec.width, spec.height, {
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
      dimensions: `${spec.width}x${spec.height}`,
      jpgSize: `${Math.round(jpgBuf.length / 1024)} KB`,
      webpSize: `${Math.round(webpBuf.length / 1024)} KB`,
      meanRGB: stats.channels.slice(0, 3).map((c) => Math.round(c.mean)),
      stdevRGB: stats.channels.slice(0, 3).map((c) => Math.round(c.stdev)),
    });
  }

  console.log('All corporate images successfully upgraded and synchronized.');
}

run().catch((err) => {
  console.error('Failed to upgrade service images:', err);
  process.exit(1);
});

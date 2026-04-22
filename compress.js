// Image compressor using macOS sips (no npm needed)
// - Resizes images wider than 1920px down to 1920px (2× retina for 960px container)
// - Reduces JPEG quality to 78% (visually lossless at screen sizes)
// - Leaves GIFs and SVGs untouched
//
// Run: node compress.js
// Run dry-run (no changes): node compress.js --dry-run

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const DRY_RUN    = process.argv.includes('--dry-run');
const MAX_WIDTH  = 1920;
const JPEG_QUALITY = 78;
const WORKS_DIR  = path.join(__dirname, 'works');

function formatBytes(b) {
  if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + ' MB';
  return (b / 1024).toFixed(1) + ' KB';
}

function sips(...args) {
  const result = spawnSync('sips', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new Error(result.stderr.toString());
}

function getWidth(file) {
  const out = execSync(`sips -g pixelWidth "${file}"`, { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString();
  const m = out.match(/pixelWidth:\s+(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function processImage(file) {
  const ext  = path.extname(file).toLowerCase();
  const before = fs.statSync(file).size;
  let action = [];

  try {
    if (ext === '.jpg' || ext === '.jpeg') {
      const w = getWidth(file);
      const args = ['-s', 'formatOptions', String(JPEG_QUALITY)];
      if (w > MAX_WIDTH) {
        args.push('--resampleWidth', String(MAX_WIDTH));
        action.push(`resize ${w}→${MAX_WIDTH}px`);
      }
      action.push(`quality ${JPEG_QUALITY}%`);
      if (!DRY_RUN) sips(...args, file, '--out', file);

    } else if (ext === '.png') {
      const w = getWidth(file);
      if (w > MAX_WIDTH) {
        action.push(`resize ${w}→${MAX_WIDTH}px`);
        if (!DRY_RUN) sips('--resampleWidth', String(MAX_WIDTH), file, '--out', file);
      }
      // PNGs are lossless — only resize helps; skip if already fits
    }
  } catch (e) {
    return { file, error: e.message };
  }

  if (action.length === 0) return null; // nothing to do

  const after = DRY_RUN ? before : fs.statSync(file).size;
  const saved = before - after;
  const pct   = ((saved / before) * 100).toFixed(1);

  return {
    name: path.relative(WORKS_DIR, file),
    action: action.join(' + '),
    before: formatBytes(before),
    after:  formatBytes(after),
    saved:  saved > 0 ? `-${formatBytes(saved)} (${pct}%)` : '(no change)',
  };
}

// Collect all images recursively
function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else if (/\.(jpg|jpeg|png)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

console.log(`\nImage compressor${DRY_RUN ? ' (DRY RUN — no files changed)' : ''}`);
console.log(`Max width: ${MAX_WIDTH}px  |  JPEG quality: ${JPEG_QUALITY}%\n`);

const images = walk(WORKS_DIR);
console.log(`Found ${images.length} images. Processing...\n`);

let totalBefore = 0, totalAfter = 0, count = 0;

for (const img of images) {
  totalBefore += fs.statSync(img).size;
  const result = processImage(img);

  if (result && result.error) {
    console.error(`  ERROR  ${result.file}: ${result.error}`);
  } else if (result) {
    count++;
    totalAfter += DRY_RUN ? fs.statSync(img).size : fs.statSync(img).size;
    console.log(`  ✓ ${result.name}`);
    console.log(`    ${result.action}  ${result.before} → ${result.after}  ${result.saved}`);
  } else {
    totalAfter += fs.statSync(img).size;
  }
}

const saved = totalBefore - totalAfter;
console.log(`\n${'─'.repeat(60)}`);
console.log(`Processed ${count} of ${images.length} images`);
console.log(`Total before : ${formatBytes(totalBefore)}`);
console.log(`Total after  : ${formatBytes(totalAfter)}`);
if (saved > 0) console.log(`Saved        : ${formatBytes(saved)} (${((saved / totalBefore) * 100).toFixed(1)}%)`);
console.log();

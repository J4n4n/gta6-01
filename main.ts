// Solmar Heat — the make.fun "Make GTA 6" entry (gta6-01), Node 22, stdlib only.
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and
// no network request). This program hands it in: it copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. Then, unlike the starter, it validates the output it
// just wrote and logs the entry summary, so a broken hand-in fails loudly
// here instead of silently in front of the judge.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the scorer enforces (reference/gate.json): only text_max_bytes
// shapes the bytes; the others refuse an entry the scorer would refuse.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  console.error(`entry failed: ${message}`);
  process.exit(1);
}

// Walk a directory and return every file under it, relative to the root.
function listFiles(root, prefix = '') {
  const found = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...listFiles(root, rel));
    else found.push(rel);
  }
  return found;
}

function totalBytes(root, files) {
  return files.reduce((sum, file) => sum + statSync(join(root, file)).size, 0);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));

// --- Validate what we just wrote, before anyone trusts it. -----------------
const gameFiles = listFiles(join(out, 'game'));
if (gameFiles.length === 0) fail('out/game/ is empty');
if (!gameFiles.includes('index.html')) fail('out/game/index.html is missing');
if (!gameFiles.some((f) => f.startsWith('src/') && f.endsWith('.js'))) fail('out/game/src/ has no JavaScript');
if (gameFiles.length > CAPS.game_max_files) fail(`game/ has ${gameFiles.length} files, cap is ${CAPS.game_max_files}`);
const gameBytes = totalBytes(join(out, 'game'), gameFiles);
if (gameBytes > CAPS.game_max_bytes) fail(`game/ is ${gameBytes} bytes, cap is ${CAPS.game_max_bytes}`);

const shotFiles = existsSync(join(out, 'screenshots'))
  ? listFiles(join(out, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
  : [];
if (shotFiles.length < 3) fail(`only ${shotFiles.length} screenshots, need at least 3`);
if (shotFiles.length > CAPS.screenshots.max) fail(`${shotFiles.length} screenshots, cap is ${CAPS.screenshots.max}`);
for (const shot of shotFiles) {
  const size = statSync(join(out, 'screenshots', shot)).size;
  if (size > CAPS.screenshots.max_bytes) fail(`screenshot ${shot} is ${size} bytes, cap is ${CAPS.screenshots.max_bytes}`);
}

let dossier;
try {
  dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
} catch {
  fail('out/dossier.json does not parse');
}
// The caps, as the vendored library defines them: text_max_bytes bounds the
// dossier's `text` field alone (the source the judge reads); the dossier as
// a whole holds at most 4 MiB (its `images` are the screenshots as base64,
// so a 473 KiB dossier for four ~70 KiB JPEGs is expected, not a failure).
const dossierBytes = statSync(join(out, 'dossier.json')).size;
const textBytes = Buffer.byteLength(dossier.text ?? '', 'utf8');
if (textBytes > CAPS.text_max_bytes) fail(`dossier text is ${textBytes} bytes, cap is ${CAPS.text_max_bytes}`);
if (dossierBytes > 4 * 1024 * 1024) fail(`dossier.json is ${dossierBytes} bytes, cap is 4 MiB`);

// --- Entry summary. --------------------------------------------------------
console.log('Solmar Heat — entry ready');
console.log(`  game: ${gameFiles.length} files, ${(gameBytes / 1024).toFixed(1)} KiB`);
console.log(`  screenshots: ${shotFiles.length} (${shotFiles.join(', ')})`);
console.log(`  cover: ${shotFiles[0]}`);
console.log(`  dossier: ${dossierBytes} bytes (${textBytes} bytes of text, ${dossier.images?.length ?? 0} images)`);

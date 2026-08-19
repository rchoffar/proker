#!/usr/bin/env node
// App Store screenshot capture via xcrun simctl — human-driven.
//
// You navigate/stage each screen in the Simulator; the script sets a clean
// status bar and captures on Enter. (Deep-link automation is deliberately not
// used: iOS shows an "Open in UPK?" dialog on every custom-scheme link, and
// the app language is a persisted in-app setting, so a human at the Simulator
// is both required and faster.)
//
// Prerequisites (once): npx expo run:ios --configuration Release
// Usage: node scripts/capture-screenshots.mjs [--device "iPhone 17 Pro Max"] [--locale en|fr]
//
// App Store requirement: 6.9" iPhone portrait (1320×2868), 3–10 images per locale.

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BUNDLE_ID = 'fr.upk.app';
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'store', 'screenshots');

const SHOTS = [
  { name: '01-bluff', hint: 'Bluff MID-GAME: Games → Bluff → add 2-3 players → deal → play 1-2 announcements' },
  { name: '02-ofc', hint: 'OFC MID-GAME: Games → OFC → 2-3 players → deal → place a few cards' },
  { name: '03-hand-replayer', hint: 'Hand replayer PLAYBACK: load/create a hand, mid-replay with board cards visible' },
  { name: '04-tracker', hint: 'Tracker with a few sessions logged (add 2-3 entries first if empty)' },
  { name: '05-home', hint: 'Dashboard/home tab' },
  { name: '06-degen', hint: 'Degen Hub (games tab)' },
];

const LOCALE_ORDER = ['en', 'fr'];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { device: null, locales: LOCALE_ORDER };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--device') opts.device = args[++i];
    else if (args[i] === '--locale') opts.locales = [args[++i]];
  }
  return opts;
}

function simctl(...cmd) {
  return execFileSync('xcrun', ['simctl', ...cmd], { encoding: 'utf8' });
}

function pickDevice(preferredName) {
  const list = JSON.parse(simctl('list', 'devices', 'available', '-j'));
  const devices = Object.values(list.devices).flat();
  if (preferredName) {
    const match = devices.find((d) => d.name === preferredName);
    if (!match) {
      console.error(`Simulator "${preferredName}" not found. Available: ${devices.map((d) => d.name).join(', ')}`);
      process.exit(1);
    }
    return match;
  }
  const proMax = devices.filter((d) => /iPhone .*Pro Max/.test(d.name));
  const pool = proMax.length > 0 ? proMax : devices.filter((d) => /iPhone/.test(d.name));
  if (pool.length === 0) {
    console.error('No available iPhone simulator found. Install one via Xcode → Settings → Platforms.');
    process.exit(1);
  }
  return pool.find((d) => d.state === 'Booted') ?? pool[pool.length - 1];
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (msg) => new Promise((resolve) => rl.question(msg, resolve));

async function main() {
  const opts = parseArgs();
  const device = pickDevice(opts.device);
  const udid = device.udid;
  console.log(`Using simulator: ${device.name} (${device.state})`);

  if (device.state !== 'Booted') {
    simctl('boot', udid);
    simctl('bootstatus', udid);
  }
  try {
    simctl('get_app_container', udid, BUNDLE_ID);
  } catch {
    console.error(`${BUNDLE_ID} is not installed. Run: npx expo run:ios --configuration Release`);
    process.exit(1);
  }

  simctl(
    'status_bar', udid, 'override',
    '--time', '9:41',
    '--batteryState', 'charged', '--batteryLevel', '100',
    '--cellularMode', 'active', '--cellularBars', '4',
    '--operatorName', '', '--wifiBars', '3',
  );

  for (const locale of opts.locales) {
    const outDir = path.join(OUT_DIR, locale);
    mkdirSync(outDir, { recursive: true });
    console.log(`\n=== Locale "${locale}" → ${outDir}`);
    await ask(`In the app, set the language to "${locale}" (Profile tab → language), then press Enter… `);

    for (const shot of SHOTS) {
      const answer = await ask(`\n▶ ${shot.name}\n  ${shot.hint}\n  Stage it, then press Enter to capture (or type "s" + Enter to skip)… `);
      if (answer.trim().toLowerCase() === 's') {
        console.log('  skipped');
        continue;
      }
      const file = path.join(outDir, `${shot.name}.png`);
      simctl('io', udid, 'screenshot', file);
      console.log(`  ✓ ${shot.name}.png`);
    }
  }

  simctl('status_bar', udid, 'clear');
  rl.close();
  console.log(`\nDone. Screenshots in ${OUT_DIR}/{${opts.locales.join(',')}}/ (1320×2868, ready for App Store Connect).`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

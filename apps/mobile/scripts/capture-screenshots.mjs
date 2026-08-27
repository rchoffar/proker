#!/usr/bin/env node
// Store screenshot capture (App Store via xcrun simctl, Google Play via adb) — human-driven.
//
// You navigate/stage each screen in the Simulator/emulator; the script sets a
// clean status bar and captures on Enter. (Deep-link automation is deliberately
// not used: iOS shows an "Open in UPK?" dialog on every custom-scheme link, and
// the app language is a persisted in-app setting, so a human at the device is
// both required and faster.)
//
// iOS prerequisites (once): npx expo run:ios --configuration Release
//   Usage: node scripts/capture-screenshots.mjs [--device "iPhone 17 Pro Max"] [--locale en|fr]
//   App Store requirement: 6.9" iPhone portrait (1320×2868), 3–10 images per locale.
//
// Android prerequisites: an emulator (or device) running the release app —
//   install the EAS preview APK, or npx expo run:android --variant release.
//   Google Play caps screenshots at a 2:1 aspect ratio, which typical 19.5:9
//   phones exceed — use an AVD with a 1080×2160 (2:1) screen.
//   Usage: node scripts/capture-screenshots.mjs --platform android [--serial emulator-5554] [--locale en|fr]

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BUNDLE_ID = 'fr.upk.app';
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'store', 'screenshots');

const SHOTS = [
  { name: '01-bluff', hint: 'Bluff MID-GAME: Games → Bluff → add 2-3 players → deal → play 1-2 announcements' },
  { name: '02-ofc', hint: 'OFC MID-GAME: Games → OFC → 2-3 players → deal → place a few cards' },
  { name: '03-hand-replayer', hint: 'Hand replayer PLAYBACK: load/create a hand, mid-replay with board cards visible' },
  { name: '04-stats', hint: 'Stats tab with games recorded (play a quick Bluff/OFC round first if empty)' },
  { name: '05-home', hint: 'Dashboard/home tab' },
  { name: '06-degen', hint: 'Degen Hub (games tab)' },
];

const LOCALE_ORDER = ['en', 'fr'];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { platform: 'ios', device: null, serial: null, locales: LOCALE_ORDER };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--platform') opts.platform = args[++i];
    else if (args[i] === '--device') opts.device = args[++i];
    else if (args[i] === '--serial') opts.serial = args[++i];
    else if (args[i] === '--locale') opts.locales = [args[++i]];
  }
  return opts;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (msg) => new Promise((resolve) => rl.question(msg, resolve));

async function captureLoop({ locales, platformDir, capture }) {
  for (const locale of locales) {
    const outDir = path.join(OUT_DIR, ...platformDir, locale);
    mkdirSync(outDir, { recursive: true });
    console.log(`\n=== Locale "${locale}" → ${outDir}`);
    await ask(`In the app, set the language to "${locale}" (Profile tab → language), then press Enter… `);

    for (const shot of SHOTS) {
      const answer = await ask(`\n▶ ${shot.name}\n  ${shot.hint}\n  Stage it, then press Enter to capture (or type "s" + Enter to skip)… `);
      if (answer.trim().toLowerCase() === 's') {
        console.log('  skipped');
        continue;
      }
      capture(path.join(outDir, `${shot.name}.png`));
      console.log(`  ✓ ${shot.name}.png`);
    }
  }
}

// ---------------------------------------------------------------- iOS (simctl)

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

async function mainIos(opts) {
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

  await captureLoop({
    locales: opts.locales,
    platformDir: [],
    capture: (file) => simctl('io', udid, 'screenshot', file),
  });

  simctl('status_bar', udid, 'clear');
  console.log(`\nDone. Screenshots in ${OUT_DIR}/{${opts.locales.join(',')}}/ (1320×2868, ready for App Store Connect).`);
}

// ------------------------------------------------------------- Android (adb)

function makeAdb(serial) {
  return (...cmd) =>
    execFileSync('adb', serial ? ['-s', serial, ...cmd] : cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function pickAndroidSerial(preferred) {
  const lines = execFileSync('adb', ['devices'], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l.endsWith('device'))
    .map((l) => l.split(/\s+/)[0]);
  if (preferred) {
    if (!lines.includes(preferred)) {
      console.error(`Device "${preferred}" not connected. Connected: ${lines.join(', ') || '(none)'}`);
      process.exit(1);
    }
    return preferred;
  }
  if (lines.length === 0) {
    console.error('No Android device/emulator connected. Start an AVD (ideally 1080×2160) and retry.');
    process.exit(1);
  }
  return lines[0];
}

async function mainAndroid(opts) {
  const serial = pickAndroidSerial(opts.serial);
  const adb = makeAdb(serial);
  console.log(`Using Android device: ${serial}`);

  if (!adb('shell', 'pm', 'path', BUNDLE_ID).includes('package:')) {
    console.error(`${BUNDLE_ID} is not installed. Install the EAS preview APK or run: npx expo run:android --variant release`);
    process.exit(1);
  }

  const sizeMatch = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)/);
  if (sizeMatch) {
    const [w, h] = [Number(sizeMatch[1]), Number(sizeMatch[2])];
    console.log(`Screen: ${w}×${h}`);
    if (Math.max(w, h) / Math.min(w, h) > 2) {
      console.warn(
        `⚠ Aspect ratio ${(Math.max(w, h) / Math.min(w, h)).toFixed(2)}:1 exceeds Google Play's 2:1 cap — use a 1080×2160 AVD (or: adb shell wm size 1080x2160, then wm size reset when done).`,
      );
    }
  }

  // Clean status bar via SystemUI demo mode (ignored on devices that disallow it).
  try {
    adb('shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1');
    adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'enter');
    adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'clock', '-e', 'hhmm', '0941');
    adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false');
    adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'network', '-e', 'wifi', 'show', '-e', 'level', '4');
    adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'notifications', '-e', 'visible', 'false');
  } catch {
    console.warn('⚠ Could not enable SystemUI demo mode (non-fatal).');
  }

  await captureLoop({
    locales: opts.locales,
    platformDir: ['android'],
    capture: (file) => {
      const png = execFileSync('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
      writeFileSync(file, png);
    },
  });

  try {
    adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'exit');
  } catch {
    /* non-fatal */
  }
  console.log(`\nDone. Screenshots in ${OUT_DIR}/android/{${opts.locales.join(',')}}/ (ready for Play Console — min 2, max 8 per locale).`);
}

// --------------------------------------------------------------------- entry

async function main() {
  const opts = parseArgs();
  if (opts.platform === 'android') await mainAndroid(opts);
  else await mainIos(opts);
  rl.close();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

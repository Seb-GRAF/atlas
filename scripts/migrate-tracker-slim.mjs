#!/usr/bin/env node
// One-time migration: slim historical tracker entries with isRemoved:true or
// display:false to compact stubs. Default is --dry-run (reports savings,
// writes nothing). Use --apply to write changes; backs up the original to
// tracker.pre-slim.json.bak.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStub, toDiscardedStub } from './lib/dedup.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PROFILES_DIR = path.join(ROOT, 'data', 'profiles');

function parseArgs(argv = process.argv.slice(2)) {
  const args = { apply: false, profile: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else if (a === '--profile' && argv[i + 1]) { args.profile = argv[i + 1]; i += 1; }
    else if (a.startsWith('--profile=')) args.profile = a.slice('--profile='.length);
  }
  return args;
}

async function listProfiles() {
  const entries = await fs.readdir(PROFILES_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

function bytesOf(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

async function migrateProfile(profile, { apply }) {
  const trackerPath = path.join(PROFILES_DIR, profile, 'tracker.json');
  const backupPath = path.join(PROFILES_DIR, profile, 'tracker.pre-slim.json.bak');
  let raw;
  try {
    raw = await fs.readFile(trackerPath, 'utf8');
  } catch (err) {
    return { profile, skipped: true, reason: err.code === 'ENOENT' ? 'no tracker.json' : err.message };
  }
  const tracker = JSON.parse(raw);
  const listings = Array.isArray(tracker.listings) ? tracker.listings : [];

  let stubbedCount = 0;
  const samples = [];
  const next = listings.map((entry) => {
    if (isStub(entry)) return entry;
    if (entry?.isRemoved === true || entry?.display === false) {
      stubbedCount += 1;
      const stub = toDiscardedStub(entry);
      if (samples.length < 5) samples.push({ before: entry, after: stub });
      return stub;
    }
    return entry;
  });

  const before = bytesOf(tracker);
  const newTracker = { ...tracker, listings: next };
  const after = bytesOf(newTracker);

  const result = {
    profile,
    skipped: false,
    totalEntries: listings.length,
    stubbedThisRun: stubbedCount,
    existingStubs: listings.filter(isStub).length,
    bytesBefore: before,
    bytesAfter: after,
    saved: before - after,
    samples
  };

  if (apply) {
    await fs.writeFile(backupPath, raw);
    await fs.writeFile(trackerPath, JSON.stringify(newTracker, null, 2));
    result.backupWritten = backupPath;
  }
  return result;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const args = parseArgs();
  const mode = args.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`tracker-slim migration — mode: ${mode}`);
  console.log(`(use --apply to write changes; default is dry-run)\n`);

  const profiles = args.profile ? [args.profile] : await listProfiles();
  for (const profile of profiles) {
    const r = await migrateProfile(profile, { apply: args.apply });
    if (r.skipped) {
      console.log(`[${profile}] skipped: ${r.reason}`);
      continue;
    }
    console.log(`[${profile}]`);
    console.log(`  total entries:    ${r.totalEntries}`);
    console.log(`  existing stubs:   ${r.existingStubs}`);
    console.log(`  stubbing now:     ${r.stubbedThisRun}`);
    console.log(`  size before:      ${fmtBytes(r.bytesBefore)}`);
    console.log(`  size after:       ${fmtBytes(r.bytesAfter)}`);
    console.log(`  bytes saved:      ${fmtBytes(r.saved)} (${(r.saved / r.bytesBefore * 100).toFixed(1)}%)`);
    if (args.apply) console.log(`  backup written:   ${r.backupWritten}`);

    if (r.samples.length > 0) {
      console.log(`  sample stubs (before/after):`);
      for (const s of r.samples) {
        const beforeBytes = bytesOf(s.before);
        const afterBytes = bytesOf(s.after);
        console.log(`    ${String(s.before.id).padEnd(20)} ${beforeBytes}B → ${afterBytes}B  (reason: "${s.before.filterReason || ''}")`);
      }
    }
    console.log('');
  }
  console.log(args.apply ? 'Done. Re-scan to verify behavior.' : 'Dry-run complete. Re-run with --apply to write changes.');
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});

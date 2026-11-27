#!/usr/bin/env node
// Local recording integrity manifest. No upload, database write or credential access.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';
import { basename, dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 16 * 1024 ** 3;
function assertClipPath(file) {
  if (typeof file !== 'string' || !/\.mp4$/i.test(basename(file)) ||
      basename(file) === '.' || basename(file) === '..')
    throw new Error('MP4_FILE_REQUIRED');
}
async function digestClip(file) {
  assertClipPath(file);
  const before = await lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size <= 0 || before.size > MAX_BYTES)
    throw new Error('UNSAFE_OR_EMPTY_CLIP');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file, { flags: 'r' })) hash.update(chunk);
  const after = await lstat(file);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
      before.ino !== after.ino || before.dev !== after.dev)
    throw new Error('CLIP_CHANGED_DURING_HASH');
  return { sha256: hash.digest('hex'), bytes: after.size };
}
export async function createManifest(clip, manifestFile) {
  const file = resolve(clip), output = resolve(manifestFile);
  assertClipPath(file);
  if (dirname(file) !== dirname(output) || output === file ||
      basename(output) !== basename(file) + '.integrity.json')
    throw new Error('MANIFEST_MUST_BE_ADJACENT');
  const {sha256, bytes} = await digestClip(file);
  const manifest = {
    schema: 'scc380-local-clip-integrity-v1',
    clip: basename(file),
    bytes,
    sha256,
    hashedAt: new Date().toISOString(),
    caveat: 'Local hash only; not a signed chain of custody or trusted capture timestamp.',
  };
  // O_EXCL prevents accidentally overwriting a previous evidence manifest.
  const handle = await open(output, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(manifest, null, 2) + '\n'); }
  finally { await handle.close(); }
  return manifest;
}
export async function verifyManifest(clip, manifestFile) {
  const file = resolve(clip), output = resolve(manifestFile);
  assertClipPath(file);
  if (dirname(file) !== dirname(output) ||
      basename(output) !== basename(file) + '.integrity.json')
    throw new Error('MANIFEST_MUST_BE_ADJACENT');
  const info = await lstat(output);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 8192)
    throw new Error('UNSAFE_MANIFEST');
  const m = JSON.parse(await readFile(output, 'utf8'));
  if (m.schema !== 'scc380-local-clip-integrity-v1' || m.clip !== basename(file) ||
      !Number.isSafeInteger(m.bytes) || m.bytes <= 0 ||
      typeof m.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(m.sha256))
    throw new Error('INVALID_MANIFEST');
  const actual = await digestClip(file);
  const ok = actual.bytes === m.bytes &&
    timingSafeEqual(Buffer.from(actual.sha256, 'hex'), Buffer.from(m.sha256, 'hex'));
  return {ok, expectedBytes:m.bytes, actualBytes:actual.bytes,
    expectedSha256:m.sha256, actualSha256:actual.sha256};
}
async function main() {
  const [mode, file, manifest] = process.argv.slice(2);
  if (!['create', 'verify'].includes(mode) || !file || !manifest || process.argv.length !== 5)
    throw new Error('USAGE: node scripts/surveillance-evidence-integrity.mjs create|verify clip.mp4 clip.mp4.integrity.json');
  if (mode === 'create') {
    const result = await createManifest(file, manifest);
    console.log('STATUS: MANIFEST_CREATED SHA256: '+result.sha256+' BYTES: '+result.bytes);
  } else {
    const result = await verifyManifest(file, manifest);
    console.log('STATUS: '+(result.ok ? 'INTEGRITY_PASS' : 'INTEGRITY_FAIL'));
    if (!result.ok) process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  main().catch(e=>{ console.error('STATUS: FAIL '+e.message); process.exitCode=1; });

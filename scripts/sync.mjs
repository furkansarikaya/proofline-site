// Verified fetch of the synced documents (TASK-007, ADR 0003).
//   node scripts/sync.mjs fetch                     verify .cache/sync/<pin commit>/ or download, verify, cache
//   node scripts/sync.mjs lock [<commit> [<tag>]]   write sync/lock.json for the pin (or for <commit>, then rewrite sync/pin.json)
// Environment: PROOFLINE_SYNC_ARCHIVE_URL replaces the archive address (tests); a file: URL or an http: URL on 127.0.0.1 or
// localhost, with {commit} replaced by the commit; unset or empty means the default codeload address. It changes only the
// source: the committed sync/lock.json stays the only reference every archive and cache is compared with.
// Exit status: 0 pass, 1 check or fetch failed, 2 usage. Errors go to stderr, the summary line to stdout.
// This file and scripts/lib/*.mjs import only node: modules, so a test can copy them into a temp project.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blobId, buildLock, commitMismatch, listing, serializeLock, sha256, treeText, validateLock, validatePin, verifyEntries } from './lib/lock.mjs';
import { GROUPS, groupOf } from './lib/sync-set.mjs';
import { readTarGz } from './lib/tar.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PIN_FILE = join(root, 'sync', 'pin.json');
const LOCK_FILE = join(root, 'sync', 'lock.json');
const CACHE_ROOT = join(root, '.cache', 'sync');
const DEFAULT_ADDRESS = 'https://codeload.github.com/furkansarikaya/proofline/tar.gz/{commit}';
// Measured at delivery (AC-18): one live request to codeload for the 8.4 MB archive of the launch pin took 1.5 s from an
// empty cache, including unpacking and verification. The whole download (connection and body) is cut after this time. shortcut: fixed limit, make it configurable when an archive needs longer than 60 s.
const DOWNLOAD_TIMEOUT_MS = 60000;
// Rounds one fetch looks at the cache folder before it gives up; each round follows a change made by a concurrent fetch.
const ROUNDS = 6;
const USAGE = 'usage: node scripts/sync.mjs fetch | lock [<commit> [<tag>]]';
const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

class UsageError extends Error {}

/** The archive address for the commit; the override is accepted only as a file: URL or an http: URL on loopback. */
export function archiveUrl(commit, env = process.env) {
  const override = env.PROOFLINE_SYNC_ARCHIVE_URL;
  const text = (override === undefined || override === '' ? DEFAULT_ADDRESS : override).replaceAll('{commit}', commit);
  if (override === undefined || override === '') return text;
  let url = null;
  try { url = new URL(text); } catch { /* not an address: refused below */ }
  const loopback = url !== null && url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (url === null || url.username !== '' || url.password !== '' || !(loopback || url.protocol === 'file:')) {
    throw new UsageError(`PROOFLINE_SYNC_ARCHIVE_URL must be a file: URL or an http address on 127.0.0.1 or localhost, got ${JSON.stringify(override)}`);
  }
  return url.href;
}

function readJsonFile(file, name) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (error) { return { errors: [`${name}: cannot be read (${error.code ?? error.message})`] }; }
  try { return { value: JSON.parse(text) }; } catch { return { errors: [`${name}: is not valid JSON`] }; }
}

function readPin() {
  const read = readJsonFile(PIN_FILE, 'sync/pin.json');
  if (read.errors) return read;
  const errors = validatePin(read.value);
  return errors.length > 0 ? { errors } : { pin: read.value };
}

function readLock(pin) {
  const read = readJsonFile(LOCK_FILE, 'sync/lock.json');
  if (read.errors) return read;
  const errors = validateLock(read.value);
  const mismatch = errors.length === 0 ? commitMismatch(pin, read.value) : null;
  if (mismatch !== null) errors.push(mismatch);
  return errors.length > 0 ? { errors } : { lock: read.value };
}

/** Archive bytes from the address; a failure is an Error whose message names the address. */
async function download(url) {
  if (url.startsWith('file:')) {
    try { return readFileSync(fileURLToPath(url)); } catch (error) { throw new Error(`cannot read ${url} (${error.code ?? error.message})`); }
  }
  const failed = (error) => {
    const why = error.name === 'TimeoutError' ? `no answer in ${DOWNLOAD_TIMEOUT_MS} ms` : (error.cause?.code ?? error.cause?.message ?? error.message);
    return new Error(`GET ${url} failed: ${why}`);
  };
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (error) {
    throw failed(error);
  }
  if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`);
  try {
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw failed(error);
  }
}

/** Download and unpack the archive for the commit: entries, or an Error naming the address. */
async function loadArchive(url) {
  const bytes = await download(url);
  try {
    return readTarGz(bytes);
  } catch (error) {
    throw new Error(`${url}: ${error.message}`);
  }
}

/** Every regular file under dir as POSIX relative paths, sorted; anything else (a link, a device) is reported. */
function walk(dir, prefix = '', odd = []) {
  const files = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...walk(dir, rel, odd).files);
    else if (entry.isFile()) files.push(rel);
    else odd.push(rel);
  }
  return { files: files.sort(byPath), odd };
}

/** The cache folder against the lock alone: file set, blob id and sha256 per file, and listing.tsv against tree_sha256. */
export function verifyCache(dir, lock) {
  const label = `.cache/sync/${lock.commit}`;
  const lines = [];
  let walked;
  try { walked = walk(dir); } catch (error) { return [`${label}: cannot be read (${error.code ?? error.message})`]; }
  for (const rel of walked.odd) lines.push(`${label}/${rel}: not a regular file`);
  const present = new Set(walked.files);
  const locked = new Set(lock.files.map((file) => file.path));
  // A concurrent fetch may remove a damaged cache while this one reads it: a read error is a problem line, so the fetch
  // falls through to the download instead of exiting on the error.
  const read = (rel) => {
    try { return readFileSync(join(dir, ...rel.split('/'))); } catch (error) {
      lines.push(`${label}/${rel}: cannot be read (${error.code ?? error.message})`);
      return null;
    }
  };
  for (const file of lock.files) {
    if (!present.has(file.path)) { lines.push(`${label}/${file.path}: missing from the cache`); continue; }
    const bytes = read(file.path);
    if (bytes === null) continue;
    const blob = blobId(bytes);
    const hash = sha256(bytes);
    if (blob !== file.blob) lines.push(`${label}/${file.path}: blob id differs (lock ${file.blob}, cache ${blob})`);
    if (hash !== file.sha256) lines.push(`${label}/${file.path}: sha256 differs (lock ${file.sha256}, cache ${hash})`);
  }
  for (const rel of walked.files) {
    if (rel !== 'listing.tsv' && !locked.has(rel)) lines.push(`${label}/${rel}: not in the lock`);
  }
  if (!present.has('listing.tsv')) lines.push(`${label}/listing.tsv: missing from the cache`);
  else {
    const bytes = read('listing.tsv');
    const hash = bytes === null ? null : sha256(bytes);
    if (hash !== null && hash !== lock.tree_sha256) lines.push(`${label}/listing.tsv: sha256 differs from tree_sha256 (lock ${lock.tree_sha256}, cache ${hash})`);
  }
  return lines.sort(byPath);
}

/** Write a file through a sibling and a rename, so a reader never sees half of it. */
function writeFileAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  writeFileSync(temp, text);
  renameSync(temp, file);
}

// Test seam: `hooks.at(point)` may return a promise that a test holds back to place one fetch between two of its steps; the
// points are verified-damaged, damaged-removed, before-rename and lost-rename. Production passes no hooks.
const at = async (hooks, point) => { await hooks.at?.(point); };
// A name part no two fetches share, even inside one process (a test drives several fetches in one process).
let sequence = 0;
const unique = () => `${process.pid}-${sequence++}`;

async function writeCache(dir, lock, entries, hooks) {
  mkdirSync(CACHE_ROOT, { recursive: true });
  const temp = `${dir}.tmp-${unique()}`;
  rmSync(temp, { recursive: true, force: true });
  try {
    mkdirSync(temp, { recursive: true });
    const byName = new Map(entries.filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry.data]));
    for (const file of lock.files) {
      const target = join(temp, ...file.path.split('/'));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, byName.get(file.path));
    }
    const items = listing(entries);
    writeFileSync(join(temp, 'listing.tsv'), treeText(items));
    await at(hooks, 'before-rename');
    renameSync(temp, dir);
    return items.length;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * A cache folder this fetch judged damaged is never deleted in place: another fetch may have repaired it since the judgement.
 * It is renamed to a sibling of its own (atomic), and what was moved is judged again; a folder that turns out good is put
 * back (or dropped when a repaired folder is already there). A missing folder means someone else handled it.
 */
async function moveAside(dir, lock, hooks) {
  const aside = `${dir}.bad-${unique()}`;
  // A killed fetch may have left a folder under this very name (a pid is reused): it is nobody's, so it goes first. The name is
  // built from the cache path, a fixed string, the pid and a counter only, so it cannot point outside the cache root.
  rmSync(aside, { recursive: true, force: true });
  try { renameSync(dir, aside); } catch (error) {
    // The folder is gone or the name was taken meanwhile: a concurrent fetch handled it, the next round looks again.
    if (error.code === 'ENOENT' || error.code === 'ENOTEMPTY' || error.code === 'EEXIST') return;
    throw error;
  }
  await at(hooks, 'damaged-removed');
  if (verifyCache(aside, lock).length === 0) {
    try { renameSync(aside, dir); return; } catch { /* a folder is back at dir already: the moved good copy is not needed */ }
  }
  rmSync(aside, { recursive: true, force: true });
}

async function fetchCommand(env, log, hooks) {
  const pinned = readPin();
  if (pinned.errors) return log.fail(pinned.errors);
  const { pin } = pinned;
  const locked = readLock(pin);
  if (locked.errors) return log.fail(locked.errors);
  const { lock } = locked;
  const dir = join(CACHE_ROOT, pin.commit);

  // A concurrent fetch may repair, replace or win the rename at any step: every round looks at the folder that is there now,
  // and a lost rename is another round, not an error. The archive is downloaded and verified once.
  let entries = null;
  let lastError = null;
  for (let round = 1; round <= ROUNDS; round++) {
    if (lstatSync(dir, { throwIfNoEntry: false }) !== undefined) {
      const problems = verifyCache(dir, lock);
      if (problems.length === 0) {
        log.out(`sync fetch: ${pin.commit} cache verified (${lock.files.length} files), no request`);
        return 0;
      }
      log.err(problems);
      await at(hooks, 'verified-damaged');
      await moveAside(dir, lock, hooks);
      continue;
    }
    if (entries === null) {
      entries = await loadArchive(archiveUrl(pin.commit, env));
      const problems = verifyEntries(lock, entries);
      if (problems.length > 0) return log.fail([...problems, `sync fetch: ${pin.commit} failed verification against sync/lock.json; nothing cached`]);
    }
    try {
      const count = await writeCache(dir, lock, entries, hooks);
      log.out(`sync fetch: ${pin.commit} verified and cached (${lock.files.length} files, ${count} listing entries)`);
      return 0;
    } catch (error) {
      lastError = error;
      await at(hooks, 'lost-rename');
    }
  }
  throw lastError ?? new Error(`the cache folder for ${pin.commit} kept changing under this fetch`);
}

async function lockCommand(args, env, log) {
  let pin;
  if (args.length > 0) {
    pin = { commit: args[0], tag: args[1] ?? null };
    const errors = validatePin(pin);
    if (errors.length > 0) return log.fail(errors);
  } else {
    const pinned = readPin();
    if (pinned.errors) return log.fail(pinned.errors);
    pin = pinned.pin;
    // An existing lock must belong to the pin: a hand-edited pin is moved with `lock <commit> <tag>` instead.
    if (existsSync(LOCK_FILE)) {
      const locked = readLock(pin);
      if (locked.errors) return log.fail([...locked.errors, 'sync lock: to move the pin and rewrite the lock run: node scripts/sync.mjs lock <commit> <tag>']);
    }
  }
  const url = archiveUrl(pin.commit, env);
  const entries = await loadArchive(url);
  const lock = buildLock(pin.commit, entries);
  writeFileAtomic(LOCK_FILE, serializeLock(lock));
  if (args.length > 0) writeFileAtomic(PIN_FILE, `${JSON.stringify(pin, null, 2)}\n`);
  const counts = GROUPS.map((group) => `${group} ${lock.files.filter((file) => groupOf(file.path) === group).length}`);
  log.out(`sync lock: ${pin.commit} ${counts.join(', ')} (${lock.files.length} files)`);
  return 0;
}

/** Run a command line (without node and the script path); returns the exit status. */
export async function main(argv, env = process.env, hooks = {}) {
  const stdout = [];
  const stderr = [];
  const log = {
    out: (line) => stdout.push(line),
    err: (lines) => stderr.push(...[].concat(lines)),
    fail(lines) { this.err(lines); return 1; },
  };
  let status;
  const [command, ...args] = argv;
  try {
    if (!((command === 'fetch' && args.length === 0) || (command === 'lock' && args.length <= 2))) throw new UsageError(USAGE);
    archiveUrl('0'.repeat(40), env); // a refused override exits 2 before anything is read or requested
    status = command === 'fetch' ? await fetchCommand(env, log, hooks) : await lockCommand(args, env, log);
  } catch (error) {
    stderr.push(error instanceof UsageError ? error.message : `sync ${command}: ${error.message}`);
    status = error instanceof UsageError ? 2 : 1;
  }
  if (stdout.length > 0) process.stdout.write(`${stdout.join('\n')}\n`);
  if (stderr.length > 0) process.stderr.write(`${stderr.join('\n')}\n`);
  return status;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((status) => { process.exitCode = status; });
}

// Pin and lock logic of TASK-007 (ADR 0003 points 1 to 3). Pure functions: no file system, no network, no clock.
//   blobId / sha256   the two digests the lock records for every file
//   listing / treeText   the sorted listing of an archive and the text whose sha256 is the lock's tree_sha256
//   buildLock / serializeLock   what `scripts/sync.mjs lock` writes (no date, no tag: the same archive gives the same bytes)
//   validatePin / validateLock   shape checks, messages start with the file name and name the field
//   verifyEntries   archive against the committed lock, one line per difference, sorted by path
import { createHash } from 'node:crypto';
import { INPUTS, roleOf } from './sync-set.mjs';
import { pathProblem } from './tar.mjs';

const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** The git blob id of the bytes (sha1 of `blob <length>`, a NUL byte and the bytes): equal to `git hash-object`. */
export const blobId = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

/** Every file as a blob and every directory (also the parents of files) as a tree with an empty blob, sorted by path. */
export function listing(entries) {
  const rows = new Map();
  const addTree = (path) => { if (!rows.has(path)) rows.set(path, { path, type: 'tree', blob: '' }); };
  for (const entry of entries) {
    const parts = entry.path.split('/');
    for (let i = 1; i < parts.length; i++) addTree(parts.slice(0, i).join('/'));
    if (entry.type === 'blob') rows.set(entry.path, { path: entry.path, type: 'blob', blob: blobId(entry.data) });
    else addTree(entry.path);
  }
  return [...rows.values()].sort((a, b) => byPath(a.path, b.path));
}

/** One `path<TAB>type<TAB>blob` line per item, each ending in a line feed: the cache's listing.tsv. */
export const treeText = (items) => items.map((item) => `${item.path}\t${item.type}\t${item.blob}\n`).join('');

/** The lock for the commit: every synced file and input with its blob id and sha256, sorted, and the tree hash. */
export function buildLock(commit, entries) {
  const files = entries
    .filter((entry) => entry.type === 'blob' && roleOf(entry.path) !== null)
    .map((entry) => ({ path: entry.path, role: roleOf(entry.path), blob: blobId(entry.data), sha256: sha256(entry.data) }))
    .sort((a, b) => byPath(a.path, b.path));
  for (const input of INPUTS) {
    if (!files.some((file) => file.path === input)) throw new Error(`${input}: input missing from the archive`);
  }
  return { commit, files, tree_sha256: sha256(treeText(listing(entries))) };
}

export const serializeLock = (lock) => `${JSON.stringify(lock, null, 2)}\n`;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const quote = (value) => JSON.stringify(value) ?? String(value);

/** Unknown and missing keys of an object, as messages for the named file and field prefix. */
function keyProblems(file, prefix, value, keys) {
  const problems = [];
  for (const key of Object.keys(value)) if (!keys.includes(key)) problems.push(`${file}: unknown field "${prefix}${key}"`);
  for (const key of keys) if (!(key in value)) problems.push(`${file}: missing field "${prefix}${key}"`);
  return problems;
}

/** Messages for a pin value, empty when it is valid: exactly `commit` (40 lower-case hex) and `tag` (null or vX.Y.Z). */
export function validatePin(value) {
  const file = 'sync/pin.json';
  if (!isObject(value)) return [`${file}: must be a JSON object`];
  const problems = keyProblems(file, '', value, ['commit', 'tag']);
  if ('commit' in value && !(typeof value.commit === 'string' && HEX40.test(value.commit))) {
    problems.push(`${file}: field "commit" must be 40 lower-case hexadecimal characters, got ${quote(value.commit)}`);
  }
  if ('tag' in value && value.tag !== null && !(typeof value.tag === 'string' && TAG.test(value.tag))) {
    problems.push(`${file}: field "tag" must be null or v<major>.<minor>.<patch>, got ${quote(value.tag)}`);
  }
  return problems;
}

/** Messages for a lock value, empty when it is valid: shape, safe paths in the synced set, roles, digests, order. */
export function validateLock(value) {
  const file = 'sync/lock.json';
  if (!isObject(value)) return [`${file}: must be a JSON object`];
  const problems = keyProblems(file, '', value, ['commit', 'files', 'tree_sha256']);
  if ('commit' in value && !(typeof value.commit === 'string' && HEX40.test(value.commit))) {
    problems.push(`${file}: field "commit" must be 40 lower-case hexadecimal characters, got ${quote(value.commit)}`);
  }
  if ('tree_sha256' in value && !(typeof value.tree_sha256 === 'string' && HEX64.test(value.tree_sha256))) {
    problems.push(`${file}: field "tree_sha256" must be 64 lower-case hexadecimal characters, got ${quote(value.tree_sha256)}`);
  }
  if (!('files' in value)) return problems;
  if (!Array.isArray(value.files)) return [...problems, `${file}: field "files" must be an array`];
  let previous = null;
  const paths = new Set();
  value.files.forEach((item, i) => {
    const at = `files[${i}]`;
    if (!isObject(item)) { problems.push(`${file}: field "${at}" must be an object`); return; }
    problems.push(...keyProblems(file, `${at}.`, item, ['path', 'role', 'blob', 'sha256']));
    const path = item.path;
    const expected = typeof path === 'string' && pathProblem(path) === null ? roleOf(path) : null;
    if (expected === null) problems.push(`${file}: field "${at}.path" must be a safe path in the synced set or an input, got ${quote(path)}`);
    else {
      if (item.role !== expected) problems.push(`${file}: field "${at}.role" must be "${expected}" for ${path}, got ${quote(item.role)}`);
      if (paths.has(path)) problems.push(`${file}: field "${at}.path" duplicates ${path}`);
      else if (previous !== null && byPath(path, previous) < 0) problems.push(`${file}: field "${at}.path" is not sorted, ${path} comes after ${previous}`);
      paths.add(path);
      previous = path;
    }
    if ('blob' in item && !(typeof item.blob === 'string' && HEX40.test(item.blob))) problems.push(`${file}: field "${at}.blob" must be 40 lower-case hexadecimal characters, got ${quote(item.blob)}`);
    if ('sha256' in item && !(typeof item.sha256 === 'string' && HEX64.test(item.sha256))) problems.push(`${file}: field "${at}.sha256" must be 64 lower-case hexadecimal characters, got ${quote(item.sha256)}`);
  });
  for (const input of INPUTS) if (!paths.has(input)) problems.push(`${file}: field "files" must hold ${input}`);
  return problems;
}

/** The message for a lock that belongs to another commit than the pin, or null when they agree. */
export function commitMismatch(pin, lock) {
  return lock.commit === pin.commit ? null : `sync/lock.json commit ${lock.commit} differs from sync/pin.json commit ${pin.commit}`;
}

/**
 * Archive against the committed lock and nothing else: per lock path presence, blob id and sha256; every archive file in
 * the synced set must be in the lock; the tree hash must equal the lock's. Lines sorted by path, the tree line last.
 */
export function verifyEntries(lock, entries) {
  const files = new Map(entries.filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry]));
  const locked = new Set(lock.files.map((file) => file.path));
  const lines = [];
  for (const file of lock.files) {
    const entry = files.get(file.path);
    if (!entry) { lines.push({ path: file.path, text: `${file.path}: in the lock, missing from the archive` }); continue; }
    const blob = blobId(entry.data);
    const hash = sha256(entry.data);
    if (blob !== file.blob) lines.push({ path: file.path, text: `${file.path}: blob id differs (lock ${file.blob}, archive ${blob})` });
    if (hash !== file.sha256) lines.push({ path: file.path, text: `${file.path}: sha256 differs (lock ${file.sha256}, archive ${hash})` });
  }
  for (const path of files.keys()) {
    if (roleOf(path) !== null && !locked.has(path)) lines.push({ path, text: `${path}: in the archive and the synced set, missing from the lock` });
  }
  const out = lines.sort((a, b) => byPath(a.path, b.path)).map((line) => line.text);
  const tree = sha256(treeText(listing(entries)));
  if (tree !== lock.tree_sha256) out.push(`tree_sha256 differs (lock ${lock.tree_sha256}, archive ${tree})`);
  return out;
}

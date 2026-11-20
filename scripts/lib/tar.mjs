// A small, strict reader for the tar.gz archives that codeload.github.com serves (TASK-007).
// readTarGz(buffer) returns [{ path, type: 'blob' | 'tree', data: Buffer | null }] in archive order, with the single top
// folder stripped. It reads ustar headers (name, prefix, octal size, type flag), the pax global header (skipped), pax
// `path=` records and GNU long names. Every header's checksum (offset 148) is checked. Every other entry type (links, devices, ...) fails closed, as does an unsafe path,
// a duplicate path, a second top folder, a truncated body and an unpacked size over the limit. Pure: no file system.
import { gunzipSync } from 'node:zlib';

export const MAX_UNPACKED_BYTES = 512 * 1024 * 1024;

/** A path as shown in a message: control characters and backslashes escaped, so a name never breaks a line. */
export function show(path) {
  return String(path).replace(/[\x00-\x1f\x7f\\]/g, (ch) => {
    if (ch === '\t') return '\\t';
    if (ch === '\n') return '\\n';
    if (ch === '\r') return '\\r';
    if (ch === '\\') return '\\\\';
    return `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`;
  });
}

/** Why a repository path is unsafe to use as a file name and as a listing line, or null when it is fine. */
export function pathProblem(path) {
  if (typeof path !== 'string' || path === '') return 'empty path';
  if (path.startsWith('/')) return 'absolute path';
  if (/[\t\r\n]/.test(path)) return 'tab, carriage return or line feed in the path';
  for (const segment of path.split('/')) {
    if (segment === '') return 'empty path segment';
    if (segment === '.' || segment === '..') return '"." or ".." path segment';
  }
  return null;
}

const isZero = (block) => block.every((byte) => byte === 0);

/** The header checksum: the sum of all 512 header bytes with the checksum field (offset 148, 8 bytes) read as spaces. */
function headerSum(head) {
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : head[i];
  return sum;
}

/** Text up to the first NUL byte. */
function cString(bytes) {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
}

function octal(bytes, label) {
  if (bytes[0] & 0x80) throw new Error(`archive entry ${show(label)}: unsupported size encoding`);
  const text = cString(bytes).trim();
  if (!/^[0-7]*$/.test(text)) throw new Error(`archive entry ${show(label)}: invalid size field`);
  return text === '' ? 0 : parseInt(text, 8);
}

/** The `path` value of a pax extended header body (records `<length> <key>=<value>\n`), or null. */
function paxPath(body) {
  let at = 0;
  let found = null;
  while (at < body.length) {
    const space = body.indexOf(0x20, at);
    const length = space === -1 ? NaN : Number(body.subarray(at, space).toString('latin1'));
    if (!Number.isInteger(length) || length <= space - at + 1 || at + length > body.length) throw new Error('archive: malformed pax header');
    const record = body.subarray(space + 1, at + length - 1).toString('utf8');
    const eq = record.indexOf('=');
    if (eq !== -1 && record.slice(0, eq) === 'path') found = record.slice(eq + 1);
    at += length;
  }
  return found;
}

function unpack(buffer, maxBytes) {
  try {
    return gunzipSync(buffer, { maxOutputLength: maxBytes });
  } catch (error) {
    if (error.code === 'ERR_BUFFER_TOO_LARGE') throw new Error(`archive: unpacked size is over the limit of ${maxBytes} bytes`);
    if (error.code === 'Z_BUF_ERROR') throw new Error('archive: truncated gzip stream');
    throw new Error(`archive: not a valid gzip stream (${error.code ?? error.message})`);
  }
}

export function readTarGz(buffer, { maxBytes = MAX_UNPACKED_BYTES } = {}) {
  const tar = unpack(buffer, maxBytes);
  const raw = [];
  let at = 0;
  let pendingPath = null;
  let pendingLong = null;
  while (at < tar.length) {
    if (at + 512 > tar.length) throw new Error('archive: truncated header');
    const head = tar.subarray(at, at + 512);
    if (isZero(head)) break;
    const flag = head[156] === 0 ? '0' : String.fromCharCode(head[156]);
    const ustar = head.subarray(257, 263).toString('latin1') === 'ustar\0';
    const name = cString(head.subarray(0, 100));
    const prefix = ustar ? cString(head.subarray(345, 500)) : '';
    const stored = cString(head.subarray(148, 156)).trim();
    if (!/^[0-7]+$/.test(stored) || parseInt(stored, 8) !== headerSum(head)) throw new Error(`archive entry ${show(name)}: bad header checksum`);
    const size = octal(head.subarray(124, 136), name);
    at += 512;
    if (at + size > tar.length) throw new Error(`archive entry ${show(name)}: truncated body`);
    const body = tar.subarray(at, at + size);
    at = Math.min(tar.length, at + size + ((512 - (size % 512)) % 512));
    if (flag === 'g') continue;
    if (flag === 'x') { pendingPath = paxPath(body); continue; }
    if (flag === 'L') { pendingLong = cString(body); continue; }
    const path = pendingPath ?? pendingLong ?? (prefix === '' ? name : `${prefix}/${name}`);
    pendingPath = null;
    pendingLong = null;
    if (flag !== '0' && flag !== '5') {
      const shown = /^[\x21-\x7e]$/.test(flag) ? flag : `0x${flag.charCodeAt(0).toString(16)}`;
      throw new Error(`archive entry ${show(path)}: unsupported type ${shown}`);
    }
    const tree = flag === '5';
    const clean = tree && path.endsWith('/') ? path.slice(0, -1) : path;
    const problem = pathProblem(clean);
    if (problem) throw new Error(`archive entry ${show(path)}: ${problem}`);
    raw.push({ full: path, path: clean, type: tree ? 'tree' : 'blob', data: tree ? null : body });
  }

  const entries = [];
  const seen = new Set();
  const top = raw.length === 0 ? null : raw[0].path.split('/')[0];
  for (const item of raw) {
    const segments = item.path.split('/');
    if (segments[0] !== top) throw new Error(`archive: more than one top folder (${show(top)} and ${show(segments[0])})`);
    if (segments.length === 1) {
      if (item.type === 'blob') throw new Error(`archive entry ${show(item.full)}: file outside the top folder`);
      continue;
    }
    const path = segments.slice(1).join('/');
    if (seen.has(path)) throw new Error(`archive entry ${show(item.full)}: duplicate path ${show(path)}`);
    seen.add(path);
    entries.push({ path, type: item.type, data: item.data });
  }
  const files = new Set(entries.filter((entry) => entry.type === 'blob').map((entry) => entry.path));
  for (const entry of entries) {
    const parts = entry.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(0, i).join('/');
      if (files.has(parent)) throw new Error(`archive entry ${show(entry.path)}: duplicate path ${show(parent)} (a file and a directory)`);
    }
  }
  return entries;
}

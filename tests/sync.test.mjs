// TASK-007: sync pin, lock and verified fetch (scripts/sync.mjs, scripts/lib/*.mjs, sync/pin.json, sync/lock.json).
// Every archive is built in this file (ustar headers with checksums, gzipped) and every project is a temp copy of the
// scripts, so no test makes a network request and none touches the repository's own .cache/. Tests that need a local
// http server run the CLI with asynchronous spawn, because a synchronous spawn would block the server in this process.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { hashTree } from '../scripts/check-dist.mjs';
import { readTarGz } from '../scripts/lib/tar.mjs';
import { validateLock, validatePin } from '../scripts/lib/lock.mjs';
import { SYNCED_SET, groupOf, roleOf } from '../scripts/lib/sync-set.mjs';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

sweepStale();
after(removeTempDirs);

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const OTHER = '89abcdef0123456789abcdef0123456789abcdef';
const LAUNCH = 'b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd';
const ZERO40 = '0'.repeat(40);
const ZERO64 = '0'.repeat(64);
const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ---------- fixture archive ----------

const LONG_FILE = `src/${'deep-directory-name/'.repeat(6)}inner/file-with-a-long-name.txt`; // over 100 characters: needs the prefix field
const FILES = {
  'README.md': 'Readme of the fixture\n',
  LICENSE: 'Licence text\n',
  'docs/guides/getting-started.md': '# Getting started\n',
  'docs/guides/second.md': '# Second guide\n',
  'docs/guides/tr/baslangic.md': '# Başlangıç\n',
  'docs/concepts/a.md': '# Concept a\n',
  'docs/concepts/b.md': '# Concept b\n',
  'docs/concepts/c.md': '# Concept c\n',
  'docs/proof.md': '# Proof\n',
  'docs/limits.md': '# Limits text\n',
  'docs/decisions.md': '# Decisions, not synced\n',
  'docs/adr/0001.md': '# ADR, not synced\n',
  'skills/alpha/SKILL.md': '# Alpha skill\n',
  'skills/beta/SKILL.md': '# Beta skill\n',
  'skills/alpha/references/r.md': '# Reference, not synced\n',
  [LONG_FILE]: 'long path\n',
};
const SYNCED_PATHS = Object.keys(FILES).filter((p) => /^(docs\/guides\/[^/]+\.md|docs\/guides\/tr\/[^/]+\.md|docs\/concepts\/[^/]+\.md|docs\/proof\.md|docs\/limits\.md|skills\/[^/]+\/SKILL\.md)$/.test(p));

const pad = (n) => (512 - (n % 512)) % 512;

function splitName(path) {
  if (Buffer.byteLength(path) <= 100) return ['', path];
  for (let i = path.indexOf('/'); i !== -1; i = path.indexOf('/', i + 1)) {
    if (i <= 155 && Buffer.byteLength(path.slice(i + 1)) <= 100) return [path.slice(0, i), path.slice(i + 1)];
  }
  throw new Error(`cannot split ${path}`);
}

function header({ name, prefix = '', size = 0, type = '0', link = '' }) {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100, 'utf8');
  h.write('0000644\0', 100);
  h.write('0000000\0', 108);
  h.write('0000000\0', 116);
  h.write(`${size.toString(8).padStart(11, '0')}\0`, 124);
  h.write('00000000000\0', 136);
  h.write('        ', 148);
  h.write(type, 156);
  h.write(link, 157, 100, 'utf8');
  h.write('ustar\0', 257);
  h.write('00', 263);
  h.write(prefix, 345, 155, 'utf8');
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return h;
}

/** One archive entry: header plus padded body. `raw` skips the name split (the name is written as given). */
function entry(path, data = '', type = '0', { link = '', raw = false } = {}) {
  const body = Buffer.from(data);
  const [prefix, name] = raw ? ['', path] : splitName(path);
  return Buffer.concat([header({ name, prefix, size: body.length, type, link }), body, Buffer.alloc(pad(body.length))]);
}

const END = Buffer.alloc(1024);
const globalHeader = (commit = COMMIT) => entry('pax_global_header', `52 comment=${commit}\n`, 'g');

function dirsOf(paths) {
  const dirs = new Set();
  for (const p of paths) {
    const s = p.split('/');
    for (let i = 1; i < s.length; i++) dirs.add(s.slice(0, i).join('/'));
  }
  return [...dirs].sort(byPath);
}

/** A codeload-like archive: global pax header, top folder, directory entries, files, two zero blocks, gzip. */
function archiveOf(files = FILES, { commit = COMMIT, extra = [] } = {}) {
  const top = `proofline-${commit}`;
  const parts = [globalHeader(commit), entry(`${top}/`, '', '5')];
  for (const d of dirsOf(Object.keys(files))) parts.push(entry(`${top}/${d}/`, '', '5'));
  for (const [p, data] of Object.entries(files)) parts.push(entry(`${top}/${p}`, data));
  parts.push(...extra, END);
  return gzipSync(Buffer.concat(parts));
}

const gz = (...parts) => gzipSync(Buffer.concat([...parts, END]));
const withFile = (path, data) => ({ ...FILES, [path]: data });
const gitBlob = (data) => spawnSync('git', ['hash-object', '--stdin'], { input: Buffer.from(data), encoding: 'utf8' }).stdout.trim();

/** The listing text a correct implementation derives from the fixture files (independent of the library). */
function listingText(files = FILES) {
  const rows = [
    ...Object.entries(files).map(([p, d]) => [p, 'blob', gitBlob(d)]),
    ...dirsOf(Object.keys(files)).map((d) => [d, 'tree', '']),
  ].sort((a, b) => byPath(a[0], b[0]));
  return rows.map((r) => `${r.join('\t')}\n`).join('');
}

// ---------- projects, runs, servers ----------

const store = () => makeTempDir('proofline-site-');
let counter = 0;

function saveArchive(bytes) {
  const dir = join(store(), `a${counter++}`);
  mkdirSync(dir);
  const path = join(dir, 'a.tgz');
  writeFileSync(path, bytes);
  return pathToFileURL(path).href;
}

const missingUrl = () => pathToFileURL(join(store(), 'missing.tgz')).href;

function project({ pin = { commit: COMMIT, tag: 'v1.0.0' }, rawPin } = {}) {
  const dir = store();
  mkdirSync(join(dir, 'scripts'));
  cpSync(join(repo, 'scripts', 'sync.mjs'), join(dir, 'scripts', 'sync.mjs'));
  cpSync(join(repo, 'scripts', 'lib'), join(dir, 'scripts', 'lib'), { recursive: true });
  mkdirSync(join(dir, 'sync'));
  writeFileSync(join(dir, 'sync', 'pin.json'), rawPin ?? `${JSON.stringify(pin, null, 2)}\n`);
  return dir;
}

function envFor(url, extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.PROOFLINE_SYNC_ARCHIVE_URL;
  if (url !== undefined) env.PROOFLINE_SYNC_ARCHIVE_URL = url;
  return env;
}

function run(dir, args, url) {
  const r = spawnSync(process.execPath, ['scripts/sync.mjs', ...args], { cwd: dir, env: envFor(url), encoding: 'utf8', timeout: 25000 });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runAsync(dir, args, url) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/sync.mjs', ...args], { cwd: dir, env: envFor(url), timeout: 25000 });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function serve(respond) {
  return new Promise((resolve) => {
    const requests = [];
    const server = http.createServer((req, res) => { requests.push(req.url); respond(req, res); });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        requests,
        port,
        url: `http://127.0.0.1:${port}/archive/{commit}`,
        close: () => new Promise((done) => { server.close(() => done()); server.closeAllConnections(); }),
      });
    });
  });
}

const serveBytes = (bytes) => serve((req, res) => { res.writeHead(200, { 'content-type': 'application/gzip' }); res.end(bytes); });
const serveStatus = (status) => serve((req, res) => { res.writeHead(status); res.end('no'); });

async function closedPortUrl() {
  const s = await serve((req, res) => res.end());
  const url = s.url;
  await s.close();
  return url;
}

const readJson = (dir, rel) => JSON.parse(readFileSync(join(dir, rel), 'utf8'));
const cacheRoot = (dir) => join(dir, '.cache', 'sync');
const cacheDir = (dir, commit = COMMIT) => join(cacheRoot(dir), commit);
const cacheEntries = (dir) => (existsSync(cacheRoot(dir)) ? readdirSync(cacheRoot(dir)) : []);

/** A project with a lock made from `files` at COMMIT; returns the project and the archive url. */
function lockedProject(files = FILES) {
  const dir = project();
  const url = saveArchive(archiveOf(files));
  const r = run(dir, ['lock'], url);
  assert.equal(r.status, 0, `lock must exit 0: ${r.stderr}`);
  assert.ok(existsSync(join(dir, 'sync', 'lock.json')), 'the lock command wrote sync/lock.json');
  return { dir, url };
}

/** One fetch that must pass and leave the verified cache. */
function fetchOk(dir, url) {
  const r = run(dir, ['fetch'], url);
  assert.equal(r.status, 0, `fetch must exit 0: ${r.stderr}`);
  assert.ok(existsSync(cacheDir(dir)), 'the fetch wrote the cache');
  return r;
}

function editLock(dir, edit) {
  const lock = readJson(dir, 'sync/lock.json');
  edit(lock);
  writeFileSync(join(dir, 'sync', 'lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
}

// ---------- tests ----------

describe('sync pin', () => {
  it('sync/pin.json holds exactly the launch pin', () => {
    const file = join(repo, 'sync', 'pin.json');
    assert.ok(existsSync(file), 'sync/pin.json exists');
    const pin = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(pin).sort(), ['commit', 'tag']);
    assert.equal(pin.commit, LAUNCH);
    assert.equal(pin.tag, 'v0.0.173');
  });

  it('every command rejects an invalid pin naming sync/pin.json and the field', () => {
    const bad = [
      ['a 39 character commit', { commit: COMMIT.slice(1), tag: null }, 'commit'],
      ['an upper-case hex digit', { commit: COMMIT.replace('a', 'A'), tag: null }, 'commit'],
      ['a tag latest', { commit: COMMIT, tag: 'latest' }, 'tag'],
    ];
    for (const [label, pin, field] of bad) {
      for (const command of ['fetch', 'lock']) {
        const dir = project({ pin });
        const r = run(dir, [command], missingUrl());
        assert.notEqual(r.status, 0, `${command} with ${label} must fail`);
        assert.match(r.stderr, new RegExp(`sync/pin\\.json: field "${field}"`), `${command} with ${label}: ${r.stderr}`);
        assert.ok(!existsSync(join(dir, '.cache')) && !existsSync(join(dir, 'sync', 'lock.json')), `${command} with ${label} writes nothing`);
      }
    }
  });
});

describe('synced set', () => {
  it('the synced set holds the six globs and selects only matching paths', () => {
    assert.deepEqual([...SYNCED_SET], ['docs/guides/*.md', 'docs/guides/tr/*.md', 'docs/concepts/*.md', 'docs/proof.md', 'docs/limits.md', 'skills/*/SKILL.md']);
    assert.ok(Object.isFrozen(SYNCED_SET), 'the constant is frozen');
    assert.equal(roleOf('docs/guides/tr/x.md'), 'page');
    assert.equal(roleOf('docs/guides/x.md'), 'page');
    assert.equal(roleOf('docs/concepts/x.md'), 'page');
    assert.equal(roleOf('docs/proof.md'), 'page');
    assert.equal(roleOf('docs/limits.md'), 'page');
    assert.equal(roleOf('skills/a/SKILL.md'), 'page');
    assert.equal(roleOf('README.md'), 'input');
    for (const none of ['docs/decisions.md', 'docs/adr/0001.md', 'skills/a/references/y.md', 'skills/a/b/SKILL.md', 'docs/guides/x.txt', 'docs/guides/a/b.md', 'docs/guides/tr/a/b.md', 'x/README.md']) {
      assert.equal(roleOf(none), null, `${none} is not selected`);
    }
    assert.equal(groupOf('docs/guides/x.md'), 'guides');
    assert.equal(groupOf('docs/guides/tr/x.md'), 'turkish guides');
    assert.equal(groupOf('docs/concepts/x.md'), 'concepts');
    assert.equal(groupOf('docs/proof.md'), 'proof and limits');
    assert.equal(groupOf('docs/limits.md'), 'proof and limits');
    assert.equal(groupOf('skills/a/SKILL.md'), 'skills');
    assert.equal(groupOf('README.md'), 'input');
  });
});

describe('lock command', () => {
  it('lock command writes sorted entries with blob id, sha256 and tree hash', () => {
    const dir = project();
    const pinBefore = readFileSync(join(dir, 'sync', 'pin.json'), 'utf8');
    const r = run(dir, ['lock'], saveArchive(archiveOf()));
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, 'sync', 'lock.json')), 'sync/lock.json is written');
    const lock = readJson(dir, 'sync/lock.json');
    assert.deepEqual(Object.keys(lock), ['commit', 'files', 'tree_sha256']);
    assert.equal(lock.commit, COMMIT);
    const expected = [...SYNCED_PATHS, 'README.md'].sort(byPath);
    assert.deepEqual(lock.files.map((f) => f.path), expected);
    for (const f of lock.files) {
      assert.deepEqual(Object.keys(f), ['path', 'role', 'blob', 'sha256']);
      assert.equal(f.role, f.path === 'README.md' ? 'input' : 'page');
      assert.equal(f.blob, gitBlob(FILES[f.path]), `${f.path} blob id equals git hash-object`);
      assert.equal(f.sha256, sha256(FILES[f.path]), `${f.path} sha256`);
    }
    assert.equal(lock.tree_sha256, sha256(listingText()));
    assert.equal(readFileSync(join(dir, 'sync', 'pin.json'), 'utf8'), pinBefore, 'a lock run without arguments leaves the pin alone');
    assert.ok(!existsSync(join(dir, '.cache')), 'the lock command never writes the cache');
  });

  it('lock command output is identical on a second run and holds no date', () => {
    const dir = project();
    const url = saveArchive(archiveOf());
    assert.equal(run(dir, ['lock'], url).status, 0);
    assert.ok(existsSync(join(dir, 'sync', 'lock.json')), 'sync/lock.json is written');
    const first = readFileSync(join(dir, 'sync', 'lock.json'));
    assert.ok(first.length > 0 && first.at(-1) === 0x0a, 'the file ends with a line feed');
    assert.equal(run(dir, ['lock'], url).status, 0);
    assert.deepEqual(readFileSync(join(dir, 'sync', 'lock.json')), first);
    rmSync(join(dir, 'sync', 'lock.json'));
    assert.equal(run(dir, ['lock'], url).status, 0);
    assert.deepEqual(readFileSync(join(dir, 'sync', 'lock.json')), first);
    const text = first.toString('utf8');
    assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/);
    assert.doesNotMatch(text, /T\d{2}:/);
    assert.doesNotMatch(text, /"tag"/);
  });

  it('lock command prints one line with the number of files for each group', () => {
    const dir = project();
    const r = run(dir, ['lock'], saveArchive(archiveOf()));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, `sync lock: ${COMMIT} guides 2, turkish guides 1, concepts 3, proof and limits 2, skills 2, input 1 (11 files)\n`);
    assert.equal(r.stderr, '');
  });

  it('lock with arguments rewrites the pin only after a successful download', async () => {
    const dir = project();
    const pinBefore = readFileSync(join(dir, 'sync', 'pin.json'), 'utf8');
    const s404 = await serveStatus(404);
    try {
      const failed = await runAsync(dir, ['lock', OTHER, 'v2.3.4'], s404.url);
      assert.equal(failed.status, 1, failed.stderr);
      assert.match(failed.stderr, /answered 404/);
      assert.equal(readFileSync(join(dir, 'sync', 'pin.json'), 'utf8'), pinBefore, 'a failed run leaves the pin');
      assert.ok(!existsSync(join(dir, 'sync', 'lock.json')), 'a failed run writes no lock');
    } finally {
      await s404.close();
    }
    const ok = run(dir, ['lock', OTHER, 'v2.3.4'], saveArchive(archiveOf(FILES, { commit: OTHER })));
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(readFileSync(join(dir, 'sync', 'pin.json'), 'utf8'), `${JSON.stringify({ commit: OTHER, tag: 'v2.3.4' }, null, 2)}\n`);
    assert.equal(readJson(dir, 'sync/lock.json').commit, OTHER);
    for (const args of [['lock', 'abc'], ['lock', COMMIT.toUpperCase()], ['lock', COMMIT, 'latest'], ['lock', COMMIT, 'v1.2']]) {
      const before = readFileSync(join(dir, 'sync', 'pin.json'), 'utf8');
      const r = run(dir, args, missingUrl());
      assert.equal(r.status, 1, `${args.join(' ')}: ${r.stderr}`);
      assert.match(r.stderr, /sync\/pin\.json: field "(commit|tag)"/);
      assert.equal(readFileSync(join(dir, 'sync', 'pin.json'), 'utf8'), before);
    }
  });

  it('bad arguments and bad archive addresses exit 2 and write nothing', () => {
    const dir = project();
    const cases = [
      [['fetch', 'extra'], missingUrl()],
      [[], missingUrl()],
      [['frobnicate'], missingUrl()],
      [['lock', COMMIT, 'v1.0.0', 'extra'], missingUrl()],
      [['fetch'], 'https://example.com/a.tgz'],
      [['lock'], 'http://example.com/a.tgz'],
      [['fetch'], 'http://127.0.0.1.evil.com/a.tgz'],
      [['fetch'], 'http://localhost.evil.com/a.tgz'],
      [['fetch'], 'http://127.0.0.1@evil.com/a.tgz'],
      [['fetch'], 'ftp://localhost/a.tgz'],
      [['lock'], '/plain/path.tgz'],
    ];
    for (const [args, url] of cases) {
      const r = run(dir, args, url);
      assert.equal(r.status, 2, `${args.join(' ')} with ${url}: ${r.stderr}`);
      assert.ok(r.stderr.length > 0 && !/\n\s+at /.test(r.stderr), 'a message and no stack frames');
    }
    assert.match(run(dir, ['fetch'], 'https://example.com/a.tgz').stderr, /PROOFLINE_SYNC_ARCHIVE_URL/);
    assert.ok(!existsSync(join(dir, '.cache')) && !existsSync(join(dir, 'sync', 'lock.json')));
  });
});

describe('fetch command', () => {
  it('fetch caches every lock file and a listing of the whole archive', () => {
    const { dir, url } = lockedProject();
    const r = fetchOk(dir, url);
    assert.match(r.stdout, new RegExp(`^sync fetch: ${COMMIT} verified and cached \\(11 files, \\d+ listing entries\\)\\n$`));
    assert.deepEqual(cacheEntries(dir), [COMMIT], 'no temporary sibling remains');
    const lock = readJson(dir, 'sync/lock.json');
    for (const f of lock.files) {
      assert.deepEqual(readFileSync(join(cacheDir(dir), f.path)), Buffer.from(FILES[f.path]), `${f.path} bytes`);
    }
    const listing = readFileSync(join(cacheDir(dir), 'listing.tsv'), 'utf8');
    assert.equal(listing, listingText());
    assert.equal(sha256(listing), lock.tree_sha256);
    assert.ok(listing.includes(`${LONG_FILE}\tblob\t`), 'a path outside the synced set, over 100 characters, is listed');
    assert.ok(!existsSync(join(cacheDir(dir), 'LICENSE')), 'files outside the lock are not cached');
    assert.equal(readdirSync(cacheDir(dir)).sort().join(), ['README.md', 'docs', 'listing.tsv', 'skills'].join());
  });

  it('a changed archive byte fails the fetch naming the path and leaves no cache', () => {
    const { dir } = lockedProject();
    const tampered = saveArchive(archiveOf(withFile('docs/limits.md', '# Limits tezt\n')));
    const r = run(dir, ['fetch'], tampered);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stderr, /docs\/limits\.md: blob id differs/);
    assert.match(r.stderr, /docs\/limits\.md: sha256 differs/);
    assert.match(r.stderr, new RegExp(`sync fetch: ${COMMIT} failed verification against sync/lock\\.json; nothing cached`));
    assert.deepEqual(cacheEntries(dir), [], 'nothing is cached, no temporary folder remains');
    const again = run(dir, ['fetch'], missingUrl());
    assert.equal(again.status, 1, 'a second fetch with the archive unavailable also fails: no cache was left behind');
    assert.deepEqual(cacheEntries(dir), []);
  });

  it('a wrong blob id or a wrong sha256 in the lock fails naming the file and the field', () => {
    const { dir, url } = lockedProject();
    editLock(dir, (lock) => { lock.files.find((f) => f.path === 'docs/proof.md').blob = ZERO40; });
    const a = run(dir, ['fetch'], url);
    assert.equal(a.status, 1);
    assert.match(a.stderr, /docs\/proof\.md: blob id differs/);
    assert.doesNotMatch(a.stderr, /docs\/proof\.md: sha256 differs/);
    assert.deepEqual(cacheEntries(dir), []);

    const second = lockedProject();
    editLock(second.dir, (lock) => { lock.files.find((f) => f.path === 'docs/limits.md').sha256 = ZERO64; });
    const b = run(second.dir, ['fetch'], second.url);
    assert.equal(b.status, 1);
    assert.match(b.stderr, /docs\/limits\.md: sha256 differs/);
    assert.doesNotMatch(b.stderr, /docs\/limits\.md: blob id differs/);
    assert.deepEqual(cacheEntries(second.dir), []);
  });

  it('a file missing from the archive or from the lock fails naming the path and the side', () => {
    const { dir, url } = lockedProject();
    editLock(dir, (lock) => {
      lock.files.push({ path: 'docs/concepts/zz.md', role: 'page', blob: ZERO40, sha256: ZERO64 });
      lock.files.sort((x, y) => byPath(x.path, y.path));
    });
    const a = run(dir, ['fetch'], url);
    assert.equal(a.status, 1);
    assert.match(a.stderr, /docs\/concepts\/zz\.md: in the lock, missing from the archive/);
    assert.deepEqual(cacheEntries(dir), []);

    const second = lockedProject();
    const b = run(second.dir, ['fetch'], saveArchive(archiveOf(withFile('docs/guides/new.md', '# New\n'))));
    assert.equal(b.status, 1);
    assert.match(b.stderr, /docs\/guides\/new\.md: in the archive and the synced set, missing from the lock/);
    assert.deepEqual(cacheEntries(second.dir), []);
  });

  it('a lock for another commit than the pin fails naming both commits', async () => {
    const { dir } = lockedProject();
    editLock(dir, (lock) => { lock.commit = OTHER; });
    const counting = await serveBytes(archiveOf());
    try {
      const fetched = await runAsync(dir, ['fetch'], counting.url);
      assert.equal(fetched.status, 1);
      assert.ok(fetched.stderr.includes(`sync/lock.json commit ${OTHER} differs from sync/pin.json commit ${COMMIT}`), fetched.stderr);
      const locked = await runAsync(dir, ['lock'], counting.url);
      assert.equal(locked.status, 1);
      assert.ok(locked.stderr.includes(`sync/lock.json commit ${OTHER} differs from sync/pin.json commit ${COMMIT}`), locked.stderr);
      assert.deepEqual(counting.requests, [], 'no download before the refusal');
      assert.deepEqual(cacheEntries(dir), []);
      assert.equal(readJson(dir, 'sync/lock.json').commit, OTHER, 'the stale lock is not rewritten');
    } finally {
      await counting.close();
    }
  });

  it('a filled cache is verified with no request', async () => {
    const { dir, url } = lockedProject();
    fetchOk(dir, url);
    const before = hashTree(cacheDir(dir)).digest;
    const counting = await serveBytes(archiveOf());
    try {
      const r = await runAsync(dir, ['fetch'], counting.url);
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, new RegExp(`sync fetch: ${COMMIT} cache verified \\(11 files\\), no request`));
      assert.deepEqual(counting.requests, [], 'the server saw no request');
    } finally {
      await counting.close();
    }
    const offline = await runAsync(dir, ['fetch'], await closedPortUrl());
    assert.equal(offline.status, 0, offline.stderr);
    assert.equal(hashTree(cacheDir(dir)).digest, before, 'the cache is unchanged');
  });

  it('a changed cache byte fails offline and is repaired online', async () => {
    const { dir, url } = lockedProject();
    fetchOk(dir, url);
    const good = readFileSync(join(cacheDir(dir), 'docs', 'proof.md'));
    writeFileSync(join(cacheDir(dir), 'docs', 'proof.md'), `${good.toString('utf8')}x`);
    const offline = await runAsync(dir, ['fetch'], await closedPortUrl());
    assert.equal(offline.status, 1);
    assert.ok(offline.stderr.includes(`.cache/sync/${COMMIT}/docs/proof.md`), offline.stderr);
    const online = await serveBytes(archiveOf());
    try {
      const r = await runAsync(dir, ['fetch'], online.url);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(online.requests.length, 1, 'exactly one download');
    } finally {
      await online.close();
    }
    assert.deepEqual(readFileSync(join(cacheDir(dir), 'docs', 'proof.md')), good);
    assert.deepEqual(cacheEntries(dir), [COMMIT]);
  });

  // A file the process cannot read (mode 000) stands for a cache file another fetch is replacing or a damaged disk.
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const lockedCacheFile = () => {
    const { dir, url } = lockedProject();
    fetchOk(dir, url);
    const file = join(cacheDir(dir), 'docs', 'proof.md');
    const good = readFileSync(file);
    chmodSync(file, 0o000);
    return { dir, url, file, good };
  };

  it('an unreadable cache file is a problem line: the fetch downloads again and replaces the cache', { skip: asRoot && 'root reads files whatever their mode' }, async () => {
    const { dir, file, good } = lockedCacheFile();
    const online = await serveBytes(archiveOf());
    try {
      const r = await runAsync(dir, ['fetch'], online.url);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(online.requests.length, 1, 'the unreadable cache file made the fetch download once');
      assert.match(r.stdout, new RegExp(`sync fetch: ${COMMIT} verified and cached`));
    } finally {
      await online.close();
    }
    assert.deepEqual(readFileSync(file), good, 'the cache was replaced with a readable file');
    assert.deepEqual(cacheEntries(dir), [COMMIT]);
  });

  it('an unreadable cache file with the archive unavailable fails naming the path and the code', { skip: asRoot && 'root reads files whatever their mode' }, async () => {
    const { dir } = lockedCacheFile();
    const r = await runAsync(dir, ['fetch'], await closedPortUrl());
    assert.equal(r.status, 1, r.stdout);
    assert.ok(r.stderr.includes(`.cache/sync/${COMMIT}/docs/proof.md: cannot be read (EACCES)`), r.stderr);
    assert.deepEqual(cacheEntries(dir), [], 'the damaged cache was removed and nothing is left');
  });

  it('a 404 or a refused connection fails with the address and uses no other cache', async () => {
    const { dir, url } = lockedProject();
    fetchOk(dir, url);
    cpSync(cacheDir(dir), cacheDir(dir, OTHER), { recursive: true });
    rmSync(cacheDir(dir), { recursive: true });
    const otherBefore = hashTree(cacheDir(dir, OTHER)).digest;
    const notFound = await serveStatus(404);
    try {
      const r = await runAsync(dir, ['fetch'], notFound.url);
      assert.equal(r.status, 1);
      assert.ok(r.stderr.includes(`http://127.0.0.1:${notFound.port}/archive/${COMMIT}`), r.stderr);
      assert.match(r.stderr, /answered 404/);
    } finally {
      await notFound.close();
    }
    const closed = await closedPortUrl();
    const refused = await runAsync(dir, ['fetch'], closed);
    assert.equal(refused.status, 1);
    assert.ok(refused.stderr.includes(`/archive/${COMMIT}`), refused.stderr);
    assert.match(refused.stderr, /failed/);
    assert.ok(!existsSync(cacheDir(dir)), 'the pin commit has no cache');
    assert.equal(hashTree(cacheDir(dir, OTHER)).digest, otherBefore, 'the other commit cache is untouched');
  });
});

describe('concurrent fetches', () => {
  // Many files widen the window in which one fetch reads a cache folder that another fetch removes.
  const MANY = { ...FILES, ...Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`docs/guides/g${i}.md`, `# Guide ${i}\n`])) };
  const PARALLEL = 8;
  const fetchAll = (dir, url) => Promise.all(Array.from({ length: PARALLEL }, () => runAsync(dir, ['fetch'], url)));

  /** Every fetch exited 0, the cache verifies offline and no temporary sibling is left. */
  function assertSettled(dir, results, label) {
    for (const r of results) assert.equal(r.status, 0, `${label}: every fetch exits 0: ${r.stderr}`);
    const check = run(dir, ['fetch'], missingUrl());
    assert.equal(check.status, 0, `${label}: the cache verifies offline: ${check.stderr}`);
    assert.match(check.stdout, new RegExp(`sync fetch: ${COMMIT} cache verified \\(\\d+ files\\), no request`));
    assert.deepEqual(cacheEntries(dir), [COMMIT], `${label}: no temporary folder remains`);
  }

  it('several fetches at once on a damaged cache all exit 0 and leave a verified cache', async () => {
    const { dir, url } = lockedProject(MANY);
    fetchOk(dir, url);
    for (let round = 1; round <= 3; round++) {
      const file = join(cacheDir(dir), 'docs', 'proof.md');
      writeFileSync(file, `${readFileSync(file, 'utf8')}x`);
      assertSettled(dir, await fetchAll(dir, url), `round ${round}`);
    }
  });

  it('several fetches at once from an empty cache all exit 0 and leave a verified cache', async () => {
    const { dir, url } = lockedProject(MANY);
    for (let round = 1; round <= 3; round++) {
      rmSync(cacheRoot(dir), { recursive: true, force: true });
      assertSettled(dir, await fetchAll(dir, url), `round ${round}`);
    }
  });
});

describe('concurrent fetches in a fixed order', () => {
  // Fetches run in this process, driven through main() of the project copy; a fetch is held at a named point by a promise the
  // test releases, so the order is the test's and no timing decides it. The timer only turns a point never reached into a failure.
  const REACH_MS = 10000;

  function actor(stops) {
    const slots = new Map();
    const slot = (point) => {
      if (!slots.has(point)) {
        const s = {};
        s.reached = new Promise((resolve) => { s.reach = resolve; });
        s.released = new Promise((resolve) => { s.release = resolve; });
        slots.set(point, s);
      }
      return slots.get(point);
    };
    return {
      hooks: { at: async (point) => { const s = slot(point); s.reach(); if (stops.includes(point)) await s.released; } },
      async reached(point) {
        let timer;
        const late = new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(`the fetch never reached ${point}`)), REACH_MS); });
        try { await Promise.race([slot(point).reached, late]); } finally { clearTimeout(timer); }
      },
      release: (point) => slot(point).release(),
      releaseAll: () => stops.forEach((point) => slot(point).release()),
    };
  }

  it('a delayed fetch that judged the cache damaged cannot remove the cache another fetch repaired', async () => {
    const { dir, url } = lockedProject();
    fetchOk(dir, url);
    const proof = join(cacheDir(dir), 'docs', 'proof.md');
    writeFileSync(proof, `${readFileSync(proof, 'utf8')}x`);
    const { main } = await import(pathToFileURL(join(dir, 'scripts', 'sync.mjs')).href);
    const env = envFor(url);
    const y = actor(['verified-damaged', 'damaged-removed']); // judged the cache damaged, then waits to act on it
    const c = actor(['before-rename', 'lost-rename']); // downloads and stages a folder, then loses the rename
    const out = [];
    const realOut = process.stdout.write;
    const realErr = process.stderr.write;
    process.stdout.write = (chunk) => { out.push(String(chunk)); return true; };
    process.stderr.write = (chunk) => { out.push(String(chunk)); return true; };
    const started = [];
    try {
      started.push(main(['fetch'], env, y.hooks).then((status) => ({ name: 'Y', status })));
      await y.reached('verified-damaged');
      started.push(main(['fetch'], env, c.hooks).then((status) => ({ name: 'C', status })));
      await c.reached('before-rename'); // C holds a complete folder and is about to rename it
      const b = await main(['fetch'], env, {}); // B repairs the cache first
      assert.equal(b, 0, `B exits 0: ${out.join('')}`);
      c.release('before-rename'); // C's rename is refused: B's folder is there
      await c.reached('lost-rename');
      y.release('verified-damaged'); // Y now acts on its stale judgement
      await y.reached('damaged-removed');
      c.release('lost-rename'); // C looks at the cache while Y has just acted
      y.release('damaged-removed');
      const results = await Promise.all(started);
      for (const r of results) assert.equal(r.status, 0, `fetch ${r.name} exits 0: ${out.join('')}`);
      assert.ok(!out.join('').includes('ENOTEMPTY'), out.join(''));
    } finally {
      process.stdout.write = realOut;
      process.stderr.write = realErr;
      y.releaseAll();
      c.releaseAll();
      await Promise.allSettled(started);
    }
    const check = run(dir, ['fetch'], missingUrl());
    assert.equal(check.status, 0, `the cache verifies offline: ${check.stderr}`);
    assert.match(check.stdout, new RegExp(`sync fetch: ${COMMIT} cache verified \\(\\d+ files\\), no request`));
    assert.deepEqual(cacheEntries(dir), [COMMIT], 'no temporary or moved-aside folder remains');
  });

  it('a stale fetch with an unreachable archive cannot remove a cache another fetch repaired', async () => {
    const { dir, url } = lockedProject();
    fetchOk(dir, url);
    const proof = join(cacheDir(dir), 'docs', 'proof.md');
    writeFileSync(proof, `${readFileSync(proof, 'utf8')}x`);
    const { main } = await import(pathToFileURL(join(dir, 'scripts', 'sync.mjs')).href);
    const y = actor(['verified-damaged']); // judged the cache damaged, then waits before acting on it
    const out = [];
    const realOut = process.stdout.write;
    const realErr = process.stderr.write;
    process.stdout.write = (chunk) => { out.push(String(chunk)); return true; };
    process.stderr.write = (chunk) => { out.push(String(chunk)); return true; };
    let yStatus;
    try {
      // Y has no archive to fall back on: if it removes the cache it has no way to rebuild it and exits 1.
      const stale = main(['fetch'], envFor(missingUrl()), y.hooks);
      await y.reached('verified-damaged');
      assert.equal(await main(['fetch'], envFor(url), {}), 0, `B repairs the cache: ${out.join('')}`); // B repairs it first
      y.release('verified-damaged'); // Y now acts on its stale judgement
      yStatus = await stale;
    } finally {
      y.releaseAll();
      process.stdout.write = realOut;
      process.stderr.write = realErr;
    }
    // The repaired cache is still there and verifies offline, in a fresh process.
    const check = run(dir, ['fetch'], missingUrl());
    assert.equal(check.status, 0, `the repaired cache verifies offline: ${check.stderr}`);
    assert.match(check.stdout, new RegExp(`sync fetch: ${COMMIT} cache verified \\(\\d+ files\\), no request`));
    assert.deepEqual(cacheEntries(dir), [COMMIT], 'the repaired cache is the only folder: nothing removed, nothing moved aside');
    // Y's outcome is the offline verification result: it accepted the repaired cache and did not try the archive.
    assert.equal(yStatus, check.status, `Y exits with the offline verification result: ${out.join('')}`);
    assert.ok(!out.join('').includes('missing.tgz'), `Y never fell back to the unreachable archive: ${out.join('')}`);
  });
});

describe('a leftover moved-aside folder from an earlier fetch', () => {
  // A killed fetch leaves `{commit}.bad-{pid}-{n}` behind and a later process can get the same pid. main() runs in this process
  // on a project copy that is imported fresh, so its first moved-aside name is `{commit}.bad-{process.pid}-0`: the test makes
  // that exact folder, non-empty, and no timing or second process is needed.
  async function fetchWithLeftover(dir, url) {
    const leftover = `${cacheDir(dir)}.bad-${process.pid}-0`;
    mkdirSync(join(leftover, 'inner'), { recursive: true });
    writeFileSync(join(leftover, 'inner', 'old.txt'), 'left by a killed fetch');
    const { main } = await import(pathToFileURL(join(dir, 'scripts', 'sync.mjs')).href);
    const out = [];
    const realOut = process.stdout.write;
    const realErr = process.stderr.write;
    process.stdout.write = (chunk) => { out.push(String(chunk)); return true; };
    process.stderr.write = (chunk) => { out.push(String(chunk)); return true; };
    let status;
    try {
      status = await main(['fetch'], envFor(url), {});
    } finally {
      process.stdout.write = realOut;
      process.stderr.write = realErr;
    }
    return { status, text: out.join(''), leftover };
  }

  it('a good archive repairs a damaged cache although the aside name is taken, and leaves no leftover', async () => {
    const { dir, url } = lockedProject();
    fetchOk(dir, url);
    const good = hashTree(cacheDir(dir)).digest;
    writeFileSync(join(cacheDir(dir), 'docs', 'proof.md'), 'damaged');
    const r = await fetchWithLeftover(dir, url);
    assert.equal(r.status, 0, `the fetch exits 0: ${r.text}`);
    assert.ok(!/ENOTEMPTY|EEXIST/.test(r.text), `no raw rename error: ${r.text}`);
    assert.equal(hashTree(cacheDir(dir)).digest, good, 'the cache is repaired');
    assert.deepEqual(cacheEntries(dir), [COMMIT], 'no moved-aside or temporary folder remains');
    const check = run(dir, ['fetch'], missingUrl());
    assert.equal(check.status, 0, `the repaired cache verifies offline: ${check.stderr}`);
  });

  it('an unreachable archive gives the offline verification message, not a raw rename error', async () => {
    const { dir, url } = lockedProject();
    fetchOk(dir, url);
    writeFileSync(join(cacheDir(dir), 'docs', 'proof.md'), 'damaged');
    const r = await fetchWithLeftover(dir, missingUrl());
    assert.equal(r.status, 1, `the fetch exits 1: ${r.text}`);
    assert.ok(r.text.includes(`.cache/sync/${COMMIT}/docs/proof.md`), `the damaged path is named: ${r.text}`);
    assert.ok(!/ENOTEMPTY|EEXIST|rename/.test(r.text), `no raw rename error: ${r.text}`);
  });

  it('a good cache is left untouched when the aside name is taken and the archive is unreachable', async () => {
    const { dir, url } = lockedProject();
    fetchOk(dir, url);
    const good = hashTree(cacheDir(dir)).digest;
    const r = await fetchWithLeftover(dir, missingUrl());
    assert.equal(r.status, 0, `the fetch exits 0: ${r.text}`);
    assert.equal(hashTree(cacheDir(dir)).digest, good, 'the good cache is unchanged');
  });
});

describe('repository hygiene and build wiring', () => {
  it('the cache is ignored by git and no document or cache file is committed', () => {
    // Self-contained: the git checks run in a fresh repository holding a copy of the project's .gitignore, so the test
    // needs no git metadata of the project (a build-record export has none) and no user or system git configuration.
    const dir = store();
    const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
    for (const key of Object.keys(env)) if (key.startsWith('GIT_') && !key.startsWith('GIT_CONFIG')) delete env[key];
    const git = (...args) => {
      const r = spawnSync('git', args, { cwd: dir, env, encoding: 'utf8', timeout: 25000 });
      assert.equal(r.status, 0, `git ${args.join(' ')} exits 0: ${r.stderr}`);
      return r.stdout;
    };
    git('init', '-q');
    cpSync(join(repo, '.gitignore'), join(dir, '.gitignore'));
    assert.match(git('check-ignore', '-v', '.cache/sync/x'), /^\.gitignore:\d+:/, '.cache/sync/ is ignored by the project .gitignore');
    const cached = join(dir, '.cache', 'sync', COMMIT, 'docs');
    mkdirSync(cached, { recursive: true });
    writeFileSync(join(cached, 'proof.md'), FILES['docs/proof.md']);
    writeFileSync(join(dir, 'probe.txt'), 'tracked probe\n');
    git('add', '-A');
    const tracked = git('ls-files').split('\n').filter(Boolean);
    assert.deepEqual(tracked, ['.gitignore', 'probe.txt'], 'git add -A tracks the probe and nothing under .cache/');
    // The project tree: sync/ holds only the pin and the lock, and no synced document lives in the project.
    assert.ok(existsSync(join(repo, 'sync')), 'the sync folder exists');
    assert.deepEqual(readdirSync(join(repo, 'sync')).sort(), ['lock.json', 'pin.json']);
    const pages = ['docs/guides', 'docs/concepts', 'skills', 'docs/proof.md', 'docs/limits.md'].filter((p) => existsSync(join(repo, p)));
    assert.deepEqual(pages, [], 'no synced document or folder is in the project');
  });

  it('the build script runs the fetch before astro and a failed fetch writes no html', () => {
    const scripts = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).scripts;
    assert.equal(scripts.build, 'node scripts/sync.mjs fetch && astro build');
    assert.equal(scripts.sync, 'node scripts/sync.mjs fetch');
    assert.equal(scripts['sync:lock'], 'node scripts/sync.mjs lock');
    const { dir, url } = lockedProject();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'tmp', private: true, type: 'module', scripts: { build: scripts.build } }));
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    const stub = join(dir, 'node_modules', '.bin', 'astro');
    writeFileSync(stub, `#!/bin/sh\necho ran > astro-ran\nif [ -d ".cache/sync/${COMMIT}" ]; then echo yes > astro-saw-cache; fi\nmkdir -p dist\necho '<p>built</p>' > dist/index.html\n`);
    chmodSync(stub, 0o755);
    const build = (address) => spawnSync('npm', ['run', 'build'], { cwd: dir, env: envFor(address), encoding: 'utf8', timeout: 25000 });

    const bad = build(saveArchive(archiveOf(withFile('docs/limits.md', '# Limits tezt\n'))));
    assert.notEqual(bad.status, 0, 'a tampered archive fails the build');
    assert.match(bad.stderr, /docs\/limits\.md: sha256 differs/);
    assert.ok(!existsSync(join(dir, 'dist', 'index.html')), 'no html is written');
    assert.ok(!existsSync(join(dir, 'astro-ran')), 'astro never started');

    const good = build(url);
    assert.equal(good.status, 0, good.stderr);
    assert.ok(existsSync(join(dir, 'dist', 'index.html')));
    assert.ok(existsSync(join(dir, 'astro-saw-cache')), 'the cache existed when astro started');
  });

  it('two fetches from an empty cache give the same cache tree hash', () => {
    const one = lockedProject();
    const two = lockedProject();
    fetchOk(one.dir, one.url);
    fetchOk(two.dir, two.url);
    const a = hashTree(cacheDir(one.dir));
    const b = hashTree(cacheDir(two.dir));
    assert.equal(a.files.length, 12, 'eleven files and listing.tsv');
    assert.equal(a.digest, b.digest);
  });

  it('the committed lock and pin are valid, sorted and in the synced set', () => {
    const pinFile = join(repo, 'sync', 'pin.json');
    const lockFile = join(repo, 'sync', 'lock.json');
    assert.ok(existsSync(pinFile) && existsSync(lockFile), 'sync/pin.json and sync/lock.json exist');
    const pin = JSON.parse(readFileSync(pinFile, 'utf8'));
    const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
    assert.deepEqual(validatePin(pin), []);
    assert.deepEqual(validateLock(lock), []);
    assert.equal(lock.commit, pin.commit);
    assert.match(lock.tree_sha256, /^[0-9a-f]{64}$/);
    const paths = lock.files.map((f) => f.path);
    assert.deepEqual(paths, [...paths].sort(byPath), 'sorted by path');
    assert.equal(new Set(paths).size, paths.length, 'no duplicate path');
    assert.ok(paths.includes('README.md'), 'the input is locked');
    for (const f of lock.files) {
      assert.equal(f.role, roleOf(f.path), `${f.path} has the role of its glob`);
      assert.match(f.blob, /^[0-9a-f]{40}$/);
      assert.match(f.sha256, /^[0-9a-f]{64}$/);
    }
    assert.equal(readFileSync(lockFile, 'utf8'), `${JSON.stringify(lock, null, 2)}\n`, 'serialized as 2-space JSON and a line feed');
    // The CLI accepts the committed pair: both commands get past the pin and lock checks and stop at the unreachable archive.
    const dir = project({ rawPin: readFileSync(pinFile, 'utf8') });
    writeFileSync(join(dir, 'sync', 'lock.json'), readFileSync(lockFile));
    for (const command of ['fetch', 'lock']) {
      const r = run(dir, [command], missingUrl());
      assert.equal(r.status, 1, `${command} stops at the archive: ${r.stderr}`);
      assert.match(r.stderr, /cannot read file:/);
      assert.doesNotMatch(r.stderr, /sync\/(pin|lock)\.json/, `${command} accepts the committed pin and lock`);
    }
  });
});

describe('tar reader', () => {
  const pax = (key, value) => {
    const body = ` ${key}=${value}\n`;
    let len = Buffer.byteLength(body) + 1;
    while (String(len).length + Buffer.byteLength(body) !== len) len = String(len).length + Buffer.byteLength(body);
    return `${len}${body}`;
  };
  const top = 'proofline-x';

  it('reads pax, prefix, x and L entries, strips the top folder and types directories as tree', () => {
    const longByPax = `${top}/docs/${'p'.repeat(120)}.md`;
    const longByL = `${top}/docs/${'q'.repeat(120)}.md`;
    const bytes = gz(
      globalHeader(),
      entry(`${top}/`, '', '5'),
      entry(`${top}/docs/`, '', '5'),
      entry(`${top}/docs/plain.md`, 'plain'),
      entry(`${top}/${LONG_FILE}`, 'prefixed'),
      entry('pax-header', pax('path', longByPax), 'x', { raw: true }),
      entry(`${top}/docs/short-name`, 'by pax', '0', { raw: true }),
      entry('long-link', `${longByL}\0`, 'L', { raw: true }),
      entry(`${top}/docs/short-name-2`, 'by L', '0', { raw: true }),
    );
    const got = readTarGz(bytes).map((e) => [e.path, e.type, e.data === null ? null : e.data.toString('utf8')]);
    assert.deepEqual(got, [
      ['docs', 'tree', null],
      ['docs/plain.md', 'blob', 'plain'],
      [LONG_FILE, 'blob', 'prefixed'],
      [longByPax.slice(top.length + 1), 'blob', 'by pax'],
      [longByL.slice(top.length + 1), 'blob', 'by L'],
    ]);
  });

  it('rejects an entry whose header checksum is wrong naming the entry, and accepts a valid one', () => {
    const good = entry(`${top}/docs/a.md`, 'x');
    assert.equal(readTarGz(gz(entry(`${top}/`, '', '5'), good)).length, 1, 'a valid checksum is read');
    const bad = Buffer.from(good);
    bad.write('0000001\0', 148); // not the sum of the header bytes
    assert.throws(() => readTarGz(gz(entry(`${top}/`, '', '5'), bad)), /archive entry .*docs\/a\.md: bad header checksum/);
    const changed = Buffer.from(good);
    changed[0] = changed[0] ^ 1; // a header byte changed after the checksum was written
    assert.throws(() => readTarGz(gz(entry(`${top}/`, '', '5'), changed)), /bad header checksum/);
    const letters = Buffer.from(good);
    letters.write('zzzzzz\0 ', 148);
    assert.throws(() => readTarGz(gz(entry(`${top}/`, '', '5'), letters)), /bad header checksum/);
  });

  it('rejects links, unsafe paths, duplicates, truncation, a second top folder and oversize naming the entry', () => {
    const ok = (path, data = 'x') => entry(`${top}/${path}`, data);
    const cases = [
      ['a symbolic link', gz(ok('docs/a.md'), entry(`${top}/docs/link.md`, '', '2', { link: '/etc/passwd' })), /archive entry .*docs\/link\.md: unsupported type 2/],
      ['a hard link', gz(entry(`${top}/docs/hard.md`, '', '1', { link: 'docs/a.md' })), /archive entry .*docs\/hard\.md: unsupported type 1/],
      ['a device', gz(entry(`${top}/docs/dev`, '', '3')), /unsupported type 3/],
      ['a parent segment', gz(entry(`${top}/../../evil.md`, 'x', '0', { raw: true })), /archive entry .*evil\.md/],
      ['an absolute path', gz(entry('/etc/evil.md', 'x', '0', { raw: true })), /archive entry .*\/etc\/evil\.md/],
      ['an empty segment', gz(entry(`${top}//x.md`, 'x', '0', { raw: true })), /archive entry .*x\.md/],
      ['a dot segment', gz(entry(`${top}/./x.md`, 'x', '0', { raw: true })), /archive entry .*x\.md/],
      ['a tab in the path', gz(ok('docs/a\tb.md')), /a\\tb\.md/],
      ['a line feed in the path', gz(ok('docs/a\nb.md')), /a\\nb\.md/],
      ['a carriage return in the path', gz(ok('docs/a\rb.md')), /a\\rb\.md/],
      ['a duplicate path', gz(ok('docs/a.md', 'one'), ok('docs/a.md', 'two')), /duplicate.*docs\/a\.md/],
      ['a file and a directory with one path', gz(ok('docs/a'), entry(`${top}/docs/a/`, '', '5')), /duplicate.*docs\/a/],
      ['two top folders', gz(ok('docs/a.md'), entry('other-top/docs/b.md', 'x', '0', { raw: true })), /more than one top folder/],
      ['a body cut short', gzipSync(Buffer.concat([ok('docs/a.md', 'y'.repeat(2000))]).subarray(0, 700)), /truncated/],
      ['a header cut short', gzipSync(ok('docs/a.md').subarray(0, 300)), /truncated/],
      ['not gzip', Buffer.from('<html>not an archive</html>'), /not a valid gzip|gzip/i],
    ];
    for (const [label, bytes, message] of cases) {
      assert.throws(() => readTarGz(bytes), message, label);
    }
    assert.throws(() => readTarGz(gz(ok('docs/big.md', 'z'.repeat(5000))), { maxBytes: 2048 }), /limit/, 'output over the limit');
  });
});

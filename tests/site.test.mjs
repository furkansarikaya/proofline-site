// Node tests for the static site skeleton (TASK-001) and the page head contract (TASK-004). This is the only file that builds the real dist/.
// The "built site" group builds once, then asserts the real output; the other tests use fixtures generated in temp directories.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from 'cheerio';
import YAML from 'yaml';
import { startServer } from '../scripts/serve-dist.mjs';
import { ENV_KEYS } from '../src/lib/indexing.ts';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const PAGES = ['index.html', 'tr/index.html', '404.html'];
const ORIGIN = 'https://proofline.technology';
const BRAND = {
  en: 'proofline: a deterministic engineering team for Claude Code and Codex',
  tr: 'proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi',
};
const PHRASE = { en: 'a deterministic engineering team for Claude Code and Codex', tr: 'Claude Code ve Codex için deterministik bir mühendislik ekibi' };
const SKIP_LINE = 'performance checks skipped: the Lighthouse budgets arrive with the performance task';

sweepStale();
after(removeTempDirs);

/** Text of a file under the repository root, or '' when it is absent (so a missing file fails an assertion). */
function read(rel) {
  const file = join(root, rel);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

/** Parsed page from dist, or null when absent. */
function page(rel) {
  const file = join(dist, rel);
  return existsSync(file) ? load(readFileSync(file, 'utf8')) : null;
}

/** The ordered head structure of a page: charset, viewport, robots meta and title, whatever else the head holds. */
function headSignature($) {
  const wanted = ['meta[charset]', 'meta[name=viewport]', 'meta[name=robots]', 'title'];
  return $('head').children().toArray()
    .map((el) => {
      if (el.tagName === 'meta') return el.attribs.charset !== undefined ? 'meta[charset]' : `meta[name=${el.attribs.name}]`;
      return el.tagName;
    })
    .filter((s) => wanted.includes(s));
}

/** Every file under dir as a sorted list of POSIX relative paths. */
function walk(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(join(dir, name)).isDirectory()) out.push(...walk(join(dir, name), rel));
    else out.push(rel);
  }
  return out.sort();
}

/** A temp directory holding the given files ({ 'a/b.html': 'text' }); removed after the run. */
function makeTree(files) {
  const dir = makeTempDir('proofline-site-');
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}

/** Run a node script from the repository root. */
function node(args) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const minimalWorkflow = (uses) => `name: fixture\non: push\npermissions:\n  contents: read\njobs:\n  verify:\n    runs-on: ubuntu-24.04\n    steps:\n      - ${uses}\n`;

// A passing driver run takes about 0.1 s; this deadline only bounds a hang and is never waited out by a passing run.
const DRIVER_DEADLINE_MS = 15000;

/** `promise`, or a rejection as soon as `deadline` aborts; the wait itself is the promise's event, never a poll. */
function beforeDeadline(promise, deadline) {
  if (deadline.aborted) return Promise.reject(deadline.reason);
  return new Promise((resolve, reject) => {
    const stop = () => reject(deadline.reason);
    deadline.addEventListener('abort', stop, { once: true });
    promise.then(resolve, reject).finally(() => deadline.removeEventListener('abort', stop));
  });
}

/** A TCP server on a free local port for one driver. The driver writes its pid on the socket, because a `node --test` runner can hold a short stdout line back; the OS closes the socket when the driver process ends, so that end is an event. */
async function listenForDriver() {
  let reportPid;
  let reportEnd;
  const pid = new Promise((resolve) => { reportPid = resolve; });
  const ended = new Promise((resolve) => { reportEnd = resolve; });
  let open = false;
  const server = createServer((socket) => {
    open = true;
    let text = '';
    socket.on('error', () => {});
    socket.on('data', (chunk) => {
      text += chunk.toString();
      const match = /^(\d+)\n/.exec(text);
      if (match) reportPid(Number(match[1]));
    });
    socket.once('close', () => { open = false; reportEnd(); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, pid, ended, isOpen: () => open, close: () => server.close() };
}

/** A `node --test` child with its own temp root; every wait is an event bounded by `deadline`, and the runner and driver this call started are always ended by their pids. */
async function runDriver(prefix, signal, target = 'runner', failure = '', { deadline = AbortSignal.timeout(DRIVER_DEADLINE_MS), onPid } = {}) {
  const privateDir = makeTempDir('proofline-site-');
  const helper = pathToFileURL(join(root, 'tests/temp-dirs.mjs')).href;
  const driver = join(privateDir, 'driver.mjs');
  const listener = await listenForDriver();
  writeFileSync(driver, `import { test, after } from 'node:test';\nimport { connect } from 'node:net';\nimport { makeTempDir, removeTempDirs } from '${helper}';\nafter(removeTempDirs);\ntest('driver', async () => { makeTempDir('${prefix}'); await new Promise((resolve) => { const socket = connect(${listener.port}, '127.0.0.1'); socket.unref(); socket.write(process.pid + '\\n', resolve); }); ${failure || 'await new Promise(() => {});'} });\n`);
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const child = spawn(process.execPath, ['--test', driver], { env: { ...env, TMPDIR: privateDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { output += chunk.toString(); });
  const closed = new Promise((resolve) => child.once('close', (code, endedBy) => resolve({ code, endedBy })));
  const exitedFirst = closed.then((exit) => { throw new Error(`driver runner exited (${exit.code ?? exit.endedBy}) before the driver reported its pid:\n${output}`); });
  let filePid = null;
  let step = 'the driver pid';
  const endBoth = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    if (filePid !== null && listener.isOpen()) {
      try { process.kill(filePid, 'SIGKILL'); } catch { /* it ended between the close check and the kill */ }
    }
    // SIGKILL cannot be caught, so both events follow.
    const runner = await closed;
    if (filePid !== null) await listener.ended;
    return { runner, driver: filePid !== null };
  };
  try {
    filePid = await beforeDeadline(Promise.race([listener.pid, exitedFirst]), deadline);
    onPid?.(filePid);
    if (signal) process.kill(target === 'runner' ? child.pid : filePid, signal);
    step = 'the runner exit';
    const exit = await beforeDeadline(closed, deadline);
    step = 'the driver exit';
    await beforeDeadline(listener.ended, deadline); // the file process outlives a signalled runner; its socket closes when it ends
    return { exit, leftovers: readdirSync(privateDir).filter((name) => name.startsWith(prefix)) };
  } catch (error) {
    const ended = await endBoth();
    if (!deadline.aborted) throw Object.assign(error, { ended });
    throw Object.assign(new Error(`driver wait passed its deadline while waiting for ${step}; ended runner ${child.pid} and driver ${filePid ?? '(pid not reported)'} by their pids\n${output}`), { ended });
  } finally {
    listener.close();
  }
}

/** The file process of a `node --test` run whose runner died: its output pipes are closed on this side, then its stdin ends; that event is what makes it write. */
async function runBrokenPipeDriver() {
  const privateDir = makeTempDir('proofline-site-');
  const helper = pathToFileURL(join(root, 'tests/temp-dirs.mjs')).href;
  const driver = join(privateDir, 'driver.mjs');
  writeFileSync(driver, `import { test, after } from 'node:test';\nimport { makeTempDir, removeTempDirs } from '${helper}';\nafter(removeTempDirs);\ntest('driver', async () => { makeTempDir('proofline-site-'); console.log('READY'); await new Promise((resolve) => { process.stdin.on('end', () => { console.log('closed'); resolve(); }); process.stdin.resume(); }); });\n`);
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const child = spawn(process.execPath, [driver], { env: { ...env, NODE_TEST_CONTEXT: 'child-v8', TMPDIR: privateDir }, stdio: ['pipe', 'pipe', 'pipe'] });
  const closed = new Promise((resolve) => child.once('close', (code, endedBy) => resolve({ code, endedBy })));
  child.stderr.resume();
  await new Promise((resolve) => {
    let seen = '';
    child.stdout.on('data', (chunk) => {
      seen += chunk.toString('latin1');
      if (seen.includes('READY')) resolve();
    });
  });
  child.stdout.destroy();
  child.stderr.destroy();
  child.stdin.destroy(); // the file process reads the end of its stdin, then writes to the pipes closed above
  const exit = await closed;
  return { exit, leftovers: readdirSync(privateDir).filter((name) => name.startsWith('proofline-site-')) };
}

/** Run a real test file with no test selected, in a private TMPDIR holding old and new prefixed directories; returns what is left in it. */
async function runFileSweep(file) {
  const privateDir = makeTempDir('proofline-site-');
  const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
  for (const name of ['proofline-site-stale', 'proofline-axe-stale', 'x-proofline-site-stale', 'x-proofline-axe-stale']) {
    mkdirSync(join(privateDir, name));
    utimesSync(join(privateDir, name), old, old);
  }
  mkdirSync(join(privateDir, 'proofline-site-fresh'));
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const child = spawn(process.execPath, ['--test', '--test-name-pattern=selects-no-test-at-all', join(root, file)], { env: { ...env, TMPDIR: privateDir }, stdio: 'ignore' });
  const exit = await new Promise((resolve) => child.once('close', (code) => resolve(code)));
  return { exit, left: readdirSync(privateDir).sort() };
}

/** One raw HTTP request; the path is sent exactly as given (node:http does not normalise it). */
function raw(url, path, method = 'GET') {
  const u = new URL(url);
  return new Promise((resolve) => {
    const req = request({ host: u.hostname, port: u.port, path, method }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', () => resolve({ status: 0, headers: {}, body: '' }));
    req.end();
  });
}

const identical = () => ({ 'index.html': '<p>one</p>', 'tr/index.html': '<p>iki</p>', 'robots.txt': 'Disallow: /\n' });

/** The environment of the shared build: the inherited one without the four indexing variables, so dist/ is always the closed build. */
function closedEnv() {
  const env = { ...process.env };
  for (const key of ENV_KEYS) delete env[key];
  return env;
}

describe('built site', () => {
  let build = { status: -1, stderr: '', output: '' };
  before(() => {
    rmSync(dist, { recursive: true, force: true }); // a stale dist/ must never stand in for this build
    const r = spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf8', env: closedEnv() });
    build = { status: r.status, stderr: r.stderr ?? '', output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  }, { timeout: 120000 });

  it('build emits exactly index.html, tr/index.html and 404.html', () => {
    assert.equal(build.status, 0, `npm run build must exit 0: ${build.stderr.slice(-400)}`);
    const html = walk(dist).filter((f) => f.endsWith('.html'));
    assert.deepEqual(html, ['404.html', 'index.html', 'tr/index.html']);
  });

  it('language roots link to each other and the 404 page holds both language blocks', () => {
    const [en, tr, notFound] = PAGES.map(page);
    assert.ok(en && tr && notFound, 'all three pages are built');
    assert.equal(en('html').attr('lang'), 'en');
    assert.equal(tr('html').attr('lang'), 'tr');
    assert.ok(en('a[href="/tr/"]').length >= 1, 'the English root links to /tr/');
    assert.ok(tr('a[href="/"]').length >= 1, 'the Turkish root links to /');
    assert.ok(notFound('[lang="en"]:not(html)').length >= 1, '404 has an English block');
    assert.ok(notFound('[lang="tr"]:not(html)').length >= 1, '404 has a Turkish block');
    assert.ok(notFound('a[href="/"]').length >= 1, '404 links to /');
    assert.ok(notFound('a[href="/tr/"]').length >= 1, '404 links to /tr/');
  });

  it('pages hold one heading, a sentence and the same head structure', () => {
    const signatures = [];
    for (const rel of PAGES) {
      const $ = page(rel);
      assert.ok($, `${rel} is built`);
      assert.ok($('h1').length >= 1, `${rel} has a heading`);
      const sentences = $('p').toArray().map((p) => $(p).text().trim());
      assert.ok(sentences.length >= 1 && sentences.every((s) => s !== ''), `${rel} has non-empty placeholder sentences`);
      assert.ok($('title').text().trim() !== '', `${rel} has a non-empty title`);
      signatures.push(headSignature($));
    }
    assert.deepEqual(signatures[0], ['meta[charset]', 'meta[name=viewport]', 'meta[name=robots]', 'title']);
    assert.deepEqual(signatures[1], signatures[0]);
    assert.deepEqual(signatures[2], signatures[0]);
  });

  it('home pages hold the JSON-LD block and the one controls script; other pages hold no script', () => {
    const homes = { 'index.html': 'en', 'tr/index.html': 'tr' };
    for (const rel of walk(dist).filter((f) => f.endsWith('.html'))) {
      const $ = page(rel);
      if (!(rel in homes)) {
        assert.equal($('script').length, 0, `${rel} holds no script element`);
        continue;
      }
      assert.equal($('script').length, 2, `${rel} holds the JSON-LD block and the controls script`);
      assert.equal($('script[type="application/ld+json"]').length, 1, `${rel} holds one application/ld+json block`);
      const data = JSON.parse($('script[type="application/ld+json"]').text());
      assert.equal(data['@type'], 'WebSite');
      assert.equal(data.name, BRAND[homes[rel]]);
      const controls = $('script[src]');
      assert.equal(controls.length, 1, `${rel} holds exactly one script with a source`);
      assert.equal($('head > script[src="/assets/controls.js"]').length, 1, `${rel}: the controls script is in the head`);
      for (const attribute of ['async', 'defer', 'type', 'nomodule', 'integrity', 'crossorigin']) {
        assert.equal(controls.attr(attribute), undefined, `${rel}: the controls script has no ${attribute} attribute`);
      }
      assert.equal(controls.text(), '', `${rel}: the controls script has no body`);
      for (const script of $('script').toArray()) assert.equal(script.parent.tagName, 'head', `${rel}: every script is a child of head`);
    }
  });

  it('controls script file is built, at most 2048 bytes and equal to the source', () => {
    const source = join(root, 'public', 'assets', 'controls.js');
    assert.ok(existsSync(source), 'public/assets/controls.js exists');
    assert.ok(existsSync(join(dist, 'assets', 'controls.js')), 'dist/assets/controls.js exists');
    const bytes = readFileSync(source);
    assert.ok(bytes.length <= 2048, `controls.js is at most 2048 bytes, found ${bytes.length}`);
    assert.ok(readFileSync(join(dist, 'assets', 'controls.js')).equals(bytes), 'dist/assets/controls.js is the same file');
  });

  it('every page head carries description and og tags', () => {
    const langs = { 'index.html': 'en', 'tr/index.html': 'tr', '404.html': 'en' };
    for (const rel of PAGES) {
      const $ = page(rel);
      assert.ok($, `${rel} is built`);
      const lang = langs[rel];
      const title = $('title').text();
      const description = $('meta[name="description"]').attr('content') ?? '';
      assert.equal($('meta[name="description"]').length, 1, `${rel} holds one description`);
      assert.ok(Array.from(description).length >= 70 && Array.from(description).length <= 160, `${rel} description is 70 to 160 characters: ${description}`);
      assert.ok(description.endsWith(` ${BRAND[lang]}.`), `${rel} description ends with the name and phrase of ${lang}`);
      assert.ok(title.endsWith(PHRASE[lang]), `${rel} title carries the phrase of ${lang}`);
      assert.equal($('meta[property="og:title"]').attr('content'), title, `${rel} og:title equals the title`);
      assert.equal($('meta[property="og:description"]').attr('content'), description, `${rel} og:description equals the description`);
      assert.equal($('meta[property="og:image"]').attr('content'), `${ORIGIN}/og-default.png`);
      assert.equal($('meta[property="og:image:alt"]').attr('content'), BRAND[lang], `${rel} image alternative text is the name and phrase of ${lang}`);
    }
    assert.equal(page('index.html')('title').text(), BRAND.en);
    assert.equal(page('tr/index.html')('title').text(), BRAND.tr);
    assert.equal(page('404.html')('title').text(), `Page not found | Sayfa bulunamadı | ${BRAND.en}`);
  });

  it('preview image is a 1200 by 630 PNG that ships to dist', () => {
    const source = join(root, 'public', 'og-default.png');
    assert.ok(existsSync(source), 'public/og-default.png exists');
    const png = readFileSync(source);
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG signature');
    assert.equal(png.subarray(12, 16).toString('latin1'), 'IHDR');
    assert.equal(png.readUInt32BE(16), 1200, 'width');
    assert.equal(png.readUInt32BE(20), 630, 'height');
    assert.ok(existsSync(join(dist, 'og-default.png')), 'dist/og-default.png exists');
    assert.ok(readFileSync(join(dist, 'og-default.png')).equals(png), 'dist/og-default.png is the same file');
  });

  it('home pages hold equal en, tr and x-default alternates', () => {
    const expected = [['en', `${ORIGIN}/`], ['tr', `${ORIGIN}/tr/`], ['x-default', `${ORIGIN}/`]];
    const sets = ['index.html', 'tr/index.html'].map((rel) => {
      const $ = page(rel);
      return $('link[rel="alternate"][hreflang]').toArray().map((el) => [el.attribs.hreflang, el.attribs.href]);
    });
    assert.deepEqual(sets[0], expected);
    assert.deepEqual(sets[1], sets[0], 'the set on one page equals the set on the other');
  });

  it('pages without a pair hold no hreflang and every html lang matches its address', () => {
    assert.equal(page('404.html')('link[hreflang]').length, 0, '404.html holds 0 hreflang tags');
    for (const rel of ['index.html', 'tr/index.html']) assert.equal(page(rel)('link[hreflang]').length, 3, `${rel} is paired, so it holds the three tags`);
    const files = walk(dist).filter((f) => f.endsWith('.html'));
    assert.ok(files.length >= 3);
    for (const rel of files) {
      const expected = rel === 'tr/index.html' || rel.startsWith('tr/') ? 'tr' : 'en';
      assert.equal(page(rel)('html').attr('lang'), expected, `${rel} has lang ${expected}`);
    }
  });

  it('closed mode: robots meta on every page, Disallow in robots.txt, no sitemap', () => {
    for (const rel of PAGES) {
      const $ = page(rel);
      assert.ok($, `${rel} is built`);
      assert.equal($('meta[name="robots"]').length, 1, `${rel} has exactly one robots meta`);
      assert.equal($('meta[name="robots"]').attr('content'), 'noindex, nofollow');
    }
    for (const rel of PAGES) assert.equal(page(rel)('link[rel="canonical"]').length, 0, `${rel} holds no canonical link`);
    const lines = read('dist/robots.txt').split('\n').map((l) => l.trim());
    assert.ok(lines.includes('Disallow: /'), 'dist/robots.txt holds Disallow: /');
    assert.deepEqual(lines.filter((l) => l !== ''), ['User-agent: *', 'Disallow: /'], 'dist/robots.txt holds exactly the two closed lines');
    assert.equal(existsSync(join(dist, 'sitemap.xml')), false, 'no sitemap is emitted');
    const log = build.output.split('\n').map((l) => l.trim());
    assert.equal(log.filter((l) => /^indexing: blocked \(.*VERCEL_ENV.*SITE_INDEXABLE.*\)$/.test(l)).length, 1, 'the build log holds one blocked line naming both variables');
    assert.equal(log.filter((l) => l.startsWith('indexing: allowed')).length, 0, 'the build log holds no allowed line');
  });

  it('link check passes on dist and fails on a tree with a missing internal address', () => {
    const ok = node(['scripts/check-dist.mjs', 'links', 'dist']);
    assert.equal(ok.status, 0, `link check on dist exits 0: ${ok.stdout}`);
    const m = /links: (\d+) checked, 0 broken/.exec(ok.stdout);
    assert.ok(m && Number(m[1]) >= 1, `reports at least 1 link checked: ${ok.stdout}`);

    const good = makeTree({
      'index.html': '<a href="/tr/">tr</a><img src="/logo.png" alt=""><a href="mailto:a@b.c">m</a><a href="https://example.com/">x</a><a href="#top">t</a>',
      'tr/index.html': '<a href="/">en</a>',
      'logo.png': 'png',
    });
    const goodRun = node(['scripts/check-dist.mjs', 'links', good]);
    assert.equal(goodRun.status, 0, goodRun.stdout);
    assert.match(goodRun.stdout, /links: 3 checked, 0 broken/);

    const bad = makeTree({ 'index.html': '<a href="/missing/">gone</a><a href="/missing.png">gone</a><a href="/tr">no slash</a>', 'tr/index.html': '<p>x</p>' });
    const badRun = node(['scripts/check-dist.mjs', 'links', bad]);
    assert.equal(badRun.status, 1, badRun.stdout);
    assert.match(badRun.stdout, /index\.html -> \/missing\//);
    assert.match(badRun.stdout, /index\.html -> \/missing\.png/);
    assert.match(badRun.stdout, /index\.html -> \/tr$/m);
    assert.match(badRun.stdout, /3 broken/);

    const empty = makeTree({ 'robots.txt': 'Disallow: /\n' });
    assert.equal(node(['scripts/check-dist.mjs', 'links', empty]).status, 1, 'a tree with no page is not a pass');
  });

  it('local server answers 200, 308 and 404 and refuses path traversal', async () => {
    const server = await startServer({ root: dist });
    try {
      const home = await raw(server.url, '/');
      assert.equal(home.status, 200);
      assert.match(String(home.headers['content-type']), /^text\/html/);
      assert.equal((await raw(server.url, '/tr/')).status, 200);
      const robots = await raw(server.url, '/robots.txt');
      assert.equal(robots.status, 200);
      assert.match(String(robots.headers['content-type']), /^text\/plain/);

      const redirect = await raw(server.url, '/tr');
      assert.equal(redirect.status, 308);
      assert.equal(redirect.headers.location, '/tr/');

      const missing = await raw(server.url, '/missing/');
      assert.equal(missing.status, 404);
      assert.equal(missing.body, read('dist/404.html'));
      assert.ok(missing.body.includes('lang="tr"'), 'the 404 body is the 404 page');

      for (const path of ['/..%2fpackage.json', '/../package.json', '/%2e%2e/package.json', '/%E0%A4%A']) {
        const res = await raw(server.url, path);
        assert.equal(res.status, 404, `${path} answers 404`);
        assert.ok(!res.body.includes('"proofline-site"'), `${path} does not leak a file outside the root`);
      }
      assert.equal((await raw(server.url, '/', 'POST')).status, 405);
      assert.equal((await raw(server.url, '/', 'HEAD')).status, 200);
    } finally {
      await server.close();
    }
  });
});

describe('tree compare', () => {
  it('tree compare is equal for identical trees and fails on a changed, extra or empty tree', () => {
    const a = makeTree(identical());
    const b = makeTree(identical());
    const same = node(['scripts/check-dist.mjs', 'compare', a, b]);
    assert.equal(same.status, 0, same.stdout);
    const digests = [...same.stdout.matchAll(/sha256 ([0-9a-f]{64}) \((\d+) files\)/g)];
    assert.equal(digests.length, 2, `prints one digest per tree: ${same.stdout}`);
    assert.equal(digests[0][1], digests[1][1]);
    assert.equal(digests[0][2], '3');

    const changed = makeTree({ ...identical(), 'tr/index.html': '<p>ikl</p>' });
    const changedRun = node(['scripts/check-dist.mjs', 'compare', a, changed]);
    assert.equal(changedRun.status, 1, changedRun.stdout);
    assert.match(changedRun.stdout, /differs: tr\/index\.html/);

    const extra = makeTree({ ...identical(), 'extra.html': '<p>x</p>' });
    const extraRun = node(['scripts/check-dist.mjs', 'compare', a, extra]);
    assert.equal(extraRun.status, 1, extraRun.stdout);
    assert.match(extraRun.stdout, /only in .*: extra\.html/);

    const { 'robots.txt': robots, ...rest } = identical();
    const renamed = makeTree({ ...rest, 'robots2.txt': robots });
    const renamedRun = node(['scripts/check-dist.mjs', 'compare', a, renamed]);
    assert.equal(renamedRun.status, 1, 'the same contents under another path differ');
    assert.match(renamedRun.stdout, /only in .*: robots\.txt/);
    assert.match(renamedRun.stdout, /only in .*: robots2\.txt/);

    const empty1 = makeTree({});
    const empty2 = makeTree({});
    const emptyRun = node(['scripts/check-dist.mjs', 'compare', empty1, empty2]);
    assert.equal(emptyRun.status, 1, 'two empty trees never pass');
    assert.match(emptyRun.stdout, /nothing to compare/);
  });
});

describe('temp directory hygiene', () => {
  it('interrupted run leaves no proofline-site directory', { timeout: 60000 }, async () => {
    for (const signal of ['SIGINT', 'SIGTERM']) for (const target of ['runner', 'file']) {
      const result = await runDriver('proofline-site-', signal, target);
      assert.deepEqual(result.leftovers, [], `${signal} to ${target}`);
      assert.notEqual(result.exit.code, 0, 'an interrupted process cannot pass');
    }
  });

  it('interrupted run leaves no proofline-axe directory', { timeout: 60000 }, async () => {
    for (const signal of ['SIGINT', 'SIGTERM']) for (const target of ['runner', 'file']) {
      const result = await runDriver('proofline-axe-', signal, target);
      assert.deepEqual(result.leftovers, [], `${signal} to ${target}`);
      assert.notEqual(result.exit.code, 0, 'an interrupted process cannot pass');
    }
    assert.match(read('tests/axe.mjs'), /makeTempDir\('proofline-axe-'\)/);
  });

  it('run whose runner died leaves no directory when its next write hits the broken pipe', { timeout: 30000 }, async () => {
    // The node test runner exits at once on SIGINT or SIGTERM and does not always signal the file process; that process then dies of an uncaught EPIPE that skips the exit event.
    const result = await runBrokenPipeDriver();
    assert.deepEqual(result.leftovers, []);
    assert.equal(result.exit.code, 1);
  });

  it('failing test still removes its directories', { timeout: 30000 }, async () => {
    for (const failure of ["throw new Error('failure');", "assert.equal(1, 2);"]) {
      const script = failure.startsWith('assert') ? "const assert = (await import('node:assert/strict')).default; " + failure : failure;
      const result = await runDriver('proofline-site-', '', 'runner', script);
      assert.notEqual(result.exit.code, 0);
      assert.deepEqual(result.leftovers, []);
    }
  });

  it('a driver wait that passes its deadline fails with a clear message and ends the runner and the driver', { timeout: 30000 }, async () => {
    const deadline = new AbortController();
    let reported = null;
    const error = await runDriver('proofline-site-', 'SIGTERM', 'file', '', { deadline: deadline.signal, onPid: (pid) => { reported = pid; deadline.abort(); } }).then(() => null, (e) => e);
    assert.ok(error, 'the wait rejects once its deadline has passed');
    assert.match(error.message, /driver wait passed its deadline while waiting for the runner exit; ended runner \d+ and driver \d+ by their pids/);
    assert.equal(error.ended?.runner?.endedBy, 'SIGKILL', 'the runner is killed by its pid');
    assert.equal(error.ended?.driver, true, 'the driver socket closed, so the driver process has ended');
    assert.ok(Number.isInteger(reported) && reported !== process.pid);
  });

  it('sweepStale removes only old prefixed directories', () => {
    const dir = makeTempDir('proofline-site-');
    const now = 1_700_000_000_000;
    for (const [name, age] of Object.entries({ 'proofline-site-old2h': 120, 'proofline-axe-old61': 61, 'proofline-site-new59': 59, 'proofline-axe-new30': 30, 'other-old3h': 180, 'proofline-other-old3h': 180, 'x-proofline-site-old3h': 180, 'x-proofline-axe-old3h': 180 })) {
      const path = join(dir, name);
      mkdirSync(path);
      utimesSync(path, (now - age * 60000) / 1000, (now - age * 60000) / 1000);
    }
    writeFileSync(join(dir, 'proofline-site-file'), 'keep');
    utimesSync(join(dir, 'proofline-site-file'), (now - 180 * 60000) / 1000, (now - 180 * 60000) / 1000);
    assert.deepEqual(sweepStale({ dir, now }).sort(), ['proofline-axe-old61', 'proofline-site-old2h']);
    assert.deepEqual(readdirSync(dir).sort(), ['other-old3h', 'proofline-axe-new30', 'proofline-other-old3h', 'proofline-site-file', 'proofline-site-new59', 'x-proofline-axe-old3h', 'x-proofline-site-old3h']);
  });

  it('temp-dirs header documents the SIGKILL limit', () => {
    assert.match(read('tests/temp-dirs.mjs'), /SIGKILL and power loss leave directories until the next run's sweep/);
  });

  it('both test files use the shared temp directory helper', () => {
    for (const file of ['tests/site.test.mjs', 'tests/axe.mjs']) {
      const source = read(file);
      assert.match(source, /import \{[^}]*makeTempDir[^}]*\} from '\.\/temp-dirs\.mjs'/);
      assert.doesNotMatch(source, /mkdtempSync\(/);
    }
  });

  for (const file of ['tests/site.test.mjs', 'tests/axe.mjs']) {
    it(`${file} sweeps old prefixed directories at the start of its run`, { timeout: 60000 }, async () => {
      const result = await runFileSweep(file);
      assert.equal(result.exit, 0, 'the file runs to the end with no test selected');
      assert.deepEqual(result.left, ['proofline-site-fresh', 'x-proofline-axe-stale', 'x-proofline-site-stale'], 'only old directories whose name starts with a prefix are swept');
    });
  }
});

describe('workflow', () => {
  const ci = () => YAML.parse(read('.github/workflows/ci.yml')) ?? {};
  const steps = () => ci().jobs?.verify?.steps ?? [];

  it('check-workflows rejects unpinned uses and accepts pinned ones', () => {
    const sha = 'a'.repeat(40);
    for (const [uses, message] of [
      ['uses: actions/checkout@v7 # v7.0.1', /uses not pinned/],
      ['uses: actions/checkout@main # v7.0.1', /uses not pinned/],
      ['uses: actions/checkout@abc1234 # v7.0.1', /uses not pinned/],
      [`uses: actions/checkout@${sha}`, /without a version comment/],
      [`uses: actions/checkout@${sha} # latest`, /without a version comment/],
    ]) {
      const fixture = makeTree({ 'w.yml': minimalWorkflow(uses) });
      const result = node(['scripts/check-workflows.mjs', join(fixture, 'w.yml')]);
      assert.equal(result.status, 1, uses);
      assert.match(result.stdout, message);
    }
    const pinned = makeTree({ 'w.yml': minimalWorkflow(`uses: actions/checkout@${sha} # v7.0.1`) });
    assert.equal(node(['scripts/check-workflows.mjs', join(pinned, 'w.yml')]).status, 0);
    const reusable = makeTree({ 'w.yml': `name: w\non: push\npermissions: {contents: read}\njobs:\n  call:\n    uses: org/repo/.github/workflows/x.yml@v1 # v1.0.0\n` });
    assert.match(node(['scripts/check-workflows.mjs', join(reusable, 'w.yml')]).stdout, /uses not pinned/);
    const flow = makeTree({ 'w.yml': minimalWorkflow(`{uses: actions/checkout@${sha}}`) });
    assert.match(node(['scripts/check-workflows.mjs', join(flow, 'w.yml')]).stdout, /uses entries/);
    assert.equal(node(['scripts/check-workflows.mjs']).status, 0);
  });

  it('ci.yml pins both actions to a commit SHA with a version comment', () => {
    const lines = read('.github/workflows/ci.yml').split('\n').filter((line) => /^\s*uses:/.test(line));
    assert.equal(lines.length, 2);
    for (const line of lines) assert.match(line, /^\s*uses: actions\/(checkout|setup-node)@[0-9a-f]{40} # v7\.\d+\.\d+$/);
  });

  it('verify job has a 5 minute timeout from measured runs', () => {
    assert.equal(ci().jobs?.verify?.['timeout-minutes'], 5);
    const line = read('.github/workflows/ci.yml').split('\n').find((part) => /timeout-minutes:/.test(part)) ?? '';
    for (const token of ['44704593187', '1 min 6 s', '44704839510', '47 s']) assert.ok(line.includes(token), token);
  });

  it('workflow check passes on ci.yml and fails on a missing or write-all permissions block', () => {
    const ok = node(['scripts/check-workflows.mjs', '.github/workflows/ci.yml']);
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /ok .*ci\.yml/);
    assert.match(ok.stdout, /workflows: 1 checked, 0 failing/);

    const none = makeTree({ 'w.yml': 'name: w\non: push\njobs:\n  j:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo hi\n' });
    const noneRun = node(['scripts/check-workflows.mjs', join(none, 'w.yml')]);
    assert.equal(noneRun.status, 1, noneRun.stdout);
    assert.match(noneRun.stdout, /missing top-level permissions/);

    const jobOnly = makeTree({ 'w.yml': 'name: w\non: push\njobs:\n  j:\n    runs-on: ubuntu-24.04\n    permissions:\n      contents: read\n    steps:\n      - run: echo hi\n' });
    assert.equal(node(['scripts/check-workflows.mjs', join(jobOnly, 'w.yml')]).status, 1, 'a job-level block is not the top-level block');

    const writeAll = makeTree({ 'w.yml': 'name: w\non: push\npermissions: write-all\njobs:\n  j:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo hi\n' });
    const writeAllRun = node(['scripts/check-workflows.mjs', join(writeAll, 'w.yml')]);
    assert.equal(writeAllRun.status, 1, writeAllRun.stdout);
    assert.match(writeAllRun.stdout, /permissions: write-all/);

    const noFiles = makeTree({});
    const noFilesRun = node(['scripts/check-workflows.mjs', noFiles]);
    assert.equal(noFilesRun.status, 1, 'zero workflow files is not a pass');
    assert.match(noFilesRun.stdout, /workflows: 0 checked/);
  });

  it('ci.yml is named ci with one verify job and the step order of the acceptance criteria', () => {
    const wf = ci();
    assert.equal(wf.name, 'ci');
    assert.ok('pull_request' in (wf.on ?? {}), 'runs on pull_request');
    assert.deepEqual(wf.on?.push?.branches, ['main']);
    assert.deepEqual(wf.permissions, { contents: 'read' });
    assert.deepEqual(Object.keys(wf.jobs ?? {}), ['verify']);
    assert.equal(wf.jobs.verify.name ?? 'verify', 'verify');
    assert.equal(`${wf.name} / ${wf.jobs.verify.name ?? 'verify'}`, 'ci / verify');
    assert.deepEqual(steps().map((s) => s.name), ['checkout', 'setup node', 'install', 'node --test', 'build', 'determinism compare', 'link check', 'axe', 'performance slot']);
    const byName = Object.fromEntries(steps().map((s) => [s.name, s]));
    assert.match(byName.install?.run ?? '', /npm ci/);
    assert.match(byName.install?.run ?? '', /npx playwright install --with-deps chromium/);
    assert.equal(byName['setup node']?.with?.['node-version-file'], '.node-version');
    assert.equal(byName['node --test']?.run, 'npm test');
    assert.equal(byName.build?.run, 'npm run build');
    assert.equal(byName['determinism compare']?.run, 'npm run check:determinism');
    assert.equal(byName['link check']?.run, 'npm run check:links');
    assert.equal(byName.axe?.run, 'npm run test:axe');
  });

  it('gating steps cannot be bypassed: no continue-on-error and no if condition', () => {
    const job = ci().jobs?.verify ?? {};
    assert.ok(steps().length > 0, 'the verify job has steps');
    assert.ok(!('continue-on-error' in job) && !('if' in job), 'the job has neither key');
    for (const s of steps()) {
      assert.ok(!('continue-on-error' in s), `${s.name} has no continue-on-error`);
      assert.ok(!('if' in s), `${s.name} has no if condition`);
    }
    const gating = ['node --test', 'determinism compare', 'link check', 'axe'];
    assert.deepEqual(steps().filter((s) => gating.includes(s.name)).map((s) => s.name), gating);
    // Each gating step calls an npm script; that script must be exactly the intended check, run as one plain command,
    // so it neither swallows a failure (`|| true`) nor runs the wrong thing (`node --version`, another check's command).
    const scripts = JSON.parse(read('package.json') || '{}').scripts ?? {};
    const intended = {
      'node --test': ['test', 'node --test'],
      'determinism compare': ['check:determinism', 'node scripts/check-dist.mjs determinism'],
      'link check': ['check:links', 'node scripts/check-dist.mjs links dist'],
      axe: ['test:axe', 'node --test tests/axe.mjs'],
    };
    for (const name of gating) {
      const run = String(steps().find((s) => s.name === name)?.run ?? '');
      const called = run.match(/^npm (?:run )?([\w:-]+)$/)?.[1];
      const [script, body] = intended[name];
      assert.equal(called, script, `${name} runs the npm script ${script}, got "${run}"`);
      assert.equal(scripts[called], body, `package.json script ${called} is exactly "${body}"`);
    }
  });

  it('performance slot prints the skip line and no Lighthouse package exists', () => {
    const slot = steps().find((s) => s.name === 'performance slot');
    assert.ok(slot, 'the performance slot step exists');
    assert.ok(!('if' in slot), 'the slot has no if key');
    assert.ok(String(slot.run).includes(SKIP_LINE), 'the slot prints the skip line');
    for (const s of steps().filter((x) => x.name !== 'performance slot')) {
      assert.doesNotMatch(String(s.run ?? ''), /lhci|lighthouse/i, `${s.name} does not run Lighthouse`);
    }
    assert.doesNotMatch(String(slot.run).replace(SKIP_LINE, ''), /lhci|lighthouse/i);
    const lock = JSON.parse(read('package-lock.json') || '{}');
    const names = Object.keys(lock.packages ?? {});
    assert.ok(names.length > 0, 'the lock lists packages');
    assert.deepEqual(names.filter((n) => /lighthouse|@lhci/i.test(n)), []);
    const pkg = JSON.parse(read('package.json'));
    const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    assert.deepEqual(declared.filter((n) => /lighthouse|@lhci/i.test(n)), []);
  });
});

describe('toolchain', () => {
  it('toolchain pins and astro config options match the acceptance criteria', async () => {
    assert.match(read('.node-version'), /^24\.\d+\.\d+\s*$/);
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.engines?.node, '24.x');
    assert.equal(pkg.dependencies?.astro, '7.4.13');
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.ok(Object.keys(all).length >= 5, 'the five planned packages are declared');
    for (const [name, version] of Object.entries(all)) assert.match(version, /^\d+\.\d+\.\d+$/, `${name} is an exact version`);
    const lock = JSON.parse(read('package-lock.json') || '{}');
    assert.ok((lock.lockfileVersion ?? 0) >= 3, 'package-lock.json exists with lockfileVersion >= 3');

    const { default: config } = await import(pathToFileURL(join(root, 'astro.config.mjs')).href);
    assert.equal(config?.output, 'static');
    assert.equal(config?.build?.format, 'directory');
    assert.equal(config?.trailingSlash, 'always');
    assert.deepEqual(config?.i18n?.locales, ['en', 'tr']);
    assert.equal(config?.i18n?.defaultLocale, 'en');
    assert.equal(config?.i18n?.routing?.prefixDefaultLocale, false);
    assert.equal(config?.i18n?.fallback, undefined);
  });
});

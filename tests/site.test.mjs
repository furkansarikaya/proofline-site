// Node tests for the static site skeleton (TASK-001). `node --test` discovers only this file.
// The "built site" group builds once, then asserts the real output; the other tests use fixtures generated in temp directories.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from 'cheerio';
import YAML from 'yaml';
import { startServer } from '../scripts/serve-dist.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const PAGES = ['index.html', 'tr/index.html', '404.html'];
const SKIP_LINE = 'performance checks skipped: the Lighthouse budgets arrive with the performance task';

const scratch = [];
after(() => { for (const d of scratch) rmSync(d, { recursive: true, force: true }); });

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
  const dir = mkdtempSync(join(tmpdir(), 'proofline-site-'));
  scratch.push(dir);
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

describe('built site', () => {
  let build = { status: -1, stderr: '' };
  before(() => {
    rmSync(dist, { recursive: true, force: true }); // a stale dist/ must never stand in for this build
    const r = spawnSync('npm', ['run', 'build'], { cwd: root, encoding: 'utf8' });
    build = { status: r.status, stderr: r.stderr ?? '' };
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

  it('pages hold one heading, a sentence, zero scripts and the same head structure', () => {
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
    for (const rel of walk(dist).filter((f) => f.endsWith('.html'))) {
      assert.equal(page(rel)('script').length, 0, `${rel} holds no script element`);
    }
  });

  it('closed mode: robots meta on every page, Disallow in robots.txt, no sitemap', () => {
    for (const rel of PAGES) {
      const $ = page(rel);
      assert.ok($, `${rel} is built`);
      assert.equal($('meta[name="robots"]').length, 1, `${rel} has exactly one robots meta`);
      assert.equal($('meta[name="robots"]').attr('content'), 'noindex, nofollow');
    }
    const lines = read('dist/robots.txt').split('\n').map((l) => l.trim());
    assert.ok(lines.includes('Disallow: /'), 'dist/robots.txt holds Disallow: /');
    assert.equal(existsSync(join(dist, 'sitemap.xml')), false, 'no sitemap is emitted');
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

describe('workflow', () => {
  const ci = () => YAML.parse(read('.github/workflows/ci.yml')) ?? {};
  const steps = () => ci().jobs?.verify?.steps ?? [];

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

// Node tests for the translation index and the staleness check of TASK-004 (src/lib/translations.ts).
// Unit tests read the index and the fixtures under tests/fixtures/translations/; nothing here builds the real dist/ (tests/site.test.mjs does).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import {
  PAIRS, alternates, checkStale, contentHash, createIndex, index, isStale, langOf, switcherTarget,
} from '../src/lib/translations.ts';
import { blobId } from '../scripts/lib/lock.mjs';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'tests', 'fixtures', 'translations');
const ORIGIN = 'https://proofline.technology';

sweepStale();
after(removeTempDirs);

/** The three alternate tags every member of the home pair carries, in order. */
const HOME_ALTERNATES = [
  { hreflang: 'en', href: `${ORIGIN}/` },
  { hreflang: 'tr', href: `${ORIGIN}/tr/` },
  { hreflang: 'x-default', href: `${ORIGIN}/` },
];

/** The blob id a Turkish guide fixture records in its `translated-from` header line. */
function recordedBlob(file) {
  const match = /<!--\s*translated-from:[^;]*;\s*blob:\s*([0-9a-f]{40})\s*-->/.exec(readFileSync(join(fixtures, 'guides', file), 'utf8'));
  assert.ok(match, `${file} records a translated-from blob id`);
  return match[1];
}

describe('translation index', () => {
  it('home pages are the first pair and hold equal en, tr and x-default alternates', () => {
    assert.deepEqual(PAIRS[0], { en: '/', tr: '/tr/' });
    assert.deepEqual(alternates('/'), HOME_ALTERNATES);
    assert.deepEqual(alternates('/tr/'), HOME_ALTERNATES);
    assert.deepEqual(alternates('/tr/'), alternates('/'), 'the set on one page equals the set on the other');
  });

  it('pages without a pair hold no alternates and the language comes from the address', () => {
    for (const page of ['/404.html', '/unpaired/', '/docs/', '/tr/orphan/']) {
      assert.deepEqual(alternates(page), [], `${page} has no pair, so no hreflang`);
    }
    assert.equal(langOf('/'), 'en');
    assert.equal(langOf('/docs/'), 'en');
    assert.equal(langOf('/404.html'), 'en');
    assert.equal(langOf('/tr/'), 'tr');
    assert.equal(langOf('/tr/docs/'), 'tr');
    assert.equal(langOf('/trial/'), 'en', 'only the /tr/ prefix is Turkish');
    assert.throws(() => langOf('tr/'), /tr\//);
  });

  it('switcherTarget covers a pair, an unpaired docs page and another unpaired page', () => {
    assert.deepEqual(switcherTarget('/'), { href: '/tr/', lang: 'tr', translated: true });
    assert.deepEqual(switcherTarget('/tr/'), { href: '/', lang: 'en', translated: true });
    assert.deepEqual(switcherTarget('/docs/'), { href: '/tr/docs/', lang: 'tr', translated: false });
    assert.deepEqual(switcherTarget('/docs/daily-use/'), { href: '/tr/docs/', lang: 'tr', translated: false });
    assert.deepEqual(switcherTarget('/pricing/'), { href: '/tr/', lang: 'tr', translated: false });
    assert.deepEqual(switcherTarget('/404.html'), { href: '/tr/', lang: 'tr', translated: false });
    assert.deepEqual(switcherTarget('/tr/docs/x/'), { href: '/docs/', lang: 'en', translated: false }, 'an unpaired Turkish page mirrors the rule');
    assert.deepEqual(switcherTarget('/tr/other/'), { href: '/', lang: 'en', translated: false });
  });

  it('one fixture pair gives both pages alternates and reciprocal targets', () => {
    const fixture = { en: '/fixture/', tr: '/tr/fixture/' };
    const extended = createIndex([...PAIRS, fixture]);
    const expected = [
      { hreflang: 'en', href: `${ORIGIN}/fixture/` },
      { hreflang: 'tr', href: `${ORIGIN}/tr/fixture/` },
      { hreflang: 'x-default', href: `${ORIGIN}/fixture/` },
    ];
    assert.deepEqual(extended.alternates('/fixture/'), expected);
    assert.deepEqual(extended.alternates('/tr/fixture/'), expected);
    assert.deepEqual(extended.switcherTarget('/fixture/'), { href: '/tr/fixture/', lang: 'tr', translated: true });
    assert.deepEqual(extended.switcherTarget('/tr/fixture/'), { href: '/fixture/', lang: 'en', translated: true });
    assert.deepEqual(extended.alternates('/'), HOME_ALTERNATES, 'the home pair is unchanged');
    assert.deepEqual(index.alternates('/fixture/'), [], 'the real index does not hold the fixture pair');
  });

  it('createIndex rejects a malformed pair and a duplicate address naming the address', () => {
    assert.throws(() => createIndex([...PAIRS, { en: '/', tr: '/tr/again/' }]), /"\/"/);
    assert.throws(() => createIndex([{ en: '/a/', tr: '/tr/a/' }, { en: '/b/', tr: '/tr/a/' }]), /\/tr\/a\//);
    assert.throws(() => createIndex([{ en: 'a/', tr: '/tr/a/' }]), /a\//);
    assert.throws(() => createIndex([{ en: '/a', tr: '/tr/a/' }]), /\/a\b/);
    assert.throws(() => createIndex([{ en: '/tr/a/', tr: '/tr/b/' }]), /\/tr\/a\//);
    assert.throws(() => createIndex([{ en: '/a/', tr: '/b/' }]), /\/b\//);
  });

  it('head tags and the switcher read one index', () => {
    const custom = createIndex([...PAIRS, { en: '/x/', tr: '/tr/x/' }]);
    assert.equal(custom.alternates('/x/').length, 3, 'a paired page holds three alternates');
    for (const page of ['/', '/tr/', '/x/', '/tr/x/', '/docs/', '/404.html', '/tr/orphan/']) {
      assert.equal(custom.alternates(page).length > 0, custom.switcherTarget(page).translated, `${page}: alternates and switcher agree`);
    }
    for (const page of ['/', '/tr/', '/docs/', '/404.html']) {
      assert.deepEqual(alternates(page), index.alternates(page));
      assert.deepEqual(switcherTarget(page), index.switcherTarget(page));
    }
    assert.deepEqual(index.pairs, PAIRS);
  });
});

describe('staleness', () => {
  it('guide staleness compares recorded and English blob ids and warns', () => {
    const english = blobId(readFileSync(join(fixtures, 'guides', 'en.md')));
    const stale = recordedBlob('tr-stale.md');
    const fresh = recordedBlob('tr-fresh.md');
    assert.equal(fresh, english, 'the fresh fixture records the current blob id');
    assert.notEqual(stale, english);

    assert.equal(isStale({ kind: 'guide', recordedBlob: stale, englishBlob: english }), true);
    assert.equal(isStale({ kind: 'guide', recordedBlob: fresh, englishBlob: english }), false);

    const warned = [];
    assert.equal(checkStale('/tr/stale-guide/', { kind: 'guide', recordedBlob: stale, englishBlob: english }, { warn: (m) => warned.push(m) }), true);
    assert.equal(warned.length, 1);
    assert.match(warned[0], /\/tr\/stale-guide\//);
    assert.ok(!warned[0].includes(stale) && !warned[0].includes(english), 'the warning holds no blob id');

    const quiet = [];
    assert.equal(checkStale('/tr/fresh-guide/', { kind: 'guide', recordedBlob: fresh, englishBlob: english }, { warn: (m) => quiet.push(m) }), false);
    assert.deepEqual(quiet, [], 'a fresh guide prints no warning');

    assert.throws(() => isStale({ kind: 'guide', recordedBlob: 'not-a-blob', englishBlob: english }), /blob/);
    assert.throws(() => checkStale('/tr/bad/', { kind: 'guide', recordedBlob: english, englishBlob: 'XYZ' }), /\/tr\/bad\//);
  });

  it('site page staleness follows the normalised hash', () => {
    const original = readFileSync(join(fixtures, 'content', 'en', 'page.md'), 'utf8');
    const normalised = original.replace(/\r\n/g, '\n').trim();
    const expected = createHash('sha256').update(normalised, 'utf8').digest('hex');
    assert.equal(contentHash(original), expected, 'sha256 of the LF, trimmed text');
    assert.match(contentHash(original), /^[0-9a-f]{64}$/);

    const dir = makeTempDir('proofline-site-');
    mkdirSync(join(dir, 'content', 'en'), { recursive: true });
    const file = join(dir, 'content', 'en', 'page.md');
    copyFileSync(join(fixtures, 'content', 'en', 'page.md'), file);
    const source = { kind: 'site', translatedFrom: { page: 'content/en/page.md', hash: contentHash(original) } };
    assert.equal(isStale(source, { root: dir }), false, 'the recorded hash matches the file');

    writeFileSync(file, original.replace('First', 'Firsd'));
    assert.equal(isStale(source, { root: dir }), true, 'one changed character is stale');

    writeFileSync(file, original.replace(/\n/g, '\r\n'));
    assert.equal(isStale(source, { root: dir }), false, 'CRLF line ends do not change the hash');

    writeFileSync(file, `\n\n  ${original}  \n\n`);
    assert.equal(isStale(source, { root: dir }), false, 'outer white space does not change the hash');

    writeFileSync(file, original.replace('Second', 'Second  '));
    assert.equal(isStale(source, { root: dir }), true, 'inner white space does');

    assert.throws(() => isStale({ kind: 'site', translatedFrom: { page: 'content/en/missing.md', hash: expected } }, { root: dir }), /missing\.md/);
    const warned = [];
    assert.equal(checkStale('/tr/stale-site/', source, { root: dir, warn: (m) => warned.push(m) }), true);
    assert.equal(warned.length, 1);
    assert.match(warned[0], /\/tr\/stale-site\//);
    assert.ok(!warned[0].includes(source.translatedFrom.hash) && !warned[0].includes(contentHash(readFileSync(file, 'utf8'))), 'the warning holds no hash');
  });
});

/**
 * A temp tree holding the fixture pair as src/content/pages/{en,tr}/page.md. The CRLF of the Turkish body line "CRLF ile biter" is written
 * here, not kept in the committed fixture: git may turn a committed CRLF into LF (core.autocrlf), and the byte-for-byte check needs it.
 */
function stampTree() {
  const dir = makeTempDir('proofline-site-');
  mkdirSync(join(dir, 'src', 'content', 'pages', 'en'), { recursive: true });
  mkdirSync(join(dir, 'src', 'content', 'pages', 'tr'), { recursive: true });
  copyFileSync(join(fixtures, 'content', 'en', 'page.md'), join(dir, 'src', 'content', 'pages', 'en', 'page.md'));
  const tr = readFileSync(join(fixtures, 'content', 'tr', 'page.md'), 'utf8');
  writeFileSync(join(dir, 'src', 'content', 'pages', 'tr', 'page.md'), tr.replace(/(CRLF ile biter:[^\r\n]*)\r?\n/, '$1\r\n'));
  return dir;
}

/** The stamp script run with the temp tree as the working directory (the npm script is the same command). */
function stamp(cwd, ...args) {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'translation-stamp.mjs'), ...args], { cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const TR_REL = 'src/content/pages/tr/page.md';
const EN_REL = 'src/content/pages/en/page.md';
const ZERO_HASH = '0'.repeat(64);

describe('translation stamp', () => {
  it('package.json exposes the stamp as the translation:stamp script', () => {
    const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
    assert.equal(scripts['translation:stamp'], 'node scripts/translation-stamp.mjs');
  });

  it('translation stamp rewrites only the hash and is idempotent', () => {
    const dir = stampTree();
    const tr = join(dir, TR_REL);
    const original = readFileSync(tr, 'utf8');
    assert.ok(original.includes('\r\n'), 'the fixture holds a CRLF body line');
    assert.ok(/ \n/.test(original), 'the fixture holds trailing spaces');
    const hash = contentHash(readFileSync(join(dir, EN_REL), 'utf8'));

    const first = stamp(dir, TR_REL);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /stamped .*page\.md/);
    assert.equal(readFileSync(tr, 'utf8'), original.replace(`"${ZERO_HASH}"`, `"${hash}"`), 'only the hash value changed, byte for byte');

    const before = statSync(tr).mtimeMs;
    const stamped = readFileSync(tr);
    const second = stamp(dir, TR_REL);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /unchanged .*page\.md/);
    assert.deepEqual(readFileSync(tr), stamped, 'a second run changes nothing');
    assert.equal(statSync(tr).mtimeMs, before, 'a second run does not even write the file');
  });

  it('translation stamp follows an English change', () => {
    const dir = stampTree();
    const tr = join(dir, TR_REL);
    stamp(dir, TR_REL);
    const en = join(dir, EN_REL);
    writeFileSync(en, readFileSync(en, 'utf8').replace('First', 'Firsd'));
    const again = stamp(dir, TR_REL);
    assert.match(again.stdout, /stamped/);
    assert.ok(readFileSync(tr, 'utf8').includes(`hash: "${contentHash(readFileSync(en, 'utf8'))}"`));
  });

  it('translation stamp adds a missing hash line with the indent and line ending of the page line', () => {
    for (const eol of ['\n', '\r\n']) {
      const dir = stampTree();
      const tr = join(dir, TR_REL);
      const lines = ['---', 'title: x', 'translatedFrom:', `    page: ${EN_REL}`, 'after: 1', '---', 'Body'];
      writeFileSync(tr, lines.join(eol) + eol);
      const hash = contentHash(readFileSync(join(dir, EN_REL), 'utf8'));
      const run = stamp(dir, TR_REL);
      assert.equal(run.status, 0, run.stderr);
      const expected = [...lines.slice(0, 4), `    hash: "${hash}"`, ...lines.slice(4)].join(eol) + eol;
      assert.equal(readFileSync(tr, 'utf8'), expected);
    }
  });

  it('translation stamp refuses a path that is not a Turkish content file and writes nothing', () => {
    const dir = stampTree();
    const tr = join(dir, TR_REL);
    const original = readFileSync(tr);
    writeFileSync(join(dir, 'outside.md'), original);
    writeFileSync(join(dir, 'src', 'content', 'pages', 'tr', 'page.txt'), original);
    for (const bad of [EN_REL, 'src/content/pages/tr/missing.md', 'outside.md', '../outside.md', 'src/content/pages/tr/page.txt', 'src/content/pages/tr']) {
      const run = stamp(dir, bad);
      assert.equal(run.status, 1, `${bad}: exits 1, got ${run.status}`);
      assert.ok(run.stderr.includes(bad), `${bad}: the message names the path: ${run.stderr}`);
    }
    assert.deepEqual(readFileSync(tr), original, 'nothing was written');
    assert.equal(stamp(dir).status, 2, 'no argument is a usage error');
    assert.equal(stamp(dir, TR_REL, TR_REL).status, 2, 'two arguments are a usage error');
  });

  it('translation stamp refuses a page outside the English tree and a flow-style block', () => {
    const dir = stampTree();
    const tr = join(dir, TR_REL);
    const original = readFileSync(tr, 'utf8');
    const block = /translatedFrom:[\s\S]*?\norder/;
    for (const [label, changed] of [
      ['a page outside the English tree', original.replace(EN_REL, 'package.json')],
      ['a missing English file', original.replace(EN_REL, 'src/content/pages/en/none.md')],
      ['a flow mapping', original.replace(block, `translatedFrom: { page: ${EN_REL}, hash: x }\norder`)],
      ['no translatedFrom', original.replace(block, 'order')],
    ]) {
      writeFileSync(tr, changed);
      const run = stamp(dir, TR_REL);
      assert.equal(run.status, 1, `${label}: exits 1: ${run.stdout}`);
      assert.ok(run.stderr.includes(TR_REL), `${label}: names the path`);
      assert.equal(readFileSync(tr, 'utf8'), changed, `${label}: nothing written`);
    }
  });
});

// The fixture site (tests/fixtures/translations/site) is built with the real layout. Each build gets its own output and cache directory;
// the first test that needs a build pays for it and the others read the same result.
const SITE = 'tests/fixtures/translations/site';
const builds = new Map();

function buildFixture(name, extraEnv = {}) {
  if (!builds.has(name)) {
    const out = makeTempDir('proofline-site-');
    const cache = makeTempDir('proofline-site-');
    const r = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--root', SITE, '--outDir', out], {
      cwd: root,
      env: { ...process.env, PROOFLINE_FIXTURE_CACHE: cache, ...extraEnv },
      encoding: 'utf8',
      timeout: 120000,
    });
    builds.set(name, { status: r.status, output: `${r.stdout ?? ''}\n${r.stderr ?? ''}`, out });
  }
  return builds.get(name);
}

/** Parsed HTML of a built fixture page. */
function fixturePage(build, rel) {
  const file = join(build.out, rel, 'index.html');
  assert.ok(existsSync(file), `${rel} is built: ${build.output.slice(-600)}`);
  return load(readFileSync(file, 'utf8'));
}

const warningLines = (build) => build.output.split('\n').filter((line) => line.includes('[proofline] warning:'));

describe('fixture site build', () => {
  it('fixture build prints no hreflang on an unpaired page', { timeout: 120000 }, () => {
    const build = buildFixture('normal');
    assert.equal(build.status, 0, build.output.slice(-600));
    const unpaired = fixturePage(build, 'unpaired');
    assert.equal(unpaired('link[hreflang]').length, 0, 'an unpaired page holds 0 hreflang tags');
    assert.equal(unpaired('html').attr('lang'), 'en');
    for (const rel of ['tr/stale-guide', 'tr/fresh-guide', 'tr/stale-site']) {
      const $ = fixturePage(build, rel);
      assert.equal($('link[hreflang]').length, 0, `${rel} has no pair, so no hreflang`);
      assert.equal($('html').attr('lang'), 'tr', `${rel} is Turkish by its address`);
    }
  });

  it('fixture build keeps a 40-character site title and warns only for the 121-character synced title', { timeout: 120000 }, () => {
    const build = buildFixture('normal');
    assert.equal(build.status, 0, build.output.slice(-600));
    const warnings = warningLines(build);
    const long = warnings.filter((line) => line.includes('/titles/synced-121/'));
    assert.ok(long.length >= 1 && long.every((line) => /121 characters, above 120/.test(line)), `the 121-character title warns: ${warnings.join(' | ')}`);
    assert.ok(!warnings.some((line) => line.includes('/titles/synced-120/') || line.includes('/titles/site-40/')), 'the 120-character and the 40-character titles print no warning');
    assert.equal(fixturePage(build, 'titles/synced-121')('title').text(), `${'H'.repeat(49)} | proofline: a deterministic engineering team for Claude Code and Codex`, 'the H1 is never cut');
    assert.equal(fixturePage(build, 'titles/site-40')('title').text(), `${'a'.repeat(40)} | proofline: a deterministic engineering team for Claude Code and Codex`);
  });

  it('fixture build warns for the stale guide and the stale site page and not for the fresh guide', { timeout: 120000 }, () => {
    const build = buildFixture('normal');
    assert.equal(build.status, 0, build.output.slice(-600));
    const warnings = warningLines(build);
    assert.ok(warnings.some((line) => line.includes('/tr/stale-guide/')), `the stale guide warns: ${warnings.join(' | ')}`);
    assert.ok(warnings.some((line) => line.includes('/tr/stale-site/')), 'the stale site page warns');
    assert.ok(!warnings.some((line) => line.includes('/tr/fresh-guide/')), 'the fresh guide prints no warning');
  });

  it('stale fixture pages hold no blob id or hash in HTML', { timeout: 120000 }, () => {
    const build = buildFixture('normal');
    assert.equal(build.status, 0, build.output.slice(-600));
    const english = readFileSync(join(fixtures, 'guides', 'en.md'));
    const values = [
      recordedBlob('tr-stale.md'), recordedBlob('tr-fresh.md'), blobId(english),
      'ab'.repeat(32), contentHash(readFileSync(join(fixtures, 'content', 'en', 'page.md'), 'utf8')),
    ];
    assert.ok(readFileSync(join(fixtures, 'site', 'src', 'pages', 'tr', 'stale-site', 'index.astro'), 'utf8').includes('ab'.repeat(32)), 'the recorded hash is the one in the page file');
    const warnings = warningLines(build);
    assert.ok(warnings.some((line) => line.includes('/tr/stale-guide/')) && warnings.some((line) => line.includes('/tr/stale-site/')), 'both stale pages were detected, so the check really ran');
    for (const rel of ['tr/stale-guide', 'tr/fresh-guide', 'tr/stale-site']) {
      const $ = fixturePage(build, rel);
      assert.ok($('title').text().endsWith('Claude Code ve Codex için deterministik bir mühendislik ekibi'), `${rel} is rendered with the full head`);
      const html = $.html();
      for (const value of values) assert.ok(!html.includes(value), `${rel} does not print ${value}`);
    }
  });

  it('fixture build fails for a 41-character site title and names the page', { timeout: 120000 }, () => {
    const build = buildFixture('title-41', { PROOFLINE_FIXTURE_TITLE_41: '1' });
    assert.notEqual(build.status, 0, 'a 41-character site-written title fails the build');
    assert.ok(build.output.includes('/titles/site-40/'), `the output names the page: ${build.output.slice(-600)}`);
    assert.match(build.output, /41 characters/);
  });
});

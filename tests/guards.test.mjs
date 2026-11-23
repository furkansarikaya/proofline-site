// TASK-020: install-time and README command guards (scripts/lib/guards.mjs, mode `guards` of scripts/check-dist.mjs).
// The CLI cases run `node scripts/check-dist.mjs guards <tree>` on temp copies of tests/fixtures/guards/ (a failing variant
// is written into a temp copy, never into the fixtures) with a temp pin file and cache built from tests/fixtures/pin-facts/.
// The rule cases call the library with the facts and the PROBES text passed in. No test makes a network request.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashTree } from '../scripts/check-dist.mjs';
import { DOCS_INDEXES, GET_STARTED_PAGES, INSTALL_TIME_PATTERNS, checkGuards, isSyncedPage, normaliseCommand, pb3State } from '../scripts/lib/guards.mjs';
import { readPinFacts } from '../scripts/lib/pin-facts.mjs';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

sweepStale();
after(removeTempDirs);

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..');
const CLI = join(REPO, 'scripts', 'check-dist.mjs');
const GUARDS = join(here, 'fixtures', 'guards');
const PIN_FIXTURES = join(here, 'fixtures', 'pin-facts');
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const PROBES_FIXTURE = join(GUARDS, 'PROBES.md');
const PROBES = readFileSync(PROBES_FIXTURE, 'utf8');

// The two patterns of the PRD AC-4 as TASK.md writes them, repeated here so that a changed pattern fails a test.
const P0 = String.raw`(?<![\w-])(five|5)[ -]?(minutes?|mins?)`;
const P1 = String.raw`(?<![\w-])(beş|5)[ -]?(dakika|dk)`;
const RANGE = 'README.md between "## Install" and "## What it supports"';

const blockLine = (address, line) => `${address}: command line not in ${RANGE}: ${line}`;
const spanLine = (address, span) => `${address}: data-command span not in ${RANGE}: ${span}`;
const timeLine = (address, match, pattern, state = 'no result') => `${address}: install-time text "${match}" matches ${pattern} (case-insensitive) while PB-3 is not confirmed (${state})`;
const SUMMARY = (pages, written, started, failures) => `guards: ${pages} pages, ${written} site-written, ${started} get-started, ${failures} failures`;

let pinTree;
/** A temp pin file and sync cache that hold the pin-facts fixture documents, like tests/pin-facts.test.mjs builds them. */
function pins() {
  if (pinTree === undefined) {
    const dir = makeTempDir('proofline-site-guardpin-');
    const cacheRoot = join(dir, 'cache');
    cpSync(PIN_FIXTURES, join(cacheRoot, COMMIT), { recursive: true });
    const pinFile = join(dir, 'pin.json');
    writeFileSync(pinFile, JSON.stringify({ commit: COMMIT, tag: 'v0.0.171' }));
    pinTree = { dir, cacheRoot, pinFile, facts: readPinFacts(pinFile, cacheRoot) };
  }
  return pinTree;
}

/** A temp copy of a fixture site; `pages` writes (or replaces) pages by relative path, `remove` deletes some. */
function site(base, pages = {}, remove = []) {
  const dir = makeTempDir('proofline-site-guards-');
  cpSync(join(GUARDS, base), dir, { recursive: true });
  for (const rel of remove) rmSync(join(dir, rel), { recursive: true, force: true });
  for (const [rel, html] of Object.entries(pages)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), html);
  }
  return dir;
}

const fixturePage = (rel) => readFileSync(join(GUARDS, rel), 'utf8');
/** A fixture page with `markup` added at the end of its `main` element. */
const insert = (rel, markup) => {
  const text = fixturePage(rel);
  assert.ok(text.includes('</main>'), `${rel} has a main element`);
  return text.replace('</main>', () => `${markup}\n</main>`);
};
const html = (body, { title = 'Fixture', description } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>${description === undefined ? '' : `<meta name="description" content="${description}">`}</head><body>${body}</body></html>`;
const pre = (...lines) => `<pre><code>${lines.join('\n')}</code></pre>`;

/** The PROBES fixture text with edits; PB-3 is the last item, so its lock line is the place for a `result:` line. */
const PB3_LOCK = '  locked: pb3-locked\n';
const withPb3 = (...lines) => (text) => {
  assert.ok(text.includes(PB3_LOCK), 'the PROBES fixture holds the PB-3 lock line');
  return text.replace(PB3_LOCK, () => `${PB3_LOCK}${lines.join('\n')}\n`);
};
function probesFile(edit) {
  const dir = makeTempDir('proofline-site-guardprobes-');
  const file = join(dir, 'PROBES.md');
  writeFileSync(file, typeof edit === 'function' ? edit(PROBES) : edit);
  return file;
}

/** Run the CLI; options: `probes` (path, null for the default), `pin`, `cache` (null for the default), `cwd`, `args` (raw), `cli` (another copy of the script). */
function guard(dir, { probes = PROBES_FIXTURE, pin = pins().pinFile, cache = pins().cacheRoot, cwd = REPO, args, cli = CLI } = {}) {
  const argv = args ?? ['guards', dir, ...(probes === null ? [] : ['--probes', probes]), ...(pin === null ? [] : ['--pin', pin]), ...(cache === null ? [] : ['--cache', cache])];
  const r = spawnSync(process.execPath, [cli, ...argv], { cwd, encoding: 'utf8', timeout: 25000 });
  const stdout = r.stdout ?? '';
  return { status: r.status, stdout, stderr: r.stderr ?? '', lines: stdout.split('\n').filter((l) => l !== '') };
}

/** The failure lines of a run: every line except the PB-3 state and the summary. */
const failuresOf = (r) => r.lines.filter((l) => !l.startsWith('PB-3: ') && !l.startsWith('guards: '));

const FACTS = { readme_commands: ['/plugin install proofline@proofline'], readme_inline_spans: ['npx skills add furkansarikaya/proofline'] };
/** The library on one page, with the facts and the PROBES text passed in. */
const lib = (address, markup, { probesText = PROBES, facts = FACTS } = {}) => checkGuards({ pages: [{ address, html: markup }], probesText, loadFacts: () => facts });
const confirmedProbes = withPb3('  result: confirmed')(PROBES);

describe('get-started page commands (AC-1, AC-2, AC-3, AC-4)', () => {
  it('get-started line absent from the README fails and names page and line', () => {
    const base = guard(site('site-clean'));
    assert.equal(base.status, 0, base.stdout);
    for (const [rel, address] of [['get-started/index.html', '/get-started/'], ['tr/baslarken/index.html', '/tr/baslarken/']]) {
      const dir = site('site-clean', { [rel]: insert(`site-clean/${rel}`, `<p>Next:</p>\n${pre('proofline frobnicate --now')}`) });
      const r = guard(dir);
      assert.equal(r.status, 1, r.stdout);
      assert.deepEqual(failuresOf(r), [blockLine(address, 'proofline frobnicate --now')], `only ${address} fails, with its line`);
      assert.equal(r.lines.at(-1), SUMMARY(3, 3, 2, 1));
    }
    // Every pre of the page is read, not only the first; the line is shown trimmed and with entities decoded.
    const second = guard(site('site-clean', { 'get-started/index.html': insert('site-clean/get-started/index.html', `${pre('/plugin install proofline@proofline')}\n${pre('', '  echo a &amp;&amp; echo b  ')}`) }));
    assert.equal(second.status, 1);
    assert.deepEqual(failuresOf(second), [blockLine('/get-started/', 'echo a && echo b')]);
    // Two bad lines are two failure lines, in page order.
    const two = guard(site('site-clean', { 'get-started/index.html': insert('site-clean/get-started/index.html', pre('first-bad', '/plugin install proofline@proofline', 'second-bad')) }));
    assert.deepEqual(failuresOf(two), [blockLine('/get-started/', 'first-bad'), blockLine('/get-started/', 'second-bad')]);
    assert.equal(two.lines.at(-1), SUMMARY(3, 3, 2, 2));
    // A pre on any other page is not a get-started block: it is not compared.
    const other = guard(site('site-clean', { 'index.html': insert('site-clean/index.html', pre('proofline frobnicate --now')) }));
    assert.equal(other.status, 0, other.stdout);
    // A command of the README is not enough on its own spelling: case and options matter.
    for (const line of ['/Plugin install proofline@proofline', '/plugin install proofline@proofline --force', '/plugin install proofline@proofline-other # note', '/plugin install']) {
      const r = guard(site('site-clean', { 'get-started/index.html': insert('site-clean/get-started/index.html', pre(line)) }));
      assert.deepEqual(failuresOf(r), [blockLine('/get-started/', line)], line);
    }
  });

  it('white space and trailing comments do not change the comparison', () => {
    const base = guard(site('site-clean'));
    assert.equal(base.status, 0, base.stdout);
    assert.ok(fixturePage('site-clean/get-started/index.html').includes('   /plugin install proofline@proofline   '), 'the fixture page holds a padded line');
    const lines = [
      '   /plugin install proofline@proofline   ',
      '\t/plugin install proofline@proofline\t',
      '/plugin install proofline@proofline # a note',
      '/plugin install proofline@proofline    # many spaces before the comment',
      '/plugin install proofline@proofline\t# a tab before the comment',
      '  /plugin marketplace add furkansarikaya/proofline # the README side holds a comment too  ',
      '/plugin marketplace add furkansarikaya/proofline',
      '',
      '   ',
      '# a comment line',
      '   # an indented comment line',
      '#note without a space after the hash',
      '   #indented note without a space',
      '\t#tab note without a space',
    ];
    const r = guard(site('site-clean', { 'get-started/index.html': insert('site-clean/get-started/index.html', pre(...lines)) }));
    assert.equal(r.status, 0, r.stdout);
    assert.deepEqual(failuresOf(r), []);
    // A "#" that is not a comment (no white space before it) stays part of the line.
    const hash = guard(site('site-clean', { 'get-started/index.html': insert('site-clean/get-started/index.html', pre('/plugin install proofline@proofline#tag')) }));
    assert.deepEqual(failuresOf(hash), [blockLine('/get-started/', '/plugin install proofline@proofline#tag')]);

    // Unit: one function on both sides, the expression of pin-facts.mjs.
    assert.equal(normaliseCommand('  cmd a  '), 'cmd a');
    assert.equal(normaliseCommand('cmd a # note'), 'cmd a');
    assert.equal(normaliseCommand('cmd a     # note'), 'cmd a');
    assert.equal(normaliseCommand('cmd a\t# note'), 'cmd a');
    assert.equal(normaliseCommand('cmd a #one # two'), 'cmd a');
    assert.equal(normaliseCommand('cmd a#b'), 'cmd a#b');
    assert.equal(normaliseCommand('  cmd a #  '), 'cmd a');
    assert.equal(normaliseCommand(normaliseCommand('  cmd a # note ')), 'cmd a');
    // The two sides agree: the fenced lines of the fixture README range, normalised here, are the facts of the extractor.
    const readme = readFileSync(join(PIN_FIXTURES, 'README.md'), 'utf8').split('\n');
    const from = readme.indexOf('## Install');
    const to = readme.indexOf('## What it supports');
    assert.ok(from !== -1 && to > from);
    let fenced = false;
    const raw = [];
    for (const line of readme.slice(from + 1, to)) {
      if (line.startsWith('```')) fenced = !fenced;
      else if (fenced) raw.push(line);
    }
    assert.ok(raw.some((l) => l.includes(' # add the marketplace')), 'the fixture README holds a commented command line');
    const normalised = raw.map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#')).map(normaliseCommand);
    assert.deepEqual(normalised, pins().facts.readme_commands);
    // A README value that still holds a comment or padding is normalised too, "on both sides".
    const both = lib('/get-started/', html(pre('/plugin install proofline@proofline')), { facts: { readme_commands: ['  /plugin install proofline@proofline   # kept comment '], readme_inline_spans: [] } });
    assert.deepEqual(both.failures, []);
  });

  it('a command found only outside the Install range fails', () => {
    const readme = readFileSync(join(PIN_FIXTURES, 'README.md'), 'utf8');
    assert.ok(readme.includes('proofline init'), 'the fixture README holds the command in its Quick start section');
    assert.ok(!pins().facts.readme_commands.some((c) => c.includes('proofline init')), 'the facts do not hold it');
    for (const [rel, address] of [['get-started/index.html', '/get-started/'], ['tr/baslarken/index.html', '/tr/baslarken/']]) {
      const r = guard(site('site-clean', { [rel]: insert(`site-clean/${rel}`, pre('proofline init            # installs the control plane')) }));
      assert.equal(r.status, 1, r.stdout);
      assert.deepEqual(failuresOf(r), [blockLine(address, 'proofline init            # installs the control plane')]);
    }
    const bare = guard(site('site-clean', { 'get-started/index.html': insert('site-clean/get-started/index.html', pre('proofline init')) }));
    assert.deepEqual(failuresOf(bare), [blockLine('/get-started/', 'proofline init')]);
  });

  it('data-command spans are compared and unmarked spans are prose', () => {
    const page = (rel, markup) => ({ [rel]: insert(`site-clean/${rel}`, markup) });
    const bad = guard(site('site-clean', page('get-started/index.html', '<p><code data-command>outside after</code></p>')));
    assert.equal(bad.status, 1, bad.stdout);
    assert.deepEqual(failuresOf(bad), [spanLine('/get-started/', 'outside after')]);
    const badTr = guard(site('site-clean', page('tr/baslarken/index.html', '<p><code data-command>outside before</code></p>')));
    assert.deepEqual(failuresOf(badTr), [spanLine('/tr/baslarken/', 'outside before')]);
    // The same text without the attribute is prose (the fixture page already holds one), and a README span passes.
    const prose = guard(site('site-clean', page('get-started/index.html', '<p><code>outside after</code> and <code>proofline frobnicate</code></p>')));
    assert.equal(prose.status, 0, prose.stdout);
    const ok = guard(site('site-clean', page('get-started/index.html', '<p><code data-command>npx skills add furkansarikaya/proofline</code> <span data-command>sh</span></p>')));
    assert.equal(ok.status, 0, ok.stdout);
    // White space inside a span is collapsed, any value of the attribute marks the span, and any element can carry it.
    const spaced = guard(site('site-clean', page('get-started/index.html', '<p><code data-command="x">  npx   skills\n add furkansarikaya/proofline </code></p>')));
    assert.equal(spaced.status, 0, spaced.stdout);
    const other = guard(site('site-clean', page('get-started/index.html', '<p><kbd data-command="">proofline frobnicate</kbd></p>')));
    assert.deepEqual(failuresOf(other), [spanLine('/get-started/', 'proofline frobnicate')]);
    // The span is compared as a whole: a prefix of a README span is another span.
    const prefix = guard(site('site-clean', page('get-started/index.html', '<p><code data-command>npx skills add</code></p>')));
    assert.deepEqual(failuresOf(prefix), [spanLine('/get-started/', 'npx skills add')]);
    // A marked element inside a pre belongs to the block, not to the spans: its line is a README command.
    const inside = guard(site('site-clean', page('get-started/index.html', '<pre><span data-command>/plugin install proofline@proofline</span></pre>')));
    assert.equal(inside.status, 0, inside.stdout);
    // A marked span on a page that is not a get-started page is not compared.
    const away = guard(site('site-clean', page('index.html', '<p><code data-command>outside after</code></p>')));
    assert.equal(away.status, 0, away.stdout);
    // Unit: both sides are collapsed, and no comment is removed from a span.
    assert.deepEqual(lib('/get-started/', html('<code data-command>a\n   b</code>'), { facts: { readme_commands: [], readme_inline_spans: [' a    b '] } }).failures, []);
    assert.equal(lib('/get-started/', html('<code data-command>a # b</code>'), { facts: { readme_commands: [], readme_inline_spans: ['a'] } }).failures.length, 1);
  });
});

describe('Claude Code and Codex page commands (TASK-023 AC-3)', () => {
  const NEW = [['claude-code-and-codex/index.html', '/claude-code-and-codex/'], ['tr/claude-code-ve-codex/index.html', '/tr/claude-code-ve-codex/']];
  const SPAN_FACTS = { readme_commands: ['/plugin install proofline@proofline'], readme_inline_spans: ['proofline init --role implementer=codex'] };
  const CLEAN = `${pre('/plugin install proofline@proofline')}<p>Run it with <code data-command lang="en" translate="no">proofline init --role implementer=codex</code> here.</p>`;

  it('the two new addresses are checked: a bad block line or span fails naming the address and the page counts as command-checked', () => {
    for (const [rel, address] of NEW) {
      // The clean page: a README line in a block and the README span marked outside a block.
      assert.deepEqual(lib(address, html(CLEAN), { facts: SPAN_FACTS }).failures, [], `${address}: a clean page has no failure`);
      assert.equal(lib(address, html(CLEAN), { facts: SPAN_FACTS }).lines.at(-1), SUMMARY(1, 1, 1, 0), `${address}: counted as a command-checked page`);
      // A block line the README does not hold, and a marked span it does not hold.
      assert.deepEqual(lib(address, html(`${CLEAN}${pre('proofline frobnicate --now')}`), { facts: SPAN_FACTS }).failures, [blockLine(address, 'proofline frobnicate --now')], `${address}: a bad block line`);
      assert.deepEqual(lib(address, html(`${CLEAN}<p><code data-command>proofline init --role implementer</code></p>`), { facts: SPAN_FACTS }).failures, [spanLine(address, 'proofline init --role implementer')], `${address}: a cut span`);
      // The span written as a block line is not a README command line.
      assert.deepEqual(lib(address, html(pre('proofline init --role implementer=codex')), { facts: SPAN_FACTS }).failures, [blockLine(address, 'proofline init --role implementer=codex')], `${address}: the span as a block line`);
      // The same page through the command line tool on a fixture tree: the line is named with its address and the summary counts four command-checked pages.
      const dir = site('site-clean', { [rel]: html(pre('proofline frobnicate --now')) });
      const r = guard(dir);
      assert.equal(r.status, 1, r.stdout);
      assert.deepEqual(failuresOf(r), [blockLine(address, 'proofline frobnicate --now')], `${address}: only this page fails, with its line`);
      assert.equal(r.lines.at(-1), SUMMARY(4, 4, 3, 1), `${address}: the page is counted`);
      assert.deepEqual(lib(address, html('<p><code data-command>proofline frobnicate</code></p>'), { facts: SPAN_FACTS }).failures, [spanLine(address, 'proofline frobnicate')], `${address}: a bad span`);
    }
    // A page below the address is not one of the four pages: nothing is compared.
    const below = Object.fromEntries(NEW.map(([rel]) => [rel.replace('/index.html', '/other/index.html'), html(`${pre('proofline frobnicate --now')}<p><code data-command>nothing</code></p>`)]));
    const other = guard(site('site-clean', below));
    assert.equal(other.status, 0, other.stdout);
    assert.equal(other.lines.at(-1), SUMMARY(5, 5, 2, 0), 'the two pages below the addresses are site-written pages and no command-checked pages');
    // All four addresses together are command-checked pages.
    const all = checkGuards({ pages: GET_STARTED_PAGES.map((address) => ({ address, html: html(CLEAN) })), probesText: PROBES, loadFacts: () => SPAN_FACTS });
    assert.deepEqual(all.failures, []);
    assert.equal(all.lines.at(-1), SUMMARY(4, 4, 4, 0), 'four pages, four command-checked');
  });

  it('the facts are loaded for a new address alone and not for another page', () => {
    for (const address of ['/claude-code-and-codex/', '/tr/claude-code-ve-codex/']) {
      let loaded = 0;
      checkGuards({ pages: [{ address, html: html('<p>x</p>') }], probesText: PROBES, loadFacts: () => { loaded += 1; return SPAN_FACTS; } });
      assert.equal(loaded, 1, `${address}: the facts are loaded once`);
    }
    let loaded = 0;
    checkGuards({ pages: [{ address: '/trust/', html: html(pre('proofline frobnicate')) }], probesText: PROBES, loadFacts: () => { loaded += 1; return SPAN_FACTS; } });
    assert.equal(loaded, 0, 'another page loads no facts');
  });
});

describe('page classes and install-time patterns (AC-5, AC-6, AC-7, AC-8)', () => {
  it('synced pages are not guarded and docs indexes are site-written', () => {
    const synced = ['/docs/guides/existing-project/', '/docs/concepts/workflow/', '/docs/proof/', '/docs/skills/alpha/', '/tr/docs/guides/baslangic/', '/tr/docs/proof/'];
    const written = ['/', '/tr/', '/docs/', '/tr/docs/', '/docs/skills/', '/get-started/', '/tr/baslarken/', '/trust/', '/contact/', '/404.html', '/docs', '/documents/', '/docsx/', '/tr/documents/', '/x/docs/guides/a/', '/Docs/guides/a/'];
    for (const a of synced) assert.equal(isSyncedPage(a), true, a);
    for (const a of written) assert.equal(isSyncedPage(a), false, a);
    assert.deepEqual(DOCS_INDEXES, ['/docs/', '/tr/docs/', '/docs/skills/']);
    assert.deepEqual(GET_STARTED_PAGES, ['/get-started/', '/tr/baslarken/', '/claude-code-and-codex/', '/tr/claude-code-ve-codex/']);

    const base = guard(site('site-mixed'));
    assert.equal(base.status, 0, base.stdout);
    assert.equal(base.lines.at(-1), SUMMARY(3, 2, 0, 0), 'the guide is a page but not site-written');
    const guide = fixturePage('site-mixed/docs/guides/existing-project/index.html');
    assert.ok(guide.includes('proofline init --existing') && guide.includes('five minutes'), 'the synced fixture holds a command outside the README and the words');
    // The same words fail on every docs index, which the site writes.
    for (const [rel, address] of [['docs/index.html', '/docs/'], ['tr/docs/index.html', '/tr/docs/'], ['docs/skills/index.html', '/docs/skills/']]) {
      const r = guard(site('site-mixed', { [rel]: html('<p>Done in 5 minutes.</p>') }));
      assert.equal(r.status, 1, `${address}: ${r.stdout}`);
      assert.deepEqual(failuresOf(r), [timeLine(address, '5 minutes', P0)]);
    }
    const fromFixture = guard(site('site-mixed', { 'docs/index.html': insert('site-mixed/docs/index.html', '<p>Done in 5 minutes.</p>') }));
    assert.deepEqual(failuresOf(fromFixture), [timeLine('/docs/', '5 minutes', P0)]);
    // A Turkish synced page and a skill page with the words, and a pre outside the README, pass.
    const more = guard(site('site-mixed', {
      'tr/docs/guides/baslangic/index.html': html('<p>Yaklaşık beş dakika.</p><pre><code>proofline foo</code></pre>'),
      'docs/skills/alpha/index.html': html('<p>about 5 mins</p>'),
    }));
    assert.equal(more.status, 0, more.stdout);
    assert.equal(more.lines.at(-1), SUMMARY(5, 2, 0, 0));
    // A synced page cannot break the build even when it is named like a get-started page under /docs/.
    const nested = guard(site('site-mixed', { 'docs/get-started/index.html': html(pre('proofline foo')) }));
    assert.equal(nested.status, 0, nested.stdout);
    // The summary counts a page outside /docs/ as site-written and a get-started page as both.
    const counted = guard(site('site-mixed', { 'get-started/index.html': html('<p>Hi</p>') }), { probes: probesFile(confirmedProbes) });
    assert.equal(counted.lines.at(-1), SUMMARY(4, 3, 1, 0));
  });

  it('install-time patterns fail while PB-3 has no result', () => {
    assert.deepEqual(INSTALL_TIME_PATTERNS.map((p) => p.source), [P0, P1]);
    assert.deepEqual(INSTALL_TIME_PATTERNS.map((p) => p.flags), ['i', 'i']);
    const cases = [['5 minutes', '5 minutes', P0], ['five-minute', 'five-minute', P0], ['5 mins', '5 mins', P0], ['beş dakika', 'beş dakika', P1], ['5 dk', '5 dk', P1]];
    for (const [text, match, pattern] of cases) {
      const r = guard(site('site-mixed', { 'index.html': insert('site-mixed/index.html', `<p>Done in ${text} flat.</p>`) }));
      assert.equal(r.status, 1, `${text}: ${r.stdout}`);
      assert.deepEqual(failuresOf(r), [timeLine('/', match, pattern)], text);
      assert.equal(r.lines[0], 'PB-3: no result');
    }
    for (const text of ['15 minutes', 'twenty-five minutes', 'a few seconds']) {
      const r = guard(site('site-mixed', { 'index.html': insert('site-mixed/index.html', `<p>It takes ${text} flat.</p>`) }));
      assert.equal(r.status, 0, `${text}: ${r.stdout}`);
    }

    // Unit: the whole of both patterns. Texts that match, with the text the failure shows.
    const hit = (markup, match, pattern, address = '/') => {
      const r = lib(address, html(markup));
      assert.deepEqual(r.failures, [timeLine(address, match, pattern)], markup);
    };
    const miss = (markup) => assert.deepEqual(lib('/', html(markup)).failures, [], markup);
    hit('<p>FIVE MINUTES</p>', 'FIVE MINUTES', P0);
    hit('<p>Five Min</p>', 'Five Min', P0);
    hit('<p>5minutes</p>', '5minutes', P0);
    hit('<p>5-minutes</p>', '5-minutes', P0);
    hit('<p>5 minute</p>', '5 minute', P0);
    hit('<p>(5 minutes)</p>', '5 minutes', P0);
    hit('<p>about 5 minutesx</p>', '5 minutes', P0);
    hit('<p>plus five min</p>', 'five min', P0);
    hit('<p>5   minutes</p>', '5 minutes', P0);
    hit('<p>5\nminutes</p>', '5 minutes', P0);
    hit('<p>5&nbsp;minutes</p>', '5 minutes', P0);
    hit('<p><b>five</b>-minute</p>', 'five-minute', P0);
    hit('<p>in</p><p>5 mins</p>', '5 mins', P0);
    hit('<p>5dk</p>', '5dk', P1);
    hit('<p>beş-dakika</p>', 'beş-dakika', P1);
    hit('<p>BEŞ DAKIKA</p>', 'BEŞ DAKIKA', P1);
    hit('<p>BEŞ DAKİKA</p>', 'beş dakika', P1);
    hit('<p>5 DK</p>', '5 DK', P1);
    hit('<p>sadece 5 dakikada</p>', '5 dakika', P1);
    // Near texts that the look-behind keeps out.
    for (const text of ['15 minutes', '1five minutes', 'twenty-five minutes', 'x5 minutes', 'a-5 minutes', 'a_5 minutes', 'a few seconds', '5 hours', '5 m', '50 minutes', '15 dk', 'yirmi-beş dakika', 'x5dk', '15 dakika', '5 saniye']) miss(`<p>${text}</p>`);
    // Where the patterns look: title, description and body text, on every site-written page.
    const whole = lib('/trust/', html('<p>Plain.</p>', { title: 'Done in 5 minutes', description: 'ready in beş dakika' }));
    assert.deepEqual(whole.failures, [timeLine('/trust/', '5 minutes', P0), timeLine('/trust/', 'beş dakika', P1)]);
    assert.deepEqual(lib('/', html('<p>Plain.</p>', { description: 'ready in 5 mins' })).failures, [timeLine('/', '5 mins', P0)]);
    assert.deepEqual(lib('/', html('<p>Plain.</p>', { title: 'five-minute start' })).failures, [timeLine('/', 'five-minute', P0)]);
    assert.deepEqual(lib('/404.html', html('<p>5 dk</p>')).failures, [timeLine('/404.html', '5 dk', P1)]);
    assert.deepEqual(lib('/tr/', html('<p>5 dk</p>')).failures, [timeLine('/tr/', '5 dk', P1)]);
    assert.deepEqual(lib('/', html('<p>5 minutes</p><p>5 mins</p>')).failures, [timeLine('/', '5 minutes', P0)], 'one line per page and pattern, with the first match');
    // What the patterns never read: script, style, comments, attribute values, and synced pages.
    miss('<script>var t = "5 minutes";</script><style>.x::after { content: "5 minutes"; }</style><!-- 5 minutes -->');
    miss('<img alt="5 minutes" src="/a.png"><a href="/x/" aria-label="five minutes" data-t="5 dk">link</a>');
    assert.deepEqual(lib('/docs/guides/a/', html('<p>5 minutes and 5 dk</p>')).failures, []);
    assert.deepEqual(lib('/tr/docs/guides/a/', html('<p>5 minutes</p>')).failures, []);
    // A confirmed PB-3 switches the patterns off.
    assert.deepEqual(lib('/', html('<p>5 minutes</p>'), { probesText: confirmedProbes }).failures, []);
  });

  it('only a confirmed PB-3 result lets an install time pass', () => {
    const dir = () => site('site-mixed', { 'index.html': insert('site-mixed/index.html', '<p>Done in 5 minutes.</p>') });
    for (const [value, state] of [['failed', 'failed'], ['inconclusive', 'inconclusive']]) {
      const r = guard(dir(), { probes: probesFile(withPb3(`  result: ${value}`)) });
      assert.equal(r.status, 1, `${value}: ${r.stdout}`);
      assert.equal(r.lines[0], `PB-3: ${state}`);
      assert.deepEqual(failuresOf(r), [timeLine('/', '5 minutes', P0, state)]);
    }
    const ok = guard(dir(), { probes: probesFile(withPb3('  result: confirmed')) });
    assert.equal(ok.status, 0, ok.stdout);
    assert.equal(ok.lines[0], 'PB-3: confirmed');
    assert.equal(ok.lines.at(-1), SUMMARY(3, 2, 0, 0));
    // Surrounding spaces and tabs of the value do not matter, and the colon needs no space after it.
    for (const line of ['  result:confirmed', '\tresult:\tconfirmed \t', '    result:    confirmed    ']) {
      const r = guard(dir(), { probes: probesFile(withPb3(line)) });
      assert.equal(r.status, 0, `${JSON.stringify(line)}: ${r.stdout}`);
    }
    // A confirmed PB-3 does not switch the command comparison off.
    const bad = guard(site('site-clean', { 'get-started/index.html': insert('site-clean/get-started/index.html', pre('proofline frobnicate')) }), { probes: probesFile(withPb3('  result: confirmed')) });
    assert.equal(bad.status, 1);
    assert.deepEqual(failuresOf(bad), [blockLine('/get-started/', 'proofline frobnicate')]);
    // The state line of every other case.
    assert.equal(guard(dir(), { probes: probesFile(withPb3('  result:')) }).lines[0], 'PB-3: result "" is not confirmed');
    assert.equal(guard(dir(), { probes: probesFile(withPb3('  result: maybe later')) }).lines[0], 'PB-3: result "maybe later" is not confirmed');
    assert.equal(guard(dir()).lines[0], 'PB-3: no result');
  });

  it('confirmed in PB-1 or PB-2 does not count and spelling variants do not count', () => {
    assert.ok(/- PB-1[^]*result: confirmed[^]*- PB-2[^]*result: confirmed[^]*- PB-3/.test(PROBES), 'the fixture has confirmed results in PB-1 and PB-2');
    const dir = () => site('site-mixed', { 'index.html': insert('site-mixed/index.html', '<p>Done in 5 minutes.</p>') });
    const base = guard(dir());
    assert.equal(base.status, 1, base.stdout);
    assert.equal(base.lines[0], 'PB-3: no result');
    assert.deepEqual(failuresOf(base), [timeLine('/', '5 minutes', P0)]);
    for (const value of ['Confirmed', 'confirmed?', 'confirmed.', 'CONFIRMED', 'confirmed (2026-11-20)', 'not confirmed', 'unconfirmed']) {
      const r = guard(dir(), { probes: probesFile(withPb3(`  result: ${value}`)) });
      assert.equal(r.status, 1, `${value}: ${r.stdout}`);
      assert.equal(r.lines[0], `PB-3: result "${value}" is not confirmed`);
      assert.deepEqual(failuresOf(r), [timeLine('/', '5 minutes', P0, `result "${value}" is not confirmed`)]);
    }

    // Unit: the parser.
    const item = (...lines) => ['# Probes', '', '- PB-1 first', '  result: confirmed', '- PB-2 second', '  result: confirmed', ...lines].join('\n');
    const is = (text, confirmed, state) => assert.deepEqual(pb3State(text), { confirmed, state }, JSON.stringify(text));
    is(item(), false, 'no item');
    is(item('- PB-3 third', '  success: x'), false, 'no result');
    is(item('- PB-3 third', '  result: confirmed'), true, 'confirmed');
    is(item('- PB-3', '  result: confirmed'), true, 'confirmed');
    is(item('- PB-3\tthird', '  result: failed'), false, 'failed');
    is(item('- PB-3 third', '  result: inconclusive'), false, 'inconclusive');
    is(item('- PB-3 third', '  result: Confirmed'), false, 'result "Confirmed" is not confirmed');
    is(item('- PB-3 third', '  result: confirmed?'), false, 'result "confirmed?" is not confirmed');
    is(item('- PB-3 third', '  result: confirmed', '  result: confirmed'), false, '2 result lines, not confirmed');
    is(item('- PB-3 third', '  result: failed', '  result: confirmed'), false, '2 result lines, not confirmed');
    is(item('- PB-3 third', '  result: confirmed', '- PB-3 again', '  result: confirmed'), false, '2 items, not confirmed');
    is(item('- PB-30 other', '  result: confirmed'), false, 'no item');
    is(item('- PB-3x other', '  result: confirmed'), false, 'no item');
    is(item(' - PB-3 indented', '  result: confirmed'), false, 'no item');
    is(item('<!-- - PB-3 inside a comment -->', '  result: confirmed'), false, 'no item');
    is(item('- PB-3 third', 'result: confirmed'), false, 'no result');
    is(item('- PB-3 third', '', '  result: confirmed'), false, 'no result');
    is(item('- PB-3 third', '  ', '  result: confirmed'), false, 'no result');
    is(item('- PB-3 third', '  Result: confirmed'), false, 'no result');
    is(item('- PB-3 third', '  evidence: result: confirmed'), false, 'no result');
    is(item('- PB-3 third', '  success: ok', '- PB-4 fourth', '  result: confirmed'), false, 'no result');
    is(item('- PB-3 third', '  success: ok', '  result: confirmed', '- PB-4 fourth', '  result: failed'), true, 'confirmed');
    is(item('- PB-3 third', '\tresult: confirmed'), true, 'confirmed');
    is(item('- PB-3 third', '  result:confirmed'), true, 'confirmed');
    is(item('- PB-3 third', '  result:'), false, 'result "" is not confirmed');
    is(item('- PB-3 third', '  result: confirmed # later'), false, 'result "confirmed # later" is not confirmed');
    is(`﻿${item('- PB-3 third', '  result: confirmed')}`, true, 'confirmed');
    is(item('- PB-3 third', '  result: confirmed').replace(/\n/g, '\r\n'), true, 'confirmed');
    is(item('- PB-3 third', '  result: confirmed').replace(/\n/g, '\r'), true, 'confirmed');
    is('- PB-3 only\n  result: confirmed', true, 'confirmed');
    is('\uFEFF- PB-3 only\n  result: confirmed', true, 'confirmed'); // a BOM before an item on the first line
    is('- PB-3 only\n  result: confirmed\n', true, 'confirmed');
    is('', false, 'no item');
    // The state of PB-1 and PB-2 never counts, whatever it holds.
    is(['- PB-1 a', '  result: confirmed', '- PB-2 b', '  result: confirmed', '- PB-3 c'].join('\n'), false, 'no result');
    // The real PROBES file holds the PB-3 item without a result line (AC-9).
    assert.deepEqual(pb3State(readFileSync(join(REPO, 'docs', 'product', 'site', 'PROBES.md'), 'utf8')), { confirmed: false, state: 'no result' });
  });
});

describe('guard run (AC-9, AC-11)', () => {
  it('clean site and the real PROBES file pass and print PB-3: no result', () => {
    const clean = site('site-clean', {}, ['get-started', 'tr']);
    // The default PROBES file is the real one, resolved against the repository and not the working directory; the pin
    // file does not exist, which proves the facts are read only when a get-started page exists.
    const missingPin = join(makeTempDir('proofline-site-guardpin-'), 'no-pin.json');
    const r = guard(clean, { probes: null, pin: missingPin, cache: null, cwd: clean });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.lines[0], 'PB-3: no result');
    assert.deepEqual(r.lines, ['PB-3: no result', SUMMARY(1, 1, 0, 0)]);
    const relative = guard(clean, { probes: null, pin: missingPin, cache: null, cwd: clean, args: ['guards', '.', '--pin', missingPin] });
    assert.equal(relative.status, 0, relative.stdout + relative.stderr);
    // A tree that has the get-started pages needs the facts: a missing pin file is an input error that names the file.
    const needs = guard(site('site-clean'), { probes: null, pin: missingPin, cache: null });
    assert.equal(needs.status, 1);
    assert.ok(needs.lines.length === 1 && needs.lines[0].startsWith(`guards: ${missingPin}`), needs.stdout);
    // The whole fixture site with the real PROBES file and the temp facts passes too.
    const all = guard(site('site-clean'), { probes: null });
    assert.equal(all.status, 0, all.stdout);
    assert.deepEqual(all.lines, ['PB-3: no result', SUMMARY(3, 3, 2, 0)]);
    // Facts are loaded once, and only for a get-started page.
    let loads = 0;
    const loadFacts = () => { loads++; return FACTS; };
    const two = checkGuards({ pages: [{ address: '/', html: html('<p>x</p>') }], probesText: PROBES, loadFacts });
    assert.equal(loads, 0);
    assert.deepEqual(two.failures, []);
    checkGuards({ pages: [{ address: '/get-started/', html: html('<p>x</p>') }, { address: '/tr/baslarken/', html: html('<p>y</p>') }], probesText: PROBES, loadFacts });
    assert.equal(loads, 1);
    assert.throws(() => checkGuards({ pages: [{ address: '/get-started/', html: html('') }], probesText: PROBES, loadFacts: () => { throw new Error('facts: broken'); } }), /facts: broken/);
  });

  it('guards write nothing, name the address in every failure and reject bad usage', () => {
    const dir = site('site-clean', {
      'get-started/index.html': insert('site-clean/get-started/index.html', `${pre('proofline frobnicate')}<p><code data-command>outside after</code></p><p>5 minutes</p>`),
      'tr/baslarken/index.html': insert('site-clean/tr/baslarken/index.html', `${pre('proofline init')}<p>beş dakika</p>`),
      '404.html': html('<p>five-minute</p>'),
      'docs/index.html': html('<p>5 dk</p>'),
    });
    const before = hashTree(dir);
    const r = guard(dir);
    assert.equal(r.status, 1);
    assert.deepEqual(hashTree(dir), before, 'the input tree is unchanged');
    assert.equal(r.lines[0], 'PB-3: no result');
    const failures = failuresOf(r);
    for (const line of failures) assert.match(line, /^\/[^ ]*: /, `a failure line starts with a page address: ${line}`);
    assert.deepEqual(failures, [
      timeLine('/404.html', 'five-minute', P0),
      timeLine('/docs/', '5 dk', P1),
      blockLine('/get-started/', 'proofline frobnicate'),
      spanLine('/get-started/', 'outside after'),
      timeLine('/get-started/', '5 minutes', P0),
      blockLine('/tr/baslarken/', 'proofline init'),
      timeLine('/tr/baslarken/', 'beş dakika', P1),
    ], 'pages in sorted path order; per page the commands, then the spans, then the install-time patterns');
    assert.equal(r.lines.at(-1), SUMMARY(5, 5, 2, 7));
    assert.equal(r.stderr, '');
    // Usage: exit 2, the usage on stderr, nothing on stdout.
    for (const args of [['guards'], ['guards', '--probes', PROBES_FIXTURE], ['guards', dir, '--bogus', 'x'], ['guards', dir, '--probes'], ['guards', dir, '--pin', pins().pinFile, '--cache'], ['guards', dir, 'extra'], ['guards', dir, '--probes', '--pin', 'x'], ['guards', dir, '--probes', '--cache']]) {
      const u = guard(dir, { args });
      assert.equal(u.status, 2, `${args.join(' ')}: ${u.stdout}`);
      assert.equal(u.stdout, '');
      assert.match(u.stderr, /^usage: check-dist\.mjs links <dir> \| compare <a> <b> \| determinism \| guards <dir> \[--probes <file>\] \[--pin <file>\] \[--cache <dir>\]\n$/);
    }
    // Input errors: exit 1 and a line that names the problem.
    const empty = guard(makeTempDir('proofline-site-guardempty-'));
    assert.equal(empty.status, 1);
    assert.equal(empty.lines.length, 1);
    assert.match(empty.lines[0], /^guards: no HTML page under .+proofline-site-guardempty-/);
    const textOnly = makeTempDir('proofline-site-guardtext-');
    writeFileSync(join(textOnly, 'robots.txt'), 'User-agent: *\n');
    assert.equal(guard(textOnly).status, 1);
    const missing = join(makeTempDir('proofline-site-guardempty-'), 'nope');
    assert.equal(guard(missing).status, 1);
    // A regular file given as the tree is an input error with a line, not a crash.
    const notDir = guard(PROBES_FIXTURE);
    assert.equal(notDir.status, 1);
    assert.deepEqual(notDir.lines, [`guards: no HTML page under ${PROBES_FIXTURE}`]);
    const noProbes = join(makeTempDir('proofline-site-guardempty-'), 'PROBES.md');
    const unreadable = guard(site('site-mixed'), { probes: noProbes });
    assert.equal(unreadable.status, 1);
    assert.deepEqual(unreadable.lines, [`guards: ${noProbes}: cannot be read (ENOENT)`]);
    const noFacts = guard(site('site-clean'), { cache: join(makeTempDir('proofline-site-guardempty-'), 'cache') });
    assert.equal(noFacts.status, 1);
    assert.equal(noFacts.lines.length, 1);
    assert.match(noFacts.lines[0], /^guards: README\.md: cannot be read from the cache folder /);
    // The other modes keep their usage.
    const other = spawnSync(process.execPath, [CLI, 'nothing'], { cwd: REPO, encoding: 'utf8' });
    assert.equal(other.status, 2);
    assert.match(other.stderr, /guards <dir>/);
    // package.json: the guard is the last step of the build, and check:guards runs it on dist.
    const scripts = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts;
    assert.equal(scripts['check:guards'], 'node scripts/check-dist.mjs guards dist');
    assert.equal(scripts.build, 'node scripts/sync.mjs fetch && astro build && node scripts/check-dist.mjs guards dist');
  });
});

/**
 * A temp project that holds a copy of the scripts (its own repository root, which the defaults of mode `guards` resolve
 * against) with the PROBES file, the pin and the sync cache at their default places; `without` leaves one of them out.
 */
function project({ probes = confirmedProbes, without = [] } = {}) {
  const dir = realpathSync(makeTempDir('proofline-site-guardproj-')); // the script runs as main only under its real path
  cpSync(join(REPO, 'scripts'), join(dir, 'scripts'), { recursive: true });
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  const where = {
    probes: join(dir, 'docs', 'product', 'site', 'PROBES.md'),
    pin: join(dir, 'sync', 'pin.json'),
    cache: join(dir, '.cache', 'sync'),
  };
  if (!without.includes('probes')) { mkdirSync(dirname(where.probes), { recursive: true }); writeFileSync(where.probes, probes); }
  if (!without.includes('pin')) { mkdirSync(dirname(where.pin), { recursive: true }); writeFileSync(where.pin, JSON.stringify({ commit: COMMIT, tag: 'v0.0.171' })); }
  if (!without.includes('cache')) cpSync(PIN_FIXTURES, join(where.cache, COMMIT), { recursive: true });
  return { dir, cli: join(dir, 'scripts', 'check-dist.mjs'), where };
}
/** Run the copied script of a project over a tree with the given arguments, from a working directory that holds nothing. */
const inProject = (proj, args, cwd = makeTempDir('proofline-site-guardcwd-')) => guard('unused', { args, cli: proj.cli, cwd });

describe('guards arguments (AC-9, AC-11)', () => {
  it('the defaults of mode guards are the repository PROBES file, pin and cache and each is read', () => {
    const tree = site('site-clean');
    const ok = inProject(project(), ['guards', tree]);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    // The state line comes from the default PROBES file of the project, which holds a confirmed result.
    assert.deepEqual(ok.lines, ['PB-3: confirmed', SUMMARY(3, 3, 2, 0)]);
    // A default left out is named in the input error, at the place the project is expected to hold it.
    const noProbes = project({ without: ['probes'] });
    const a = inProject(noProbes, ['guards', tree]);
    assert.equal(a.status, 1);
    assert.deepEqual(a.lines, [`guards: ${join(noProbes.dir, 'docs', 'product', 'site', 'PROBES.md')}: cannot be read (ENOENT)`]);
    const noPin = project({ without: ['pin'] });
    const b = inProject(noPin, ['guards', tree]);
    assert.equal(b.status, 1);
    assert.deepEqual(b.lines, [`guards: ${join(noPin.dir, 'sync', 'pin.json')}: cannot be read (ENOENT)`]);
    const noCache = project({ without: ['cache'] });
    const c = inProject(noCache, ['guards', tree]);
    assert.equal(c.status, 1);
    assert.equal(c.lines.length, 1);
    assert.ok(c.lines[0].startsWith(`guards: README.md: cannot be read from the cache folder ${join(noCache.dir, '.cache', 'sync', COMMIT)} (ENOENT)`), c.stdout);
    // A project without get-started pages needs only the PROBES file: the pin and the cache are not read.
    const lazy = inProject(project({ without: ['pin', 'cache'] }), ['guards', site('site-clean', {}, ['get-started', 'tr'])]);
    assert.equal(lazy.status, 0, lazy.stdout);
    assert.deepEqual(lazy.lines, ['PB-3: confirmed', SUMMARY(1, 1, 0, 0)]);
  });

  it('each option replaces its own default only, and a relative option is resolved against the working directory', () => {
    const tree = site('site-clean');
    const proj = project();
    const missing = join(makeTempDir('proofline-site-guardempty-'), 'nothing');
    // The default of the two other options stays: only the option given is wrong, and only it is named.
    const probes = inProject(proj, ['guards', tree, '--probes', missing]);
    assert.equal(probes.status, 1);
    assert.deepEqual(probes.lines, [`guards: ${missing}: cannot be read (ENOENT)`]);
    const pin = inProject(proj, ['guards', tree, '--pin', missing]);
    assert.equal(pin.status, 1);
    assert.deepEqual(pin.lines, [`guards: ${missing}: cannot be read (ENOENT)`]);
    const cache = inProject(proj, ['guards', tree, '--cache', missing]);
    assert.equal(cache.status, 1);
    assert.ok(cache.lines.length === 1 && cache.lines[0].startsWith(`guards: README.md: cannot be read from the cache folder ${join(missing, COMMIT)} (ENOENT)`), cache.stdout);
    // The option wins over a default that is wrong: a project with none of the three defaults and all three options.
    const bare = project({ without: ['probes', 'pin', 'cache'] });
    const given = inProject(bare, ['guards', tree, '--probes', PROBES_FIXTURE, '--pin', pins().pinFile, '--cache', pins().cacheRoot]);
    assert.equal(given.status, 0, given.stdout);
    assert.deepEqual(given.lines, ['PB-3: no result', SUMMARY(3, 3, 2, 0)]);
    // Options may come before the directory.
    const before = inProject(bare, ['guards', '--probes', PROBES_FIXTURE, '--pin', pins().pinFile, '--cache', pins().cacheRoot, tree]);
    assert.equal(before.status, 0, before.stdout);
    assert.deepEqual(before.lines, given.lines);
    // A relative option and a relative directory are resolved against the working directory, not the repository.
    const cwd = makeTempDir('proofline-site-guardcwd-');
    writeFileSync(join(cwd, 'probes.md'), PROBES);
    cpSync(pins().pinFile, join(cwd, 'pin.json'));
    cpSync(pins().cacheRoot, join(cwd, 'cache'), { recursive: true });
    cpSync(tree, join(cwd, 'tree'), { recursive: true });
    const relative = inProject(bare, ['guards', 'tree', '--probes', 'probes.md', '--pin', 'pin.json', '--cache', 'cache'], cwd);
    assert.equal(relative.status, 0, relative.stdout);
    assert.deepEqual(relative.lines, given.lines);
  });

  const USAGE = /^usage: check-dist\.mjs links <dir> \| compare <a> <b> \| determinism \| guards <dir> \[--probes <file>\] \[--pin <file>\] \[--cache <dir>\]\n$/;
  /** Every argument list must exit 2, print nothing on stdout and print the usage line on stderr. */
  const expectUsage = (dir, name, list) => {
    for (const args of list) {
      const u = guard(dir, { args });
      assert.equal(u.status, 2, `${name}: ${args.join(' ')}: ${u.stdout}`);
      assert.equal(u.stdout, '', `${name}: ${args.join(' ')}`);
      assert.match(u.stderr, USAGE, `${name}: ${args.join(' ')}`);
    }
  };

  // The bad option lists are split over several small tests so that each one stays well inside the unit budget.
  it('a bad option list exits 2 with the usage and nothing on stdout', () => {
    const dir = site('site-clean');
    const { pinFile, cacheRoot } = pins();
    expectUsage(dir, 'an option given twice', [['guards', dir, '--probes', PROBES_FIXTURE, '--probes', PROBES_FIXTURE], ['guards', dir, '--pin', pinFile, '--pin', pinFile], ['guards', dir, '--cache', cacheRoot, '--cache', cacheRoot], ['guards', '--cache', cacheRoot, dir, '--cache', cacheRoot], ['guards', dir, '--probes', PROBES_FIXTURE, '--pin', pinFile, '--probes', 'other.md']]);
  });

  it('a bad option list exits 2 with the usage and nothing on stdout: an option without a value', () => {
    const dir = site('site-clean');
    expectUsage(dir, 'an option without a value', [['guards', dir, '--probes'], ['guards', dir, '--pin'], ['guards', dir, '--cache'], ['guards', '--pin', dir]]);
  });

  it('a bad option list exits 2 with the usage and nothing on stdout: an option as the value of an option', () => {
    const dir = site('site-clean');
    const { pinFile } = pins();
    expectUsage(dir, 'an option as the value of an option', [['guards', dir, '--probes', '--pin', pinFile], ['guards', dir, '--pin', '--probes', PROBES_FIXTURE], ['guards', dir, '--cache', '--pin', pinFile], ['guards', dir, '--cache', '--']]);
  });

  it('a bad option list exits 2 with the usage and nothing on stdout: an unknown option', () => {
    const dir = site('site-clean');
    expectUsage(dir, 'an unknown option', [['guards', dir, '--bogus', 'x'], ['guards', dir, '--probe', PROBES_FIXTURE], ['guards', dir, '--Probes', PROBES_FIXTURE], ['guards', dir, '--']]);
  });

  it('a bad option list exits 2 with the usage and nothing on stdout: an extra positional argument', () => {
    const dir = site('site-clean');
    expectUsage(dir, 'an extra positional argument', [['guards', dir, 'extra'], ['guards', 'extra', dir], ['guards', dir, dir], ['guards', dir, '--probes', PROBES_FIXTURE, 'extra']]);
  });

  it('a bad option list exits 2 with the usage and nothing on stdout: a missing directory', () => {
    const dir = site('site-clean');
    const { pinFile, cacheRoot } = pins();
    expectUsage(dir, 'a missing directory', [['guards'], ['guards', '--probes', PROBES_FIXTURE], ['guards', '--probes', PROBES_FIXTURE, '--pin', pinFile, '--cache', cacheRoot]]);
  });

  it('a bad option list exits 2 with the usage and nothing on stdout: a one-dash argument after the directory', () => {
    const dir = site('site-clean');
    expectUsage(dir, 'a one-dash argument after the directory', [['guards', dir, '-x'], ['guards', dir, '-p', PROBES_FIXTURE]]);
  });

  it('a one-dash argument is a directory or a value, and a good option list is accepted in any order', () => {
    const dir = site('site-clean');
    const { pinFile, cacheRoot } = pins();
    // Observed: a one-dash argument is not an option. As the only positional argument it is the directory (an input error,
    // exit 1), and as the value of an option it is the value.
    const dash = guard(dir, { args: ['guards', '-x'] });
    assert.equal(dash.status, 1);
    assert.deepEqual(dash.lines, ['guards: no HTML page under -x']);
    const valued = guard(dir, { args: ['guards', dir, '--probes', '-x', '--pin', pinFile, '--cache', cacheRoot] });
    assert.equal(valued.status, 1);
    assert.deepEqual(valued.lines, [`guards: ${join(REPO, '-x')}: cannot be read (ENOENT)`]);
    // A good list is accepted in any order of the options.
    const ok = guard(dir, { args: ['guards', '--cache', cacheRoot, '--probes', PROBES_FIXTURE, dir, '--pin', pinFile] });
    assert.equal(ok.status, 0, ok.stdout);
  });
});

describe('get-started command comparison rules (AC-1, AC-4)', () => {
  const cmd = (markup) => lib('/get-started/', html(markup)).failures;
  const ok = '/plugin install proofline@proofline';
  const span = 'npx skills add furkansarikaya/proofline';

  it('a pre element is compared with and without a code child, line by line', () => {
    // Bare pre (no code child), a pre with a code child, and a pre with other markup inside.
    assert.deepEqual(cmd('<pre>proofline frobnicate</pre>'), [blockLine('/get-started/', 'proofline frobnicate')]);
    assert.deepEqual(cmd('<pre><code>proofline frobnicate</code></pre>'), [blockLine('/get-started/', 'proofline frobnicate')]);
    assert.deepEqual(cmd('<pre><b>proofline</b> frobnicate</pre>'), [blockLine('/get-started/', 'proofline frobnicate')]);
    assert.deepEqual(cmd(`<pre>${ok}</pre>`), []);
    assert.deepEqual(cmd(`<pre><code>${ok}</code></pre>`), []);
    assert.deepEqual(cmd('<pre>\n  /plugin install proofline@proofline   # note\n</pre>'), []);
    // Both kinds on one page, in page order; the unmarked code outside a pre is prose.
    assert.deepEqual(cmd('<pre>bare-bad</pre><p><code>prose-bad</code></p><pre><code>code-bad</code></pre>'), [blockLine('/get-started/', 'bare-bad'), blockLine('/get-started/', 'code-bad')]);
    // Blank lines and lines that start with "#" are skipped, in a bare pre as in a pre with code, and the rest is compared.
    assert.deepEqual(cmd(`<pre>\n\n   \n# comment\n  # indented comment\n${ok}\nbare-bad\n</pre>`), [blockLine('/get-started/', 'bare-bad')]);
    assert.deepEqual(cmd(`<pre><code>\n\n   \n# comment\n  # indented comment\n${ok}\ncode-bad\n</code></pre>`), [blockLine('/get-started/', 'code-bad')]);
    assert.deepEqual(cmd('<pre></pre><pre><code></code></pre><pre>   </pre>'), []);
    // Lines end with LF, CRLF or a lone CR (a carriage return written as a character reference survives the parser).
    assert.deepEqual(cmd(`<pre>${ok}&#13;&#10;bad-crlf&#13;bad-cr\n${ok}</pre>`), [blockLine('/get-started/', 'bad-crlf'), blockLine('/get-started/', 'bad-cr')]);
    // A "#" line is skipped, but a line with a "#" later in it is compared.
    assert.deepEqual(cmd('<pre>x # y</pre>'), [blockLine('/get-started/', 'x # y')]);
    // Through the program too: a bare pre on a get-started page of the tree.
    const r = guard(site('site-clean', { 'get-started/index.html': insert('site-clean/get-started/index.html', '<pre>proofline frobnicate</pre>') }));
    assert.equal(r.status, 1);
    assert.deepEqual(failuresOf(r), [blockLine('/get-started/', 'proofline frobnicate')]);
  });

  // The line filter of a block, one named test per rule, each over a bare pre and a pre with a code child. Each page holds the
  // README command `ok` and the line under test; a failure line names the line, so a wrongly kept or dropped line shows at once.
  const blocks = (text) => [['a bare pre', `<pre>${text}</pre>`], ['a pre with a code child', `<pre><code>${text}</code></pre>`]];
  const everyBlock = (lines, expected) => {
    for (const [kind, markup] of blocks(`\n${lines.join('\n')}\n`)) assert.deepEqual(cmd(markup), expected, `${kind}: ${JSON.stringify(lines)}`);
  };

  it('a block line that starts with a hash is skipped whether or not a space follows the hash', () => {
    for (const comment of ['#note', '# note', '#', '##note', '#!note', '#\tnote', '#' + ok]) {
      everyBlock([comment, ok], []);
      everyBlock([comment, 'bad-line'], [blockLine('/get-started/', 'bad-line')]);
    }
  });

  it('an indented comment line in a block is skipped whether or not a space follows the hash', () => {
    for (const comment of ['  #note', '  # note', '\t#note', '\t# note', ' \t #note', '    #']) {
      everyBlock([comment, ok], []);
      everyBlock([comment, 'bad-line'], [blockLine('/get-started/', 'bad-line')]);
    }
  });

  it('blank and white-space-only block lines are skipped and the next line is still compared', () => {
    for (const blank of ['', ' ', '   ', '\t', ' \t ', ' ']) {
      everyBlock([blank, ok, blank], []);
      everyBlock([blank, 'bad-line', blank], [blockLine('/get-started/', 'bad-line')]);
    }
  });

  it('a block command line with a trailing comment keeps its command part and a bad command keeps its comment in the failure', () => {
    for (const trailing of [`${ok} #note`, `${ok}   # note`, `${ok}\t#note`, `  ${ok} # note  `]) everyBlock([trailing], []);
    everyBlock(['bad-line #note'], [blockLine('/get-started/', 'bad-line #note')]);
    everyBlock(['  bad-line   # note  '], [blockLine('/get-started/', 'bad-line   # note')]);
  });

  it('a block line that only contains a hash is not skipped and is compared whole', () => {
    for (const line of ['x#y', 'x # y', 'bad-line#', 'bad-line #', `${ok}#tag`, 'a#', 'a #']) {
      everyBlock([ok, line], [blockLine('/get-started/', line)]);
    }
  });

  it('a data-command element is compared whatever its attribute value, and an element without the attribute is prose', () => {
    // Empty value, no value, a value: each is a marked span, a README span passes and a bad one fails naming the span.
    for (const attribute of ['data-command', 'data-command=""', 'data-command="x"', 'data-command="npx"', "data-command='true'", 'DATA-COMMAND="x"']) {
      assert.deepEqual(cmd(`<code ${attribute}>${span}</code>`), [], attribute);
      assert.deepEqual(cmd(`<code ${attribute}>proofline frobnicate</code>`), [spanLine('/get-started/', 'proofline frobnicate')], attribute);
      assert.deepEqual(cmd(`<kbd ${attribute}>  proofline\n  frobnicate </kbd>`), [spanLine('/get-started/', 'proofline frobnicate')], attribute);
    }
    // Through the program, with a valued attribute.
    const r = guard(site('site-clean', { 'get-started/index.html': insert('site-clean/get-started/index.html', '<p><code data-command="install">proofline frobnicate</code></p>') }));
    assert.equal(r.status, 1);
    assert.deepEqual(failuresOf(r), [spanLine('/get-started/', 'proofline frobnicate')]);
    // Prose: no attribute, or another attribute that only looks like it.
    for (const attributes of ['', 'class="data-command"', 'data-commands="x"', 'data-command-x="x"', 'data-cmd="x"', 'title="data-command"', 'id="data-command"']) {
      assert.deepEqual(cmd(`<p><code ${attributes}>proofline frobnicate</code> <span ${attributes}>other prose</span></p>`), [], attributes);
    }
    // A marked element with no text is a span with the empty text, which is not a README span.
    assert.deepEqual(cmd('<code data-command></code>'), [spanLine('/get-started/', '')]);
    // Several spans, in page order, each named once.
    assert.deepEqual(cmd(`<code data-command="a">bad-one</code> <code data-command>${span}</code> <b data-command="">bad-two</b>`), [spanLine('/get-started/', 'bad-one'), spanLine('/get-started/', 'bad-two')]);
  });

  it('a data-command element inside a pre is read as part of the block lines and never as a span', () => {
    // A bad line of the block is one failure, a block line and not a span line.
    assert.deepEqual(cmd('<pre><span data-command>proofline frobnicate</span></pre>'), [blockLine('/get-started/', 'proofline frobnicate')]);
    assert.deepEqual(cmd('<pre><code data-command="x">proofline frobnicate</code></pre>'), [blockLine('/get-started/', 'proofline frobnicate')]);
    assert.deepEqual(cmd('<pre data-command>proofline frobnicate</pre>'), [blockLine('/get-started/', 'proofline frobnicate')]);
    // A README command inside a pre is not a README span: it passes as a line and does not fail as a span.
    assert.deepEqual(cmd(`<pre><span data-command>${ok}</span></pre>`), []);
    assert.deepEqual(cmd(`<pre><code data-command="">${ok}</code></pre>`), []);
    assert.deepEqual(cmd(`<pre data-command="y">${ok}</pre>`), []);
    // A README span inside a pre is not a README command: it fails as a line only.
    assert.deepEqual(cmd(`<pre><span data-command>${span}</span></pre>`), [blockLine('/get-started/', span)]);
    // The element after the pre is a span again.
    assert.deepEqual(cmd(`<pre>${ok}</pre><code data-command>proofline frobnicate</code>`), [spanLine('/get-started/', 'proofline frobnicate')]);
  });
});

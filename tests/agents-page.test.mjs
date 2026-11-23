// Node tests for the Claude Code and Codex page in English and Turkish (TASK-023).
// The `before` hook fetches the pinned documents, builds the real site once into a folder of its own under .cache (never dist/, never the shared .tmp), opens one Vite server
// for the Astro container (which renders the page files and AgentsPage.astro with fixture pin facts), and builds two copies of the site from fixture roots (one with the Codex
// sentence in the README, one without it). Every test only reads what the hooks produced, so the per-test budgets measure assertions only. Pin-derived text is compared with the
// facts the pinned documents give; no README sentence or line is read from the code under test. The render helpers and the fixture-root helpers are test-local (copied from
// the get-started tests): the page files and the component are loaded through the Vite server of this file.
import { after, before, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { load } from 'cheerio';
import { createServer } from 'vite';
import YAML from 'yaml';
import { INSTALL_TIME_PATTERNS, checkGuards, pb3State } from '../scripts/lib/guards.mjs';
import { readPinFacts } from '../scripts/lib/pin-facts.mjs';
import { AGENTS_PAGE, BOTH_SPAN, TEXT_KEYS, TURKISH_KEYS, agentsFacts, keysOf, readAgentsContent } from '../src/lib/agents.ts';
import { CLAUDE_LINES, CODEX_LINES, GET_STARTED_PAGE, pinnedLines, pinnedSpan } from '../src/lib/get-started.ts';
import { ENV_KEYS } from '../src/lib/indexing.ts';
import { ORIGIN } from '../src/lib/meta.ts';
import { PAIRS, alternates, contentHash, isStale, switcherTarget } from '../src/lib/translations.ts';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
sweepStale();

// ---- the strings of the TASK-023 Context, written out here and never read from the code under test --------------------------------------------------------

const PAGES = [['en', 'claude-code-and-codex/index.html', '/claude-code-and-codex/'], ['tr', 'tr/claude-code-ve-codex/index.html', '/tr/claude-code-ve-codex/']];
const GET_STARTED = { en: '/get-started/', tr: '/tr/baslarken/' };
const PHRASE = {
  en: 'proofline: a deterministic engineering team for Claude Code and Codex',
  tr: 'proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi',
};
const H1 = { en: 'Claude Code and Codex', tr: 'Claude Code ve Codex' };
const TITLE = { en: `Claude Code and Codex | ${PHRASE.en}`, tr: `Claude Code ve Codex | ${PHRASE.tr}` };
const CLAUDE = ['/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline'];
const CODEX = ['git clone https://github.com/furkansarikaya/proofline', 'node proofline/adapters/codex/install.mjs'];
const BOTH = 'proofline init --role implementer=codex';
const HEADINGS = { en: ['Claude Code', 'Codex', 'Both together'], tr: ['Claude Code', 'Codex', 'İkisi birlikte'] };
const LINK_TEXT = { en: 'Get started', tr: 'Başlarken' };
const TR_SENTENCE = 'Codex, implementer olarak desteklenir; diğer Codex rolleri gerçek kullanımda henüz doğrulanmadı.';
// The pattern of the pin facts reader for the Codex sentence, as it appears in its error message.
const PATTERN = String.raw`Codex as implementer is supported \([^)]*\); other Codex roles are not yet verified in real use\.`;
const NOT_FOUND = 'README.md: sentence not found in the section "## Status": ';
const RANGE = 'README.md between "## Install" and "## What it supports"';
const FIXTURE_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const OTHER_COMMIT = '89abcdef0123456789abcdef0123456789abcdef';
// The source link of the Codex limit (TASK-023 fix round 1): the Status section of the README of the proofline repository at the pinned commit, written out here.
const REPO = 'https://github.com/furkansarikaya/proofline';
const SOURCE_TEXT = { en: 'Source: README, Status', tr: 'Kaynak: README, Durum bölümü' };
const FIXTURE_ROOT_FILES = { readme: 'tests/fixtures/launch/README.pin.md', proof: 'tests/fixtures/pin-facts/docs/proof.md', workflow: 'tests/fixtures/pin-facts/docs/concepts/workflow.md' };
const CONTENT_FILE = { en: 'src/content/pages/en/claude-code-and-codex.md', tr: 'src/content/pages/tr/claude-code-ve-codex.md' };
const PAGE_FILE = { en: 'src/pages/claude-code-and-codex/index.astro', tr: 'src/pages/tr/claude-code-ve-codex/index.astro' };
const COMPONENT = 'src/components/marketing/AgentsPage.astro';
const OTHER_DATES = '(real use, 2026-11-01 to 02)';

const squash = (text) => text.replace(/\s+/g, ' ').trim();
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const normalise = (line) => line.replace(/\s+#.*$/, '').trim();

/**
 * The lines of the text of a command block that no README command equals, as the guard of TASK-020 prints them (the line trimmed, a trailing comment kept). The rule is the one of
 * the guard: lines end at LF, CR or CRLF; a line that is empty after the trim or starts with a comment sign is skipped; any other line must equal a README command once a
 * trailing comment (a comment sign after white space) is cut from both sides.
 */
function unknownLines(text, commands) {
  const known = new Set(commands.map(normalise));
  return text.split(/\r\n|\r|\n/).map((raw) => raw.trim()).filter((line) => line !== '' && !line.startsWith('#') && !known.has(normalise(line)));
}

/** The frontmatter of a content file as the page imports it. */
function frontmatterOf(lang) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(read(CONTENT_FILE[lang]));
  assert.ok(match, `${CONTENT_FILE[lang]} starts with a frontmatter block`);
  return YAML.parse(match[1]);
}

/** The leaf key paths of a parsed frontmatter. */
const leaves = (value, prefix = '') => Object.entries(value).flatMap(([k, v]) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const get = (object, key) => key.split('.').reduce((v, k) => v[k], object);

/** The pin facts of a fixture root, read by the module of the pin facts itself. */
const factsOf = (dir) => readPinFacts(join(dir, 'sync', 'pin.json'), join(dir, '.cache', 'sync'));

/**
 * A repository root holding sync/pin.json and the cached documents, from the existing fixtures. `readmeWithout` drops every README line that holds the text, `readmeReplace`
 * (`[from, to]`) replaces a text of the README, `commit` is the pinned commit of the archive, and `english` (when not null) is written as the English content file, where the translation stamp of the Turkish page looks for it.
 */
function fixtureRoot({ readmeWithout = null, readmeReplace = null, english = null, commit = FIXTURE_COMMIT } = {}) {
  const dir = makeTempDir('proofline-site-agents-');
  const cache = join(dir, '.cache', 'sync', commit);
  for (const [key, rel] of [['readme', 'README.md'], ['proof', 'docs/proof.md'], ['workflow', 'docs/concepts/workflow.md']]) {
    mkdirSync(dirname(join(cache, rel)), { recursive: true });
    let text = read(FIXTURE_ROOT_FILES[key]);
    if (key === 'readme' && readmeWithout !== null) text = text.split('\n').filter((line) => !line.includes(readmeWithout)).join('\n');
    if (key === 'readme' && readmeReplace !== null) {
      assert.ok(text.includes(readmeReplace[0]), `the fixture README holds "${readmeReplace[0]}"`);
      text = text.replace(readmeReplace[0], readmeReplace[1]);
    }
    writeFileSync(join(cache, rel), text);
  }
  mkdirSync(join(dir, 'sync'), { recursive: true });
  writeFileSync(join(dir, 'sync', 'pin.json'), JSON.stringify({ commit, tag: null }));
  if (english !== null) {
    mkdirSync(join(dir, dirname(CONTENT_FILE.en)), { recursive: true });
    writeFileSync(join(dir, CONTENT_FILE.en), english);
  }
  return dir;
}

/** A fixture root that is also a copy of the site (sources, public files, scripts, configuration and a link to node_modules), so `astro build` can run in it. */
function buildableRoot(options) {
  const dir = fixtureRoot(options);
  for (const name of ['src', 'public', 'scripts']) cpSync(join(root, name), join(dir, name), { recursive: true });
  for (const name of ['astro.config.mjs', 'package.json']) cpSync(join(root, name), join(dir, name));
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
  return dir;
}

/** The environment of an indexable build: the inherited one without the indexing variables, VERCEL_ENV=production. */
function productionEnv() {
  const env = { ...process.env };
  for (const key of ENV_KEYS) delete env[key];
  env.VERCEL_ENV = 'production';
  return env;
}

/** `astro build` in `cwd` into `outDir`; the status and the whole output. */
function astroBuild(cwd, outDir) {
  const r = spawnSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build', '--outDir', outDir], { cwd, encoding: 'utf8', env: productionEnv(), timeout: 120000 });
  return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** The lines of a `pre` element, one per line, as the page prints them. */
const linesOf = ($, pre) => $(pre).text().split('\n');

/** The parts of the page: the heading text and the elements they hold. */
const sectionsOf = ($) => $('.gs section').toArray().map((el) => ({ heading: squash($(el).find('h2').first().text()), el: $(el) }));

/** The text of a page with the content of the elements that match `selector` removed. */
function textWithout($, selector) {
  const copy = load($.html($('main')), null, false);
  copy(selector).remove();
  return squash(copy.root().text());
}

/** The texts a reader or a crawler can take a claim from: the title, every meta text, the text-bearing attributes and the body text. `$` must be a whole document, or the body is empty. */
function everyText($) {
  const attributes = $('[aria-label], [title], img[alt]').toArray().flatMap((el) => [el.attribs['aria-label'], el.attribs.title, el.attribs.alt].filter((value) => value !== undefined));
  const metas = $('meta[content]').toArray().map((el) => el.attribs.content);
  // The body text twice: as the text nodes join (so a claim cannot hide between two elements) and with a space after every element (so a word at the edge of an element stays a word).
  const spaced = load($.html());
  spaced('body *').after(' ');
  return [$('title').text(), $('meta[name="description"]').attr('content') ?? '', $('meta[property="og:description"]').attr('content') ?? '', ...metas, ...attributes, squash($('body').text()), squash(spaced('body').text())];
}

/** Duration problems of a text, by the rules of the install-time guard that go further: a number and a unit of time, and a sentence about installing that gives a duration. */
const NUMBER_EN = '\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty';
const NUMBER_TR = '\\d+|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk';
const UNIT_PATTERNS = [
  new RegExp(`(?<![\\p{L}\\d])(${NUMBER_EN})[ -]?(seconds?|secs?|minutes?|mins?|hours?|hrs?)(?![\\p{L}])`, 'iu'),
  new RegExp(`(?<![\\p{L}\\d])(${NUMBER_TR})[ -]?(saniye|sn|dakika|dk|saat)(?![\\p{L}])`, 'iu'),
];
function durationProblems(text) {
  const problems = [];
  for (const pattern of UNIT_PATTERNS) {
    const match = pattern.exec(text);
    if (match) problems.push(`number and unit of time: "${match[0]}"`);
  }
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (/install|kurul/i.test(sentence) && /(seconds?|minutes?|hours?|saniye|dakika|saat)(?![\p{L}])/iu.test(sentence)) problems.push(`duration sentence about installing: "${sentence}"`);
  }
  return problems;
}

/**
 * The words that claim a verification, support for every role, full support or the same support as Claude Code, in English and in Turkish; run on every text outside the limit
 * sentence and its translation. Families: verification, every or all roles, support, production readiness, parity.
 */
const CLAIMS = [
  // verification
  /verif/i, /\bproven\b/i, /\bvalidated\b/i, /\bcertified\b/i, /doğrula/i, /kanıtlan/i,
  // every role, everywhere
  /works? everywhere/i, /\ball roles\b/i, /\bevery role\b/i, /\bany role\b/i, /\bother roles\b/i, /\bher rol/i, /\btüm roller/i, /\bbütün roller/i, /\bdiğer roller/i, /\bherhangi bir rol/i,
  // support
  /\bsupport/i, /\bfull(y)?[- ]support/i, /destekle/i, /\bdestek/i, /\btam destek/i,
  // production readiness
  /production[- ]ready/i, /üretime hazır/i,
  // parity with Claude Code
  /\b(works?|runs?|behaves?|performs?)\s+(exactly\s+|just\s+)?(the\s+)?same\b/i, /\bsame (as|level|support|way)\b/i, /\bequal(ly)?\b/i, /\bparity\b/i, /\bon par\b/i, /\bidentical(ly)?\b/i,
  /\bno difference\b/i, /\bjust as (well|good)\b/i, /\baynı (şekilde|biçimde|düzeyde|seviyede|destek|çalış)/i, /\beşit/i, /\beşdeğer/i, /\bbirebir/i, /\bdenk/i, /\bfark yok/i, /\btam uyum/i,
];
/** One claim of each form, in each language; the scan must find every one of them. */
const CLAIM_FORMS = [
  'Codex is verified for every role.', 'Verification of Codex is done.', 'The Codex roles are proven.', 'Codex was validated.', 'Codex is certified.',
  'Codex works everywhere.', 'All roles run on Codex.', 'Every role works on Codex.', 'Codex runs any role.', 'Codex also runs the other roles.',
  'Codex supports every role.', 'Codex is supported.', 'Codex is fully supported.', 'Full support for Codex.',
  'It is production-ready.', 'It is production ready.',
  'Codex works the same as Claude Code.', 'Codex runs exactly the same way.', 'Codex has the same support.', 'Codex has equal footing.', 'Both are equally good.', 'Codex is on par with Claude Code.',
  'There is feature parity.', 'The two are identical.', 'There is no difference between them.', 'Codex works just as well.', 'CODEX IS VERIFIED.', 'CODEX WORKS THE SAME.',
  'Tüm roller doğrulandı.', 'Codex tüm rollerde doğrulandı.', 'Bütün roller doğrulandı.', 'Codex kanıtlandı.', 'CODEX TÜM ROLLERDE DOĞRULANDI.',
  'Her rol çalışır.', 'Codex her rolü çalıştırır.', 'Diğer roller de çalışır.', 'Herhangi bir rol çalışır.',
  'Codex desteklenir.', 'Codex tam destek verir.', 'Destek vardır.',
  'Üretime hazırdır.',
  'Codex, Claude Code ile aynı şekilde çalışır.', 'Codex aynı düzeyde çalışır.', 'İkisi eşit destek sunar.', 'İkisi eşittir.', 'Birebir aynı çalışır.', 'Aradaki fark yok.', 'İkisi denktir.', 'Codex tam uyumludur.',
];
const claimsIn = (text) => CLAIMS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
/** The words around the first claim of a text, for a failure message. */
const claimAt = (text) => {
  for (const pattern of CLAIMS) {
    const found = pattern.exec(text);
    if (found) return text.slice(Math.max(0, found.index - 40), found.index + found[0].length + 40);
  }
  return text.slice(0, 80);
};

/** The elements of a page that can act as a copy control or any other control: a button, an element with a button role, a form field, a disclosure and an element with a click handler or a copy attribute. */
const CONTROLS = 'button, [role="button"], input, select, textarea, summary, label, form, [onclick], [data-copy], [data-clipboard-text], [data-clipboard-target], [contenteditable]';

/** The props of every `<tag ...>` element of an Astro source, one object per element: the name of each prop and its text as written (white space squeezed, quotes and braces kept). */
function propsOf(source, tag) {
  const found = [];
  const open = new RegExp(`<${tag}(?=\\s)`, 'g');
  for (let match = open.exec(source); match !== null; match = open.exec(source)) {
    const props = {};
    let i = match.index + match[0].length;
    for (;;) {
      while (/\s/.test(source[i])) i += 1;
      if (source[i] === '>' || (source[i] === '/' && source[i + 1] === '>')) break;
      const name = /^[\w:-]+/.exec(source.slice(i))?.[0];
      assert.ok(name, `${tag}: a prop name at offset ${i}`);
      i += name.length;
      assert.equal(source[i], '=', `${tag}: ${name} has a value`);
      i += 1;
      const start = i;
      if (source[i] === '"') {
        i = source.indexOf('"', i + 1) + 1;
      } else {
        assert.equal(source[i], '{', `${tag}: ${name} is a string or an expression`);
        for (let depth = 0; ; i += 1) {
          if (source[i] === '{') depth += 1;
          if (source[i] === '}') depth -= 1;
          if (depth === 0) break;
          if (source[i] === "'" || source[i] === '"') i = source.indexOf(source[i], i + 1);
        }
        i += 1;
      }
      props[name] = squash(source.slice(start, i));
    }
    found.push(props);
  }
  return found;
}

// ---- the render helpers (the same shape as tests/fixtures/get-started/render.mjs, kept in this file) ---------------------------------------------------------

/** One production-mode Vite server and one Astro container; the page files and the component are loaded through the server. */
async function openRenderer() {
  const config = await getViteConfig({}, { root, devToolbar: { enabled: false } })({ command: 'serve', mode: 'production' });
  const server = await createServer({ ...config, root, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  const container = await AstroContainer.create();
  return {
    /** The html of the AgentsPage component for a language, with the given pin facts; `content` replaces the content file of the language when given. */
    async renderComponent({ lang, facts, content }) {
      const { default: AgentsPage } = await server.ssrLoadModule(`/${COMPONENT}`);
      const { frontmatter } = await server.ssrLoadModule(`/${CONTENT_FILE[lang]}`);
      return container.renderToString(AgentsPage, { props: { lang, content: content ?? frontmatter, facts } });
    },
    /**
     * The html of the page FILE of a language (it passes its own props to Base and AgentsPage), rendered with `cwd` as the working directory: the pages read the pin facts and the
     * translation stamp from there at build time. Returns the html and the build warnings printed while it rendered; a failing page rejects with its own error.
     */
    async renderPageFile({ lang, cwd }) {
      const { default: Page } = await server.ssrLoadModule(`/${PAGE_FILE[lang]}`);
      const previous = process.cwd();
      const warnings = [];
      const warn = console.warn;
      console.warn = (...args) => { warnings.push(args.join(' ')); };
      process.chdir(cwd);
      try {
        return { html: await container.renderToString(Page), warnings };
      } finally {
        process.chdir(previous);
        console.warn = warn;
      }
    },
    async close() {
      await server[Symbol.for('astro.devServerAppReady')];
      await server.close();
    },
  };
}

// ---- hooks ----------------------------------------------------------------------------------------------------------------------------------------------

const built = { parent: '', outDir: '', status: -1, output: '' };
let renderer;
let realFacts;
let fixtureFacts;
let otherFacts;
let commitFacts;
const html = {};
const pages = {};
const pageRuns = {};
const roots = {};
const siteBuilds = {};

before(async () => {
  // The pinned documents come first: the pages read the pin facts while the build runs.
  const fetched = spawnSync(process.execPath, [join(root, 'scripts', 'sync.mjs'), 'fetch'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(fetched.status, 0, `the fetch of the pinned documents exits 0: ${(fetched.stdout ?? '') + (fetched.stderr ?? '')}`.slice(-400));
  realFacts = readPinFacts(join(root, 'sync', 'pin.json'), join(root, '.cache', 'sync'));

  // An indexable build of the real site; the output folder is inside the repository so Astro does not use the shared .tmp folder.
  mkdirSync(join(root, '.cache'), { recursive: true });
  built.parent = mkdtempSync(join(root, '.cache', 'proofline-agents-'));
  built.outDir = join(built.parent, 'dist');
  const r = astroBuild(root, built.outDir);
  built.status = r.status;
  built.output = r.output;
  if (built.status === 0) {
    for (const [lang, rel] of PAGES) {
      try {
        html[lang] = readFileSync(join(built.outDir, rel), 'utf8');
        pages[lang] = load(html[lang]);
      } catch { /* a page that was not built is reported by page() */ }
    }
  }

  // The fixture roots: the launch README in the shape of the pin, with one thing changed in each of them.
  const englishText = read(CONTENT_FILE.en);
  roots.good = fixtureRoot({ english: englishText });
  roots.other = fixtureRoot({ english: englishText, readmeReplace: ['(real use, 2026-10-23 to 25)', OTHER_DATES] });
  roots.otherCommit = fixtureRoot({ english: englishText, commit: OTHER_COMMIT });
  roots.noSentence = fixtureRoot({ english: englishText, readmeWithout: 'other Codex roles are not yet verified' });
  roots.noNotProven = fixtureRoot({ english: englishText, readmeWithout: 'It is not yet proven on real projects.' });
  roots.noStatus = fixtureRoot({ english: englishText, readmeWithout: '## Status' });
  roots.badClone = fixtureRoot({ english: englishText, readmeWithout: 'git clone ' });
  roots.badSpan = fixtureRoot({ english: englishText, readmeWithout: 'implementer=codex' });
  roots.stale = fixtureRoot({ english: `${englishText}\nA changed line.\n` });
  roots.noEnglish = fixtureRoot();
  fixtureFacts = factsOf(roots.good);
  commitFacts = factsOf(roots.otherCommit);
  otherFacts = factsOf(roots.other);

  // The builds come before the Vite server opens: time spent after it opens is counted into the duration of the first test by the runner.
  // Two builds of the whole site from fixture roots: the README holds the Codex sentence, or it does not.
  for (const [name, options] of [['withSentence', { english: englishText }], ['withoutSentence', { english: englishText, readmeWithout: 'other Codex roles are not yet verified' }]]) {
    const dir = buildableRoot(options);
    siteBuilds[name] = { dir, outDir: join(dir, 'dist'), ...astroBuild(dir, join(dir, 'dist')) };
  }

  renderer = await openRenderer();
  const attempt = async (lang, cwd) => renderer.renderPageFile({ lang, cwd }).then((value) => ({ value }), (error) => ({ error }));
  for (const [name, cwd] of Object.entries(roots).filter(([name]) => !['noNotProven', 'noStatus'].includes(name))) {
    pageRuns[name] = {};
    for (const lang of ['en', 'tr']) pageRuns[name][lang] = await attempt(lang, cwd);
  }

}, { timeout: 400000 });

after(async () => {
  try {
    await renderer?.close();
  } finally {
    if (built.parent !== '') rmSync(built.parent, { recursive: true, force: true });
    removeTempDirs();
  }
});

/** A built page of the language, failing the test when the build did not produce it. */
function page(lang) {
  assert.equal(built.status, 0, `the private build exits 0: ${built.output.slice(-400)}`);
  assert.ok(pages[lang], `${lang} page is built`);
  return pages[lang];
}

/** The page rendered from a fixture root, as a parsed page; fails when the render failed. */
function rendered(name, lang) {
  const run = pageRuns[name][lang];
  assert.equal(run.error, undefined, `${name} ${lang}: the page renders: ${run.error?.message}`);
  return load(run.value.html);
}

/** The language of a label of `forms()`. */
const lang0 = (label) => label.slice(0, 2);

/** The built page and the page rendered from the good fixture root, with the pin facts each of them stands on. */
function forms() {
  return PAGES.flatMap(([lang, , address]) => [
    { label: `${lang} built`, lang, address, $: page(lang), facts: realFacts },
    { label: `${lang} fixture`, lang, address, $: rendered('good', lang), facts: fixtureFacts },
  ]);
}

// ---- the tests ------------------------------------------------------------------------------------------------------------------------------------------

it('agents page: both pages carry the language, one H1 equal to the title and the suffixed title without the evidence word', () => {
  assert.equal(PAGES[0][2], AGENTS_PAGE.en);
  assert.equal(PAGES[1][2], AGENTS_PAGE.tr);
  for (const { label, lang, address, $ } of forms()) {
    assert.equal($('html').attr('lang'), lang, `${label}: the language attribute`);
    assert.equal($('h1').length, 1, `${label}: one H1`);
    assert.equal($('main h1').length, 1, `${label}: the H1 is in main`);
    assert.equal(squash($('h1').text()), H1[lang], `${label}: the H1 text`);
    assert.equal(squash($('h1').text()), frontmatterOf(lang).title, `${label}: the H1 is the title of the content file`);
    assert.equal(Array.from(H1[lang]).length, lang === 'en' ? 21 : 20, `${label}: the title length`);
    assert.equal($('title').text(), TITLE[lang], `${label}: the title is the page title and the suffix`);
    assert.equal($('meta[property="og:title"]').attr('content'), TITLE[lang], `${label}: og:title is the title`);
    for (const text of [$('title').text(), $('meta[property="og:title"]').attr('content'), ...$('h1, h2, h3, h4, h5, h6').toArray().map((el) => $(el).text())]) {
      assert.doesNotMatch(text.toLocaleLowerCase('tr'), /evidence|kan[ıi]t/, `${label}: "${squash(text)}" does not hold the evidence word`);
    }
    // The lead is 70 to 160 characters and the description is built from it, the name and the phrase.
    const lead = frontmatterOf(lang).lead;
    assert.ok(Array.from(lead).length >= 70 && Array.from(lead).length <= 160, `${label}: the lead is ${Array.from(lead).length} characters`);
    const description = $('meta[name="description"]').attr('content') ?? '';
    assert.ok(Array.from(description).length >= 70 && Array.from(description).length <= 160, `${label}: the description is ${Array.from(description).length} characters`);
    assert.equal(description, `${lead} ${PHRASE[lang]}.`, `${label}: the description is the lead and the name with the phrase`);
    assert.deepEqual($('h2').toArray().map((el) => squash($(el).text())), HEADINGS[lang], `${label}: the headings in order`);
    assert.deepEqual($('main h1, main h2, main h3, main h4, main h5, main h6').toArray().map((el) => el.tagName), ['h1', 'h2', 'h2', 'h2'], `${label}: the heading levels do not skip`);
    assert.equal(address, AGENTS_PAGE[lang], `${label}: the address`);
  }
});

it('agents page: the Claude Code, Codex and both-agents parts hold the README lines and the one span in marked English elements', () => {
  assert.deepEqual([...CLAUDE_LINES], CLAUDE);
  assert.deepEqual([...CODEX_LINES], CODEX);
  assert.equal(BOTH_SPAN, BOTH, 'the span constant is the whole README span');
  // The control selector is proved on strings first: each element that could act as a copy control is found in main, wherever it stands, and the plain parts of the page are not.
  for (const control of ['<button>Copy</button>', '<button type="button" class="copy">Copy</button>', '<a role="button" href="#">Copy</a>', '<span role="button">Copy</span>', '<div role="button" tabindex="0">Copy</div>', '<input type="button" value="Copy">', '<input type="submit" value="Copy">', '<input type="image" src="x.svg" alt="Copy">', '<input value="Copy">', '<select><option>Copy</option></select>', '<textarea>Copy</textarea>', '<details><summary>Copy</summary></details>', '<label>Copy</label>', '<form action="/x"></form>', '<span onclick="copy()">Copy</span>', '<code data-copy="x">Copy</code>', '<span data-clipboard-text="x">Copy</span>', '<span data-clipboard-target="#x">Copy</span>', '<pre contenteditable>x</pre>']) {
    for (const where of ['before', 'between', 'after']) {
      const main = where === 'before' ? `${control}<pre>x</pre><p>y</p>` : where === 'between' ? `<pre>x</pre>${control}<p>y</p>` : `<pre>x</pre><p>y</p>${control}`;
      assert.equal(load(`<html><body><main>${main}</main></body></html>`)('main').find(CONTROLS).length >= 1, true, `the control selector finds ${control} ${where}`);
    }
  }
  assert.equal(load('<html><body><main><h1>x</h1><pre class="gs-call"><code>a</code></pre><p>y <a href="/x">link</a> <code data-command>c</code></p></main></body></html>')('main').find(CONTROLS).length, 0, 'the plain parts of a page are no control');
  for (const { label, lang, $ } of forms()) {
    const sections = sectionsOf($);
    assert.deepEqual(sections.map((section) => section.heading), HEADINGS[lang], `${label}: three parts in order`);
    const [claude, codex, both] = sections;
    assert.equal(claude.el.find('pre').length, 1, `${label}: one block under Claude Code`);
    assert.equal(codex.el.find('pre').length, 1, `${label}: one block under Codex`);
    assert.equal(both.el.find('pre').length, 0, `${label}: no block in the both-agents part`);
    assert.deepEqual(linesOf($, claude.el.find('pre')), CLAUDE, `${label}: the Claude Code block holds the two plugin lines`);
    assert.deepEqual(linesOf($, codex.el.find('pre')), CODEX, `${label}: the Codex block holds the clone and installer lines`);
    // Every block is a marked English command block, plain: no id, no button.
    const blocks = $('pre').toArray();
    assert.equal(blocks.length, 2, `${label}: two command blocks on the page`);
    for (const pre of blocks) {
      assert.equal($(pre).attr('lang'), 'en', `${label}: a block is English`);
      assert.equal($(pre).attr('translate'), 'no', `${label}: a block is not translated`);
      assert.equal($(pre).attr('class'), 'gs-call', `${label}: a block carries the one class gs-call`);
      assert.equal($(pre).attr('id'), undefined, `${label}: a block has no id`);
      assert.equal($(pre).find('button').length, 0, `${label}: a block has no button`);
      assert.equal($(pre).text().includes(BOTH), false, `${label}: no block holds the both-agents command`);
    }
    // The both-agents command is the README inline span, as one marked inline element in a paragraph.
    const marked = $('[data-command]');
    assert.equal(marked.length, 1, `${label}: one marked element on the page`);
    assert.equal(both.el.find('[data-command]').length, 1, `${label}: the marked element is in the both-agents part`);
    assert.equal(marked[0].tagName, 'code', `${label}: the marked element is a code element`);
    assert.equal(marked.attr('lang'), 'en', `${label}: the span is English`);
    assert.equal(marked.attr('translate'), 'no', `${label}: the span is not translated`);
    assert.equal(marked.closest('pre').length, 0, `${label}: the span is not inside a block`);
    assert.equal(marked.parent()[0].tagName, 'p', `${label}: the span sits in a paragraph`);
    assert.equal(marked.text(), BOTH, `${label}: the span holds the whole README span`);
    assert.ok(squash(marked.parent().text()).length > BOTH.length + 20, `${label}: the paragraph holds prose around the span`);
    for (const id of ['cmd', 'b-copy', 'live']) assert.equal($(`main [id="${id}"]`).length, 0, `${label}: no copy button part in main (${id})`);
    // No copy control anywhere in main, not only inside a block: no button element and no other element that can act as one.
    assert.equal($('main button').length, 0, `${label}: main holds no button element`);
    assert.equal($('main').find(CONTROLS).length, 0, `${label}: main holds no control of any kind (${$('main').find(CONTROLS).toArray().map((el) => el.tagName).join(', ')})`);
  }
});

it('agents page: every command line equals a README line and the span equals a README span', () => {
  const probes = read('tests/fixtures/guards/PROBES.md');
  assert.equal(realFacts.readme_commands.includes(BOTH), false, 'the span is not a README command line, so it cannot be a block line');
  assert.ok(realFacts.readme_inline_spans.map(squash).includes(BOTH), 'the span is a README inline span of the pin');
  // The line rule of this test is proved against the guard first, on every boundary form of a block: the same lines are unknown for both, and the guard prints them the same way.
  const CLONE = CODEX[0];
  const INSTALL = CODEX[1];
  const guardPrefix = `${AGENTS_PAGE.en}: command line not in ${RANGE}: `;
  const guardUnknown = (text, facts) => checkGuards({
    pages: [{ address: AGENTS_PAGE.en, html: `<html><body><pre class="gs-call" lang="en" translate="no"><code>${text}</code></pre></body></html>` }],
    probesText: probes,
    loadFacts: () => facts,
  }).failures.map((failure) => {
    assert.ok(failure.startsWith(guardPrefix), `the guard failure names the page and the range: ${failure}`);
    return failure.slice(guardPrefix.length);
  });
  const BOUNDARY = [
    ['an empty block', '', []],
    ['a block of white space only', '  \n\t\n   ', []],
    ['a white-space-only line between two commands', `${CLONE}\n   \n${INSTALL}`, []],
    ['a tab-only line between two commands', `${CLONE}\n\t\n${INSTALL}`, []],
    ['a blank line at the start and two at the end', `\n${CLONE}\n${INSTALL}\n\n`, []],
    ['a comment-only line', `${CLONE}\n# a comment\n${INSTALL}`, []],
    ['an indented comment-only line', `${CLONE}\n   # a comment\n${INSTALL}`, []],
    ['a comment sign alone', '#', []],
    ['a block of comment-only lines', '# one\n#two\n   #   three', []],
    ['a trailing comment after a space', `${CLONE}\n${INSTALL} # note`, []],
    ['a trailing comment after a tab', `${INSTALL}\t# note`, []],
    ['a trailing comment after several spaces', `${CLONE}    #   note # again`, []],
    ['a trailing comment sign with no text', `${INSTALL} #`, []],
    ['white space around each command', `  ${CLONE}  \n\t${INSTALL}\t`, []],
    ['CRLF line ends', `${CLONE}\r\n${INSTALL}\r\n`, []],
    ['CR line ends', `${CLONE}\r${INSTALL}`, []],
    ['both commands', `${CLONE}\n${INSTALL}`, []],
    ['an unknown line', 'proofline frobnicate', ['proofline frobnicate']],
    ['an unknown line after a white-space-only line', `${CLONE}\n   \nproofline frobnicate`, ['proofline frobnicate']],
    ['an unknown line after a comment-only line', `${CLONE}\n# x\nproofline frobnicate`, ['proofline frobnicate']],
    ['an unknown line before a blank line and a comment-only line', `proofline frobnicate\n\n# x\n${INSTALL}`, ['proofline frobnicate']],
    ['an unknown line with a trailing comment keeps its comment', 'proofline frobnicate # note', ['proofline frobnicate # note']],
    ['an unknown line is trimmed', '   proofline frobnicate   ', ['proofline frobnicate']],
    ['two unknown lines are named in order', 'proofline b\n\n# x\nproofline a', ['proofline b', 'proofline a']],
    ['a comment sign with no white space before it is no comment', `${INSTALL}#note`, [`${INSTALL}#note`]],
    ['a command with another argument', `${INSTALL} --force`, [`${INSTALL} --force`]],
    ['a command inside a longer line', `x ${CLONE}`, [`x ${CLONE}`]],
    ['a command in another case', CLONE.toUpperCase(), [CLONE.toUpperCase()]],
    ['the both-agents span as a block line', BOTH, [BOTH]],
  ];
  for (const [kind, facts] of [['real pin', realFacts], ['fixture pin', fixtureFacts]]) {
    assert.ok(facts.readme_commands.includes(CLONE) && facts.readme_commands.includes(INSTALL), `${kind}: the README holds both Codex lines`);
    for (const [name, text, expected] of BOUNDARY) {
      assert.deepEqual(unknownLines(text, facts.readme_commands), expected, `${kind}: the line rule of the test, ${name}`);
      assert.deepEqual(guardUnknown(text, facts), expected, `${kind}: the guard, ${name}`);
    }
  }
  assert.ok(BOUNDARY.some(([, , expected]) => expected.length > 0) && BOUNDARY.some(([, , expected]) => expected.length === 0), 'the boundary cases hold both outcomes');
  for (const { label, $, facts } of forms()) {
    for (const pre of $('pre').toArray()) {
      const lines = $(pre).text().split(/\r\n|\r|\n/).filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));
      assert.ok(lines.length >= 2, `${label}: a block has command lines to compare`);
      assert.deepEqual(unknownLines($(pre).text(), facts.readme_commands), [], `${label}: every line of a block equals a README line`);
    }
    const spans = $('[data-command]').toArray().filter((el) => $(el).closest('pre').length === 0);
    assert.equal(spans.length, 1, `${label}: one inline span`);
    assert.ok(facts.readme_inline_spans.map(squash).includes(squash($(spans[0]).text())), `${label}: the span equals a README span`);
    // The installer line of the README holds a trailing comment; the page shows the command only, and the comment is cut before the comparison.
    assert.equal($('pre').text().includes('#'), false, `${label}: no trailing comment is shown`);
  }
  // The guard of TASK-020 agrees on the built pages and on the pages of the fixture root, and counts them as command-checked.
  const built = checkGuards({ pages: PAGES.map(([lang, , address]) => ({ address, html: html[lang] })), probesText: probes, loadFacts: () => realFacts });
  assert.deepEqual(built.failures, [], 'the guard has no failure on the built pages');
  assert.equal(built.lines.at(-1), 'guards: 2 pages, 2 site-written, 2 get-started, 0 failures', 'both pages are command-checked pages');
  const fixture = checkGuards({ pages: PAGES.map(([lang, , address]) => ({ address, html: pageRuns.good[lang].value.html })), probesText: probes, loadFacts: () => fixtureFacts });
  assert.deepEqual(fixture.failures, [], 'the guard has no failure on the fixture pages');
  assert.equal(fixture.lines.at(-1), 'guards: 2 pages, 2 site-written, 2 get-started, 0 failures');
});

it('agents page: each page links to its get-started page and the target exists in the build', () => {
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    const links = $('main a[href]').not('.home-limits a');
    assert.equal($('main a[href]').length, 2, `${address}: two links in main, the source of the limit and the get-started link`);
    assert.equal(links.length, 1, `${address}: one link outside the limit`);
    assert.equal(links.attr('href'), GET_STARTED[lang], `${address}: the link leads to the get-started page of the language`);
    assert.equal(GET_STARTED_PAGE[lang], GET_STARTED[lang], `${address}: the address constant`);
    assert.equal(squash(links.text()), LINK_TEXT[lang], `${address}: the link text names its target`);
    assert.equal(squash(links.text()), frontmatterOf(lang).start.link, `${address}: the link text is the content key`);
    assert.equal(links.closest('p').length, 1, `${address}: the link sits in a paragraph`);
    assert.ok(squash(links.closest('p').text()).length > squash(links.text()).length + 10, `${address}: the paragraph introduces the link`);
    const other = lang === 'en' ? GET_STARTED.tr : GET_STARTED.en;
    assert.equal($(`main a[href="${other}"]`).length, 0, `${address}: no link to the get-started page of the other language`);
    const target = join(built.outDir, GET_STARTED[lang].slice(1), 'index.html');
    assert.ok(existsSync(target), `${address}: ${GET_STARTED[lang]} exists in the build`);
    assert.equal(load(readFileSync(target, 'utf8'))('html').attr('lang'), lang, `${address}: the target is a page of the same language`);
  }
});

it('agents page: the English page shows the codex sentence of the pin facts word for word and a fixture archive with another sentence shows the other', async () => {
  const quote = ($) => $('.home-limits [lang="en"]').toArray().map((el) => squash($(el).text()));
  assert.ok(realFacts.codex_sentence.startsWith('Codex as implementer is supported'), 'the pin holds the Codex sentence');
  // The built page: the sentence of the pinned README, whole, once, in an element with lang="en".
  const $ = page('en');
  assert.deepEqual(quote($), [realFacts.codex_sentence], 'the built page shows the pinned sentence in an English element');
  assert.equal(squash($('body').text()).split(realFacts.codex_sentence).length - 1, 1, 'the sentence appears once on the page');
  // The fixture archive: its sentence; and an archive with another sentence shows the other one and not the first.
  assert.notEqual(otherFacts.codex_sentence, fixtureFacts.codex_sentence, 'the two fixture archives hold different sentences');
  assert.ok(otherFacts.codex_sentence.includes(OTHER_DATES), 'the other archive holds the other sentence');
  for (const lang of ['en', 'tr']) {
    const first = rendered('good', lang);
    const other = rendered('other', lang);
    assert.deepEqual(quote(first), [fixtureFacts.codex_sentence], `${lang}: the fixture archive shows its sentence`);
    assert.deepEqual(quote(other), [otherFacts.codex_sentence], `${lang}: the other archive shows the other sentence`);
    assert.equal(squash(other('body').text()).includes(fixtureFacts.codex_sentence), false, `${lang}: the other archive does not show the first sentence`);
    assert.equal(squash(first('body').text()).includes(otherFacts.codex_sentence), false, `${lang}: the first archive does not show the other sentence`);
  }
  // The component shows the sentence of the facts it is given, whatever it is, and fails for an empty one.
  const made = { ...fixtureFacts, codex_sentence: 'A sentence only this test knows (no README holds it).' };
  for (const [lang, , address] of PAGES) {
    assert.deepEqual(quote(load(await renderer.renderComponent({ lang, facts: made }))), [made.codex_sentence], `${lang}: the component shows the sentence of its facts`);
    for (const empty of ['', '   ', undefined, null, 3]) {
      await assert.rejects(renderer.renderComponent({ lang, facts: { ...fixtureFacts, codex_sentence: empty } }), (error) => error.message.includes(`${address}: the Codex sentence of the pin facts is empty`), `${lang}: ${JSON.stringify(empty)} is not a sentence`);
    }
  }
});

it('agents page: the Codex limit links its source, the README Status section at the pinned commit, with text in the language of the page', async () => {
  const href = (commit) => `${REPO}/blob/${commit}/README.md#status`;
  assert.match(realFacts.commit, /^[0-9a-f]{40}$/, 'the pin holds a commit');
  assert.notEqual(commitFacts.commit, fixtureFacts.commit, 'the two fixture archives pin two commits');
  assert.equal(commitFacts.commit, OTHER_COMMIT);
  assert.notEqual(SOURCE_TEXT.en, SOURCE_TEXT.tr, 'the two link texts differ');
  const forms3 = [...forms(), ...['en', 'tr'].map((lang) => ({ label: `${lang} other commit`, lang, address: AGENTS_PAGE[lang], $: rendered('otherCommit', lang), facts: commitFacts }))];
  for (const { label, lang, address, $, facts } of forms3) {
    const limit = $('main .home-limits');
    assert.equal(limit.length, 1, `${label}: one limit element`);
    // One source link, inside the limit, and no other link next to the sentence: the get-started link stays outside it.
    const links = limit.find('a');
    assert.equal(links.length, 1, `${label}: one link inside the limit`);
    assert.equal($('main a[href]').length, 2, `${label}: the limit link and the get-started link are the links of main`);
    // The target: the repository, the pinned commit, the README and the Status anchor, as one exact address.
    assert.equal(links.attr('href'), href(facts.commit), `${label}: the link leads to the README Status section at the pinned commit`);
    assert.ok(links.attr('href').startsWith(`${REPO}/blob/`), `${label}: the target is in the proofline repository`);
    assert.ok(links.attr('href').endsWith('/README.md#status'), `${label}: the target is the Status anchor of the README`);
    assert.equal(links.attr('href').split(facts.commit).length - 1, 1, `${label}: the pinned commit stands once in the target`);
    for (const other of [realFacts.commit, fixtureFacts.commit, commitFacts.commit].filter((commit) => commit !== facts.commit)) {
      assert.equal(links.attr('href').includes(other), false, `${label}: the target holds no other commit`);
    }
    assert.equal(links.attr('href').includes('/main/'), false, `${label}: the target is a commit and not a branch`);
    // The attributes are the ones of the source links of the home page: the address and nothing else.
    assert.deepEqual({ ...links[0].attribs }, { href: href(facts.commit) }, `${label}: the link carries an href and no other attribute`);
    // The text: the content key, in the language of the page.
    assert.equal(squash(links.text()), SOURCE_TEXT[lang], `${label}: the link text`);
    assert.equal(squash(links.text()), get(frontmatterOf(lang), 'limit.source'), `${label}: the link text is the content key limit.source`);
    // Placement: the last paragraph of the limit, directly after the paragraph that holds the quoted sentence, outside every English element.
    const paragraph = links.parent();
    assert.equal(paragraph[0].tagName, 'p', `${label}: the link sits in a paragraph`);
    assert.equal(paragraph.attr('class'), 'gs-p', `${label}: the paragraph is a plain text paragraph`);
    assert.equal(paragraph.attr('lang'), undefined, `${label}: the paragraph has no language attribute`);
    assert.equal(squash(paragraph.text()), SOURCE_TEXT[lang], `${label}: the paragraph holds the link and nothing else`);
    assert.ok(paragraph.parent().is('.home-limits'), `${label}: the paragraph is a child of the limit`);
    assert.ok(paragraph.is(':last-child'), `${label}: the source comes last in the limit`);
    const quote = paragraph.prev();
    assert.ok(quote.is('p[lang="en"]'), `${label}: the source comes right after the quoted sentence`);
    assert.equal(squash(quote.text()), facts.codex_sentence, `${label}: the paragraph before the link is the pinned sentence`);
    assert.equal(links.parentsUntil('main').filter('[lang]').length, 0, `${label}: the link is not inside an English element`);
    assert.equal(sectionsOf($)[1].el.find('.home-limits a').length, 1, `${label}: the link is in the Codex part`);
    assert.equal(limit.closest('main').length, 1, `${label}: the limit is in main`);
    assert.equal(address, AGENTS_PAGE[lang]);
  }
  // The language of the text: the English text is English and the Turkish text is Turkish.
  assert.match(SOURCE_TEXT.en, /^Source: /);
  assert.doesNotMatch(SOURCE_TEXT.en, /[çğıöşüÇĞİÖŞÜ]/);
  assert.match(SOURCE_TEXT.tr, /^Kaynak: /);
  assert.match(SOURCE_TEXT.tr, /[çğıöşüÇĞİÖŞÜ]/);
  assert.equal(page('en')('main .home-limits a').text().includes('Kaynak'), false, 'the English page holds no Turkish link text');
  assert.equal(page('tr')('main .home-limits a').text().includes('Source'), false, 'the Turkish page holds no English link text');
  // The target of the built page is the one of the pin: another archive gives another target on the same page file.
  assert.equal(page('en')('main .home-limits a').attr('href'), href(realFacts.commit));
  assert.equal(page('tr')('main .home-limits a').attr('href'), href(realFacts.commit));
  assert.notEqual(rendered('otherCommit', 'en')('main .home-limits a').attr('href'), rendered('good', 'en')('main .home-limits a').attr('href'), 'another commit gives another target');
  // The component links the commit of the facts it is given, whatever it is.
  for (const lang of ['en', 'tr']) {
    const made = { ...fixtureFacts, commit: 'abc123' };
    assert.equal(load(await renderer.renderComponent({ lang, facts: made }))('.home-limits a').attr('href'), href('abc123'), `${lang}: the component links the commit of its facts`);
  }
  // The built pages are not changed by the link in the places the other tests guard: the limit still holds one quoted sentence.
  for (const { label, $, facts } of forms3) assert.deepEqual($('main .home-limits [lang="en"]').toArray().map((el) => squash($(el).text())), [facts.codex_sentence], `${label}: one quoted sentence`);
});

it('agents page: the content files hold no typed copy of the codex sentence', () => {
  const sentences = [realFacts.codex_sentence, fixtureFacts.codex_sentence, otherFacts.codex_sentence];
  const fragments = ['other Codex roles are not yet verified', 'Codex as implementer is supported', 'not yet verified', 'verified in real use'];
  const files = [CONTENT_FILE.en, CONTENT_FILE.tr, 'src/lib/agents.ts', COMPONENT, PAGE_FILE.en, PAGE_FILE.tr];
  for (const rel of files) {
    const text = squash(read(rel));
    for (const sentence of sentences) assert.equal(text.includes(sentence), false, `${rel} holds no copy of the sentence "${sentence}"`);
    for (const fragment of fragments) assert.equal(text.toLowerCase().includes(fragment.toLowerCase()), false, `${rel} holds no fragment of it: ${fragment}`);
  }
  // No key of the English file can carry it: the keys are the fixed list, and no value is as long as the sentence or holds a README word of it.
  assert.deepEqual(leaves(frontmatterOf('en')).sort(), [...TEXT_KEYS].sort(), 'the English file holds the text keys and nothing else');
  assert.deepEqual(leaves(frontmatterOf('tr')).filter((key) => !key.startsWith('translatedFrom')).sort(), [...TEXT_KEYS, ...TURKISH_KEYS].sort(), 'the Turkish file adds the translation keys and nothing else');
  for (const lang of ['en', 'tr']) {
    for (const key of leaves(frontmatterOf(lang)).filter((leaf) => !leaf.startsWith('translatedFrom'))) {
      assert.doesNotMatch(get(frontmatterOf(lang), key), /implementer is supported|roles are not yet/i, `${lang} ${key} does not hold the sentence`);
    }
  }
  // The source of the sentence on the page is the pin facts: the component reads the field by its name.
  assert.match(read(COMPONENT), /facts\.codex_sentence/, 'the component reads codex_sentence of the facts');
});

it('agents page: a missing codex sentence fails the page naming its address and the pattern', () => {
  for (const [lang, , address] of PAGES) {
    const run = pageRuns.noSentence[lang];
    assert.ok(run.error, `${address}: a README without the sentence fails the page`);
    assert.ok(run.error.message.startsWith(`${address}: ${NOT_FOUND}`), `${address}: the message starts with the address and the facts message: ${run.error.message.slice(0, 200)}`);
    assert.ok(run.error.message.includes(PATTERN), `${address}: the message holds the pattern`);
    assert.ok(run.error.message.includes(`${address}: ${NOT_FOUND}${PATTERN}`), `${address}: the address is directly followed by the reader message and the pattern`);
    for (const [, , other] of PAGES.filter(([otherLang]) => otherLang !== lang)) assert.equal(run.error.message.includes(other), false, `${address}: the message does not name ${other}`);
    // The README holding the sentence renders: the failure is the missing sentence and nothing else.
    assert.equal(pageRuns.good[lang].error, undefined, `${address}: the same root with the sentence renders`);
  }
  // The wrapper itself, for each address: the original message and the cause are kept; a good root returns the facts of the reader.
  for (const [, , address] of PAGES) {
    assert.deepEqual(agentsFacts(address, roots.good), fixtureFacts, `${address}: a good root gives the facts of the reader`);
    let original;
    assert.throws(() => factsOf(roots.noSentence), (error) => { original = error; return true; });
    assert.throws(() => agentsFacts(address, roots.noSentence), (error) => error.message === `${address}: ${original.message}` && error.cause instanceof Error && error.cause.message === original.message, `${address}: the address is put in front of the original message and the error is kept as the cause`);
    // The other missing sentence of the README Status section is a missing sentence too and is named the same way.
    assert.throws(() => agentsFacts(address, roots.noNotProven), (error) => error.message.startsWith(`${address}: ${NOT_FOUND}`), `${address}: the other Status sentence is named with the address`);
    // Any other error is the error of the reader, as it is (no address in front).
    let heading;
    assert.throws(() => factsOf(roots.noStatus), (error) => { heading = error; return true; });
    assert.ok(heading.message.includes('heading not found: ## Status'), 'the reader fails for the missing heading');
    assert.throws(() => agentsFacts(address, roots.noStatus), (error) => error.message === heading.message && error.cause === undefined, `${address}: another error is not changed, no address in front and no cause added`);
    assert.throws(() => agentsFacts(address, join(roots.good, 'missing')), (error) => error instanceof Error && !error.message.startsWith(`${address}: `), `${address}: a missing pin file is not changed`);
  }
});

it('agents page: a build with the codex sentence missing exits non-zero', () => {
  const good = siteBuilds.withSentence;
  const bad = siteBuilds.withoutSentence;
  // The control: the same copy of the site with the sentence in the README builds, so the failure below is the missing sentence and nothing else.
  assert.equal(good.status, 0, `the build with the sentence exits 0: ${good.output.slice(-600)}`);
  for (const [lang, rel, address] of PAGES) {
    const $ = load(readFileSync(join(good.outDir, rel), 'utf8'));
    assert.equal($('html').attr('lang'), lang, `${address}: built from the fixture root`);
    assert.deepEqual($('main .home-limits [lang="en"]').toArray().map((el) => squash($(el).text())), [fixtureFacts.codex_sentence], `${address}: the build shows the sentence of the fixture README`);
  }
  assert.notEqual(bad.status, 0, 'the build exits non-zero without the sentence');
  assert.ok(bad.status !== null, 'the build ended and was not killed');
  assert.ok(bad.output.includes(AGENTS_PAGE.en), `the output names ${AGENTS_PAGE.en}: ${bad.output.slice(-600)}`);
  // The page address stands directly in front of the message of the pin facts reader, as the wrapper writes it. The route listing of the build prints the address too, and the
  // cause that the build prints below the error holds the reader message without an address, so neither of them proves the wrapper: the address and the message are asserted as one text.
  // The build stops at the first page that fails, which is the English one, so the Turkish address is proved by the page renders (a missing codex sentence fails the page naming its address).
  const failure = `${AGENTS_PAGE.en}: ${NOT_FOUND}${PATTERN}`;
  assert.ok(bad.output.includes(failure), `the output holds the page address directly followed by the reader message: ${bad.output.slice(-900)}`);
  assert.ok(bad.output.includes(`Error: ${failure}`), 'the error itself starts with the page address and then the reader message');
  assert.ok(bad.output.includes(`${AGENTS_PAGE.en}: ${NOT_FOUND}`), 'the address is followed by the reader message');
  assert.ok(bad.output.includes(PATTERN), 'the output holds the pattern');
  assert.ok(bad.output.includes(NOT_FOUND), 'the output holds the message of the pin facts reader');
  assert.equal(bad.output.includes('Complete!'), false, 'the build does not report completion');
});

it('agents page: the Turkish page shows the Turkish limit sentence and the English sentence only inside an English element', () => {
  assert.equal(frontmatterOf('tr').limit.translation, TR_SENTENCE, 'the content file holds the hand translation of the task context');
  for (const word of ['Codex', 'implementer', 'doğrulanmadı']) assert.ok(TR_SENTENCE.includes(word), `the Turkish sentence holds ${word}`);
  for (const { label, lang, $, facts } of forms().filter((form) => form.lang === 'tr')) {
    const limit = $('main .home-limits');
    assert.equal(limit.length, 1, `${label}: one limit element`);
    const turkish = limit.children('p').toArray().filter((p) => $(p).attr('lang') === undefined && squash($(p).text()) === TR_SENTENCE);
    assert.equal(turkish.length, 1, `${label}: the Turkish sentence is a paragraph of its own with no language attribute`);
    assert.equal($(turkish[0]).closest('[lang="en"]').length, 0, `${label}: the Turkish sentence is not inside an English element`);
    // The English sentence: once, inside an element with lang="en", after the Turkish one in document order.
    const text = squash($('body').text());
    assert.equal(text.split(facts.codex_sentence).length - 1, 1, `${label}: the English sentence appears once`);
    assert.ok(text.indexOf(TR_SENTENCE) !== -1 && text.indexOf(TR_SENTENCE) < text.indexOf(facts.codex_sentence), `${label}: the Turkish sentence comes first`);
    const quote = limit.find('[lang="en"]');
    assert.equal(quote.length, 1, `${label}: one English element in the limit`);
    assert.equal(squash(quote.text()), facts.codex_sentence, `${label}: the English element holds the pinned sentence`);
    assert.equal(quote.closest('pre').length, 0, `${label}: the quote is not a command block`);
    // Without the English elements neither the sentence nor any of its words remain.
    const withoutEnglish = textWithout($, '[lang="en"]');
    assert.equal(withoutEnglish.includes(facts.codex_sentence), false, `${label}: no English sentence outside an English element`);
    assert.doesNotMatch(withoutEnglish, /not yet verified|is supported|real use/, `${label}: no English part of the sentence outside an English element`);
    assert.ok(withoutEnglish.includes(TR_SENTENCE), `${label}: the Turkish sentence stays when the English elements are removed`);
    assert.equal(lang, 'tr');
  }
  // The English page carries no Turkish sentence.
  assert.equal(squash(page('en')('body').text()).includes('doğrulanmadı'), false, 'the English page holds no Turkish sentence');
  assert.equal(page('en')('main .home-limits').children('p').length, 2, 'the English limit is the one sentence of the README and the paragraph of its source link');
});

it('agents page: the Turkish page is Turkish prose with English only in command elements, the quoted sentence and product names', () => {
  for (const { label, $, facts } of forms().filter((form) => form.lang === 'tr')) {
    assert.equal($('html').attr('lang'), 'tr', `${label}: the language`);
    // Every element of main with a language attribute is a command block, the marked span or the quoted sentence, and it says English.
    const marked = $('main [lang]').toArray();
    assert.equal(marked.length, 4, `${label}: two blocks, one span and one quote carry a language attribute`);
    for (const el of marked) {
      assert.equal($(el).attr('lang'), 'en', `${label}: the attribute says English`);
      const command = el.tagName === 'pre' || (el.tagName === 'code' && $(el).is('[data-command]'));
      const quote = el.tagName === 'p' && $(el).parent().hasClass('home-limits') && squash($(el).text()) === facts.codex_sentence;
      assert.ok(command || quote, `${label}: a ${el.tagName} element with a language attribute is a command or the quoted sentence`);
    }
    assert.equal($('main pre[lang]').length, 2);
    assert.equal($('main [data-command][lang]').length, 1);
    assert.equal($('h1 [lang], h2 [lang], main a[lang], main a [lang], footer [lang], footer[lang]').length, 0, `${label}: no heading, link or footer text carries a language attribute`);
    // The only element of the header with a language attribute is the language link, which names the other language.
    assert.deepEqual($('header [lang]').toArray().map((el) => el.attribs.id), ['b-lang'], `${label}: the language link is the one marked element of the header`);
    assert.equal($('header #b-lang').attr('lang'), 'en', `${label}: the language link says the language it leads to`);
    // The prose: what is left once the blocks, the span and the quote are removed. No English function word of English prose is in it.
    const prose = textWithout($, 'pre, [data-command], [lang="en"]');
    assert.doesNotMatch(prose, /(?<![\p{L}'’])(the|and|with|then|your|from|where|take|is|are|was|were|this|that|it|in|of|to|a|an|on|for|run|role|here|full)(?![\p{L}])/iu, `${label}: no English function word in the Turkish prose: ${prose}`);
    assert.match(prose, /çalıştırın/, `${label}: the Turkish instruction is in the prose`);
    assert.ok(prose.includes(TR_SENTENCE), `${label}: the Turkish limit sentence is prose`);
    // Each text key of the Turkish file reads as Turkish: a Turkish letter or a Turkish function word.
    const tr = frontmatterOf('tr');
    for (const key of keysOf('tr')) assert.match(get(tr, key), /[çğıöşüÇĞİÖŞÜ]|(?<![\p{L}])(ve|bir|için|sonra|ile|olan|yerine|içinde|ise|komutunu)(?![\p{L}])/u, `${key} reads as Turkish`);
    assert.deepEqual($('h2').toArray().map((el) => squash($(el).text())), HEADINGS.tr, `${label}: the headings`);
    // The interface text is Turkish: the menu words, the language link and the skip of the layout carry the Turkish words.
    assert.deepEqual($('header nav a').toArray().map((a) => squash($(a).text())), ['Ana sayfa', 'Başlarken', 'Claude Code ve Codex'], `${label}: the menu is Turkish`);
  }
  // The Turkish page is not the English text with Turkish headings.
  const en = frontmatterOf('en');
  const tr = frontmatterOf('tr');
  for (const key of TEXT_KEYS) assert.notEqual(get(tr, key), get(en, key), `${key} is written in Turkish, not copied`);
  const prose = (lang) => {
    const copy = load(page(lang).html(page(lang)('main')), null, false);
    copy('pre, [data-command], [lang="en"], h1, h2').remove();
    return copy('p').toArray().map((el) => squash(copy(el).text()));
  };
  const enProse = prose('en');
  const trProse = prose('tr');
  assert.ok(enProse.length >= 4, 'the English page holds its prose paragraphs');
  assert.ok(trProse.length >= enProse.length, 'the Turkish page holds at least the same paragraphs');
  for (const paragraph of trProse) assert.ok(!enProse.includes(paragraph), `"${paragraph}" is not an English paragraph`);
  const NAMES = new Set(['proofline', 'claude', 'code', 'codex', 'implementer', 'runtime', 'marketplace', 'plugin', 'installer', 'task', 'readme']);
  const wordsOf = (paragraphs) => (paragraphs.join(' ').toLocaleLowerCase('tr').match(/[\p{L}]+/gu) ?? []).filter((word) => !NAMES.has(word));
  const english = new Set(wordsOf(enProse));
  const turkishWords = wordsOf(trProse);
  const shared = turkishWords.filter((word) => english.has(word));
  assert.ok(shared.length / turkishWords.length < 0.25, `the Turkish prose shares ${shared.length} of ${turkishWords.length} words with the English prose`);
  assert.notEqual(page('en')('h2').last().text(), page('tr')('h2').last().text(), 'the last headings differ');
});

it('agents page: the language link leads from one page to the other and back', () => {
  assert.deepEqual(PAIRS.find((pair) => pair.en === '/claude-code-and-codex/'), { en: '/claude-code-and-codex/', tr: '/tr/claude-code-ve-codex/' }, 'the pair is registered');
  assert.deepEqual(switcherTarget('/claude-code-and-codex/'), { href: '/tr/claude-code-ve-codex/', lang: 'tr', translated: true });
  assert.deepEqual(switcherTarget('/tr/claude-code-ve-codex/'), { href: '/claude-code-and-codex/', lang: 'en', translated: true });
  const en = page('en')('a#b-lang');
  const tr = page('tr')('a#b-lang');
  assert.equal(en.length, 1);
  assert.equal(tr.length, 1);
  assert.equal(en.attr('href'), '/tr/claude-code-ve-codex/', 'the English page leads to the Turkish page');
  assert.equal(en.attr('hreflang'), 'tr');
  assert.equal(tr.attr('href'), '/claude-code-and-codex/', 'the Turkish page leads back');
  assert.equal(tr.attr('hreflang'), 'en');
  assert.ok(existsSync(join(built.outDir, 'tr', 'claude-code-ve-codex', 'index.html')), 'the Turkish target exists in the build');
  assert.ok(existsSync(join(built.outDir, 'claude-code-and-codex', 'index.html')), 'the English target exists in the build');
  // The pages rendered from the fixture root lead the same way (the path prop decides).
  assert.equal(rendered('good', 'en')('a#b-lang').attr('href'), '/tr/claude-code-ve-codex/');
  assert.equal(rendered('good', 'tr')('a#b-lang').attr('href'), '/claude-code-and-codex/');
  // The menu of both pages lists the page with its menu word, and marks it as the current page.
  for (const [lang, , address] of PAGES) {
    const link = page(lang)(`header nav a[href="${address}"]`);
    assert.equal(link.length, 1, `${address}: the menu lists the page`);
    assert.equal(squash(link.text()), lang === 'en' ? 'Claude Code + Codex' : 'Claude Code ve Codex', `${address}: the menu word`);
    assert.equal(link.attr('aria-current'), 'page', `${address}: the menu marks the current page`);
  }
});

it('agents page: the pages list each other as hreflang alternates with x-default and the stamp matches', () => {
  const expected = [
    { hreflang: 'en', href: `${ORIGIN}/claude-code-and-codex/` },
    { hreflang: 'tr', href: `${ORIGIN}/tr/claude-code-ve-codex/` },
    { hreflang: 'x-default', href: `${ORIGIN}/claude-code-and-codex/` },
  ];
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    const links = $('link[rel="alternate"][hreflang]').toArray().map((el) => ({ hreflang: $(el).attr('hreflang'), href: $(el).attr('href') }));
    assert.deepEqual(links, expected, `${address}: the alternates`);
    assert.deepEqual(alternates(address), expected, `${address}: the translation index gives the same`);
    assert.equal($('link[rel="canonical"]').attr('href'), `${ORIGIN}${address}`, `${address}: the canonical address is its own`);
  }
  // The sitemap lists the two pages, each with the same three alternates.
  const sitemap = load(readFileSync(join(built.outDir, 'sitemap.xml'), 'utf8'), { xml: true });
  for (const [, , address] of PAGES) {
    const url = sitemap('url').toArray().find((el) => sitemap(el).children('loc').text() === `${ORIGIN}${address}`);
    assert.ok(url, `${address}: the sitemap lists the page`);
    assert.deepEqual(sitemap(url).children('xhtml\\:link').toArray().map((el) => ({ hreflang: el.attribs.hreflang, href: el.attribs.href })), expected, `${address}: the sitemap alternates`);
  }
  // The stamp: the Turkish file names the English file and records its hash, so no stale notice shows.
  const stamp = frontmatterOf('tr').translatedFrom;
  assert.equal(stamp.page, CONTENT_FILE.en);
  assert.equal(stamp.hash, contentHash(read(CONTENT_FILE.en)), 'the hash is the one of the English file');
  assert.equal(isStale({ kind: 'site', translatedFrom: stamp }, { root }), false, 'the Turkish page is not stale');
  assert.equal(isStale({ kind: 'site', translatedFrom: { ...stamp, hash: contentHash(`${read(CONTENT_FILE.en)}x`) } }, { root }), true, 'a changed English file makes it stale');
  assert.equal(frontmatterOf('en').translatedFrom, undefined, 'the English file carries no stamp');
  assert.deepEqual(pageRuns.good.tr.value.warnings, [], 'the Turkish page prints no stale notice');
  assert.equal(page('tr').html().includes('changed since this translation'), false, 'the built Turkish page shows no stale notice');
});

it('agents page: neither page matches the install-time patterns', () => {
  // The scan is proved on strings first: it finds a number with a unit and a duration sentence about installing, and passes the real text.
  assert.equal(durationProblems('The install takes 5 minutes.').length >= 1, true);
  assert.equal(durationProblems('Setup is done in two hours.').length, 1);
  assert.equal(durationProblems('Kurulum 10 dakika sürer.').length >= 1, true);
  assert.equal(durationProblems('Bir saat içinde biter.').length, 1);
  assert.equal(durationProblems('Installing takes a few seconds.').length, 1, 'a duration sentence about installing');
  assert.equal(durationProblems('Run it in 30 seconds.').length, 1, 'a number with a unit of time');
  assert.equal(durationProblems('Clone the repository, then run the Codex installer.').length, 0);
  // The fixture state of PB-3.
  const probes = read('tests/fixtures/guards/PROBES.md');
  assert.equal(pb3State(probes).confirmed, false, 'the PB-3 fixture has no confirmed result');
  for (const { label, $ } of forms()) {
    const body = squash($('body').text());
    // The text that is scanned is the text of the real page: its title, its command and its limit are in it.
    for (const part of [H1[lang0(label)], BOTH, CLAUDE[0], CODEX[1]]) assert.ok(body.includes(part), `${label}: the scanned text holds "${part}"`);
    const texts = [squash($('title').text()), $('meta[name="description"]').attr('content') ?? '', body];
    for (const text of texts) {
      for (const pattern of INSTALL_TIME_PATTERNS) assert.doesNotMatch(text, pattern, `${label}: the install-time pattern ${pattern.source}`);
      assert.deepEqual(durationProblems(text), [], `${label}: no time for an installation`);
    }
    assert.doesNotMatch(body, /(?<![\p{L}])(seconds?|minutes?|hours?|saniye|dakika|saat)(?![\p{L}])/iu, `${label}: no unit of time at all`);
  }
  // The content files, key by key, hold none of it either.
  for (const lang of ['en', 'tr']) {
    for (const key of keysOf(lang)) {
      for (const pattern of INSTALL_TIME_PATTERNS) assert.doesNotMatch(get(frontmatterOf(lang), key), pattern, `${lang} ${key}: the install-time pattern ${pattern.source}`);
      assert.deepEqual(durationProblems(get(frontmatterOf(lang), key)), [], `${lang} ${key}: no duration`);
    }
  }
  // The guard over the built pages with the fixture PROBES: no failure, and a time text added to a page is found for that page.
  const result = checkGuards({ pages: PAGES.map(([lang, , address]) => ({ address, html: html[lang] })), probesText: probes, loadFacts: () => realFacts });
  assert.deepEqual(result.failures, []);
  assert.equal(result.lines[0], 'PB-3: no result');
  for (const [lang, , address] of PAGES) {
    const changed = html[lang].replace('</main>', `<p>${lang === 'en' ? 'Done in five minutes.' : 'Beş dakikada biter.'}</p></main>`);
    const probe = checkGuards({ pages: [{ address, html: changed }], probesText: probes, loadFacts: () => realFacts });
    assert.equal(probe.failures.length, 1, `${address}: the guard finds a time text`);
    assert.ok(probe.failures[0].startsWith(`${address}: install-time text`), `${address}: the guard names the page`);
  }
});

it('agents page: no sentence outside the Codex limit claims Codex is verified for other roles', () => {
  // The scan is proved on strings first: each claim form is found, and the page prose passes.
  for (const claim of CLAIM_FORMS) assert.ok(claimsIn(claim).length >= 1, `the scan finds: ${claim}`);
  for (const prose of ['Clone the repository, then run the Codex installer.', 'Repoyu klonlayın, sonra Codex installer\'ını çalıştırın.', 'Run a role on another runtime with proofline init in your project.', 'Bir rolü başka bir runtime\'da çalıştırmak için projenizde komutunu kullanın.']) assert.deepEqual(claimsIn(prose), [], `the scan passes: ${prose}`);
  // The limit sentence of the README and its translation are claims by themselves: that is why the scan runs on the page without the limit, and why the limit alone may hold them.
  assert.ok(claimsIn(realFacts.codex_sentence).length >= 1, 'the quoted sentence holds claim words');
  assert.ok(claimsIn(fixtureFacts.codex_sentence).length >= 1, 'the fixture sentence holds claim words');
  assert.ok(claimsIn(TR_SENTENCE).length >= 1, 'the Turkish sentence holds claim words');
  // A page loaded as a fragment has no body: the scan of the copy below must read a body that holds the page.
  assert.equal(squash(load('<p>Codex is verified.</p>', null, false)('body').text()), '', 'a fragment copy has no body text, so the copy of the page is loaded as a document');
  for (const { label, lang, $, facts } of forms()) {
    // The Codex limit: one element directly under the Codex command block, inside the Codex part, and the only place that holds a claim.
    const limit = $('main .home-limits');
    assert.equal(limit.length, 1, `${label}: one limit element`);
    const [, codex] = sectionsOf($);
    assert.equal(codex.el.find('.home-limits').length, 1, `${label}: the limit is in the Codex part`);
    const next = codex.el.find('pre').next();
    assert.equal(next.length, 1, `${label}: the Codex block has a next element`);
    assert.ok(next.is('.home-limits'), `${label}: the limit sits directly under the Codex command block`);
    assert.equal(limit.find('[lang="en"]').text(), facts.codex_sentence, `${label}: the limit holds the pinned sentence`);
    // Everywhere else: no claim, in the prose, the headings, the lead, the link text or any attribute. The copy is a whole document with the limit removed.
    const copy = load($.html());
    copy('.home-limits').remove();
    assert.equal(copy('.home-limits').length, 0, `${label}: the copy holds no limit`);
    const content = frontmatterOf(lang);
    const scanned = everyText(copy);
    const body = scanned.at(-2);
    assert.ok(scanned.at(-1).length > body.length, `${label}: the spaced body text is longer than the joined one`);
    for (const part of [content.title, content.lead, content.claude.intro, content.codex.intro, content.both.heading, content.start.intro, content.start.link, ...CLAUDE, ...CODEX, BOTH]) {
      assert.ok(body.includes(squash(part)), `${label}: the scanned body holds "${part}"`);
    }
    assert.ok(body.includes('Codex'), `${label}: the scanned body holds the Codex heading`);
    assert.equal(body.includes(facts.codex_sentence), false, `${label}: the scanned body holds no quoted sentence`);
    assert.equal(body.includes('doğrulanmadı') || body.includes('not yet verified'), false, `${label}: the scanned body holds no limit text of either language`);
    assert.ok(scanned.some((text) => text === copy('title').text() && text.includes(H1[lang])), `${label}: the scanned texts hold the title`);
    assert.ok(scanned.includes(`${content.lead} ${PHRASE[lang]}.`), `${label}: the scanned texts hold the description`);
    for (const text of scanned) assert.deepEqual(claimsIn(text), [], `${label}: no claim outside the limit, near "${claimAt(text)}"`);
    // The same texts of the page with the limit in it: the claim words are there, so the limit is the only place that holds them.
    assert.ok(claimsIn(squash($('body').text())).length >= 1, `${label}: the page with the limit holds the claim words of the limit`);
    for (const text of everyText($).slice(0, -2)) assert.deepEqual(claimsIn(text), [], `${label}: no claim in the head or an attribute, near "${claimAt(text)}"`);
    // The content files carry none, key by key.
    for (const key of keysOf(lang).filter((k) => k !== 'limit.translation')) assert.deepEqual(claimsIn(get(frontmatterOf(lang), key)), [], `${lang} ${key}: no claim`);
  }
  // The Turkish limit is the only place of the Turkish page that speaks of the state of Codex, and it says the same as the English one: a limit.
  assert.deepEqual(claimsIn(TR_SENTENCE).length >= 1, true, 'the Turkish sentence is the one that holds the stem');
  assert.equal(page('tr')('main .home-limits p').first().text(), TR_SENTENCE);
});

it('agents page: a command the README does not hold fails the page naming the address and the line', async () => {
  const every = [...CLAUDE, ...CODEX];
  // The helpers, line by line: the README without the line fails and the message names the page and the line.
  for (const [lang, , address] of PAGES) {
    for (const facts of [fixtureFacts, realFacts]) assert.deepEqual([...pinnedLines(address, facts.readme_commands, every)], every, `${lang}: the lines pass against the README`);
    for (const line of every) {
      const without = fixtureFacts.readme_commands.filter((command) => command !== line);
      assert.throws(() => pinnedLines(address, without, every), (error) => error instanceof Error && error.message === `${address}: command not in the README at the pin: ${line}`, `${address}: the absent line is named: ${line}`);
    }
    assert.equal(pinnedSpan(address, fixtureFacts.readme_inline_spans, BOTH), BOTH, `${lang}: the span passes against the README`);
    assert.throws(() => pinnedSpan(address, fixtureFacts.readme_inline_spans, 'proofline init --role implementer'), (error) => error.message === `${address}: span not in the README at the pin: proofline init --role implementer`, 'a cut span fails');
    assert.throws(() => pinnedSpan(address, fixtureFacts.readme_inline_spans, 'init --role implementer=codex'), (error) => error.message === `${address}: span not in the README at the pin: init --role implementer=codex`, 'a span cut at the front fails');
    // The span is not a command line: as a block line it is not in the README commands.
    assert.throws(() => pinnedLines(address, fixtureFacts.readme_commands, [BOTH]), (error) => error.message === `${address}: command not in the README at the pin: ${BOTH}`, 'the span is no command line');
  }
  // The page files rendered from a README that lacks the clone line or the span: the message names the page, the line or the span, and no other page.
  for (const [lang, , address] of PAGES) {
    const clone = pageRuns.badClone[lang];
    assert.ok(clone.error, `${address}: a README without the clone line fails the page`);
    assert.ok(clone.error.message.includes(`${address}: command not in the README at the pin: ${CODEX[0]}`), `${address}: the message names the page and the line: ${clone.error.message.slice(0, 160)}`);
    const span = pageRuns.badSpan[lang];
    assert.ok(span.error, `${address}: a README without the span fails the page`);
    assert.ok(span.error.message.includes(`${address}: span not in the README at the pin: ${BOTH}`), `${address}: the message names the page and the span: ${span.error.message.slice(0, 160)}`);
    for (const [, , other] of PAGES.filter(([otherLang]) => otherLang !== lang)) {
      assert.equal(clone.error.message.includes(`${other}:`), false, `${address}: the message does not name ${other}`);
      assert.equal(span.error.message.includes(`${other}:`), false, `${address}: the message does not name ${other}`);
    }
  }
  // The component: a README that lacks one line fails the render naming the page and the line, so `npm run build` fails the same way.
  for (const [lang, , address] of PAGES) {
    for (const line of every) {
      const facts = { ...fixtureFacts, readme_commands: fixtureFacts.readme_commands.filter((command) => command !== line) };
      await assert.rejects(renderer.renderComponent({ lang, facts }), (error) => error.message.includes(`${address}: command not in the README at the pin: ${line}`), `${address}: the render names the page and "${line}"`);
    }
    await assert.rejects(renderer.renderComponent({ lang, facts: { ...fixtureFacts, readme_inline_spans: [] } }), (error) => error.message.includes(`${address}: span not in the README at the pin: ${BOTH}`), `${address}: the render names the page and the span`);
  }
  // The guard of TASK-020 on the built html: a changed line, a changed span and the span written as a block line are reported with the address.
  const probes = read('tests/fixtures/guards/PROBES.md');
  for (const [lang, , address] of PAGES) {
    const changed = html[lang].replace('install.mjs', 'install.mjs --force');
    assert.notEqual(changed, html[lang], `${lang}: the line is in the html`);
    const result = checkGuards({ pages: [{ address, html: changed }], probesText: probes, loadFacts: () => realFacts });
    assert.deepEqual(result.failures, [`${address}: command line not in ${RANGE}: node proofline/adapters/codex/install.mjs --force`], `${lang}: the guard names the page and the line`);
    const cut = html[lang].replace('implementer=codex</code>', 'implementer</code>');
    assert.notEqual(cut, html[lang], `${lang}: the span is in the html`);
    const spanResult = checkGuards({ pages: [{ address, html: cut }], probesText: probes, loadFacts: () => realFacts });
    assert.deepEqual(spanResult.failures, [`${address}: data-command span not in ${RANGE}: proofline init --role implementer`], `${lang}: the guard names the page and the span`);
    const asBlock = html[lang].replace(/<code class="gs-span"[^>]*>proofline init --role implementer=codex<\/code>/, '</p><pre class="gs-call" lang="en" translate="no"><code>proofline init --role implementer=codex</code></pre><p>');
    assert.notEqual(asBlock, html[lang], `${lang}: the span is replaced by a block`);
    const blockResult = checkGuards({ pages: [{ address, html: asBlock }], probesText: probes, loadFacts: () => realFacts });
    assert.deepEqual(blockResult.failures, [`${address}: command line not in ${RANGE}: ${BOTH}`], `${lang}: the guard refuses the span as a block line`);
  }
});

it('agents page: readAgentsContent rejects a missing, non-text or empty value of every key and names the key', () => {
  for (const lang of ['en', 'tr']) {
    const source = frontmatterOf(lang);
    const keys = keysOf(lang);
    assert.deepEqual([...keys].sort(), leaves(source).filter((key) => !key.startsWith('translatedFrom')).sort(), `${lang}: the list names every key of the content file, so a new key must be added to the reader`);
    // A copy of the source with one path set (or removed when the value is undefined).
    const withValue = (path, value) => {
      const copy = structuredClone(source);
      const parts = path.split('.');
      const last = parts.pop();
      const holder = parts.reduce((object, part) => object[part], copy);
      if (value === undefined) delete holder[last]; else holder[last] = value;
      return copy;
    };
    const named = (key) => (error) => error instanceof Error && error.message === `agents content: missing ${key}`;
    assert.equal(readAgentsContent(source, lang), source, `${lang}: the real file passes and is returned as it is`);
    for (const key of keys) {
      assert.throws(() => readAgentsContent(withValue(key, undefined), lang), named(key), `${lang} ${key}: a missing key is named`);
      for (const value of [3, null, true, ['text'], { text: 'x' }]) assert.throws(() => readAgentsContent(withValue(key, value), lang), named(key), `${lang} ${key}: ${JSON.stringify(value)} is not text`);
      assert.throws(() => readAgentsContent(withValue(key, ''), lang), named(key), `${lang} ${key}: an empty string is rejected`);
      assert.throws(() => readAgentsContent(withValue(key, ' \n\t '), lang), named(key), `${lang} ${key}: a white-space-only string is rejected`);
    }
    // A parent that is missing or is not an object names the first key below it that is read.
    for (const parent of [...new Set(keys.filter((key) => key.includes('.')).map((key) => key.split('.')[0]))]) {
      const first = keys.find((key) => key.startsWith(`${parent}.`));
      assert.throws(() => readAgentsContent(withValue(parent, undefined), lang), named(first), `${lang} ${parent}: a missing group names ${first}`);
      assert.throws(() => readAgentsContent(withValue(parent, 'text'), lang), named(first), `${lang} ${parent}: a group that is text names ${first}`);
    }
    for (const input of [undefined, null, 'text', 3, []]) assert.throws(() => readAgentsContent(input, lang), named('title'), `${lang} ${JSON.stringify(input)} is not a content file`);
    // The function checks what the page prints; a key it does not read is kept and does not throw.
    assert.doesNotThrow(() => readAgentsContent({ ...source, extra: 'x' }, lang), `${lang}: an extra key does not throw`);
  }
  // The key of the source link belongs to both languages: a missing, non-text or empty value of it fails in each of them, naming it.
  assert.ok(TEXT_KEYS.includes('limit.source'), 'the text keys hold limit.source');
  for (const lang of ['en', 'tr']) {
    assert.ok(keysOf(lang).includes('limit.source'), `${lang}: the reader asks for limit.source`);
    assert.equal(get(frontmatterOf(lang), 'limit.source'), SOURCE_TEXT[lang], `${lang}: the file holds the link text`);
    const source = frontmatterOf(lang);
    const without = (value) => ({ ...source, limit: value === undefined ? Object.fromEntries(Object.entries(source.limit).filter(([key]) => key !== 'source')) : { ...source.limit, source: value } });
    for (const value of [undefined, 3, null, true, ['x'], { text: 'x' }, '', '  \t\n']) {
      assert.throws(() => readAgentsContent(without(value), lang), (error) => error.message === 'agents content: missing limit.source', `${lang}: ${JSON.stringify(value)} is not a link text`);
    }
  }
  // The translation keys belong to the Turkish file: the English reader does not ask for them and the Turkish reader does.
  assert.deepEqual([...TURKISH_KEYS], ['limit.original', 'limit.translation']);
  assert.deepEqual([...keysOf('en')], [...TEXT_KEYS]);
  assert.deepEqual([...keysOf('tr')], [...TEXT_KEYS, ...TURKISH_KEYS]);
  assert.doesNotThrow(() => readAgentsContent(frontmatterOf('en'), 'en'), 'the English file has no translation keys and passes as English');
  assert.throws(() => readAgentsContent(frontmatterOf('en'), 'tr'), (error) => error.message === 'agents content: missing limit.original', 'the English file does not pass as Turkish');
  assert.doesNotThrow(() => readAgentsContent(frontmatterOf('tr'), 'en'), 'the Turkish file passes as English (extra keys are kept)');
});

it('agents page: every prop of both page files is passed and observed', async () => {
  const expected = {
    en: {
      base: { path: '"/claude-code-and-codex/"', title: "{{ kind: 'site', text: content.title }}", lead: '{content.lead}' },
      agents: { lang: '"en"', content: '{content}', facts: '{facts}' },
    },
    tr: {
      base: { path: '"/tr/claude-code-ve-codex/"', title: "{{ kind: 'site', text: content.title }}", lead: '{content.lead}', source: "{{ kind: 'site', translatedFrom: frontmatter.translatedFrom }}" },
      agents: { lang: '"tr"', content: '{content}', facts: '{facts}' },
    },
  };
  for (const [lang, , address] of PAGES) {
    const source = read(PAGE_FILE[lang]);
    const bases = propsOf(source, 'Base');
    const agents = propsOf(source, 'AgentsPage');
    assert.equal(bases.length, 1, `${address}: one Base element`);
    assert.equal(agents.length, 1, `${address}: one AgentsPage element`);
    assert.deepEqual(bases[0], expected[lang].base, `${address}: the props of Base`);
    assert.deepEqual(agents[0], expected[lang].agents, `${address}: the props of AgentsPage`);
    assert.equal(bases[0].path, `"${AGENTS_PAGE[lang]}"`, `${address}: the path of Base is the address of the page`);
    assert.equal(agents[0].lang, `"${lang}"`, `${address}: the language of AgentsPage is the language of the page`);
    // Where the values come from: the content file of the page, its own frontmatter and the pin facts of its own address.
    const importPath = /import \{ frontmatter \} from '([^']+)';/.exec(source)?.[1];
    assert.ok(importPath, `${address}: the frontmatter is imported`);
    assert.equal(join(dirname(join(root, PAGE_FILE[lang])), importPath), join(root, CONTENT_FILE[lang]), `${address}: the content file is the one of the language`);
    assert.match(source, new RegExp(`^const content = readAgentsContent\\(frontmatter, '${lang}'\\);$`, 'm'), `${address}: the content is checked by the helper for its language`);
    assert.match(source, new RegExp(`^const facts = agentsFacts\\('${address}'\\);$`, 'm'), `${address}: the facts are the pin facts, with the address of the page`);
  }
  // The element reader itself: an extra prop, a string prop and an expression with a brace and a quote inside are all read.
  assert.deepEqual(propsOf("<Base a=\"x y\" b={{ k: 'v}', n: 1 }} c={z}>\n</Base>", 'Base'), [{ a: '"x y"', b: "{{ k: 'v}', n: 1 }}", c: '{z}' }], 'the reader keeps every prop as written');
  assert.deepEqual(propsOf('<AgentsPage lang="en" />', 'Base'), [], 'another element is not read');

  // Each prop is observed, by rendering the real page files from fixture roots.
  const alternatesOf = ($) => $('link[rel="alternate"][hreflang]').toArray().map((el) => ({ hreflang: $(el).attr('hreflang'), href: $(el).attr('href') }));
  for (const [lang, , address] of PAGES) {
    const $ = rendered('good', lang);
    const content = frontmatterOf(lang);
    const other = lang === 'en' ? 'tr' : 'en';
    // path: the language of the page, the switch link and the alternate of its own language follow it.
    assert.equal($('html').attr('lang'), lang, `${address}: path decides the language of the page`);
    assert.equal($('a#b-lang').attr('href'), AGENTS_PAGE[other], `${address}: path decides the language link`);
    assert.equal(alternatesOf($).find((link) => link.hreflang === lang)?.href, `${ORIGIN}${address}`, `${address}: path decides the alternate of its own language`);
    assert.deepEqual(alternatesOf($), alternatesOf(page(lang)), `${address}: the alternates are those of the build`);
    assert.equal($('header nav a[aria-current="page"]').attr('href'), address, `${address}: path decides the current menu entry`);
    // title: the page title and the suffix.
    assert.equal($('title').text(), TITLE[lang], `${address}: title decides the head title`);
    assert.equal($('title').text().startsWith(`${content.title} | `), true, `${address}: the head title starts with the title of the content file`);
    // lead: the description.
    assert.equal($('meta[name="description"]').attr('content'), `${content.lead} ${PHRASE[lang]}.`, `${address}: lead decides the description`);
    // lang (AgentsPage), content, facts: the body.
    assert.equal(squash($('h1').text()), content.title, `${address}: content decides the heading`);
    assert.equal(squash($('main .gs-lead').text()), content.lead, `${address}: content decides the lead paragraph`);
    assert.equal(squash($('main section').first().find('p').first().text()), content.claude.intro, `${address}: content decides the first intro`);
    assert.equal(squash($('main section').eq(1).find('p').first().text()), content.codex.intro, `${address}: content decides the second intro`);
    assert.equal(squash($('main section').eq(2).find('h2').text()), content.both.heading, `${address}: content decides the third heading`);
    assert.equal(squash($('main section').eq(2).find('p').text()), `${content.both.before}${BOTH}${content.both.after}`.replace(/\s+/g, ' ').trim(), `${address}: content decides the sentence around the span`);
    assert.equal($('main a[href]').not('.home-limits a').attr('href'), GET_STARTED[lang], `${address}: lang decides the link target`);
    assert.equal($('main .home-limits p').length, lang === 'tr' ? 4 : 2, `${address}: lang decides whether the translation is shown`);
    assert.deepEqual($('main .home-limits [lang="en"]').toArray().map((el) => squash($(el).text())), [fixtureFacts.codex_sentence], `${address}: facts decide the sentence`);
    assert.equal(squash($('main section').first().find('pre').text()), CLAUDE.join(' '), `${address}: facts and lang decide the Claude Code block`);
    // facts: another archive gives another sentence on the same page file.
    assert.deepEqual(rendered('other', lang)('main .home-limits [lang="en"]').toArray().map((el) => squash($(el).text())), [otherFacts.codex_sentence], `${address}: the facts of another root change the sentence`);
  }
  // source: the Turkish page warns for a stale English source and fails naming the page for an unreadable stamp; the English page carries no stamp.
  const stale = pageRuns.stale;
  assert.equal(stale.tr.error, undefined, `a stale stamp still renders: ${stale.tr.error?.message}`);
  assert.deepEqual(stale.tr.value.warnings, ['[proofline] warning: /tr/claude-code-ve-codex/: the English source changed since this translation'], 'the Turkish page warns once, naming itself');
  assert.equal(stale.en.error, undefined, 'the English page renders');
  assert.deepEqual(stale.en.value.warnings, [], 'the English page carries no stamp and warns of nothing');
  assert.deepEqual(pageRuns.good.tr.value.warnings, [], 'a matching stamp prints no warning');
  const missing = pageRuns.noEnglish;
  assert.ok(missing.tr.error, 'a stamp that names a file that is not there fails the Turkish page');
  assert.ok(missing.tr.error.message.startsWith('/tr/claude-code-ve-codex/: '), `the error names the Turkish page: ${missing.tr.error.message.slice(0, 120)}`);
  assert.equal(missing.en.error, undefined, 'the English page reads no stamp and renders');
  // The component alone, with the facts and the content given: the language prop decides which text it reads.
  const trPage = load(await renderer.renderComponent({ lang: 'tr', facts: fixtureFacts }));
  assert.equal(squash(trPage('h1').text()), H1.tr, 'the component reads the content file of the language it is given');
});

it('agents page: the command blocks and the limit use the existing classes and the page links no stylesheet of its own', () => {
  const styles = readdirSync(join(root, 'src', 'styles')).sort();
  assert.deepEqual(styles, ['base.css', 'components.css', 'get-started.css', 'home.css', 'pipeline.css', 'tokens.css'], 'src/styles holds the known files and no agents.css');
  assert.equal(existsSync(join(root, 'src', 'styles', 'agents.css')), false, 'no agents.css file');
  const layout = read('src/layouts/Base.astro');
  assert.deepEqual(layout.match(/^import '[^']+\.css';$/gm), ['tokens', 'base', 'components', 'pipeline', 'home', 'get-started'].map((name) => `import '../styles/${name}.css';`), 'Base.astro imports the known sheets and no new one');
  for (const rel of [COMPONENT, PAGE_FILE.en, PAGE_FILE.tr, 'src/lib/agents.ts']) {
    const text = read(rel);
    assert.doesNotMatch(text, /\.css['"]/, `${rel} imports no stylesheet`);
    assert.doesNotMatch(text, /<style|<link|style=|<script/, `${rel} holds no style, link or script element`);
  }
  const startedSheets = ['get-started', 'tr/baslarken'].map((dir) => load(readFileSync(join(built.outDir, dir, 'index.html'), 'utf8'))('link[rel~=stylesheet]').toArray().map((el) => el.attribs.href));
  for (const { label, lang, $ } of forms()) {
    const sheets = $('link[rel~=stylesheet]').toArray().map((el) => el.attribs.href ?? '');
    if (label.endsWith('built')) {
      assert.equal(sheets.length, 1, `${label}: one stylesheet is linked`);
      assert.deepEqual(sheets, startedSheets[lang === 'en' ? 0 : 1], `${label}: the stylesheet is the one of the get-started page`);
    }
    for (const pre of $('pre').toArray()) assert.equal($(pre).attr('class'), 'gs-call', `${label}: a command block carries gs-call and nothing else`);
    assert.equal($('pre').length, 2, `${label}: two command blocks`);
    assert.equal($('.home-limits').length, 1, `${label}: one limit element`);
    assert.equal($('.home-limits').attr('class'), 'home-limits', `${label}: the limit carries home-limits and nothing else`);
    assert.equal($('style').length + $('[style]').length + $('script:not([src])').length, 0, `${label}: no inline style or script`);
    // Every class of main is a class the stylesheets define; the blocks and the limit use the existing ones.
    const classes = [...new Set($('main [class]').toArray().flatMap((el) => el.attribs.class.split(/\s+/)))].sort();
    assert.deepEqual(classes, ['gs', 'gs-call', 'gs-col', 'gs-h1', 'gs-h2', 'gs-lead', 'gs-p', 'gs-part', 'gs-span', 'grid', 'home-limits', 'wrap'].sort(), `${label}: the classes of the page`);
  }
  const sheet = readFileSync(join(built.outDir, startedSheets[0][0].replace(/^\//, '')), 'utf8');
  for (const name of ['gs', 'gs-call', 'gs-col', 'gs-h1', 'gs-h2', 'gs-lead', 'gs-p', 'gs-part', 'gs-span', 'grid', 'home-limits', 'wrap']) assert.match(sheet, new RegExp(`\\.${name}(?![\\w-])`), `the linked stylesheet defines .${name}`);
  assert.match(sheet, /\.gs-call\{[^}]*white-space:pre-wrap/, 'the linked stylesheet holds the wrapping rule of the command blocks');
  assert.match(sheet, /\.home-limits\{[^}]*border-inline-start:2px solid/, 'the linked stylesheet holds the rule of the limit');
});

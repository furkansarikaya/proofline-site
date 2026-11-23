// Node tests for the home page in English and Turkish (TASK-019).
// The `before` hook fetches the pinned documents, builds the real site once into a folder of its own under .cache (never dist/, never the shared .tmp), and opens one
// Vite server for the Astro container, which renders Home.astro with fixture pin facts and fixture page pairs. Every test only reads what the hooks produced,
// so the per-test budgets measure assertions only. Pin-derived text is compared with the facts the pinned documents give; none of it is typed here.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import YAML from 'yaml';
import { readPinFacts } from '../scripts/lib/pin-facts.mjs';
import { INSTALL_TIME_PATTERNS } from '../scripts/lib/guards.mjs';
import { ENV_KEYS } from '../src/lib/indexing.ts';
import { INSTALL, TASK_LINES, excerptText, homeFacts, homeLinks, pinnedCommands, readHomeContent, readmeHref, workflowHref, workflowLabel } from '../src/lib/home.ts';
import { REPO_URL, SITE_REPO_URL } from '../src/lib/nav.ts';
import { PAIRS, contentHash } from '../src/lib/translations.ts';
import { openRenderer } from './fixtures/home/render.mjs';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
sweepStale();

// ---- the strings of the TASK-019 Context, used verbatim ------------------------------------------------------------------------------------------------

const HEADLINE = {
  en: { muted: 'A script blocks', ink: 'a claim with no proof.' },
  tr: { muted: 'Dayanaksız iddiayı', ink: 'bir script engeller.' },
};
const STEPS = {
  en: ['First, install it.', 'Then ask for a task, and run it.', 'Last, read how it ended.'],
  tr: ['Önce kurun.', 'Sonra bir görev isteyin ve çalıştırın.', 'En sonda nasıl bittiğini okuyun.'],
};
const NOTE = { en: 'Codex and terminal: Get started', tr: 'Codex ve terminal: Başlarken' };
const COPY_NAME = { en: 'Copy the install commands', tr: 'Kurulum komutlarını kopyala' };
const INSTALL_LINES = ['/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline'];
const TASK_COMMANDS = ['/proofline task --grill Add rate limiting to the login endpoint', '/proofline run TASK-001'];
const TITLE = {
  en: 'proofline: a deterministic engineering team for Claude Code and Codex',
  tr: 'proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi',
};
const PAGES = [['en', 'index.html', '/'], ['tr', 'tr/index.html', '/tr/']];
const FIXTURE_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const FIXTURE_ROOT_FILES = { readme: 'tests/fixtures/launch/README.pin.md', proof: 'tests/fixtures/pin-facts/docs/proof.md', workflow: 'tests/fixtures/pin-facts/docs/concepts/workflow.md' };

/** The excerpt as the rule says, written out here independently of src/lib/home.ts: the five items in source order, one blank line between them. */
const composed = (r) => [r.opening, r.cause, r.tests, r.review, r.commit].join('\n\n');
const squash = (text) => text.replace(/\s+/g, ' ').trim();
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const pairsFixture = JSON.parse(read('tests/fixtures/home/pairs.json'));
const HOME_ONLY = [{ en: '/', tr: '/tr/' }];
const GET_STARTED = { en: '/get-started/', tr: '/tr/baslarken/' };
const DOCS = { en: '/docs/', tr: '/tr/docs/' };

/** The frontmatter of a home content file as the page imports it. */
function frontmatterOf(lang) {
  const text = read(`src/content/pages/${lang}/home.md`);
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(match, `${lang}/home.md starts with a frontmatter block`);
  return YAML.parse(match[1]);
}

/** The pin facts of a fixture root, read by the module of the pin facts itself (no helper of the home page is involved). */
const factsOf = (dir) => readPinFacts(join(dir, 'sync', 'pin.json'), join(dir, '.cache', 'sync'));

/** The home links the registered pair list must print, written out here by the rule of ADR 0011: a link needs its own pair to be registered. */
const registered = (pair) => PAIRS.some((p) => p.en === pair.en && p.tr === pair.tr);
const expectedLinks = (lang) => ({
  ...(registered(GET_STARTED) ? { getStarted: pairsFixture.links[lang].getStarted } : {}),
  ...(registered(DOCS) ? { concepts: pairsFixture.links[lang].concepts, skills: pairsFixture.links[lang].skills } : {}),
});

/** A repository root holding sync/pin.json and the cached documents under .cache/sync/<commit>/, from the existing fixtures; `edit.workflow` edits the workflow page text. */
function fixtureRoot({ edit = {}, pin = { commit: FIXTURE_COMMIT, tag: null } } = {}) {
  const dir = makeTempDir('proofline-site-home-');
  const cache = join(dir, '.cache', 'sync', pin.commit);
  for (const [key, rel] of [['readme', 'README.md'], ['proof', 'docs/proof.md'], ['workflow', 'docs/concepts/workflow.md']]) {
    const source = read(FIXTURE_ROOT_FILES[key]);
    mkdirSync(dirname(join(cache, rel)), { recursive: true });
    writeFileSync(join(cache, rel), typeof edit[key] === 'function' ? edit[key](source) : source);
  }
  mkdirSync(join(dir, 'sync'), { recursive: true });
  writeFileSync(join(dir, 'sync', 'pin.json'), JSON.stringify(pin));
  return dir;
}

function walk(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

/** The text of a cheerio selection without the elements matching `skip` (pre blocks, the excerpt). */
function textWithout($, selection, skip) {
  const copy = load($.html(selection), null, false);
  copy(skip).remove();
  return squash(copy.root().text());
}

// ---- hooks ----------------------------------------------------------------------------------------------------------------------------------------------

const built = { parent: '', outDir: '', status: -1, output: '' };
let renderer;
let realFacts;
let fixtureFacts;
let fixtureHtml = {};
const pages = {};

before(async () => {
  // The pinned documents come first: the home pages read the pin facts while the build runs.
  const fetched = spawnSync(process.execPath, [join(root, 'scripts', 'sync.mjs'), 'fetch'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(fetched.status, 0, `the fetch of the pinned documents exits 0: ${(fetched.stdout ?? '') + (fetched.stderr ?? '')}`.slice(-400));
  realFacts = readPinFacts(join(root, 'sync', 'pin.json'), join(root, '.cache', 'sync'));

  // An indexable build, so the canonical link is printed; the output folder is inside the repository so Astro does not use the shared .tmp folder.
  mkdirSync(join(root, '.cache'), { recursive: true });
  built.parent = mkdtempSync(join(root, '.cache', 'proofline-home-'));
  built.outDir = join(built.parent, 'dist');
  const env = { ...process.env };
  for (const key of ENV_KEYS) delete env[key];
  env.VERCEL_ENV = 'production';
  const r = spawnSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build', '--outDir', built.outDir], { cwd: root, encoding: 'utf8', env, timeout: 120000 });
  built.status = r.status;
  built.output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (built.status === 0) for (const [lang, rel] of PAGES) pages[lang] = load(readFileSync(join(built.outDir, rel), 'utf8'));

  // The fixture facts: the launch README (all four commands), the pin-facts proof and workflow pages, and a pin that is not the real one.
  fixtureFacts = factsOf(fixtureRoot());
  renderer = await openRenderer();
  for (const lang of ['en', 'tr']) fixtureHtml[lang] = load(await renderer.renderHome({ lang, facts: fixtureFacts, pairs: pairsFixture.pairs }));
}, { timeout: 300000 });

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
  assert.ok(pages[lang], `${lang} home page is built`);
  return pages[lang];
}

const render = async (lang, { facts = fixtureFacts, pairs = pairsFixture.pairs } = {}) => load(await renderer.renderHome({ lang, facts, pairs }));

// ---- the helpers of src/lib/home.ts ------------------------------------------------------------------------------------------------------------------

describe('home helpers', () => {
  it('the excerpt is the five real output items in source order, one blank line between them', () => {
    const r = fixtureFacts.real_output;
    const items = [r.opening, r.cause, r.tests, r.review, r.commit];
    assert.ok(items.every((item) => typeof item === 'string' && item !== ''), 'the fixture archive gives the five items');
    assert.equal(excerptText(r), items.join('\n\n'));
    assert.equal(excerptText(realFacts.real_output), [realFacts.real_output.opening, realFacts.real_output.cause, realFacts.real_output.tests, realFacts.real_output.review, realFacts.real_output.commit].join('\n\n'));
    // Each item counts: an item left out or moved changes the text.
    assert.notEqual(excerptText({ ...r, review: '' }), excerptText(r));
    assert.notEqual(excerptText({ ...r, opening: r.cause, cause: r.opening }), excerptText(r));
    assert.ok(excerptText(r).startsWith(r.opening) && excerptText(r).endsWith(r.commit), 'the opening comes first and the Commit line last');
  });

  it('homeFacts reads the pin facts of its root and throws when a document is missing', () => {
    const dir = fixtureRoot();
    assert.deepEqual(homeFacts(dir), readPinFacts(join(dir, 'sync', 'pin.json'), join(dir, '.cache', 'sync')));
    assert.deepEqual(homeFacts(root), realFacts, 'the default root is the repository');
    const empty = makeTempDir('proofline-site-home-');
    mkdirSync(join(empty, 'sync'), { recursive: true });
    writeFileSync(join(empty, 'sync', 'pin.json'), JSON.stringify({ commit: FIXTURE_COMMIT, tag: null }));
    assert.throws(() => homeFacts(empty), /cannot be read from the cache folder/);
  });

  it('the pinned addresses name the repository at the pinned commit', () => {
    assert.equal(workflowHref(FIXTURE_COMMIT, 'real-output'), `${REPO_URL}/blob/${FIXTURE_COMMIT}/docs/concepts/workflow.md#real-output`);
    assert.equal(workflowLabel('real-output'), 'docs/concepts/workflow.md#real-output');
    assert.equal(readmeHref(FIXTURE_COMMIT), `${REPO_URL}/blob/${FIXTURE_COMMIT}/README.md#status`);
    assert.equal(workflowHref(realFacts.commit, realFacts.real_output.anchor), `${REPO_URL}/blob/${realFacts.commit}/docs/concepts/workflow.md#${realFacts.real_output.anchor}`);
  });

  it('the four commands are the README commands of the pin and an absent line fails naming it', () => {
    assert.deepEqual([...INSTALL.lines], INSTALL_LINES);
    assert.equal(INSTALL.label, 'Claude Code');
    assert.deepEqual([...TASK_LINES], TASK_COMMANDS);
    for (const facts of [fixtureFacts, realFacts]) {
      assert.deepEqual([...pinnedCommands(facts.readme_commands, INSTALL.lines)], INSTALL_LINES);
      assert.deepEqual([...pinnedCommands(facts.readme_commands, TASK_LINES)], TASK_COMMANDS);
    }
    // Each of the four lines is checked on its own: the README without that line fails and the message names the line.
    for (const line of [...INSTALL_LINES, ...TASK_COMMANDS]) {
      const without = fixtureFacts.readme_commands.filter((command) => command !== line);
      const lines = INSTALL_LINES.includes(line) ? INSTALL.lines : TASK_LINES;
      assert.throws(() => pinnedCommands(without, lines), (error) => error.message === `home: command not in the README at the pin: ${line}`, `the absent line is named: ${line}`);
    }
    assert.throws(() => pinnedCommands(fixtureFacts.readme_commands, ['/plugin install proofline@proofline # note']), /command not in the README at the pin/, 'a trailing comment is not a README command');
  });

  it('a link is printed only when its page pair is registered', () => {
    for (const lang of ['en', 'tr']) assert.deepEqual(homeLinks(lang), expectedLinks(lang), `${lang}: the registered pairs decide, today and later`);
    for (const lang of ['en', 'tr']) assert.deepEqual(homeLinks(lang, pairsFixture.pairs), pairsFixture.links[lang], `${lang}: the full pair list prints every link`);
    assert.deepEqual(homeLinks('en', [...HOME_ONLY, GET_STARTED]), { getStarted: '/get-started/' });
    assert.deepEqual(homeLinks('tr', [...HOME_ONLY, GET_STARTED]), { getStarted: '/tr/baslarken/' });
    assert.deepEqual(homeLinks('en', [...HOME_ONLY, DOCS]), { concepts: '/docs/#concepts', skills: '/docs/skills/' });
    assert.deepEqual(homeLinks('tr', [...HOME_ONLY, DOCS]), { concepts: '/docs/#concepts', skills: '/docs/skills/' });
    assert.deepEqual(homeLinks('en', [...HOME_ONLY, { en: '/get-started/', tr: '/tr/other/' }]), {}, 'a pair with another Turkish address is not the get-started pair');
  });

  it('the content files hold the same keys, every value is text and the Turkish file is stamped', () => {
    const en = readHomeContent(frontmatterOf('en'));
    const tr = readHomeContent(frontmatterOf('tr'));
    const keys = (value, prefix = '') => Object.entries(value).flatMap(([k, v]) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    assert.deepEqual(keys(frontmatterOf('tr')).filter((k) => !k.startsWith('translatedFrom')).sort(), keys(frontmatterOf('en')).sort(), 'both files hold the same key set');
    assert.equal(en.run.steps.length, 3);
    assert.equal(tr.run.steps.length, 3);
    const stamp = frontmatterOf('tr').translatedFrom;
    assert.equal(stamp.page, 'src/content/pages/en/home.md');
    assert.equal(stamp.hash, contentHash(read('src/content/pages/en/home.md')), 'the Turkish file records the hash of the English file');
    const source = frontmatterOf('en');
    for (const [path, broken] of [
      ['lead', { ...source, lead: undefined }],
      ['headline.ink', { ...source, headline: { muted: 'x' } }],
      ['run.steps', { ...source, run: { ...source.run, steps: ['a', 'b'] } }],
      ['limits.readme', { ...source, limits: { ...source.limits, readme: 3 } }],
      ['docs.skills', { ...source, docs: { ...source.docs, skills: undefined } }],
      ['excerpt.source', { ...source, excerpt: { caption: 'c' } }],
    ]) {
      assert.throws(() => readHomeContent(broken), (error) => error.message.startsWith('home content: missing ') && error.message.includes(path.split('.')[0]), `a missing ${path} is named`);
    }
  });

  it('readHomeContent rejects a missing, non-text or empty value of every key and names the key', () => {
    const source = frontmatterOf('en');
    // The text keys as the content file holds them, written out here and not read from the code under test; the check below ties the list to the file.
    const TEXT = [
      'lead', 'headline.muted', 'headline.ink', 'note', 'run.heading.before', 'run.heading.ink', 'run.heading.after', 'excerpt.caption', 'excerpt.source',
      'docs.before', 'docs.concepts', 'docs.middle', 'docs.skills', 'docs.after', 'limits.before', 'limits.site', 'limits.middle', 'limits.readme', 'limits.after',
    ];
    const EMPTY_OK = ['run.heading.before', 'run.heading.after'];
    const leaves = (value, prefix = '') => Object.entries(value).flatMap(([k, v]) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    assert.deepEqual([...TEXT, 'run.steps'].sort(), leaves(source).sort(), 'the list names every key of the content file, so a new key must be added here');
    // A copy of the source with one path set (or removed when the value is undefined).
    const withValue = (path, value) => {
      const copy = structuredClone(source);
      const parts = path.split('.');
      const last = parts.pop();
      const holder = parts.reduce((object, part) => object[part], copy);
      if (value === undefined) delete holder[last]; else holder[last] = value;
      return copy;
    };
    const named = (key) => (error) => error instanceof Error && error.message === `home content: missing ${key}`;
    assert.equal(readHomeContent(source), source, 'the real file passes and is returned as it is');
    for (const key of TEXT) {
      assert.throws(() => readHomeContent(withValue(key, undefined)), named(key), `${key}: a missing key is named`);
      for (const value of [3, null, true, ['text'], { text: 'x' }]) assert.throws(() => readHomeContent(withValue(key, value)), named(key), `${key}: ${JSON.stringify(value)} is not text`);
      if (EMPTY_OK.includes(key)) assert.doesNotThrow(() => readHomeContent(withValue(key, '')), `${key}: the part of the headline before or after the inked part may be empty`);
      else assert.throws(() => readHomeContent(withValue(key, '')), named(key), `${key}: an empty string is rejected and the key is named`);
    }
    // A parent that is missing or is not an object names the first key below it that is read.
    for (const parent of ['headline', 'run', 'excerpt', 'docs', 'limits']) {
      const first = TEXT.find((key) => key.startsWith(`${parent}.`));
      assert.throws(() => readHomeContent(withValue(parent, undefined)), named(first), `${parent}: a missing group names ${first}`);
      assert.throws(() => readHomeContent(withValue(parent, 'text')), named(first), `${parent}: a group that is text names ${first}`);
    }
    for (const input of [undefined, null, 'text', 3, []]) assert.throws(() => readHomeContent(input), named('lead'), `${JSON.stringify(input)} is not a content file`);
    // The three run steps: exactly three, each text and not empty, the first, middle and last one each on their own.
    const steps = source.run.steps;
    assert.equal(steps.length, 3, 'the content file holds three steps');
    for (const [label, value] of [['missing', undefined], ['text', 'a'], ['null', null], ['object', { 0: 'a', 1: 'b', 2: 'c' }], ['none', []], ['two', steps.slice(0, 2)], ['four', [...steps, 'd']]]) {
      assert.throws(() => readHomeContent(withValue('run.steps', value)), named('run.steps'), `run.steps: ${label} is rejected and the key is named`);
    }
    for (let at = 0; at < 3; at += 1) {
      assert.throws(() => readHomeContent(withValue('run.steps', steps.map((step, i) => (i === at ? '' : step)))), named('run.steps'), `run.steps: an empty step ${at + 1} is rejected and the key is named`);
      assert.throws(() => readHomeContent(withValue('run.steps', steps.map((step, i) => (i === at ? 3 : step)))), named('run.steps'), `run.steps: a step ${at + 1} that is not text is rejected`);
    }
    // The function checks what the pages print; a key it does not read is kept and does not throw.
    assert.doesNotThrow(() => readHomeContent({ ...source, extra: 'x' }), 'an extra key does not throw');
  });
});

// ---- the built pages ----------------------------------------------------------------------------------------------------------------------------------

describe('home pages', { timeout: 120000 }, () => {
  it('home pages hold one headline and the language attribute of their page', () => {
    for (const [lang] of PAGES) {
      const $ = page(lang);
      assert.equal($('html').attr('lang'), lang);
      assert.equal($('h1').length, 1, `${lang}: one H1`);
      assert.equal(squash($('h1').text()), `${HEADLINE[lang].muted} ${HEADLINE[lang].ink}`, `${lang}: the H1 text`);
      assert.equal($('main h1').length, 1, `${lang}: the H1 is in main`);
      assert.deepEqual($('h1 > span').toArray().map((el) => squash($(el).text())), [HEADLINE[lang].muted, HEADLINE[lang].ink], `${lang}: the two parts of the H1`);
      assert.equal($('h1 > span.home-h1-a').length, 1, `${lang}: the muted part`);
      assert.equal($('h1 > span.home-h1-b').length, 1, `${lang}: the ink part`);
    }
  });

  it('the headline sentence comes before the word evidence', () => {
    // The checker is proved on strings first: it fails a page that names the word before the headline and passes one that never names it.
    const before = (text, headline, word) => { const at = text.indexOf(headline); const hit = text.toLocaleLowerCase('tr').search(word); return at >= 0 && (hit === -1 || at < hit); };
    assert.equal(before('No evidence. A script blocks a claim with no proof.', 'A script blocks a claim with no proof.', /evidence/i), false);
    assert.equal(before('A script blocks a claim with no proof. Evidence later.', 'A script blocks a claim with no proof.', /evidence/i), true);
    assert.equal(before('Bir kanıt. Dayanaksız iddiayı bir script engeller.', 'Dayanaksız iddiayı bir script engeller.', /kan[ıi]t/), false);
    for (const [lang, word] of [['en', /evidence/i], ['tr', /kan[ıi]t/]]) {
      const text = squash(page(lang)('body').text());
      assert.ok(before(text, `${HEADLINE[lang].muted} ${HEADLINE[lang].ink}`, word), `${lang}: the headline sentence comes first`);
    }
    // No title and no heading holds the word at all (AC-10).
    for (const [lang, word] of [['en', /evidence/i], ['tr', /kan[ıi]t/]]) {
      const $ = page(lang);
      for (const text of [$('title').text(), $('meta[property="og:title"]').attr('content'), ...$('h1, h2, h3, h4, h5, h6').toArray().map((el) => $(el).text())]) {
        assert.doesNotMatch(text.toLocaleLowerCase('tr'), word, `${lang}: "${squash(text)}" does not hold the word`);
      }
    }
  });

  it('the only list is the gate legend and no role or skill is named', async () => {
    const lock = JSON.parse(read('sync/lock.json'));
    const skills = lock.files.map((f) => /^skills\/([^/]+)\/SKILL\.md$/.exec(f.path)?.[1]).filter(Boolean);
    assert.equal(skills.length, 28, 'the lock names the 28 skills');
    const roles = [...readFileSync(join(root, '.cache', 'sync', realFacts.commit, 'docs', 'concepts', 'roles.md'), 'utf8').matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]);
    assert.equal(roles.length, 11, 'the roles page names the eleven roles');
    // The scan itself: it finds a role as a whole word and a skill name anywhere, and skips the product name and the excerpt.
    const found = (html) => {
      const $ = load(html, null, false);
      $('.home-reply').remove();
      const text = $.root().text();
      return [...roles.filter((r) => new RegExp(`(?<![\\w-])${r}(?![\\w-])`, 'i').test(text)), ...skills.filter((s) => s.includes('-') && $.html().includes(s))];
    };
    assert.deepEqual(found('<p>The reviewer and tdd-proof</p>'), ['reviewer', 'tdd-proof']);
    assert.deepEqual(found('<p>proofline reviewed it</p><div class="home-reply">the implementer</div>'), []);
    for (const [lang] of PAGES) {
      const $ = page(lang);
      assert.deepEqual($('main ul, main ol, main dl, main menu, main [role="list"]').toArray().map((el) => `${el.tagName}.${$(el).attr('class')}`), ['ol.pipeline-legend'], `${lang}: the only list of main is the legend`);
      assert.equal($('main ol.pipeline-legend > li').length, 5, `${lang}: five gates`);
      assert.deepEqual(found($.html($('main'))), [], `${lang}: no role and no skill is named`);
    }
    // The docs links of the full pair list (fixture render) and their absence today (real build).
    for (const lang of ['en', 'tr']) {
      const $ = fixtureHtml[lang];
      assert.equal($('a[href="/docs/skills/"]').length, 1, `${lang}: one link to the skills catalogue`);
      assert.equal($('a[href="/docs/#concepts"]').length, 1, `${lang}: one link to the concepts section`);
      assert.deepEqual(found($.html()), [], `${lang}: the fixture render names no role and no skill`);
      assert.equal(page(lang)('a[href="/docs/skills/"], a[href="/docs/#concepts"]').length, registered(DOCS) ? 2 : 0, `${lang}: the real build links a docs page only when its pair is registered`);
    }
    // Each docs link has its own rule: the sentence and both links need the docs pair, and the sentence is absent as a whole when it is missing.
    for (const lang of ['en', 'tr']) {
      for (const [name, pairs, expected] of [['no pair', HOME_ONLY, false], ['get-started only', [...HOME_ONLY, GET_STARTED], false], ['docs pair', [...HOME_ONLY, DOCS], true]]) {
        const $ = await render(lang, { pairs });
        assert.equal($('p.home-docs').length, expected ? 1 : 0, `${lang} ${name}: the docs sentence`);
        assert.equal($('a[href="/docs/skills/"]').length, expected ? 1 : 0, `${lang} ${name}: the skills link`);
        assert.equal($('a[href="/docs/#concepts"]').length, expected ? 1 : 0, `${lang} ${name}: the concepts link`);
        assert.equal($('p').toArray().filter((p) => squash($(p).text()) === '').length, 0, `${lang} ${name}: no empty paragraph`);
      }
    }
  });

  it('three steps in order with command blocks equal to README commands', () => {
    const steps = { en: STEPS.en, tr: STEPS.tr };
    for (const [lang] of PAGES) {
      for (const [label, $] of [['built', page(lang)], ['fixture', fixtureHtml[lang]]]) {
        const facts = label === 'built' ? realFacts : fixtureFacts;
        assert.deepEqual($('.home-step > .home-o').toArray().map((el) => squash($(el).text())), steps[lang], `${lang} ${label}: the three step sentences in order`);
        const blocks = $('.home-step').toArray().map((el) => $(el).find('pre'));
        assert.deepEqual(blocks.map((b) => b.length), [1, 1, 0], `${lang} ${label}: command blocks in steps 1 and 2, none in step 3`);
        assert.ok($('.home-step').eq(2).find('.home-reply').length === 1, `${lang} ${label}: step 3 holds the excerpt`);
        assert.deepEqual(blocks[0].text().split('\n'), INSTALL_LINES, `${lang} ${label}: step 1 shows the install lines`);
        assert.deepEqual(blocks[1].text().split('\n'), TASK_COMMANDS, `${lang} ${label}: step 2 shows the task lines`);
        for (const pre of $('pre').toArray()) {
          assert.equal($(pre).attr('lang'), 'en', `${lang} ${label}: a command block is English`);
          assert.equal($(pre).attr('translate'), 'no', `${lang} ${label}: a command block is not translated`);
          for (const raw of $(pre).text().split('\n')) {
            const line = raw.replace(/\s+#.*$/, '').trim();
            assert.ok(facts.readme_commands.includes(line), `${lang} ${label}: "${line}" is a README command of the pin`);
          }
        }
        for (const pre of blocks.slice(0, 2)) assert.equal(pre.attr('id'), undefined, `${lang} ${label}: a step block has no id`);
        assert.equal($('pre').length, 3, `${lang} ${label}: the first-screen block and the two step blocks`);
        // Order in the document: the hero, the diagram, then the three steps.
        const order = $('pre#cmd, .pipeline, .home-step').toArray().map((el) => (el.tagName === 'pre' ? 'cmd' : el.tagName === 'section' ? 'diagram' : 'step'));
        assert.deepEqual(order, ['cmd', 'diagram', 'step', 'step', 'step'], `${lang} ${label}: document order`);
      }
    }
  });

  it('first-screen install command, copy button name and note link', async () => {
    for (const [lang] of PAGES) {
      for (const [label, $] of [['built', page(lang)], ['fixture', fixtureHtml[lang]]]) {
        assert.equal($('#cmd').length, 1, `${lang} ${label}: one #cmd`);
        assert.equal($('#b-copy').length, 1, `${lang} ${label}: one #b-copy`);
        assert.equal($('#live').length, 1, `${lang} ${label}: one #live`);
        assert.equal($('#cmd').text(), INSTALL_LINES.join('\n'), `${lang} ${label}: the two install lines`);
        assert.equal(squash($('.install-head span').text()), 'Claude Code', `${lang} ${label}: the label`);
        assert.equal($('#b-copy').attr('aria-label'), COPY_NAME[lang], `${lang} ${label}: the accessible name of the copy button`);
        assert.equal($('.home-side #cmd').length, 1, `${lang} ${label}: the command is in the side column of the first screen`);
      }
    }
    // Header controls of the built page are not part of the block: still one of each id on the whole page.
    for (const [lang] of PAGES) for (const id of ['cmd', 'b-copy', 'live']) assert.equal(page(lang)(`[id="${id}"]`).length, 1, `${lang}: id ${id} occurs once`);
    // The note link: printed only for the registered get-started pair, with the text of the language, and the whole paragraph is absent otherwise.
    for (const lang of ['en', 'tr']) {
      const $ = fixtureHtml[lang];
      assert.equal($('p.home-note').length, 1, `${lang}: the note paragraph with the full pair list`);
      assert.equal($('p.home-note a').attr('href'), pairsFixture.links[lang].getStarted, `${lang}: the note link target`);
      assert.equal(squash($('p.home-note a').text()), NOTE[lang], `${lang}: the note link text`);
      assert.equal(page(lang)('p.home-note').length, registered(GET_STARTED) ? 1 : 0, `${lang}: the note paragraph of the real build follows the registered pairs`);
      for (const [name, pairs, expected] of [['no pair', HOME_ONLY, false], ['docs only', [...HOME_ONLY, DOCS], false], ['get-started pair', [...HOME_ONLY, GET_STARTED], true]]) {
        const html = await render(lang, { pairs });
        assert.equal(html('p.home-note').length, expected ? 1 : 0, `${lang} ${name}: the note paragraph`);
        assert.equal(html('a[href="/get-started/"], a[href="/tr/baslarken/"]').length, expected ? 1 : 0, `${lang} ${name}: the get-started link`);
        assert.equal(html('p').toArray().filter((p) => squash(html(p).text()) === '').length, 0, `${lang} ${name}: no empty paragraph`);
      }
    }
  });

  it('the real output excerpt equals the pin fact and the caption names the pinned source', async () => {
    const caption = { en: /unedited/, tr: /düzenlenmedi/ };
    const quoted = /İngilizce kaynaktandır/;
    for (const [lang] of PAGES) {
      for (const [label, $, facts] of [['built', page(lang), realFacts], ['fixture', fixtureHtml[lang], fixtureFacts]]) {
        const reply = $('.home-reply');
        assert.equal(reply.length, 1, `${lang} ${label}: one excerpt`);
        assert.equal(reply.attr('lang'), 'en', `${lang} ${label}: the excerpt is English`);
        assert.equal(reply.text(), composed(facts.real_output), `${lang} ${label}: the excerpt equals the real output fact character for character`);
        const cap = $('figcaption.home-cap');
        assert.equal(cap.length, 1, `${lang} ${label}: one caption`);
        assert.match(cap.text(), caption[lang], `${lang} ${label}: the caption says the text is unedited`);
        assert.match(cap.text(), /Cause/, `${lang} ${label}: the caption names the lines that are shown`);
        if (lang === 'tr') assert.match(cap.text(), quoted, `${lang} ${label}: the Turkish caption says the excerpt is quoted from the English source`);
        const link = cap.find('a');
        assert.equal(link.length, 1, `${lang} ${label}: one source link`);
        assert.equal(link.attr('href'), workflowHref(facts.commit, facts.real_output.anchor), `${lang} ${label}: the link names the pinned workflow page`);
        assert.equal(link.text(), workflowLabel(facts.real_output.anchor), `${lang} ${label}: the link text is the document path and anchor`);
        assert.match(link.attr('href'), /^https:\/\/github\.com\/furkansarikaya\/proofline\/blob\/[0-9a-f]{40}\/docs\/concepts\/workflow\.md#real-output$/, `${lang} ${label}: the address form`);
      }
    }
    assert.equal(fixtureFacts.commit, FIXTURE_COMMIT);
    assert.notEqual(realFacts.commit, FIXTURE_COMMIT);
    // A changed fixture text shows on the page: the workflow page with another opening line gives another excerpt on the rendered page.
    const changed = factsOf(fixtureRoot({ edit: { workflow: (text) => { assert.ok(text.includes(fixtureFacts.real_output.opening)); return text.replace(fixtureFacts.real_output.opening, 'The opening line was changed in the fixture.'); } } }));
    assert.equal(changed.real_output.opening, 'The opening line was changed in the fixture.');
    const $changed = await render('en', { facts: changed });
    assert.equal($changed('.home-reply').text(), composed(changed.real_output));
    assert.ok($changed('.home-reply').text().startsWith('The opening line was changed in the fixture.'));
    assert.notEqual($changed('.home-reply').text(), fixtureHtml.en('.home-reply').text());
    // The source holds no typed copy: no file under src/ has a line of either excerpt, the pinned commits or the tag.
    const lines = [fixtureFacts, realFacts].flatMap((f) => Object.entries(f.real_output).filter(([k]) => k !== 'anchor').flatMap(([, v]) => v.split('\n'))).map((l) => l.trim()).filter((l) => l !== '');
    assert.ok(lines.length >= 10, 'both excerpts give lines to look for');
    for (const file of walk(join(root, 'src'))) {
      if (/\.(?:woff2|png|ico|svg)$/.test(file)) continue;
      const text = read(`src/${file}`);
      for (const needle of [...lines, realFacts.commit, FIXTURE_COMMIT, realFacts.tag]) assert.ok(!text.includes(needle), `src/${file} holds no typed pin text: ${needle.slice(0, 40)}`);
    }
  });

  it('limits sentence in both languages with its two links', () => {
    const design = read('docs/design/DESIGN-marketing.md');
    const section = design.slice(design.indexOf('## Limits and trust statement (R-6)'));
    const sentence = { en: /^- English: "(.*)"$/m.exec(section)?.[1], tr: /^- Turkish: "(.*)"$/m.exec(section)?.[1] };
    assert.ok(sentence.en && sentence.tr, 'the two R-6 sentences are found in DESIGN-marketing.md');
    const linkTexts = { en: ['site repository', 'README, Status'], tr: ['site reposu', 'README, Status'] };
    for (const [lang] of PAGES) {
      for (const [label, $, facts] of [['built', page(lang), realFacts], ['fixture', fixtureHtml[lang], fixtureFacts]]) {
        const limits = $('p.home-limits');
        assert.equal(limits.length, 1, `${lang} ${label}: one limits paragraph`);
        assert.equal(squash(limits.text()), sentence[lang], `${lang} ${label}: the whole sentence, as written in DESIGN-marketing.md`);
        assert.ok(limits.text().includes('(') && limits.text().includes(sentence[lang].split('(')[0]), `${lang} ${label}: the first half stands in it`);
        const links = limits.find('a').toArray().map((a) => [$(a).attr('href'), $(a).text()]);
        assert.deepEqual(links, [[SITE_REPO_URL, linkTexts[lang][0]], [readmeHref(facts.commit), linkTexts[lang][1]]], `${lang} ${label}: the two links`);
        assert.equal(readmeHref(facts.commit), `${REPO_URL}/blob/${facts.commit}/README.md#status`);
        if (label === 'built') assert.equal($('p.home-limits').closest('main').length, 1, `${lang} ${label}: the sentence is in main`);
      }
      // The half sentence never stands alone.
      const text = squash(page(lang)('body').text()).toLowerCase();
      assert.ok(!text.includes('not yet proven on real projects'), `${lang}: the README half stands alone nowhere`);
      assert.equal(text.split(squash(sentence[lang]).toLowerCase().slice(0, 30)).length - 1, 1, `${lang}: the first half occurs once, inside the whole sentence`);
    }
  });

  it('home pages hold no counts and no install time sentence', () => {
    // The scan, proved on strings: a numeral next to task, pull request or run in either order and either language is a count; a command id is not read.
    const count = /\d[\d.,]*\s*(?:'s\s+|’s\s+)?(?:tasks?|pull requests?|prs?|runs?|görev\w*|task\w*|pull request\w*|run\w*)|(?:tasks?|pull requests?|runs?)\s*[:#]?\s*\d/i;
    for (const sample of ['12 tasks', '3 pull requests', '5 runs', 'tasks: 12', 'run 7', '40 görev', '12 task’ları', '2 pull request’i']) assert.match(sample, count, `the scan finds "${sample}"`);
    for (const sample of ['A script blocks a claim with no proof.', 'ask for a task, and run it', 'Then ask for a task']) assert.doesNotMatch(sample, count, `the scan keeps "${sample}"`);
    for (const [lang] of PAGES) {
      for (const [label, $] of [['built', page(lang)], ['fixture', fixtureHtml[lang]]]) {
        const body = textWithout($, label === 'built' ? 'main' : 'body', 'pre, .home-reply, svg');
        assert.ok(body.includes(STEPS[lang][0]) && body.includes(STEPS[lang][2]), `${lang} ${label}: the scanned text is the home page text, not a placeholder`);
        assert.doesNotMatch(body, count, `${lang} ${label}: no count of tasks, pull requests or runs`);
        const whole = squash($.root().text());
        for (const pattern of INSTALL_TIME_PATTERNS) assert.doesNotMatch(whole, pattern, `${lang} ${label}: no install time sentence`);
      }
    }
    // The build guard of the project reads the same pages and finds nothing.
    const guard = spawnSync(process.execPath, [join(root, 'scripts', 'check-dist.mjs'), 'guards', built.outDir], { cwd: root, encoding: 'utf8' });
    assert.equal(guard.status, 0, `the install-time guard passes on the built home pages: ${(guard.stdout ?? '') + (guard.stderr ?? '')}`.slice(-400));
  });

  it('title, description and JSON-LD name of each home page', () => {
    for (const [lang] of PAGES) {
      const $ = page(lang);
      assert.equal($('title').text(), TITLE[lang], `${lang}: title`);
      assert.equal($('meta[property="og:title"]').attr('content'), TITLE[lang], `${lang}: og:title`);
      const description = $('meta[name="description"]').attr('content');
      assert.equal($('meta[property="og:description"]').attr('content'), description, `${lang}: og:description equals the description`);
      const length = Array.from(description).length;
      assert.ok(length >= 70 && length <= 160, `${lang}: the description has ${length} characters`);
      assert.ok(description.includes('proofline') && description.endsWith(`${TITLE[lang]}.`), `${lang}: the description carries the name and the phrase`);
      assert.ok(description.startsWith(frontmatterOf(lang).lead.slice(0, 40)), `${lang}: the description starts with the lead of the content file`);
      const blocks = $('script[type="application/ld+json"]');
      assert.equal(blocks.length, 1, `${lang}: one JSON-LD block`);
      const data = JSON.parse(blocks.text());
      assert.equal(data['@type'], 'WebSite');
      assert.equal(data.name, TITLE[lang], `${lang}: the WebSite name equals the title`);
      assert.equal($('script').length, 2, `${lang}: the JSON-LD block and the controls script, nothing else`);
      assert.equal($('[style]').length + $('style').length, 0, `${lang}: no inline style`);
    }
  });

  it('alternates, language link and head tags of the home pages', () => {
    const alternates = [['en', 'https://proofline.technology/'], ['tr', 'https://proofline.technology/tr/'], ['x-default', 'https://proofline.technology/']];
    for (const [lang, , path] of PAGES) {
      const $ = page(lang);
      assert.deepEqual($('link[rel="alternate"]').toArray().map((el) => [el.attribs.hreflang, el.attribs.href]), alternates, `${lang}: the reciprocal alternates`);
      assert.equal($('link[rel="canonical"]').attr('href'), `https://proofline.technology${path}`, `${lang}: canonical`);
      assert.equal($('meta[property="og:image"]').attr('content'), 'https://proofline.technology/og-default.png', `${lang}: og:image`);
      assert.equal($('meta[property="og:image:alt"]').attr('content'), TITLE[lang], `${lang}: the image alternative text is localised`);
      const language = $('header #b-lang');
      assert.equal(language.length, 1, `${lang}: one language link`);
      assert.equal(language.attr('href'), lang === 'en' ? '/tr/' : '/', `${lang}: the language link leads to the other home page`);
      assert.equal(language.attr('hreflang'), lang === 'en' ? 'tr' : 'en', `${lang}: hreflang of the language link`);
      assert.equal(language.text().trim(), lang === 'en' ? 'TR' : 'EN', `${lang}: it shows the other language only`);
      assert.equal($('main').length, 1);
      assert.ok($('main h1.home-h1').length === 1, `${lang}: the home page body is the home component`);
    }
  });

  it('Turkish page language and its allowed exceptions', () => {
    const $ = page('tr');
    assert.equal($('html').attr('lang'), 'tr');
    const islands = $('main [lang]').toArray().map((el) => $(el).is('pre#cmd') ? 'pre#cmd' : $(el).is('pre.home-call') ? 'pre.home-call' : $(el).is('.home-reply') ? '.home-reply' : `unexpected ${el.tagName}[lang=${$(el).attr('lang')}]`);
    assert.deepEqual(islands, ['pre#cmd', 'pre.home-call', 'pre.home-call', '.home-reply'], 'the only other lang values in main are the command blocks and the excerpt');
    assert.ok(islands.every((i) => !i.startsWith('unexpected')));
    // No English prose of the English content file appears on the Turkish page outside those islands.
    const english = frontmatterOf('en');
    const sentences = [english.lead, english.headline.muted, english.headline.ink, english.note, ...english.run.steps, english.excerpt.caption, english.docs.before, english.docs.skills, english.limits.before, english.limits.middle.slice(2)]
      .map((s) => squash(s)).filter((s) => s.length >= 12);
    // The English diagram texts (key line and legend sentences) are English prose too: the Turkish page carries the Turkish ones.
    const diagram = page('en')('.pipeline-key, .pipeline-legend-text').toArray().map((el) => squash(page('en')(el).text()));
    sentences.push(...diagram.filter((s) => s.length >= 12));
    assert.ok(sentences.length >= 12, 'the English content and the English diagram give sentences to look for');
    for (const [label, $page] of [['built', $], ['fixture', fixtureHtml.tr]]) {
      const text = textWithout($page, label === 'built' ? 'main' : 'body', '[lang]');
      for (const sentence of sentences) assert.ok(!text.includes(sentence), `${label}: the Turkish page does not hold the English "${sentence}"`);
      assert.match(text, /Dayanaksız iddiayı bir script engeller\./, `${label}: the Turkish headline is there`);
    }
    // The links to English-only pages say in their text that the page is in English (full pair list).
    const links = fixtureHtml.tr('p.home-docs a').toArray().map((a) => [fixtureHtml.tr(a).attr('href'), fixtureHtml.tr(a).text()]);
    assert.deepEqual(links.map(([href]) => href), ['/docs/#concepts', '/docs/skills/']);
    for (const [, text] of links) assert.match(text, /İngilizce/, 'the link text says the page is in English');
    // The English page holds no Turkish island.
    assert.equal(page('en')('main [lang]').toArray().filter((el) => !page('en')(el).is('pre, .home-reply')).length, 0);
    assert.ok(existsSync(join(built.outDir, 'tr', 'index.html')) && statSync(join(built.outDir, 'tr', 'index.html')).size > 0);
  });

  it('pages hold no empty paragraph, no style attribute and no extra script', () => {
    for (const [lang] of PAGES) {
      for (const [label, $] of [['built', page(lang)], ['fixture', fixtureHtml[lang]]]) {
        assert.equal($('p').toArray().filter((p) => squash($(p).text()) === '').length, 0, `${lang} ${label}: no empty paragraph`);
        assert.equal($('[style]').length, 0, `${lang} ${label}: no style attribute`);
        assert.equal($('script').length, label === 'built' ? 2 : 0, `${lang} ${label}: scripts`);
        assert.equal($('svg.home-tab').length, 1, `${lang} ${label}: the hatched tab`);
        assert.equal($('svg.home-tab').attr('aria-hidden'), 'true', `${lang} ${label}: the tab is decorative`);
        assert.equal($('h2').length, 1, `${lang} ${label}: one H2 for the lower section`);
      }
    }
    const h2 = { en: 'From install to a finished run.', tr: 'Bitmiş bir run’a kurulumdan.' };
    for (const [lang] of PAGES) assert.equal(squash(page(lang)('h2').text()), h2[lang], `${lang}: the section headline`);
  });

  it('the pipeline section has an accessible name in the page language', () => {
    // The name of a section is its aria-label, or the text of the elements its aria-labelledby names (each id occurs once and holds text).
    const nameOf = ($, section) => {
      const label = squash(section.attr('aria-label') ?? '');
      if (label !== '') return label;
      const ids = (section.attr('aria-labelledby') ?? '').split(/\s+/).filter((id) => id !== '');
      return ids.map((id) => {
        const targets = $('[id]').toArray().filter((el) => el.attribs.id === id);
        assert.equal(targets.length, 1, `the id ${id} named by aria-labelledby occurs once`);
        return squash($(targets[0]).text());
      }).join(' ').trim();
    };
    const names = {};
    for (const [lang] of PAGES) {
      for (const [label, $] of [['built', page(lang)], ['fixture', fixtureHtml[lang]]]) {
        const sections = $('section.pipeline');
        assert.equal(sections.length, 1, `${lang} ${label}: one diagram section`);
        const name = nameOf($, sections.first());
        assert.notEqual(name, '', `${lang} ${label}: the diagram section has an accessible name`);
        assert.equal(name, squash($('section.pipeline svg[role="img"]').attr('aria-label') ?? ''), `${lang} ${label}: the name is the existing label text of the page language`);
        names[`${lang} ${label}`] = name;
      }
    }
    assert.notEqual(names['en built'], names['tr built'], 'the name differs between the two languages');
    assert.equal(names['en built'], names['en fixture'], 'en: the built and the fixture page agree');
    assert.equal(names['tr built'], names['tr fixture'], 'tr: the built and the fixture page agree');
  });

  describe('the home component checks its four commands against the README commands of the pin', () => {
    const FOUR = [...INSTALL_LINES, ...TASK_COMMANDS];
    const withReadme = (edit) => factsOf(fixtureRoot({ edit: { readme: edit } }));
    const renderFails = async (lang, facts, line) => {
      await assert.rejects(renderer.renderHome({ lang, facts, pairs: pairsFixture.pairs }), (error) => error.message.includes(`home: command not in the README at the pin: ${line}`), `${lang}: the render fails naming ${line}`);
    };

    for (const line of FOUR) {
      it(`a README without the command ${line} fails the render of both pages naming it`, async () => {
        const without = { ...fixtureFacts, readme_commands: fixtureFacts.readme_commands.filter((command) => command !== line) };
        assert.equal(without.readme_commands.length, fixtureFacts.readme_commands.length - 1, 'one command is taken out');
        for (const [lang] of PAGES) await renderFails(lang, without, line);
      });

      it(`a README command that only starts with ${line} does not match it (exact match)`, async () => {
        const longer = { ...fixtureFacts, readme_commands: fixtureFacts.readme_commands.map((command) => (command === line ? `${command}x` : command)) };
        for (const [lang] of PAGES) await renderFails(lang, longer, line);
        const padded = { ...fixtureFacts, readme_commands: fixtureFacts.readme_commands.map((command) => (command === line ? ` ${command}` : command)) };
        for (const [lang] of PAGES) await renderFails(lang, padded, line);
      });
    }

    it('commands written with surrounding spaces and a trailing comment in the README still render, as the trimmed command', async () => {
      const facts = withReadme((source) => {
        let out = source;
        for (const line of FOUR) {
          assert.equal(out.split(`\n${line}\n`).length, 2, `the fixture README holds the line ${line} once`);
          out = out.replace(`\n${line}\n`, `\n  ${line}   # a trailing note\n`);
        }
        return out;
      });
      assert.deepEqual(FOUR.filter((line) => !facts.readme_commands.includes(line)), [], 'the extractor trims the lines and cuts the comments');
      for (const [lang] of PAGES) {
        const $ = load(await renderer.renderHome({ lang, facts, pairs: pairsFixture.pairs }));
        assert.deepEqual($('.home-step').eq(0).find('pre').text().split('\n'), INSTALL_LINES, `${lang}: step 1 holds the trimmed install lines`);
        assert.deepEqual($('.home-step').eq(1).find('pre').text().split('\n'), TASK_COMMANDS, `${lang}: step 2 holds the trimmed task lines`);
        assert.equal($('#cmd').text(), INSTALL_LINES.join('\n'), `${lang}: the first-screen block holds the install lines`);
      }
    });

    it('a README line that keeps its comment text in the command does not match', async () => {
      const facts = { ...fixtureFacts, readme_commands: fixtureFacts.readme_commands.map((command) => (command === TASK_COMMANDS[1] ? `${command} # note` : command)) };
      for (const [lang] of PAGES) await renderFails(lang, facts, TASK_COMMANDS[1]);
    });
  });
});

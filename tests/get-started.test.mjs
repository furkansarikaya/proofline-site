// Node tests for the get-started page in English and Turkish (TASK-021).
// The `before` hook fetches the pinned documents, builds the real site once into a folder of its own under .cache (never dist/, never the shared .tmp) and opens one Vite
// server for the Astro container, which renders GetStarted.astro with fixture pin facts. Every test only reads what the hooks produced, so the per-test budgets measure
// assertions only. Pin-derived text is compared with the facts the pinned documents give; no README line is read from the code under test.
import { after, before, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import YAML from 'yaml';
import { INSTALL_TIME_PATTERNS, checkGuards, pb3State } from '../scripts/lib/guards.mjs';
import { readPinFacts } from '../scripts/lib/pin-facts.mjs';
import { ENV_KEYS } from '../src/lib/indexing.ts';
import { CLAUDE_LINES, CODEX_LINES, FIRST_LINES, GET_STARTED_PAGE, SKILLS_SPAN, TASK_COMMANDS, pinnedLines, pinnedSpan, readGetStartedContent } from '../src/lib/get-started.ts';
import { ORIGIN } from '../src/lib/meta.ts';
import { PAIRS, alternates, contentHash, isStale, switcherTarget } from '../src/lib/translations.ts';
import { openRenderer } from './fixtures/get-started/render.mjs';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
sweepStale();

// ---- the strings of the TASK-021 Context, written out here and never read from the code under test --------------------------------------------------------

const PAGES = [['en', 'get-started/index.html', '/get-started/'], ['tr', 'tr/baslarken/index.html', '/tr/baslarken/']];
const PHRASE = {
  en: 'proofline: a deterministic engineering team for Claude Code and Codex',
  tr: 'proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi',
};
const H1 = { en: 'Get started', tr: 'Başlarken' };
const TITLE = { en: `Get started | ${PHRASE.en}`, tr: `Başlarken | ${PHRASE.tr}` };
const CLAUDE = ['/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline'];
const CODEX = ['git clone https://github.com/furkansarikaya/proofline', 'node proofline/adapters/codex/install.mjs'];
const FIRST = ['proofline init', 'proofline doctor', 'proofline status', '/proofline task --grill Add rate limiting to the login endpoint', '/proofline run TASK-001'];
const SPAN = 'npx skills add furkansarikaya/proofline --skill <name>';
const SPAN_START = 'npx skills add furkansarikaya/proofline --skill';
const HEADINGS = { en: ['Claude Code', 'Codex', 'Your first task'], tr: ['Claude Code', 'Codex', 'İlk task\'ınız'] };
const MEASURED = {
  en: ['init and doctor take a few seconds', 'empty folder', 'already installed'],
  tr: ['init ve doctor birkaç saniye', 'boş bir klasör', 'zaten kurulu'],
};
const RANGE = 'README.md between "## Install" and "## What it supports"';
const TEXT_KEYS = ['title', 'lead', 'claude.intro', 'codex.intro', 'first.heading', 'first.intro', 'first.skills.before', 'first.skills.after', 'measured'];
const FIXTURE_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const FIXTURE_ROOT_FILES = { readme: 'tests/fixtures/launch/README.pin.md', proof: 'tests/fixtures/pin-facts/docs/proof.md', workflow: 'tests/fixtures/pin-facts/docs/concepts/workflow.md' };
const CONTENT_FILE = { en: 'src/content/pages/en/get-started.md', tr: 'src/content/pages/tr/baslarken.md' };

const squash = (text) => text.replace(/\s+/g, ' ').trim();
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const normalise = (line) => line.replace(/\s+#.*$/, '').trim();

/** The frontmatter of a get-started content file as the page imports it. */
function frontmatterOf(lang) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(read(CONTENT_FILE[lang]));
  assert.ok(match, `${CONTENT_FILE[lang]} starts with a frontmatter block`);
  return YAML.parse(match[1]);
}

/** The leaf key paths of a parsed frontmatter. */
const leaves = (value, prefix = '') => Object.entries(value).flatMap(([k, v]) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

/** The pin facts of a fixture root, read by the module of the pin facts itself. */
const factsOf = (dir) => readPinFacts(join(dir, 'sync', 'pin.json'), join(dir, '.cache', 'sync'));

/**
 * A repository root holding sync/pin.json and the cached documents, from the existing fixtures. `readmeWithout` drops every README line that holds the text, and `english`
 * (when not null) is written as the English content file, where the translation stamp of the Turkish page looks for it.
 */
function fixtureRoot({ readmeWithout = null, english = null } = {}) {
  const dir = makeTempDir('proofline-site-getstarted-');
  const cache = join(dir, '.cache', 'sync', FIXTURE_COMMIT);
  for (const [key, rel] of [['readme', 'README.md'], ['proof', 'docs/proof.md'], ['workflow', 'docs/concepts/workflow.md']]) {
    mkdirSync(dirname(join(cache, rel)), { recursive: true });
    const text = read(FIXTURE_ROOT_FILES[key]);
    writeFileSync(join(cache, rel), key === 'readme' && readmeWithout !== null ? text.split('\n').filter((line) => !line.includes(readmeWithout)).join('\n') : text);
  }
  mkdirSync(join(dir, 'sync'), { recursive: true });
  writeFileSync(join(dir, 'sync', 'pin.json'), JSON.stringify({ commit: FIXTURE_COMMIT, tag: null }));
  if (english !== null) {
    mkdirSync(join(dir, dirname(CONTENT_FILE.en)), { recursive: true });
    writeFileSync(join(dir, CONTENT_FILE.en), english);
  }
  return dir;
}

/** The lines of a `pre` element, one per line, as the page prints them. */
const linesOf = ($, pre) => $(pre).text().split('\n');

/** The sections of main: the heading text and the elements they hold. */
const sectionsOf = ($) => $('.gs section').toArray().map((el) => ({ heading: squash($(el).find('h2').first().text()), el: $(el) }));

/** Duration problems of a text, by the three rules of AC-7 that the guard does not hold: a number and a unit of time, and a sentence about installing that gives a duration. */
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

const PAGE_FILE = { en: 'src/pages/get-started/index.astro', tr: 'src/pages/tr/baslarken/index.astro' };

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

const SKIPPED_AT_RULES = /^@(?:-\w+-)?(?:font-face|keyframes|property|page|counter-style|font-feature-values|view-transition)\b/i;

/** The parts of a text between top-level `separator` characters: a separator inside a bracket, a parenthesis or a quote does not split. */
function splitTop(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth += 1;
    else if (c === ')' || c === ']') depth -= 1;
    else if (c === separator && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter((part) => part !== '');
}

/** The statements of a block body: `{ head, block }`, where `block` is the text between the braces of a statement that has them and null for one that ends with a semicolon. */
function statementsOf(text) {
  const found = [];
  let start = 0;
  let quote = '';
  let parens = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') parens += 1;
    else if (c === ')') parens -= 1;
    else if (c === ';' && parens === 0) {
      found.push({ head: text.slice(start, i).trim(), block: null });
      start = i + 1;
    } else if (c === '{') {
      let depth = 0;
      let inner = '';
      let j = i;
      for (; j < text.length; j += 1) {
        const d = text[j];
        if (inner) {
          if (d === '\\') j += 1;
          else if (d === inner) inner = '';
        } else if (d === '"' || d === "'") inner = d;
        else if (d === '{') depth += 1;
        else if (d === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      found.push({ head: text.slice(start, i).trim(), block: text.slice(i + 1, j) });
      i = j;
      start = j + 1;
    }
  }
  if (text.slice(start).trim() !== '') found.push({ head: text.slice(start).trim(), block: null });
  return found;
}

/**
 * Every style rule of a stylesheet, in source order, as `{ selectors, declarations, context }`: the rules inside any conditional at-rule (media, supports, layer, container)
 * and the rules and conditional blocks nested inside a rule are all returned, `context` lists the at-rules around a rule, and a declaration is `{ property, value, important }`
 * with the property and the value in lower case and `!important` taken off the value. Keyframes, font faces and the other at-rules without a style rule are left out.
 */
function styleRules(css) {
  const rules = [];
  const walk = (body, rule, context) => {
    for (const { head, block } of statementsOf(body)) {
      if (block === null) {
        if (rule === null || !head.includes(':')) continue;
        const value = head.slice(head.indexOf(':') + 1).trim();
        rule.declarations.push({
          property: head.slice(0, head.indexOf(':')).trim().toLowerCase(),
          value: value.replace(/\s*!\s*important\s*$/i, '').trim().toLowerCase(),
          important: /!\s*important\s*$/i.test(value),
        });
      } else if (head.startsWith('@')) {
        if (SKIPPED_AT_RULES.test(head)) continue;
        const inner = rule === null ? null : { selectors: rule.selectors, declarations: [], context: [...context, head] };
        if (inner !== null) rules.push(inner);
        walk(block, inner, [...context, head]);
      } else {
        const own = {
          selectors: splitTop(head, ',').flatMap((selector) => (rule === null ? [selector] : rule.selectors.map((parent) => (selector.includes('&') ? selector.replaceAll('&', parent) : `${parent} ${selector}`)))),
          declarations: [],
          context,
        };
        rules.push(own);
        walk(block, own, context);
      }
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), null, []);
  return rules;
}

/** The values a command block may take for each property that decides whether a long line wraps; a rule at any width that sets another value breaks the wrapping. */
const WRAP_VALUES = {
  'white-space': ['pre-wrap'],
  'white-space-collapse': ['preserve'],
  'text-wrap': ['wrap'],
  'text-wrap-mode': ['wrap'],
  'overflow-wrap': ['anywhere'],
  'word-wrap': ['anywhere'],
  'word-break': ['normal', 'break-all', 'break-word'],
  all: [],
};
/** The properties that set the inline size of a box; `max-width` is not one of them, it can only make a box narrower. */
const SIZE_PROPERTIES = ['width', 'min-width', 'inline-size', 'min-inline-size'];
/**
 * The width of the reading column at the viewports a size is read at: the page width less two 20px gutters up to 820px (the narrowest phone is 320px), six of twelve columns from 821px, and
 * 680px from the 1400px wrap on. A size is a straight line of the viewport between these, so the ends of the stretches are read; 820px is not one, a size cannot jump between 820px and 821px.
 */
const SIZE_SAMPLES = [
  { column: 280, viewport: 320 },
  { column: 390, viewport: 821 },
  { column: 680, viewport: 1400 },
  { column: 680, viewport: 3840 },
];
/** Sizes that never exceed the column, whatever the column is. */
const SAFE_SIZES = new Set(['auto', 'initial', 'unset', 'inherit', 'revert', 'revert-layer', 'min-content', 'none']);
/** Pixels in one unit; the font based units are an upper bound for the 16px root and the monospace face of the page. */
const LENGTH_UNITS = { px: 1, pt: 4 / 3, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, em: 16, rem: 16, ch: 10, ex: 8, cap: 11, ic: 16, lh: 28, rlh: 28 };
/**
 * The viewport units, and the container query units read the same way: no stylesheet of the site sets a query container, so a `cq` unit has no container and falls back to the small viewport unit of its axis
 * (cqw and cqi as vw, cqh and cqb as vh, cqmin and cqmax as vmin and vmax). A page that does declare a container is read the same way, on purpose: a `cq` unit is never read as a share of the column.
 */
const VIEWPORT_WIDTH_UNITS = /^(?:(?:d|s|l)?v(?:w|i)|cq(?:w|i))$/;
const VIEWPORT_OTHER_UNITS = /^(?:(?:d|s|l)?v(?:h|b|min|max)|cq(?:h|b|min|max))$/;

/**
 * The size, in pixels, that a value of `width` and its kin takes when the column and the viewport are as in `sample`: a number with a unit, a percentage of the column, `calc`, `min`, `max` and
 * `clamp` of those. It throws for what it cannot work out (a custom property, an unknown unit, a keyword in an expression) and gives Infinity for a viewport height.
 */
function sizeAt(text, { column, viewport }) {
  const tokens = text.match(/[a-z-]+\(|[(),+*/]|-?\d*\.?\d+(?:e[+-]?\d+)?[a-z%]*|-?[a-z][a-z-]*|\S/g) ?? [];
  let at = 0;
  const unreadable = () => { throw new SyntaxError(`cannot work out the size ${text}`); };
  const closed = () => { if (tokens[at] !== ')') unreadable(); at += 1; };
  const args = () => {
    const found = [sum()];
    while (tokens[at] === ',') { at += 1; found.push(sum()); }
    closed();
    return found;
  };
  const factor = () => {
    const token = tokens[at];
    at += 1;
    if (token === undefined) return unreadable();
    if (token === '-') return -factor();
    if (token === '+') return factor();
    if (token === '(') { const inner = sum(); closed(); return inner; }
    if (token.endsWith('(')) {
      const name = token.slice(0, -1);
      if (!['calc', 'min', 'max', 'clamp'].includes(name)) return unreadable();
      const found = args();
      if (name === 'calc') return found.length === 1 ? found[0] : unreadable();
      if (name === 'min') return Math.min(...found);
      if (name === 'max') return Math.max(...found);
      return found.length === 3 ? Math.max(found[0], Math.min(found[1], found[2])) : unreadable();
    }
    const m = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)([a-z%]*)$/.exec(token);
    if (m === null) return unreadable();
    const [, digits, unit] = m;
    const n = Number(digits);
    if (unit === '') return n;
    if (unit === '%') return (n / 100) * column;
    if (VIEWPORT_WIDTH_UNITS.test(unit)) return (n / 100) * viewport;
    if (VIEWPORT_OTHER_UNITS.test(unit)) return n === 0 ? 0 : Math.sign(n) * Infinity;
    return Object.hasOwn(LENGTH_UNITS, unit) ? n * LENGTH_UNITS[unit] : unreadable();
  };
  const product = () => {
    let value = factor();
    while (tokens[at] === '*' || tokens[at] === '/') {
      const operator = tokens[at];
      at += 1;
      const next = factor();
      value = operator === '*' ? value * next : value / next;
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (tokens[at] === '+' || tokens[at] === '-') {
      const operator = tokens[at];
      at += 1;
      const next = product();
      value = operator === '+' ? value + next : value - next;
    }
    return value;
  };
  const value = sum();
  if (at !== tokens.length) unreadable();
  return value;
}

/** Whether a value of `width`, `min-width`, `inline-size` or `min-inline-size` can make a box wider than the reading column at one of the viewports; a value the check cannot work out (`max-content`, `fit-content`, a custom property) is read as one that can. */
function sizeCanExceed(value) {
  if (SAFE_SIZES.has(value)) return false;
  try {
    return SIZE_SAMPLES.some((sample) => !(sizeAt(value, sample) <= sample.column));
  } catch {
    return true;
  }
}

/** The pseudo-classes that depend on a state of the page: a rule for one of them still styles the element, so the state is dropped before the match. */
const STATE_PSEUDO = /:(?:hover|focus|focus-visible|focus-within|active|visited|link|any-link|target|target-within)(?![\w-])/g;
const PSEUDO_ELEMENT = /::|:(?:before|after|first-line|first-letter)(?![\w-])/;

/** Whether a selector styles one of the elements; `unreadable` is the answer for a selector the engine cannot read, and the check passes true, so an unknown selector is read as a match and never skipped. */
function reaches($, elements, selector, unreadable) {
  if (PSEUDO_ELEMENT.test(selector)) return false;
  const stateless = selector.replace(STATE_PSEUDO, ':not(.never-matched)');
  try {
    return elements.some((el) => $(el).is(stateless));
  } catch {
    return unreadable;
  }
}

/**
 * What a list of style rules does to the command blocks (`.gs-call`) of a page: the problems found, as readable lines (an empty list means none). Every rule at every width,
 * in or outside a media block, with or without `!important`, whether it comes earlier or later in the sheet, that reaches a block or anything inside it is read, and
 * its value for each property of WRAP_VALUES must be one of the allowed values, and its value for each of SIZE_PROPERTIES must not be able to exceed the reading column (see `sizeCanExceed`); each block must also get `white-space: pre-wrap` and `overflow-wrap: anywhere` from a rule outside every at-rule.
 */
function wrapProblems($, rules) {
  const blocks = $('.gs-call').toArray();
  const reached = blocks.flatMap((block) => [block, ...$(block).find('*').toArray()]);
  const problems = [];
  if (blocks.length === 0) problems.push('the page has no command block');
  for (const rule of rules) {
    for (const selector of rule.selectors.filter((candidate) => reaches($, reached, candidate, true))) {
      for (const { property, value, important } of rule.declarations) {
        const allowed = WRAP_VALUES[property];
        const sizeBreaks = SIZE_PROPERTIES.includes(property) && sizeCanExceed(value);
        if ((allowed !== undefined && !allowed.includes(value)) || sizeBreaks) {
          problems.push(`${rule.context.join(' ') || 'no at-rule'}: ${selector} sets ${property}: ${value}${important ? ' !important' : ''}`);
        }
      }
    }
  }
  for (const [index, block] of blocks.entries()) {
    for (const [property, value] of [['white-space', 'pre-wrap'], ['overflow-wrap', 'anywhere']]) {
      const given = rules.some((rule) => rule.context.length === 0 && rule.declarations.some((d) => d.property === property && d.value === value) && rule.selectors.some((selector) => reaches($, [block], selector, false)));
      if (!given) problems.push(`command block ${index + 1}: no rule outside every at-rule sets ${property}: ${value}`);
    }
  }
  return problems;
}

/** The rules of a list that style a command block or anything inside it, found by what they match on the page and not by how the selector is spelled; a rule with no declaration of its own is not counted. */
function rulesReachingBlocks($, rules) {
  const reached = $('.gs-call').toArray().flatMap((block) => [block, ...$(block).find('*').toArray()]);
  return rules.filter((rule) => rule.declarations.length > 0 && rule.selectors.some((selector) => reaches($, reached, selector, true)));
}

// ---- hooks ----------------------------------------------------------------------------------------------------------------------------------------------

const built = { parent: '', outDir: '', status: -1, output: '' };
let renderer;
let realFacts;
let fixtureFacts;
const html = {};
const pages = {};
const fixturePages = {};
const pageRuns = {};

before(async () => {
  // The pinned documents come first: the pages read the pin facts while the build runs.
  const fetched = spawnSync(process.execPath, [join(root, 'scripts', 'sync.mjs'), 'fetch'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(fetched.status, 0, `the fetch of the pinned documents exits 0: ${(fetched.stdout ?? '') + (fetched.stderr ?? '')}`.slice(-400));
  realFacts = readPinFacts(join(root, 'sync', 'pin.json'), join(root, '.cache', 'sync'));

  // An indexable build; the output folder is inside the repository so Astro does not use the shared .tmp folder.
  mkdirSync(join(root, '.cache'), { recursive: true });
  built.parent = mkdtempSync(join(root, '.cache', 'proofline-getstarted-'));
  built.outDir = join(built.parent, 'dist');
  const env = { ...process.env };
  for (const key of ENV_KEYS) delete env[key];
  env.VERCEL_ENV = 'production';
  const r = spawnSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build', '--outDir', built.outDir], { cwd: root, encoding: 'utf8', env, timeout: 120000 });
  built.status = r.status;
  built.output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (built.status === 0) {
    for (const [lang, rel] of PAGES) {
      try {
        html[lang] = readFileSync(join(built.outDir, rel), 'utf8');
        pages[lang] = load(html[lang]);
      } catch { /* a page that was not built is reported by page() */ }
    }
  }

  // The fixture facts: the launch README in the shape of the pin.
  fixtureFacts = factsOf(fixtureRoot());
  renderer = await openRenderer();
  for (const lang of ['en', 'tr']) fixturePages[lang] = load(await renderer.renderGetStarted({ lang, facts: fixtureFacts }));

  // The page files themselves, rendered from a fixture root: the pin facts and the translation stamp are read from there, as a build reads them from the repository.
  const attempt = async (lang, cwd) => renderer.renderPageFile({ lang, cwd }).then((value) => ({ value }), (error) => ({ error }));
  const englishText = read(CONTENT_FILE.en);
  const roots = {
    good: fixtureRoot({ english: englishText }),
    badReadme: fixtureRoot({ readmeWithout: 'proofline doctor ', english: englishText }),
    stale: fixtureRoot({ english: `${englishText}\nA changed line.\n` }),
    noEnglish: fixtureRoot(),
  };
  for (const [name, cwd] of Object.entries(roots)) {
    pageRuns[name] = {};
    for (const lang of ['en', 'tr']) pageRuns[name][lang] = await attempt(lang, cwd);
  }
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
  assert.ok(pages[lang], `${lang} get-started page is built`);
  return pages[lang];
}

/** Both forms of every language: the built page with the real pin facts, and the component render with the fixture facts. */
function forms() {
  return PAGES.flatMap(([lang]) => [
    { label: `${lang} built`, lang, $: page(lang), facts: realFacts },
    { label: `${lang} fixture`, lang, $: fixturePages[lang], facts: fixtureFacts },
  ]);
}

// ---- the tests ------------------------------------------------------------------------------------------------------------------------------------------

it('get-started: both pages carry the language, one H1 and the suffixed title without the evidence word', () => {
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    assert.equal($('html').attr('lang'), lang, `${address}: the language attribute`);
    assert.equal($('h1').length, 1, `${address}: one H1`);
    assert.equal($('main h1').length, 1, `${address}: the H1 is in main`);
    assert.equal(squash($('h1').text()), H1[lang], `${address}: the H1 text`);
    assert.equal($('title').text(), TITLE[lang], `${address}: the title is the page title and the suffix`);
    assert.equal($('meta[property="og:title"]').attr('content'), TITLE[lang], `${address}: og:title is the title`);
    for (const text of [$('title').text(), $('meta[property="og:title"]').attr('content'), ...$('h1, h2, h3, h4, h5, h6').toArray().map((el) => $(el).text())]) {
      assert.doesNotMatch(text.toLocaleLowerCase('tr'), /evidence|kan[ıi]t/, `${address}: "${squash(text)}" does not hold the evidence word`);
    }
    // The lead is 70 to 160 characters (the description is built from it).
    const lead = frontmatterOf(lang).lead;
    assert.ok(Array.from(lead).length >= 70 && Array.from(lead).length <= 160, `${address}: the lead is ${Array.from(lead).length} characters`);
    assert.ok(($('meta[name="description"]').attr('content') ?? '').length >= 70, `${address}: the description is printed`);
    assert.deepEqual($('h2').toArray().map((el) => squash($(el).text())), HEADINGS[lang], `${address}: the headings in order`);
  }
  assert.equal(PAGES[0][2], GET_STARTED_PAGE.en);
  assert.equal(PAGES[1][2], GET_STARTED_PAGE.tr);
});

it('get-started: the Claude Code and Codex blocks hold exactly the README plugin and installer lines', () => {
  assert.deepEqual([...CLAUDE_LINES], CLAUDE);
  assert.deepEqual([...CODEX_LINES], CODEX);
  for (const { label, $, facts } of forms()) {
    const [claude, codex] = sectionsOf($);
    assert.equal(claude.heading, 'Claude Code', `${label}: the first part is Claude Code`);
    assert.equal(codex.heading, 'Codex', `${label}: the second part is Codex`);
    assert.equal(claude.el.find('pre').length, 1, `${label}: one block under Claude Code`);
    assert.equal(codex.el.find('pre').length, 1, `${label}: one block under Codex`);
    assert.deepEqual(linesOf($, claude.el.find('pre')), CLAUDE, `${label}: the Claude Code block holds the two plugin lines`);
    assert.deepEqual(linesOf($, codex.el.find('pre')), CODEX, `${label}: the Codex block holds the clone and installer lines`);
    // The lines are README commands of the pin; the installer line is shown without the trailing comment of the README.
    for (const line of [...CLAUDE, ...CODEX]) assert.ok(facts.readme_commands.includes(line), `${label}: "${line}" is a README command`);
    assert.equal(codex.el.find('pre').text().includes('#'), false, `${label}: no trailing comment is shown`);
  }
});

it('get-started: the first-task part shows the five commands in order and the skills-only span', () => {
  assert.deepEqual([...FIRST_LINES, ...TASK_COMMANDS], FIRST);
  assert.equal(SKILLS_SPAN, SPAN, 'the span constant keeps the trailing name placeholder');
  for (const { label, lang, $, facts } of forms()) {
    const sections = sectionsOf($);
    assert.equal(sections.length, 3, `${label}: three parts`);
    const first = sections[2];
    assert.equal(first.heading, HEADINGS[lang][2], `${label}: the third part is the first task`);
    assert.equal(first.el.find('pre').length, 1, `${label}: one block in the first-task part`);
    assert.deepEqual(linesOf($, first.el.find('pre')), FIRST, `${label}: the five commands in order`);
    const spans = first.el.find('[data-command]');
    assert.equal($('[data-command]').length, 1, `${label}: one marked span on the page`);
    assert.equal(spans.length, 1, `${label}: the marked span is in the first-task part`);
    assert.equal(spans.closest('pre').length, 0, `${label}: the span is not inside a block`);
    assert.equal(spans.text(), SPAN, `${label}: the span holds the whole README span with its name placeholder`);
    assert.ok(spans.text().startsWith(SPAN_START), `${label}: the span starts as the README span does`);
    assert.ok(facts.readme_inline_spans.map(squash).includes(squash(spans.text())), `${label}: the span is a README inline span`);
  }
  // The escaped placeholder is printed as text, not as a tag.
  assert.ok(html.en.includes('--skill &lt;name&gt;'), 'the placeholder is escaped in the html');
});

it('get-started: every command line equals a README line and the blocks are marked English and untranslated', () => {
  for (const { label, $, facts } of forms()) {
    const blocks = $('pre').toArray();
    assert.equal(blocks.length, 3, `${label}: three command blocks`);
    for (const pre of blocks) {
      assert.equal($(pre).attr('lang'), 'en', `${label}: a block is English`);
      assert.equal($(pre).attr('translate'), 'no', `${label}: a block is not translated`);
      assert.equal($(pre).attr('id'), undefined, `${label}: a block has no id`);
      assert.equal($(pre).find('button').length, 0, `${label}: a block has no button`);
      for (const raw of linesOf($, pre)) assert.ok(facts.readme_commands.includes(normalise(raw)), `${label}: "${normalise(raw)}" equals a README line`);
    }
    const span = $('[data-command]');
    assert.equal(span.attr('lang'), 'en', `${label}: the span is English`);
    assert.equal(span.attr('translate'), 'no', `${label}: the span is not translated`);
    assert.ok(facts.readme_inline_spans.map(squash).includes(squash(span.text())), `${label}: the span equals a README span`);
    for (const id of ['cmd', 'b-copy', 'live']) assert.equal($(`main [id="${id}"]`).length, 0, `${label}: no copy button part in main (${id})`);
  }
  // The guard of TASK-020 agrees on the built pages.
  const probes = read('tests/fixtures/guards/PROBES.md');
  const result = checkGuards({ pages: PAGES.map(([lang, , address]) => ({ address, html: html[lang] })), probesText: probes, loadFacts: () => realFacts });
  assert.deepEqual(result.failures, [], 'the guard has no failure on the built pages');
});

it('get-started: a command line outside the README fails the guard naming the page and the line', async () => {
  // The helpers, line by line: the README without the line fails and the message names the page and the line.
  const every = [...CLAUDE, ...CODEX, ...FIRST];
  for (const [lang, , address] of PAGES) {
    for (const facts of [fixtureFacts, realFacts]) assert.deepEqual([...pinnedLines(address, facts.readme_commands, every)], every, `${lang}: the lines pass against the README`);
    for (const line of every) {
      const without = fixtureFacts.readme_commands.filter((command) => command !== line);
      assert.throws(() => pinnedLines(address, without, every), (error) => error instanceof Error && error.message === `${address}: command not in the README at the pin: ${line}`, `${address}: the absent line is named: ${line}`);
    }
    assert.throws(() => pinnedLines(address, fixtureFacts.readme_commands, ['proofline init # note']), (error) => error.message === `${address}: command not in the README at the pin: proofline init # note`, 'a trailing comment is not a README command');
    assert.equal(pinnedSpan(address, fixtureFacts.readme_inline_spans, SPAN), SPAN, `${lang}: the span passes against the README`);
    assert.equal(pinnedSpan(address, fixtureFacts.readme_inline_spans.map((span) => `${span}  `.replace(/ /g, '  ')), SPAN), SPAN, `${lang}: white space inside the README span does not matter`);
    assert.throws(() => pinnedSpan(address, fixtureFacts.readme_inline_spans, SPAN_START), (error) => error.message === `${address}: span not in the README at the pin: ${SPAN_START}`, 'a shorter span fails');
    assert.throws(() => pinnedSpan(address, [], SPAN), (error) => error.message === `${address}: span not in the README at the pin: ${SPAN}`, 'no README span fails');
  }
  // The component: a README that lacks one line fails the render naming the page and the line, so `npm run build` fails the same way.
  for (const [lang, , address] of PAGES) {
    for (const line of every) {
      const facts = { ...fixtureFacts, readme_commands: fixtureFacts.readme_commands.filter((command) => command !== line) };
      await assert.rejects(renderer.renderGetStarted({ lang, facts }), (error) => error.message.includes(`${address}: command not in the README at the pin: ${line}`), `${address}: the render names the page and "${line}"`);
    }
    const facts = { ...fixtureFacts, readme_inline_spans: [] };
    await assert.rejects(renderer.renderGetStarted({ lang, facts }), (error) => error.message.includes(`${address}: span not in the README at the pin: ${SPAN}`), `${address}: the render names the page and the span`);
  }
  // The guard of TASK-020 on the built html: a changed line and a changed span are reported with the address.
  const probes = read('tests/fixtures/guards/PROBES.md');
  for (const [lang, , address] of PAGES) {
    const changed = html[lang].replace('proofline doctor', 'proofline doctor --fix');
    assert.notEqual(changed, html[lang], `${lang}: the line is in the html`);
    const result = checkGuards({ pages: [{ address, html: changed }], probesText: probes, loadFacts: () => realFacts });
    assert.deepEqual(result.failures, [`${address}: command line not in ${RANGE}: proofline doctor --fix`], `${lang}: the guard names the page and the line`);
    const wrongSpan = html[lang].replace('--skill &lt;name&gt;', '--skill');
    const spanResult = checkGuards({ pages: [{ address, html: wrongSpan }], probesText: probes, loadFacts: () => realFacts });
    assert.deepEqual(spanResult.failures, [`${address}: data-command span not in ${RANGE}: ${SPAN_START}`], `${lang}: the guard names the page and the span`);
  }
});

it('get-started: both pages state that init and doctor take a few seconds, measured from an empty folder with the tools installed', () => {
  for (const { label, lang, $ } of forms()) {
    const measured = $('.gs p').toArray().map((el) => squash($(el).text())).filter((text) => text.includes(MEASURED[lang][0]));
    assert.equal(measured.length, 1, `${label}: one paragraph holds the measured sentence`);
    for (const phrase of MEASURED[lang]) assert.ok(measured[0].includes(phrase), `${label}: the measured paragraph holds "${phrase}"`);
    // The sentence starts the paragraph, and the scope of the measurement is in the same paragraph.
    assert.ok(measured[0].startsWith(MEASURED[lang][0]), `${label}: the paragraph starts with the sentence`);
    assert.equal(measured[0], squash(frontmatterOf(lang).measured), `${label}: the paragraph is the content key`);
    // The measurement is not generalised: the English page says it is one measurement, the Turkish page says the same with its own words.
    assert.match(measured[0], lang === 'en' ? /one measurement/ : /tek bir ölçüm/, `${label}: the sentence says it is one measurement`);
  }
});

it('get-started: no install time anywhere and the PB-3 fixture has no confirmed result', () => {
  // The scan is proved on strings first: it finds a number with a unit and a duration sentence about installing, and passes the real sentence.
  assert.equal(durationProblems('The install takes 5 minutes.').length >= 1, true);
  assert.equal(durationProblems('Setup is done in two hours.').length, 1);
  assert.equal(durationProblems('Kurulum 10 dakika sürer.').length >= 1, true);
  assert.equal(durationProblems('Bir saat içinde biter.').length, 1);
  assert.equal(durationProblems('Installing takes a few seconds.').length, 1, 'a duration sentence about installing');
  assert.equal(durationProblems('init and doctor take a few seconds.').length, 0);
  assert.equal(durationProblems('init ve doctor birkaç saniye sürer.').length, 0);
  assert.equal(durationProblems('Run it in 30 seconds.').length, 1, 'a number with a unit of time');
  // The fixture state of PB-3.
  const probes = read('tests/fixtures/guards/PROBES.md');
  assert.equal(pb3State(probes).confirmed, false, 'the PB-3 fixture has no confirmed result');
  assert.equal(pb3State(probes).state, 'no result');
  // Each page, whole (title, description, body): neither pattern of the PRD and nothing from the scan above.
  for (const { label, $ } of forms()) {
    const body = squash($('body').text());
    const texts = [squash($('title').text()), $('meta[name="description"]').attr('content') ?? '', body];
    for (const text of texts) {
      for (const pattern of INSTALL_TIME_PATTERNS) assert.doesNotMatch(text, pattern, `${label}: the install-time pattern ${pattern.source}`);
      assert.deepEqual(durationProblems(text), [], `${label}: no time for an installation`);
    }
    assert.doesNotMatch(body, /(?<![\p{L}])(minutes?|hours?|dakika|saat)(?![\p{L}])/iu, `${label}: no unit of minutes or hours at all`);
  }
  // The guard over the built pages with the fixture PROBES: no failure.
  const result = checkGuards({ pages: PAGES.map(([lang, , address]) => ({ address, html: html[lang] })), probesText: probes, loadFacts: () => realFacts });
  assert.deepEqual(result.failures, []);
  assert.equal(result.lines[0], 'PB-3: no result');
});

it('get-started: the Turkish page is Turkish prose with English only in command blocks, the span and product names', () => {
  const $ = page('tr');
  assert.equal($('html').attr('lang'), 'tr');
  // Every element of main with a language attribute is a command block or the marked span, and it says English.
  const marked = $('main [lang]').toArray();
  assert.equal(marked.length, 4, 'three blocks and one span carry a language attribute');
  for (const el of marked) {
    assert.ok(el.tagName === 'pre' || (el.tagName === 'code' && $(el).is('[data-command]')), `a ${el.tagName} element carries a language attribute`);
    assert.equal($(el).attr('lang'), 'en', 'the attribute says English');
  }
  assert.equal($('main pre[lang]').length, 3);
  assert.equal($('main [data-command][lang]').length, 1);
  // The prose: what is left once the blocks and the span are removed. No English word of the English prose is in it.
  const copy = load($.html($('main')), null, false);
  copy('pre, [data-command]').remove();
  const prose = squash(copy.root().text());
  assert.doesNotMatch(prose, /(?<![\p{L}'’])(the|and|with|then|your|from|where|take|is|are|was|were|this|that|it|in|of|to|a|an|on|for)(?![\p{L}])/iu, 'no English function word in the Turkish prose');
  assert.match(prose, /ölçüldü/, 'the Turkish measured sentence is in the prose');
  // Each prose key of the Turkish file reads as Turkish: a Turkish letter or a Turkish function word.
  const tr = frontmatterOf('tr');
  for (const key of TEXT_KEYS) {
    const value = key.split('.').reduce((v, k) => v[k], tr);
    assert.match(value, /[çğıöşüÇĞİÖŞÜ]|(?<![\p{L}])(ve|bir|için|sonra|ile|olan|yerine|içinde)(?![\p{L}])/u, `${key} reads as Turkish`);
  }
  // The names that stay English: the two product names in headings and the page is not translated in its commands.
  assert.deepEqual($('h2').toArray().map((el) => squash($(el).text())), HEADINGS.tr);
  assert.equal($('h2 [lang]').length, 0, 'the product names in headings carry no language attribute');
});

it('get-started: the language link leads from the English page to the Turkish page and back', () => {
  assert.deepEqual(PAIRS.find((pair) => pair.en === '/get-started/'), { en: '/get-started/', tr: '/tr/baslarken/' }, 'the pair is registered');
  assert.deepEqual(switcherTarget('/get-started/'), { href: '/tr/baslarken/', lang: 'tr', translated: true });
  assert.deepEqual(switcherTarget('/tr/baslarken/'), { href: '/get-started/', lang: 'en', translated: true });
  const en = page('en')('a#b-lang');
  const tr = page('tr')('a#b-lang');
  assert.equal(en.length, 1);
  assert.equal(tr.length, 1);
  assert.equal(en.attr('href'), '/tr/baslarken/', 'the English page leads to the Turkish page');
  assert.equal(en.attr('hreflang'), 'tr');
  assert.equal(tr.attr('href'), '/get-started/', 'the Turkish page leads back');
  assert.equal(tr.attr('hreflang'), 'en');
  // The menu of both pages lists Get started with the current page marked.
  for (const [lang, , address] of PAGES) {
    const link = page(lang)(`header nav a[href="${address}"]`);
    assert.equal(link.length, 1, `${address}: the menu lists the page`);
    assert.equal(squash(link.text()), H1[lang], `${address}: the menu word`);
  }
});

it('get-started: the pages list each other as hreflang alternates with x-default and the stamp matches', () => {
  const expected = [
    { hreflang: 'en', href: `${ORIGIN}/get-started/` },
    { hreflang: 'tr', href: `${ORIGIN}/tr/baslarken/` },
    { hreflang: 'x-default', href: `${ORIGIN}/get-started/` },
  ];
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    const links = $('link[rel="alternate"][hreflang]').toArray().map((el) => ({ hreflang: $(el).attr('hreflang'), href: $(el).attr('href') }));
    assert.deepEqual(links, expected, `${address}: the alternates`);
    assert.deepEqual(alternates(address), expected, `${address}: the translation index gives the same`);
  }
  // The stamp: the Turkish file names the English file and records its hash, so no stale notice shows.
  const stamp = frontmatterOf('tr').translatedFrom;
  assert.equal(stamp.page, CONTENT_FILE.en);
  assert.equal(stamp.hash, contentHash(read(CONTENT_FILE.en)), 'the hash is the one of the English file');
  assert.equal(isStale({ kind: 'site', translatedFrom: stamp }, { root }), false, 'the Turkish page is not stale');
  assert.equal(isStale({ kind: 'site', translatedFrom: { ...stamp, hash: contentHash(`${read(CONTENT_FILE.en)}x`) } }, { root }), true, 'a changed English file makes it stale');
  assert.equal(frontmatterOf('en').translatedFrom, undefined, 'the English file carries no stamp');
  assert.deepEqual(leaves(frontmatterOf('tr')).filter((key) => !key.startsWith('translatedFrom')).sort(), leaves(frontmatterOf('en')).sort(), 'both files hold the same key set');
});

it('get-started: the Turkish page is not the English text with Turkish headings', () => {
  const en = frontmatterOf('en');
  const tr = frontmatterOf('tr');
  const get = (object, key) => key.split('.').reduce((v, k) => v[k], object);
  for (const key of TEXT_KEYS) assert.notEqual(get(tr, key), get(en, key), `${key} is written in Turkish, not copied`);
  // The prose outside blocks, span and headings shares no sentence with the English page.
  const prose = (lang) => {
    const copy = load(page(lang).html(page(lang)('main')), null, false);
    copy('pre, [data-command], h1, h2').remove();
    return copy('p').toArray().map((el) => squash(copy(el).text()));
  };
  const enProse = prose('en');
  const trProse = prose('tr');
  assert.equal(enProse.length, trProse.length, 'the same number of paragraphs');
  assert.ok(enProse.length >= 6, 'the pages hold their prose paragraphs');
  for (const paragraph of trProse) assert.ok(!enProse.includes(paragraph), `"${paragraph}" is not an English paragraph`);
  // Most words of the Turkish prose are not English words: the share of words found in the English prose stays small.
  const wordsOf = (paragraphs) => paragraphs.join(' ').toLocaleLowerCase('tr').match(/[\p{L}]+/gu) ?? [];
  const english = new Set(wordsOf(enProse));
  const turkishWords = wordsOf(trProse);
  const shared = turkishWords.filter((word) => english.has(word));
  assert.ok(shared.length / turkishWords.length < 0.25, `the Turkish prose shares ${shared.length} of ${turkishWords.length} words with the English prose`);
  // The headings differ in the language-bound parts: the page title and the first-task heading.
  assert.notEqual(H1.en, H1.tr);
  assert.notEqual(page('en')('h2').last().text(), page('tr')('h2').last().text());
});

it('get-started: readGetStartedContent rejects a missing, non-text or empty value of every key and names the key', () => {
  const source = frontmatterOf('en');
  assert.deepEqual([...TEXT_KEYS].sort(), leaves(source).sort(), 'the list names every key of the content file, so a new key must be added here');
  // A copy of the source with one path set (or removed when the value is undefined).
  const withValue = (path, value) => {
    const copy = structuredClone(source);
    const parts = path.split('.');
    const last = parts.pop();
    const holder = parts.reduce((object, part) => object[part], copy);
    if (value === undefined) delete holder[last]; else holder[last] = value;
    return copy;
  };
  const named = (key) => (error) => error instanceof Error && error.message === `get-started content: missing ${key}`;
  assert.equal(readGetStartedContent(source), source, 'the real file passes and is returned as it is');
  assert.deepEqual(readGetStartedContent(frontmatterOf('tr')), frontmatterOf('tr'), 'the Turkish file passes');
  for (const key of TEXT_KEYS) {
    assert.throws(() => readGetStartedContent(withValue(key, undefined)), named(key), `${key}: a missing key is named`);
    for (const value of [3, null, true, ['text'], { text: 'x' }]) assert.throws(() => readGetStartedContent(withValue(key, value)), named(key), `${key}: ${JSON.stringify(value)} is not text`);
    assert.throws(() => readGetStartedContent(withValue(key, '')), named(key), `${key}: an empty string is rejected`);
    assert.throws(() => readGetStartedContent(withValue(key, ' \n\t ')), named(key), `${key}: a white-space-only string is rejected`);
  }
  // A parent that is missing or is not an object names the first key below it that is read.
  for (const parent of ['claude', 'codex', 'first', 'first.skills']) {
    const first = TEXT_KEYS.find((key) => key.startsWith(`${parent}.`));
    assert.throws(() => readGetStartedContent(withValue(parent, undefined)), named(first), `${parent}: a missing group names ${first}`);
    assert.throws(() => readGetStartedContent(withValue(parent, 'text')), named(first), `${parent}: a group that is text names ${first}`);
  }
  for (const input of [undefined, null, 'text', 3, []]) assert.throws(() => readGetStartedContent(input), named('title'), `${JSON.stringify(input)} is not a content file`);
  // The function checks what the page prints; a key it does not read is kept and does not throw.
  assert.doesNotThrow(() => readGetStartedContent({ ...source, extra: 'x' }), 'an extra key does not throw');
});

it('get-started: the command blocks wrap at every width and not only at 720px and below', () => {
  // The stylesheets the pages use, read against the elements of the built pages: the source files are one cascade and are read together, and the one stylesheet each built page links is read alone.
  const source = readdirSync(join(root, 'src', 'styles')).filter((name) => name.endsWith('.css')).sort().flatMap((name) => styleRules(read(`src/styles/${name}`)));
  assert.ok(source.length > 100, 'the source stylesheets are read');
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    assert.equal($('.gs-call').length, 3, `${address}: the three command blocks are on the page`);
    assert.deepEqual(wrapProblems($, source), [], `${address}: no rule of the source stylesheets breaks the wrapping of a command block`);
    const hrefs = $('link[rel="stylesheet"]').toArray().map((el) => $(el).attr('href') ?? '');
    assert.equal(hrefs.length, 1, `${address}: one stylesheet is linked`);
    const shipped = styleRules(readFileSync(join(built.outDir, hrefs[0].replace(/^\//, '')), 'utf8'));
    assert.ok(rulesReachingBlocks($, shipped).some((rule) => rule.context.length === 0 && rule.declarations.some((d) => d.property === 'white-space' && d.value === 'pre-wrap')), `${address}: the linked stylesheet holds the rule of the command block`);
    assert.deepEqual(wrapProblems($, shipped), [], `${address}: no rule of the linked stylesheet ${hrefs[0]} breaks the wrapping of a command block`);
  }
  // The block rule is where it is meant to be, found by what the rules reach on the built pages (any selector, any at-rule, the block or anything inside it) and not by how a selector is
  // spelled: a rule of the stylesheet of the page reaches the blocks and one of those is outside every at-rule. A second rule that reaches a block is read by the check above, not refused here.
  const own = styleRules(read('src/styles/get-started.css'));
  for (const [lang, , address] of PAGES) {
    const reaching = rulesReachingBlocks(page(lang), own);
    assert.ok(reaching.length >= 1, `${address}: get-started.css holds a rule that reaches a command block`);
    assert.ok(reaching.some((rule) => rule.context.length === 0), `${address}: a rule that reaches a command block is outside every at-rule: ${reaching.map((rule) => rule.context.join(' ') || 'no at-rule').join(' | ')}`);
  }
});

it('get-started: the wrapping check reads every rule that reaches a command block and keeps its false alarms away', () => {
  const $ = load('<header>site</header><main class="gs"><div class="gs-col"><h2 class="gs-h2">heading</h2><pre class="gs-call" lang="en" translate="no"><code>one line</code></pre><pre class="gs-other">not a command block</pre><p class="note">text <code>inline</code></p></div></main>');
  const GOOD = '.gs-call { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }';
  const problemsOf = (extra, base = GOOD) => wrapProblems($, styleRules(`${base}\n${extra}`));
  assert.deepEqual(problemsOf(''), [], 'the base rule alone has no problem');

  // Each of these rules, put after a good base rule, makes the block stop wrapping or wrap differently; every one must be found, and found for its property.
  const BREAKING = {
    'a descendant rule on the code element': ['.gs-call code { white-space: pre; }', 'white-space: pre'],
    'a descendant with nowrap': ['.gs-call code { white-space: nowrap; }', 'white-space: nowrap'],
    'a child combinator': ['.gs-call > code { white-space: pre; }', 'white-space: pre'],
    'the element selector with the class': ['pre.gs-call { white-space: nowrap; }', 'white-space: nowrap'],
    'a list with a descendant selector': ['pre .gs-call, pre.gs-call code { white-space: pre; }', 'white-space: pre'],
    'a type selector for every code element': ['code { white-space: pre; }', 'white-space: pre'],
    'a type selector for every pre element': ['pre { white-space: pre; }', 'white-space: pre'],
    'a compound of a type and a descendant': ['pre code { white-space: pre; }', 'white-space: pre'],
    'the universal selector': ['* { white-space: pre; }', 'white-space: pre'],
    'a list where one selector reaches the block': ['.other, .gs-call { white-space: pre; }', 'white-space: pre'],
    'a zero-specificity wrapper': [':where(.gs-call) code { white-space: pre; }', 'white-space: pre'],
    'an is() list': [':is(pre, p) > code { white-space: pre; }', 'white-space: pre'],
    'a state of the block': ['.gs-call:hover { white-space: pre; }', 'white-space: pre'],
    'a focus state of the code element': ['.gs-call code:focus-visible { white-space: nowrap; }', 'white-space: nowrap'],
    'a min-width media block above the phone range': ['@media (min-width: 821px) { .gs-call { white-space: pre; } }', 'white-space: pre'],
    'a media block above the phone range on the code element': ['@media (min-width: 821px) { .gs-call code { white-space: pre; } }', 'white-space: pre'],
    'a media block of one width only': ['@media (min-width: 1024px) and (max-width: 1100px) { pre.gs-call { white-space: nowrap; } }', 'white-space: nowrap'],
    'a print media block': ['@media print { .gs-call code { white-space: pre; } }', 'white-space: pre'],
    'a supports block': ['@supports (display: grid) { .gs-call code { white-space: pre; } }', 'white-space: pre'],
    'a cascade layer': ['@layer late { .gs-call code { white-space: pre; } }', 'white-space: pre'],
    'a media block inside a layer': ['@layer late { @media (min-width: 1px) { .gs-call code { white-space: pre; } } }', 'white-space: pre'],
    'a nested rule': ['.gs-call { & code { white-space: pre; } }', 'white-space: pre'],
    'a nested rule with no ampersand': ['.gs-call { code { white-space: pre; } }', 'white-space: pre'],
    'a selector the reader cannot read': ['.gs-call code:not-a-known-pseudo-class { white-space: pre; }', 'white-space: pre'],
    'a nested media block': ['.gs-call { @media (min-width: 1px) { white-space: pre; } }', 'white-space: pre'],
    'important': ['.gs-call code { white-space: pre !important; }', 'white-space: pre !important'],
    'important with no space': ['.gs-call { white-space: nowrap!important; }', 'white-space: nowrap !important'],
    'a later rule that overrides the earlier one': ['.gs-call { white-space: pre; }', 'white-space: pre'],
    'an upper case value': ['.gs-call code { WHITE-SPACE: PRE; }', 'white-space: pre'],
    'a long line with no space breaking never': ['.gs-call { overflow-wrap: normal; }', 'overflow-wrap: normal'],
    'overflow-wrap break-word': ['.gs-call code { overflow-wrap: break-word; }', 'overflow-wrap: break-word'],
    'overflow-wrap on the code element only': ['.gs-call code { overflow-wrap: normal !important; }', 'overflow-wrap: normal !important'],
    'overflow-wrap in a media block': ['@media (min-width: 821px) { .gs-call { overflow-wrap: normal; } }', 'overflow-wrap: normal'],
    'the old name of overflow-wrap': ['.gs-call code { word-wrap: normal; }', 'word-wrap: normal'],
    'a word-break that keeps words': ['.gs-call code { word-break: keep-all; }', 'word-break: keep-all'],
    'a white-space-collapse value': ['.gs-call code { white-space-collapse: collapse; }', 'white-space-collapse: collapse'],
    'a text-wrap value': ['.gs-call code { text-wrap: nowrap; }', 'text-wrap: nowrap'],
    'a text-wrap-mode value': ['.gs-call code { text-wrap-mode: nowrap; }', 'text-wrap-mode: nowrap'],
    'the all shorthand': ['.gs-call code { all: unset; }', 'all: unset'],
    'a width of the content': ['.gs-call code { display: inline-block; width: max-content; }', 'width: max-content'],
    'a minimum width of the content': ['.gs-call { min-width: fit-content; }', 'min-width: fit-content'],
  };
  for (const [name, [rule, expected]] of Object.entries(BREAKING)) {
    const found = problemsOf(rule);
    assert.ok(found.length > 0, `${name}: the rule \`${rule}\` is found`);
    assert.ok(found.some((line) => line.endsWith(expected)), `${name}: the problem names ${expected}: ${found.join(' | ')}`);
  }
  // The size properties: every property that sets the inline size, every kind of value that can be wider than the column, on every way of reaching the block, in every at-rule and with
  // every kind of ordering; each is found for its own property and value, whatever the selector is spelled like.
  const SIZE_PROPERTY_NAMES = ['width', 'min-width', 'inline-size', 'min-inline-size'];
  const TOO_WIDE = ['800px', '321px', '150%', '200%', '100.5%', '120vw', '100vw', '50vw', '47vw', 'min(60vw, 450px)', 'min(100vw - 500px, 2400px - 100vw)', '100vh', '40em', '60rem', '20rem', '30ch', '10in', '600pt', '300mm', 'max-content', 'fit-content', '-webkit-fill-available', 'stretch', 'calc(100% + 1px)', 'calc(100vw - 20px)', 'calc(50px * 20)', 'max(100%, 800px)', 'clamp(10px, 800px, 900px)', 'var(--wide)', 'calc(1px + var(--wide))', '101cqw'];
  const REACHING_SELECTORS = ['.gs-call', 'pre.gs-call', '.gs-col .gs-call', 'main .gs-call', '.gs-call code', 'pre.gs-call > code', 'main pre', 'pre[translate="no"]', 'pre[lang="en"]', 'code', 'pre', '*', ':where(.gs-call)', '.gs-call:hover'];
  const AT_RULES = ['', '@media (min-width: 721px)', '@media (max-width: 720px)', '@media print', '@supports (display: grid)', '@layer late'];
  const sizeRule = (selector, property, value, atRule = '') => (atRule === '' ? `${selector} { ${property}: ${value}; }` : `${atRule} { ${selector} { ${property}: ${value}; } }`);
  const wideSizes = [];
  for (const property of SIZE_PROPERTY_NAMES) for (const value of TOO_WIDE) wideSizes.push([`${property} ${value} on the block`, sizeRule('.gs-call', property, value), property, value]);
  for (const property of SIZE_PROPERTY_NAMES) for (const selector of REACHING_SELECTORS) wideSizes.push([`${property} on ${selector}`, sizeRule(selector, property, '800px'), property, '800px']);
  for (const atRule of AT_RULES.slice(1)) for (const selector of REACHING_SELECTORS) wideSizes.push([`width in ${atRule} on ${selector}`, sizeRule(selector, 'width', '800px', atRule), 'width', '800px']);
  for (const atRule of AT_RULES.slice(1)) for (const property of SIZE_PROPERTY_NAMES) wideSizes.push([`${property} in ${atRule} on the block and the code element`, sizeRule('.gs-call code', property, '800px', atRule), property, '800px']);
  wideSizes.push(
    ['width with important', '.gs-call { width: 800px !important; }', 'width', '800px !important'],
    ['width with important and no space', '.gs-call { width: 800px!important; }', 'width', '800px !important'],
    ['upper case property and unit', '.gs-call { WIDTH: 800PX; }', 'width', '800px'],
    ['the declaration after others', '.gs-call { color: red; margin: 0; width: 800px; padding: 0 }', 'width', '800px'],
    ['a later override of a harmless width', '.gs-call { width: 100%; } .gs-call { width: 800px; }', 'width', '800px'],
    ['a later override in a media block', '.gs-call { width: auto; } @media (min-width: 721px) { pre.gs-call { min-width: 800px; } }', 'min-width', '800px'],
    ['a nested rule', '.gs-call { & code { min-inline-size: 800px; } }', 'min-inline-size', '800px'],
    ['a nested media block', '.gs-call { @media (min-width: 1px) { inline-size: 800px; } }', 'inline-size', '800px'],
    ['a media block inside a layer', '@layer late { @media (min-width: 1px) { .gs-call code { width: 800px; } } }', 'width', '800px'],
    ['a selector list with one selector that reaches', '.other, .gs-col .gs-call { min-width: 800px; }', 'min-width', '800px'],
    ['two sizes in one rule', '.gs-call { width: 100%; min-width: 800px; }', 'min-width', '800px'],
  );
  for (const [name, rule, property, value] of wideSizes) {
    const found = problemsOf(rule);
    assert.ok(found.some((line) => line.endsWith(`sets ${property}: ${value}`)), `${name}: \`${rule}\` is found for ${property}: ${value}: ${found.join(' | ') || 'no problem'}`);
  }
  // A size that stays inside the column is accepted on every way of reaching the block, together with the rules around it that are no size.
  const NARROW = ['auto', '0', '0px', '100%', '50%', '10ch', '17rem', '280px', '17em', '280px !important', 'min-content', 'initial', 'unset', 'inherit', 'revert', 'min(100%, 800px)', 'min(800px, 100%)', 'calc(100% - 2rem)', 'calc(100% - 40px)', 'clamp(10px, 50%, 800px)', 'calc(50% + 10px)', 'min(100vw, 100%)', 'calc(100% / 2)', 'calc(25% * 2)', '0vw', '0vh'];
  for (const property of SIZE_PROPERTY_NAMES) {
    for (const value of NARROW) assert.deepEqual(problemsOf(`.gs-call { ${property}: ${value}; } pre.gs-call code { ${property}: ${value}; }`), [], `${property}: ${value} stays inside the column`);
  }
  const NOT_A_SIZE = [
    '.gs-call { max-width: 100%; } .gs-call { max-width: 800px; } .gs-call code { max-width: 800px !important; }',
    '.gs-call { max-inline-size: 800px; max-block-size: 800px; block-size: 800px; height: 800px; min-height: 800px; }',
    '.gs-call { flex-basis: 800px; margin: 0 800px 0 0; padding: 0 20px; }',
    '@media (min-width: 721px) { pre.gs-call { max-width: 800px; width: 100%; } }',
  ];
  for (const css of NOT_A_SIZE) assert.deepEqual(problemsOf(css), [], `no size is set by ${css}`);
  // A fixed size or a width on a rule that does not reach a block is not a problem, however wide, in any at-rule.
  const OTHER_ELEMENTS = ['.gs-hero', '.home-col', 'header', 'h2', '.gs-h2', '.gs-col', '.gs', 'main', 'p', '.note', 'p code', 'pre.gs-other', '.gs-other', 'pre:not([translate])', 'pre[lang="tr"]', '.gs-unused', 'pre.gs-unused', '.gs-call + p', '.gs-call ~ pre', '.gs-call::before', '.gs-call code::after', '.gs-col > pre.gs-other'];
  for (const selector of OTHER_ELEMENTS) {
    for (const property of SIZE_PROPERTY_NAMES) {
      for (const atRule of AT_RULES) assert.deepEqual(problemsOf(sizeRule(selector, property, '800px', atRule)), [], `${property}: 800px on ${selector}${atRule === '' ? '' : ` in ${atRule}`} does not reach a block`);
    }
    assert.deepEqual(problemsOf(sizeRule(selector, 'width', 'max-content')), [], `width: max-content on ${selector} does not reach a block`);
  }
  assert.deepEqual(problemsOf('@keyframes k { from { width: 10px; } to { width: 800px; } } @font-face { font-family: x; src: local(x); width: 800px; }'), [], 'keyframes and font faces are not rules of the block');
  assert.deepEqual(problemsOf('.note { & code { width: 800px; } @media (min-width: 1px) { min-width: 800px; } }'), [], 'a nested rule of another element is not a rule of the block');
  // The same rule is a problem on a page where the selector reaches a block and none on a page where it matches nothing: reach is read from the page, not from the text of the selector.
  const bare = load('<main><pre class="gs-call"><code>x</code></pre></main>');
  assert.deepEqual(wrapProblems(bare, styleRules(`${GOOD} .gs-col .gs-call { width: 800px; } main > pre:first-child { min-width: 800px; }`)).map((line) => line.split(' sets ')[1]), ['min-width: 800px'], 'a selector that matches nothing on the page is no problem, one that matches is');
  // The size reader on its own: the value, whether it can be wider than the column.
  for (const value of TOO_WIDE.map((v) => v.toLowerCase())) assert.equal(sizeCanExceed(value), true, `${value} can exceed the column`);
  for (const value of NARROW.filter((v) => !v.includes('!'))) assert.equal(sizeCanExceed(value), false, `${value} cannot exceed the column`);
  // Every family of value a size can take, one by one, on every size property: a length unit, a viewport unit, a container query unit, a keyword and a function. Each is found when it can be
  // wider than the column and accepted when it cannot, so no family is read as harmless without being worked out.
  const sizeFound = (property, value, selector = '.gs-call') => problemsOf(sizeRule(selector, property, value)).some((line) => line.endsWith(`sets ${property}: ${value}`));
  const FIXED_UNITS = ['px', 'em', 'rem', 'ch', 'ex', 'in', 'pt', 'pc', 'mm', 'cm', 'q', 'lh', 'rlh', 'cap', 'ic'];
  const WIDTH_VIEWPORT_UNITS = ['vw', 'vi', 'svw', 'svi', 'lvw', 'lvi', 'dvw', 'dvi'];
  const OTHER_VIEWPORT_UNITS = ['vh', 'vb', 'svh', 'svb', 'lvh', 'lvb', 'dvh', 'dvb', 'vmin', 'vmax', 'svmin', 'svmax', 'lvmin', 'lvmax', 'dvmin', 'dvmax'];
  const CQ_WIDTH_UNITS = ['cqw', 'cqi'];
  const CQ_OTHER_UNITS = ['cqh', 'cqb', 'cqmin', 'cqmax'];
  const READ_UNITS = [...FIXED_UNITS, '%', ...WIDTH_VIEWPORT_UNITS, ...OTHER_VIEWPORT_UNITS, ...CQ_WIDTH_UNITS, ...CQ_OTHER_UNITS];
  for (const property of SIZE_PROPERTY_NAMES) {
    for (const unit of [...READ_UNITS, 'rcap', 'rch', 'rex', 'ric', 'x', 'dppx', 'fr']) {
      assert.equal(sizeFound(property, `5000${unit}`), true, `${property}: 5000${unit} is found`);
      assert.equal(sizeFound(property, `5000${unit}`, 'pre.gs-call code'), true, `${property}: 5000${unit} on the code element is found`);
      assert.equal(sizeFound(property, `5000${unit}`, '.gs-hero'), false, `${property}: 5000${unit} on an element outside the block is not found`);
    }
    for (const unit of READ_UNITS) assert.equal(sizeFound(property, `0${unit}`), false, `${property}: 0${unit} is zero and is accepted`);
    for (const unit of [...FIXED_UNITS, '%', ...WIDTH_VIEWPORT_UNITS, ...CQ_WIDTH_UNITS]) assert.equal(sizeFound(property, `1${unit}`), false, `${property}: 1${unit} stays inside the column`);
    // A height unit (or the smaller or larger side) has no width, so any size in it is read as one that can exceed the column.
    for (const unit of [...OTHER_VIEWPORT_UNITS, ...CQ_OTHER_UNITS]) assert.equal(sizeFound(property, `1${unit}`), true, `${property}: 1${unit} is found, a unit of the height cannot be told from the column`);
  }
  // Container query units: no stylesheet of the site sets a query container, so each reads as the small viewport unit of its axis (cqw and cqi as vw, cqh and cqb as vh, cqmin and cqmax as vmin and vmax),
  // at every number and on every property; none is read as a share of the column.
  for (const property of SIZE_PROPERTY_NAMES) {
    for (const unit of [...CQ_WIDTH_UNITS, ...CQ_OTHER_UNITS]) {
      for (const number of ['100', '95', '88', '50', '60', '90', '101', '70', '40.5']) {
        assert.equal(sizeFound(property, `${number}${unit}`), true, `${property}: ${number}${unit} is found, it falls back to the viewport and not to the column`);
        assert.equal(sizeCanExceed(`${number}${unit}`), true, `${number}${unit} can exceed the column`);
      }
    }
    for (const value of ['100cqw', '88cqw', '50cqh', '100cqh', '60cqmin', '90cqmax']) {
      for (const atRule of AT_RULES.slice(1)) assert.equal(problemsOf(sizeRule('.gs-call', property, value, atRule)).some((line) => line.endsWith(`sets ${property}: ${value}`)), true, `${property}: ${value} in ${atRule} is found`);
      for (const selector of ['pre.gs-call', '.gs-col .gs-call', '.gs-call code', 'pre', '*']) assert.equal(sizeFound(property, value, selector), true, `${property}: ${value} on ${selector} is found`);
      assert.equal(problemsOf(`.gs-call { ${property}: ${value} !important; }`).some((line) => line.endsWith(`sets ${property}: ${value} !important`)), true, `${property}: ${value} !important is found`);
      assert.equal(problemsOf(`.gs-call { ${property}: 100%; } .gs-call { ${property}: ${value}; }`).length, 1, `${property}: a later ${value} over a harmless size is found`);
    }
  }
  // A page whose stylesheet does declare a query container on an ancestor is read the same way on purpose (a container query unit is never read as a share of the column): the size is found, and
  // the rule that declares the container is no problem.
  for (const container of ['.gs-col { container-type: inline-size; }', 'main { container-type: size; container-name: gs; }', '.gs-col { container: gs / inline-size; }', '.gs { container-type: inline-size; } .gs-col { container-type: inline-size; }']) {
    for (const property of SIZE_PROPERTY_NAMES) {
      assert.deepEqual(problemsOf(container), [], `${container}: a container declaration alone is no problem`);
      for (const value of ['100cqw', '100cqi', '95cqw', '88cqw', '100cqh', '60cqmin', '90cqmax']) {
        const found = problemsOf(`${container} .gs-call { ${property}: ${value}; }`);
        assert.equal(found.length, 1, `${container} then ${property}: ${value}: one problem: ${found.join(' | ') || 'none'}`);
        assert.ok(found[0].endsWith(`sets ${property}: ${value}`), `${container} then ${property}: ${value}: the problem names the size: ${found[0]}`);
      }
    }
  }
  assert.equal(sizeAt('100cqw', { column: 280, viewport: 320 }), 320, 'cqw is the width of the viewport and not of the column');
  assert.equal(sizeAt('50cqi', { column: 390, viewport: 821 }), 410.5, 'cqi is the width of the viewport and not of the column');
  assert.equal(sizeAt('100cqh', { column: 280, viewport: 320 }), Infinity, 'cqh is a unit of the height');
  assert.equal(sizeAt('100cqb', { column: 280, viewport: 320 }), Infinity, 'cqb is a unit of the height');
  assert.equal(sizeAt('60cqmin', { column: 680, viewport: 1400 }), Infinity, 'cqmin is a unit of the smaller side');
  assert.equal(sizeAt('90cqmax', { column: 680, viewport: 1400 }), Infinity, 'cqmax is a unit of the larger side');
  assert.equal(sizeAt('0cqh', { column: 680, viewport: 1400 }), 0, 'a zero of a height unit is zero');
  for (const value of ['100cqw', '88cqw', '50cqh', '100cqmin', '100cqmax', '100cqi', '100cqb']) assert.equal(sizeAt(value, { column: 280, viewport: 320 }) === sizeAt(value.replace('cq', 'v'), { column: 280, viewport: 320 }), true, `${value} reads as its viewport unit`);
  // Keywords and functions: each that can be wider than the column, or that the reader cannot work out, is found; each that cannot is accepted.
  const WIDE_KEYWORDS = ['max-content', 'fit-content', 'fit-content(20rem)', 'fit-content(100%)', 'fit-content(100px)', 'stretch', '-webkit-fill-available', '-moz-available', 'available', 'contain', 'intrinsic', 'min-intrinsic', 'Fit-Content'];
  const UNREADABLE_FUNCTIONS = ['var(--w)', 'var(--w, 10px)', 'var(--w, 100%)', 'env(safe-area-inset-left)', 'env(safe-area-inset-left, 0px)', 'attr(data-w px)', 'attr(data-w type(<length>), 10px)', 'anchor-size(width)', 'anchor-size(--a width)', 'calc(var(--w) + 1px)', 'calc(100% - env(safe-area-inset-left))', 'min(var(--w), 100%)', 'max(100%, var(--w))', 'clamp(1px, var(--w), 2px)', 'calc(anchor-size(width) * 2)', 'calc(attr(data-w px) + 1px)', 'unknown(10px)', 'calc(1px +)', 'calc()', 'min()', 'clamp(1px, 2px)', 'calc(1px, 2px)'];
  const WIDE_EXPRESSIONS = ['calc(100% + 1px)', 'calc(100vw)', 'calc(100cqw)', 'calc(100% + 1cqw)', 'calc(88cqw + 1px)', 'calc(100cqw - 1px)', 'calc(100% * 2)', 'calc(100% / 0.5)', 'calc(2 * 100%)', 'calc(100% + 100%)', 'calc((100% + 1px))', 'calc(100% + (1px))', 'min(100cqw, 800px)', 'min(800px, 90cqmax)', 'max(100%, 100cqw)', 'max(10px, 88cqi)', 'clamp(10px, 100cqw, 900px)', 'clamp(100cqh, 10px, 900px)', 'clamp(800px, 10%, 900px)', 'min(900px, 800px, 100cqh)', 'calc(100cqmin - 10px)', 'calc(100cqmax / 2)', 'calc(1px * 100cqb)', 'calc(50cqh + 50%)', 'calc(-1 * -100cqw)', 'calc(100%+1px)', 'calc(0px + 321px)', 'max(321px, 0px)', 'min(321px, 321px)', 'calc(281px)', 'calc(100% + 0.01px)'];
  for (const property of SIZE_PROPERTY_NAMES) {
    for (const value of [...WIDE_KEYWORDS.map((v) => v.toLowerCase()), ...UNREADABLE_FUNCTIONS, ...WIDE_EXPRESSIONS]) {
      assert.equal(sizeFound(property, value), true, `${property}: ${value} is found`);
      assert.equal(sizeCanExceed(value), true, `${value} can exceed the column`);
    }
  }
  const NARROW_EXPRESSIONS = ['max(10px, 50%)', 'calc(100% - 1cqw)', 'calc(100% - 4em)', 'min(100cqw, 100%)', 'min(100%, 100cqw)', 'min(100cqh, 100%)', 'clamp(10px, 10cqw, 100%)', 'clamp(1px, 50%, 100cqw)', 'calc(10cqw)', 'calc(5cqi + 5cqw)', 'calc(100% - 100cqw + 10px)', 'min(10px, 20px)', 'calc(1px * 10)', 'calc(100% / 4)', 'calc(((100%)))', 'max(0px, 0%)', 'min(1px, 2px, 3px)', 'calc(1in + 1cm)', 'calc(2ch + 2em)'];
  for (const property of SIZE_PROPERTY_NAMES) {
    for (const value of NARROW_EXPRESSIONS) {
      assert.equal(sizeFound(property, value), false, `${property}: ${value} stays inside the column`);
      assert.equal(sizeCanExceed(value), false, `${value} cannot exceed the column`);
    }
  }
  assert.equal(sizeAt('calc(100% - 2rem)', { column: 280, viewport: 320 }), 248, 'calc is worked out against the column');
  assert.equal(sizeAt('clamp(10px, 50%, 800px)', { column: 680, viewport: 1400 }), 340, 'clamp is worked out against the column');
  assert.equal(sizeAt('min(100vw, 100%)', { column: 390, viewport: 821 }), 390, 'min takes the smaller of a viewport and a column size');
  // One bad rule is one problem, and the good base rule alone is none.
  assert.equal(problemsOf('.gs-call code { white-space: pre; }').length, 1, 'one rule gives one problem');
  // The block loses a base rule: none, only in a media block, only for one of the two properties, a base rule for another element, or a rule with the wrong value.
  const MISSING = {
    'no rule at all': ['', 'white-space: pre-wrap|overflow-wrap: anywhere'],
    'both only in the phone block': ['@media (max-width: 720px) { .gs-call { white-space: pre-wrap; overflow-wrap: anywhere; } }', 'white-space: pre-wrap|overflow-wrap: anywhere'],
    'no overflow-wrap': ['.gs-call { white-space: pre-wrap; }', 'overflow-wrap: anywhere'],
    'no white-space': ['.gs-call { overflow-wrap: anywhere; }', 'white-space: pre-wrap'],
    'the rule styles another class': ['.gs-other { white-space: pre-wrap; overflow-wrap: anywhere; }', 'white-space: pre-wrap|overflow-wrap: anywhere'],
    'the only rule has a selector the reader cannot read': ['.gs-call:not-a-known-pseudo-class { white-space: pre-wrap; overflow-wrap: anywhere; }', 'white-space: pre-wrap|overflow-wrap: anywhere'],
    'the rule is inside a layer': ['@layer base { .gs-call { white-space: pre-wrap; overflow-wrap: anywhere; } }', 'white-space: pre-wrap|overflow-wrap: anywhere'],
  };
  for (const [name, [css, expected]] of Object.entries(MISSING)) {
    const found = wrapProblems($, styleRules(css));
    for (const property of expected.split('|')) assert.ok(found.some((line) => line.includes(`outside every at-rule sets ${property}`)), `${name}: the missing ${property} is named: ${found.join(' | ')}`);
    assert.equal(found.length, expected.split('|').length, `${name}: nothing else is reported: ${found.join(' | ')}`);
  }
  assert.ok(wrapProblems(load('<main><p>no block</p></main>'), styleRules(GOOD)).includes('the page has no command block'), 'a page with no command block is a problem');

  // Rules that do not touch the block are not a problem, however they are written.
  const HARMLESS = {
    'an element that is not in the block': '.note { white-space: pre; } p { white-space: nowrap; } p code { white-space: pre; }',
    'the same value as the base rule': '.gs-call code { white-space: pre-wrap !important; overflow-wrap: anywhere; }',
    'a media block with other properties': '@media (min-width: 821px) { .gs-call { padding: 4px; } .gs-call code { color: red; } }',
    'a nested rule of another element': '.note { & code { white-space: pre; } code { white-space: nowrap; } @media (min-width: 1px) { white-space: pre; } }',
    'a pseudo-element': '.gs-call::before { white-space: pre; } .gs-call code::after { white-space: nowrap; }',
    'a comment': '/* .gs-call code { white-space: pre; } */',
    'a declaration text': '.note { content: "} .gs-call code { white-space: pre; }"; quotes: "a;b" "{"; }',
    'a font face and keyframes': '@font-face { font-family: x; src: url("data:font/woff2;base64,AAAA") format("woff2"); white-space: pre; } @keyframes k { from { white-space: pre; } to { white-space: nowrap; } }',
    'a statement at-rule': '@layer a, b; @import url("x.css");',
    'a sibling that is not the block': '.gs-call + p { white-space: pre; } .note > code { white-space: pre; }',
  };
  for (const [name, css] of Object.entries(HARMLESS)) assert.deepEqual(problemsOf(css), [], `${name}: no problem`);
  // The reader keeps a value with a semicolon in a url, the at-rule around a rule and the order of the declarations.
  const parsed = styleRules('.a { background: url(data:image/svg+xml;utf8,x); color: red } @media (min-width: 1px) { .b, .c { margin: 0 } }');
  assert.deepEqual(parsed.map((rule) => [rule.selectors, rule.context, rule.declarations.map((d) => d.property)]), [[['.a'], [], ['background', 'color']], [['.b', '.c'], ['@media (min-width: 1px)'], ['margin']]], 'the reader keeps selectors, at-rule context and declaration order');
  // The reader keeps the sizes whole: a value with parentheses and commas, a flag, upper case, a size in a media block and in a nested rule.
  const sizes = styleRules('.a { Width: CALC(100% - 2rem) !IMPORTANT; min-inline-size: min(100%, 800px) } @media (max-width: 720px) { pre.b > code { inline-size: 800PX } } .c { & d { min-width: 10ch; } }');
  assert.deepEqual(sizes.map((rule) => [rule.selectors, rule.context, rule.declarations]), [
    [['.a'], [], [{ property: 'width', value: 'calc(100% - 2rem)', important: true }, { property: 'min-inline-size', value: 'min(100%, 800px)', important: false }]],
    [['pre.b > code'], ['@media (max-width: 720px)'], [{ property: 'inline-size', value: '800px', important: false }]],
    [['.c'], [], []],
    [['.c d'], [], [{ property: 'min-width', value: '10ch', important: false }]],
  ], 'the reader keeps a size with its flag, its case and its at-rule');
});

it('get-started: each page file passes every prop of Base and GetStarted by name', () => {
  const expected = {
    en: { base: { path: '"/get-started/"', title: "{{ kind: 'site', text: content.title }}", lead: '{content.lead}' }, start: { lang: '"en"', content: '{content}', facts: '{facts}' } },
    tr: {
      base: { path: '"/tr/baslarken/"', title: "{{ kind: 'site', text: content.title }}", lead: '{content.lead}', source: "{{ kind: 'site', translatedFrom: frontmatter.translatedFrom }}" },
      start: { lang: '"tr"', content: '{content}', facts: '{facts}' },
    },
  };
  for (const [lang, , address] of PAGES) {
    const source = read(PAGE_FILE[lang]);
    const bases = propsOf(source, 'Base');
    const starts = propsOf(source, 'GetStarted');
    assert.equal(bases.length, 1, `${address}: one Base element`);
    assert.equal(starts.length, 1, `${address}: one GetStarted element`);
    assert.deepEqual(bases[0], expected[lang].base, `${address}: the props of Base`);
    assert.deepEqual(starts[0], expected[lang].start, `${address}: the props of GetStarted`);
    assert.equal(bases[0].path, `"${GET_STARTED_PAGE[lang]}"`, `${address}: the path of Base is the address of the page`);
    assert.equal(starts[0].lang, `"${lang}"`, `${address}: the language of GetStarted is the language of the page`);
    // Where the values come from: the content file of the page, its own frontmatter and the pin facts.
    const importPath = /import \{ frontmatter \} from '([^']+)';/.exec(source)?.[1];
    assert.ok(importPath, `${address}: the frontmatter is imported`);
    assert.equal(join(dirname(join(root, PAGE_FILE[lang])), importPath), join(root, CONTENT_FILE[lang]), `${address}: the content file is the one of the language`);
    assert.match(source, /^const content = readGetStartedContent\(frontmatter\);$/m, `${address}: the content is checked by the helper`);
    assert.match(source, /^const facts = startFacts\(\);$/m, `${address}: the facts are the pin facts`);
  }
  // The element reader itself: an extra prop, a string prop and an expression with a brace and a quote inside are all read.
  assert.deepEqual(propsOf("<Base a=\"x y\" b={{ k: 'v}', n: 1 }} c={z}>\n</Base>", 'Base'), [{ a: '"x y"', b: "{{ k: 'v}', n: 1 }}", c: '{z}' }], 'the reader keeps every prop as written');
  assert.deepEqual(propsOf('<GetStarted lang="en" />', 'Base'), [], 'another element is not read');
});

it('get-started: the page files rendered from a fixture root print their own head, content and pin facts', () => {
  const alternatesOf = ($) => $('link[rel="alternate"][hreflang]').toArray().map((el) => ({ hreflang: $(el).attr('hreflang'), href: $(el).attr('href') }));
  for (const [lang, , address] of PAGES) {
    const run = pageRuns.good[lang];
    assert.equal(run.error, undefined, `${address}: the page renders: ${run.error?.message}`);
    const $ = load(run.value.html);
    const built = page(lang);
    assert.equal($('html').attr('lang'), lang, `${address}: the language of the page follows its path`);
    assert.equal($('title').text(), TITLE[lang], `${address}: the title`);
    assert.equal($('h1').text(), H1[lang], `${address}: the heading comes from the content file of the language`);
    assert.deepEqual(alternatesOf($), alternatesOf(built), `${address}: the alternates follow the path`);
    assert.equal(alternatesOf($).find((link) => link.hreflang === lang)?.href, `${ORIGIN}${address}`, `${address}: the alternate of its own language is its own address`);
    const lead = squash(frontmatterOf(lang).lead);
    assert.ok(($('meta[name="description"]').attr('content') ?? '').startsWith(lead.slice(0, 60)), `${address}: the description starts with the lead of the content file`);
    assert.equal($('meta[name="description"]').attr('content'), built('meta[name="description"]').attr('content'), `${address}: the description is the one of the build`);
    assert.deepEqual(linesOf($, $('pre').last()), FIRST, `${address}: the blocks hold the README commands of the fixture facts`);
    assert.deepEqual(run.value.warnings, [], `${address}: a matching stamp prints no warning`);
  }
});

it('get-started: a bad README line fails each page file naming its own address', () => {
  for (const [lang, , address] of PAGES) {
    const run = pageRuns.badReadme[lang];
    assert.ok(run.error, `${address}: a README without the line fails the page`);
    assert.ok(run.error.message.includes(`${address}: command not in the README at the pin: proofline doctor`), `${address}: the message names the page and the line: ${run.error.message.slice(0, 160)}`);
    for (const [, , other] of PAGES.filter(([otherLang]) => otherLang !== lang)) assert.equal(run.error.message.includes(`${other}:`), false, `${address}: the message does not name ${other}`);
  }
});

it('get-started: the Turkish page file warns for a stale English source and fails naming the page for an unreadable stamp', () => {
  const stale = pageRuns.stale;
  assert.equal(stale.tr.error, undefined, `a stale stamp still renders: ${stale.tr.error?.message}`);
  assert.deepEqual(stale.tr.value.warnings, ['[proofline] warning: /tr/baslarken/: the English source changed since this translation'], 'the Turkish page warns once, naming itself');
  assert.equal(stale.en.error, undefined, 'the English page renders');
  assert.deepEqual(stale.en.value.warnings, [], 'the English page carries no stamp and warns of nothing');
  const missing = pageRuns.noEnglish;
  assert.ok(missing.tr.error, 'a stamp that names a file that is not there fails the Turkish page');
  assert.ok(missing.tr.error.message.startsWith('/tr/baslarken/: '), `the error names the Turkish page: ${missing.tr.error.message.slice(0, 120)}`);
  assert.equal(missing.en.error, undefined, 'the English page reads no stamp and renders');
});

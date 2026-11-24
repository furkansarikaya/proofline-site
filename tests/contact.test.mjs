// Node tests for the contact page in English and Turkish (TASK-026).
// The setup, which runs when the file is loaded and before the first test starts (so the time of the build is the time of no test), fetches the pinned documents, builds the real site once into a folder of its own under .cache (never dist/, never the shared .tmp), serves that build to
// Chromium of the Playwright library (it measures the four link targets, the focus ring, the rows, the paragraph and the header at several widths, so the tests only read numbers), and
// opens one Vite server for the Astro container, which renders the page files from fixture roots (a matching, a stale and a missing English content file). The build, the browser
// launch and the Vite server start side by side, and each page is loaded once and resized, so the setup stays short. A setup that failed is named by the first test. Every test only
// reads what the setup produced, so the per-test budgets measure assertions only. The render helpers, the style readers and the fixture-root helper are test-local (copied from the get-started tests).
import { after, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { load } from 'cheerio';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import YAML from 'yaml';
import { startServer } from '../scripts/serve-dist.mjs';
import { ENV_KEYS } from '../src/lib/indexing.ts';
import { CONTACT_PAGE, EMAIL_ADDRESS, OWNER, TEXT_KEYS as LIB_TEXT_KEYS, readContactContent } from '../src/lib/contact.ts';
import { ORIGIN } from '../src/lib/meta.ts';
import { MENU, menu } from '../src/lib/nav.ts';
import { PAIRS, alternates, contentHash, createIndex, isStale, switcherTarget } from '../src/lib/translations.ts';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
sweepStale();

// ---- the strings of the TASK-026 Context, written out here and never read from the code under test --------------------------------------------------------

const PAGES = [['en', 'contact/index.html', '/contact/'], ['tr', 'tr/iletisim/index.html', '/tr/iletisim/']];
const PHRASE = {
  en: 'proofline: a deterministic engineering team for Claude Code and Codex',
  tr: 'proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi',
};
const H1 = { en: 'Contact', tr: 'İletişim' };
const TITLE = { en: `Contact | ${PHRASE.en}`, tr: `İletişim | ${PHRASE.tr}` };
/** The four addresses of the owner: the values of the product owner (PRD note N-6), character for character. */
const GITHUB = 'https://github.com/furkansarikaya';
const LINKEDIN = 'https://www.linkedin.com/in/furkansarikaya';
const MEDIUM = 'https://furkansarikaya.medium.com/';
const ADDRESS = 'furkannsarikaya@gmail.com';
const MAILTO = `mailto:${ADDRESS}`;
const HREFS = [GITHUB, LINKEDIN, MEDIUM, MAILTO];
/** The texts of the four rows: the three link texts, and the word of the e-mail row (the e-mail link itself shows the address). */
const TEXTS = { en: ['GitHub', 'LinkedIn', 'Medium', 'E-mail'], tr: ['GitHub', 'LinkedIn', 'Medium', 'E-posta'] };
const REPO = 'https://github.com/furkansarikaya/proofline';
const SITE_REPO = 'https://github.com/furkansarikaya/proofline-site';
const GITHUB_NAME = { en: 'proofline on GitHub', tr: "GitHub'da proofline" };
const FOOTER = {
  en: 'No cookies and no analytics scripts. The host keeps ordinary request logs. MIT licensed (LICENSE). Built with proofline.',
  tr: 'Çerez ve analitik betiği yok. Barındırıcı olağan istek günlüklerini tutar. MIT lisanslı (LICENSE). proofline ile yapıldı.',
};
/** The header menu of each language, in order, with the new entry last (ADR 0010, DESIGN-marketing.md "Contact page"). */
const MENU_HREFS = {
  en: ['/', '/get-started/', '/claude-code-and-codex/', '/contact/'],
  tr: ['/tr/', '/tr/baslarken/', '/tr/claude-code-ve-codex/', '/tr/iletisim/'],
};
const MENU_LABELS = {
  en: ['Home', 'Get started', 'Claude Code + Codex', 'Contact'],
  tr: ['Ana sayfa', 'Başlarken', 'Claude Code ve Codex', 'İletişim'],
};
/** The pages the menu rule is read on: the four site pages in both languages and the not-found page; every other built page is read as well. */
const MENU_PAGES = ['index.html', 'tr/index.html', 'get-started/index.html', 'tr/baslarken/index.html', 'claude-code-and-codex/index.html', 'tr/claude-code-ve-codex/index.html', 'contact/index.html', 'tr/iletisim/index.html', '404.html'];
const TEXT_KEYS = ['title', 'lead', 'paragraph', 'links.github', 'links.linkedin', 'links.medium', 'links.email'];
/** The longest lead that is not cut when the description suffix is added (ADR 0002 point 7: 160 characters less the suffix of 71 and 74 characters). */
const LEAD_MAX = { en: 89, tr: 86 };
const CONTENT_FILE = { en: 'src/content/pages/en/contact.md', tr: 'src/content/pages/tr/iletisim.md' };
const PAGE_FILE = { en: 'src/pages/contact/index.astro', tr: 'src/pages/tr/iletisim/index.astro' };
const OTHER_PAGES = ['get-started/index.html', 'tr/baslarken/index.html', 'claude-code-and-codex/index.html', 'tr/claude-code-ve-codex/index.html'];

const squash = (text) => text.replace(/\s+/g, ' ').trim();
const read = (rel) => readFileSync(join(root, rel), 'utf8');

/** The frontmatter of a contact content file as the page imports it. */
function frontmatterOf(lang) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(read(CONTENT_FILE[lang]));
  assert.ok(match, `${CONTENT_FILE[lang]} starts with a frontmatter block`);
  return YAML.parse(match[1]);
}

/** The leaf key paths of a parsed frontmatter. */
const leaves = (value, prefix = '') => Object.entries(value).flatMap(([k, v]) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const get = (object, key) => key.split('.').reduce((v, k) => v[k], object);

/** A repository root that holds the English content file (when given), where the translation stamp of the Turkish page looks for it. */
function fixtureRoot({ english = null } = {}) {
  const dir = makeTempDir('proofline-site-contact-');
  if (english !== null) {
    mkdirSync(join(dir, dirname(CONTENT_FILE.en)), { recursive: true });
    writeFileSync(join(dir, CONTENT_FILE.en), english);
  }
  return dir;
}

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

// ---- contact helpers ------------------------------------------------------------------------------------------------------------------------------------

/** The files under a folder, relative, sorted. */
function walk(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

/**
 * The problems with the owner links of one page (an empty list means none): exactly four links in main, in the order GitHub, LinkedIn, Medium, e-mail, each with its exact address;
 * the first three show their word, the e-mail link shows the address and its row holds the word of the language in front of it; one list item per link.
 */
function linkProblems($, lang) {
  const problems = [];
  const links = $('main a').toArray();
  if (links.length !== 4) problems.push(`main holds ${links.length} links, expected 4`);
  if ($('main li').length !== 4) problems.push(`main holds ${$('main li').length} list items, expected 4`);
  HREFS.forEach((href, i) => {
    const a = links[i];
    if (a === undefined) return;
    if (a.attribs.href !== href) problems.push(`link ${i + 1}: the address is "${a.attribs.href}", expected "${href}"`);
    const text = squash($(a).text());
    const expected = i === 3 ? ADDRESS : TEXTS[lang][i];
    if (text !== expected) problems.push(`link ${i + 1}: the text is "${text}", expected "${expected}"`);
    const row = squash($(a).closest('li').text());
    const rowExpected = i === 3 ? `${TEXTS[lang][3]} ${ADDRESS}` : TEXTS[lang][i];
    if (row !== rowExpected) problems.push(`link ${i + 1}: the row reads "${row}", expected "${rowExpected}"`);
  });
  return problems;
}

/** A copy of a page with a change made to it: `change($)`; returns the parsed copy. */
function changed(html, change) {
  const $ = load(html);
  change($);
  return $;
}

const REPO_LINK = /^https:\/\/github\.com\/furkansarikaya\/(?:proofline|proofline-site|proofline\/blob\/(?:[0-9a-f]{40}|main)\/LICENSE)$/;
const OWNER_EXTERNAL = [GITHUB, LINKEDIN, MEDIUM];
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/**
 * What a contact page must not hold, as readable lines (an empty list means none): no form, input, textarea or select; the one button of the page is the theme button of the header; no
 * `ping` attribute; no query string on a link; no script but the controls script (in the head, with no body); no embedded or loaded resource from another host, no frame, image, media or object
 * element; an absolute link only to the three external owner addresses in main and to the repository addresses of the header and the footer.
 */
function forbiddenProblems($) {
  const problems = [];
  for (const selector of ['form', 'input', 'textarea', 'select']) if ($(selector).length > 0) problems.push(`the page holds a ${selector} element`);
  if ($('main button').length > 0) problems.push('main holds a button element');
  if ($('button').not('header button#b-theme').length > 0) problems.push('the page holds a button element besides the theme button');
  if ($('[ping]').length > 0) problems.push('the page holds a ping attribute');
  for (const a of $('a[href]').toArray()) if (a.attribs.href.includes('?')) problems.push(`a link has a query string: ${a.attribs.href}`);
  const scripts = $('script').toArray();
  if (scripts.length !== 1 || scripts[0].attribs.src !== '/assets/controls.js' || $(scripts[0]).text() !== '' || scripts[0].parent.tagName !== 'head') problems.push(`the scripts are not the controls script alone: ${scripts.length}`);
  for (const el of $('iframe, frame, embed, object, applet, img, picture, video, audio, source, track, canvas').toArray()) problems.push(`the page holds a ${el.tagName} element`);
  for (const el of $('[src], [srcset], [poster], [data], [action], [formaction]').toArray()) {
    for (const name of ['src', 'srcset', 'poster', 'data', 'action', 'formaction']) {
      const value = el.attribs[name];
      if (value === undefined) continue;
      if (el.tagName === 'script' && name === 'src' && value === '/assets/controls.js') continue;
      problems.push(`${el.tagName} ${name} is a resource: ${value}`);
    }
  }
  for (const el of $('link[href]').toArray()) {
    const href = el.attribs.href;
    const own = href.startsWith('/') && !href.startsWith('//');
    const head = ['alternate', 'canonical'].includes(el.attribs.rel) && href.startsWith(`${ORIGIN}/`);
    if (!own && !head) problems.push(`a link element loads ${href}`);
  }
  for (const el of $('a[href]').toArray()) {
    const href = el.attribs.href;
    if (href.startsWith('mailto:')) {
      if (href !== MAILTO) problems.push(`a mailto link is not the owner address: ${href}`);
    } else if (ABSOLUTE.test(href)) {
      const inMain = $(el).closest('main').length === 1;
      const allowed = inMain ? OWNER_EXTERNAL.includes(href) : REPO_LINK.test(href);
      if (!allowed) problems.push(`an absolute link ${inMain ? 'in main' : 'outside main'} is not allowed: ${href}`);
    }
  }
  if ($('[style]').length > 0 || $('style').length > 0) problems.push('the page holds an inline style');
  if ($('meta[http-equiv]').length > 0) problems.push('the page holds a meta http-equiv');
  return problems;
}

/** The problems of one header menu (a list of `{ href, label }`) for a language: the four entries in the order, Contact last. */
function menuProblems(items, lang) {
  const problems = [];
  const hrefs = items.map((item) => item.href);
  const labels = items.map((item) => item.label);
  if (hrefs.join('|') !== MENU_HREFS[lang].join('|')) problems.push(`the menu addresses are ${hrefs.join(', ')}`);
  if (labels.join('|') !== MENU_LABELS[lang].join('|')) problems.push(`the menu labels are ${labels.join(', ')}`);
  if (items.at(-1)?.href !== MENU_HREFS[lang].at(-1) || items.at(-1)?.label !== MENU_LABELS[lang].at(-1)) problems.push('the last entry is not Contact');
  return problems;
}

const menuOf = ($) => $('header nav a').toArray().map((a) => ({ href: a.attribs.href, label: squash($(a).text()) }));

/** The problems of the GitHub icon of a header: one link to the repository, its accessible name, no noreferrer, and no link to the owner profile in the header. */
function iconProblems($, lang) {
  const problems = [];
  const icon = $('a#b-gh');
  if (icon.length !== 1) problems.push(`the page holds ${icon.length} GitHub icon links`);
  if (icon.attr('href') !== REPO) problems.push(`the icon address is ${icon.attr('href')}`);
  if (icon.attr('aria-label') !== GITHUB_NAME[lang]) problems.push(`the icon name is ${icon.attr('aria-label')}`);
  if (/noreferrer/i.test(icon.attr('rel') ?? '')) problems.push('the icon has rel noreferrer');
  if ($(`header a[href="${GITHUB}"]`).length > 0) problems.push('the header holds a link to the owner profile');
  return problems;
}

/**
 * The problems with the stacking of the four rows at one width (an empty list means none): each row is a block-level flex row (a computed display of `flex`, not floated, direction row,
 * wrapping, a 12px gap) that spans the reading column, starts below the one before it and below the paragraph, has a 1px hairline above it and a 1px one under the last row only, and
 * holds a link that is not an inline box. `at` is one width of the browser measurement.
 */
function stackingProblems(at) {
  const problems = [];
  const expect = (ok, text) => { if (!ok) problems.push(text); };
  expect(at.rows.length === 4, `${at.rows.length} rows, expected 4`);
  at.rows.forEach((row, i) => {
    const name = `row ${i + 1}`;
    const style = row.style;
    expect(style.display === 'flex', `${name} is not a block-level flex row (display ${style.display})`);
    expect(style.float === 'none', `${name} is floated (${style.float})`);
    expect(style.flexDirection === 'row', `${name} runs in direction ${style.flexDirection}`);
    expect(row.wrap === 'wrap', `${name} does not wrap (${row.wrap})`);
    expect(style.columnGap === `${ROW_GAP}px` && style.rowGap === '0px', `${name} has the gaps ${style.rowGap} and ${style.columnGap}`);
    expect(['flex', 'inline-flex', 'block', 'inline-block'].includes(style.linkDisplay), `${name}: the link is an ${style.linkDisplay} box, it has no target size`);
    expect(style.borderTopWidth === '1px' && style.borderTopStyle === 'solid', `${name} has no 1px hairline above it (${style.borderTopWidth} ${style.borderTopStyle})`);
    const last = i === at.rows.length - 1;
    expect(last ? style.borderBottomWidth === '1px' && style.borderBottomStyle === 'solid' : style.borderBottomWidth === '0px', `${name} has the bottom border ${style.borderBottomWidth} ${style.borderBottomStyle}`);
    expect(Math.abs(row.row.left - at.column.left) <= 0.5 && Math.abs(row.row.width - at.column.width) <= 0.5, `${name} does not span the reading column (${row.row.left} wide ${row.row.width}, the column ${at.column.left} wide ${at.column.width})`);
    expect(row.row.height >= 44, `${name} is ${row.row.height} px high`);
    const above = i === 0 ? at.paragraph : at.rows[i - 1].row;
    expect(row.row.top > above.top && row.row.top >= above.bottom - 0.5, `${name} does not start below ${i === 0 ? 'the paragraph' : `row ${i}`} (top ${row.row.top}, the one above ends at ${above.bottom})`);

    // The box of the row: no padding, no margin, one order, the items centred on the row and packed at its start, no list marker.
    expect(style.padding === ZERO_BOX && style.margin === ZERO_BOX, `${name} has the padding ${style.padding} and the margin ${style.margin}`);
    expect(style.order === '0' && style.justifyContent === 'normal' && style.alignItems === 'center', `${name} has order ${style.order}, justify-content ${style.justifyContent} and align-items ${style.alignItems}`);
    expect(style.listStyleType === 'none', `${name} shows a list marker (${style.listStyleType})`);
    // The parts of the row: the link, and the label of the e-mail row. Each has no padding or margin, one order, and the type of the page text (the size and the line height of the body).
    const parts = [['link', row.link], ...(row.label === null ? [] : [['label', row.label]])];
    for (const [what, part] of parts) {
      expect(part.padding === ZERO_BOX && part.margin === ZERO_BOX, `${name}: the ${what} has the padding ${part.padding} and the margin ${part.margin}`);
      expect(part.order === '0', `${name}: the ${what} has the order ${part.order}`);
      expect(part.fontSize === at.body.fontSize && part.lineHeight === at.body.lineHeight, `${name}: the ${what} is set in ${part.fontSize} on ${part.lineHeight}, the page text in ${at.body.fontSize} on ${at.body.lineHeight}`);
    }
    // The text of the link sits on the middle of its box (the link centres its text), and the link starts under the hairline of the row.
    const inkOf = (part) => (part.ink.top + part.ink.bottom) / 2;
    expect(Math.abs(inkOf(row.link) - (row.link.top + row.link.bottom) / 2) <= INK_TOLERANCE, `${name}: the text of the link is ${Math.abs(inkOf(row.link) - (row.link.top + row.link.bottom) / 2)} px off the middle of its box`);
    expect(Math.abs(row.link.top - (row.row.top + parseFloat(style.borderTopWidth))) <= 0.5 || row.label !== null, `${name}: the link does not start under the hairline of the row`);
    const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    if (row.label === null) {
      expect(Math.abs(row.row.height - (row.link.height + borders)) <= 0.5, `${name} is ${row.row.height} px high, the link ${row.link.height} px and the borders ${borders} px`);
    } else {
      // The label of the e-mail row: it takes the width of its text and no more, starts at the edge of the column, stands before the address, and is centred on it when they share a line.
      const label = row.label;
      expect(label.flexGrow === '0' && label.flexBasis === 'auto', `${name}: the label grows or has a basis (flex-grow ${label.flexGrow}, flex-basis ${label.flexBasis})`);
      expect(Math.abs(label.width - label.ink.width) <= 0.5, `${name}: the label is ${label.width} px wide, its text ${label.ink.width} px`);
      expect(Math.abs(label.left - at.column.left) <= 0.5, `${name}: the label starts at ${label.left}, the column at ${at.column.left}`);
      expect(label.left <= row.link.left + 0.5 && (label.right <= row.link.left + 0.5 || label.bottom <= row.link.top + 0.5), `${name}: the label does not come before the address`);
      const sameLine = label.top < row.link.bottom && row.link.top < label.bottom;
      if (sameLine) {
        expect(Math.abs(row.link.left - label.right - ROW_GAP) <= 0.5, `${name}: the address starts ${row.link.left - label.right} px after the label, the gap is ${ROW_GAP} px`);
        expect(Math.abs(inkOf(label) - inkOf(row.link)) <= INK_TOLERANCE, `${name}: the text of the label and the text of the address are ${Math.abs(inkOf(label) - inkOf(row.link))} px apart`);
        expect(Math.abs(row.row.height - (Math.max(label.height, row.link.height) + borders)) <= 0.5, `${name} is ${row.row.height} px high on one line, the tallest part ${Math.max(label.height, row.link.height)} px and the borders ${borders} px`);
      } else {
        expect(Math.abs(row.row.height - (label.height + row.link.height + borders)) <= 0.5, `${name} is ${row.row.height} px high stacked, the label ${label.height} px, the link ${row.link.height} px and the borders ${borders} px`);
        expect(Math.abs(row.link.left - at.column.left) <= 0.5, `${name}: the stacked address starts at ${row.link.left}, the column at ${at.column.left}`);
      }
    }
  });
  // The list: no padding, a 28px margin above it (the space under the paragraph is the larger of the two margins), and the first row at its top.
  expect(at.list.padding === ZERO_BOX && at.list.listStyleType === 'none', `the list has the padding ${at.list.padding} and the marker ${at.list.listStyleType}`);
  expect(at.list.marginTop === `${LIST_GAP}px`, `the list has the margin above it ${at.list.marginTop}, ${LIST_GAP}px are expected`);
  expect(at.paragraph.marginBottom === `${PARAGRAPH_GAP}px`, `the paragraph has the margin under it ${at.paragraph.marginBottom}, ${PARAGRAPH_GAP}px are expected`);
  expect(Math.abs(at.list.top - at.paragraph.bottom - Math.max(parseFloat(at.paragraph.marginBottom), LIST_GAP)) <= 0.5, `the list starts ${at.list.top - at.paragraph.bottom} px under the paragraph`);
  expect(Math.abs((at.rows[0]?.row.top ?? -1) - at.list.top) <= 0.5, 'the first row does not start at the top of the list');
  // The hairlines are the colour of the --rule token in both themes (the tokens are read in each theme the same way), and the probe tells the tokens apart.
  expect(at.colors?.light !== undefined && at.colors?.dark !== undefined, 'the colours were read in both themes');
  for (const theme of ['light', 'dark']) {
    const colors = at.colors?.[theme];
    if (colors === undefined) continue;
    expect(colors.rule !== colors.accent && colors.rule !== colors.ink, `${theme}: the --rule colour ${colors.rule} is the accent ${colors.accent} or the ink ${colors.ink}`);
    colors.rows.forEach((row, i) => {
      expect(row.top === colors.rule, `${theme}: the hairline above row ${i + 1} is ${row.top}, the --rule token is ${colors.rule}`);
      if (i === colors.rows.length - 1) expect(row.bottom === colors.rule, `${theme}: the hairline under the last row is ${row.bottom}, the --rule token is ${colors.rule}`);
    });
  }
  expect(at.colors?.light?.rule !== at.colors?.dark?.rule, 'the --rule token has the same colour in both themes, the theme was not switched');
  return problems;
}

/** One side set of a family of box properties, as the four computed keys: `sides('margin', ['0px', '0px', '8px', '0px'])` is marginTop to marginLeft; `tail` is `Width`, `Style` or `Color` for the borders. */
const sides = (family, [top, right, bottom, left], tail = '') => ({ [`${family}Top${tail}`]: top, [`${family}Right${tail}`]: right, [`${family}Bottom${tail}`]: bottom, [`${family}Left${tail}`]: left });

/**
 * The expected computed box of every element of the contact page in one theme at one width, written out as a table (a number is a length in px, compared to 0.01 px; a string is compared as it is):
 * a plain block of body text (`plain`), and what each element of the page sets over it. The sizes come from the design tokens (`--step-body`, `--step-head`, read in the page at that width), the
 * colours from `--ink` and `--rule` of that theme, the widths from the reading column and the boxes of the text. Every key of BOX_KEYS has a value for every element, so a declaration of
 * contact.css that is changed or removed changes a computed value that this table pins.
 */
function expectedBoxes(at, theme) {
  const colors = at.colors[theme];
  const body = parseFloat(colors.sizes.body);
  const head = parseFloat(colors.sizes.head);
  const ink = colors.ink;
  const rule = colors.rule;
  const column = at.column.width;
  const plain = {
    display: 'block', position: 'static', float: 'none', boxSizing: 'border-box', top: 'auto', right: 'auto', bottom: 'auto', left: 'auto', zIndex: 'auto',
    ...sides('margin', ['0px', '0px', '0px', '0px']),
    ...sides('padding', ['0px', '0px', '0px', '0px']),
    ...sides('border', ['0px', '0px', '0px', '0px'], 'Width'),
    ...sides('border', ['none', 'none', 'none', 'none'], 'Style'),
    ...sides('border', [ink, ink, ink, ink], 'Color'),
    flexGrow: '0', flexShrink: '1', flexBasis: 'auto', flexDirection: 'row', flexWrap: 'nowrap', order: '0',
    alignItems: 'normal', alignSelf: 'auto', alignContent: 'normal', justifyContent: 'normal', justifyItems: 'normal', justifySelf: 'auto', columnGap: 'normal', rowGap: 'normal',
    fontSize: body, lineHeight: body * 1.55, fontWeight: '400', color: ink, letterSpacing: 'normal',
    minWidth: '0px', minHeight: '0px', maxWidth: 'none', maxHeight: 'none', width: column,
    whiteSpace: 'normal', whiteSpaceCollapse: 'collapse', overflowWrap: 'normal', wordBreak: 'normal', textWrap: 'wrap', textWrapMode: 'wrap', textWrapStyle: 'auto', textAlign: 'start',
    listStyleType: 'disc', listStylePosition: 'outside', listStyleImage: 'none',
    overflowX: 'visible', overflowY: 'visible', visibility: 'visible', verticalAlign: 'baseline', textDecorationLine: 'none',
  };
  // Inside the list the marker is off (list-style inherits), so every part of a row has none.
  const inList = { listStyleType: 'none' };
  const rows = at.rows.map((row, i) => {
    const last = i === at.rows.length - 1;
    return {
      row: {
        ...plain, ...inList, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '12px', rowGap: '0px', minHeight: '44px',
        ...sides('border', ['1px', '0px', last ? '1px' : '0px', '0px'], 'Width'),
        ...sides('border', ['solid', 'none', last ? 'solid' : 'none', 'none'], 'Style'),
        ...sides('border', [rule, ink, last ? rule : ink, ink], 'Color'),
        width: row.row.width,
      },
      // A flex item of the row: the span is blockified, it takes its text and no more, it does not shrink and it never wraps (not even at its hyphen).
      label: row.label === null ? null : {
        ...plain, ...inList, display: 'block', flexShrink: '0', minWidth: 'auto', minHeight: 'auto', whiteSpace: 'nowrap', textWrap: 'nowrap', textWrapMode: 'nowrap', width: row.label.width,
      },
      // The link is blockified as a flex item and is a flex container itself: the text centred, a target of at least 44 by 44, an address that may break only where the column is too narrow.
      link: {
        ...plain, ...inList, display: 'flex', alignItems: 'center', minWidth: '44px', minHeight: '44px', overflowWrap: 'anywhere', textDecorationLine: 'underline', width: row.link.width,
      },
    };
  });
  return {
    h1: { ...plain, ...sides('margin', ['0px', '0px', '20px', '0px']), fontSize: head, lineHeight: head * 1.04, letterSpacing: head * -0.028 },
    p: { ...plain, ...sides('margin', ['0px', '0px', '14px', '0px']), maxWidth: body * 33, textWrap: 'balance', textWrapStyle: 'balance', width: Math.min(column, body * 33) },
    list: { ...plain, ...sides('margin', ['28px', '0px', '0px', '0px']), listStyleType: 'none', width: column },
    rows,
  };
}

/** A computed value against the expected one: a number is a length in px to 0.01 px, a string is exact. */
const sameValue = (actual, expected) => (typeof expected === 'number' ? typeof actual === 'string' && /^-?\d+(?:\.\d+)?px$/.test(actual) && Math.abs(parseFloat(actual) - expected) <= 0.01 : actual === expected);

/** The problems of one element: every key of BOX_KEYS against the expected table (a key without an expected value is a problem too, so the table cannot fall behind the keys). */
function boxMismatches(name, actual, expected) {
  const problems = [];
  if (actual === undefined || actual === null || expected === undefined || expected === null) return [`${name}: the box was not read`];
  for (const key of BOX_KEYS) {
    if (!(key in expected)) problems.push(`${name}: no expected value for ${key}`);
    else if (!sameValue(actual[key], expected[key])) problems.push(`${name} has ${key} ${actual[key]}, ${typeof expected[key] === 'number' ? `${expected[key]}px` : expected[key]} expected`);
  }
  return problems;
}

/** Every element of the page with its read box and its expected box in one theme: `[name, actual, expected]` (the H1, the paragraph, the list, then each row with its link and, when it has one, its label). */
function boxPairs(boxes, want, theme) {
  return [
    [`${theme}: the H1`, boxes?.h1, want.h1], [`${theme}: the paragraph`, boxes?.p, want.p], [`${theme}: the list`, boxes?.list, want.list],
    ...want.rows.flatMap((row, i) => [
      [`${theme}: row ${i + 1}`, boxes?.rows?.[i]?.row, row.row],
      [`${theme}: the link of row ${i + 1}`, boxes?.rows?.[i]?.link, row.link],
      ...(row.label === null ? [] : [[`${theme}: the label of row ${i + 1}`, boxes?.rows?.[i]?.label, row.label]]),
    ]),
  ];
}

/** The problems of the full computed box of the h1, the paragraph, the list, each row and the label and the link in it, in the light and the dark theme at one width. `wanted` is the table for both themes. */
function boxProblems(at, wanted = { light: expectedBoxes(at, 'light'), dark: expectedBoxes(at, 'dark') }) {
  const problems = [];
  for (const theme of ['light', 'dark']) {
    const boxes = at.colors?.[theme]?.boxes;
    if (boxes === undefined) { problems.push(`${theme}: the boxes were not read`); continue; }
    const want = wanted[theme];
    if (boxes.rows.length !== want.rows.length) problems.push(`${theme}: ${boxes.rows.length} rows were read, ${want.rows.length} are expected`);
    want.rows.forEach((row, i) => { if ((row.label === null) !== (boxes.rows[i]?.label === null)) problems.push(`${theme}: row ${i + 1} ${row.label === null ? 'holds a label' : 'holds no label'}`); });
    for (const [name, actual, expected] of boxPairs(boxes, want, theme)) problems.push(...boxMismatches(name, actual, expected));
  }
  return problems;
}

/**
 * The problems with the reading column at one width: it is the column of the grid by the tokens (from 821 px the grid-column 4 and a span of 6 of the twelve tracks, below it the whole
 * single track), its left edge and width are those the tracks give, they equal those of the get-started page of the same build, nothing is added around it, and the paragraph and
 * the rows are in it. `started` is the column of the get-started page at the same width.
 */
function columnProblems(at, started, width) {
  const problems = [];
  const expect = (ok, text) => { if (!ok) problems.push(text); };
  const wide = width >= 821;
  const tracks = at.grid.tracks.split(' ').map(parseFloat);
  const gap = at.grid.gap === 'normal' ? 0 : parseFloat(at.grid.gap);
  const sum = (from, to) => tracks.slice(from, to).reduce((total, track) => total + track, 0) + gap * Math.max(0, to - from - 1);
  expect(tracks.length === (wide ? 12 : 1), `the grid has ${tracks.length} tracks, ${wide ? 12 : 1} are expected`);
  expect(at.column.start === (wide ? '4' : '1') && at.column.end === (wide ? 'span 6' : '-1'), `the column runs from ${at.column.start} to ${at.column.end}`);
  const left = at.grid.left + (wide ? sum(0, 3) + gap : 0);
  const columnWidth = wide ? sum(3, 9) : sum(0, 1);
  expect(Math.abs(at.column.left - left) <= 0.5 && Math.abs(at.column.width - columnWidth) <= 0.5, `the column is ${at.column.width} px wide from ${at.column.left}, the tracks give ${columnWidth} px from ${left}`);
  expect(started !== undefined && Math.abs(at.column.left - started.left) <= 0.5 && Math.abs(at.column.width - started.width) <= 0.5, `the column is ${at.column.width} px wide from ${at.column.left}, that of the get-started page ${started?.width} px from ${started?.left}`);
  expect(at.column.padding === ZERO_BOX && at.column.margin === ZERO_BOX, `the column has the padding ${at.column.padding} and the margin ${at.column.margin}`);
  expect(Math.abs(at.paragraph.left - at.column.left) <= 0.5 && at.paragraph.width <= at.column.width + 0.5, 'the paragraph is not inside the column');
  expect(at.rows.every((row) => Math.abs(row.row.left - at.column.left) <= 0.5 && Math.abs(row.row.width - at.column.width) <= 0.5), 'a row is not as wide as the column');
  return problems;
}

/** The median of a list of numbers. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * The problems with the paragraph at one width: the measured copy is the content key, no line holds more than 75 characters (the LONGEST line, not the average), the median line holds at least
 * 30, the last line at least 15 (no widow), and the width of the paragraph is 33 em: the same number at every width, whatever the size of the type there (a width in rem or px is not).
 */
function paragraphProblems(at, characters) {
  const problems = [];
  const expect = (ok, text) => { if (!ok) problems.push(text); };
  const paragraph = at.paragraph;
  const per = paragraph.lineChars;
  expect(paragraph.chars === characters, `the measured paragraph holds ${paragraph.chars} characters, the content key ${characters}`);
  expect(per.length >= 1 && per.length === paragraph.lines, `${per.length} lines of characters and ${paragraph.lines} lines of the design check`);
  expect(Math.max(...per) <= LINE_MAX, `the longest line holds ${Math.max(...per)} characters (${per.join(', ')}), at most ${LINE_MAX} are allowed`);
  expect(median(per) >= LINE_MEDIAN_MIN, `the median line holds ${median(per)} characters (${per.join(', ')}), at least ${LINE_MEDIAN_MIN} are expected`);
  expect(per.at(-1) >= LINE_LAST_MIN, `the last line holds ${per.at(-1)} characters (${per.join(', ')}), at least ${LINE_LAST_MIN} are expected`);
  const ratio = parseFloat(paragraph.maxWidth) / parseFloat(paragraph.fontSize);
  expect(Math.abs(ratio - PARAGRAPH_EM) <= 0.05, `the width of the paragraph is ${paragraph.maxWidth} on ${paragraph.fontSize} type, ${ratio} em; ${PARAGRAPH_EM} em are expected`);
  return problems;
}

/** The problems with the rule that sets the width of the paragraph in a stylesheet: one rule for the `.ct-p` paragraph sets `max-width` in em, at every width (no media block), and no other width. */
function paragraphWidthProblems(css) {
  const rules = styleRules(css).filter((rule) => rule.selectors.some((selector) => /\.ct-p\b/.test(selector)));
  const widths = rules.flatMap((rule) => rule.declarations.filter((d) => ['max-width', 'width', 'inline-size', 'max-inline-size'].includes(d.property)).map((d) => ({ ...d, context: rule.context })));
  const problems = [];
  if (!widths.some((d) => d.property === 'max-width')) problems.push('no rule sets the max-width of the paragraph');
  for (const d of widths) {
    if (d.context.length > 0) problems.push(`${d.property} is set inside ${d.context.join(' ')}`);
    if (d.property !== 'max-width' || !/^\d+(?:\.\d+)?em$/.test(d.value) || d.important) problems.push(`${d.property}: ${d.value}${d.important ? ' !important' : ''} is not a width in em`);
    if (d.property === 'max-width' && /^\d+(?:\.\d+)?em$/.test(d.value) && Number(d.value.slice(0, -2)) !== PARAGRAPH_EM) problems.push(`max-width is ${d.value}, ${PARAGRAPH_EM}em are expected`);
  }
  return problems;
}

/**
 * Every at-rule in the source of a stylesheet, at any depth (inside another at-rule, inside a style rule), as its head: `@media (min-width: 391px) and (max-width: 399px)`, `@container ...`, `@supports ...`,
 * `@layer ...`, `@import ...`. The layout test reads the page at 67 widths, so a rule that holds only between two of them (or above the widest) is not seen by it; a stylesheet without any at-rule has
 * one layout at every width, which closes that class. Comments are left out.
 */
function atRuleProblems(css) {
  const found = [];
  const walk = (body) => {
    for (const { head, block } of statementsOf(body)) {
      if (head.startsWith('@')) found.push(head.replace(/\s+/g, ' '));
      if (block !== null) walk(block);
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  return found.map((head) => `the stylesheet holds ${head}`);
}

/** The contact rules (a `.ct-` selector) of a built stylesheet that sit inside an at-rule of any kind: the built sheet holds the at-rules of the other pages, only the rules of this page are read. */
function builtContactAtRuleProblems(css) {
  return styleRules(css)
    .filter((rule) => rule.context.length > 0 && rule.selectors.some((selector) => /\.ct-/.test(selector)))
    .map((rule) => `${rule.selectors.join(', ')} sits inside ${rule.context.join(' ')}`);
}

// ---- the pinning tables (amendment 003) -------------------------------------------------------------------------------------------------------------------

/**
 * src/styles/contact.css, written out rule by rule and declaration by declaration, in source order: the selector list of every rule and each declaration as `property: value` (lower case, no
 * `!important`). The file may hold nothing else: no further rule, no pseudo-state (`:hover`, `:focus-visible`, `:active`) rule, no pseudo-element (`::before`, `::after`) rule, no at-rule, and
 * not one declaration more, fewer or changed, whether or not any layout assertion reads its property. The table is not derived from the file under test.
 */
const CONTACT_CSS = [
  { selectors: ['.gs-p.ct-p'], declarations: ['max-width: 33em', 'text-wrap: balance'] },
  { selectors: ['.ct-links'], declarations: ['margin: 28px 0 0', 'padding: 0', 'list-style: none'] },
  { selectors: ['.ct-row'], declarations: ['display: flex', 'flex-wrap: wrap', 'align-items: center', 'gap: 0 12px', 'min-height: 44px', 'border-top: 1px solid var(--rule)'] },
  { selectors: ['.ct-row:last-child'], declarations: ['border-bottom: 1px solid var(--rule)'] },
  { selectors: ['.ct-label'], declarations: ['flex: none', 'white-space: nowrap'] },
  { selectors: ['.ct-link'], declarations: ['display: inline-flex', 'align-items: center', 'min-width: 44px', 'min-height: 44px', 'overflow-wrap: anywhere'] },
];
const CONTACT_CSS_DECLARATIONS = 19;

/** The stylesheet text the table stands for: comments left out, white space squeezed, none around a brace or a semicolon. Case is kept, so `var(--Rule)` is not `var(--rule)`. */
const canonicalCss = (css) => squash(css.replace(/\/\*[\s\S]*?\*\//g, '')).replace(/\s*([{};])\s*/g, '$1');
const CONTACT_CSS_TEXT = canonicalCss(CONTACT_CSS.map((rule) => `${rule.selectors.join(', ')} { ${rule.declarations.join('; ')}; }`).join('\n'));

const declarationText = (d) => `${d.property}: ${d.value}${d.important ? ' !important' : ''}`;
const ruleName = (rule) => `${rule.context.length > 0 ? `${rule.context.join(' ')} { ` : ''}${rule.selectors.join(', ')}`;

/**
 * The differences between the style rules of a stylesheet (`styleRules`) and a table of rules, as lines that name the rule and the declaration: a rule that is missing, a rule that is added
 * (a second rule of a selector, a pseudo-state or pseudo-element rule, a rule inside an at-rule, an empty rule), a declaration that is added, missing or changed, the rules or (when
 * `declarationOrder` is on) the declarations in another order. A built stylesheet is minified and may order the declarations of a rule differently, so it is read with `declarationOrder` off.
 */
function cssTableProblems(rules, table, { declarationOrder = true } = {}) {
  const problems = [];
  const left = rules.map((rule, index) => ({ index, name: ruleName(rule), declarations: rule.declarations.map(declarationText) }));
  const matched = [];
  for (const want of table) {
    const name = want.selectors.join(', ');
    const at = left.findIndex((rule) => rule.name === name);
    if (at < 0) {
      problems.push(`rule "${name}" is missing`);
      continue;
    }
    const [got] = left.splice(at, 1);
    matched.push(got.index);
    const missing = [...want.declarations];
    const extra = [];
    for (const d of got.declarations) {
      const i = missing.indexOf(d);
      if (i >= 0) missing.splice(i, 1);
      else extra.push(d);
    }
    const property = (d) => d.slice(0, d.indexOf(':'));
    let changed = 0;
    for (const d of [...extra]) {
      const j = missing.findIndex((m) => property(m) === property(d));
      if (j < 0) continue;
      problems.push(`rule "${name}": the declaration "${missing[j]}" is changed to "${d}"`);
      missing.splice(j, 1);
      extra.splice(extra.indexOf(d), 1);
      changed += 1;
    }
    for (const d of extra) problems.push(`rule "${name}": the declaration "${d}" is added`);
    for (const d of missing) problems.push(`rule "${name}": the declaration "${d}" is missing`);
    if (declarationOrder && changed + extra.length + missing.length === 0 && got.declarations.join('; ') !== want.declarations.join('; ')) problems.push(`rule "${name}": the declarations are in another order (${got.declarations.join('; ')})`);
  }
  for (const rule of left) problems.push(`rule "${rule.name}" is added, with ${rule.declarations.join('; ') || 'no declaration'}`);
  if (matched.some((index, i) => i > 0 && index < matched[i - 1])) problems.push('the rules are in another order');
  return problems;
}

/** The problems of the contact stylesheet source: the rules and declarations against the table, the at-rules (which the rule reader leaves out for keyframes, font faces and the like), and the exact text against the table's text. */
function contactCssProblems(css) {
  const problems = [...cssTableProblems(styleRules(css), CONTACT_CSS), ...atRuleProblems(css)];
  const actual = canonicalCss(css);
  if (actual !== CONTACT_CSS_TEXT) {
    let at = 0;
    while (at < actual.length && actual[at] === CONTACT_CSS_TEXT[at]) at += 1;
    problems.push(`the text of the stylesheet differs from the table at character ${at}: "${actual.slice(Math.max(0, at - 20), at + 30)}" where "${CONTACT_CSS_TEXT.slice(Math.max(0, at - 20), at + 30)}" is expected`);
  }
  return problems;
}

/** The problems of a built stylesheet: its `.ct-` rules (the stylesheet holds the rules of the other pages too) against the table, with the declarations in any order, and none of them inside an at-rule. */
function builtContactCssProblems(css) {
  const own = styleRules(css).filter((rule) => rule.selectors.some((selector) => /\.ct-/.test(selector)));
  return [...cssTableProblems(own, CONTACT_CSS, { declarationOrder: false }), ...builtContactAtRuleProblems(css)];
}

/**
 * One node of a parsed page as plain data: a text node is its text (white space runs squeezed to one space, the space between two inline elements kept), a comment is `{ comment }`, any other
 * node `{ type }`, and an element `{ tag, attrs, children }` with every attribute (name and value as written) and every child in order.
 */
function treeOf(node) {
  if (node.type === 'text') return node.data.replace(/\s+/g, ' ');
  if (node.type === 'comment') return { comment: node.data };
  if (node.type === 'tag') return { tag: node.name, attrs: { ...node.attribs }, children: node.children.map(treeOf) };
  return { type: node.type };
}

const el = (tag, attrs = {}, children = []) => ({ tag, attrs, children });
const contactLink = (href, text) => el('a', { class: 'ct-link', href }, [text]);
const contactRow = (...children) => el('li', { class: 'ct-row' }, children);

/**
 * The element tree of the contact column, written out: the wrap, the grid and the reading column; in the column the H1, the paragraph and the list of four rows; in the e-mail row the label, one
 * space and the address. `title`, `paragraph` and the four `texts` (GitHub, LinkedIn, Medium, the word of the e-mail row) are the only text that depends on the language; the addresses are the owner's.
 */
const columnTree = ({ title, paragraph, texts }) => el('div', { class: 'wrap gs' }, [
  el('div', { class: 'grid' }, [
    el('div', { class: 'gs-col' }, [
      el('h1', { class: 'gs-h1' }, [title]),
      el('p', { class: 'gs-p ct-p' }, [paragraph]),
      el('ul', { class: 'ct-links' }, [
        contactRow(contactLink(GITHUB, texts[0])),
        contactRow(contactLink(LINKEDIN, texts[1])),
        contactRow(contactLink(MEDIUM, texts[2])),
        contactRow(el('span', { class: 'ct-label' }, [texts[3]]), ' ', contactLink(MAILTO, ADDRESS)),
      ]),
    ]),
  ]),
]);
/** `main` of a built page holds the column and nothing else. */
const mainTree = (column) => el('main', {}, [column]);
const ELEMENTS_IN_COLUMN = 15;

const describeNode = (node) => (typeof node === 'string' ? `the text "${node}"` : 'tag' in node ? `<${node.tag}>` : `a node ${JSON.stringify(node)}`);
const labelOf = (node, index) => (typeof node === 'string' ? `text[${index}]` : 'tag' in node ? `${node.tag}${node.attrs.class ? `.${node.attrs.class.split(' ').join('.')}` : ''}[${index}]` : `node[${index}]`);

/** The differences between a parsed tree and the expected one, as lines that name the element by its path: tag, every attribute (added, missing, changed), the child count and every child in order, the text. */
function treeProblems(actual, expected, path = 'main') {
  if (typeof actual === 'string' || typeof expected === 'string' || !('tag' in actual) || !('tag' in expected)) {
    return isDeepStrictEqual(actual, expected) ? [] : [`${path}: ${describeNode(actual)} where ${describeNode(expected)} is expected`];
  }
  if (actual.tag !== expected.tag) return [`${path}: the element is <${actual.tag}>, <${expected.tag}> is expected`];
  const problems = [];
  for (const name of new Set([...Object.keys(actual.attrs), ...Object.keys(expected.attrs)])) {
    if (!(name in expected.attrs)) problems.push(`${path}: the attribute ${name}="${actual.attrs[name]}" is added`);
    else if (!(name in actual.attrs)) problems.push(`${path}: the attribute ${name}="${expected.attrs[name]}" is missing`);
    else if (actual.attrs[name] !== expected.attrs[name]) problems.push(`${path}: the attribute ${name} is "${actual.attrs[name]}", "${expected.attrs[name]}" is expected`);
  }
  if (actual.children.length !== expected.children.length) problems.push(`${path}: ${actual.children.length} children, ${expected.children.length} are expected`);
  for (let i = 0; i < Math.min(actual.children.length, expected.children.length); i += 1) {
    problems.push(...treeProblems(actual.children[i], expected.children[i], `${path} > ${labelOf(expected.children[i], i)}`));
  }
  return problems;
}

/** Every element of a tree with its parent and its place among the children, depth first. */
function elementsOfTree(node, parent = null, index = 0, found = []) {
  if (typeof node === 'string' || !('tag' in node)) return found;
  found.push({ node, parent, index });
  node.children.forEach((child, i) => elementsOfTree(child, node, i, found));
  return found;
}

/** The explicit props of the two component renders: plain words, and words that hold characters HTML treats as markup (they must come out as text). */
const PROP_SETS = {
  plain: { title: 'The props title', lead: 'The props lead', paragraph: 'A paragraph that the props set.', links: { github: 'GH text', linkedin: 'LI text', medium: 'MD text', email: 'Mail word' } },
  escaped: { title: 'A & B <i>x</i> "q"', lead: 'L', paragraph: 'P & <b>not bold</b> \'s', links: { github: 'G<', linkedin: 'L&', medium: '"M"', email: "E'" } },
};

/** The kinds of bad value of a key: missing, not text, empty, white space only (the same kinds as the helper test). */
const BAD_VALUES = [['missing', undefined], ['number', 3], ['null', null], ['boolean', true], ['array', ['text']], ['object', { text: 'x' }], ['empty', ''], ['white space', ' \n\t ']];

/** A copy of a content with the value at a dotted path set, or removed when the value is undefined. */
function contentWith(from, path, value) {
  const copy = structuredClone(from);
  const parts = path.split('.');
  const last = parts.pop();
  const holder = parts.reduce((object, part) => object[part], copy);
  if (value === undefined) delete holder[last]; else holder[last] = value;
  return copy;
}

/** Every bad content of a language as `[label, { key, content }]`: each key of the helper's list with each kind of bad value, a missing or text group, and values that are not a content file at all. */
function badContents(from) {
  const found = [];
  for (const key of LIB_TEXT_KEYS) for (const [kind, value] of BAD_VALUES) found.push([`${key}|${kind}`, { key, content: contentWith(from, key, value) }]);
  found.push(['group|missing', { key: 'links.github', content: contentWith(from, 'links', undefined) }]);
  found.push(['group|text', { key: 'links.github', content: contentWith(from, 'links', 'text') }]);
  for (const [kind, value] of [['undefined', undefined], ['null', null], ['text', 'text'], ['number', 3], ['array', []]]) found.push([`whole|${kind}`, { key: 'title', content: value }]);
  return found;
}

// ---- hooks ----------------------------------------------------------------------------------------------------------------------------------------------

const built ={ parent: '', outDir: '', status: -1, output: '' };
let renderer;
let site;
let browser;
const allHtml = {};
const pages = {};
const pageRuns = {};
const componentRuns = {};
/** The component rendered with a content prop that is not valid, one run per language, key and kind of bad value (filled by the setup, read by the component validation test). */
const badComponentRuns = {};
const measures = { error: '', links: {}, header: {} };
const VIEWPORTS = [320, 390, 820, 821, 900, 1000, 1280];
/**
 * The widths at which the layout of the four rows, the reading column and the paragraph is read (amendment 002): the narrowest phone, 321 (one more than it), the common phones, a tablet,
 * a laptop, the neighbours of each breakpoint of the site (820 and 821 where the grid changes, 1000 and 1001 where the menu changes) and every 20 px from 320 to 1440, so no stretch of
 * widths between two breakpoints goes unmeasured (a rule for 500 to 700 px is read).
 */
const LAYOUT_WIDTHS = [...new Set([320, 321, 360, 390, 768, 1024, 1440, 819, 820, 821, 822, 999, 1000, 1001, 1002, ...Array.from({ length: 57 }, (_, i) => 320 + i * 20)])].sort((a, b) => a - b);
/** Every width one page is resized to, once each. */
const ALL_WIDTHS = [...new Set([...LAYOUT_WIDTHS, ...VIEWPORTS])].sort((a, b) => a - b);
/** The rows of the layout test: each is a block-level flex row of the reading column, with a 1px hairline above it (and one under the last row) and a 12px gap between label and address. */
const ROW_GAP = 12;
/** A computed box edge set that is all zero (padding or margin, as top right bottom left). */
const ZERO_BOX = '0px 0px 0px 0px';
/**
 * The computed properties read for every element of the page the stylesheet or the content styles (the H1, the paragraph, the list, each row and the label and the link in it): the four margins,
 * paddings, border widths, styles and colours, the display, position, float and box sizing, the flex longhands (grow, shrink, basis, direction, wrap), the order, the alignment, the gaps, the
 * type (size, line height, weight, colour, letter spacing), the least and greatest sizes and the width, the wrapping, the list style and the overflow. The expected value of each is in `expectedBoxes`.
 */
const BOX_KEYS = [
  'display', 'position', 'float', 'boxSizing', 'top', 'right', 'bottom', 'left', 'zIndex',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'flexGrow', 'flexShrink', 'flexBasis', 'flexDirection', 'flexWrap', 'order',
  'alignItems', 'alignSelf', 'alignContent', 'justifyContent', 'justifyItems', 'justifySelf', 'columnGap', 'rowGap',
  'fontSize', 'lineHeight', 'fontWeight', 'color', 'letterSpacing',
  'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'width',
  'whiteSpace', 'whiteSpaceCollapse', 'overflowWrap', 'wordBreak', 'textWrap', 'textWrapMode', 'textWrapStyle', 'textAlign',
  'listStyleType', 'listStylePosition', 'listStyleImage',
  'overflowX', 'overflowY', 'visibility', 'verticalAlign', 'textDecorationLine',
];
/** How far, in pixels, the box of a text may sit off the middle of its line box: the box of the glyphs is not centred on the line height (it is 0.9 px off at 16 px, 1 px at 17 px). */
const INK_TOLERANCE = 1.5;
/** The width of the paragraph in em (DESIGN.md Typography, step-body: at most 75 characters a line on the marketing surface; `ch` is the width of a zero, so the rule is set in em). */
const PARAGRAPH_EM = 33;
/** The most characters a line of the paragraph holds, the fewest a line holds in the middle of it (the median), and the fewest the last line holds (no widow). */
const LINE_MAX = 75;
const LINE_MEDIAN_MIN = 30;
const LINE_LAST_MIN = 15;
/** The other page of the same reading column in each language: the get-started page of the same build. */
const COLUMN_PAGES = { en: '/get-started/', tr: '/tr/baslarken/' };
/** The margin above the list (contact.css, 28px); the space under the paragraph is the larger of it and the margin under the paragraph (get-started.css, 14px), the two margins collapse. */
const LIST_GAP = 28;
/** The margin under the paragraph: the 14px of the paragraph of the reading column (get-started.css), not changed on the contact page. */
const PARAGRAPH_GAP = 14;

let viteServer;

/** Opens one Vite server and one Astro container, as the render helpers of the earlier page tests do, and renders the page FILES of a language with a working directory of its own. */
async function openRenderer() {
  const config = await getViteConfig({}, { root, devToolbar: { enabled: false } })({ command: 'serve', mode: 'production' });
  const server = await createServer({ ...config, root, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  // The handle is kept before the call that can still fail, so the hook of the file closes the server even when the container cannot be created (an open server keeps the process alive).
  viteServer = server;
  const container = await AstroContainer.create();
  return {
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
    async renderComponent({ props }) {
      const { default: Component } = await server.ssrLoadModule('/src/components/marketing/ContactPage.astro');
      return container.renderToString(Component, { props: { content: props } });
    },
    async close() {
      await server[Symbol.for('astro.devServerAppReady')];
      await server.close();
    },
  };
}

/** The facts about the four links that the target test reads. */
const readLinks = () => [...document.querySelectorAll('main a')].map((a) => {
  const box = a.getBoundingClientRect();
  const style = getComputedStyle(a);
  return { text: a.textContent.trim(), width: box.width, height: box.height, idle: { style: style.outlineStyle, width: style.outlineWidth } };
});

/**
 * The rows, the reading column and the paragraph at the width of the page now: the number of lines each text takes (the boxes of the text, one per line), the characters of every line of
 * the paragraph (the boxes of its characters grouped by their top, the Range client rects the design check reads), the edges, the box of the text of the label and of the link, and the
 * computed style of every rule of the row unit.
 */
const readLayout = () => {
  const lines = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [];
    for (const r of range.getClientRects()) if (r.width > 0 && !tops.some((top) => Math.abs(top - r.top) < 2)) tops.push(r.top);
    return tops.length;
  };
  // The line count of the design check (visual-proof design_body_measure): the boxes of the text sorted by top, a new line when the top is more than half a line below the last.
  const auditLines = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1).sort((a, b) => a.top - b.top);
    let n = 0;
    let last = -1e9;
    for (const r of rects) if (r.top - last > Math.max(4, r.height * 0.5)) { n += 1; last = r.top; }
    return Math.max(1, n);
  };
  // The characters on each line (white space at the ends of a line not counted), by the Range box of every character of the text; a character starts a new line when its top is
  // more than half a line below the top of the line before it, as in `auditLines`.
  const lineCharacters = (el) => {
    const found = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      for (let i = 0; i < node.length; i += 1) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const box = [...range.getClientRects()].find((r) => r.width > 1 && r.height > 1);
        if (box === undefined) continue;
        const last = found.at(-1);
        if (last !== undefined && box.top - last.top <= Math.max(4, box.height * 0.5)) last.text += node.data[i];
        else found.push({ top: box.top, text: node.data[i] });
      }
    }
    return found.map((line) => line.text.trim().length);
  };
  const edges = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const textEdges = (el) => { const range = document.createRange(); range.selectNodeContents(el); return edges(range); };
  const box = (style) => ({
    padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].join(' '),
    margin: [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft].join(' '),
  });
  // The line counter must see a break: a probe that is made to break inside a word shows more than one line, a short word one.
  const broken = document.createElement('p');
  broken.style.cssText = 'width: 40px; overflow-wrap: anywhere;';
  broken.textContent = 'furkansarikaya@gmail.com';
  const whole = document.createElement('span');
  whole.textContent = 'word';
  document.body.append(broken, whole);
  const probe = { broken: lines(broken), whole: lines(whole) };
  broken.remove();
  whole.remove();
  const paragraph = document.querySelector('main p');
  const paragraphStyle = getComputedStyle(paragraph);
  const grid = document.querySelector('main .grid');
  const gridStyle = getComputedStyle(grid);
  const columnStyle = getComputedStyle(document.querySelector('main .gs-col'));
  const list = document.querySelector('main .ct-links');
  const listStyle = getComputedStyle(list);
  const bodyStyle = getComputedStyle(document.body);
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    body: { fontSize: bodyStyle.fontSize, lineHeight: bodyStyle.lineHeight },
    column: { ...edges(document.querySelector('main .gs-col')), start: columnStyle.gridColumnStart, end: columnStyle.gridColumnEnd, ...box(columnStyle) },
    grid: { ...edges(grid), tracks: gridStyle.gridTemplateColumns, gap: gridStyle.columnGap },
    probe,
    paragraph: {
      chars: paragraph.textContent.replace(/\s+/g, ' ').trim().length,
      lines: auditLines(paragraph),
      lineChars: lineCharacters(paragraph),
      maxWidth: paragraphStyle.maxWidth,
      fontSize: paragraphStyle.fontSize,
      marginBottom: paragraphStyle.marginBottom,
      ...edges(paragraph),
    },
    list: { ...edges(list), marginTop: listStyle.marginTop, padding: box(listStyle).padding, listStyleType: listStyle.listStyleType },
    rows: [...document.querySelectorAll('main .ct-row')].map((row) => {
      const label = row.querySelector('span');
      const link = row.querySelector('a');
      const rowStyle = getComputedStyle(row);
      const labelStyle = label === null ? null : getComputedStyle(label);
      const linkStyle = getComputedStyle(link);
      return {
        wrap: rowStyle.flexWrap,
        style: {
          display: rowStyle.display,
          float: rowStyle.float,
          position: rowStyle.position,
          flexDirection: rowStyle.flexDirection,
          columnGap: rowStyle.columnGap,
          rowGap: rowStyle.rowGap,
          borderTopWidth: rowStyle.borderTopWidth,
          borderTopStyle: rowStyle.borderTopStyle,
          borderBottomWidth: rowStyle.borderBottomWidth,
          borderBottomStyle: rowStyle.borderBottomStyle,
          linkDisplay: linkStyle.display,
          alignItems: rowStyle.alignItems,
          justifyContent: rowStyle.justifyContent,
          order: rowStyle.order,
          listStyleType: rowStyle.listStyleType,
          ...box(rowStyle),
        },
        row: edges(row),
        label: label === null ? null : {
          text: label.textContent.trim(),
          lines: lines(label),
          ...edges(label),
          whiteSpace: labelStyle.whiteSpace,
          overflowWrap: labelStyle.overflowWrap,
          wordBreak: labelStyle.wordBreak,
          flexShrink: labelStyle.flexShrink,
          flexGrow: labelStyle.flexGrow,
          flexBasis: labelStyle.flexBasis,
          order: labelStyle.order,
          fontSize: labelStyle.fontSize,
          lineHeight: labelStyle.lineHeight,
          ink: textEdges(label),
          ...box(labelStyle),
        },
        link: {
          text: link.textContent.trim(),
          lines: lines(link),
          ...edges(link),
          alignItems: linkStyle.alignItems,
          order: linkStyle.order,
          fontSize: linkStyle.fontSize,
          lineHeight: linkStyle.lineHeight,
          ink: textEdges(link),
          ...box(linkStyle),
        },
      };
    }),
  };
};

/**
 * The colour of the hairlines of the rows in the theme given (the `data-theme` attribute is set to it) and the colour the `--rule` token has in it, read the same way: as the computed
 * colour of an element that takes it. The accent is read too, so the test can tell the two tokens apart.
 */
const readColors = ({ theme, keys }) => {
  document.documentElement.setAttribute('data-theme', theme);
  const valueOf = (property, token) => {
    const probe = document.createElement('span');
    probe.style[property] = `var(${token})`;
    document.body.append(probe);
    const value = getComputedStyle(probe)[property];
    probe.remove();
    return value;
  };
  const colorOf = (token) => valueOf('color', token);
  // The computed box of one element: every key asked for, as the browser computes it in this theme.
  const boxOf = (el) => { const style = getComputedStyle(el); return Object.fromEntries(keys.map((key) => [key, style[key]])); };
  const rows = [...document.querySelectorAll('main .ct-row')].map((row) => { const style = getComputedStyle(row); return { top: style.borderTopColor, bottom: style.borderBottomColor }; });
  const boxes = {
    h1: boxOf(document.querySelector('main h1')),
    p: boxOf(document.querySelector('main p')),
    list: boxOf(document.querySelector('main .ct-links')),
    rows: [...document.querySelectorAll('main .ct-row')].map((row) => ({
      row: boxOf(row),
      label: row.querySelector('span') === null ? null : boxOf(row.querySelector('span')),
      link: boxOf(row.querySelector('a')),
    })),
  };
  return { rule: colorOf('--rule'), accent: colorOf('--accent'), ink: colorOf('--ink'), sizes: { body: valueOf('fontSize', '--step-body'), head: valueOf('fontSize', '--step-head') }, rows, boxes };
};

/** The reading column of a page at the width of the page now (the get-started page of the same build is read with it). */
const readColumn = () => { const r = document.querySelector('main .gs-col').getBoundingClientRect(); return { left: r.left, width: r.width }; };

/** The header at the width of the page now. */
const readHeader = () => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    brand: rect(document.querySelector('header .brand')),
    links: [...document.querySelectorAll('header nav a')].map(rect),
    tools: rect(document.querySelector('header .tools')),
  };
};

/**
 * The measurements of one contact page in Chromium: the targets of the four links at two widths, the keyboard focus ring of each, the four rows and the paragraph at every width of
 * LAYOUT_WIDTHS, and the header at every width of VIEWPORTS. The page is loaded once and resized (the styles answer to the width at once), so the hook reads no page twice.
 */
async function measure(context, lang, address) {
  const page = await context.newPage();
  try {
    const url = `${site.url}${address}`;
    const result = { links: {}, header: {}, layout: {}, accent: '', focus: [] };
    await page.setViewportSize({ width: 1280, height: 800 });
    const response = await page.goto(url);
    assert.equal(response?.status(), 200, `${url} answers 200`);
    // The links before any of them has the focus: the target size and the idle outline.
    result.links[1280] = await page.evaluate(readLinks);
    await page.setViewportSize({ width: 320, height: 800 });
    result.links[320] = await page.evaluate(readLinks);
    await page.setViewportSize({ width: 1280, height: 800 });
    // The keyboard: Tab from the top of the page until every link of main has been reached; the ring is read while the link has the focus.
    result.accent = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--accent)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    for (let presses = 0; presses < 40 && result.focus.length < 4; presses += 1) {
      await page.keyboard.press('Tab');
      const reached = await page.evaluate(() => {
        const links = [...document.querySelectorAll('main a')];
        const index = links.indexOf(document.activeElement);
        if (index < 0) return null;
        const style = getComputedStyle(document.activeElement);
        return { index, focusVisible: document.activeElement.matches(':focus-visible'), style: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset, color: style.outlineColor };
      });
      if (reached !== null) result.focus.push(reached);
    }
    await page.evaluate(() => document.activeElement?.blur());
    for (const width of ALL_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      if (LAYOUT_WIDTHS.includes(width)) {
        result.layout[width] = await page.evaluate(readLayout);
        result.layout[width].colors = { light: await page.evaluate(readColors, { theme: 'light', keys: BOX_KEYS }) };
      }
      if (VIEWPORTS.includes(width)) result.header[width] = await page.evaluate(readHeader);
    }
    // The hairlines once more in the dark theme, at every width of the layout.
    for (const width of LAYOUT_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      result.layout[width].colors.dark = await page.evaluate(readColors, { theme: 'dark', keys: BOX_KEYS });
    }
    return result;
  } finally {
    await page.close();
  }
}

/** The reading column of the get-started page of a language at every width of the layout: the measure the column of the contact page is compared with. */
async function measureColumn(context, address) {
  const page = await context.newPage();
  try {
    const response = await page.goto(`${site.url}${address}`);
    assert.equal(response?.status(), 200, `${address} answers 200`);
    const columns = {};
    for (const width of LAYOUT_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      columns[width] = await page.evaluate(readColumn);
    }
    return columns;
  } finally {
    await page.close();
  }
}

/** The page FILES rendered from fixture roots: the translation stamp is read from there, as a build reads it from the repository. */
async function renderFixtureRuns(opening) {
  const opened = await opening;
  if (opened.error) throw opened.error;
  renderer = opened.value;
  const attempt = async (lang, cwd) => renderer.renderPageFile({ lang, cwd }).then((value) => ({ value }), (error) => ({ error }));
  const englishText = read(CONTENT_FILE.en);
  const roots = {
    good: fixtureRoot({ english: englishText }),
    stale: fixtureRoot({ english: `${englishText}\nA changed line.\n` }),
    noEnglish: fixtureRoot(),
  };
  // The component rendered with explicit props (the element tree is read from it); it reads no file, so the working directory does not matter.
  for (const [name, props] of Object.entries(PROP_SETS)) componentRuns[name] = await renderer.renderComponent({ props }).then((html) => ({ html }), (error) => ({ error }));
  // The component rendered with a content prop that the helper must reject: every key of the shape in both languages (the key list of the helper), every kind of bad value.
  for (const lang of ['en', 'tr']) {
    const from = frontmatterOf(lang);
    for (const [label, bad] of badContents(from)) badComponentRuns[`${lang}|${label}`] = await renderer.renderComponent({ props: bad.content }).then((html) => ({ html }), (error) => ({ error }));
  }
  // The renders change the working directory of the process, so they run one after the other.
  for (const [name, cwd] of Object.entries(roots)) {
    pageRuns[name] = {};
    for (const lang of ['en', 'tr']) pageRuns[name][lang] = await attempt(lang, cwd);
  }
}

/** A child process run to its end: `{ status, output }`, standard output and standard error together. */
function run(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, options);
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ status: -1, output: String(error) }));
    child.on('close', (status) => resolve({ status, output }));
  });
}

/** The browser: served from the private build, measured once so that the tests only read numbers; the launch of Chromium (`launching`) started while the build ran. */
async function measureInBrowser(launching) {
  if (built.status !== 0) return;
  try {
    site = await startServer({ root: built.outDir });
    await launching;
    const context = await browser.newContext();
    const [results, columns] = await Promise.all([
      Promise.all(PAGES.map(([lang, , address]) => measure(context, lang, address))),
      Promise.all(PAGES.map(([lang]) => measureColumn(context, COLUMN_PAGES[lang]))),
    ]);
    PAGES.forEach(([lang], i) => { measures.links[lang] = { ...results[i], getStartedColumn: columns[i] }; });
    await context.close();
  } catch (error) {
    measures.error = error instanceof Error ? error.message : String(error);
  }
}

/** The setup of the file: the documents, the build, the browser measurements and the page renders; it stores what went wrong and never throws, the first test names it. */
async function setup() {
  // The pinned documents come first: the home pages read the pin facts while the build runs.
  const fetched = spawnSync(process.execPath, [join(root, 'scripts', 'sync.mjs'), 'fetch'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(fetched.status, 0, `the fetch of the pinned documents exits 0: ${(fetched.stdout ?? '') + (fetched.stderr ?? '')}`.slice(-400));

  // An indexable build; the output folder is inside the repository so Astro does not use the shared .tmp folder.
  mkdirSync(join(root, '.cache'), { recursive: true });
  built.parent = mkdtempSync(join(root, '.cache', 'proofline-contact-'));
  built.outDir = join(built.parent, 'dist');
  const env = { ...process.env };
  for (const key of ENV_KEYS) delete env[key];
  env.VERCEL_ENV = 'production';
  // The build runs in its own process while Chromium starts and the Vite server opens in this one.
  const building = run(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build', '--outDir', built.outDir], { cwd: root, env, timeout: 120000 });
  const launching = chromium.launch().then((launched) => { browser = launched; return launched; });
  launching.catch(() => {});
  const opening = openRenderer().then((value) => ({ value }), (error) => ({ error }));
  const r = await building;
  built.status = r.status;
  built.output = r.output;
  if (built.status === 0) {
    for (const rel of walk(built.outDir).filter((name) => name.endsWith('.html'))) allHtml[rel] = readFileSync(join(built.outDir, rel), 'utf8');
    for (const [lang, rel] of PAGES) if (allHtml[rel] !== undefined) pages[lang] = load(allHtml[rel]);
  }

  // The page files rendered from a fixture root and the browser measurements are independent of each other, so they run side by side.
  await Promise.all([renderFixtureRuns(opening), measureInBrowser(launching)]);
  await launching.catch(() => {});
}

let setupError = '';
try {
  await setup();
} catch (error) {
  setupError = error instanceof Error ? error.message : String(error);
}

after(async () => {
  // Every resource is closed on its own, so one that fails to close leaves no other open; the server is closed through its handle when the renderer was never made.
  const closers = [() => (renderer ? renderer.close() : viteServer?.close()), () => browser?.close(), () => site?.close()];
  const failures = [];
  for (const close of closers) {
    try {
      await close();
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  try {
    if (built.parent !== '') rmSync(built.parent, { recursive: true, force: true });
    removeTempDirs();
  } finally {
    assert.deepEqual(failures, [], 'every resource of the setup closes');
  }
});

/** A built page of the language, failing the test when the build did not produce it. */
function page(lang) {
  assert.equal(built.status, 0, `the private build exits 0: ${built.output.slice(-400)}`);
  assert.ok(pages[lang], `${lang} contact page is built`);
  return pages[lang];
}

/** The measurements of a language, failing the test when the browser did not run. */
function measured(lang) {
  assert.equal(measures.error, '', `the browser measurements ran: ${measures.error}`);
  assert.ok(measures.links[lang], `${lang}: the page was measured`);
  return measures.links[lang];
}

// ---- the tests ------------------------------------------------------------------------------------------------------------------------------------------

// The first test reads what the setup produced, so a setup that failed is named here.
it('contact: the private build, the page renders and the browser measurements ran', () => {
  assert.equal(setupError, '', `the setup ran: ${setupError}`);
  assert.equal(built.status, 0, `the private build exits 0: ${built.output.slice(-400)}`);
  for (const [lang, rel] of PAGES) assert.ok(pages[lang], `${rel} is built`);
  assert.equal(measures.error, '', `the browser measurements ran: ${measures.error}`);
  for (const [lang] of PAGES) assert.ok(measures.links[lang], `${lang}: the page was measured`);
  assert.deepEqual(Object.keys(pageRuns).sort(), ['good', 'noEnglish', 'stale'], 'the fixture roots were rendered');
});

it('contact: both pages carry the language, one H1 equal to the title and the suffixed title with og:title and no evidence word', () => {
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    assert.equal($('html').attr('lang'), lang, `${address}: the language attribute`);
    assert.equal($('h1').length, 1, `${address}: one H1`);
    assert.equal($('main h1').length, 1, `${address}: the H1 is in main`);
    assert.equal(squash($('h1').text()), H1[lang], `${address}: the H1 text`);
    assert.equal($('title').text(), TITLE[lang], `${address}: the title is the page title and the suffix`);
    assert.equal($('meta[property="og:title"]').attr('content'), TITLE[lang], `${address}: og:title is the title`);
    for (const text of [$('title').text(), $('meta[property="og:title"]').attr('content'), $('main').text()]) {
      assert.doesNotMatch(text.toLocaleLowerCase('tr'), /evidence|kan[ıi]t/, `${address}: the page does not hold the evidence word`);
    }
    const content = frontmatterOf(lang);
    assert.equal(content.title, H1[lang], `${address}: the content title is the page title`);
    const length = Array.from(content.lead).length;
    assert.ok(length >= 1 && length <= LEAD_MAX[lang], `${address}: the lead is ${length} characters, at most ${LEAD_MAX[lang]}`);
    const description = $('meta[name="description"]').attr('content') ?? '';
    assert.equal(description, `${squash(content.lead)} ${PHRASE[lang]}.`, `${address}: the description is the lead and the suffix, not cut`);
    assert.ok(Array.from(description).length >= 70 && Array.from(description).length <= 160, `${address}: the description is 70 to 160 characters`);
    // One short paragraph, and the H1 is the only heading.
    assert.equal($('main p').length, 1, `${address}: one paragraph in main`);
    assert.equal(squash($('main p').text()), squash(content.paragraph), `${address}: the paragraph is the content key`);
    assert.ok(Array.from(squash(content.paragraph)).length >= 10 && Array.from(squash(content.paragraph)).length <= 160, `${address}: the paragraph is short`);
    assert.equal($('main h2, main h3, main h4, main h5, main h6').length, 0, `${address}: no heading below the H1`);
    // The measure of the paragraph (DESIGN.md Typography, step-body: at most 75 characters a line on the marketing surface). The page measures the characters of EVERY line (Range boxes, as the
    // design check reads its lines) at every width of the layout (every 20 px from 320 to 1440 and the neighbours of each breakpoint), so the test asserts the longest line, not the average.
    const { layout } = measured(lang);
    const lengthOfCopy = Array.from(squash(content.paragraph)).length;
    const measureProblems = [];
    for (const width of LAYOUT_WIDTHS) {
      assert.ok(layout[width], `${address} at ${width} px: the paragraph was measured`);
      for (const problem of paragraphProblems(layout[width], lengthOfCopy)) measureProblems.push(`${address} at ${width} px: ${problem}`);
    }
    assert.deepEqual(measureProblems, [], `${address}: the paragraph at every width`);
    assert.ok($('main p').hasClass('ct-p'), `${address}: the paragraph carries the class that sets its width in em`);
    // The rule itself, on copies of the real measurement: each of these changes is found (the longest line, not the average).
    const real = layout[768].paragraph;
    const probes = {
      'the old line of 95 characters beside a short one': (clone) => { clone.paragraph.lineChars = [95, 48]; clone.paragraph.lines = 2; },
      'one line of 76 among short ones': (clone) => { clone.paragraph.lineChars = [76, 30, 30]; clone.paragraph.lines = 3; },
      'a median of 29': (clone) => { clone.paragraph.lineChars = [29, 29, 40]; clone.paragraph.lines = 3; },
      'a last line of 6 characters': (clone) => { clone.paragraph.lineChars = [66, 66, 6]; clone.paragraph.lines = 3; },
      'a width of 75 ch': (clone) => { clone.paragraph.fontSize = '16px'; clone.paragraph.maxWidth = '818.4px'; },
      'a width of 33 rem on larger type': (clone) => { clone.paragraph.fontSize = '17px'; clone.paragraph.maxWidth = `${33 * 16}px`; },
      'a width of 561 px on smaller type': (clone) => { clone.paragraph.fontSize = '16px'; clone.paragraph.maxWidth = '561px'; },
      'no max-width': (clone) => { clone.paragraph.maxWidth = 'none'; },
      'a longer copy than the content key': (clone) => { clone.paragraph.chars += 30; },
      'the two counts of lines that differ': (clone) => { clone.paragraph.lines += 1; },
    };
    assert.deepEqual(paragraphProblems({ paragraph: { ...real, lineChars: [75, 40], lines: 2, chars: lengthOfCopy } }, lengthOfCopy), [], `${address}: a longest line of exactly 75 characters is allowed`);
    for (const [what, change] of Object.entries(probes)) {
      const clone = structuredClone({ paragraph: { ...real, chars: lengthOfCopy } });
      change(clone);
      assert.ok(paragraphProblems(clone, lengthOfCopy).length > 0, `${address}: ${what} is found`);
    }
    // The measure as the design check reads it (median of chars / lines of a paragraph of two or more lines): 30 to 75 at 390 px and 45 to 75 on the wider screens; three lines on a phone.
    for (const width of [390, 768, 1440]) {
      const paragraph = layout[width].paragraph;
      if (width === 390) {
        assert.ok(paragraph.lines >= 3, `${address} at 390 px: the paragraph takes ${paragraph.lines} lines, at least 3 are expected`);
        assert.ok(paragraph.chars / paragraph.lines >= 30 && paragraph.chars / paragraph.lines <= 75, `${address} at 390 px: ${paragraph.chars / paragraph.lines} characters per line, 30 to 75 are expected`);
      } else if (paragraph.lines >= 2) {
        assert.ok(paragraph.chars / paragraph.lines >= 45 && paragraph.chars / paragraph.lines <= 75, `${address} at ${width} px: ${paragraph.chars / paragraph.lines} characters per line, 45 to 75 are expected`);
      }
    }
  }
  assert.equal(PAGES[0][2], CONTACT_PAGE.en);
  assert.equal(PAGES[1][2], CONTACT_PAGE.tr);
});

it('contact: each page holds exactly the four owner links in order with the exact addresses and the link texts', () => {
  assert.deepEqual([OWNER.github, OWNER.linkedin, OWNER.medium, OWNER.email], HREFS, 'the constants of src/lib/contact.ts are the four addresses of the owner');
  assert.equal(EMAIL_ADDRESS, ADDRESS, 'the e-mail address constant');
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    assert.deepEqual(linkProblems($, lang), [], `${address}: the four links`);
    assert.deepEqual($('main a').toArray().map((a) => a.attribs.href), HREFS, `${address}: the addresses in order`);
    assert.deepEqual($('main a').toArray().map((a) => Object.keys(a.attribs).sort()), HREFS.map(() => ['class', 'href']), `${address}: a link has an address and a class and nothing else (no rel, target, ping)`);
    // The words of the content file are the link texts.
    const content = frontmatterOf(lang);
    assert.deepEqual([content.links.github, content.links.linkedin, content.links.medium, content.links.email], TEXTS[lang], `${address}: the content file holds the link texts`);
    // The rule itself: each broken page is found, on a copy of the built page.
    const html = $.html();
    const probes = {
      'the first two rows swapped': ($) => $('main li').first().before($('main li').eq(1)),
      'the last row first': ($) => $('main li').first().before($('main li').last()),
      'the e-mail row dropped': ($) => $('main li').last().remove(),
      'the Medium row dropped': ($) => $('main li').eq(2).remove(),
      'a fifth link added': ($) => $('main ul').append('<li><a href="https://example.com/">x</a></li>'),
      'a link outside the list': ($) => $('main p').append('<a href="https://github.com/furkansarikaya">GitHub</a>'),
      'a GitHub address with a trailing slash': ($) => $('main a').eq(0).attr('href', `${GITHUB}/`),
      'a GitHub address of one letter less': ($) => $('main a').eq(0).attr('href', GITHUB.slice(0, -1)),
      'the repository address in place of the profile': ($) => $('main a').eq(0).attr('href', REPO),
      'a LinkedIn address without www': ($) => $('main a').eq(1).attr('href', LINKEDIN.replace('www.', '')),
      'a LinkedIn address with another letter': ($) => $('main a').eq(1).attr('href', LINKEDIN.replace('furkansarikaya', 'furkansarikaye')),
      'a Medium address with http': ($) => $('main a').eq(2).attr('href', MEDIUM.replace('https', 'http')),
      'a Medium address without the trailing slash': ($) => $('main a').eq(2).attr('href', MEDIUM.slice(0, -1)),
      'an e-mail address with one n less': ($) => $('main a').eq(3).attr('href', 'mailto:furkansarikaya@gmail.com'),
      'an e-mail address of another domain': ($) => $('main a').eq(3).attr('href', 'mailto:furkannsarikaya@gmail.org'),
      'an e-mail link that is not mailto': ($) => $('main a').eq(3).attr('href', `https://${ADDRESS}`),
      'the first link text changed': ($) => $('main a').eq(0).text('Github'),
      'the second link text changed': ($) => $('main a').eq(1).text('Linkedin'),
      'the third link text changed': ($) => $('main a').eq(2).text('medium'),
      'the e-mail link showing the word and not the address': ($) => $('main a').eq(3).text(TEXTS[lang][3]),
      'the e-mail link showing another address': ($) => $('main a').eq(3).text('furkansarikaya@gmail.com'),
      'the e-mail word missing from its row': ($) => $('main li').last().find('span').remove(),
      'the e-mail word of the other language': ($) => $('main li').last().find('span').text(TEXTS[lang === 'en' ? 'tr' : 'en'][3]),
    };
    for (const [what, change] of Object.entries(probes)) assert.ok(linkProblems(changed(html, change), lang).length > 0, `${address}: ${what} is found`);
  }
});

it('contact: no form, input, textarea, button, ping attribute, query string, script other than controls.js, or resource from another host', () => {
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    assert.deepEqual(forbiddenProblems($), [], `${address}: nothing forbidden`);
    for (const selector of ['form', 'input', 'textarea', 'main button']) assert.equal($(selector).length, 0, `${address}: 0 ${selector}`);
    assert.equal($('[ping]').length, 0, `${address}: no ping attribute`);
    assert.deepEqual($('script').toArray().map((el) => el.attribs.src), ['/assets/controls.js'], `${address}: the controls script alone`);
    // The rule itself, on copies of the built page: each forbidden thing is found.
    const html = $.html();
    const probes = {
      'a form': ($) => $('main').append('<form action="/x"><p>x</p></form>'),
      'an input': ($) => $('main').append('<input type="email" name="e">'),
      'a textarea': ($) => $('main').append('<textarea></textarea>'),
      'a select': ($) => $('main').append('<select></select>'),
      'a button in main': ($) => $('main').append('<button type="button">x</button>'),
      'a second button in the header': ($) => $('header .tools').append('<button type="button">x</button>'),
      'a ping attribute': ($) => $('main a').eq(0).attr('ping', '/ping'),
      'a query string on the GitHub link': ($) => $('main a').eq(0).attr('href', `${GITHUB}?ref=site`),
      'a query string on the e-mail link': ($) => $('main a').eq(3).attr('href', `${MAILTO}?subject=hello`),
      'a query string on a header link': ($) => $('header nav a').eq(0).attr('href', '/?x=1'),
      'a second script': ($) => $('head').append('<script src="/assets/other.js"></script>'),
      'an inline script': ($) => $('head').append('<script>void 0</script>'),
      'the controls script in the body': ($) => { $('script').remove(); $('body').append('<script src="/assets/controls.js"></script>'); },
      'no script at all': ($) => $('script').remove(),
      'a script from another host': ($) => $('script').attr('src', 'https://cdn.example/controls.js'),
      'a stylesheet from another host': ($) => $('head').append('<link rel="stylesheet" href="https://cdn.example/a.css">'),
      'a preconnect to another host': ($) => $('head').append('<link rel="preconnect" href="https://www.googletagmanager.com">'),
      'an image': ($) => $('main').append('<img src="/a.png" alt="">'),
      'an image from another host': ($) => $('main').append('<img src="https://avatars.githubusercontent.com/u/1" alt="">'),
      'a frame': ($) => $('main').append('<iframe src="/x"></iframe>'),
      'an embed': ($) => $('main').append('<embed src="/x">'),
      'a link to another host in main': ($) => $('main li').first().append('<a href="https://example.com/">x</a>'),
      'a link to another profile of the owner host': ($) => $('main a').eq(0).attr('href', 'https://github.com/furkansarikaya/other'),
      'a link to another e-mail address': ($) => $('main a').eq(3).attr('href', 'mailto:someone@example.com'),
      'an owner profile link in the footer': ($) => $('footer p').append(`<a href="${LINKEDIN}">x</a>`),
      'an inline style': ($) => $('main p').attr('style', 'color: red'),
      'a meta refresh': ($) => $('head').append('<meta http-equiv="refresh" content="0; url=/">'),
    };
    for (const [what, change] of Object.entries(probes)) assert.ok(forbiddenProblems(changed(html, change)).length > 0, `${address}: ${what} is found`);
  }
});

it('contact: the four links are at least 44 px high and wide and show the 2 px accent focus ring with a 3 px offset', () => {
  for (const [lang, , address] of PAGES) {
    const result = measured(lang);
    for (const width of [1280, 320]) {
      assert.equal(result.links[width].length, 4, `${address} at ${width} px: four links`);
      result.links[width].forEach((link, i) => {
        assert.ok(link.height >= 44, `${address} at ${width} px: link ${i + 1} is ${link.height} px high`);
        assert.ok(link.width >= 44, `${address} at ${width} px: link ${i + 1} is ${link.width} px wide`);
        assert.equal(link.idle.style === 'solid' && link.idle.width === '2px', false, `${address} at ${width} px: link ${i + 1} shows no ring before it is reached`);
      });
    }
    assert.match(result.accent, /^rgb\(/, `${address}: the accent resolves to a colour`);
    assert.deepEqual(result.focus.map((reached) => reached.index), [0, 1, 2, 3], `${address}: the keyboard reaches the four links in order`);
    for (const reached of result.focus) {
      assert.equal(reached.focusVisible, true, `${address}: link ${reached.index + 1} matches :focus-visible when reached with the keyboard`);
      assert.equal(reached.style, 'solid', `${address}: link ${reached.index + 1} ring style`);
      assert.equal(reached.width, '2px', `${address}: link ${reached.index + 1} ring width`);
      assert.equal(reached.offset, '3px', `${address}: link ${reached.index + 1} ring offset`);
      assert.equal(reached.color, result.accent, `${address}: link ${reached.index + 1} ring colour is the accent`);
    }
  }
});

it('contact: from 320 to 1440 px no label or address breaks inside a word, the e-mail row wraps whole and the page does not scroll sideways', () => {
  // Every problem of every page and width is collected and compared once, so a failure names all of them.
  const problems = [];
  const expect = (ok, text) => { if (!ok) problems.push(text); };
  for (const [lang, , address] of PAGES) {
    const { layout } = measured(lang);
    for (const width of LAYOUT_WIDTHS) {
      const at = layout?.[width];
      assert.ok(at, `${address} at ${width} px: the rows were measured`);
      const where = `${address} at ${width} px`;
      assert.ok(at.probe.broken > 1 && at.probe.whole === 1, `${where}: the line counter sees a word that breaks (${at.probe.broken} lines) and a word that does not (${at.probe.whole})`);
      expect(at.scrollWidth <= at.clientWidth, `${where}: the page scrolls sideways (${at.scrollWidth} wide in ${at.clientWidth})`);
      assert.equal(at.rows.length, 4, `${where}: four rows`);
      for (const problem of stackingProblems(at)) problems.push(`${where}: ${problem}`);
      for (const problem of columnProblems(at, measured(lang).getStartedColumn[width], width)) problems.push(`${where}: ${problem}`);
      // The full computed box of every element the stylesheet or the content styles, in both themes, each value against the table of expected values.
      for (const problem of boxProblems(at)) problems.push(`${where}: ${problem}`);
      at.rows.forEach((row, i) => {
        const name = `${where}: row ${i + 1}`;
        expect(row.wrap === 'wrap', `${name} does not wrap (${row.wrap}), so a label and an address that do not fit side by side cannot stack`);
        expect(row.link.lines === 1, `${name}: the link text "${row.link.text}" is on ${row.link.lines} lines, not one`);
        expect(row.link.height >= 44 && row.link.width >= 44, `${name}: the link is ${row.link.width} by ${row.link.height} px`);
        expect(row.link.left >= at.column.left - 0.5 && row.link.right <= at.column.right + 0.5, `${name}: the link leaves the reading column (${row.link.left} to ${row.link.right} in ${at.column.left} to ${at.column.right})`);
        expect(row.row.right <= at.clientWidth + 0.5, `${name}: the row leaves the page`);
        if (i < 3) {
          expect(row.label === null, `${name}: a label in front of ${row.link.text}`);
          return;
        }
        assert.ok(row.label, `${name}: the e-mail row holds its label`);
        assert.equal(row.label.text, TEXTS[lang][3], `${name}: the label`);
        assert.equal(row.link.text, ADDRESS, `${name}: the address`);
        expect(row.label.lines === 1, `${name}: the label "${row.label.text}" is on ${row.label.lines} lines, not one`);
        expect(row.label.left >= at.column.left - 0.5 && row.label.right <= at.column.right + 0.5, `${name}: the label leaves the reading column`);
        // Beside the address or above it, never across it; where the column is wide the label stands in front of the address with the gap of the row between them.
        expect(row.label.right <= row.link.left + 0.5 || row.label.bottom <= row.link.top + 0.5, `${name}: the label covers the address`);
        if (width >= 768) expect(Math.abs(row.link.left - row.label.right - ROW_GAP) <= 0.5 && row.label.top < row.link.bottom && row.link.top < row.label.bottom, `${name}: the label does not stand on the line of the address with the gap of ${ROW_GAP} px (label ends ${row.label.right}, address starts ${row.link.left})`);
        // The rules that keep a word whole.
        expect(row.label.whiteSpace === 'nowrap', `${name}: the label is breakable (white-space ${row.label.whiteSpace})`);
        expect(row.label.overflowWrap === 'normal', `${name}: the label may break inside a word (overflow-wrap ${row.label.overflowWrap})`);
        expect(row.label.wordBreak === 'normal', `${name}: the label has a word-break rule (${row.label.wordBreak})`);
        expect(row.label.flexShrink === '0', `${name}: the label shrinks (${row.label.flexShrink})`);
      });
    }
  }
  assert.deepEqual(problems, [], 'the rows of both pages at every width');
  // The rule itself, on a copy of the measurement of each page at 768 and 1440 px (where the four rows are one under the other): each of these changes is found.
  for (const [lang, , address] of PAGES) {
    for (const width of [768, 1440]) {
      const real = measured(lang).layout[width];
      assert.deepEqual(stackingProblems(real), [], `${address} at ${width} px: the rule passes the real rows`);
      // The probes of the stacking and the column read no computed box, so their copies leave the boxes out (the boxes have probes of their own below).
      const slim = { ...real, colors: { light: { ...real.colors.light, boxes: null }, dark: { ...real.colors.dark, boxes: null } } };
      const copy = (change) => { const clone = structuredClone(slim); change(clone); return stackingProblems(clone); };
      const sideBySide = (clone) => { clone.rows.forEach((row, i) => { row.row.top = clone.rows[0].row.top; row.row.bottom = clone.rows[0].row.bottom; row.row.left = clone.column.left + i * 80; row.row.width = 76; }); };
      const probes = {
        'the rows displayed inline-flex': (clone) => { for (const row of clone.rows) { row.style.display = 'inline-flex'; sideBySide(clone); } },
        'the rows displayed inline-block': (clone) => { for (const row of clone.rows) row.style.display = 'inline-block'; },
        'the rows displayed as a block': (clone) => { for (const row of clone.rows) row.style.display = 'block'; },
        'the rows on one line': sideBySide,
        'the second row on the line of the first': (clone) => { clone.rows[1].row.top = clone.rows[0].row.top; },
        'the second row above the first': (clone) => { clone.rows[1].row.top = clone.rows[0].row.top - 100; clone.rows[1].row.bottom = clone.rows[0].row.top - 50; },
        'the second row overlapping the first': (clone) => { clone.rows[1].row.top = clone.rows[0].row.bottom - 10; },
        'the first row over the paragraph': (clone) => { clone.rows[0].row.top = clone.paragraph.bottom - 10; },
        'a floated row': (clone) => { clone.rows[2].style.float = 'left'; },
        'the rows in a column direction': (clone) => { clone.rows[3].style.flexDirection = 'column'; },
        'a row that does not wrap': (clone) => { clone.rows[3].wrap = 'nowrap'; },
        'a row narrower than the column': (clone) => { clone.rows[1].row.width = clone.column.width / 2; },
        'a row shifted to the right': (clone) => { clone.rows[1].row.left += 10; },
        'a changed gap between the label and the address': (clone) => { clone.rows[3].style.columnGap = '24px'; },
        'a gap between the lines of a row': (clone) => { clone.rows[3].style.rowGap = '8px'; },
        'the hairline above a row removed': (clone) => { clone.rows[2].style.borderTopWidth = '0px'; },
        'a hairline that is not solid': (clone) => { clone.rows[2].style.borderTopStyle = 'dashed'; },
        'the border under the last row removed': (clone) => { clone.rows[3].style.borderBottomWidth = '0px'; },
        'a border under a row that is not the last': (clone) => { clone.rows[1].style.borderBottomWidth = '1px'; },
        'a link that is an inline box': (clone) => { clone.rows[0].style.linkDisplay = 'inline'; },
        'a row lower than 44 px': (clone) => { clone.rows[0].row.height = 30; },
        'the hairline of a row in the accent colour': (clone) => { clone.colors.light.rows[1].top = clone.colors.light.accent; },
        'the hairline of a row in the ink colour in the dark theme': (clone) => { clone.colors.dark.rows[2].top = clone.colors.dark.ink; },
        'the hairline under the last row in another colour': (clone) => { clone.colors.dark.rows[3].bottom = clone.colors.dark.accent; },
        'both themes with one --rule colour': (clone) => { clone.colors.dark.rule = clone.colors.light.rule; },
        'the label grown': (clone) => { clone.rows[3].label.flexGrow = '1'; },
        'the label as wide as the column': (clone) => { clone.rows[3].label.width = clone.column.width - 100; },
        'the address pushed away from the label': (clone) => { clone.rows[3].link.left += 40; clone.rows[3].link.right += 40; },
        'the label and the address 8.8 px apart': (clone) => { clone.rows[3].label.ink.top -= 8.8; clone.rows[3].label.ink.bottom -= 8.8; },
        'the text of a link at the top of its box': (clone) => { clone.rows[1].link.ink.top -= 11; clone.rows[1].link.ink.bottom -= 11; },
        'the items of a row not centred': (clone) => { clone.rows[3].style.alignItems = 'flex-start'; },
        'the items of a row spread': (clone) => { clone.rows[3].style.justifyContent = 'space-between'; },
        'a padding on a row': (clone) => { clone.rows[2].style.padding = '8px 0px 8px 0px'; },
        'a margin on a link': (clone) => { clone.rows[1].link.margin = '0px 0px 0px 6px'; },
        'a row that is taller than its parts': (clone) => { clone.rows[1].row.height += 6; },
        'a link in a smaller type': (clone) => { clone.rows[0].link.fontSize = '13px'; },
        'a label with another line height': (clone) => { clone.rows[3].label.lineHeight = '16px'; },
        'a row with another order': (clone) => { clone.rows[3].style.order = '1'; },
        'the label after the address': (clone) => { clone.rows[3].label.left = clone.rows[3].link.right + 12; clone.rows[3].label.right = clone.rows[3].label.left + 50; },
        'a list marker': (clone) => { clone.rows[0].style.listStyleType = 'disc'; },
        'a list with another margin': (clone) => { clone.list.marginTop = '16px'; },
        'a list moved away from the paragraph': (clone) => { clone.list.top += 12; },
        'a paragraph with a larger margin under it': (clone) => { clone.paragraph.marginBottom = '30px'; },
      };
      for (const [what, change] of Object.entries(probes)) assert.ok(copy(change).length > 0, `${address} at ${width} px: ${what} is found`);
      // The full computed box: the table holds a value for every key of every element, and a changed value of ANY key of ANY element, in either theme, is found (the value is changed in the
      // real measurement and put back, at 768 px; at 1440 px only the named probes run, which keeps the test fast). A mutant of any declaration of contact.css changes a computed value.
      const wanted = { light: expectedBoxes(real, 'light'), dark: expectedBoxes(real, 'dark') };
      assert.deepEqual(boxProblems(real, wanted), [], `${address} at ${width} px: the full computed box of every element is as expected`);
      const boxProbes = {
        'a list with a margin under it': (clone) => { clone.colors.light.boxes.list.marginBottom = '8px'; },
        'a list with a margin under it in the dark theme': (clone) => { clone.colors.dark.boxes.list.marginBottom = '8px'; },
        'a list with a margin beside it': (clone) => { clone.colors.light.boxes.list.marginLeft = '4px'; },
        'a list with a padding': (clone) => { clone.colors.light.boxes.list.paddingBottom = '4px'; },
        'a row with a margin under it': (clone) => { clone.colors.dark.boxes.rows[1].row.marginBottom = '4px'; },
        'a link with a smaller least width': (clone) => { clone.colors.light.boxes.rows[2].link.minWidth = '40px'; },
        'a label that may shrink': (clone) => { clone.colors.light.boxes.rows[3].label.flexShrink = '1'; },
        'a paragraph with plain wrapping': (clone) => { clone.colors.dark.boxes.p.textWrap = 'wrap'; },
        'a paragraph with a larger margin under it (computed)': (clone) => { clone.colors.light.boxes.p.marginBottom = '30px'; },
        'a row without its hairline in the dark theme': (clone) => { clone.colors.dark.boxes.rows[0].row.borderTopStyle = 'none'; },
        'a link in the accent colour': (clone) => { clone.colors.dark.boxes.rows[1].link.color = clone.colors.dark.accent; },
      };
      for (const [what, change] of Object.entries(boxProbes)) {
        const clone = { ...real, colors: structuredClone(real.colors) };
        change(clone);
        assert.ok(boxProblems(clone).length > 0, `${address} at ${width} px: ${what} is found`);
      }
      for (const theme of ['light', 'dark']) {
        boxPairs(real.colors[theme].boxes, wanted[theme], theme).forEach(([name, actual, expected], index) => {
          assert.deepEqual(Object.keys(expected).sort(), [...BOX_KEYS].sort(), `${address} at ${width} px: ${name} has an expected value for every key and no other`);
          if (width !== 768) return;
          for (const key of BOX_KEYS) {
            const kept = actual[key];
            actual[key] = `${kept}, changed`;
            const mismatches = boxMismatches(name, actual, expected);
            actual[key] = kept;
            assert.equal(mismatches.length, 1, `${address} at ${width} px: ${name} with another ${key} is found, once`);
          }
          // The whole rule reaches every element: one key of each, changed in the real measurement, makes boxProblems name that element.
          const key = BOX_KEYS[index % BOX_KEYS.length];
          const kept = actual[key];
          actual[key] = `${kept}, changed`;
          const problems = boxProblems(real, wanted);
          actual[key] = kept;
          assert.ok(problems.length === 1 && problems[0].startsWith(name), `${address} at ${width} px: the rule finds ${name} with another ${key}`);
        });
      }
      // The column: the real column passes, each change is found, as it is for the narrow and the wide grid.
      const started = measured(lang).getStartedColumn[width];
      assert.deepEqual(columnProblems(real, started, width), [], `${address} at ${width} px: the rule passes the real column`);
      const columnProbes = {
        'a column wider than the grid gives': (clone) => { clone.column.width += 80; },
        'a column shifted': (clone) => { clone.column.left -= 40; },
        'the column of another grid column': (clone) => { clone.column.start = '3'; },
        'the column of another span': (clone) => { clone.column.end = 'span 8'; },
        'a column with a padding': (clone) => { clone.column.padding = '0px 12px 0px 12px'; },
        'a paragraph outside the column': (clone) => { clone.paragraph.left -= 30; },
        'a row wider than the column': (clone) => { clone.rows[1].row.width += 30; },
        'a grid of another track list': (clone) => { clone.grid.tracks = clone.grid.tracks.split(' ').slice(1).join(' '); },
      };
      for (const [what, change] of Object.entries(columnProbes)) {
        const clone = structuredClone(slim);
        change(clone);
        assert.ok(columnProblems(clone, started, width).length > 0, `${address} at ${width} px: ${what} is found`);
      }
      assert.ok(columnProblems(real, { left: started.left, width: started.width + 60 }, width).length > 0, `${address} at ${width} px: a column that differs from the get-started page is found`);
    }
  }
});

it('contact: the last menu item is Contact on every built page in its language and the other items keep their order', () => {
  assert.equal(built.status, 0, `the private build exits 0: ${built.output.slice(-400)}`);
  const rels = Object.keys(allHtml);
  for (const rel of MENU_PAGES) assert.ok(rels.includes(rel), `${rel} is built`);
  for (const rel of rels) {
    const lang = rel === 'tr/index.html' || rel.startsWith('tr/') ? 'tr' : 'en';
    const $ = load(allHtml[rel]);
    assert.deepEqual(menuProblems(menuOf($), lang), [], `${rel}: the menu`);
    assert.equal($('header nav a').last().attr('href'), lang === 'tr' ? '/tr/iletisim/' : '/contact/', `${rel}: Contact is the last item`);
    assert.equal($('header nav a').length, 4, `${rel}: four entries`);
    // The entry is a plain item of the menu: the header controls follow it, in the order brand, menu, GitHub, language, theme.
    const controls = $('header a[href], header button').toArray().map((el) => el.attribs.id ?? el.attribs.class ?? 'menu');
    assert.deepEqual(controls.slice(-3), rel === '404.html' ? ['menu', 'b-gh', 'b-theme'] : ['b-gh', 'b-lang', 'b-theme'], `${rel}: the GitHub icon, the language link and the theme button come after the menu`);
  }
  for (const [lang, , address] of PAGES) {
    assert.deepEqual(page(lang)('header nav a[aria-current="page"]').toArray().map((a) => a.attribs.href), [address], `${address}: the contact page marks its own entry`);
  }
  // The module: the entry is appended last, on the site surface, and the real pairs list the four built entries; the fixed order holds with every pair registered.
  assert.equal(MENU.length, 6, 'six entries');
  assert.deepEqual(MENU.at(-1), { en: '/contact/', tr: '/tr/iletisim/', label: { en: 'Contact', tr: 'İletişim' }, surface: 'site' }, 'the last entry');
  assert.deepEqual(MENU.map((entry) => entry.en), ['/', '/get-started/', '/docs/', '/trust/', '/claude-code-and-codex/', '/contact/'], 'the five older entries keep their order');
  assert.deepEqual(MENU.map((entry) => entry.surface), ['site', 'site', 'docs', 'site', 'site', 'site']);
  // The order of the properties of an exported value is part of the value: every entry (the new one too) lists en, tr, label, surface, and its label lists en, tr.
  for (const entry of MENU) {
    assert.deepEqual(Object.keys(entry), ['en', 'tr', 'label', 'surface'], `${entry.en}: the properties of the entry in order`);
    assert.deepEqual(Object.keys(entry.label), ['en', 'tr'], `${entry.en}: the properties of the label in order`);
  }
  for (const lang of ['en', 'tr']) {
    assert.deepEqual(menu(lang).map((entry) => entry.href), MENU_HREFS[lang], `${lang}: the real pairs give the four entries`);
    assert.deepEqual(menu(lang).map((entry) => entry.label), MENU_LABELS[lang], `${lang}: the labels`);
    const everything = [...PAIRS, { en: '/docs/', tr: '/tr/docs/' }, { en: '/trust/', tr: '/tr/guven/' }];
    assert.equal(menu(lang, everything).at(-1).href, MENU_HREFS[lang].at(-1), `${lang}: Contact stays last when the docs and trust pairs exist`);
    assert.equal(menu(lang, [...everything].reverse()).at(-1).href, MENU_HREFS[lang].at(-1), `${lang}: Contact stays last whatever the order of the pairs`);
    assert.deepEqual(menu(lang, everything).map((entry) => entry.label).slice(0, 5), lang === 'en' ? ['Home', 'Get started', 'Docs', 'Trust', 'Claude Code + Codex'] : ['Ana sayfa', 'Başlarken', 'Belgeler', 'Güven', 'Claude Code ve Codex'], `${lang}: the five older entries keep their order`);
    // Without its pair the entry is not listed: registration is existence.
    assert.deepEqual(menu(lang, PAIRS.filter((pair) => pair.en !== '/contact/')).map((entry) => entry.href), MENU_HREFS[lang].slice(0, 3), `${lang}: no pair, no Contact entry`);
  }
  // The rule itself: each broken menu is found.
  const good = menuOf(page('en'));
  assert.deepEqual(menuProblems(good, 'en'), []);
  const broken = {
    'Contact first': [good[3], ...good.slice(0, 3)],
    'Contact before the last entry': [good[0], good[1], good[3], good[2]],
    'the entry missing': good.slice(0, 3),
    'the entry twice': [...good, good[3]],
    'the older items out of order': [good[1], good[0], good[2], good[3]],
    'a wrong label': [...good.slice(0, 3), { href: '/contact/', label: 'Contact us' }],
    'a wrong address': [...good.slice(0, 3), { href: '/contact', label: 'Contact' }],
    'the Turkish entry on the English menu': [...good.slice(0, 3), { href: '/tr/iletisim/', label: 'İletişim' }],
  };
  for (const [what, items] of Object.entries(broken)) assert.ok(menuProblems(items, 'en').length > 0, `${what} is found`);
  assert.ok(menuProblems(menuOf(page('tr')), 'en').length > 0, 'the Turkish menu is not the English one');
  // The header does not break at any width: no sideways scroll, and from 821 px the menu is one row between the brand and the tools.
  for (const [lang, , address] of PAGES) {
    const header = measured(lang).header;
    for (const width of VIEWPORTS) {
      const at = header[width];
      assert.ok(at.scrollWidth <= at.clientWidth, `${address} at ${width} px: the page does not scroll sideways (${at.scrollWidth} > ${at.clientWidth})`);
      assert.equal(at.links.length, 4, `${address} at ${width} px: four menu links`);
      for (const link of at.links) assert.ok(link.left >= 0 && link.right <= at.clientWidth, `${address} at ${width} px: a menu link lies inside the window`);
      if (width < 821) continue;
      assert.equal(new Set(at.links.map((link) => Math.round(link.top))).size, 1, `${address} at ${width} px: the menu is one row`);
      at.links.forEach((link, i) => { if (i > 0) assert.ok(link.left >= at.links[i - 1].right, `${address} at ${width} px: menu link ${i + 1} does not overlap the one before it`); });
      assert.ok(at.brand.right <= at.links[0].left, `${address} at ${width} px: the brand ends before the menu`);
      assert.ok(at.links.at(-1).right <= at.tools.left, `${address} at ${width} px: the menu ends before the tools (${at.links.at(-1).right} > ${at.tools.left})`);
    }
  }
});

it('contact: the header GitHub icon keeps the repository address and its accessible name without noreferrer and the page link is another address', () => {
  const targets = [...PAGES.map(([lang, rel]) => [lang, rel]), ['en', 'index.html'], ['tr', 'tr/index.html']];
  for (const [lang, rel] of targets) {
    const $ = load(allHtml[rel] ?? '');
    assert.deepEqual(iconProblems($, lang), [], `${rel}: the GitHub icon`);
    assert.equal($('a#b-gh').attr('href'), REPO);
    assert.equal($('a#b-gh').attr('rel'), undefined, `${rel}: the icon has no rel at all`);
    assert.equal($('a[rel~="noreferrer"]').length, 0, `${rel}: no link has noreferrer`);
  }
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    assert.notEqual($('main a').first().attr('href'), $('a#b-gh').attr('href'), `${address}: the GitHub link of the page is not the address of the icon`);
    assert.equal($('main a').first().attr('href'), GITHUB, `${address}: the GitHub link of the page is the profile of the owner`);
    assert.equal($('main a#b-gh').length, 0, `${address}: the icon is not in main`);
    // The rule itself: each change to the icon is found.
    const html = $.html();
    const probes = {
      'the icon leading to the profile of the owner': ($) => $('a#b-gh').attr('href', GITHUB),
      'the icon leading to the site repository': ($) => $('a#b-gh').attr('href', SITE_REPO),
      'the icon with noreferrer': ($) => $('a#b-gh').attr('rel', 'noreferrer'),
      'the icon with noopener and noreferrer': ($) => $('a#b-gh').attr('rel', 'noopener noreferrer'),
      'the icon with another name': ($) => $('a#b-gh').attr('aria-label', 'GitHub'),
      'the icon with the name of the other language': ($) => $('a#b-gh').attr('aria-label', GITHUB_NAME[lang === 'en' ? 'tr' : 'en']),
      'the icon removed': ($) => $('a#b-gh').remove(),
      'a second icon': ($) => $('a#b-gh').after(`<a id="b-gh" href="${REPO}" aria-label="${GITHUB_NAME[lang]}">x</a>`),
      'a profile link in the header': ($) => $('header nav li').first().append(`<a href="${GITHUB}">x</a>`),
    };
    for (const [what, change] of Object.entries(probes)) assert.ok(iconProblems(changed(html, change), lang).length > 0, `${address}: ${what} is found`);
  }
});

it('contact: the pages list each other as hreflang alternates with x-default and the language link leads between them', () => {
  const expected = [
    { hreflang: 'en', href: `${ORIGIN}/contact/` },
    { hreflang: 'tr', href: `${ORIGIN}/tr/iletisim/` },
    { hreflang: 'x-default', href: `${ORIGIN}/contact/` },
  ];
  const alternatesOf = ($) => $('link[rel="alternate"][hreflang]').toArray().map((el) => ({ hreflang: $(el).attr('hreflang'), href: $(el).attr('href') }));
  for (const [lang, , address] of PAGES) {
    assert.deepEqual(alternatesOf(page(lang)), expected, `${address}: the alternates`);
    assert.deepEqual(alternates(address), expected, `${address}: the translation index gives the same`);
  }
  assert.deepEqual(PAIRS.find((pair) => pair.en === '/contact/'), { en: '/contact/', tr: '/tr/iletisim/' }, 'the pair is registered');
  assert.deepEqual(PAIRS.at(-1), { en: '/contact/', tr: '/tr/iletisim/' }, 'the pair is appended last');
  assert.deepEqual(Object.keys(PAIRS.at(-1)), ['en', 'tr'], 'the pair lists en and then tr');
  assert.deepEqual(switcherTarget('/contact/'), { href: '/tr/iletisim/', lang: 'tr', translated: true });
  assert.deepEqual(switcherTarget('/tr/iletisim/'), { href: '/contact/', lang: 'en', translated: true });
  const en = page('en')('a#b-lang');
  const tr = page('tr')('a#b-lang');
  assert.equal(en.length, 1);
  assert.equal(tr.length, 1);
  assert.equal(en.attr('href'), '/tr/iletisim/', 'the English page leads to the Turkish page, not to a home page');
  assert.equal(en.attr('hreflang'), 'tr');
  assert.equal(tr.attr('href'), '/contact/', 'the Turkish page leads back, not to a home page');
  assert.equal(tr.attr('hreflang'), 'en');
  for (const link of [en, tr]) assert.ok(!['/', '/tr/'].includes(link.attr('href')), 'the language link does not lead to a home page');
  // The menu entry of each page leads to its own address.
  for (const [lang, , address] of PAGES) assert.equal(page(lang)(`header nav a[href="${address}"]`).length, 1, `${address}: the menu lists the page`);
});

it('contact: the alternates function returns the Turkish address for the English one', () => {
  const list = alternates('/contact/');
  assert.deepEqual(list.map((item) => item.hreflang), ['en', 'tr', 'x-default']);
  assert.equal(list.find((item) => item.hreflang === 'tr')?.href, `${ORIGIN}/tr/iletisim/`, 'the Turkish alternate of the English address');
  assert.equal(list.find((item) => item.hreflang === 'x-default')?.href, `${ORIGIN}/contact/`, 'x-default is the English address');
  assert.equal(alternates('/tr/iletisim/').find((item) => item.hreflang === 'en')?.href, `${ORIGIN}/contact/`, 'the English alternate of the Turkish address');
  // Without the pair the index returns nothing for the address, so the registration is what the test reads.
  const without = createIndex(PAIRS.filter((pair) => pair.en !== '/contact/'));
  assert.deepEqual(without.alternates('/contact/'), [], 'an index without the pair has no alternate for the address');
  assert.deepEqual(without.alternates('/tr/iletisim/'), [], 'an index without the pair has no alternate for the Turkish address');
  assert.deepEqual(createIndex(PAIRS).alternates('/contact/'), list, 'an index of the real pairs returns the three');
  assert.equal(without.switcherTarget('/contact/').translated, false, 'an index without the pair leads the language link to a home page');
});

it('contact: the stamp matches the English content file and a stale English file shows the notice', () => {
  const stamp = frontmatterOf('tr').translatedFrom;
  assert.deepEqual(Object.keys(stamp).sort(), ['hash', 'page'], 'the stamp holds the page and the hash');
  assert.equal(stamp.page, CONTENT_FILE.en, 'the stamp names the English file');
  assert.match(stamp.hash, /^[0-9a-f]{64}$/, 'the hash is a sha256');
  assert.equal(stamp.hash, contentHash(read(CONTENT_FILE.en)), 'the hash is the one of the English file');
  assert.equal(isStale({ kind: 'site', translatedFrom: stamp }, { root }), false, 'the Turkish page is not stale');
  assert.equal(isStale({ kind: 'site', translatedFrom: { ...stamp, hash: contentHash(`${read(CONTENT_FILE.en)}x`) } }, { root }), true, 'a changed English file makes it stale');
  assert.equal(frontmatterOf('en').translatedFrom, undefined, 'the English file carries no stamp');
  assert.deepEqual(leaves(frontmatterOf('tr')).filter((key) => !key.startsWith('translatedFrom')).sort(), leaves(frontmatterOf('en')).sort(), 'both files hold the same key set');
  // The build of the real site prints no stale warning for the Turkish page.
  assert.equal(built.status, 0, `the private build exits 0: ${built.output.slice(-400)}`);
  assert.equal(built.output.includes('/tr/iletisim/: the English source changed'), false, 'the build prints no stale warning');
  // The page files rendered from a fixture root: a matching English file warns of nothing, a changed one makes the Turkish page warn once naming itself, a missing one fails the Turkish page.
  const good = pageRuns.good;
  assert.equal(good.tr.error, undefined, `the Turkish page renders: ${good.tr.error?.message}`);
  assert.deepEqual(good.tr.value.warnings, [], 'a matching stamp prints no warning');
  assert.equal(good.en.error, undefined, 'the English page renders');
  assert.deepEqual(good.en.value.warnings, [], 'the English page warns of nothing');
  const stale = pageRuns.stale;
  assert.equal(stale.tr.error, undefined, `a stale stamp still renders: ${stale.tr.error?.message}`);
  assert.deepEqual(stale.tr.value.warnings, ['[proofline] warning: /tr/iletisim/: the English source changed since this translation'], 'the Turkish page warns once, naming itself');
  assert.equal(stale.en.error, undefined, 'the English page renders');
  assert.deepEqual(stale.en.value.warnings, [], 'the English page carries no stamp and warns of nothing');
  const missing = pageRuns.noEnglish;
  assert.ok(missing.tr.error, 'a stamp that names a file that is not there fails the Turkish page');
  assert.ok(missing.tr.error.message.startsWith('/tr/iletisim/: '), `the error names the Turkish page: ${missing.tr.error.message.slice(0, 120)}`);
  assert.equal(missing.en.error, undefined, 'the English page reads no stamp and renders');
});

it('contact: the Turkish page is Turkish prose with its letters intact and the English page holds no Turkish prose', () => {
  const trPage = page('tr');
  const enPage = page('en');
  assert.equal(trPage('html').attr('lang'), 'tr');
  assert.equal(enPage('html').attr('lang'), 'en');
  // The product names are plain text: no element of main carries another language.
  assert.equal(trPage('main [lang]').length, 0, 'no element of the Turkish main carries a language attribute');
  assert.equal(enPage('main [lang]').length, 0, 'no element of the English main carries a language attribute');
  // The Turkish letters are intact: the heading, the menu entry, the e-mail word, the title and the content file hold the exact text, never an ASCII spelling.
  assert.equal(trPage('h1').text(), 'İletişim');
  assert.equal(trPage('header nav a').last().text().trim(), 'İletişim');
  assert.equal(trPage('main li').last().find('span').text().trim(), 'E-posta');
  assert.ok(trPage('title').text().startsWith('İletişim | '));
  assert.ok(read(CONTENT_FILE.tr).includes('title: "İletişim"'), 'the content file holds the heading with its letters');
  for (const wrong of ['Iletisim', 'iletisim', 'İletisim', 'Iletişim', 'Eposta']) assert.ok(!trPage('main').text().includes(wrong) && !trPage('title').text().includes(wrong), `the page holds no spelling ${wrong}`);
  // The prose: what is left once the links are removed.
  const proseOf = ($) => squash($('main p').text());
  const trProse = proseOf(trPage);
  assert.doesNotMatch(trProse, /(?<![\p{L}'’])(the|and|with|then|your|from|where|take|is|are|was|were|this|that|it|in|of|to|a|an|on|for|there|no|choose|or|write)(?![\p{L}])/iu, 'no English function word in the Turkish prose');
  assert.match(trProse, /[çğıöşüÇĞİÖŞÜ]|(?<![\p{L}])(ve|bir|için|ile|ya|da|yok)(?![\p{L}])/u, 'the Turkish paragraph reads as Turkish');
  // Each prose key of the Turkish file reads as Turkish.
  const tr = frontmatterOf('tr');
  for (const key of ['title', 'lead', 'paragraph', 'links.email']) {
    assert.match(get(tr, key), /[çğıöşüÇĞİÖŞÜ]|(?<![\p{L}])(ve|bir|için|sonra|ile|olan|yerine|içinde|veya|ya|da|yok|posta)(?![\p{L}])/iu, `${key} reads as Turkish`);
  }
  // The English page holds no Turkish prose: no Turkish letter and no Turkish function word in main, the head or the content file.
  const turkishLetters = /[çğıöşüÇĞİÖŞÜ]/;
  const turkishWords = /(?<![\p{L}])(ve|bir|için|ile|veya|ya|da|yok|değil|bu|şu|ama|çok|ulaşın|yazın|seçin|iletişim|posta)(?![\p{L}])/iu;
  for (const text of [enPage('main').text(), enPage('title').text(), enPage('meta[name="description"]').attr('content'), read(CONTENT_FILE.en)]) {
    assert.doesNotMatch(text, turkishLetters, 'no Turkish letter on the English page');
    assert.doesNotMatch(text, turkishWords, 'no Turkish word on the English page');
  }
  // The Turkish page is not the English text with Turkish headings: every prose key differs, no English paragraph is repeated, and few words are shared.
  const en = frontmatterOf('en');
  for (const key of ['title', 'lead', 'paragraph', 'links.email']) assert.notEqual(get(tr, key), get(en, key), `${key} is written in Turkish, not copied`);
  assert.notEqual(proseOf(enPage), trProse, 'the paragraphs differ');
  assert.notEqual(enPage('h1').text(), trPage('h1').text(), 'the headings differ');
  const wordsOf = (text) => text.toLocaleLowerCase('tr').match(/[\p{L}]+/gu) ?? [];
  const english = new Set(wordsOf(`${proseOf(enPage)} ${enPage('main li span').text()}`));
  const shared = wordsOf(trProse).filter((word) => english.has(word));
  assert.ok(shared.length / wordsOf(trProse).length < 0.25, `the Turkish paragraph shares ${shared.length} of ${wordsOf(trProse).length} words with the English one`);
  // The rule itself on strings: a Turkish word on the English page and an English sentence on the Turkish page are found.
  assert.match('Write an e-mail, ya da bir profil seçin.', turkishWords, 'a Turkish word is found');
  assert.match('Choose a profile or write an e-mail.', /(?<![\p{L}'’])(the|and|a|an|or|write)(?![\p{L}])/iu, 'an English sentence is found');
});

it('contact: the footer of both pages equals the shared footer line of its language', () => {
  const pin = JSON.parse(read('sync/pin.json'));
  assert.match(pin.commit, /^[0-9a-f]{40}$/, 'sync/pin.json holds a commit');
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    assert.equal($('footer').length, 1, `${address}: one footer`);
    assert.equal($('footer p').length, 1, `${address}: one paragraph`);
    assert.equal(squash($('footer p').text()), FOOTER[lang], `${address}: the footer line of the language`);
    assert.equal($('footer p').attr('lang'), undefined, `${address}: no language attribute on the paragraph`);
    assert.equal($('footer [lang], footer span').length, 0, `${address}: no span and no language attribute inside`);
    assert.deepEqual($('footer a').toArray().map((a) => [squash($(a).text()), a.attribs.href, a.attribs.rel]), [
      ['LICENSE', `${REPO}/blob/${pin.commit}/LICENSE`, undefined],
      [lang === 'tr' ? 'proofline ile yapıldı' : 'Built with proofline', SITE_REPO, undefined],
    ], `${address}: the two footer links`);
    assert.equal($('main footer').length, 0, `${address}: the footer is not in main`);
    // The footer line is the one of the home page of the language.
    const home = load(allHtml[lang === 'en' ? 'index.html' : 'tr/index.html']);
    assert.equal(squash(home('footer p').text()), squash($('footer p').text()), `${address}: the same line as the home page`);
    assert.notEqual(squash($('footer p').text()), FOOTER[lang === 'en' ? 'tr' : 'en'], `${address}: not the footer of the other language`);
  }
});

it('contact: no tracking, no widget and no address differs by one character', () => {
  // Every neighbour of an address (one letter deleted, one letter changed, one letter added, the trailing slash toggled, the scheme changed) is told apart from it.
  const neighbours = (value) => {
    const found = new Set();
    for (let i = 0; i < value.length; i += 1) {
      found.add(value.slice(0, i) + value.slice(i + 1));
      found.add(`${value.slice(0, i)}${value[i] === 'x' ? 'y' : 'x'}${value.slice(i + 1)}`);
      found.add(`${value.slice(0, i)}x${value.slice(i)}`);
    }
    found.add(`${value}x`);
    found.add(value.endsWith('/') ? value.slice(0, -1) : `${value}/`);
    found.add(value.replace(/^https/, 'http'));
    found.delete(value);
    return [...found];
  };
  HREFS.forEach((href, i) => {
    assert.ok(neighbours(href).length > 40, 'the neighbours are many');
    for (const neighbour of neighbours(href)) assert.notEqual(neighbour, href);
    for (const [lang, , address] of PAGES) {
      const $ = page(lang);
      assert.equal($('main a').eq(i).attr('href'), href, `${address}: link ${i + 1} is the address of the owner, character for character`);
      // The check of the page tells every neighbour apart: the main element with the neighbour in place of the address has a problem (the copy is changed in place and put back).
      const copy = load(`<main>${$('main').html()}</main>`);
      assert.deepEqual(linkProblems(copy, lang), [], `${address}: the copy of main passes`);
      for (const neighbour of neighbours(href)) {
        copy('main a').eq(i).attr('href', neighbour);
        assert.ok(linkProblems(copy, lang).length > 0, `${address}: "${neighbour}" in place of link ${i + 1} is found`);
      }
    }
  });
  // The e-mail address as text is the same address as the link: the visible text and the address of the link agree character for character.
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    assert.equal(squash($('main a').last().text()), ADDRESS, `${address}: the visible address`);
    assert.equal($('main a').last().attr('href'), `mailto:${squash($('main a').last().text())}`, `${address}: the visible address is the address of the link`);
    // No tracking and no widget: nothing is loaded, no tracking parameter is spelled, no consent or analytics word is in the page.
    const withoutFooter = changed($.html(), ($$) => $$('footer').remove()).html().toLowerCase();
    for (const token of ['utm_', 'fbclid', 'gclid', 'analytics', 'gtag', 'pixel', 'tracker', 'widget', 'iframe', 'cookie', 'onclick', 'onload', 'sendbeacon', 'fetch(']) assert.ok(!withoutFooter.includes(token), `${address}: the page holds no ${token} outside the footer`);
    assert.deepEqual($('link[rel~="preconnect"], link[rel~="dns-prefetch"], link[rel~="prefetch"], link[rel~="preload"], link[rel~="prerender"]').length, 0, `${address}: no connection hint`);
    assert.equal($('[onclick], [onload], [onerror], [onfocus], [onmouseover]').length, 0, `${address}: no event attribute`);
    assert.equal($('main script, main style, main iframe, main embed, main object, main img, main svg, main video, main audio').length, 0, `${address}: main holds no widget, no image and no script`);
    assert.equal(forbiddenProblems($).length, 0, `${address}: nothing forbidden`);
    // The rule itself: a tracking parameter, a widget and a third-party script are found.
    for (const [what, change] of Object.entries({
      'a tracking parameter': ($$) => $$('main a').eq(1).attr('href', `${LINKEDIN}?utm_source=site`),
      'a profile widget': ($$) => $$('main').append('<iframe src="https://github.com/furkansarikaya"></iframe>'),
      'a third-party script': ($$) => $$('head').append('<script src="https://www.googletagmanager.com/gtag/js"></script>'),
      'a beacon': ($$) => $$('main a').eq(0).attr('ping', 'https://example.com/p'),
    })) assert.ok(forbiddenProblems(changed($.html(), change)).length > 0, `${address}: ${what} is found`);
  }
});

it('contact: readContactContent rejects a missing, non-text or empty value of every key and names the key', () => {
  const source = frontmatterOf('en');
  assert.deepEqual([...TEXT_KEYS].sort(), leaves(source).sort(), 'the list names every key of the English content file, so a new key must be added here');
  assert.deepEqual([...LIB_TEXT_KEYS].sort(), [...TEXT_KEYS].sort(), 'the module reads the same keys');
  const withValue = (path, value, from = source) => {
    const copy = structuredClone(from);
    const parts = path.split('.');
    const last = parts.pop();
    const holder = parts.reduce((object, part) => object[part], copy);
    if (value === undefined) delete holder[last]; else holder[last] = value;
    return copy;
  };
  const named = (key) => (error) => error instanceof Error && error.message === `contact content: missing ${key}`;
  assert.equal(readContactContent(source), source, 'the real English file passes and is returned as it is');
  const tr = frontmatterOf('tr');
  assert.equal(readContactContent(tr), tr, 'the Turkish file passes and is returned as it is, with its translatedFrom stamp');
  assert.deepEqual(Object.keys(tr).sort(), ['lead', 'links', 'paragraph', 'title', 'translatedFrom'], 'the Turkish file holds the stamp besides the keys');
  for (const [name, from] of [['English', source], ['Turkish', tr]]) {
    for (const key of TEXT_KEYS) {
      assert.throws(() => readContactContent(withValue(key, undefined, from)), named(key), `${name} ${key}: a missing key is named`);
      for (const value of [3, null, true, ['text'], { text: 'x' }]) assert.throws(() => readContactContent(withValue(key, value, from)), named(key), `${name} ${key}: ${JSON.stringify(value)} is not text`);
      assert.throws(() => readContactContent(withValue(key, '', from)), named(key), `${name} ${key}: an empty string is rejected`);
      assert.throws(() => readContactContent(withValue(key, ' \n\t ', from)), named(key), `${name} ${key}: a white-space-only string is rejected`);
    }
  }
  // A group that is missing or is not an object names the first key below it that is read.
  assert.throws(() => readContactContent(withValue('links', undefined)), named('links.github'), 'a missing group names its first key');
  assert.throws(() => readContactContent(withValue('links', 'text')), named('links.github'), 'a group that is text names its first key');
  for (const input of [undefined, null, 'text', 3, []]) assert.throws(() => readContactContent(input), named('title'), `${JSON.stringify(input)} is not a content file`);
  // The function checks what the page prints; a key it does not read is kept and does not throw.
  assert.doesNotThrow(() => readContactContent({ ...source, extra: 'x' }), 'an extra key does not throw');
  // The first missing key is the one named, in the order of the list.
  assert.throws(() => readContactContent({}), named('title'), 'an empty object names the first key');
  assert.throws(() => readContactContent({ ...withValue('paragraph', undefined), lead: '' }), named('lead'), 'the first bad key in the order of the list is named');
  // The component validates its own content prop: rendered directly (the setup renders it), every key of the helper's list in both languages and every kind of bad value throws the helper error that names the key.
  assert.deepEqual([...LIB_TEXT_KEYS].sort(), [...TEXT_KEYS].sort(), 'the key list of the module is the key list of the content files');
  // The list is exported in the order the helper reads it: the same order as the list of this file, and of two bad keys the one earlier in the list is named, for every pair of keys.
  assert.deepEqual([...LIB_TEXT_KEYS], TEXT_KEYS, 'the module lists the keys in the order of the page');
  for (const lang of ['en', 'tr']) {
    const from = frontmatterOf(lang);
    for (const [i, first] of TEXT_KEYS.entries()) {
      for (const second of TEXT_KEYS.slice(i + 1)) {
        assert.throws(() => readContactContent(contentWith(contentWith(from, second, ''), first, undefined)), named(first), `${lang}: ${first} is named before ${second}`);
        assert.throws(() => readContactContent(contentWith(contentWith(from, first, ''), second, undefined)), named(first), `${lang}: ${first} is named before ${second} (the bad values the other way round)`);
      }
    }
  }
  assert.deepEqual(Object.keys(CONTACT_PAGE), ['en', 'tr'], 'the addresses of the pages list en and then tr');
  let rejected = 0;
  for (const lang of ['en', 'tr']) {
    const from = frontmatterOf(lang);
    const bads = badContents(from);
    assert.equal(bads.length, LIB_TEXT_KEYS.length * BAD_VALUES.length + 7, `${lang}: every key meets every kind of bad value, and the group and whole-value cases`);
    for (const [label, bad] of bads) {
      const run = badComponentRuns[`${lang}|${label}`];
      assert.ok(run, `${lang} ${label}: the component was rendered`);
      assert.equal(run.html, undefined, `${lang} ${label}: the component does not render a page from a bad content`);
      assert.ok(run.error instanceof Error, `${lang} ${label}: the component throws`);
      assert.equal(run.error.message, `contact content: missing ${bad.key}`, `${lang} ${label}: the error names the key`);
      rejected += 1;
    }
    // A valid content of the language renders through the same path (the element tree test reads what it prints).
    assert.doesNotThrow(() => readContactContent(from), `${lang}: the valid content is accepted by the helper`);
  }
  assert.equal(rejected, 2 * (LIB_TEXT_KEYS.length * BAD_VALUES.length + 7), 'both languages were checked');
  assert.equal(componentRuns.plain?.error, undefined, 'a valid content renders');
  assert.equal(typeof componentRuns.plain?.html, 'string', 'a valid content gives html');
});

it('contact: every prop of both page files is passed and observed', () => {
  const expected = {
    en: { base: { path: '"/contact/"', title: "{{ kind: 'site', text: content.title }}", lead: '{content.lead}' }, page: { content: '{content}' } },
    tr: {
      base: { path: '"/tr/iletisim/"', title: "{{ kind: 'site', text: content.title }}", lead: '{content.lead}', source: "{{ kind: 'site', translatedFrom: frontmatter.translatedFrom }}" },
      page: { content: '{content}' },
    },
  };
  for (const [lang, , address] of PAGES) {
    const source = read(PAGE_FILE[lang]);
    const bases = propsOf(source, 'Base');
    const contacts = propsOf(source, 'ContactPage');
    assert.equal(bases.length, 1, `${address}: one Base element`);
    assert.equal(contacts.length, 1, `${address}: one ContactPage element`);
    assert.deepEqual(bases[0], expected[lang].base, `${address}: the props of Base`);
    assert.deepEqual(contacts[0], expected[lang].page, `${address}: the props of ContactPage`);
    assert.equal(bases[0].path, `"${CONTACT_PAGE[lang]}"`, `${address}: the path of Base is the address of the page`);
    const importPath = /import \{ frontmatter \} from '([^']+)';/.exec(source)?.[1];
    assert.ok(importPath, `${address}: the frontmatter is imported`);
    assert.equal(join(dirname(join(root, PAGE_FILE[lang])), importPath), join(root, CONTENT_FILE[lang]), `${address}: the content file is the one of the language`);
    assert.match(source, /^const content = readContactContent\(frontmatter\);$/m, `${address}: the content is checked by the helper`);
    for (const owned of HREFS) assert.equal(source.includes(owned), false, `${PAGE_FILE[lang]} holds no hand-typed address of the owner`);
    assert.equal(source.includes(ADDRESS), false, `${PAGE_FILE[lang]} holds no hand-typed e-mail address`);
  }
  // The component takes the content only, and no address of the owner is typed outside src/lib/contact.ts.
  const component = read('src/components/marketing/ContactPage.astro');
  for (const address of [...HREFS, ADDRESS, 'github.com/furkansarikaya', 'linkedin.com', 'medium.com']) assert.equal(component.includes(address), false, `ContactPage.astro holds no hand-typed ${address}`);
  assert.deepEqual(Object.keys(OWNER), ['github', 'linkedin', 'medium', 'email'], 'the constants of the module');
  // Each prop is observed by rendering the page files from a fixture root, and by the build: the printed page changes with the prop.
  const alternatesOf = ($) => $('link[rel="alternate"][hreflang]').toArray().map((el) => ({ hreflang: $(el).attr('hreflang'), href: $(el).attr('href') }));
  for (const [lang, rel, address] of PAGES) {
    const run = pageRuns.good[lang];
    assert.equal(run.error, undefined, `${address}: the page renders: ${run.error?.message}`);
    const $ = load(run.value.html);
    const builtPage = page(lang);
    const content = frontmatterOf(lang);
    // path: the language of the page, the alternates and the menu entry follow it.
    assert.equal($('html').attr('lang'), lang, `${address}: the language of the page follows its path`);
    assert.deepEqual(alternatesOf($), alternatesOf(builtPage), `${address}: the alternates follow the path`);
    assert.equal(alternatesOf($).find((link) => link.hreflang === lang)?.href, `${ORIGIN}${address}`, `${address}: the alternate of its own language is its own address`);
    assert.deepEqual($('header nav a[aria-current="page"]').toArray().map((a) => a.attribs.href), [address], `${address}: the entry of the page is marked`);
    // title: the text of the title is the content title with the suffix.
    assert.equal($('title').text(), TITLE[lang], `${address}: the title`);
    // lead: the description starts with the lead of the content file.
    assert.equal($('meta[name="description"]').attr('content'), `${squash(content.lead)} ${PHRASE[lang]}.`, `${address}: the description is built from the lead of the content file`);
    assert.equal($('meta[name="description"]').attr('content'), builtPage('meta[name="description"]').attr('content'), `${address}: the description is the one of the build`);
    // content: the heading, the paragraph and the four rows come from the content file of the language.
    assert.equal($('h1').text(), content.title, `${address}: the heading comes from the content file of the language`);
    assert.equal(squash($('main p').text()), squash(content.paragraph), `${address}: the paragraph comes from the content file`);
    assert.deepEqual(linkProblems($, lang), [], `${address}: the four rows of the page file render as built`);
    assert.equal($('main').html(), builtPage('main').html(), `${address}: the page file renders the same main as the build`);
    // source: the stamp is read (the Turkish page warns when it is stale, the English page has none); covered in the stamp test with the same runs.
    assert.deepEqual(run.value.warnings, [], `${address}: a matching stamp prints no warning`);
    assert.equal(rel.includes('iletisim'), lang === 'tr');
  }
  assert.equal(pageRuns.stale.tr.value.warnings.length, 1, 'the source prop of the Turkish page is read: a stale English file warns');
  assert.equal(pageRuns.stale.en.value.warnings.length, 0, 'the English page passes no source');
  assert.ok(pageRuns.noEnglish.tr.error, 'the source prop of the Turkish page is read: a missing English file fails the page');
  // The element reader itself: an extra prop, a string prop and an expression with a brace and a quote inside are all read.
  assert.deepEqual(propsOf("<Base a=\"x y\" b={{ k: 'v}', n: 1 }} c={z}>\n</Base>", 'Base'), [{ a: '"x y"', b: "{{ k: 'v}', n: 1 }}", c: '{z}' }], 'the reader keeps every prop as written');
  assert.deepEqual(propsOf('<ContactPage content={content} />', 'Base'), [], 'another element is not read');
  assert.deepEqual(propsOf('<ContactPage content={content} lang="en" />', 'ContactPage'), [{ content: '{content}', lang: '"en"' }], 'an extra prop is read, so a prop that is added fails the comparison');
});

it('contact: the pages link one stylesheet and contact.css has no rule that reaches a command block', () => {
  // The import order of Base.astro: contact.css after get-started.css, so the build keeps one stylesheet.
  const layout = read('src/layouts/Base.astro');
  const getStartedAt = layout.search(/import\s+['"]\.\.\/styles\/get-started\.css['"]/);
  const contactAt = layout.search(/import\s+['"]\.\.\/styles\/contact\.css['"]/);
  assert.ok(getStartedAt >= 0, 'Base.astro imports get-started.css');
  assert.ok(contactAt > getStartedAt, 'Base.astro imports contact.css after get-started.css');
  assert.doesNotMatch(read('src/components/marketing/ContactPage.astro'), /import\s+['"][^'"]*\.css['"]/, 'ContactPage.astro imports no stylesheet, Base.astro bundles the one');
  const own = styleRules(read('src/styles/contact.css'));
  assert.ok(own.length >= 2, 'contact.css holds its rules');
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    const hrefs = $('link[rel~="stylesheet"]').toArray().map((el) => $(el).attr('href') ?? '');
    assert.equal(hrefs.length, 1, `${address}: one stylesheet is linked`);
    assert.match(hrefs[0], /^\/(?!\/)[^:]*\.css$/, `${address}: the stylesheet is a same-origin path`);
    const shippedCss = readFileSync(join(built.outDir, hrefs[0].replace(/^\//, '')), 'utf8');
    const shipped = styleRules(shippedCss);
    assert.deepEqual(paragraphWidthProblems(shippedCss), [], `${address}: the width of the paragraph in the linked stylesheet`);
    assert.deepEqual(builtContactAtRuleProblems(shippedCss), [], `${address}: no rule of this page sits inside an at-rule of the linked stylesheet`);
    const target = shipped.find((rule) => rule.selectors.some((selector) => /\.ct-link\b/.test(selector)) && rule.declarations.some((d) => d.property === 'min-height'));
    assert.ok(target, `${address}: the linked stylesheet holds the rule of the link target`);
    assert.equal(target.declarations.find((d) => d.property === 'min-height').value, '44px', `${address}: the target is 44px high`);
    // The link is a box with a size of its own: an inline link would give the min-height nothing to hold (inside the flex row the browser makes it a block, so only the rule shows it).
    const linkDisplays = shipped.filter((rule) => rule.selectors.some((selector) => /\.ct-link\b/.test(selector))).flatMap((rule) => rule.declarations.filter((d) => d.property === 'display').map((d) => d.value));
    assert.ok(linkDisplays.length > 0 && linkDisplays.every((value) => ['flex', 'inline-flex', 'block', 'inline-block'].includes(value)), `${address}: the display of the link target is ${JSON.stringify(linkDisplays)}, a box with a size`);
    assert.equal($('style').length + $('[style]').length, 0, `${address}: no inline style`);
  }
  // The elements a rule of contact.css must not reach: every command block, pre and code element of the other built pages, the inline code, and a probe block.
  const elementsOf = ($) => $('pre, code, .gs-call').toArray().flatMap((el) => [el, ...$(el).find('*').toArray()]);
  const probe = load('<pre class="gs-call" lang="en" translate="no"><code>one line</code></pre><p>text <code>inline</code></p>');
  const sources = [
    ...OTHER_PAGES.map((rel) => load(allHtml[rel] ?? '')),
    probe,
  ];
  assert.ok(sources.slice(0, -1).every(($) => $('.gs-call').length >= 1), 'the four built pages hold their command blocks');
  const reachedBy = (rules) => rules.filter((rule) => rule.declarations.length > 0).flatMap((rule) => rule.selectors
    .filter((selector) => sources.some(($) => reaches($, elementsOf($), selector, true)))
    .map((selector) => `${rule.context.join(' ') || 'no at-rule'}: ${selector}`));
  assert.deepEqual(reachedBy(own), [], 'no rule of contact.css reaches a pre, a code or a .gs-call element, at any width or in any at-rule');
  // No size above the reading column: width, min-width, inline-size and min-inline-size, in every unit.
  const sizeProblems = (rules) => rules.flatMap((rule) => rule.declarations
    .filter((d) => SIZE_PROPERTIES.includes(d.property) && sizeCanExceed(d.value))
    .map((d) => `${rule.context.join(' ') || 'no at-rule'}: ${rule.selectors.join(', ')} sets ${d.property}: ${d.value}`));
  assert.deepEqual(sizeProblems(own), [], 'no size of contact.css can exceed the reading column');
  // The rules themselves, on probe style sheets: each of these is found.
  const breaking = {
    'the class of the blocks': '.gs-call { margin: 0; }',
    'a pre element': 'pre { margin: 0; }',
    'a code element': 'code { margin: 0; }',
    'a descendant of a block': '.gs-call code { white-space: pre; }',
    'a list that holds a block selector': '.ct-link, pre.gs-call { color: red; }',
    'the universal selector': '* { margin: 0; }',
    ':is of a block selector': ':is(pre, .x) { margin: 0; }',
    'a pre in a media block': '@media (min-width: 1px) { pre { margin: 0; } }',
    'a code in a supports block': '@supports (display: grid) { code { margin: 0; } }',
    'a block class in a layer': '@layer x { .gs-call { margin: 0; } }',
    'a block class with a nested media block': '.gs-call { @media (min-width: 1px) { margin: 0; } }',
    'a code element nested in a pre rule': 'pre { code { margin: 0; } }',
    'a pre with !important': 'pre { margin: 0 !important; }',
    'a pre after a state': 'pre:hover { margin: 0; }',
  };
  for (const [what, css] of Object.entries(breaking)) assert.ok(reachedBy(styleRules(css)).length > 0, `${what} is found`);
  const wide = {
    'a width of the viewport': '.ct-row { width: 100vw; }',
    'a width of a container unit': '.ct-row { width: 50cqw; }',
    'a width of an inline container unit': '.ct-row { width: 100cqi; }',
    'a minimum width above the column': '.ct-link { min-width: 400px; }',
    'a minimum width in rem': '.ct-link { min-width: 30rem; }',
    'an inline size in ch': '.ct-link { inline-size: 80ch; }',
    'a minimum inline size of the viewport': '.ct-link { min-inline-size: 100vw; }',
    'a width in a media block': '@media (min-width: 1000px) { .ct-row { width: 900px; } }',
    'a width above the column by calc': '.ct-row { width: calc(100% + 1px); }',
    'a width from a custom property': '.ct-row { width: var(--w); }',
    'a width of max-content': '.ct-row { width: max-content; }',
    'a width with a container query unit in min': '.ct-row { width: min(100cqw, 2000px); }',
    'a width with !important': '.ct-row { width: 100vw !important; }',
  };
  for (const [what, css] of Object.entries(wide)) assert.ok(sizeProblems(styleRules(css)).length > 0, `${what} is found`);
  for (const css of ['.ct-link { min-width: 44px; min-height: 44px; }', '.ct-row { width: 100%; }', '.ct-link { min-width: 2.75rem; }', '.ct-row { width: auto; max-width: 100vw; }']) {
    assert.deepEqual(sizeProblems(styleRules(css)), [], `${css} is not a problem`);
  }
  // The width of the paragraph: each of these stylesheets is found, the one rule in em is not.
  assert.deepEqual(paragraphWidthProblems(`.gs-p.ct-p { max-width: ${PARAGRAPH_EM}em; margin: 0; }`), [], 'a max-width of 33em on the paragraph is the rule');
  const paragraphWidths = {
    'the width back to 75ch': '.gs-p.ct-p { max-width: 75ch; }',
    'the width in rem': `.gs-p.ct-p { max-width: ${PARAGRAPH_EM}rem; }`,
    'the width in px': `.gs-p.ct-p { max-width: ${PARAGRAPH_EM * 16}px; }`,
    'the width in ch': `.gs-p.ct-p { max-width: ${PARAGRAPH_EM}ch; }`,
    'another number of em': '.gs-p.ct-p { max-width: 40em; }',
    'a one-width media override': `.gs-p.ct-p { max-width: ${PARAGRAPH_EM}em; } @media (min-width: 1200px) { .gs-p.ct-p { max-width: 75ch; } }`,
    'a media override in em': `.gs-p.ct-p { max-width: ${PARAGRAPH_EM}em; } @media (min-width: 1200px) { .gs-p.ct-p { max-width: ${PARAGRAPH_EM}em; } }`,
    'an extra width': `.gs-p.ct-p { max-width: ${PARAGRAPH_EM}em; width: 100%; }`,
    'an important width': `.gs-p.ct-p { max-width: ${PARAGRAPH_EM}em !important; }`,
    'no rule for the paragraph': '.gs-p { max-width: 75ch; }',
    'a rule without a width': '.gs-p.ct-p { margin: 0; }',
  };
  for (const [what, css] of Object.entries(paragraphWidths)) assert.ok(paragraphWidthProblems(css).length > 0, `${what} is found`);
  for (const css of ['.ct-link { display: inline-flex; }', '.ct-row { border-top: 1px solid var(--rule); }', '.ct-name { color: var(--muted); }']) assert.deepEqual(reachedBy(styleRules(css)), [], `${css} reaches no block`);
  // No at-rule at all in contact.css: the layout test reads 67 widths, so a rule that holds only between two of them (391 to 399 px) or above 1440 px would pass it; with no media, container,
  // supports or other at-rule (and no import) the page has one layout at every width. The built stylesheet is read for the rules of this page only.
  assert.deepEqual(atRuleProblems(read('src/styles/contact.css')), [], 'contact.css holds no at-rule: no media, container or supports block, no layer, no import');
  const rows = '.ct-row { display: inline-flex; }';
  const atRules = {
    'a media rule with a min-width': `@media (min-width: 1px) { ${rows} }`,
    'a media rule with a max-width': `@media (max-width: 1px) { ${rows} }`,
    'a media rule for 391 to 399 px': `@media (min-width: 391px) and (max-width: 399px) { ${rows} }`,
    'a media rule for 391 to 399 px as a range': `@media (391px <= width <= 399px) { ${rows} }`,
    'a media rule above 1440 px': `@media (min-width: 1441px) { ${rows} }`,
    'a media rule on the height': `@media (min-height: 700px) { ${rows} }`,
    'a media rule on the aspect ratio': `@media (min-aspect-ratio: 16/9) { ${rows} }`,
    'a media rule on the orientation': `@media (orientation: landscape) { ${rows} }`,
    'a media rule of only a media type': `@media screen { ${rows} }`,
    'a container rule': `@container (min-width: 1px) { ${rows} }`,
    'a named container rule': `@container card (width > 300px) { ${rows} }`,
    'a supports rule': `@supports (display: grid) { ${rows} }`,
    'a media rule inside a supports rule': `@supports (display: grid) { @media (min-width: 391px) and (max-width: 399px) { ${rows} } }`,
    'a media rule inside a layer': `@layer x { @media (min-width: 391px) and (max-width: 399px) { ${rows} } }`,
    'a layer': `@layer x { ${rows} }`,
    'a media rule nested in a rule': '.ct-row { @media (min-width: 391px) and (max-width: 399px) { display: inline-flex; } }',
    'a media rule after a rule': `.ct-row { display: flex; }\n@media (min-width: 1px) { ${rows} }`,
    'an import': '@import url("other.css");',
    'an import with a media condition': '@import "other.css" (min-width: 391px);',
    'a media rule with a comment around it': `/* note */ @media (min-width: 1px) { ${rows} } /* note */`,
  };
  for (const [what, css] of Object.entries(atRules)) assert.ok(atRuleProblems(css).length > 0, `${what} is found in the source`);
  assert.deepEqual(atRuleProblems(`/* @media (min-width: 1px) { } */ .ct-row { display: flex; } .ct-link { min-width: 44px; }`), [], 'rules and a comment that names an at-rule are not a problem');
  // The built stylesheet: the rules of this page inside any at-rule are found, a rule of another page inside one is not, a rule of this page outside one is not.
  const builtAtRules = {
    'a media rule': `@media (min-width: 391px) and (max-width: 399px) { ${rows} }`,
    'a range media rule': `@media (391px <= width <= 399px) { ${rows} }`,
    'a media rule above 1440 px': `@media (min-width: 1441px) { ${rows} }`,
    'a media rule of only (min-width: 1px)': `@media (min-width: 1px) { ${rows} }`,
    'a container rule': `@container (min-width: 1px) { ${rows} }`,
    'a supports rule': `@supports (display: grid) { ${rows} }`,
    'a media rule inside a supports rule': `@supports (display: grid) { @media (min-width: 1px) { ${rows} } }`,
    'a media rule inside a layer': `@layer x { @media (min-width: 1px) { ${rows} } }`,
    'a media rule nested in a rule': '.ct-row { @media (min-width: 1px) { display: inline-flex; } }',
    'a media rule on the paragraph': '@media (min-width: 1px) { .gs-p.ct-p { max-width: 33em; } }',
  };
  for (const [what, css] of Object.entries(builtAtRules)) assert.ok(builtContactAtRuleProblems(css).length > 0, `${what} is found in the built stylesheet`);
  for (const css of [`${rows} .ct-link { display: inline-flex; }`, '@media (min-width: 1px) { .gs-h1 { margin: 0; } } .ct-row { display: flex; }', '@keyframes k { from { opacity: 0; } } .ct-row { display: flex; }']) {
    assert.deepEqual(builtContactAtRuleProblems(css), [], `${css} is not a problem`);
  }
});

it('contact: contact.css holds exactly the table of rules and declarations, in the source and in the built stylesheet', () => {
  assert.equal(CONTACT_CSS.length, 6, 'the table holds six rules');
  assert.equal(CONTACT_CSS.reduce((n, rule) => n + rule.declarations.length, 0), CONTACT_CSS_DECLARATIONS, 'the table holds 19 declarations');
  assert.ok(CONTACT_CSS.every((rule) => rule.selectors.length === 1 && rule.declarations.length > 0), 'every rule of the table has one selector and a declaration');
  const source = read('src/styles/contact.css');
  assert.equal(styleRules(source).length, CONTACT_CSS.length, 'the source holds six style rules');
  assert.deepEqual(contactCssProblems(source), [], 'src/styles/contact.css is the table, rule by rule and declaration by declaration');
  const shipped = [];
  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    const hrefs = $('link[rel~="stylesheet"]').toArray().map((link) => $(link).attr('href') ?? '');
    assert.equal(hrefs.length, 1, `${address}: one stylesheet is linked`);
    const css = readFileSync(join(built.outDir, hrefs[0].replace(/^\//, '')), 'utf8');
    assert.equal(styleRules(css).filter((rule) => rule.selectors.some((selector) => /\.ct-/.test(selector))).length, CONTACT_CSS.length, `${address}: the linked stylesheet holds six .ct- rules`);
    assert.deepEqual(builtContactCssProblems(css), [], `${address}: the .ct- rules of the linked stylesheet are the table`);
    shipped.push(css);
  }

  // The rule itself, on in-memory copies of the source text: every change form is found, and a change of nothing but comments or layout is not.
  const blockOf = (css, selector) => {
    const start = css.indexOf(`\n${selector} {`);
    assert.ok(start >= 0, `${selector} is in the stylesheet`);
    return [start + 1, css.indexOf('\n}', start) + 2];
  };
  const inBlock = (css, selector, change) => {
    const [from, to] = blockOf(css, selector);
    return css.slice(0, from) + change(css.slice(from, to)) + css.slice(to);
  };
  const addAtEnd = (css, selector, declaration) => inBlock(css, selector, (block) => block.replace(/\n\}$/, `\n  ${declaration};\n}`));
  const addAtStart = (css, selector, declaration) => inBlock(css, selector, (block) => block.replace('{\n', `{\n  ${declaration};\n`));
  const replaceIn = (css, selector, from, to) => inBlock(css, selector, (block) => {
    assert.ok(block.includes(from), `${selector} holds ${from}`);
    return block.replace(from, to);
  });
  const UNREAD = ['opacity: 0.5', 'opacity: 0.99', 'background: var(--accent)', 'background: #fff', 'text-transform: uppercase', 'filter: blur(1px)', 'outline: none', 'outline-offset: 0', 'font-style: italic',
    'text-underline-offset: 6px', 'pointer-events: none', 'user-select: none', 'contain: paint', 'hyphens: auto', 'color: red', 'cursor: pointer', 'transition: color 1s', 'text-decoration: none',
    'box-shadow: 0 0 0 1px red', 'border-radius: 4px', '--x: 1', 'visibility: hidden', 'position: relative', 'transform: scale(1.01)', 'clip-path: inset(0)', 'content: "x"'];
  const probes = [];
  const probe = (what, css, names = []) => {
    assert.notEqual(css, source, `${what}: the probe changes the stylesheet`);
    probes.push({ what, css, names });
  };
  for (const rule of CONTACT_CSS) {
    const selector = rule.selectors[0];
    for (const declaration of UNREAD) {
      probe(`${declaration} added at the end of ${selector}`, addAtEnd(source, selector, declaration), [selector, declaration]);
      probe(`${declaration} added at the start of ${selector}`, addAtStart(source, selector, declaration), [selector, declaration]);
    }
    for (const declaration of rule.declarations) {
      const property = declaration.slice(0, declaration.indexOf(':'));
      const value = declaration.slice(declaration.indexOf(':') + 2);
      probe(`${declaration} removed from ${selector}`, replaceIn(source, selector, `  ${declaration};\n`, ''), [selector, declaration]);
      probe(`${declaration} made !important in ${selector}`, replaceIn(source, selector, `${declaration};`, `${declaration} !important;`), [selector, declaration]);
      probe(`${declaration} changed to inherit in ${selector}`, replaceIn(source, selector, `${declaration};`, `${property}: inherit;`), [selector, declaration, 'inherit']);
      probe(`${declaration} changed to a value of another kind in ${selector}`, replaceIn(source, selector, `${declaration};`, `${property}: 1337zz;`), [selector, declaration]);
      probe(`${declaration} given a second time in ${selector}`, replaceIn(source, selector, `${declaration};`, `${declaration};\n  ${declaration};`), [selector, declaration]);
      if (/\d/.test(value)) probe(`${declaration} with its first number one more in ${selector}`, replaceIn(source, selector, `${declaration};`, `${property}: ${value.replace(/\d+/, (n) => String(Number(n) + 1))};`), [selector, declaration]);
      if (value.toUpperCase() !== value) probe(`${declaration} written in capitals in ${selector}`, replaceIn(source, selector, `${declaration};`, `${property}: ${value.toUpperCase()};`));
      probe(`${property} written in capitals in ${selector}`, replaceIn(source, selector, `  ${declaration};`, `  ${property.toUpperCase()}: ${value};`));
    }
    probe(`${selector} given a second time with the declarations of the table`, `${source}\n${selector} { ${rule.declarations.join('; ')}; }\n`, [selector]);
    probe(`${selector} emptied`, replaceIn(source, selector, rule.declarations.map((d) => `  ${d};\n`).join(''), ''), [selector]);
    probe(`${selector} renamed`, source.replace(`\n${selector} {`, `\n${selector}x {`), [selector]);
    probe(`${selector} followed by a descendant selector`, source.replace(`\n${selector} {`, `\n${selector} span {`), [selector]);
  }
  const extraRules = {
    'a hover rule on the link': '.ct-link:hover { opacity: 0.5; }',
    'a hover rule on the link that removes the underline': '.ct-link:hover { text-decoration: none; }',
    'a hover rule on the row': '.ct-row:hover { background: var(--accent); }',
    'a hover rule on the label': '.ct-label:hover { color: red; }',
    'a focus rule on the link': '.ct-link:focus { outline: none; }',
    'a focus-visible rule on the link': '.ct-link:focus-visible { outline: none; }',
    'a focus-visible rule on the row': '.ct-row:focus-visible { outline: 2px solid red; }',
    'an active rule on the link': '.ct-link:active { opacity: 0.5; }',
    'a visited rule on the link': '.ct-link:visited { color: red; }',
    'a focus-within rule on the row': '.ct-row:focus-within { background: red; }',
    'a first-child rule on the row': '.ct-row:first-child { border-top: 0; }',
    'a ::before rule on the row with content': '.ct-row::before { content: "x"; position: absolute; }',
    'a ::after rule on the row with content': '.ct-row::after { content: "x"; }',
    'a ::before rule on the link with content': '.ct-link::before { content: "x"; }',
    'a ::after rule on the link with content': '.ct-link::after { content: ""; position: absolute; inset: 0; }',
    'a ::before rule on the label with content': '.ct-label::before { content: "x"; }',
    'a ::after rule on the label with content': '.ct-label::after { content: "x"; }',
    'a :before rule with the old colon': '.ct-link:before { content: "x"; }',
    'a ::marker rule on the row': '.ct-row::marker { content: "x"; }',
    'a ::first-line rule on the paragraph': '.gs-p.ct-p::first-line { text-transform: uppercase; }',
    'a ::selection rule': '.ct-link::selection { background: red; }',
    'a rule on a new class': '.ct-new { color: red; }',
    'a rule on an unused selector': '.ct-unused { color: red; }',
    'a second rule on the link': '.ct-link { color: red; }',
    'a second rule on the row': '.ct-row { opacity: 0.5; }',
    'a rule on the column': '.gs-col { opacity: 0.5; }',
    'a rule on the heading': '.gs-h1 { margin: 0; }',
    'a rule on the list items': '.ct-links li { padding: 4px; }',
    'a rule on every link of main': 'main a { color: red; }',
    'a rule on the universal selector': '* { margin: 0; }',
    'a rule on the root': ':root { --rule: red; }',
    'a rule with a selector list': '.ct-link, .ct-label { color: red; }',
    'a rule that holds nothing': '.ct-row { }',
    'a nested hover rule': '.ct-link { &:hover { color: red; } }',
    'a nested pseudo-element rule': '.ct-link { &::before { content: "x"; } }',
    'a media block': '@media (min-width: 1px) { .ct-row { display: block; } }',
    'a media block for a width between two measured ones': '@media (min-width: 391px) and (max-width: 399px) { .ct-row { display: block; } }',
    'a media block on the colour scheme': '@media (prefers-color-scheme: dark) { .ct-link { opacity: 0.5; } }',
    'a media block on the motion': '@media (prefers-reduced-motion: reduce) { .ct-link { transition: none; } }',
    'a supports block': '@supports (display: grid) { .ct-row { display: grid; } }',
    'a layer': '@layer x { .ct-row { display: block; } }',
    'a container block': '@container (min-width: 1px) { .ct-row { display: block; } }',
    'an import': '@import url("other.css");',
    'a keyframes block': '@keyframes k { from { opacity: 0; } to { opacity: 1; } }',
    'a font face': '@font-face { font-family: x; src: url(a.woff2); }',
    'a property block': '@property --x { syntax: "*"; inherits: false; }',
    'a page block': '@page { margin: 0; }',
    'a stray declaration outside every rule': 'color: red;',
    'a stray word': 'garbage',
  };
  for (const [what, rule] of Object.entries(extraRules)) {
    probe(`${what} after the rules`, `${source}\n${rule}\n`);
    probe(`${what} before the rules`, `${rule}\n${source}`);
  }
  const [linkFrom, linkTo] = blockOf(source, '.ct-link');
  probe('the link rule given a second time', `${source}\n${source.slice(linkFrom, linkTo)}`, ['.ct-link']);
  probe('a declaration moved to another rule', addAtEnd(replaceIn(source, '.ct-link', '  min-height: 44px;\n', ''), '.ct-label', 'min-height: 44px'), ['min-height: 44px']);
  probe('a declaration moved to the row from the link', addAtEnd(replaceIn(source, '.ct-row', '  min-height: 44px;\n', ''), '.ct-link', 'min-height: 44px'), ['min-height: 44px']);
  probe('two declarations swapped', replaceIn(source, '.ct-row', '  gap: 0 12px;\n  min-height: 44px;\n', '  min-height: 44px;\n  gap: 0 12px;\n'), ['.ct-row']);
  probe('two declarations swapped in the first rule', replaceIn(source, '.gs-p.ct-p', '  max-width: 33em;\n  text-wrap: balance;\n', '  text-wrap: balance;\n  max-width: 33em;\n'), ['.gs-p.ct-p']);
  const swapped = (first, second) => {
    const [a0, a1] = blockOf(source, first);
    const [b0, b1] = blockOf(source, second);
    assert.ok(a1 <= b0, `${first} comes before ${second}`);
    return `${source.slice(0, a0)}${source.slice(b0, b1)}${source.slice(a1, b0)}${source.slice(a0, a1)}${source.slice(b1)}`;
  };
  probe('two rules swapped', swapped('.ct-links', '.ct-row'), ['another order']);
  probe('the first and the last rule swapped', swapped('.gs-p.ct-p', '.ct-link'), ['another order']);
  probe('a rule removed', source.replace(/\n\.ct-label \{[\s\S]*?\n\}\n/, '\n'), ['.ct-label']);
  probe('the stylesheet emptied', '', ['missing']);
  probe('the stylesheet reduced to a comment', '/* nothing */', ['missing']);
  for (const { what, css, names } of probes) {
    const problems = contactCssProblems(css);
    assert.ok(problems.length > 0, `the source with ${what} is found`);
    for (const name of names) assert.ok(problems.some((line) => line.includes(name)), `the source with ${what}: a problem names "${name}" (${problems.join(' | ')})`);
  }
  assert.ok(probes.length >= 500, `${probes.length} probes of the source ran`);
  // A change of nothing but comments, white space or line ends is not a change of the stylesheet.
  const harmless = {
    'a comment added': `${source}\n/* a note */\n`,
    'a comment inside a rule': source.replace('{\n  max-width', '{\n  /* the width */\n  max-width'),
    'every comment removed': source.replace(/\/\*[\s\S]*?\*\//g, ''),
    'the comments rewritten': source.replace(/\/\*[\s\S]*?\*\//g, '/* other words */'),
    'four spaces of indentation': source.replace(/^ {2}(?=\S)/gm, '    '),
    'tabs of indentation': source.replace(/^ {2}(?=\S)/gm, '\t'),
    'blank lines between the declarations': source.replace(/;\n/g, ';\n\n'),
    'Windows line ends': source.replace(/\n/g, '\r\n'),
    'a rule on one line': replaceIn(source, '.ct-label', '{\n  flex: none;\n  white-space: nowrap;\n}', '{ flex: none; white-space: nowrap; }'),
  };
  for (const [what, css] of Object.entries(harmless)) {
    assert.notEqual(css, source, `${what} changes the text`);
    assert.deepEqual(contactCssProblems(css), [], `the source with ${what} is the table`);
  }

  // The same rule on copies of the built stylesheet (minified, the declarations of a rule in the order of the minifier).
  const builtBlock = (css, selector) => {
    const start = css.indexOf(`${selector}{`);
    assert.ok(start >= 0, `${selector} is in the built stylesheet`);
    return [start + selector.length + 1, css.indexOf('}', start)];
  };
  const builtIn = (css, selector, change) => {
    const [from, to] = builtBlock(css, selector);
    return css.slice(0, from) + change(css.slice(from, to)) + css.slice(to);
  };
  const minified = (declaration) => declaration.replace(': ', ':');
  const builtProbes = [];
  const builtProbe = (what, css, names = []) => {
    assert.notEqual(css, shipped[0], `${what}: the probe changes the built stylesheet`);
    builtProbes.push({ what, css, names });
  };
  for (const rule of CONTACT_CSS) {
    const selector = rule.selectors[0];
    for (const declaration of UNREAD) builtProbe(`${declaration} added to ${selector}`, builtIn(shipped[0], selector, (body) => `${minified(declaration)};${body}`), [selector, declaration]);
    for (const declaration of rule.declarations) {
      const property = declaration.slice(0, declaration.indexOf(':'));
      builtProbe(`${declaration} removed from ${selector}`, builtIn(shipped[0], selector, (body) => {
        const parts = body.split(';');
        assert.ok(parts.includes(minified(declaration)), `${selector} holds ${minified(declaration)} in the built stylesheet (${body})`);
        return parts.filter((part) => part !== minified(declaration)).join(';');
      }), [selector, declaration]);
      builtProbe(`${declaration} changed to inherit in ${selector}`, builtIn(shipped[0], selector, (body) => body.split(';').map((part) => (part === minified(declaration) ? `${property}:inherit` : part)).join(';')), [selector, declaration]);
    }
  }
  const NOT_BUILT = /^(a stray|a rule on the (column|heading|root)|a rule on every|a rule on the universal|an import|a keyframes|a font face|a property|a page)/;
  for (const [what, rule] of Object.entries(extraRules)) {
    if (NOT_BUILT.test(what)) continue;
    builtProbe(`${what} after the rules`, `${shipped[0]}${rule.replace(/: /g, ':').replace(/; /g, ';').replace(/ \{ /g, '{').replace(/ \}/g, '}')}`);
  }
  builtProbe('a hover rule on the link, minified', `${shipped[0]}.ct-link:hover{opacity:.5}`, ['.ct-link:hover']);
  builtProbe('a ::before rule on the row, minified', `${shipped[0]}.ct-row:before{content:"x"}`, ['.ct-row:before']);
  builtProbe('the link rule given a second time', `${shipped[0]}.ct-link{color:red}`, ['.ct-link']);
  builtProbe('a rule inside a media block', `${shipped[0]}@media (min-width:1px){.ct-row{display:block}}`, ['.ct-row']);
  builtProbe('a rule inside a layer', `${shipped[0]}@layer x{.ct-link{opacity:.5}}`, ['.ct-link']);
  builtProbe('a rule of the stylesheet removed', shipped[0].replace(/\.ct-label\{[^}]*\}/, ''), ['.ct-label']);
  builtProbe('two rules swapped', (() => {
    const a = /\.ct-links\{[^}]*\}/.exec(shipped[0])[0];
    const b = /\.ct-row\{[^}]*\}/.exec(shipped[0])[0];
    return shipped[0].replace(a, '@@A@@').replace(b, a).replace('@@A@@', b);
  })(), ['another order']);
  for (const { what, css, names } of builtProbes) {
    const problems = builtContactCssProblems(css);
    assert.ok(problems.length > 0, `the built stylesheet with ${what} is found`);
    for (const name of names) assert.ok(problems.some((line) => line.includes(name)), `the built stylesheet with ${what}: a problem names "${name}" (${problems.join(' | ')})`);
  }
  assert.ok(builtProbes.length >= 200, `${builtProbes.length} probes of the built stylesheet ran`);
  // A rule of another page in the built stylesheet is not read as a rule of this one.
  assert.deepEqual(builtContactCssProblems(`${shipped[0]}.gs-h1{margin:0}`), [], 'a rule of another page is not a rule of this page');
});

it('contact: main of both pages and the component hold exactly the element tree, with every attribute, the order and the text', () => {
  const FORMS = ['an attribute added', 'an attribute removed', 'an attribute changed', 'an attribute in capitals', 'an attribute emptied', 'a changed tag', 'a changed tag to a span', 'an extra wrapper',
    'an extra wrapper with a class', 'an empty element inside it', 'an empty element first inside it', 'an empty element before it', 'an empty element after it', 'the element removed',
    'the element duplicated', 'the element moved to the end of its parent', 'the element swapped with the next sibling', 'the element replaced by its children', 'a text added inside it',
    'a word added inside it', 'a comment added inside it', 'a text changed', 'a text emptied', 'a text removed', 'a text split in two', 'a text in capitals'];
  const EXTRA = [['aria-hidden', 'true'], ['aria-label', 'x'], ['aria-current', 'page'], ['aria-live', 'polite'], ['tabindex', '0'], ['tabindex', '-1'], ['role', 'presentation'], ['role', 'list'], ['id', 'x'],
    ['class', 'extra'], ['data-x', '1'], ['title', 'x'], ['style', 'opacity:0.5'], ['lang', 'en'], ['lang', 'tr'], ['translate', 'no'], ['hidden', ''], ['inert', ''], ['dir', 'rtl'], ['rel', 'noopener'],
    ['target', '_blank'], ['download', ''], ['ping', '/p'], ['onclick', 'x'], ['contenteditable', 'true'], ['draggable', 'true'], ['accesskey', 'x']];
  const TAGS = { ul: 'div', li: 'div', p: 'div', h1: 'h2', span: 'b', a: 'button', div: 'section', main: 'div' };
  const kinds = {};
  /** Every change form on every element of a parsed tree: each changes the tree and each is found, with a line that names the element (and the attribute). Returns the tags the attribute probes reached. */
  const probeTree = (what, actual, expected) => {
    const tags = new Set();
    const count = elementsOfTree(actual).length;
    assert.ok(count >= ELEMENTS_IN_COLUMN, `${what}: the tree holds ${count} elements`);
    const run = (form, k, change, detail = '') => {
      const clone = structuredClone(actual);
      const target = elementsOfTree(clone)[k];
      const replaced = change(target, clone);
      const changedTree = replaced === undefined ? clone : replaced;
      kinds[form] = (kinds[form] ?? 0) + 1;
      assert.equal(isDeepStrictEqual(changedTree, expected), false, `${what}: ${form} ${detail} of element ${k} changes the tree`);
      const problems = treeProblems(changedTree, expected, expected.tag);
      assert.ok(problems.length > 0, `${what}: ${form} ${detail} of <${target.node.tag}> (element ${k}) is found`);
      return problems;
    };
    elementsOfTree(actual).forEach(({ node, parent, index }, k) => {
      for (const [name, value] of EXTRA) {
        const problems = run('an attribute added', k, (t) => { t.node.attrs[name] = name === 'class' && t.node.attrs.class ? `${t.node.attrs.class} ${value}` : value; }, name);
        assert.ok(problems.some((line) => line.includes(node.tag) && line.includes(`attribute ${name}`)), `${what}: the problem of ${name} on <${node.tag}> names the element and the attribute (${problems.join(' | ')})`);
        tags.add(node.tag);
      }
      for (const name of Object.keys(node.attrs)) {
        run('an attribute removed', k, (t) => { delete t.node.attrs[name]; }, name);
        run('an attribute changed', k, (t) => { t.node.attrs[name] = `${t.node.attrs[name]}x`; }, name);
        if (node.attrs[name].toUpperCase() !== node.attrs[name]) run('an attribute in capitals', k, (t) => { t.node.attrs[name] = t.node.attrs[name].toUpperCase(); }, name);
        run('an attribute emptied', k, (t) => { t.node.attrs[name] = ''; }, name);
      }
      run('a changed tag', k, (t) => { t.node.tag = TAGS[node.tag]; });
      if (node.tag !== 'span') run('a changed tag to a span', k, (t) => { t.node.tag = 'span'; });
      run('an extra wrapper', k, (t, root) => {
        const wrapper = el('div', {}, [t.node]);
        if (t.parent === null) return wrapper;
        t.parent.children[t.index] = wrapper;
        return root;
      });
      run('an extra wrapper with a class', k, (t, root) => {
        const wrapper = el('span', { class: 'wrapper' }, [t.node]);
        if (t.parent === null) return wrapper;
        t.parent.children[t.index] = wrapper;
        return root;
      });
      run('an empty element inside it', k, (t) => { t.node.children.push(el('div')); });
      run('an empty element first inside it', k, (t) => { t.node.children.unshift(el('span')); });
      if (parent !== null) {
        run('an empty element before it', k, (t) => { t.parent.children.splice(t.index, 0, el('div')); });
        run('an empty element after it', k, (t) => { t.parent.children.splice(t.index + 1, 0, el('div')); });
        run('the element removed', k, (t) => { t.parent.children.splice(t.index, 1); });
        run('the element duplicated', k, (t) => { t.parent.children.splice(t.index, 0, structuredClone(t.node)); });
        run('the element replaced by its children', k, (t) => { t.parent.children.splice(t.index, 1, ...t.node.children); });
        if (index + 1 < parent.children.length) {
          run('the element moved to the end of its parent', k, (t) => { t.parent.children.push(...t.parent.children.splice(t.index, 1)); });
          run('the element swapped with the next sibling', k, (t) => { const next = t.parent.children[t.index + 1]; t.parent.children[t.index + 1] = t.node; t.parent.children[t.index] = next; });
        }
      }
      run('a text added inside it', k, (t) => { t.node.children.push(' '); });
      run('a word added inside it', k, (t) => { t.node.children.unshift('x'); });
      run('a comment added inside it', k, (t) => { t.node.children.push({ comment: ' x ' }); });
      node.children.forEach((child, i) => {
        if (typeof child !== 'string') return;
        run('a text changed', k, (t) => { t.node.children[i] = `${child}x`; });
        run('a text emptied', k, (t) => { t.node.children[i] = ''; });
        run('a text removed', k, (t) => { t.node.children.splice(i, 1); });
        run('a text split in two', k, (t) => { t.node.children.splice(i, 1, child.slice(0, 1), child.slice(1)); });
        run('a text in capitals', k, (t) => { t.node.children[i] = child === child.toUpperCase() ? `${child}.` : child.toUpperCase(); });
      });
    });
    return tags;
  };

  for (const [lang, , address] of PAGES) {
    const $ = page(lang);
    assert.equal($('main').length, 1, `${address}: one main`);
    const content = frontmatterOf(lang);
    const expected = mainTree(columnTree({ title: H1[lang], paragraph: squash(content.paragraph), texts: TEXTS[lang] }));
    const actual = treeOf($('main')[0]);
    assert.equal(elementsOfTree(expected).length, ELEMENTS_IN_COLUMN + 1, `${address}: the expected tree holds main and ${ELEMENTS_IN_COLUMN} elements`);
    assert.equal(elementsOfTree(actual).length, ELEMENTS_IN_COLUMN + 1, `${address}: main holds ${ELEMENTS_IN_COLUMN} elements`);
    assert.deepEqual(treeProblems(actual, expected), [], `${address}: main is the element tree`);
    assert.deepEqual(actual, expected, `${address}: main is the element tree, node for node`);
    const tags = probeTree(`${address} main`, actual, expected);
    assert.deepEqual([...tags].sort(), ['a', 'div', 'h1', 'li', 'main', 'p', 'span', 'ul'], `${address}: an attribute was added to every kind of element`);
  }

  // The component rendered with explicit props: its own tree is the column of the props, and the text comes out as text.
  for (const [name, props] of Object.entries(PROP_SETS)) {
    const run = componentRuns[name];
    assert.equal(run?.error, undefined, `${name}: the component renders: ${run?.error?.message}`);
    const nodes = load(run.html, null, false).root()[0].children.map(treeOf);
    const expected = columnTree({ title: props.title, paragraph: props.paragraph, texts: [props.links.github, props.links.linkedin, props.links.medium, props.links.email] });
    assert.equal(nodes.length, 1, `${name}: the component renders one element and no other node (${JSON.stringify(nodes.slice(1))})`);
    assert.deepEqual(treeProblems(nodes[0], expected, 'div'), [], `${name}: the component is the element tree`);
    assert.deepEqual(nodes[0], expected, `${name}: the component is the element tree, node for node`);
    assert.equal(elementsOfTree(nodes[0]).length, ELEMENTS_IN_COLUMN, `${name}: the component holds ${ELEMENTS_IN_COLUMN} elements`);
    if (name === 'plain') {
      const tags = probeTree('the component', nodes[0], expected);
      assert.deepEqual([...tags].sort(), ['a', 'div', 'h1', 'li', 'p', 'span', 'ul'], 'an attribute was added to every kind of element of the component');
    }
  }
  // The page files render the same main as the build.
  for (const [lang, , address] of PAGES) {
    const run = pageRuns.good[lang];
    assert.equal(run.error, undefined, `${address}: the page file renders`);
    assert.deepEqual(treeOf(load(run.value.html)('main')[0]), treeOf(page(lang)('main')[0]), `${address}: the page file renders the main of the build`);
  }
  assert.deepEqual(Object.keys(kinds).sort(), [...FORMS].sort(), 'every form of change ran');
});

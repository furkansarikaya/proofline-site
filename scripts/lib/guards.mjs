// C21 guards (TASK-020): the install-time and README command guards over the pages of a built site. Pure: it reads the
// `{ address, html }` pages and the PROBES text it is given, and the pin facts through `loadFacts`, called at most once and
// only when a get-started page exists. No file system, clock, environment or network; it imports only cheerio.
//   - Every page outside /docs/ and /tr/docs/, and the three docs indexes, is written for the site; the rest is synced.
//   - On the get-started pages every `pre` line must be a README command of the Install range, and every element marked
//     `data-command` outside a `pre` must be a README inline span of that range.
//   - While the PB-3 item of PROBES.md has no `confirmed` result, no site-written page may match the AC-4 patterns.
import { load } from 'cheerio';

export const DOCS_INDEXES = ['/docs/', '/tr/docs/', '/docs/skills/'];
export const GET_STARTED_PAGES = ['/get-started/', '/tr/baslarken/'];
// The two patterns of the PRD AC-4 exactly as TASK.md writes them: flag `i` only, no word boundary (ARCHITECTURE "Trade-offs").
export const INSTALL_TIME_PATTERNS = [/(?<![\w-])(five|5)[ -]?(minutes?|mins?)/i, /(?<![\w-])(beş|5)[ -]?(dakika|dk)/i];

const RANGE = 'README.md between "## Install" and "## What it supports"';
const LINES = /\r\n|\r|\n/;
const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/** Whether a page address is a synced document: under /docs/ or /tr/docs/ and not one of the generated indexes. */
export function isSyncedPage(address) {
  return (address.startsWith('/docs/') || address.startsWith('/tr/docs/')) && !DOCS_INDEXES.includes(address);
}

/** The comparable form of a command line, on both sides: trimmed, a trailing comment after white space removed (pin-facts.mjs). */
export function normaliseCommand(line) {
  return line.trim().replace(/\s#.*$/, '').trim();
}

/** The state of the PB-3 item of a PROBES.md text; `confirmed` only for one item with one result line whose value is exactly `confirmed`. */
export function pb3State(text) {
  const lines = text.replace(/^\uFEFF/, '').split(LINES);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^- PB-3(?=[ \t]|$)/.test(lines[i])) continue;
    const results = [];
    for (let j = i + 1; j < lines.length && /^[ \t]/.test(lines[j]) && lines[j].trim() !== ''; j++) {
      const result = /^[ \t]+result:(.*)$/.exec(lines[j]);
      if (result !== null) results.push(result[1].replace(/^[ \t]+|[ \t]+$/g, ''));
    }
    items.push(results);
  }
  if (items.length === 0) return { confirmed: false, state: 'no item' };
  if (items.length > 1) return { confirmed: false, state: `${items.length} items, not confirmed` };
  const [results] = items;
  if (results.length === 0) return { confirmed: false, state: 'no result' };
  if (results.length > 1) return { confirmed: false, state: `${results.length} result lines, not confirmed` };
  const [value] = results;
  if (value === 'confirmed') return { confirmed: true, state: 'confirmed' };
  if (value === 'failed' || value === 'inconclusive') return { confirmed: false, state: value };
  return { confirmed: false, state: `result "${value}" is not confirmed` };
}

/** The text nodes under a node in document order, without the content of `script` and `style` and without comments. */
function textNodes(node, out = []) {
  for (const child of node.children ?? []) {
    if (child.type === 'text') out.push(child.data);
    else if (child.type === 'tag') textNodes(child, out);
  }
  return out;
}

/**
 * The texts the install-time patterns read: the title, the meta description and the body text. The body is read twice:
 * its text nodes concatenated without a separator (so `<b>five</b>-minute` is one word) and joined with a space (so two
 * blocks such as `<p>in</p><p>5 mins</p>` stay two words); each form also in its Turkish lower case, which folds the dotted
 * capital I that a case-insensitive match does not. Every added form can only add a match.
 */
function scannedTexts($) {
  const body = textNodes($('body').get(0) ?? { children: [] });
  const units = [$('head title').first().text(), $('meta[name="description"]').attr('content') ?? '', body.join(''), body.join(' ')];
  return units.map(collapse).flatMap((unit) => [unit, unit.toLocaleLowerCase('tr')]);
}

/** The failure lines of a get-started page: block lines first, then marked spans. */
function commandFailures($, address, facts) {
  const failures = [];
  const commands = new Set(facts.readme_commands.map(normaliseCommand));
  for (const el of $('pre').toArray()) {
    for (const raw of $(el).text().split(LINES)) {
      const line = raw.trim();
      if (line === '' || line.startsWith('#')) continue;
      if (!commands.has(normaliseCommand(line))) failures.push(`${address}: command line not in ${RANGE}: ${line}`);
    }
  }
  const spans = new Set(facts.readme_inline_spans.map(collapse));
  for (const el of $('[data-command]').toArray()) {
    if ($(el).closest('pre').length > 0) continue; // a marked element inside a block belongs to the block lines
    const span = collapse($(el).text());
    if (!spans.has(span)) failures.push(`${address}: data-command span not in ${RANGE}: ${span}`);
  }
  return failures;
}

/** The failure lines of a site-written page while PB-3 is not confirmed: one per pattern, with its first match. */
function installTimeFailures($, address, state) {
  const texts = scannedTexts($);
  const failures = [];
  for (const pattern of INSTALL_TIME_PATTERNS) {
    for (const text of texts) {
      const match = pattern.exec(text);
      if (match === null) continue;
      failures.push(`${address}: install-time text "${match[0]}" matches ${pattern.source} (case-insensitive) while PB-3 is not confirmed (${state})`);
      break;
    }
  }
  return failures;
}

/**
 * Run the guards over the pages, in the order given. `lines` is the whole output (the PB-3 state, the failures, the
 * summary); `failures` the failure lines alone. An error of `loadFacts` is thrown to the caller unchanged.
 */
export function checkGuards({ pages, probesText, loadFacts }) {
  const pb3 = pb3State(probesText);
  let facts;
  const failures = [];
  let written = 0;
  let started = 0;
  for (const { address, html } of pages) {
    if (isSyncedPage(address)) continue;
    written++;
    const $ = load(html);
    if (GET_STARTED_PAGES.includes(address)) {
      started++;
      if (facts === undefined) facts = loadFacts();
      failures.push(...commandFailures($, address, facts));
    }
    if (!pb3.confirmed) failures.push(...installTimeFailures($, address, pb3.state));
  }
  const summary = `guards: ${pages.length} pages, ${written} site-written, ${started} get-started, ${failures.length} failures`;
  return { lines: [`PB-3: ${pb3.state}`, ...failures, summary], failures };
}

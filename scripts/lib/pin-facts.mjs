// C17 (TASK-010): the facts the site pages state about proofline, read from the pinned documents of the cache
// (ADR 0003 point 7). Nothing is typed in this module except the patterns that find the facts: every returned sentence,
// figure, id and command is a slice of the pinned text, and a fact that is not found throws an error that starts with the
// page and holds the pattern text, so the build fails. No default, no warning, no clock, no environment, no network.
//   node scripts/lib/pin-facts.mjs <pin file> <cache root>     prints the facts as JSON (exit 1: a fact is missing, 2: usage)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePin } from './lock.mjs';

const README = 'README.md';
const PROOF = 'docs/proof.md';
const WORKFLOW = 'docs/concepts/workflow.md';

const FIGURES = /Figures\s+were\s+taken\s+on\s+(\d{4}-\d{2}-\d{2})\s+at\s+proofline\s+(\d+\.\d+\.\d+)/;
const NOT_PROVEN = 'It is not yet proven on real projects.';
const CODEX = /Codex as implementer is supported \([^)]*\); other Codex roles are not yet verified in real use\./;
const DOES_NOT_PROVE = 'What this does not prove';
const LABEL = /^\*\*[^*\n]+:\*\*/;
const LIST_ITEM = /^ {0,3}[-*+] +/;

const fail = (page, message) => { throw new Error(`${page}: ${message}`); };
const collapse = (text) => text.replace(/\s+/g, ' ').trim();
const isBlank = (line) => line.trim() === '';

/** The page's lines (any line ending), and for each line what it is: a fence line, a line inside a fence, or text with its ATX heading. */
function model(page, text) {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const infos = [];
  let fence = null;
  for (const line of lines) {
    if (fence !== null) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close !== null && close[1][0] === fence.char && close[1].length >= fence.length) { infos.push({ kind: 'close' }); fence = null; } else infos.push({ kind: 'code' });
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (open !== null && !(open[1][0] === '`' && open[2].includes('`'))) {
      fence = { char: open[1][0], length: open[1].length };
      infos.push({ kind: 'open', info: open[2].trim() });
      continue;
    }
    const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/.exec(line);
    const heading = atx === null ? null : { level: atx[1].length, text: (atx[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim() };
    infos.push({ kind: 'text', heading });
  }
  return { page, lines, infos };
}

/** The slugs of github-slugger: lower case, punctuation dropped, spaces to hyphens, `-n` for a repeated slug, in page order. */
const slugify = (text) => text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
function slugs(doc) {
  const occurrences = new Map();
  return doc.infos.map((info) => {
    if (info.heading === null || info.heading === undefined) return null;
    const original = slugify(info.heading.text);
    let slug = original;
    while (occurrences.has(slug)) { occurrences.set(original, occurrences.get(original) + 1); slug = `${original}-${occurrences.get(original)}`; }
    occurrences.set(slug, 0);
    return slug;
  });
}

/** Index of the first heading of the level with exactly this text at or after `from`, else -1. */
function findHeading(doc, level, text, from = 0) {
  for (let i = from; i < doc.infos.length; i++) {
    const heading = doc.infos[i].heading;
    if (heading && heading.level === level && heading.text === text) return i;
  }
  return -1;
}

/** Index of the line after the section that starts at `start`: the next H1 or H2, else the end of the page. */
function sectionEnd(doc, start) {
  for (let i = start + 1; i < doc.infos.length; i++) {
    if (doc.infos[i].heading && doc.infos[i].heading.level <= 2) return i;
  }
  return doc.lines.length;
}

function readPage(cacheRoot, commit, page) {
  try {
    return model(page, readFileSync(join(cacheRoot, commit, page), 'utf8'));
  } catch (error) {
    return fail(page, `cannot be read from the cache folder ${join(cacheRoot, commit)} (${error.code ?? error.message})`);
  }
}

/** Version and figures date from the first paragraph of the proof page, and the id of its does-not-prove heading. */
function readProof(doc) {
  const first = doc.infos.findIndex((info, i) => info.kind === 'text' && !info.heading && !isBlank(doc.lines[i]));
  if (first === -1) fail(PROOF, `no first paragraph found: ${FIGURES.source}`);
  const paragraph = [];
  for (let i = first; i < doc.lines.length && doc.infos[i].kind === 'text' && !doc.infos[i].heading && !isBlank(doc.lines[i]); i++) paragraph.push(doc.lines[i]);
  const match = FIGURES.exec(collapse(paragraph.join(' ')));
  if (match === null) fail(PROOF, `the figures sentence was not found in the first paragraph: ${FIGURES.source}`);
  const at = findHeading(doc, 2, DOES_NOT_PROVE);
  if (at === -1) fail(PROOF, `heading not found: ## ${DOES_NOT_PROVE}`);
  return { figures_date: match[1], version: match[2], does_not_prove_id: slugs(doc)[at] };
}

/** The first CommonMark code span texts of a paragraph, in order, without the backticks. */
function codeSpans(text) {
  const spans = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] !== '`') { i++; continue; }
    let size = 1;
    while (text[i + size] === '`') size++;
    let found = -1;
    for (let j = i + size; j < text.length;) {
      if (text[j] !== '`') { j++; continue; }
      let run = 1;
      while (text[j + run] === '`') run++;
      if (run === size) { found = j; break; }
      j += run;
    }
    if (found === -1) { i += size; continue; }
    let content = text.slice(i + size, found).replace(/\n/g, ' ');
    if (content.startsWith(' ') && content.endsWith(' ') && content.trim() !== '') content = content.slice(1, -1);
    spans.push(content);
    i = found + size;
  }
  return spans;
}

/** The Status sentences, the install commands and the inline code spans of the README. */
function readReadme(doc) {
  const status = findHeading(doc, 2, 'Status');
  if (status === -1) fail(README, 'heading not found: ## Status');
  const text = collapse(doc.lines.slice(status + 1, sectionEnd(doc, status)).join(' '));
  const at = text.indexOf(NOT_PROVEN);
  if (at === -1) fail(README, `sentence not found in the section "## Status": ${NOT_PROVEN}`);
  const codex = CODEX.exec(text);
  if (codex === null) fail(README, `sentence not found in the section "## Status": ${CODEX.source}`);

  const start = findHeading(doc, 2, 'Install');
  if (start === -1) fail(README, 'heading not found: ## Install');
  const end = findHeading(doc, 2, 'What it supports', start + 1);
  if (end === -1) fail(README, 'heading not found: ## What it supports (after the heading ## Install)');
  const commands = [];
  const prose = [];
  for (let i = start + 1; i < end; i++) {
    const { kind } = doc.infos[i];
    if (kind === 'code') {
      const line = doc.lines[i].trim();
      if (line !== '' && !line.startsWith('#')) commands.push(line.replace(/\s#.*$/, '').trim());
    } else prose.push(kind === 'text' ? doc.lines[i] : '');
  }
  const spans = prose.join('\n').split(/\n[ \t]*\n/).flatMap(codeSpans);
  return { not_proven_sentence: text.slice(at, at + NOT_PROVEN.length), codex_sentence: codex[0], readme_commands: commands, readme_inline_spans: spans };
}

/** The five items of the first `text` block of the Real output section, as the unaltered source lines. */
function readRealOutput(doc) {
  const where = 'the first text block of the section "## Real output"';
  const heading = findHeading(doc, 2, 'Real output');
  if (heading === -1) fail(WORKFLOW, 'heading not found: ## Real output');
  const limit = sectionEnd(doc, heading);
  const open = doc.infos.findIndex((info, i) => i > heading && i < limit && info.kind === 'open' && info.info.split(/\s+/)[0] === 'text');
  if (open === -1) fail(WORKFLOW, 'text block not found in the section "## Real output"');
  let close = open + 1;
  while (close < limit && doc.infos[close].kind === 'code') close++;

  // A block is a run of lines up to a blank line or the line of a list item; a list item takes the lines that follow it.
  const blocks = [];
  for (let i = open + 1; i < close; i++) {
    const line = doc.lines[i];
    if (isBlank(line)) continue;
    const item = LIST_ITEM.test(line);
    const last = blocks[blocks.length - 1];
    if (last !== undefined && last.end === i - 1 && !item) { last.lines.push(line); last.end = i; } else blocks.push({ item, lines: [line], end: i });
  }
  const text = (block) => block.lines.join('\n');
  const labelled = (label) => blocks.findIndex((block) => block.lines[0].startsWith(`**${label}:**`));
  const missing = (what) => fail(WORKFLOW, `${what} not found in ${where}`);

  if (blocks.length === 0 || blocks[0].item || LABEL.test(blocks[0].lines[0])) missing('the opening paragraph');
  const [cause, tests, review] = ['Cause', 'Tests', 'Review'].map((label) => {
    const at = labelled(label);
    return at === -1 ? missing(`the paragraph that starts **${label}:**`) : at;
  });
  const commit = blocks.findIndex((block) => block.item && block.lines[0].replace(LIST_ITEM, '').startsWith('**Commit:**'));
  if (commit === -1) missing('the list item that starts **Commit:**');
  if (!(0 < cause && cause < tests && tests < review && review < commit)) {
    fail(WORKFLOW, `the items are not in source order (opening, **Cause:**, **Tests:**, **Review:**, **Commit:**) in ${where}`);
  }
  const item = { ...blocks[commit], lines: [blocks[commit].lines[0].replace(LIST_ITEM, ''), ...blocks[commit].lines.slice(1)] };
  return { anchor: slugs(doc)[heading], opening: text(blocks[0]), cause: text(blocks[cause]), tests: text(blocks[tests]), review: text(blocks[review]), commit: text(item) };
}

/** The facts of the pinned documents for sync/pin.json (`pinFile`) and the cache folder that holds `<commit>/` (`cacheRoot`). */
export function readPinFacts(pinFile, cacheRoot) {
  if (typeof pinFile !== 'string' || pinFile === '') throw new Error('pin file: expected the path of sync/pin.json as a non-empty string');
  if (typeof cacheRoot !== 'string' || cacheRoot === '') throw new Error('cache root: expected the path of the sync cache folder as a non-empty string');
  let pin;
  try {
    pin = JSON.parse(readFileSync(pinFile, 'utf8'));
  } catch (error) {
    throw new Error(`${pinFile}: ${error instanceof SyntaxError ? 'is not valid JSON' : `cannot be read (${error.code ?? error.message})`}`);
  }
  const problems = validatePin(pin);
  if (problems.length > 0) throw new Error(problems.join('; '));

  const readme = readReadme(readPage(cacheRoot, pin.commit, README));
  const proof = readProof(readPage(cacheRoot, pin.commit, PROOF));
  const real_output = readRealOutput(readPage(cacheRoot, pin.commit, WORKFLOW));
  return {
    version: proof.version,
    figures_date: proof.figures_date,
    does_not_prove_id: proof.does_not_prove_id,
    not_proven_sentence: readme.not_proven_sentence,
    codex_sentence: readme.codex_sentence,
    readme_commands: readme.readme_commands,
    readme_inline_spans: readme.readme_inline_spans,
    commit: pin.commit,
    tag: pin.tag,
    real_output,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    process.stderr.write('usage: node scripts/lib/pin-facts.mjs <pin file> <cache root>\n');
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(`${JSON.stringify(readPinFacts(args[0], args[1]), null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`pin-facts: ${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

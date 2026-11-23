// TASK-043: the launch pin check. The pin is proofline tag v0.0.173 (commit b6d7f0f...), the committed lock describes that commit,
// and the README at the pin (tests/fixtures/launch/README.pin.md, a byte copy) has no "(5 minutes)" suffix on a heading and one
// Version line in each place that states it. Every test reads committed files only: no network and no .cache/ folder.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blobId, sha256, validatePin } from '../scripts/lib/lock.mjs';
import { readPinFacts } from '../scripts/lib/pin-facts.mjs';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

sweepStale();
after(removeTempDirs);

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const LAUNCH_README = join(here, 'fixtures', 'launch', 'README.pin.md');
const PIN_FACTS_FIXTURES = join(here, 'fixtures', 'pin-facts');

const COMMIT = 'b6d7f0ffc0e4177bbcbf8b135f1bc607b94823dd';
const TAG = 'v0.0.173';
const CANDIDATE = '457729b31481a8a1915c06ec3bddd57b549f0194';
const README_BLOB = '5352cae2d2458df885eb87f49d11beef13ca667e';
const README_SHA256 = '8f3e3011d3c75a112288e31c9698e11289d640610229798a86c60c4d91d5c9ce';
const SENTENCE = 'It is not yet proven on real projects.';
const CODEX = 'Codex as implementer is supported (real use, 2026-10-23 to 25); other Codex roles are not yet verified in real use.';

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const readme = () => readFileSync(LAUNCH_README);

/** Messages for a pin value that is not the launch pin: empty only for the exact commit and tag of the launch. */
function pinProblems(pin) {
  const problems = validatePin(pin);
  if (problems.length > 0) return problems;
  if (pin.commit === CANDIDATE) problems.push(`the pin names the earlier candidate commit ${CANDIDATE}`);
  else if (pin.commit !== COMMIT) problems.push(`the pin commit must be ${COMMIT}, got ${pin.commit}`);
  if (pin.tag !== TAG) problems.push(`the pin tag must be ${TAG}, got ${pin.tag}`);
  return problems;
}

/** Messages for a lock value that does not describe the launch pin and its README, empty when it does. */
function lockProblems(lock, pin) {
  const problems = [];
  if (lock.commit !== pin.commit) problems.push(`the lock commit ${lock.commit} differs from the pin commit ${pin.commit}`);
  const entries = (lock.files ?? []).filter((file) => file.path === 'README.md');
  if (entries.length !== 1) return [...problems, `the lock must list README.md once, found ${entries.length}`];
  if (entries[0].blob !== README_BLOB) problems.push(`the lock README blob must be ${README_BLOB}, got ${entries[0].blob}`);
  if (entries[0].sha256 !== README_SHA256) problems.push(`the lock README sha256 must be ${README_SHA256}, got ${entries[0].sha256}`);
  return problems;
}

/** Messages when the bytes are not the pinned README (blob id and sha256 of the lock values), empty when they are. */
function digestProblems(bytes, blob, digest) {
  const problems = [];
  if (blobId(bytes) !== blob) problems.push(`the blob id ${blobId(bytes)} is not ${blob}`);
  if (sha256(bytes) !== digest) problems.push(`the sha256 ${sha256(bytes)} is not ${digest}`);
  return problems;
}

/** Heading lines outside fenced code blocks (a `#` line inside a fence is a shell comment, not a heading). */
function headings(text) {
  const found = [];
  let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const mark = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (mark) {
      if (fence === null) fence = mark[1][0];
      else if (mark[1][0] === fence) fence = null;
      continue;
    }
    if (fence === null && /^ {0,3}#{1,6}(\s|$)/.test(line)) found.push(line.trim());
  }
  return found;
}

/** Messages for a README text whose start heading is missing or has an install-time suffix, empty when it is right. */
function headingProblems(text) {
  const lines = headings(text);
  const problems = [];
  if (!lines.includes('## Quick start')) problems.push('no heading line is exactly "## Quick start"');
  for (const line of lines) if (/\(\s*5\s*minutes\s*\)/i.test(line)) problems.push(`the heading carries the install time suffix: ${line}`);
  return problems;
}

/** The counts of the two Version line kinds: `Version <digit>` and `Version **<digit>`. */
function versionCounts(text) {
  const lines = text.split(/\r?\n/);
  return { plain: lines.filter((line) => /^Version \d/.test(line)).length, bold: lines.filter((line) => /^Version \*\*\d/.test(line)).length };
}

const versionProblems = (text) => {
  const { plain, bold } = versionCounts(text);
  const problems = [];
  if (plain !== 1) problems.push(`expected one line that starts with Version and a digit, found ${plain}`);
  if (bold !== 1) problems.push(`expected one line that starts with Version, two stars and a digit, found ${bold}`);
  return problems;
};

/** A temp cache folder in the layout of readPinFacts: the three pages of <commit>/, the README from the launch fixture. */
function launchCache(pin) {
  const dir = makeTempDir('proofline-site-launch-');
  const cacheRoot = join(dir, 'cache');
  const pages = { 'README.md': readme(), 'docs/proof.md': readFileSync(join(PIN_FACTS_FIXTURES, 'docs', 'proof.md')), 'docs/concepts/workflow.md': readFileSync(join(PIN_FACTS_FIXTURES, 'docs', 'concepts', 'workflow.md')) };
  for (const [rel, bytes] of Object.entries(pages)) {
    mkdirSync(dirname(join(cacheRoot, pin.commit, rel)), { recursive: true });
    writeFileSync(join(cacheRoot, pin.commit, rel), bytes);
  }
  const pinFile = join(dir, 'pin.json');
  writeFileSync(pinFile, JSON.stringify(pin));
  return { pinFile, cacheRoot };
}

describe('the launch pin (TASK-043)', () => {
  it('the pin is the commit and tag of the launch and a null tag, a short id or another commit is refused', () => {
    const pin = readJson('sync/pin.json');
    assert.deepEqual(pin, { commit: COMMIT, tag: TAG });
    assert.deepEqual(pinProblems(pin), []);
    assert.notEqual(pinProblems({ ...pin, tag: null }).length, 0, 'a null tag must be refused');
    assert.notEqual(pinProblems({ ...pin, commit: COMMIT.slice(0, 7) }).length, 0, 'a short commit id must be refused');
    assert.notEqual(pinProblems({ ...pin, commit: '0123456789abcdef0123456789abcdef01234567' }).length, 0, 'another commit must be refused');
    assert.notEqual(pinProblems({ ...pin, tag: 'v0.0.172' }).length, 0, 'another tag must be refused');
  });

  it('the committed lock names the pin commit and the pinned README blob id and sha256', () => {
    const pin = readJson('sync/pin.json');
    const lock = readJson('sync/lock.json');
    assert.equal(lock.commit, COMMIT);
    const entry = lock.files.find((file) => file.path === 'README.md');
    assert.ok(entry, 'the lock lists README.md');
    assert.equal(entry.blob, README_BLOB);
    assert.equal(entry.sha256, README_SHA256);
    assert.deepEqual(lockProblems(lock, pin), []);
    const other = lock.files.map((file) => (file.path === 'README.md' ? { ...file, blob: '0'.repeat(40) } : file));
    assert.notEqual(lockProblems({ ...lock, files: other }, pin).length, 0, 'another README blob id must be refused');
  });

  it('the fixture README is a byte copy of the pinned README', () => {
    const lock = readJson('sync/lock.json');
    const entry = lock.files.find((file) => file.path === 'README.md');
    const bytes = readme();
    assert.deepEqual(digestProblems(bytes, entry.blob, entry.sha256), []);
    assert.equal(blobId(bytes), README_BLOB);
    assert.equal(sha256(bytes), README_SHA256);
    const changed = Buffer.from(bytes);
    changed[Math.floor(changed.length / 2)] ^= 0x01;
    assert.notEqual(digestProblems(changed, entry.blob, entry.sha256).length, 0, 'one changed byte must be refused');
  });

  it('the fixture has a Quick start heading and no heading with the install time suffix', () => {
    const text = readme().toString('utf8');
    assert.deepEqual(headingProblems(text), []);
    assert.ok(headings(text).includes('## Quick start'));
    assert.notEqual(headingProblems(text.replace('## Quick start', '## Quick start (5 minutes)')).length, 0, 'the suffix must be caught');
    assert.notEqual(headingProblems(text.replace('## Quick start', '## Quick start ( 5  Minutes )')).length, 0, 'the suffix with other spacing and case must be caught');
    assert.notEqual(headingProblems(text.replace('## Quick start', '## Getting started')).length, 0, 'a missing Quick start heading must be caught');
  });

  it('the fixture holds one Version line and one bold Version line', () => {
    const text = readme().toString('utf8');
    assert.deepEqual(versionCounts(text), { plain: 1, bold: 1 });
    assert.deepEqual(versionProblems(text), []);
    const plain = text.split('\n').find((line) => /^Version \d/.test(line));
    const bold = text.split('\n').find((line) => /^Version \*\*\d/.test(line));
    assert.notEqual(versionProblems(text.replace(`${plain}\n`, '')).length, 0, 'zero plain lines must be caught');
    assert.notEqual(versionProblems(`${text}\n${plain}\n`).length, 0, 'two plain lines must be caught');
    assert.notEqual(versionProblems(text.replace(`${bold}\n`, '')).length, 0, 'zero bold lines must be caught');
    assert.notEqual(versionProblems(`${text}\n${bold}\n`).length, 0, 'two bold lines must be caught');
  });

  it('the pin facts module reads the launch README without an error', () => {
    const pin = readJson('sync/pin.json');
    const tree = launchCache(pin);
    let facts;
    let failure;
    try { facts = readPinFacts(tree.pinFile, tree.cacheRoot); } catch (error) { failure = error.message; }
    assert.equal(failure, undefined, 'readPinFacts must not fail over the launch README');
    assert.equal(facts.not_proven_sentence, SENTENCE);
    assert.equal(facts.codex_sentence, CODEX);
    assert.ok(Array.isArray(facts.readme_commands) && facts.readme_commands.length > 0, 'the install commands are not empty');
    assert.equal(facts.commit, COMMIT);
    assert.equal(facts.tag, TAG);
  });

  it('the pin is not the earlier candidate and the lock describes the pin', () => {
    const pin = readJson('sync/pin.json');
    const lock = readJson('sync/lock.json');
    assert.notEqual(pin.commit, CANDIDATE);
    assert.notEqual(pin.tag, null);
    assert.equal(lock.commit, pin.commit);
    assert.deepEqual(lockProblems(lock, pin), []);
    assert.deepEqual(digestProblems(readme(), README_BLOB, README_SHA256), []);
    assert.notEqual(pinProblems({ ...pin, commit: CANDIDATE }).length, 0, 'the earlier candidate commit must be refused');
    assert.notEqual(lockProblems({ ...lock, commit: CANDIDATE }, pin).length, 0, 'a lock of another commit must be refused');
  });
});

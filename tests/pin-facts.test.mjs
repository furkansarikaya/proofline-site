// TASK-010: pin facts and real-output excerpt (scripts/lib/pin-facts.mjs). Every case builds a temp pin file and cache from
// copies of tests/fixtures/pin-facts/ edited per case, so no test makes a network request or touches the repository's .cache/.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPinFacts } from '../scripts/lib/pin-facts.mjs';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

sweepStale();
after(removeTempDirs);

const here = dirname(fileURLToPath(import.meta.url));
const MODULE = join(here, '..', 'scripts', 'lib', 'pin-facts.mjs');
const FIXTURES = join(here, 'fixtures', 'pin-facts');
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const PAGES = { readme: 'README.md', proof: 'docs/proof.md', workflow: 'docs/concepts/workflow.md' };
const SENTENCE = 'It is not yet proven on real projects.';
const CODEX = 'Codex as implementer is supported (real use, 2026-10-23 to 25); other Codex roles are not yet verified in real use.';

const fixture = (rel) => readFileSync(join(FIXTURES, rel), 'utf8');

/** Edits are a function (text -> text) or a whole new text; each of the three pages starts as the fixture. */
function build({ readme, proof, workflow, pin } = {}) {
  const dir = makeTempDir('proofline-site-pinfacts-');
  const cacheRoot = join(dir, 'cache');
  for (const [key, rel] of Object.entries(PAGES)) {
    const edit = { readme, proof, workflow }[key];
    const text = typeof edit === 'function' ? edit(fixture(rel)) : typeof edit === 'string' ? edit : fixture(rel);
    mkdirSync(dirname(join(cacheRoot, COMMIT, rel)), { recursive: true });
    writeFileSync(join(cacheRoot, COMMIT, rel), text);
  }
  const pinFile = join(dir, 'pin.json');
  writeFileSync(pinFile, typeof pin === 'string' ? pin : JSON.stringify(pin ?? { commit: COMMIT, tag: 'v0.0.171' }));
  return { dir, pinFile, cacheRoot };
}

const run = (edits) => { const tree = build(edits); return readPinFacts(tree.pinFile, tree.cacheRoot); };

/** The text edit that swaps `from` for `to`; it fails when the fixture does not hold `from`. */
const swap = (from, to) => (text) => {
  assert.ok(text.includes(from), `the fixture lacks ${JSON.stringify(from)}`);
  return text.replace(from, () => to);
};
const crlf = (text) => text.replace(/\n/g, '\r\n');

/** The call throws, the message starts with `<page>: ` and holds every part. */
function rejects(edits, page, ...parts) {
  assert.throws(() => run(edits), (error) => {
    assert.ok(error instanceof Error && error.message.startsWith(`${page}: `), `message must start with "${page}: ", got ${error.message}`);
    for (const part of parts) assert.ok(error.message.includes(part), `message must hold ${JSON.stringify(part)}, got ${error.message}`);
    return true;
  });
}

/** The picked part of the facts, or the thrown message: a broken rule that makes the call throw then fails as an assertion. */
const outcome = (edits, pick) => { try { return pick(run(edits)); } catch (error) { return error.message; } };

const README_WITH_QUICK_START_INSIDE = (text) => {
  const quick = text.slice(text.indexOf('## Quick start'), text.indexOf('## Versioning and license'));
  const without = text.replace(quick, '');
  return without.replace('## What it supports', () => `${quick}## What it supports`);
};

describe('pin facts of the proof page (AC-1, AC-2, AC-3)', () => {
  it('version and figures date come from the proof page across two lines, never from the README', () => {
    const facts = run();
    assert.equal(facts.figures_date, '2026-11-19');
    assert.equal(facts.version, '0.0.171');
    const readme = fixture('README.md');
    assert.ok(readme.includes('0.0.100') && readme.includes('0.0.200'), 'the fixture README states two Version lines');
    assert.notEqual(facts.version, '0.0.100');
    assert.notEqual(facts.version, '0.0.200');
    assert.equal(run({ proof: swap('0.0.171', '0.5.5') }).version, '0.5.5');
    assert.equal(run({ readme: swap('0.0.100', '0.9.9') }).version, '0.0.171');
  });

  it('a missing or reformatted figures sentence throws naming docs/proof.md and the pattern', () => {
    const sentence = /Figures were taken on 2026-11-19 at proofline\n0\.0\.171/;
    const withoutSentence = (text) => text.replace(sentence, 'Nothing is said about figures here.');
    rejects({ proof: withoutSentence }, 'docs/proof.md', 'Figures\\s+were\\s+taken\\s+on');
    rejects({ proof: swap('2026-11-19', '19 November 2026') }, 'docs/proof.md', 'Figures\\s+were\\s+taken\\s+on', '(\\d{4}-\\d{2}-\\d{2})');
    // The sentence in the second paragraph is not read: the ADR reads the first paragraph only.
    rejects({ proof: (text) => text.replace('# Proof fixture\n\n', '# Proof fixture\n\nAn unrelated first paragraph.\n\n') }, 'docs/proof.md', 'Figures\\s+were\\s+taken\\s+on');
    const broken = build({ proof: withoutSentence });
    const result = spawnSync(process.execPath, [MODULE, broken.pinFile, broken.cacheRoot], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.startsWith('pin-facts: docs/proof.md: '), result.stderr);
    assert.equal(result.stdout, '');
  });

  it('the does-not-prove heading gives its id and a missing or reworded heading throws', () => {
    assert.equal(run().does_not_prove_id, 'what-this-does-not-prove');
    assert.equal(outcome({ proof: swap('## What this does not prove', '## What this does not prove   ') }, (facts) => facts.does_not_prove_id), 'what-this-does-not-prove');
    rejects({ proof: swap('## What this does not prove', '## The end') }, 'docs/proof.md', 'What this does not prove');
    rejects({ proof: swap('## What this does not prove', "## What this doesn't prove") }, 'docs/proof.md', 'What this does not prove');
    rejects({ proof: swap('## What this does not prove', '### What this does not prove') }, 'docs/proof.md', 'What this does not prove');
  });

  it('a repeated heading text gets the repeat suffix of the slugger and a fenced heading is not counted', () => {
    const twice = swap('## The suite', '### What this does not prove\n\n```text\n## What this does not prove\n```\n\n## The suite');
    assert.equal(run({ proof: twice }).does_not_prove_id, 'what-this-does-not-prove-1');
    const second = swap('## The suite', '## What this does not prove\n\nFirst.\n\n## The suite');
    assert.equal(run({ proof: second }).does_not_prove_id, 'what-this-does-not-prove');
    // An H1 and an H6 count for the repeat suffix; seven hashes make a paragraph, not a heading.
    const levels = swap('## The suite', '# What this does not prove\n\n###### What this does not prove\n\n####### What this does not prove\n\n## The suite');
    assert.equal(outcome({ proof: levels }, (facts) => facts.does_not_prove_id), 'what-this-does-not-prove-2');
  });
});

describe('pin facts of the README Status section (AC-4, AC-5)', () => {
  it('the not-yet-proven sentence is returned and a reworded one throws naming README.md', () => {
    assert.equal(run().not_proven_sentence, SENTENCE);
    rejects({ readme: swap(SENTENCE, 'It is not proven yet on real projects.') }, 'README.md', 'It is not yet proven on real projects.');
    // The sentence outside the Status section does not count.
    const moved = (text) => swap(SENTENCE, 'Nothing here.')(text).replace('## Versioning and license', () => `## Versioning and license\n\n${SENTENCE}`);
    rejects({ readme: moved }, 'README.md', 'It is not yet proven on real projects.');
  });

  it('the Codex sentence is returned whole and a missing or reworded one throws naming README.md', () => {
    assert.equal(run().codex_sentence, CODEX);
    rejects({ readme: swap(CODEX, 'Codex is mentioned.') }, 'README.md', 'Codex as implementer is supported');
    rejects({ readme: swap('other Codex roles are not yet verified in real use.', 'other Codex roles are verified.') }, 'README.md', 'Codex as implementer is supported');
  });

  it('both sentences are found on collapsed text when they are split over lines', () => {
    const split = (text) => text
      .replace(SENTENCE, 'It is not yet proven on real\nprojects.')
      .replace(CODEX, 'Codex as implementer is supported (real use,\n2026-10-23  to 25);  \nother Codex roles are not yet verified in real use.');
    const facts = run({ readme: split });
    assert.equal(facts.not_proven_sentence, SENTENCE);
    assert.equal(facts.codex_sentence, CODEX);
  });
});

describe('pin facts of the README Install range (AC-6, AC-7, AC-8)', () => {
  it('readme_commands holds only the commands of the install range', () => {
    assert.deepEqual(run().readme_commands, ['/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline']);
    // With the Quick start section inside the range, as in the real README, its block is part of the range.
    assert.deepEqual(run({ readme: README_WITH_QUICK_START_INSIDE }).readme_commands, [
      '/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline', 'proofline init',
    ]);
  });

  it('command lines are trimmed, cut at the first space and hash, and never a comment or an empty line', () => {
    const odd = swap('/plugin install proofline@proofline', '  indented command  \ncmd --flag#notcomment\ncmd # trailing # two\n   # indented comment\n   \n\ttabbed\n/plugin install proofline@proofline');
    assert.deepEqual(run({ readme: odd }).readme_commands, [
      '/plugin marketplace add furkansarikaya/proofline', 'indented command', 'cmd --flag#notcomment', 'cmd', 'tabbed', '/plugin install proofline@proofline',
    ]);
  });

  it('fences follow the CommonMark close rule and headings inside fences are not headings', () => {
    const tilde = swap('## What it supports', '~~~sh\nnpm i proofline\n```\nstill inside\n~~~\n\n## What it supports');
    assert.deepEqual(outcome({ readme: tilde }, (facts) => facts.readme_commands.slice(2)), ['npm i proofline', '```', 'still inside']);
    // A broken close rule can leave a fence open and make the call throw: the thrown message is compared, so it fails as an assertion.
    const commandsOrError = (readme) => { try { return run({ readme }).readme_commands.slice(2); } catch (error) { return error.message; } };
    // The close needs at least as many fence characters as the opening: a shorter run stays inside, an equal or longer run closes.
    const longer = swap('## What it supports', '````sh\nnpm i proofline\n```\nstill inside\n`````\n\n## What it supports');
    assert.deepEqual(commandsOrError(longer), ['npm i proofline', '```', 'still inside']);
    const tildes = swap('## What it supports', '~~~~sh\nnpm i proofline\n~~~\nstill inside\n~~~~\n\n## What it supports');
    assert.deepEqual(commandsOrError(tildes), ['npm i proofline', '~~~', 'still inside']);
    // A close may be indented up to three spaces and followed by spaces and tabs only: four spaces, text before the run or an info string keep the line inside.
    const closes = swap('## What it supports', '```\nnpm a\n    ```\necho ```\n``` sh\nnpm b\n   ```  \t\n\n## What it supports');
    assert.deepEqual(commandsOrError(closes), ['npm a', '```', 'echo ```', '``` sh', 'npm b']);
    // An opener may be indented up to three spaces; four spaces, a run of two and a run after text open nothing.
    const opens = swap('## What it supports', '   ```\nnpm c\n```\n\n    ```\n\n``\nnot a fence\n``\n\n~~ not a fence\n\nsee ~~~ here\n\n## What it supports');
    assert.deepEqual(commandsOrError(opens), ['npm c']);
    // The info string of a backtick fence cannot hold a backtick (that line is text with a code span); the info string of a tilde fence can.
    const infos = swap('## What it supports', '``` `code` is inline\n\n~~~sh `x`\nnpm d\n~~~\n\n## What it supports');
    assert.deepEqual(commandsOrError(infos), ['npm d']);
    assert.deepEqual(outcome({ readme: infos }, (facts) => facts.readme_inline_spans), ['sh', 'npx skills add furkansarikaya/proofline', 'code']);
    const fenced = (text) => text
      .replace('# proofline fixture', () => '# proofline fixture\n\n```text\n## Install\n```')
      .replace('/plugin install proofline@proofline', () => '/plugin install proofline@proofline\n## What it supports');
    assert.deepEqual(run({ readme: fenced }).readme_commands, ['/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline']);
  });

  it('readme_inline_spans holds the code spans of the install range only', () => {
    assert.deepEqual(run().readme_inline_spans, ['sh', 'npx skills add furkansarikaya/proofline']);
  });

  it('inline spans follow CommonMark for double backticks, two spans on a line, a split span and an unclosed backtick', () => {
    const prose = swap('**Skills only**: `npx skills add furkansarikaya/proofline`', 'One ``a`b`` and `c` then `d`\nand `split\nspan` here, `unclosed with no closer.');
    assert.deepEqual(run({ readme: prose }).readme_inline_spans, ['sh', 'a`b', 'c', 'd', 'split span']);
    // A closing run must be exactly as long as the opening run: a longer run inside the span does not close it.
    const longer = swap('**Skills only**: `npx skills add furkansarikaya/proofline`', 'A `a``b` here and ``c```d`` there.');
    assert.deepEqual(run({ readme: longer }).readme_inline_spans, ['sh', 'a``b', 'c```d']);
    // Backslash escapes, unclosed runs, the one-space strip and line endings; each case is its own paragraph so no backtick pairs across cases.
    const cases = [
      'An escaped \\`tick and `real` span.',
      'An escaped backslash \\\\`kept` here.',
      'An unclosed ``a` then text.',
      'An unclosed `` then `b` here.',
      'An unclosed ``\\`x` here.',
      'Two spaces `  ` stay.',
      'Padded `x ` and ` y` and `  z  ` once.',
      'A `three\nline\nspan` here.',
      'Inside `a\\` the backslash is literal.',
    ].join('\n\n');
    const special = swap('**Skills only**: `npx skills add furkansarikaya/proofline`', cases);
    assert.deepEqual(outcome({ readme: special }, (facts) => facts.readme_inline_spans), ['sh', 'real', 'kept', 'b', '  ', 'x ', ' y', ' z ', 'three line span', 'a\\']);
    // A span that closes on the last character of the range is found.
    const last = swap('`npx skills add furkansarikaya/proofline`\n\n## What it supports', '`npx skills add furkansarikaya/proofline`\n## What it supports');
    assert.deepEqual(outcome({ readme: last }, (facts) => facts.readme_inline_spans), ['sh', 'npx skills add furkansarikaya/proofline']);
  });

  it('ATX headings follow CommonMark for indentation, the space after the hashes, the closing sequence and an empty heading', () => {
    const commands = ['/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline'];
    // Up to three spaces of indentation, a tab after the hashes and a closing sequence (with trailing spaces) still make the end heading.
    for (const end of ['   ## What it supports', '##\tWhat it supports', '## What it supports ##  ', '## What it supports #']) {
      assert.deepEqual(outcome({ readme: swap('## What it supports', end) }, (facts) => facts.readme_commands), commands, JSON.stringify(end));
    }
    // Four spaces of indentation, no space after the hashes, hashes after text and seven hashes make no heading, so the range does not end there.
    const notHeadings = swap('```text\n/plugin marketplace', '    ## What it supports\n\n##What it supports\n\nsee ## What it supports\n\n####### What it supports\n\n```text\n/plugin marketplace');
    assert.deepEqual(outcome({ readme: notHeadings }, (facts) => facts.readme_commands), commands);
    // A hash run glued to the text, or one inside the text, is part of the text, so the heading is not the end heading.
    rejects({ readme: swap('## What it supports', '## What it supports#') }, 'README.md', '## What it supports');
    rejects({ readme: swap('## What it supports', '## What it sup #ports') }, 'README.md', '## What it supports');
    // A hash run glued to a word is no heading and does not end the Status section; an empty heading does.
    const hashtag = swap('Version **0.0.100**: full scope.', '#hashtag is no heading.\nVersion **0.0.100**: full scope.');
    assert.equal(outcome({ readme: hashtag }, (facts) => facts.not_proven_sentence), SENTENCE);
    for (const empty of ['##', '## ']) rejects({ readme: swap('Version **0.0.100**: full scope.', `${empty}\n\nVersion **0.0.100**: full scope.`) }, 'README.md', SENTENCE);
  });

  it('a README without the Install or What it supports heading throws naming the heading', () => {
    rejects({ readme: swap('## Install', '## Setup') }, 'README.md', '## Install');
    rejects({ readme: swap('## What it supports', '## What it does') }, 'README.md', '## What it supports');
    // A heading that only sits inside a fence is no heading, and an unclosed fence does not make up a range.
    rejects({ readme: swap('## What it supports', '```sh\n## What it supports') }, 'README.md', '## What it supports');
  });
});

describe('real output excerpt (AC-9, AC-10)', () => {
  const OPENING = 'The fix is in the working tree. Nothing is committed yet.\nA second line of the opening paragraph.';
  const CAUSE = '**Cause:** `paginate()` rounded the page count down.\nIt counted 12 books as 1 page.';
  const TESTS = '**Tests:** two tests were added and pass.';
  const REVIEW = '**Review:** the gates passed.';
  const COMMIT_ITEM = '**Commit:** nothing is committed or pushed.\n  tell me if you want me to commit.';

  it('real_output holds exactly the five selected items byte for byte', () => {
    const { real_output: out } = run();
    assert.deepEqual(out, { anchor: 'real-output', opening: OPENING, cause: CAUSE, tests: TESTS, review: REVIEW, commit: COMMIT_ITEM });
    const source = fixture('docs/concepts/workflow.md');
    const at = [OPENING, CAUSE, TESTS, REVIEW, COMMIT_ITEM].map((item) => source.indexOf(item));
    assert.ok(at.every((index) => index >= 0), 'every item is a slice of the source');
    assert.deepEqual(at, [...at].sort((a, b) => a - b), 'source order');
    const joined = Object.values(out).join('\n');
    assert.ok(!joined.includes('extra labelled paragraph'));
    assert.ok(!joined.includes('**Branch:**') && !joined.includes('**Task file:**') && !joined.includes('**Not done:**'));
  });

  it('only the first text block of the section is read and a fence of another kind is skipped', () => {
    const other = swap('```text\nThe fix', '```bash\nnot the excerpt\n```\n\n```text\nThe fix');
    assert.equal(run({ workflow: other }).real_output.opening, OPENING);
    const second = (text) => text.replace('Related:', () => '```text\nThe other opening.\n\n**Cause:** other cause.\n\n**Tests:** t.\n\n**Review:** r.\n\n- **Commit:** other commit.\n```\n\nRelated:');
    assert.deepEqual(run({ workflow: second }).real_output.cause, CAUSE);
    assert.equal(run({ workflow: crlf }).real_output.commit, COMMIT_ITEM);
    // The info string is trimmed: spaces before the language word do not hide the text block.
    assert.equal(outcome({ workflow: swap('```text\nThe fix', '```   text\nThe fix') }, (facts) => facts.real_output.opening), OPENING);
  });

  it('a workflow page without the Real output heading or one of the five items throws', () => {
    const page = 'docs/concepts/workflow.md';
    rejects({ workflow: swap('## Real output', '## Output') }, page, '## Real output');
    rejects({ workflow: swap(`${CAUSE}\n\n`, '') }, page, 'Cause');
    rejects({ workflow: swap(`${TESTS}\n\n`, '') }, page, 'Tests');
    rejects({ workflow: swap(`${REVIEW}\n\n`, '') }, page, 'Review');
    rejects({ workflow: swap('- **Commit:** nothing is committed or pushed.\n  tell me if you want me to commit.\n', '') }, page, 'Commit');
    rejects({ workflow: swap(`${OPENING}\n\n`, '') }, page, 'opening');
    // The labelled paragraphs outside a text block are not the excerpt.
    rejects({ workflow: (text) => text.replace('```text\n', () => '').replace('\n```\n\nRelated', () => '\n\nRelated') }, page, 'text');
    // A changed order is a layout change and fails rather than changing the excerpt.
    rejects({ workflow: swap(`${TESTS}\n\n${REVIEW}`, `${REVIEW}\n\n${TESTS}`) }, page, 'order');
  });
});

describe('pin and determinism (AC-11, AC-13)', () => {
  it('commit and tag come from the pin file and two calls return equal facts', () => {
    const tree = build();
    const first = readPinFacts(tree.pinFile, tree.cacheRoot);
    const second = readPinFacts(tree.pinFile, tree.cacheRoot);
    assert.equal(first.commit, COMMIT);
    assert.equal(first.tag, 'v0.0.171');
    assert.deepEqual(Object.keys(first).sort(), [
      'codex_sentence', 'commit', 'does_not_prove_id', 'figures_date', 'not_proven_sentence', 'readme_commands', 'readme_inline_spans', 'real_output', 'tag', 'version',
    ]);
    assert.deepEqual(first, second);
    first.readme_commands.push('changed');
    assert.notDeepEqual(first, second);
    assert.equal(run({ pin: { commit: COMMIT, tag: null } }).tag, null);
  });

  it('an invalid pin file or arguments throw before anything is read', () => {
    const tree = build();
    for (const pin of [{ tag: 'v0.0.171' }, { commit: '', tag: null }, { commit: 'abc', tag: null }, 'not json']) {
      assert.throws(() => run({ pin }), (error) => error.message.length > 0 && !/ENOENT/.test(error.message));
    }
    assert.throws(() => readPinFacts(join(tree.dir, 'missing.json'), tree.cacheRoot), /missing\.json/);
    assert.throws(() => readPinFacts(undefined, tree.cacheRoot), /pin file/);
    assert.throws(() => readPinFacts(tree.pinFile, undefined), /cache root/);
    assert.throws(() => readPinFacts(123, 456), /pin file/);
    assert.throws(() => readPinFacts(tree.pinFile, join(tree.dir, 'empty-cache')), (error) => error.message.startsWith('README.md: '));
  });

  it('no fact has a default value and every returned sentence is a slice of the pinned text', () => {
    const changed = CODEX.replace('2026-10-23 to 25', '2027-01-01 to 02');
    const facts = run({ readme: swap('2026-10-23 to 25', '2027-01-01 to 02') });
    assert.equal(facts.codex_sentence, changed);
    const collapsed = fixture('README.md').replace(/\s+/g, ' ');
    for (const sentence of [facts.not_proven_sentence, run().codex_sentence]) assert.ok(collapsed.includes(sentence));
    // Removing any single fact throws; none is replaced by an empty string, a null or a warning.
    const removals = [
      ['docs/proof.md', { proof: swap('Figures were taken', 'Numbers were taken') }],
      ['docs/proof.md', { proof: swap('## What this does not prove', '## Nothing') }],
      ['README.md', { readme: swap(SENTENCE, '') }],
      ['README.md', { readme: swap(CODEX, '') }],
      ['README.md', { readme: swap('## Install', '## Setup') }],
      ['docs/concepts/workflow.md', { workflow: swap('**Review:**', '**Look:**') }],
    ];
    for (const [page, edits] of removals) rejects(edits, page);
  });

  it('the direct run prints the facts as JSON, fails with 1 on a missing fact and with 2 on a wrong usage', () => {
    const tree = build();
    const ok = spawnSync(process.execPath, [MODULE, tree.pinFile, tree.cacheRoot], { encoding: 'utf8' });
    assert.equal(ok.status, 0);
    assert.deepEqual(JSON.parse(ok.stdout), readPinFacts(tree.pinFile, tree.cacheRoot));
    for (const args of [[], ['a'], ['a', 'b', 'c']]) {
      const usage = spawnSync(process.execPath, [MODULE, ...args], { encoding: 'utf8' });
      assert.equal(usage.status, 2);
      assert.match(usage.stderr, /pin file/);
      assert.equal(usage.stdout, '');
    }
    const empty = spawnSync(process.execPath, [MODULE, '', ''], { encoding: 'utf8' });
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /^pin-facts: /);
  });

  it('a CRLF source gives the same facts as an LF source', () => {
    const lf = run();
    assert.equal(lf.version, '0.0.171');
    assert.deepEqual(run({ readme: crlf, proof: crlf, workflow: crlf }), lf);
  });

  it('a CR-only source and a source that starts with a byte order mark give the same facts as an LF source', () => {
    const lf = run();
    const cr = (text) => text.replace(/\n/g, '\r');
    const bom = (text) => `﻿${text}`;
    assert.deepEqual(outcome({ readme: cr, proof: cr, workflow: cr }, (facts) => facts), lf);
    assert.deepEqual(outcome({ readme: bom, proof: bom, workflow: bom }, (facts) => facts), lf);
    // Only a leading byte order mark is removed: one inside the text stays in it.
    assert.deepEqual(outcome({ readme: swap('POSIX `sh`', 'POSIX `s﻿h`') }, (facts) => facts.readme_inline_spans), ['s﻿h', 'npx skills add furkansarikaya/proofline']);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The rule tables of readReadme and readRealOutput. Every parsing rule of the two functions (each regex, each boundary and index
// offset, each "not found" case and each malformed input) is one entry of RULES with the line it lives on in scripts/lib/pin-facts.mjs,
// and every rule has one or more rows: the page edit, the part of the facts that is read and the expected value or the exact error
// text. One it() runs one row, so a failing row names its rule, its line and its case. A row compares the picked value with
// assert.deepEqual, or the whole error message with assert.equal; a broken rule that throws another error still fails as an assertion.
// ---------------------------------------------------------------------------------------------------------------------------------
const F = '```';
const RULES = {
  'RR-01': [130, 'readReadme: the Status heading is the first level-2 heading whose text is exactly Status; a missing one throws "heading not found: ## Status"'],
  'RR-02': [132, 'readReadme: the Status text starts on the line after the heading, ends before the next H1 or H2 (or at the end of the page), whitespace collapsed'],
  'RR-03': [133, 'readReadme: the not-yet-proven sentence is found by exact text in the Status text and returned as a slice of its own length; else it throws first'],
  'RR-04': [135, 'readReadme: the Codex sentence is found by its pattern in the Status text only (parenthesis, semicolon, final period); else it throws'],
  'RR-05': [138, 'readReadme: the Install heading is the first level-2 heading with the exact text; a missing one throws'],
  'RR-06': [140, 'readReadme: the range ends at the first level-2 What it supports heading after Install; a missing one throws and names the Install heading'],
  'RR-07': [144, 'readReadme: the range holds the lines after the Install heading up to the end heading, and nothing before or after'],
  'RR-08': [146, 'readReadme: a command is a trimmed line inside a fence, never an empty line or a line that starts with #, cut at the first whitespace and hash'],
  'RR-09': [149, 'readReadme: text and heading lines are prose, fence lines end a paragraph, lines inside a fence are not prose'],
  'RR-10': [151, 'readReadme: prose paragraphs are split at a line that holds only spaces and tabs; a single line break does not split'],
  'RR-11': [103, 'codeSpans (read by readReadme): CommonMark code spans: run length, escapes, unclosed runs, one-space strip, line break to space'],
  'RR-12': [152, 'readReadme: commands and spans are returned in page order and the sentences are slices of the collapsed text'],
  'RO-01': [158, 'readRealOutput: the Real output heading is the first level-2 heading with the exact text; a missing one throws'],
  'RO-02': [160, 'readRealOutput: the section ends at the next H1 or H2 (or the end of the page); a text fence outside it is not read'],
  'RO-03': [161, 'readRealOutput: the block is the first fence after the heading whose info string starts with the word text'],
  'RO-04': [162, 'readRealOutput: a section without a text fence throws "text block not found"'],
  'RO-05': [163, 'readRealOutput: the block lines run from the line after the opener to the line before its closer, or to the end of an unclosed fence'],
  'RO-06': [168, 'readRealOutput: blocks are runs of lines split at blank lines (spaces and tabs count as blank) and at list items; a list item takes the lines that follow it'],
  'RO-07': [176, 'readRealOutput: a labelled paragraph is a block whose first line starts with the label in bold with the colon inside'],
  'RO-08': [179, 'readRealOutput: the opening is the first block and is no list item, no labelled paragraph and not missing'],
  'RO-09': [180, 'readRealOutput: the Cause, Tests and Review paragraphs must exist, each throws its own message, Cause first'],
  'RO-10': [184, 'readRealOutput: the Commit item is a list item whose text after the marker starts with the Commit label'],
  'RO-11': [186, 'readRealOutput: opening, Cause, Tests, Review and Commit must be in this source order'],
  'RO-12': [189, 'readRealOutput: the marker is cut from the first line of the Commit item only, the anchor is the slug of the heading, blocks are joined by line breaks unaltered'],
  'RO-13': [19, 'LABEL: two stars, at least one character without a star or a line break, then a colon and two stars, at the start of the line'],
  'RO-14': [20, 'LIST_ITEM: zero to three spaces, one of - * +, then at least one space'],
};

const NAMES = (rows) => rows.map((row) => `${row.rule}/${row.name}`);
const check = ({ edits, pick, value, error }) => {
  if (error !== undefined) {
    assert.throws(() => run(edits), (thrown) => { assert.equal(thrown.message, error); return true; });
  } else {
    assert.deepEqual(outcome(edits, pick), value);
  }
};
const defineTable = (title, rows) => {
  describe(title, () => {
    it('every rule of the table has at least one row and no row names an unknown rule', () => {
      const wanted = Object.keys(RULES).filter((rule) => rule.startsWith(rows[0].rule.slice(0, 2)));
      assert.deepEqual([...new Set(rows.map((row) => row.rule))].sort(), wanted.sort());
      assert.equal(new Set(NAMES(rows)).size, rows.length, 'row names are unique');
    });
    for (const row of rows) it(`${row.rule} (line ${RULES[row.rule][0]}) ${row.name}`, () => check(row));
  });
};

// ----- readReadme -----------------------------------------------------------------------------------------------------------------

const STATUS_TEXT = `${SENTENCE}\n${CODEX}`;
const README_ERR = {
  status: 'README.md: heading not found: ## Status',
  sentence: `README.md: sentence not found in the section "## Status": ${SENTENCE}`,
  codex: 'README.md: sentence not found in the section "## Status": Codex as implementer is supported \\([^)]*\\); other Codex roles are not yet verified in real use\\.',
  install: 'README.md: heading not found: ## Install',
  supports: 'README.md: heading not found: ## What it supports (after the heading ## Install)',
};
/** A README page; each part is the exact text between two headings, so a row controls the blank lines. */
const readme = ({ before = '', head = '## Status', status = `\n${STATUS_TEXT}\n\n`, installHead = '## Install', install = `\n${F}text\ncmd\n${F}\n\n`, tail = '## What it supports\n\nText.\n' } = {}) => (
  `# T\n\n${before}${head}\n${status}${installHead}\n${install}${tail}`);
const cmdBlock = (...commandLines) => readme({ install: `\n${F}text\n${commandLines.join('\n')}\n${F}\n\n` });
const prose = (text) => readme({ install: `\n${text}\n\n` });
const sentence = (facts) => facts.not_proven_sentence;
const codex = (facts) => facts.codex_sentence;
const commands = (facts) => facts.readme_commands;
const spans = (facts) => facts.readme_inline_spans;

const README_ROWS = [];
const val = (rule, name, text, pick, value) => README_ROWS.push({ rule, name, edits: { readme: text }, pick, value });
const err = (rule, name, text, error) => README_ROWS.push({ rule, name, edits: { readme: text }, error });

// RR-01: the Status heading
val('RR-01', 'the fixture heading is found', readme(), sentence, SENTENCE);
val('RR-01', 'a heading on the first line of the page is found', `## Status\n\n${STATUS_TEXT}\n\n## Install\n\n${F}text\ncmd\n${F}\n\n## What it supports\n\nText.\n`, sentence, SENTENCE);
err('RR-01', 'a page without the heading throws', readme({ head: '## Condition' }), README_ERR.status);
err('RR-01', 'a level 3 heading is no Status heading', readme({ head: '### Status' }), README_ERR.status);
err('RR-01', 'a level 1 heading is no Status heading', readme({ head: '# Status' }), README_ERR.status);
err('RR-01', 'a longer heading text is no Status heading', readme({ head: '## Status report' }), README_ERR.status);
err('RR-01', 'the text is compared with the case', readme({ head: '## status' }), README_ERR.status);
err('RR-01', 'a heading inside a fence is no heading', readme({ head: '## Condition', before: `${F}text\n## Status\n${STATUS_TEXT}\n${F}\n\n` }), README_ERR.status);
val('RR-01', 'a closing hash sequence and three spaces of indentation are allowed', readme({ head: '   ## Status ##' }), sentence, SENTENCE);
val('RR-01', 'the first Status heading is the one read', readme({ tail: `## What it supports\n\nText.\n\n## Status\n\n${SENTENCE}\nCodex as implementer is supported (second); other Codex roles are not yet verified in real use.\n` }), codex, CODEX);

// RR-02: the text of the Status section
val('RR-02', 'the sentence on the line right after the heading is read (no blank line)', readme({ status: `${STATUS_TEXT}\n\n` }), sentence, SENTENCE);
val('RR-02', 'a level 3 heading inside the section does not end it', readme({ status: `\nNothing.\n\n### Details\n\n${STATUS_TEXT}\n\n` }), sentence, SENTENCE);
err('RR-02', 'a level 1 heading ends the section', readme({ status: `\nNothing.\n\n# Other\n\n${STATUS_TEXT}\n\n` }), README_ERR.sentence);
err('RR-02', 'a level 2 heading ends the section', readme({ status: '\nNothing.\n\n', install: `\n${STATUS_TEXT}\n\n` }), README_ERR.sentence);
err('RR-02', 'a sentence above the heading is not read', readme({ before: `${STATUS_TEXT}\n\n`, status: '\nNothing.\n\n' }), README_ERR.sentence);
val('RR-02', 'the last section of the page runs to the end of the page', `# T\n\n## Install\n\n${F}text\ncmd\n${F}\n\n## What it supports\n\nx\n\n## Status\n\n${STATUS_TEXT}`, codex, CODEX);
val('RR-02', 'tabs, repeated spaces and line breaks collapse to one space', readme({ status: '\nIt is not yet\tproven  on\nreal   projects.\n\n' + `${CODEX}\n\n` }), sentence, SENTENCE);

// RR-03: the not-yet-proven sentence
val('RR-03', 'the sentence is returned', readme(), sentence, SENTENCE);
err('RR-03', 'a reworded sentence throws the page and the sentence', readme({ status: `\nIt is not proven yet on real projects.\n${CODEX}\n\n` }), README_ERR.sentence);
err('RR-03', 'the sentence is compared with the case', readme({ status: `\nit is not yet proven on real projects.\n${CODEX}\n\n` }), README_ERR.sentence);
err('RR-03', 'the final period is part of the sentence', readme({ status: `\nIt is not yet proven on real projects\n${CODEX}\n\n` }), README_ERR.sentence);
val('RR-03', 'text around the sentence on its line is not returned', readme({ status: `\nVersion one. ${SENTENCE} Results follow.\n${CODEX}\n\n` }), sentence, SENTENCE);
err('RR-03', 'when both sentences are missing the not-yet-proven sentence is reported', readme({ status: '\nNothing.\n\n' }), README_ERR.sentence);
err('RR-03', 'the sentence in another section does not count', readme({ status: `\n${CODEX}\n\n`, install: `\n${SENTENCE}\n\n` }), README_ERR.sentence);

// RR-04: the Codex sentence
val('RR-04', 'the sentence is returned whole', readme(), codex, CODEX);
err('RR-04', 'a missing sentence throws the page and the pattern', readme({ status: `\n${SENTENCE}\n\n` }), README_ERR.codex);
err('RR-04', 'the sentence in another section does not count', readme({ status: `\n${SENTENCE}\n\n`, install: `\n${CODEX}\n\n` }), README_ERR.codex);
val('RR-04', 'an empty parenthesis is allowed', readme({ status: `\n${SENTENCE}\nCodex as implementer is supported (); other Codex roles are not yet verified in real use.\n\n` }), codex, 'Codex as implementer is supported (); other Codex roles are not yet verified in real use.');
val('RR-04', 'a parenthesis over a line break is read on the collapsed text', readme({ status: `\n${SENTENCE}\nCodex as implementer is supported (real use,\n   2026); other Codex roles are not yet verified in real use.\n\n` }), codex, 'Codex as implementer is supported (real use, 2026); other Codex roles are not yet verified in real use.');
err('RR-04', 'a closing parenthesis inside the parenthesis ends it', readme({ status: `\n${SENTENCE}\nCodex as implementer is supported (real (use)); other Codex roles are not yet verified in real use.\n\n` }), README_ERR.codex);
err('RR-04', 'the parenthesis is needed', readme({ status: `\n${SENTENCE}\nCodex as implementer is supported; other Codex roles are not yet verified in real use.\n\n` }), README_ERR.codex);
err('RR-04', 'the semicolon is needed', readme({ status: `\n${SENTENCE}\nCodex as implementer is supported (real use), other Codex roles are not yet verified in real use.\n\n` }), README_ERR.codex);
err('RR-04', 'the final period is needed and is a period', readme({ status: `\n${SENTENCE}\nCodex as implementer is supported (real use); other Codex roles are not yet verified in real use!\n\n` }), README_ERR.codex);
err('RR-04', 'the sentence is compared with the case', readme({ status: `\n${SENTENCE}\ncodex as implementer is supported (real use); other Codex roles are not yet verified in real use.\n\n` }), README_ERR.codex);
val('RR-04', 'text around the sentence on its line is not returned', readme({ status: `\n${SENTENCE}\nNote. ${CODEX} More.\n\n` }), codex, CODEX);

// RR-05: the Install heading
err('RR-05', 'a page without the heading throws', readme({ installHead: '## Setup' }), README_ERR.install);
err('RR-05', 'a level 3 heading is no Install heading', readme({ installHead: '### Install' }), README_ERR.install);
err('RR-05', 'a level 1 heading is no Install heading', readme({ installHead: '# Install' }), README_ERR.install);
err('RR-05', 'a longer heading text is no Install heading', readme({ installHead: '## Installation' }), README_ERR.install);
val('RR-05', 'a closing hash sequence is allowed', readme({ installHead: '## Install ##' }), commands, ['cmd']);
val('RR-05', 'a heading inside a fence is skipped', readme({ before: `${F}text\n## Install\n${F}\n\n` }), commands, ['cmd']);
val('RR-05', 'the first Install heading is the one read', readme({ tail: `## What it supports\n\nx\n\n## Install\n\n${F}text\nother\n${F}\n\n## What it supports\n\ny\n` }), commands, ['cmd']);

// RR-06: the heading that ends the range
err('RR-06', 'a page without the heading throws and names the Install heading', readme({ tail: '## What it does\n\nText.\n' }), README_ERR.supports);
err('RR-06', 'a level 3 heading ends nothing', readme({ tail: '### What it supports\n\nText.\n' }), README_ERR.supports);
err('RR-06', 'a level 1 heading ends nothing', readme({ tail: '# What it supports\n\nText.\n' }), README_ERR.supports);
err('RR-06', 'a longer heading text ends nothing', readme({ tail: '## What it supports today\n\nText.\n' }), README_ERR.supports);
err('RR-06', 'a heading above the Install heading is not the end', `# T\n\n## What it supports\n\nx\n\n## Status\n\n${STATUS_TEXT}\n\n## Install\n\n${F}text\ncmd\n${F}\n`, README_ERR.supports);
val('RR-06', 'a heading above the Install heading is skipped for the one below it', `# T\n\n## What it supports\n\nx\n\n## Status\n\n${STATUS_TEXT}\n\n## Install\n\n${F}text\ncmd\n${F}\n\n## What it supports\n\ny\n`, commands, ['cmd']);
val('RR-06', 'the first end heading after Install ends the range', readme({ tail: `## What it supports\n\n${F}text\nlate\n${F}\n\n## What it supports\n\ny\n` }), commands, ['cmd']);
val('RR-06', 'another heading inside the range does not end it', readme({ install: `\n${F}text\ncmd\n${F}\n\n## Quick start\n\n${F}text\ncmd two\n${F}\n\n` }), commands, ['cmd', 'cmd two']);

// RR-07: the bounds of the range
val('RR-07', 'a prose line right under the heading is in the range (no blank line)', readme({ install: 'Run `sh` now.\n\n' }), spans, ['sh']);
val('RR-07', 'a fence right under the heading is in the range (no blank line)', readme({ install: `${F}text\ncmd\n${F}\n\n` }), commands, ['cmd']);
val('RR-07', 'an end heading right under the Install heading gives an empty range', readme({ install: '' }), (facts) => [facts.readme_commands, facts.readme_inline_spans], [[], []]);
val('RR-07', 'spans above the heading and below the end heading are left out', readme({ before: 'A `before` span.\n\n', install: '\nRun `in` now.\n\n', tail: '## What it supports\n\nA `after` span.\n' }), spans, ['in']);
val('RR-07', 'commands above the heading and below the end heading are left out', readme({ before: `${F}text\npre\n${F}\n\n`, tail: `## What it supports\n\n${F}text\npost\n${F}\n` }), commands, ['cmd']);

// RR-08: the command lines
val('RR-08', 'a command line is trimmed', cmdBlock('  indented  ', '\tx'), commands, ['indented', 'x']);
val('RR-08', 'empty lines and lines of spaces or tabs are no command', cmdBlock('', '   ', '\t', 'a'), commands, ['a']);
val('RR-08', 'a line that starts with a hash and a space is a comment', cmdBlock('# note', 'a'), commands, ['a']);
val('RR-08', 'a line that starts with a hash and no space is a comment', cmdBlock('#note', '#!/bin/sh', 'a'), commands, ['a']);
val('RR-08', 'an indented comment line is a comment', cmdBlock('   # note', 'a'), commands, ['a']);
val('RR-08', 'a trailing comment is cut after a space', cmdBlock('cmd # note'), commands, ['cmd']);
val('RR-08', 'a trailing comment is cut after a tab', cmdBlock('cmd\t# tab comment'), commands, ['cmd']);
val('RR-08', 'a trailing comment is cut when the hash has no space after it', cmdBlock('cmd #tag'), commands, ['cmd']);
val('RR-08', 'the spaces before a trailing comment are cut too', cmdBlock('cmd   # two spaces'), commands, ['cmd']);
val('RR-08', 'a trailing comment holds the rest of the line, other hashes included', cmdBlock('cmd # a # b'), commands, ['cmd']);
val('RR-08', 'spaces inside a command stay as written', cmdBlock('cmd  --a   b'), commands, ['cmd  --a   b']);
val('RR-08', 'a lone trailing hash is a comment', cmdBlock('cmd #'), commands, ['cmd']);
val('RR-08', 'a hash inside a word is no comment', cmdBlock('a#b', 'c --flag#x'), commands, ['a#b', 'c --flag#x']);
val('RR-08', 'every fence counts whatever its info string and its fence character', readme({ install: `\n${F}sh\na\n${F}\n\n~~~\nb\n~~~\n\n${F}\nc\n${F}\n\n` }), commands, ['a', 'b', 'c']);
val('RR-08', 'prose lines are no command', readme({ install: '\n$ echo hi\n\n- npm i\n\n' }), commands, []);
val('RR-08', 'commands keep the page order', cmdBlock('z', 'a', 'm'), commands, ['z', 'a', 'm']);

// RR-09: prose lines
val('RR-09', 'a heading line inside the range is prose', readme({ install: '\n### Step `one`\n\n' }), spans, ['one']);
val('RR-09', 'a fence ends a paragraph: an unclosed backtick does not pair across it', readme({ install: `\nA \`a\n${F}text\ncmd\n${F}\nb\` here.\n\n` }), spans, []);
val('RR-09', 'lines inside a fence are not prose', readme({ install: `\nA \`a\`\n${F}text\nwith \`inside\` span\n${F}\n\n` }), spans, ['a']);
val('RR-09', 'a list item line is prose', prose('- use `x` here'), spans, ['x']);
val('RR-09', 'an indented line is prose', prose('    use `x` here'), spans, ['x']);

// RR-10: paragraph split
val('RR-10', 'an empty line splits a paragraph', prose('An unclosed `a\n\nb` here.'), spans, []);
val('RR-10', 'a line of two spaces splits a paragraph', prose('An unclosed `a\n  \nb` here.'), spans, []);
val('RR-10', 'a line of one tab splits a paragraph', prose('An unclosed `a\n\t\nb` here.'), spans, []);
val('RR-10', 'a line of spaces and tabs splits a paragraph', prose('An unclosed `a\n \t \nb` here.'), spans, []);
val('RR-10', 'a line of a no-break space is no blank line', prose('A `a\n\u00a0\nb` here.'), spans, ['a \u00a0 b']);
val('RR-10', 'a single line break does not split a paragraph', prose('A `x\ny` here.'), spans, ['x y']);
val('RR-10', 'a line with text is no blank line', prose('A `a\n x \nb` here.'), spans, ['a  x  b']);
val('RR-10', 'two blank lines in a row split too', prose('An unclosed `a\n\n\nb` here.'), spans, []);
val('RR-10', 'spans of several paragraphs keep the paragraph order', prose('One `a`.\n\nTwo `b`.\n\nThree `c`.'), spans, ['a', 'b', 'c']);

// RR-11: code spans
val('RR-11', 'a span is read without its backticks', prose('A `x` here.'), spans, ['x']);
val('RR-11', 'two spans on a line are two spans', prose('One `a` and `b` here.'), spans, ['a', 'b']);
val('RR-11', 'a double-backtick span holds a single backtick', prose('A ``a`b`` here.'), spans, ['a`b']);
val('RR-11', 'a closing run must be as long as the opening run: a longer run stays inside', prose('A `a``b` here.'), spans, ['a``b']);
val('RR-11', 'a closing run must be as long as the opening run: a shorter run stays inside', prose('A ``c```d`` here.'), spans, ['c```d']);
val('RR-11', 'an escaped backtick opens no span', prose('An escaped \\`tick and `real` span.'), spans, ['real']);
val('RR-11', 'an escaped backslash does not escape the backtick', prose('An escaped backslash \\\\`kept` here.'), spans, ['kept']);
val('RR-11', 'an unclosed single backtick makes no span', prose('An unclosed `a then text.'), spans, []);
val('RR-11', 'an unclosed double run makes no span and a later single backtick is no closer', prose('An unclosed ``a` then text.'), spans, []);
val('RR-11', 'after an unclosed double run a later single span is still found', prose('An unclosed `` then `b` here.'), spans, ['b']);
val('RR-11', 'an escaped backtick after an unclosed double run opens nothing', prose('An unclosed ``\\`x` here.'), spans, []);
val('RR-11', 'a span of two spaces keeps them', prose('Two spaces `  ` stay.'), spans, ['  ']);
val('RR-11', 'a span of one space keeps it', prose('One space ` ` stays.'), spans, [' ']);
val('RR-11', 'one space is cut on both sides only when both sides have one', prose('Padded `x ` and ` y` and `  z  ` once.'), spans, ['x ', ' y', ' z ']);
val('RR-11', 'a span over three lines turns the line breaks into spaces', prose('A `three\nline\nspan` here.'), spans, ['three line span']);
val('RR-11', 'a backslash inside a span is literal', prose('Inside `a\\` the backslash is literal.'), spans, ['a\\']);
val('RR-11', 'a span that closes on the last character of the range is found', readme({ install: '\nEnds `x`\n', tail: '## What it supports\n\nText.\n' }), spans, ['x']);
val('RR-11', 'a trailing lone backtick is no span', prose('Ends with a tick `'), spans, []);

// RR-12: the returned lists
val('RR-12', 'the fixture gives the lists in page order', readme({ install: `\nRun \`a\` then \`b\`.\n\n${F}text\nx\n${F}\n\nRun \`c\`.\n\n${F}text\ny\n${F}\n\n` }), (facts) => [facts.readme_commands, facts.readme_inline_spans], [['x', 'y'], ['a', 'b', 'c']]);
val('RR-12', 'an install range without commands and spans gives two empty lists', readme({ install: '\nNothing here.\n\n' }), (facts) => [facts.readme_commands, facts.readme_inline_spans], [[], []]);
val('RR-12', 'the two sentences are returned as separate slices', readme({ status: `\nA. ${SENTENCE} B. ${CODEX} C.\n\n` }), (facts) => [facts.not_proven_sentence, facts.codex_sentence], [SENTENCE, CODEX]);

defineTable('rule table of readReadme (AC-4 to AC-8)', README_ROWS);

// ----- readRealOutput -------------------------------------------------------------------------------------------------------------

const WF = 'docs/concepts/workflow.md';
const WHERE = 'the first text block of the section "## Real output"';
const lacks = (what) => `${WF}: ${what} not found in ${WHERE}`;
const WF_ERR = {
  heading: `${WF}: heading not found: ## Real output`,
  block: `${WF}: text block not found in the section "## Real output"`,
  opening: lacks('the opening paragraph'),
  cause: lacks('the paragraph that starts **Cause:**'),
  tests: lacks('the paragraph that starts **Tests:**'),
  review: lacks('the paragraph that starts **Review:**'),
  commit: lacks('the list item that starts **Commit:**'),
  order: `${WF}: the items are not in source order (opening, **Cause:**, **Tests:**, **Review:**, **Commit:**) in ${WHERE}`,
};
const OP = ['Opening one.', 'Opening two.'];
const CA = ['**Cause:** c1.', 'c2.'];
const TE = ['**Tests:** t.'];
const RE = ['**Review:** r.'];
const CO = ['- **Commit:** m1.', '  m2.'];
const OUT = { anchor: 'real-output', opening: 'Opening one.\nOpening two.', cause: '**Cause:** c1.\nc2.', tests: '**Tests:** t.', review: '**Review:** r.', commit: '**Commit:** m1.\n  m2.' };
/** The lines of a text block: the parts are joined by one blank line. */
const parts = (...groups) => groups.map((group) => group.join('\n')).join('\n\n');
/** A workflow page; each part is the exact text between two lines, so a row controls the fence and the blank lines. */
const workflow = ({ body = parts(OP, CA, TE, RE, CO), before = '', head = '## Real output', gap = '\n', fence = `${F}text`, close = F, afterClose = '\n', after = '## Other\n\nText.\n' } = {}) => (
  `# W\n\n${before}${head}\n${gap}${fence}\n${body}\n${close}\n${afterClose}${after}`);
const withBody = (...groups) => workflow({ body: parts(...groups) });
const all = (facts) => facts.real_output;
const field = (name) => (facts) => facts.real_output[name];

const WORKFLOW_ROWS = [];
const wval = (rule, name, text, pick, value) => WORKFLOW_ROWS.push({ rule, name, edits: { workflow: text }, pick, value });
const werr = (rule, name, text, error) => WORKFLOW_ROWS.push({ rule, name, edits: { workflow: text }, error });

// RO-01: the heading
wval('RO-01', 'the fixture gives the five items and the anchor', workflow(), all, OUT);
wval('RO-01', 'a heading on the first line of the page is found', `## Real output\n\n${F}text\n${parts(OP, CA, TE, RE, CO)}\n${F}\n`, all, OUT);
werr('RO-01', 'a page without the heading throws', workflow({ head: '## Output' }), WF_ERR.heading);
werr('RO-01', 'a level 3 heading is no Real output heading', workflow({ head: '### Real output' }), WF_ERR.heading);
werr('RO-01', 'a level 1 heading is no Real output heading', workflow({ head: '# Real output' }), WF_ERR.heading);
werr('RO-01', 'a longer heading text is no Real output heading', workflow({ head: '## Real output extra' }), WF_ERR.heading);
werr('RO-01', 'the text is compared with the case', workflow({ head: '## real output' }), WF_ERR.heading);
werr('RO-01', 'a heading inside a fence is no heading', workflow({ head: '## Other', before: `${F}bash\n## Real output\n${F}\n\n` }), WF_ERR.heading);
wval('RO-01', 'a closing hash sequence is allowed', workflow({ head: '## Real output ##' }), field('anchor'), 'real-output');
wval('RO-01', 'the first Real output heading is the one read', workflow({ after: `## Real output\n\n${F}text\nOther opening.\n\n**Cause:** x.\n\n**Tests:** x.\n\n**Review:** x.\n\n- **Commit:** x.\n${F}\n` }), field('opening'), OUT.opening);

// RO-02: the end of the section
werr('RO-02', 'a text fence below the next H2 is not read', `# W\n\n## Real output\n\nNo block here.\n\n## Other\n\n${F}text\n${parts(OP, CA, TE, RE, CO)}\n${F}\n`, WF_ERR.block);
werr('RO-02', 'a text fence below an H1 is not read', `# W\n\n## Real output\n\nNo block here.\n\n# Next\n\n${F}text\n${parts(OP, CA, TE, RE, CO)}\n${F}\n`, WF_ERR.block);
wval('RO-02', 'a text fence below an H3 of the section is read', `# W\n\n## Real output\n\n### Detail\n\n${F}text\n${parts(OP, CA, TE, RE, CO)}\n${F}\n\n## Other\n\nText.\n`, field('opening'), OUT.opening);
wval('RO-02', 'the last section of the page runs to the end of the page', workflow({ after: '' }), all, OUT);
wval('RO-02', 'a fence right under the heading is in the section (no blank line)', workflow({ gap: '' }), all, OUT);
wval('RO-02', 'a text fence above the heading is not read', workflow({ before: `${F}text\nBefore opening.\n\n**Cause:** b.\n${F}\n\n` }), field('opening'), OUT.opening);
werr('RO-02', 'a text fence above the heading is the only one: nothing is read', `# W\n\n${F}text\n${parts(OP, CA, TE, RE, CO)}\n${F}\n\n## Real output\n\nNo block.\n`, WF_ERR.block);

// RO-03: the fence that is read
wval('RO-03', 'an info string with more words after text is read', workflow({ fence: `${F}text title="x"` }), field('opening'), OUT.opening);
wval('RO-03', 'a tab after the word text is read', workflow({ fence: `${F}text\ttitle` }), field('opening'), OUT.opening);
wval('RO-03', 'a fence whose info word only starts with text is skipped', workflow({ gap: `\n${F}textile\nnot it\n${F}\n\n` }), field('opening'), OUT.opening);
werr('RO-03', 'an info string that is another word makes no text block', workflow({ fence: `${F}txt` }), WF_ERR.block);
werr('RO-03', 'the info word is compared with the case', workflow({ fence: `${F}Text` }), WF_ERR.block);
werr('RO-03', 'a fence without an info string is no text block', workflow({ fence: F }), WF_ERR.block);
wval('RO-03', 'a tilde fence is read', workflow({ fence: '~~~text', close: '~~~' }), field('opening'), OUT.opening);
wval('RO-03', 'a longer fence is read', workflow({ fence: '````text', close: '````' }), field('opening'), OUT.opening);
wval('RO-03', 'a fence of another kind before the text fence is skipped', workflow({ gap: `\n${F}bash\nnot the excerpt\n${F}\n\n` }), field('opening'), OUT.opening);
wval('RO-03', 'of two text fences the first is read', workflow({ afterClose: `\n${F}text\nOther.\n\n**Cause:** o.\n${F}\n\n` }), field('opening'), OUT.opening);

// RO-04: no text fence
werr('RO-04', 'a section without any fence throws', '# W\n\n## Real output\n\nOnly text.\n\n## Other\n\nText.\n', WF_ERR.block);
werr('RO-04', 'a section with a fence of another kind only throws', workflow({ fence: `${F}bash` }), WF_ERR.block);

// RO-05: the lines of the block
wval('RO-05', 'a line right after the closing fence is not in the block', workflow({ afterClose: 'Trailing line.\n' }), field('commit'), OUT.commit);
wval('RO-05', 'the closing fence line is not in the block', workflow(), field('commit'), OUT.commit);
werr('RO-05', 'a fence with no line between the opener and the closer has no block', `# W\n\n## Real output\n\n${F}text\n${F}\n`, WF_ERR.opening);
wval('RO-05', 'an unclosed fence runs to the end of the page', `# W\n\n## Real output\n\n${F}text\n${parts(OP, CA, TE, RE, CO)}\n`, all, OUT);
wval('RO-05', 'a fence closed by the last line of the page without a final line break', `# W\n\n## Real output\n\n${F}text\n${parts(OP, CA, TE, RE, CO)}\n${F}`, all, OUT);

// RO-06: the blocks
wval('RO-06', 'a line of two spaces ends a paragraph', withBody(['Opening one.', '  ', 'Opening two.'], CA, TE, RE, CO), field('opening'), 'Opening one.');
wval('RO-06', 'a line of one tab ends a paragraph', withBody(['Opening one.', '\t', 'Opening two.'], CA, TE, RE, CO), field('opening'), 'Opening one.');
wval('RO-06', 'the lines of a paragraph keep their leading and trailing whitespace', withBody(OP, ['**Cause:** c1.  ', '\tc2.', ' c3 '], TE, RE, CO), field('cause'), '**Cause:** c1.  \n\tc2.\n c3 ');
wval('RO-06', 'a paragraph line after a blank line is a new block, not a part of the list item', withBody(OP, CA, TE, RE, [...CO, '', 'More text.']), field('commit'), OUT.commit);
wval('RO-06', 'a list item line right after a paragraph starts a new block (no blank line)', withBody(OP, CA, TE, ['**Review:** r.', '- **Commit:** m1.', '  m2.']), all, OUT);
wval('RO-06', 'each list item is its own block', withBody(OP, CA, TE, RE, ['- **Branch:** b.', '- **Commit:** m1.', '  m2.', '- **Task file:** t.']), field('commit'), OUT.commit);
wval('RO-06', 'a line without a marker right after a list item belongs to the item', withBody(OP, CA, TE, RE, ['- **Commit:** m1.', 'tail text']), field('commit'), '**Commit:** m1.\ntail text');
wval('RO-06', 'a bullet indented four spaces is no list item: it stays inside the item', withBody(OP, CA, TE, RE, [...CO, '    - nested']), field('commit'), '**Commit:** m1.\n  m2.\n    - nested');
wval('RO-06', 'a bullet indented three spaces is a new list item: it ends the item', withBody(OP, CA, TE, RE, [...CO, '   - **Task file:** t.']), field('commit'), OUT.commit);
wval('RO-06', 'a paragraph after another paragraph with no blank line is one block', withBody(['Opening one.', 'Opening two.', 'Opening three.'], CA, TE, RE, CO), field('opening'), 'Opening one.\nOpening two.\nOpening three.');
wval('RO-06', 'blank lines at the start and the end of the block are ignored', workflow({ body: `\n\n${parts(OP, CA, TE, RE, CO)}\n\n` }), all, OUT);

// RO-07: the labelled paragraphs
wval('RO-07', 'an extra labelled paragraph between the items is left out', withBody(OP, CA, ['**Scope:** extra.'], TE, ['**Not done:**'], RE, CO), all, OUT);
werr('RO-07', 'a label with leading whitespace is no label', withBody(OP, [' **Cause:** c1.'], TE, RE, CO), WF_ERR.cause);
werr('RO-07', 'a label with the colon outside the bold is no label', withBody(OP, ['**Cause**: c1.'], TE, RE, CO), WF_ERR.cause);
werr('RO-07', 'a label is compared with the case', withBody(OP, ['**cause:** c1.'], TE, RE, CO), WF_ERR.cause);
werr('RO-07', 'a label with a space before the colon is no label', withBody(OP, ['**Cause :** c1.'], TE, RE, CO), WF_ERR.cause);
werr('RO-07', 'a label without the closing stars is no label', withBody(OP, ['**Cause: c1.'], TE, RE, CO), WF_ERR.cause);
werr('RO-07', 'a label with one closing star is no label', withBody(OP, ['**Cause:* c1.'], TE, RE, CO), WF_ERR.cause);
werr('RO-07', 'a label on the second line of a paragraph is no new paragraph', withBody(OP, ['**Cause:** c1.', '**Tests:** t.'], RE, CO), WF_ERR.tests);
wval('RO-07', 'the first paragraph with the label is the one read', withBody(OP, CA, ['**Tests:** first.'], ['**Tests:** second.'], RE, CO), field('tests'), '**Tests:** first.');
wval('RO-07', 'a label inside the first line of another paragraph is not that paragraph', withBody(OP, CA, ['**Scope:** about **Tests:** here.'], TE, RE, CO), field('tests'), '**Tests:** t.');

// RO-08: the opening
werr('RO-08', 'an empty text block has no opening', workflow({ body: '' }), WF_ERR.opening);
werr('RO-08', 'a text block of blank lines has no opening', workflow({ body: '\n  \n\t\n' }), WF_ERR.opening);
werr('RO-08', 'a list item first is no opening', withBody(['- an item'], OP, CA, TE, RE, CO), WF_ERR.opening);
werr('RO-08', 'a labelled paragraph first is no opening (the message is the opening message, not the order message)', withBody(CA, TE, RE, CO), WF_ERR.opening);
werr('RO-08', 'any labelled paragraph first is no opening', withBody(['**Scope:** x.'], OP, CA, TE, RE, CO), WF_ERR.opening);
wval('RO-08', 'bold text without a colon is an opening', withBody(['**Note** the fix is in.'], CA, TE, RE, CO), field('opening'), '**Note** the fix is in.');
wval('RO-08', 'a label in the middle of the first line is an opening', withBody(['Nothing **done:** is committed yet.', 'Second line.'], CA, TE, RE, CO), field('opening'), 'Nothing **done:** is committed yet.\nSecond line.');
wval('RO-08', 'an empty label is no label', withBody(['**:** x.'], CA, TE, RE, CO), field('opening'), '**:** x.');
wval('RO-08', 'a label text with a star inside is no label', withBody(['**a*b:** x.'], CA, TE, RE, CO), field('opening'), '**a*b:** x.');
wval('RO-08', 'only the first block is the opening: a second paragraph before Cause is dropped', withBody(OP, ['Second paragraph.'], CA, TE, RE, CO), field('opening'), OUT.opening);
wval('RO-08', 'an indented first line is an opening and keeps its indentation', withBody(['  indented opening'], CA, TE, RE, CO), field('opening'), '  indented opening');

// RO-09: the missing paragraphs
werr('RO-09', 'a missing Cause paragraph throws', withBody(OP, TE, RE, CO), WF_ERR.cause);
werr('RO-09', 'a missing Tests paragraph throws', withBody(OP, CA, RE, CO), WF_ERR.tests);
werr('RO-09', 'a missing Review paragraph throws', withBody(OP, CA, TE, CO), WF_ERR.review);
werr('RO-09', 'with Cause and Tests missing, Cause is reported', withBody(OP, RE, CO), WF_ERR.cause);
werr('RO-09', 'with Tests and Review missing, Tests is reported', withBody(OP, CA, CO), WF_ERR.tests);

// RO-10: the Commit item
werr('RO-10', 'a missing Commit item throws', withBody(OP, CA, TE, RE), WF_ERR.commit);
werr('RO-10', 'a Commit paragraph that is no list item throws', withBody(OP, CA, TE, RE, ['**Commit:** m1.']), WF_ERR.commit);
werr('RO-10', 'a list item with another label throws', withBody(OP, CA, TE, RE, ['- **Task file:** t.']), WF_ERR.commit);
werr('RO-10', 'a list item with the word but no bold label throws', withBody(OP, CA, TE, RE, ['- Commit: m1.']), WF_ERR.commit);
werr('RO-10', 'the label is compared with the case', withBody(OP, CA, TE, RE, ['- **commit:** m1.']), WF_ERR.commit);
werr('RO-10', 'a label without the colon is no Commit label', withBody(OP, CA, TE, RE, ['- **Commit** m1.']), WF_ERR.commit);
werr('RO-10', 'a label without the closing stars is no Commit label', withBody(OP, CA, TE, RE, ['- **Commit: m1.']), WF_ERR.commit);
werr('RO-10', 'a label after other text in the item is no Commit item', withBody(OP, CA, TE, RE, ['- see **Commit:** m1.']), WF_ERR.commit);
wval('RO-10', 'the first Commit item is the one read', withBody(OP, CA, TE, RE, ['- **Commit:** first.', '- **Commit:** second.']), field('commit'), '**Commit:** first.');
wval('RO-10', 'a Commit item after other list items is found', withBody(OP, CA, TE, RE, ['**Not done:**', '- **Branch:** b.', '- **Commit:** m1.']), field('commit'), '**Commit:** m1.');

// RO-11: the order
werr('RO-11', 'Tests before Cause throws the order message', withBody(OP, TE, CA, RE, CO), WF_ERR.order);
werr('RO-11', 'Review before Tests throws the order message', withBody(OP, CA, RE, TE, CO), WF_ERR.order);
werr('RO-11', 'Commit before Review throws the order message', withBody(OP, CA, TE, ['- **Commit:** early.'], RE), WF_ERR.order);
werr('RO-11', 'Commit before Cause throws the order message', withBody(OP, ['- **Commit:** early.'], CA, TE, RE), WF_ERR.order);
werr('RO-11', 'Review before Cause throws the order message', withBody(OP, RE, CA, TE, CO), WF_ERR.order);
wval('RO-11', 'the right order with extra blocks between the items passes', withBody(OP, ['extra'], CA, ['**Scope:** s.'], TE, ['**Branch:** b.'], RE, ['**Not done:**'], CO), all, OUT);

// RO-12: the returned items
wval('RO-12', 'the marker and the indentation are cut from the first line of the Commit item only', withBody(OP, CA, TE, RE, ['   -   **Commit:** m1.', '   cont']), field('commit'), '**Commit:** m1.\n   cont');
wval('RO-12', 'the anchor is the slug of the heading', workflow(), field('anchor'), 'real-output');
wval('RO-12', 'trailing whitespace of the first line of the Commit item is kept', withBody(OP, CA, TE, RE, ['- **Commit:** m1.  ', '  m2.  ']), field('commit'), '**Commit:** m1.  \n  m2.  ');
wval('RO-12', 'the anchor counts an earlier heading with the same slug', workflow({ before: '# Real output\n\n' }), field('anchor'), 'real-output-1');
wval('RO-12', 'the facts of the section hold exactly these six keys', workflow(), (facts) => Object.keys(facts.real_output), ['anchor', 'opening', 'cause', 'tests', 'review', 'commit']);

// RO-13: the label pattern (through the opening)
werr('RO-13', 'a label with spaces in its text is a label', withBody(['**Not done:** x.'], OP, CA, TE, RE, CO), WF_ERR.opening);
wval('RO-13', 'a bold word with the colon outside is no label', withBody(['**Note**: x.'], CA, TE, RE, CO), field('opening'), '**Note**: x.');
wval('RO-13', 'a label must start the line: the same text after a space is no label', withBody([' **Note:** x.'], CA, TE, RE, CO), field('opening'), ' **Note:** x.');
wval('RO-13', 'a label that ends with one star is no label', withBody(['**Note:* x.'], CA, TE, RE, CO), field('opening'), '**Note:* x.');

// RO-14: the list item pattern (through the Commit item)
for (const marker of ['-', '*', '+']) wval('RO-14', `the marker ${marker} makes a list item`, withBody(OP, CA, TE, RE, [`${marker} **Commit:** m1.`]), field('commit'), '**Commit:** m1.');
for (const indent of ['', ' ', '  ', '   ']) wval('RO-14', `an indentation of ${indent.length} spaces still makes a list item`, withBody(OP, CA, TE, RE, [`${indent}- **Commit:** m1.`]), field('commit'), '**Commit:** m1.');
werr('RO-14', 'an indentation of four spaces makes no list item', withBody(OP, CA, TE, RE, ['    - **Commit:** m1.']), WF_ERR.commit);
werr('RO-14', 'no space after the marker makes no list item', withBody(OP, CA, TE, RE, ['-**Commit:** m1.']), WF_ERR.commit);
werr('RO-14', 'a tab after the marker makes no list item', withBody(OP, CA, TE, RE, ['-\t**Commit:** m1.']), WF_ERR.commit);
werr('RO-14', 'a bold start is no list item', withBody(OP, CA, TE, RE, ['**Commit:** m1.']), WF_ERR.commit);
wval('RO-14', 'several spaces after the marker are all cut', withBody(OP, CA, TE, RE, ['-     **Commit:** m1.']), field('commit'), '**Commit:** m1.');
werr('RO-14', 'another marker character makes no list item', withBody(OP, CA, TE, RE, ['> **Commit:** m1.']), WF_ERR.commit);

defineTable('rule table of readRealOutput (AC-9, AC-10)', WORKFLOW_ROWS);

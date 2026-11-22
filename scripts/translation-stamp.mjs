// Stamp a Turkish content page with the current hash of its English source (TASK-004, ADR 0002 point 4).
//   npm run translation:stamp src/content/pages/tr/<name>.md
// The file's `translatedFrom.hash` becomes the contentHash of the English file named by `translatedFrom.page`; nothing else changes:
// every other key, comment, quote style, blank line, line ending and the body stay byte for byte, because only the value span of the
// hash line (or one inserted line) is edited, as text. Exit 0 stamped or unchanged, 1 refused (the path is named on stderr, nothing written), 2 usage.
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import { CONTENT_ROOT, contentHash } from '../src/lib/translations.ts';

class Refusal extends Error {}

const refuse = (message) => { throw new Refusal(message); };

/** The real path of an existing regular file under `dir` (a real directory path), or a refusal. */
function fileInside(arg, dir, what) {
  let real;
  try { real = realpathSync(resolve(arg)); } catch { return refuse(`${what} does not exist`); }
  const inside = relative(dir, real);
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) return refuse(`${what} is not inside ${CONTENT_ROOT}/${dir.split(sep).pop()}/`);
  if (!statSync(real).isFile()) return refuse(`${what} is not a file`);
  return real;
}

/** The text split into lines that keep their own line ending. */
const linesOf = (text) => text.split(/(?<=\n)/).filter((line) => line !== '');
const bare = (line) => line.replace(/\r?\n$/, '');
const endingOf = (line) => /\r?\n$/.exec(line)?.[0] ?? '';

/** The frontmatter text with the hash set, as text: only one value span changes, or one line is inserted after the `page:` line. */
function withHash(frontmatter, hash) {
  const lines = linesOf(frontmatter);
  const start = lines.findIndex((line) => /^translatedFrom:[ \t]*$/.test(bare(line)));
  if (start < 0) refuse('translatedFrom must be a block mapping (a "translatedFrom:" line with indented keys below it)');
  let end = start + 1;
  while (end < lines.length && (/^[ \t]+\S/.test(lines[end]) || bare(lines[end]).trim() === '')) end++;
  const quoted = `"${hash}"`;
  for (let i = start + 1; i < end; i++) {
    const match = /^([ \t]+hash:[ \t]*)("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s#]*)(.*)$/s.exec(lines[i]);
    if (!match) continue;
    if (match[2] === '') break; // "hash:" with no value: insert below
    lines[i] = match[1] + quoted + match[3];
    return lines.join('');
  }
  for (let i = start + 1; i < end; i++) {
    const match = /^([ \t]+)page:/.exec(lines[i]);
    if (!match) continue;
    const eol = endingOf(lines[i]) || '\n';
    if (endingOf(lines[i]) === '') lines[i] += eol;
    lines.splice(i + 1, 0, `${match[1]}hash: ${quoted}${eol}`);
    return lines.join('');
  }
  return refuse('translatedFrom has no page line');
}

function stamp(arg) {
  const cwd = realpathSync(process.cwd());
  const real = fileInside(arg, join(cwd, ...CONTENT_ROOT.split('/'), 'tr'), 'the path');
  if (!real.endsWith('.md')) refuse('the path is not a Markdown file');
  const original = readFileSync(real, 'utf8');

  const pieces = linesOf(original);
  const closing = pieces.findIndex((line, i) => i > 0 && bare(line) === '---');
  if (pieces.length === 0 || bare(pieces[0]) !== '---' || closing < 0) refuse('the file has no frontmatter between two "---" lines');
  const open = pieces[0];
  const frontmatter = pieces.slice(1, closing).join('');
  const rest = pieces.slice(closing).join('');

  let data;
  try { data = YAML.parse(frontmatter); } catch (error) { return refuse(`the frontmatter is not valid YAML: ${error.message}`); }
  const page = data?.translatedFrom?.page;
  if (typeof page !== 'string' || page === '') refuse('translatedFrom.page must name the English content file');
  const english = fileInside(page, join(cwd, ...CONTENT_ROOT.split('/'), 'en'), `translatedFrom.page "${page}"`);
  const hash = contentHash(readFileSync(english, 'utf8'));

  const edited = withHash(frontmatter, hash);
  const expected = structuredClone(data);
  expected.translatedFrom.hash = hash;
  let parsed;
  try { parsed = YAML.parse(edited); } catch { parsed = undefined; }
  if (!isDeepStrictEqual(parsed, expected)) refuse('the edited frontmatter does not read back as the original with only translatedFrom.hash set; nothing was written');

  const updated = open + edited + rest;
  if (updated === original) return 'unchanged';
  writeFileSync(real, updated, 'utf8');
  return 'stamped';
}

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('usage: npm run translation:stamp <path of a Turkish content file under src/content/pages/tr/>');
  process.exit(2);
}
try {
  console.log(`${stamp(args[0])} ${args[0]}`);
} catch (error) {
  if (!(error instanceof Refusal)) throw error;
  console.error(`translation-stamp: ${args[0]}: ${error.message}`);
  process.exit(1);
}

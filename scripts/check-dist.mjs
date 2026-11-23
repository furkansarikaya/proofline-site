// Static checks over a built tree (docs/design/ARCHITECTURE.md C21).
//   node scripts/check-dist.mjs links <dir>          every internal href/src of every page must resolve inside <dir>
//   node scripts/check-dist.mjs compare <a> <b>      the two trees must hold the same paths with the same contents
//   node scripts/check-dist.mjs determinism          two clean builds, then compare them
//   node scripts/check-dist.mjs guards <dir> [--probes <file>] [--pin <file>] [--cache <dir>]
//                                                    the install-time and README command guards (scripts/lib/guards.mjs) over
//                                                    the pages of <dir>; the defaults are the repository's PROBES.md, pin and cache
// Exit status: 0 pass, 1 check failed (or, in guards, an input error), 2 usage.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { checkGuards } from './lib/guards.mjs';
import { readPinFacts } from './lib/pin-facts.mjs';

const ORIGIN = 'http://dist.local';
const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every file under dir as POSIX relative paths, sorted by plain string comparison. */
export function listFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (statSync(join(dir, rel)).isDirectory()) out.push(...listFiles(dir, rel));
    else out.push(rel);
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** sha256 over the sorted `<path>\n<file sha256>\n` lines of a tree, with the per-file hashes. */
export function hashTree(dir) {
  const files = listFiles(dir).map((path) => ({ path, sha256: sha256(readFileSync(join(dir, path))) }));
  const tree = createHash('sha256');
  for (const f of files) tree.update(`${f.path}\n${f.sha256}\n`);
  return { digest: tree.digest('hex'), files };
}

/** Compare two trees; `lines` names every differing path, `nothing` is true when either tree has no file. */
export function compareTrees(a, b) {
  const left = hashTree(a);
  const right = hashTree(b);
  const lines = [`${a}: sha256 ${left.digest} (${left.files.length} files)`, `${b}: sha256 ${right.digest} (${right.files.length} files)`];
  if (left.files.length === 0 || right.files.length === 0) {
    lines.push('nothing to compare');
    return { equal: false, nothing: true, lines };
  }
  const leftMap = new Map(left.files.map((f) => [f.path, f.sha256]));
  const rightMap = new Map(right.files.map((f) => [f.path, f.sha256]));
  const all = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort();
  let different = 0;
  for (const path of all) {
    if (!leftMap.has(path)) { lines.push(`only in ${b}: ${path}`); different++; }
    else if (!rightMap.has(path)) { lines.push(`only in ${a}: ${path}`); different++; }
    else if (leftMap.get(path) !== rightMap.get(path)) { lines.push(`differs: ${path}`); different++; }
  }
  return { equal: different === 0 && left.digest === right.digest, nothing: false, lines };
}

/** The URL path a built page answers at: index.html is /, x/index.html is /x/, 404.html is /404.html. */
function pagePath(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

/** Whether an internal URL path resolves to a file of the tree. */
function resolves(dir, pathname) {
  const target = resolve(dir, `.${decodeURIComponent(pathname)}`);
  if (target !== resolve(dir) && !target.startsWith(resolve(dir) + sep)) return false;
  if (pathname.endsWith('/')) return existsSync(join(target, 'index.html'));
  if (/\.[^/]+$/.test(pathname.slice(pathname.lastIndexOf('/') + 1))) return existsSync(target) && statSync(target).isFile();
  return false; // trailing slash always (ADR 0002): an address without a slash or an extension is broken
}

/** Check every internal href and src of every HTML page under dir. */
export function checkLinks(dir) {
  const broken = [];
  let checked = 0;
  for (const rel of listFiles(dir).filter((f) => f.endsWith('.html'))) {
    const $ = load(readFileSync(join(dir, rel), 'utf8'));
    const values = $('[href], [src]').toArray().flatMap((el) => [el.attribs.href, el.attribs.src]).filter((v) => v !== undefined);
    for (const value of values) {
      if (value.trim() === '' || value.startsWith('#')) continue;
      let url;
      try { url = new URL(value, ORIGIN + pagePath(rel)); } catch { continue; }
      if (url.origin !== ORIGIN) continue;
      checked++;
      let ok = false;
      try { ok = resolves(dir, url.pathname); } catch { ok = false; }
      if (!ok) broken.push(`${rel} -> ${value}`);
    }
  }
  return { checked, broken };
}

function build() {
  const r = spawnSync('npm', ['run', 'build'], { cwd: repo, stdio: 'inherit' });
  if (r.status !== 0) {
    console.log(`determinism: build exited ${r.status}`);
    process.exit(1);
  }
}

function clean() {
  for (const d of ['dist', '.astro', 'node_modules/.astro']) rmSync(join(repo, d), { recursive: true, force: true });
}

/** Two clean builds, then compare; dist/ is left from the second build. */
function determinism() {
  const first = join(repo, '.cache', 'determinism', 'first');
  rmSync(first, { recursive: true, force: true });
  mkdirSync(dirname(first), { recursive: true });
  clean();
  build();
  renameSync(join(repo, 'dist'), first);
  clean();
  build();
  return compareTrees(first, join(repo, 'dist'));
}

const USAGE = 'usage: check-dist.mjs links <dir> | compare <a> <b> | determinism | guards <dir> [--probes <file>] [--pin <file>] [--cache <dir>]';
const GUARD_OPTIONS = ['--probes', '--pin', '--cache'];

/** The arguments of mode `guards`: one directory and each option at most once with a value; null on a usage error. */
function guardArgs(args) {
  const options = {};
  const dirs = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) { dirs.push(arg); continue; }
    const value = args[i + 1];
    if (!GUARD_OPTIONS.includes(arg) || arg in options || value === undefined || value.startsWith('--')) return null;
    options[arg] = value;
    i++;
  }
  if (dirs.length !== 1) return null;
  return {
    dir: dirs[0],
    probes: options['--probes'] === undefined ? join(repo, 'docs', 'product', 'site', 'PROBES.md') : resolve(options['--probes']),
    pin: options['--pin'] === undefined ? join(repo, 'sync', 'pin.json') : resolve(options['--pin']),
    cache: options['--cache'] === undefined ? join(repo, '.cache', 'sync') : resolve(options['--cache']),
  };
}

/** Mode `guards`: print the PB-3 state, the failure lines and the summary; 1 on a failure or an input error. Writes nothing. */
function guards({ dir, probes, pin, cache }) {
  let files = [];
  try { files = listFiles(dir); } catch { files = []; } // a regular file given as <dir> holds no page
  const pages = files.filter((f) => f.endsWith('.html')).map((rel) => ({ address: pagePath(rel), html: readFileSync(join(dir, rel), 'utf8') }));
  if (pages.length === 0) {
    console.log(`guards: no HTML page under ${dir}`);
    return 1;
  }
  let probesText;
  try {
    probesText = readFileSync(probes, 'utf8');
  } catch (error) {
    console.log(`guards: ${probes}: cannot be read (${error.code ?? error.message})`);
    return 1;
  }
  let result;
  try {
    result = checkGuards({ pages, probesText, loadFacts: () => readPinFacts(pin, cache) });
  } catch (error) {
    console.log(`guards: ${error.message}`);
    return 1;
  }
  for (const line of result.lines) console.log(line);
  return result.failures.length > 0 ? 1 : 0;
}

function main(argv) {
  const [command, ...args] = argv;
  if (command === 'links' && args.length === 1) {
    const { checked, broken } = checkLinks(args[0]);
    for (const line of broken) console.log(line);
    console.log(`links: ${checked} checked, ${broken.length} broken`);
    return broken.length > 0 || checked === 0 ? 1 : 0;
  }
  if (command === 'compare' && args.length === 2) {
    const result = compareTrees(args[0], args[1]);
    for (const line of result.lines) console.log(line);
    return result.equal ? 0 : 1;
  }
  if (command === 'determinism' && args.length === 0) {
    const result = determinism();
    for (const line of result.lines) console.log(line);
    console.log(result.equal ? 'determinism: the two builds are identical' : 'determinism: the two builds differ');
    return result.equal ? 0 : 1;
  }
  if (command === 'guards') {
    const parsed = guardArgs(args);
    if (parsed !== null) return guards(parsed);
  }
  console.error(USAGE);
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));

// Node tests for the design tokens, the self-hosted fonts and the base styles (TASK-003).
// The style tests read the source files; the build tests build once into a private output directory, so they never race tests/site.test.mjs, which removes and rebuilds dist/.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from 'cheerio';
import { ENV_KEYS } from '../src/lib/indexing.ts';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontsDir = join(root, 'public', 'fonts');
const sampleFontsDir = join(root, 'docs', 'design', 'references', 'direction-c', 'fonts');

sweepStale();
after(removeTempDirs);

/** Text of a file under the repository root, or '' when it is absent (so a missing file fails an assertion, not a crash). */
function read(rel) {
  const file = join(root, rel);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

/** Every file name under a folder of the repository that ends with one of the suffixes; recursive, POSIX relative paths. */
function walk(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

// ---- a small css reader ---------------------------------------------------------------------------------------------------------------

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');

/** Split `text` at `sep` where it is not inside parentheses. */
function splitTop(text, sep) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') depth -= 1;
    else if (text[i] === sep && depth === 0) { parts.push(text.slice(from, i)); from = i + 1; }
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

/** [[property, value], ...] of a declaration block. */
function parseDecls(body) {
  return splitTop(body, ';').map((d) => {
    const i = d.indexOf(':');
    return [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()];
  });
}

/** Flat list of { at: [wrapper conditions], selector, decls } from css text; media, supports, layer, container and keyframes blocks are unrolled (a keyframe step is a rule whose selector is its percentage), comments are dropped, and reading goes on after each of them. */
function parseCss(text) {
  const src = stripComments(text);
  let i = 0;
  function block() {
    const rules = [];
    while (i < src.length) {
      const open = src.indexOf('{', i);
      const close = src.indexOf('}', i);
      if (close !== -1 && (open === -1 || close < open)) { i = close + 1; return rules; }
      if (open === -1) break;
      // A statement at-rule (@import, @charset, a layer order list) ends at its semicolon and has no block of its own.
      const head = src.slice(i, open).trim().replace(/^(?:@[^{};]*;\s*)+/, '');
      i = open + 1;
      if (/^@(?:-[a-z]+-)?(media|supports|layer|container|keyframes)/i.test(head)) {
        const at = head.replace(/\s+/g, '');
        for (const r of block()) rules.push({ ...r, at: [at, ...r.at] });
      } else {
        const end = src.indexOf('}', i);
        rules.push({ at: [], selector: head, decls: parseDecls(src.slice(i, end)) });
        i = end + 1;
      }
    }
    return rules;
  }
  return block();
}

/** The media conditions on width found in css text (any width feature, any spelling), as the parser normalises them; other media features are not listed. */
function widthQueries(text) {
  return parseCss(text).flatMap((r) => r.at).filter((at) => at.startsWith('@media') && /width/i.test(at));
}

const selectors = (rule) => splitTop(rule.selector, ',').map((s) => s.replace(/["'\s]/g, ''));
const sameSelector = (rule, wanted) => selectors(rule).length === 1 && selectors(rule)[0] === wanted;
const declOf = (rule, prop) => rule.decls.filter(([p]) => p === prop).map(([, v]) => v).at(-1);
const nospace = (value) => String(value ?? '').replace(/\s+/g, '');
/** The numbers written with a px unit in a value. */
const pxNumbers = (value) => [...String(value ?? '').matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));

/** Red, green, blue, alpha of a hex or rgba() colour. */
function colour(value) {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{6})$/.exec(v);
  if (m) return [0, 2, 4].map((o) => parseInt(m[1].slice(o, o + 2), 16)).concat(1);
  m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/.exec(v);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  return null;
}

const TOKENS = ['--bg', '--surface', '--frame', '--ink', '--muted', '--accent', '--block', '--rule', '--grid', '--hatch'];

/** { '--bg': { light: 'value', dark: 'value' }, ... } from the Tokens table of DESIGN.md. */
function designTokens() {
  const table = {};
  for (const line of read('docs/design/DESIGN.md').split('\n')) {
    if (!line.startsWith('| `--')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const span = (cell) => /`([^`]+)`/.exec(cell)?.[1];
    table[span(cells[1])] = { light: span(cells[2]), dark: span(cells[3]) };
  }
  return table;
}

const tokensCss = () => parseCss(read('src/styles/tokens.css'));
const baseCss = () => parseCss(read('src/styles/base.css'));
const styleFiles = () => walk(join(root, 'src', 'styles')).filter((f) => f.endsWith('.css')).map((f) => `src/styles/${f}`);

const LIGHT = ':root';
const DARK_SYSTEM = ':root:not([data-theme=light])';
const LIGHT_ATTR = ':root[data-theme=light]';
const DARK_ATTR = ':root[data-theme=dark]';
const DARK_MEDIA = '@media(prefers-color-scheme:dark)';

/** { name: value } of the custom properties of the rule with this normalised selector and media condition, or null. */
function tokenRule(rules, selector, at) {
  const rule = rules.find((r) => sameSelector(r, selector) && r.at.join(' ') === at);
  if (rule === undefined) return null;
  return Object.fromEntries(rule.decls.filter(([p]) => p.startsWith('--')));
}

// ---- a small WOFF2 glyph reader (cmap formats 4 and 12) --------------------------------------------------------------------------------

const WOFF2_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

/** The set of code points that map to a glyph other than .notdef in the cmap table of a WOFF2 file. */
function woff2Codepoints(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'wOF2', 'a WOFF2 file begins with wOF2');
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  let pos = 48;
  const base128 = () => {
    let n = 0;
    for (let k = 0; k < 5; k += 1) {
      const b = buf[pos]; pos += 1;
      n = n * 128 + (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    return n;
  };
  const tables = [];
  let offset = 0;
  for (let t = 0; t < numTables; t += 1) {
    const flags = buf[pos]; pos += 1;
    const index = flags & 0x3f;
    const version = flags >> 6;
    let tag = WOFF2_TAGS[index];
    if (index === 63) { tag = buf.toString('latin1', pos, pos + 4); pos += 4; }
    const origLength = base128();
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    const length = transformed ? base128() : origLength;
    tables.push({ tag, offset, length });
    offset += length;
  }
  const data = brotliDecompressSync(buf.subarray(pos, pos + compressedSize));
  const cmapEntry = tables.find((t) => t.tag === 'cmap');
  assert.ok(cmapEntry, 'the font has a cmap table');
  const cmap = data.subarray(cmapEntry.offset, cmapEntry.offset + cmapEntry.length);
  const found = new Set();
  const records = cmap.readUInt16BE(2);
  for (let r = 0; r < records; r += 1) {
    const platform = cmap.readUInt16BE(4 + r * 8);
    const sub = cmap.readUInt32BE(8 + r * 8);
    if (platform !== 0 && platform !== 3) continue;
    const format = cmap.readUInt16BE(sub);
    if (format === 4) {
      const segs = cmap.readUInt16BE(sub + 6) / 2;
      const endAt = sub + 14;
      const startAt = endAt + segs * 2 + 2;
      const deltaAt = startAt + segs * 2;
      const rangeAt = deltaAt + segs * 2;
      for (let s = 0; s < segs; s += 1) {
        const end = cmap.readUInt16BE(endAt + s * 2);
        const start = cmap.readUInt16BE(startAt + s * 2);
        const delta = cmap.readUInt16BE(deltaAt + s * 2);
        const rangeOffset = cmap.readUInt16BE(rangeAt + s * 2);
        for (let c = start; c <= end && c < 0xffff; c += 1) {
          let glyph;
          if (rangeOffset === 0) glyph = (c + delta) & 0xffff;
          else {
            glyph = cmap.readUInt16BE(rangeAt + s * 2 + rangeOffset + (c - start) * 2);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) found.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g += 1) {
        const start = cmap.readUInt32BE(sub + 16 + g * 12);
        const end = cmap.readUInt32BE(sub + 20 + g * 12);
        const glyph = cmap.readUInt32BE(sub + 24 + g * 12);
        for (let c = start; c <= end; c += 1) if (glyph + (c - start) !== 0) found.add(c);
      }
    }
  }
  return found;
}

/** [[from, to], ...] of a unicode-range value. */
function unicodeRanges(value) {
  return value.split(',').map((part) => {
    const m = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(part.trim());
    assert.ok(m, `unicode-range part "${part}" is U+XXXX or U+XXXX-YYYY`);
    return [parseInt(m[1], 16), parseInt(m[2] ?? m[1], 16)];
  });
}

const FAMILIES = {
  'stack-sans-headline': 'Stack Sans Headline',
  'stack-sans-text': 'Stack Sans Text',
  'jetbrains-mono': 'JetBrains Mono',
};
const FONT_FILES = [
  'jetbrains-mono-latin-400', 'jetbrains-mono-latin-500', 'jetbrains-mono-latin-ext-400', 'jetbrains-mono-latin-ext-500',
  'stack-sans-headline-latin-400', 'stack-sans-headline-latin-ext-400',
  'stack-sans-text-latin-400', 'stack-sans-text-latin-500', 'stack-sans-text-latin-ext-400', 'stack-sans-text-latin-ext-500',
].map((n) => `${n}.woff2`);
const OFL_FILES = ['OFL-jetbrains-mono.txt', 'OFL-stack-sans-headline.txt', 'OFL-stack-sans-text.txt'];
const familyOf = (file) => FAMILIES[Object.keys(FAMILIES).find((k) => file.startsWith(`${k}-`))];

// ---- tokens ---------------------------------------------------------------------------------------------------------------------------

describe('tokens', () => {
  it('tokens.css holds the 10 DESIGN.md tokens with equal light and dark colours', () => {
    const table = designTokens();
    assert.deepEqual(Object.keys(table).sort(), [...TOKENS].sort(), 'the DESIGN.md table holds the 10 tokens');
    const rules = tokensCss();
    const sets = {
      light: tokenRule(rules, LIGHT, ''),
      dark: tokenRule(rules, DARK_ATTR, ''),
    };
    for (const mode of ['light', 'dark']) {
      assert.ok(sets[mode], `tokens.css has the ${mode} value rule`);
      assert.deepEqual(Object.keys(sets[mode]).sort(), [...TOKENS].sort(), `the ${mode} rule holds exactly the 10 tokens`);
      for (const name of TOKENS) {
        const want = colour(table[name][mode]);
        const have = colour(sets[mode][name]);
        assert.ok(want, `DESIGN.md ${name} ${mode} "${table[name][mode]}" is a colour`);
        assert.deepEqual(have, want, `${name} ${mode}: tokens.css "${sets[mode][name]}" equals DESIGN.md "${table[name][mode]}"`);
      }
    }
  });

  it('tokens.css switches light and dark by data-theme and by system setting', () => {
    const table = designTokens();
    const rules = tokensCss();
    const expectations = [
      ['light by default', LIGHT, '', 'light'],
      ['dark by system setting while data-theme is not light', DARK_SYSTEM, DARK_MEDIA, 'dark'],
      ['light by data-theme', LIGHT_ATTR, '', 'light'],
      ['dark by data-theme', DARK_ATTR, '', 'dark'],
    ];
    for (const [label, selector, at, mode] of expectations) {
      const set = tokenRule(rules, selector, at);
      assert.ok(set, `tokens.css has the rule for ${label}`);
      assert.deepEqual(Object.keys(set).sort(), [...TOKENS].sort(), `${label}: the 10 tokens are written out`);
      for (const name of TOKENS) {
        assert.match(set[name], /^(#[0-9a-fA-F]{3,6}|rgba\([0-9., ]+\))$/, `${label}: ${name} is a literal colour, never derived`);
        assert.deepEqual(colour(set[name]), colour(table[name][mode]), `${label}: ${name} holds the ${mode} value`);
      }
    }
  });
});

// ---- fonts ----------------------------------------------------------------------------------------------------------------------------

describe('fonts', () => {
  it('public/fonts holds ten woff2 files with the wOF2 signature and three OFL texts', () => {
    const names = existsSync(fontsDir) ? readdirSync(fontsDir).sort() : [];
    assert.deepEqual(names, [...FONT_FILES, ...OFL_FILES].sort(), 'public/fonts holds exactly the ten fonts and three licence texts');
    for (const file of FONT_FILES) {
      const bytes = readFileSync(join(fontsDir, file));
      assert.equal(bytes.toString('latin1', 0, 4), 'wOF2', `${file} begins with wOF2`);
      assert.ok(bytes.equals(readFileSync(join(sampleFontsDir, file))), `${file} is copied unchanged from the approved sample`);
    }
    for (const file of OFL_FILES) {
      const text = readFileSync(join(fontsDir, file), 'utf8');
      assert.ok(text.includes('SIL OPEN FONT LICENSE Version 1.1'), `${file} holds the licence title`);
      assert.equal(text, readFileSync(join(sampleFontsDir, file), 'utf8'), `${file} is copied unchanged from the approved sample`);
    }
  });

  it('each font family has glyphs for the twelve Turkish letters', () => {
    const letters = [...'ğĞşŞıİçÇöÖüÜ'];
    assert.equal(letters.length, 12);
    const glyphs = Object.fromEntries(FONT_FILES.map((file) => {
      const path = join(fontsDir, file);
      return [file, existsSync(path) ? woff2Codepoints(readFileSync(path)) : new Set()];
    }));
    // The reader itself is checked on a known font: it sees a Latin letter and does not see a Chinese character.
    const probe = glyphs['stack-sans-text-latin-400.woff2'];
    if (probe.size > 0) {
      assert.ok(probe.has('A'.codePointAt(0)), 'the reader finds the glyph of A');
      assert.ok(!probe.has(0x4e2d), 'the reader does not invent a glyph for a Chinese character');
    }
    for (const family of Object.values(FAMILIES)) {
      const files = FONT_FILES.filter((f) => familyOf(f) === family);
      for (const letter of letters) {
        assert.ok(files.some((f) => glyphs[f].has(letter.codePointAt(0))), `${family} has a glyph for ${letter} (U+${letter.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
      }
    }
  });

  it('base.css has one font-face rule per font file with the Turkish unicode ranges', () => {
    const faces = baseCss().filter((r) => r.selector === '@font-face');
    assert.equal(faces.length, FONT_FILES.length, 'one font-face rule per font file');
    const latin = [0xc7, 0xe7, 0xd6, 0xf6, 0xdc, 0xfc];
    const latinExt = [0x11e, 0x11f, 0x130, 0x131, 0x15e, 0x15f];
    for (const file of FONT_FILES) {
      const matching = faces.filter((r) => new RegExp(`url\\(\\s*["']?/fonts/${file.replace('.', '\\.')}["']?\\s*\\)`).test(declOf(r, 'src') ?? ''));
      assert.equal(matching.length, 1, `exactly one font-face rule has url(/fonts/${file})`);
      const rule = matching[0];
      assert.equal((declOf(rule, 'font-family') ?? '').replace(/["']/g, ''), familyOf(file), `${file}: font-family`);
      assert.equal(Number(declOf(rule, 'font-weight')), Number(/-(\d{3})\.woff2$/.exec(file)[1]), `${file}: font-weight`);
      assert.equal(declOf(rule, 'font-display'), 'swap', `${file}: font-display swap`);
      const ranges = unicodeRanges(declOf(rule, 'unicode-range') ?? '');
      const inRange = (cp) => ranges.some(([from, to]) => cp >= from && cp <= to);
      const wanted = file.includes('-latin-ext-') ? latinExt : latin;
      for (const cp of wanted) assert.ok(inRange(cp), `${file}: unicode-range includes U+${cp.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  });
});

// ---- typography, grid and bans --------------------------------------------------------------------------------------------------------

describe('base styles', () => {
  it('base.css sets the three font families on the right elements', () => {
    const rules = baseCss().filter((r) => r.selector !== '@font-face');
    const familyList = (rule) => splitTop(declOf(rule, 'font-family') ?? '', ',').map((f) => f.replace(/["']/g, ''));
    const headings = rules.find((r) => ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].every((h) => selectors(r).includes(h)));
    assert.ok(headings, 'a rule covers h1 to h6');
    assert.equal(familyList(headings)[0], 'Stack Sans Headline', 'headings use Stack Sans Headline');
    assert.ok(['sans-serif', 'system-ui'].includes(familyList(headings).at(-1)), 'the heading list ends with a generic family');
    assert.equal(declOf(headings, 'font-weight'), '400', 'headings are weight 400');
    const body = rules.find((r) => sameSelector(r, 'body'));
    assert.ok(body, 'a rule covers body');
    assert.equal(familyList(body)[0], 'Stack Sans Text', 'text uses Stack Sans Text');
    assert.ok(['sans-serif', 'system-ui'].includes(familyList(body).at(-1)), 'the text list ends with a generic family');
    assert.equal(declOf(body, 'font-weight'), '400', 'text is weight 400');
    assert.ok(rules.some((r) => declOf(r, 'font-weight') === '500' && !selectors(r).some((s) => /^h[1-6]$/.test(s))), 'some text rule is weight 500');
    const mono = rules.filter((r) => familyList(r).includes('JetBrains Mono'));
    assert.equal(mono.length, 1, 'JetBrains Mono is named in exactly one rule');
    assert.deepEqual(selectors(mono[0]).sort(), ['code', 'kbd', 'pre', 'samp'], 'JetBrains Mono is set on code, pre, kbd and samp only');
    assert.equal(familyList(mono[0]).at(-1), 'monospace', 'the mono list ends with the generic monospace family');
    const headingFamily = rules.filter((r) => familyList(r).includes('Stack Sans Headline'));
    assert.deepEqual(headingFamily, [headings], 'Stack Sans Headline is named in the heading rule only');
  });

  it('base.css defines the six type steps with the DESIGN.md values', () => {
    const rules = baseCss();
    const rootRules = rules.filter((r) => sameSelector(r, ':root') && r.at.length === 0);
    const step = (list, name) => list.map((r) => declOf(r, name)).filter((v) => v !== undefined).at(-1);
    const phone = rules.filter((r) => sameSelector(r, ':root') && r.at.join(' ') === '@media(max-width:820px)');
    const expected = {
      '--step-head': [34, 70],
      '--step-h2': [26, 36],
      '--step-lead': [17],
      '--step-body': [16, 17],
      '--step-small': [13.5, 15],
      '--step-mono': [13.5, 14],
    };
    for (const [name, px] of Object.entries(expected)) {
      const value = step(rootRules, name);
      assert.ok(value, `${name} is defined in :root`);
      assert.deepEqual(pxNumbers(value), px, `${name} px values in "${value}"`);
    }
    assert.match(step(rootRules, '--step-head'), /4\.9vw/, 'step-head scales with 4.9vw on desktop');
    const phoneHead = step(phone, '--step-head');
    assert.ok(phoneHead, 'step-head has a value for widths up to 820px');
    assert.deepEqual(pxNumbers(phoneHead), [28, 52], 'step-head is 28 to 52 px on a phone');
    assert.match(phoneHead, /8vw/, 'step-head scales with 8vw on a phone');
    assert.equal(Math.min(...pxNumbers(step(rootRules, '--step-body'))), 16, 'body never goes below 16px');
  });

  it('base.css themes the text selection and the scrollbar with tokens', () => {
    const rules = baseCss();
    const selection = rules.filter((r) => sameSelector(r, '::selection') && r.at.length === 0);
    assert.equal(selection.length, 1, 'one rule has ::selection as its only selector');
    assert.equal(nospace(declOf(selection[0], 'background-color')), 'var(--ink)', 'selected text takes the --ink ground');
    assert.equal(nospace(declOf(selection[0], 'color')), 'var(--bg)', 'selected text takes the --bg colour');
    const html = rules.filter((r) => sameSelector(r, 'html') && r.at.length === 0 && declOf(r, 'scrollbar-color') !== undefined);
    assert.equal(html.length, 1, 'the html rule sets scrollbar-color');
    assert.equal(declOf(html[0], 'scrollbar-color').replace(/\s+/g, ' ').trim(), 'var(--muted) var(--bg)', 'the scrollbar thumb is --muted on a --bg track');
    // The drawing is SVG text, painted with `fill` and not with `color`: its labels need a selection fill of their own, or selected text is ink on ink.
    const drawing = rules.filter((r) => sameSelector(r, '.pipelinetext::selection') && r.at.length === 0);
    assert.equal(drawing.length, 1, 'one rule has .pipeline text::selection as its only selector');
    assert.equal(nospace(declOf(drawing[0], 'fill')), 'var(--bg)', 'selected drawing text is filled with --bg, the colour of selected page text');
    for (const value of [declOf(selection[0], 'background-color'), declOf(selection[0], 'color'), declOf(html[0], 'scrollbar-color'), declOf(drawing[0], 'fill')]) {
      assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|rgba?\s*\(|gradient|url\s*\(/i, `"${value}" holds no literal colour, gradient or url`);
    }
  });

  it('base.css has a 12 column bordered grid, the two breakpoints and no radius, shadow or gradient', () => {
    const files = styleFiles();
    assert.ok(files.includes('src/styles/base.css') && files.includes('src/styles/tokens.css'), 'both style files exist');
    const rules = baseCss();
    const withDecl = (prop, test) => rules.filter((r) => r.decls.some(([p, v]) => p === prop && test(nospace(v))));
    assert.ok(withDecl('grid-template-columns', (v) => v.startsWith('repeat(12,')).length > 0, 'a rule has 12 grid columns');
    assert.ok(withDecl('max-width', (v) => v === '1400px').length > 0, 'a rule has max width 1400px');
    assert.ok(withDecl('padding', (v) => /^0(?:px)?20px$/.test(v)).length + withDecl('padding-inline', (v) => v === '20px').length > 0, 'a rule has 20px side gutters');
    const hairline = rules.filter((r) => r.decls.some(([p, v]) => /^border(-(left|right|inline|inline-start|inline-end))?$/.test(p) && nospace(v) === '1pxsolidvar(--grid)'));
    assert.ok(hairline.length >= 2, 'the grid hairlines are 1px borders in --grid');
    const media = new Set(rules.flatMap((r) => r.at));
    assert.ok(media.has('@media(max-width:820px)'), 'there is a 820px breakpoint');
    assert.ok(media.has('@media(max-width:1000px)'), 'there is a 1000px breakpoint');
    const stacked = rules.filter((r) => r.at.join(' ') === '@media(max-width:820px)' && nospace(declOf(r, 'grid-template-columns')) === '1fr');
    assert.ok(stacked.length > 0, 'below 820px the columns stack');
    const onlyBreakpoints = (text) => [...new Set(widthQueries(text))].filter((q) => q !== '@media(max-width:820px)' && q !== '@media(max-width:1000px)');
    for (const file of ['src/styles/base.css', 'src/styles/tokens.css']) assert.deepEqual(onlyBreakpoints(read(file)), [], `${file} has no width media query besides 820px and 1000px`);
    assert.deepEqual(onlyBreakpoints('a{x:y}@media (max-width: 900px){a{x:z}}'), ['@media(max-width:900px)'], 'an extra max-width breakpoint is caught');
    assert.deepEqual(onlyBreakpoints('@media (min-width: 821px){a{x:y}}'), ['@media(min-width:821px)'], 'a min-width query is caught');
    assert.deepEqual(onlyBreakpoints('@media (width <= 900px){a{x:y}}'), ['@media(width<=900px)'], 'a range syntax width query is caught');
    assert.deepEqual(onlyBreakpoints('@media (max-width: 820px){a{x:y}} @media (max-width:1000px){a{x:y}} @media (prefers-color-scheme: dark){a{x:y}}'), [], 'the two breakpoints and a colour scheme query are allowed');
    // A radius other than 0 or a box-shadow other than none, in any rule of a style text, including rules after a keyframes, layer or container block.
    const shapeViolations = (text) => parseCss(text).flatMap((rule) => rule.decls.flatMap(([prop, value]) => [
      ...(/^border(-[a-z]+)*-radius$/.test(prop) && !/^0(px)?$/.test(value) ? [`${prop}: ${value} in "${rule.selector}"`] : []),
      ...(prop === 'box-shadow' && value !== 'none' ? [`box-shadow: ${value} in "${rule.selector}"`] : []),
    ]));
    for (const file of files) {
      const text = stripComments(read(file));
      assert.doesNotMatch(text, /gradient\s*\(/i, `${file} has no gradient function`);
      assert.deepEqual(shapeViolations(text), [], `${file} has no radius and no shadow`);
    }
    assert.equal(shapeViolations('@keyframes k{0%{opacity:0}100%{opacity:1}}.a{border-radius:4px}').length, 1, 'a radius after a keyframes block is caught');
    assert.equal(shapeViolations('@keyframes k{0%{opacity:0}}@media (min-width:1px){.a{box-shadow:0 0 2px #000}}').length, 1, 'a shadow after a keyframes block is caught');
    assert.equal(shapeViolations('@layer base{.a{border-radius:4px}}').length, 1, 'a radius inside a layer block is caught');
    assert.equal(shapeViolations('@container (min-width:1px){.a{box-shadow:0 0 2px #000}}.b{border-radius:0}').length, 1, 'a shadow inside a container block is caught');
    assert.deepEqual(shapeViolations('@keyframes k{0%{opacity:0}}.a{border-radius:0;box-shadow:none}'), [], 'a radius 0 and a shadow none after a keyframes block pass');
  });

  it('the two block colour values appear only in tokens.css and var block only in the one diagram rule', () => {
    const components = walk(join(root, 'src', 'components')).filter((f) => f.endsWith('.astro')).map((f) => `src/components/${f}`);
    const files = [...styleFiles(), 'src/layouts/Base.astro', ...components];
    assert.ok(files.includes('src/styles/tokens.css') && files.includes('src/styles/base.css'), 'both style files exist');
    const tokens = stripComments(read('src/styles/tokens.css')).toLowerCase();
    assert.ok(tokens.includes('#c4152b') && tokens.includes('#e0354a'), 'tokens.css holds both block values');
    for (const file of files.filter((f) => f !== 'src/styles/tokens.css')) {
      const text = read(file).toLowerCase();
      assert.ok(!text.includes('#c4152b') && !text.includes('#e0354a'), `${file} holds neither block value`);
    }
    // The red-rule of DESIGN-marketing R-1: the block token is used by the fill of the blocked slab of the diagram, in one rule, and by nothing else.
    const uses = (text) => parseCss(text).filter((r) => r.decls.some(([, v]) => /var\(\s*--block\b/.test(v)));
    const found = [];
    for (const file of files) {
      const text = read(file);
      if (file.endsWith('.css')) for (const rule of uses(text)) found.push({ file, rule });
      else assert.doesNotMatch(stripComments(text), /var\(\s*--block\b/, `${file} does not use var(--block)`);
    }
    assert.equal(found.length, 1, `var(--block) is used by exactly one rule, found ${found.map((f) => `${f.file} "${f.rule.selector}"`).join(', ') || 'none'}`);
    const [{ file, rule }] = found;
    assert.equal(file, 'src/styles/pipeline.css', 'the one use is in src/styles/pipeline.css');
    assert.match(rule.selector, /pipeline-state-blocked/, 'the one use is the blocked-slab rule');
    assert.deepEqual(rule.decls.filter(([, v]) => /var\(\s*--block\b/.test(v)).map(([p]) => p), ['fill'], 'the one use is a fill');
    assert.equal(uses('.a{fill:var(--block)}.b{stroke:var(--block)}').length, 2, 'a second use is counted');
    assert.equal(uses('.a{fill:var(--accent)}/* var(--block) */').length, 0, 'a comment is not a use');
    assert.equal(uses('.a{fill:var(--accent)}@keyframes k{0%{opacity:0}100%{opacity:1}}.b{fill:var(--block)}').length, 1, 'a use after a keyframes block is counted');
    assert.equal(uses('@keyframes k{0%{opacity:0}}@media (prefers-reduced-motion:no-preference){.a{fill:var(--block)}}@layer x{.b{stroke:var(--block)}}').length, 2, 'uses after a keyframes block, in a media block and in a layer block are counted');
    assert.equal(uses('@container (min-width:1px){.a{fill:var(--block)}}').length, 1, 'a use in a container block is counted');
  });
});

// ---- the built site -------------------------------------------------------------------------------------------------------------------

describe('built site', () => {
  let outDir = '';
  let build = { status: -1, stderr: '' };

  before(() => {
    outDir = join(makeTempDir('proofline-site-'), 'dist');
    // The scan reads a closed build whatever the shell exports: the four indexing variables are removed from the inherited environment.
    const env = { ...process.env };
    for (const key of ENV_KEYS) delete env[key];
    // The home pages read the pin facts of the pinned documents while they are built (TASK-019), so the fetch comes first, as in `npm run build`.
    const fetched = spawnSync(process.execPath, [join(root, 'scripts', 'sync.mjs'), 'fetch'], { cwd: root, encoding: 'utf8', env });
    const r = fetched.status === 0
      ? spawnSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build', '--outDir', outDir], { cwd: root, encoding: 'utf8', env })
      : fetched;
    build = { status: r.status, stderr: `${fetched.stdout ?? ''}${fetched.stderr ?? ''}${r.stdout ?? ''}${r.stderr ?? ''}` };
  }, { timeout: 120000 });

  const pages = () => walk(outDir).filter((f) => f.endsWith('.html'));

  // The page head of TASK-004 and TASK-006 prints absolute addresses that name the site, not a resource to load: the og:* content, the
  // link rel="alternate" hrefs, the link rel="canonical" href and the JSON-LD block. Only these four are removed before the host scan of a built page;
  // any other http(s) address in a built page (a stylesheet, script, image or font from another host) still fails.
  const withoutHeadMetadata = (html) => {
    const $ = load(html);
    $('script[type="application/ld+json"]').remove();
    $('meta[property^="og:"]').removeAttr('content');
    $('link[rel="alternate"]').removeAttr('href');
    $('link[rel="canonical"]').removeAttr('href');
    return $.html();
  };

  // The repository navigation links (ADR 0006 point 3, the footer, and DESIGN-marketing R-5 and R-6 for the home page): `a` elements whose address is exactly
  // one of the repository addresses: the two repositories, the LICENSE, and the README (Status) and the workflow page (Real output) at the pinned commit.
  // Only their href is skipped; a resource address (src, stylesheet href) or any other address stays in the scan (ADR 0008 point 4).
  const REPOSITORY_LINK = /^https:\/\/github\.com\/furkansarikaya\/(?:proofline|proofline-site|proofline\/blob\/(?:[0-9a-f]{40}|main)\/LICENSE|proofline\/blob\/[0-9a-f]{40}\/README\.md#status|proofline\/blob\/[0-9a-f]{40}\/docs\/concepts\/workflow\.md#real-output)$/;
  const withoutRepositoryLinks = (html) => {
    const $ = load(html);
    $('a[href]').filter((_, el) => REPOSITORY_LINK.test(el.attribs.href)).removeAttr('href');
    return $.html();
  };

  // The README clone line of the Codex part (TASK-021 AC-2) is a command, not a resource: on the two get-started pages only, a line of a command block (a `pre` with
  // lang="en" and translate="no") that equals the README line exactly is removed before the scan. The same text anywhere else (a paragraph, an inline code, a `pre` that
  // is not a command block, another page), another host or any other line of the block stays in the scan.
  const CLONE_LINE = 'git clone https://github.com/furkansarikaya/proofline';
  const CLONE_PAGES = new Set(['dist/get-started/index.html', 'dist/tr/baslarken/index.html']);
  const withoutCloneLine = (name, html) => {
    if (!CLONE_PAGES.has(name)) return html;
    const $ = load(html);
    $('pre[lang="en"][translate="no"]').each((_, pre) => {
      const lines = $(pre).text().split('\n');
      if (lines.includes(CLONE_LINE)) $(pre).text(lines.filter((line) => line !== CLONE_LINE).join('\n'));
    });
    return $.html();
  };

  it('styles and dist hold no external host, no import and no foreign url', { timeout: 120000 }, () => {
    assert.equal(build.status, 0, `the private build exits 0: ${build.stderr.slice(-400)}`);
    const probe = withoutHeadMetadata([
      '<html><head>',
      '<meta property="og:image" content="https://proofline.technology/og-default.png">',
      '<link rel="alternate" hreflang="en" href="https://proofline.technology/">',
      '<link rel="canonical" href="https://proofline.technology/">',
      '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
      '<link rel="stylesheet" href="https://cdn.example/a.css"><img src="http://img.example/b.png" alt="">',
      '<link rel="alternate stylesheet" href="https://cdn.example/c.css"><meta name="x" content="https://cdn.example/d">',
      '</head><body></body></html>',
    ].join(''));
    assert.doesNotMatch(probe, /proofline\.technology|schema\.org/, 'the og content, the alternate and canonical hrefs and the JSON-LD block are skipped');
    const repositoryProbe = withoutRepositoryLinks([
      '<a href="https://github.com/furkansarikaya/proofline">a</a>',
      '<a href="https://github.com/furkansarikaya/proofline-site">b</a>',
      `<a href="https://github.com/furkansarikaya/proofline/blob/${'0123456789abcdef'.repeat(2)}01234567/LICENSE">c</a>`,
      '<a href="https://github.com/furkansarikaya/proofline/blob/main/LICENSE">d</a>',
      `<a href="https://github.com/furkansarikaya/proofline/blob/${'0123456789abcdef'.repeat(2)}01234567/README.md#status">j</a>`,
      `<a href="https://github.com/furkansarikaya/proofline/blob/${'0123456789abcdef'.repeat(2)}01234567/docs/concepts/workflow.md#real-output">k</a>`,
      '<a href="https://github.com/furkansarikaya/proofline/blob/main/README.md#status">l</a>',
      '<a href="https://github.com/furkansarikaya/other">e</a>',
      '<a href="https://github.com/furkansarikaya/proofline/archive/main.zip">f</a>',
      '<a href="http://github.com/furkansarikaya/proofline">g</a>',
      '<a href="https://github.com/furkansarikaya/proofline?x=1">h</a>',
      '<a href="https://github.com/furkansarikaya/proofline/blob/xyz/LICENSE">i</a>',
      '<link rel="stylesheet" href="https://github.com/furkansarikaya/proofline">',
      '<img src="https://github.com/furkansarikaya/proofline" alt="">',
    ].join(''));
    assert.equal(repositoryProbe.match(/https?:\/\/github\.com\/[^"]*/g)?.length, 8, 'the exact addresses are skipped and every other github address stays in the scan');
    for (const kept of ['furkansarikaya/other', 'archive/main.zip', 'http://github.com/furkansarikaya/proofline"', 'proofline?x=1', 'blob/xyz/LICENSE', 'blob/main/README.md#status']) {
      assert.ok(repositoryProbe.includes(kept), `a repository-like address stays in the scan: ${kept}`);
    }
    assert.ok(/<link[^>]*href="https:\/\/github\.com\/furkansarikaya\/proofline"/.test(repositoryProbe), 'a stylesheet link to the repository stays in the scan');
    assert.ok(/<img[^>]*src="https:\/\/github\.com\/furkansarikaya\/proofline"/.test(repositoryProbe), 'an image from the repository stays in the scan');
    for (const skipped of ['>a<', '>b<', '>c<', '>d<', '>j<', '>k<']) assert.ok(repositoryProbe.includes(skipped), `the link text ${skipped} is kept`);
    assert.equal(/href="https:\/\/github\.com\/furkansarikaya\/proofline\/blob\/[0-9a-f]{40}\/(?:README\.md#status|docs\/concepts\/workflow\.md#real-output)"/.test(repositoryProbe), false, 'the pinned README and workflow links lose their href');
    assert.equal(/href="https:\/\/github\.com\/furkansarikaya\/proofline(?:-site)?"[^>]*>(?:a|b)</.test(repositoryProbe), false, 'the exact repository links lose their href');
    for (const kept of ['https://cdn.example/a.css', 'http://img.example/b.png', 'https://cdn.example/c.css', 'https://cdn.example/d']) {
      assert.ok(probe.includes(kept), `any other address stays in the scan: ${kept}`);
    }
    // The clone-line allowance, on probe pages: only the exact README line inside a command block of a get-started page leaves the scan.
    const INSTALL_LINE = 'node proofline/adapters/codex/install.mjs';
    const block = (text, attributes = ' lang="en" translate="no"') => `<html><head></head><body><pre class="gs-call"${attributes}><code>${text}</code></pre></body></html>`;
    for (const name of CLONE_PAGES) {
      const skipped = withoutCloneLine(name, block(`${CLONE_LINE}\n${INSTALL_LINE}`));
      assert.doesNotMatch(skipped, /https?:\/\//, `${name}: the clone line inside a command block is skipped`);
      assert.ok(skipped.includes(INSTALL_LINE), `${name}: the other lines of the block stay in the scan`);
    }
    const cloneKept = [
      ['dist/get-started/index.html', `<html><body><p>${CLONE_LINE}</p></body></html>`, 'the clone line in a paragraph'],
      ['dist/get-started/index.html', `<html><body><p><code lang="en" translate="no">${CLONE_LINE}</code></p></body></html>`, 'the clone line in an inline code'],
      ['dist/get-started/index.html', block(CLONE_LINE, ''), 'the clone line in a pre without lang and translate'],
      ['dist/get-started/index.html', block(CLONE_LINE, ' lang="en"'), 'the clone line in a pre without translate="no"'],
      ['dist/tr/baslarken/index.html', block(CLONE_LINE, ' translate="no"'), 'the clone line in a pre without lang="en"'],
      ['dist/get-started/index.html', block('git clone https://gitlab.com/furkansarikaya/proofline'), 'the clone line with another host'],
      ['dist/get-started/index.html', block('git clone https://github.com/furkansarikaya/other'), 'the clone line of another repository'],
      ['dist/get-started/index.html', block(`${CLONE_LINE} extra`), 'the clone line with more text on the line'],
      ['dist/tr/baslarken/index.html', block(`${CLONE_LINE}\ncurl https://example.com/install.sh`), 'another address in the same command block'],
      ['dist/get-started/index.html', block(CLONE_LINE).replace('</body>', '<a href="https://example.com/">x</a></body>'), 'a link to another host on the same page'],
      ['dist/index.html', block(CLONE_LINE), 'the clone line in a command block of another page'],
      ['dist/404.html', block(CLONE_LINE), 'the clone line in a command block of the not-found page'],
      ['dist/get-started/other/index.html', block(CLONE_LINE), 'the clone line in a command block below a get-started address'],
    ];
    for (const [name, html, what] of cloneKept) assert.match(withoutCloneLine(name, html), /https?:\/\//, `${what} stays in the scan`);
    for (const name of CLONE_PAGES) {
      const rel = name.slice('dist/'.length);
      const $ = load(existsSync(join(outDir, rel)) ? readFileSync(join(outDir, rel), 'utf8') : '');
      assert.ok($('pre[lang="en"][translate="no"]').toArray().some((pre) => $(pre).text().split('\n').includes(CLONE_LINE)), `${name} holds the clone line the scan skips in a command block`);
    }
    for (const rel of ['index.html', 'tr/index.html']) {
      const raw = existsSync(join(outDir, rel)) ? readFileSync(join(outDir, rel), 'utf8') : '';
      for (const needed of [
        'property="og:image" content="https://proofline.technology/og-default.png"', 'rel="alternate"', 'application/ld+json',
        'href="https://github.com/furkansarikaya/proofline"', 'href="https://github.com/furkansarikaya/proofline-site"', '/LICENSE"',
        '/README.md#status"', '/docs/concepts/workflow.md#real-output"',
      ]) {
        assert.ok(raw.includes(needed), `dist/${rel} holds the head metadata the scan skips: ${needed}`);
      }
    }
    const files = [
      ...styleFiles().map((f) => [f, read(f)]),
      ['src/layouts/Base.astro', read('src/layouts/Base.astro')],
      ...walk(outDir).filter((f) => /\.(css|html)$/.test(f)).map((f) => [`dist/${f}`, readFileSync(join(outDir, f), 'utf8')]),
    ];
    assert.ok(files.some(([f]) => f.endsWith('.css') && f.startsWith('dist/')), 'the build emitted a stylesheet');
    assert.ok(files.length >= 7, 'the scan read the sources and the built files');
    for (const [name, raw] of files) {
      const text = name.endsWith('.css') ? stripComments(raw) : name.endsWith('.html') ? withoutCloneLine(name, withoutRepositoryLinks(withoutHeadMetadata(raw))) : raw;
      assert.doesNotMatch(text, /https?:\/\//i, `${name} names no host`);
      assert.doesNotMatch(text, /@import/i, `${name} has no @import`);
      for (const m of text.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/gi)) {
        assert.ok(m[2].startsWith('/fonts/') || m[2].startsWith('/_astro/'), `${name}: url(${m[2]}) starts with /fonts/ or /_astro/`);
      }
    }
  });

  it('built home pages link one same-origin stylesheet and hold no inline style', { timeout: 120000 }, async () => {
    const layout = read('src/layouts/Base.astro');
    const tokensAt = layout.search(/import\s+['"]\.\.\/styles\/tokens\.css['"]/);
    const baseAt = layout.search(/import\s+['"]\.\.\/styles\/base\.css['"]/);
    assert.ok(tokensAt >= 0, 'Base.astro imports ../styles/tokens.css');
    assert.ok(baseAt > tokensAt, 'Base.astro imports ../styles/base.css after tokens.css');
    const componentsAt = layout.search(/import\s+['"]\.\.\/styles\/components\.css['"]/);
    assert.ok(componentsAt > baseAt, 'Base.astro imports ../styles/components.css after base.css');
    const pipelineAt = layout.search(/import\s+['"]\.\.\/styles\/pipeline\.css['"]/);
    const homeAt = layout.search(/import\s+['"]\.\.\/styles\/home\.css['"]/);
    assert.ok(pipelineAt > componentsAt, 'Base.astro imports ../styles/pipeline.css after components.css');
    assert.ok(homeAt > pipelineAt, 'Base.astro imports ../styles/home.css after pipeline.css');
    const getStartedAt = layout.search(/import\s+['"]\.\.\/styles\/get-started\.css['"]/);
    assert.ok(getStartedAt > homeAt, 'Base.astro imports ../styles/get-started.css after home.css');
    for (const name of ['Header', 'Footer', 'CommandBlock', 'Home', 'Hero', 'Steps', 'RealOutput', 'Limits', 'GetStarted']) {
      assert.ok(read(`src/components/marketing/${name}.astro`) !== '', `${name}.astro exists`);
      assert.doesNotMatch(read(`src/components/marketing/${name}.astro`), /import\s+['"][^'"]*\.css['"]/, `${name}.astro imports no stylesheet, Base.astro bundles the one`);
    }
    const config = (await import(pathToFileURL(join(root, 'astro.config.mjs')).href)).default;
    assert.equal(config.build.inlineStylesheets, 'never', 'astro.config.mjs sets build.inlineStylesheets to never');
    assert.equal(config.build.format, 'directory', 'the existing build format is kept');
    assert.equal(build.status, 0, `the private build exits 0: ${build.stderr.slice(-400)}`);
    for (const rel of ['index.html', 'tr/index.html', 'get-started/index.html', 'tr/baslarken/index.html']) {
      assert.ok(existsSync(join(outDir, rel)), `${rel} is built`);
      const $ = load(readFileSync(join(outDir, rel), 'utf8'));
      const links = $('link[rel~=stylesheet]').toArray();
      assert.equal(links.length, 1, `${rel} links exactly one stylesheet`);
      const href = links[0].attribs.href;
      assert.match(href, /^\/(?!\/)[^:]*\.css$/, `${rel}: the stylesheet "${href}" is a same-origin path`);
      assert.ok(existsSync(join(outDir, href)), `${rel}: ${href} exists in the build`);
    }
    for (const rel of pages()) {
      const $ = load(readFileSync(join(outDir, rel), 'utf8'));
      assert.equal($('style').length, 0, `${rel} has no style element`);
      assert.equal($('[style]').length, 0, `${rel} has no style attribute`);
    }
  });
});

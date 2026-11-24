// Node tests for the Markdown transform and sanitizer (TASK-008, C16 scripts/lib/transform.mjs): the cross-site-scripting boundary of the synced documents.
// One rule table per unit U1 to U8 of design/ARCHITECTURE.md, each row its own test. The assertions over the output parse it with cheerio and count elements and
// attributes: that is how a test observes the result, and it does not make the safety of the transform depend on a search over its output.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from 'cheerio';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { assertSafeHast, isSafeUrl, renderMarkdown, renderTree, transformDocument } from '../scripts/lib/transform.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(root, 'tests', 'fixtures', 'transform');
const MODULE = join(root, 'scripts', 'lib', 'transform.mjs');
const PATH = 'docs/test.md';
const BLOB = '63606a83788971a1ada89515bb008c32cc701e2b';
const HEADER = `<!-- translated-from: docs/guides/daily-use.md; blob: ${BLOB} -->`;

/** Words that are in no allowlist of the transform: element names, node types and alignments that a widened set could take in. */
const STRANGE_WORDS = ['span', 'script', 'paragraphs', 'img', 'i', 'div', 'b', 'ftp', 'justify', 'none', 'auto', 'initial', 'inherit', 'baseline', 'bottom', 'x', 'left right', 'center center', 'a1', 'null', 'undefined', 'true', 'false'];
const PRINTABLE = Array.from({ length: 95 }, (_, i) => String.fromCharCode(0x20 + i));

// Characters outside printable ASCII for the closed-world rows of the classes of every unit (header, frontmatter, URL).
// One character of every Unicode general category (checked below), then the ranges that a widened class would most likely take in: the C0 and C1 controls, the Latin-1
// block, the general punctuation block, the variation selectors, the specials, the full-width forms and the astral planes.
const CATEGORY = { Lu: '\u00c9', Ll: '\u00e9', Lt: '\u01c5', Lm: '\u02b0', Lo: '\u05d0', Mn: '\u0300', Mc: '\u0903', Me: '\u0488', Nd: '\u0660', Nl: '\u2160', No: '\u00b2', Pc: '\u203f', Pd: '\u2010', Ps: '\u2768', Pe: '\u2769',
  Pi: '\u00ab', Pf: '\u00bb', Po: '\u00a1', Sm: '\u00d7', Sc: '\u20ac', Sk: '\u02c2', So: '\u00a9', Zs: '\u3000', Zl: '\u2028', Zp: '\u2029', Cc: '\u0085', Cf: '\u200b', Cs: '\ud800', Co: '\ue000', Cn: '\u0378' };
const ASTRAL = ['\u{10000}', '\u{1d400}', '\u{1d7ce}', '\u{1f600}', '\u{20000}', '\u{e0001}', '\u{e0100}', '\u{f0000}', '\u{100000}', '\u{10ffff}'];
const LOOKALIKES = ['\u2044', '\u2215', '\u2216', '\u29f8', '\u1735', '\u2024', '\u2025', '\ufe52', '\uff0e', '\uff3f', '\ufe4d', '\u2012', '\u2013', '\u2014', '\u2212', '\ufe63', '\uff0d', '\u00ad', '\u2011', '\u037e', '\uff1b', '\uff1a', '\ua789'];
const between = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i));
// A few of the full-width forms, the CJK punctuation, letters and symbols of the East Asian blocks: one member of a block stands for the block, since a widened class takes in a block whole.
const FULL_AND_CJK = ['\uff10', '\uff21', '\uff41', '\uff5e', '\uff9f', '\uffe0', '\u3001', '\u3002', '\u300c', '\u3042', '\u30a2', '\u4e2d', '\uac00', '\u2e80', '\ua000'];
// The rest of the Latin-1 block and of the general punctuation block: the members that a widened class is likely to take in, the edges of each run among them (the C1 controls are all in).
const LATIN1 = ['\u00a9', '\u00aa', '\u00ad', '\u00b2', '\u00b5', '\u00b7', '\u00bb', '\u00bf', '\u00c0', '\u00d7', '\u00df', '\u00e9', '\u00f7', '\u00ff'];
const PUNCTUATION = ['\u2018', '\u201c', '\u2020', '\u2026', ...between(0x2028, 0x202f), '\u2030', '\u2044', '\u205f', ...between(0x2060, 0x206f)];
const ODD_SPACES = ['\u1680', '\u180e', '\u202f', '\u205f', '\u2007', '\u200a'];
const IGNORABLE = ['\u034f', '\u061c', '\u115f', '\u1160', '\u17b4', '\u17b5', ...between(0x180b, 0x180f), '\u2800', '\u3164', '\uffa0', '\u{e0020}', '\u{e007f}', ...between(0x1d173, 0x1d17a)];
const SWEEP = [...new Set([...Object.values(CATEGORY), ...ASTRAL, ...LOOKALIKES, ...ODD_SPACES, ...IGNORABLE, ...between(0x00, 0x1f), '\u007f', ...between(0x80, 0xa1), ...LATIN1, ...between(0x2000, 0x2015), ...PUNCTUATION, '\ufe00', '\ufe0f', '\ufeff',
  ...between(0xfff9, 0xffff), ...FULL_AND_CJK])];
// The characters that `\s` of a regular expression matches (ECMAScript WhiteSpace and LineTerminator).
const JS_SPACE = new Set(['\t', '\n', '\v', '\f', '\r', ' ', '\u00a0', '\u1680', ...between(0x2000, 0x200a), '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff']);
const label = (ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
/** Four hex digits of a UTF-16 code unit (test names). */
const hex4 = (code) => code.toString(16).toUpperCase().padStart(4, '0');
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8');
/** The sections of node-kinds.md: a line `%%% name` starts one; each is a document of its own. */
const sections = (name) => {
  const parts = fixture(name).split(/^%%% (.+)\n/m).slice(1);
  return new Map(Array.from({ length: parts.length / 2 }, (_, i) => [parts[2 * i], parts[2 * i + 1]]));
};
const doc = (source, options) => transformDocument(PATH, source, options);
const dom = (html) => load(html, null, false);
/** The visible text of an HTML fragment (entities decoded, tags gone). */
const visible = (html) => dom(html).root().text();
const squash = (text) => text.replace(/\s+/g, ' ').trim();
/** The names of all attributes of all elements of a fragment. */
const attributeNames = ($) => $('*').toArray().flatMap((el) => Object.keys(el.attribs ?? {}));
/** The values of all attributes of all elements of a fragment. */
const attributeValues = ($) => $('*').toArray().flatMap((el) => Object.values(el.attribs ?? {}));
const FORBIDDEN = 'script, iframe, object, embed, style, img, input, div, span, details, kbd, svg, form, button';
const parse = (source) => unified().use(remarkParse).use(remarkGfm).parse(source);
const inline = (source) => parse(source).children[0].children;
const paragraphs = (name) => fixture(name).trimEnd().split('\n\n');
/** The error a call throws (a test fails when it does not throw). */
const thrown = (fn) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return assert.fail('expected the call to throw');
};
/** The value a call returns (a test that gets an error instead fails on an assertion that names it). */
const accepted = (fn) => {
  try {
    return fn();
  } catch (error) {
    return assert.fail(`the call was refused: ${error.message}`);
  }
};

// ---- AS-7: the parser behaviours the design relies on (RED-1 to RED-6), asserted on the installed packages and on what the transform makes of them ----------------

describe('AS-7 parser contract', () => {
  it('RED-1 autolink literals are link nodes and are rendered', () => {
    const nodes = inline('see www.example.com and https://example.com and a@example.com');
    assert.deepEqual(nodes.filter((n) => n.type === 'link').map((n) => n.url), ['http://www.example.com', 'https://example.com', 'mailto:a@example.com']);
    const result = doc('see www.example.com and https://example.com and a@example.com');
    assert.deepEqual(result.links.map((l) => [l.kind, l.url, l.rendered]), [['link', 'http://www.example.com', true], ['link', 'https://example.com', true], ['link', 'mailto:a@example.com', true]]);
    assert.deepEqual(dom(result.html)('a').toArray().map((a) => a.attribs.href), ['http://www.example.com', 'https://example.com', 'mailto:a@example.com']);
  });

  it('RED-2 task markers: checked is a boolean on the item and the marker is shown as text first', () => {
    const list = parse('- [x] done\n- [ ] open\n- [X] big').children[0];
    assert.deepEqual(list.children.map((item) => item.checked), [true, false, true]);
    assert.equal(list.children[0].children[0].children[0].value, 'done');
    const { html } = doc('- [x] done\n- [ ] open\n- [X] big');
    assert.equal(dom(html)('input').length, 0);
    assert.deepEqual(dom(html)('li').toArray().map((li) => dom(html)(li).text()), ['[x] done', '[ ] open', '[x] big']);
  });

  it('RED-3 a reference without a definition is not made by the parser and stays text', () => {
    const nodes = inline('[x][nope] and [y]');
    assert.deepEqual(nodes.map((n) => n.type), ['text']);
    const { html, links } = doc('[x][nope] and [y]');
    assert.equal(visible(html), '[x][nope] and [y]');
    assert.equal(dom(html)('a').length, 0);
    assert.deepEqual(links, []);
  });

  it('RED-4 the parser does not count a leading U+FEFF in its offsets, and the transform keeps its slices aligned', () => {
    const withBom = inline('\uFEFFhello <b>x</b>');
    const without = inline('hello <b>x</b>');
    assert.deepEqual(withBom.map((n) => [n.type, n.position.start.offset, n.position.end.offset]), without.map((n) => [n.type, n.position.start.offset, n.position.end.offset]));
    const { html } = doc('\uFEFFSee <path:line> now');
    assert.equal(visible(html), 'See <path:line> now');
  });

  it('RED-5 inline html placeholders, an autolink for path:line and block html are the node types the pass handles', () => {
    assert.deepEqual(inline('a <slug> b <kbd>x</kbd> c <TASK> d').filter((n) => n.type === 'html').map((n) => n.value), ['<slug>', '<kbd>', '</kbd>', '<TASK>']);
    const [autolink] = inline('<path:line>');
    assert.deepEqual([autolink.type, autolink.url], ['link', 'path:line']);
    assert.deepEqual(parse('<div>\nhi\n</div>\n\n<details>\n<summary>s</summary>\n</details>').children.map((n) => n.type), ['html', 'html']);
    const { html } = doc('a <slug> b <kbd>x</kbd> c <TASK> d\n\n<path:line>\n\n<div>\nhi\n</div>');
    assert.equal(squash(visible(html)), 'a <slug> b <kbd>x</kbd> c <TASK> d <path:line> <div> hi </div>');
    assert.equal(dom(html)(FORBIDDEN).length, 0);
  });

  it('RED-6 the parser decodes a character reference in a link target before the safety check', () => {
    assert.equal(inline('[x](java&#x73;cript:alert(1))')[0].url, 'javascript:alert(1)');
    const { html, links } = doc('[x](java&#x73;cript:alert(1))');
    assert.equal(dom(html)('a').length, 0);
    assert.equal(visible(html), 'x');
    assert.deepEqual(links.map((l) => [l.url, l.rendered]), [['javascript:alert(1)', false]]);
  });
});

// ---- AC-1 to AC-14: one test per criterion, over the fixtures -------------------------------------------------------------------------------------------------

describe('criteria', () => {
  it('frontmatter is an object and absent from the html', () => {
    const result = doc(fixture('frontmatter.md'));
    assert.deepEqual(result.frontmatter, { name: 'workflow-guide', description: 'A one-line description that must never reach the page.' });
    assert.ok(!result.html.includes('workflow-guide'), 'the name is not in the html');
    assert.ok(!result.html.includes('never reach the page'), 'the description is not in the html');
    assert.equal(dom(result.html)('hr, h2').length, 0, 'the block is neither a thematic break nor a setext heading');
    assert.equal(squash(visible(result.html)), 'Guide title A paragraph after the block, with a link on line 8.');
    assert.deepEqual(result.links, [{ kind: 'link', url: 'https://example.com/guide', line: 8, rendered: true }], 'the block is masked, so the line of the link is the line of the file');
  });

  it('headings keep depth and text and get github ids', () => {
    const result = doc(fixture('headings.md'));
    assert.deepEqual(result.headings, [
      { depth: 1, text: 'Heading one', id: 'heading-one' },
      { depth: 2, text: 'What this does not prove', id: 'what-this-does-not-prove' },
      { depth: 2, text: 'What this does not prove', id: 'what-this-does-not-prove-1' },
      { depth: 3, text: 'Level three with code', id: 'level-three-with-code' },
      { depth: 6, text: 'The deepest level', id: 'the-deepest-level' },
    ]);
    const $ = dom(result.html);
    assert.deepEqual($('h1, h2, h3, h4, h5, h6').toArray().map((h) => [h.tagName, h.attribs.id]), result.headings.map((h) => [`h${h.depth}`, h.id]));
  });

  it('table and fenced code render without style or highlighting', () => {
    const { html } = doc(fixture('table-code.md'));
    const $ = dom(html);
    assert.deepEqual($('table > thead > tr > th').toArray().map((th) => [$(th).text(), th.attribs.align]), [['Name', 'left'], ['Count', 'right'], ['Note', 'center']]);
    assert.deepEqual($('table > tbody > tr').toArray().map((tr) => $(tr).children('td').toArray().map((td) => $(td).text())), [['alpha', '1', 'a < b & c'], ['beta', '22', 'plain']]);
    assert.ok(html.includes('<td align="center">a &#x3C; b &#x26; c</td>'), 'the cell text is escaped');
    assert.ok(html.includes('<pre><code>if (a &#x3C; b &#x26;&#x26; c > d) { return "x &#x26; y"; }\n</code></pre>'), 'the fence text is escaped: < and & (a literal > is inert, owner decision 001 a)');
    assert.equal($('pre').length, 1);
    assert.equal($('pre > code').text(), 'if (a < b && c > d) { return "x & y"; }\n');
    assert.equal($('code *').length, 0, 'no element inside code');
    assert.equal($('[style]').length, 0, '0 style attributes');
    assert.equal($('span').length, 0, '0 highlighting spans');
    assert.equal($('[class]').length, 0, 'no class');
  });

  it('translated-from is read and never shown', () => {
    const result = doc(fixture('translated.md'));
    assert.deepEqual(result.translatedFrom, { source: 'docs/guides/daily-use.md', blob: BLOB });
    for (const text of [result.html, visible(result.html)]) {
      assert.ok(!text.includes('translated-from'), 'the word is not shown');
      assert.ok(!text.includes(BLOB), 'the blob id is not shown');
    }
    assert.equal(squash(visible(result.html)), 'A translated guide Body text of the translated page.');
  });

  it('comments are dropped', () => {
    const { html, translatedFrom } = doc(fixture('comments.md'));
    assert.ok(!html.includes('<!--'), '0 comment sequences');
    for (const text of ['proofline', 'shared-rules', 'translated-from', BLOB, 'inline comment', 'a comment that spans', 'two lines']) assert.ok(!html.includes(text), `${text} is not in the output`);
    assert.equal(squash(visible(html)), 'First paragraph. Second paragraph. Inline text stays.');
    assert.equal(translatedFrom?.source, 'docs/guides/daily-use.md', 'the header is read before the comment is dropped');
  });

  it('script element source is visible text', () => {
    const { html } = doc(fixture('hostile-html.md'));
    const $ = dom(html);
    for (const tag of ['script', 'iframe', 'object', 'embed', 'style']) assert.equal($(tag).length, 0, `0 ${tag} elements`);
    const text = visible(html);
    assert.ok(text.includes('<script>alert(1)</script>'), 'the markup of the script element is shown as written');
    assert.ok(text.includes('alert(1)'));
    for (const written of ['<iframe src="https://example.com/frame"></iframe>', '<object data="x"></object>', '<embed src="x">', '<style>p { color: red }</style>']) assert.ok(text.includes(written), `${written} is shown as written`);
    assert.equal($(FORBIDDEN).length, 0);
  });

  it('img with onerror is visible text', () => {
    const { html } = doc(fixture('hostile-html.md'));
    const $ = dom(html);
    assert.equal($('img').length, 0);
    assert.deepEqual(attributeNames($).filter((name) => name.startsWith('on')), [], '0 attributes whose name starts with on');
    assert.equal(visible(html).split('<img src=x onerror=alert(1)>').length - 1, 2, 'the inline and the block form are both shown as written');
  });

  it('javascript link keeps its label without an anchor', () => {
    const [first] = paragraphs('links.md');
    assert.equal(first, '[x](javascript:alert(1))');
    const { html } = doc(first);
    const $ = dom(html);
    assert.equal($('a').length, 0);
    assert.deepEqual(attributeValues($).filter((v) => /javascript:/i.test(v)), []);
    assert.equal(visible(html), 'x');
    assert.deepEqual(attributeValues(dom(doc(fixture('links.md')).html)).filter((v) => /javascript:/i.test(v)), [], 'also in the whole fixture');
  });

  it('unsafe schemes are text and safe targets are unchanged', () => {
    const rows = paragraphs('links.md');
    assert.equal(rows.length, 10);
    const unsafe = rows.slice(0, 5);
    assert.deepEqual(unsafe.map((row) => row.slice(4, -1)), ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java&#x73;cript:alert(1)', 'data:text/html,x', 'ftp://example.com/a']);
    for (const row of unsafe) {
      const { html } = doc(row);
      assert.equal(dom(html)('a').length, 0, `${row} is not a link`);
      assert.equal(visible(html), 'x', `${row} keeps its label`);
    }
    const targets = ['https://example.com/', 'http://example.com/', 'mailto:a@example.com', '../other.md', '#heading'];
    const safe = rows.slice(5);
    assert.deepEqual(safe.map((row) => row.slice(4, -1)), targets);
    safe.forEach((row, i) => {
      const { html } = doc(row);
      const $ = dom(html);
      assert.equal($('a').length, 1, `${row} is a link`);
      assert.equal($('a').attr('href'), targets[i], `${row} keeps its target`);
      assert.equal($('a').text(), 'x');
    });
    const whole = doc(fixture('links.md'));
    assert.deepEqual(whole.links.map((l) => l.rendered), [false, false, false, false, false, true, true, true, true, true]);
    assert.deepEqual(dom(whole.html)('a').toArray().map((a) => a.attribs.href), targets);
  });

  it('placeholder and kbd are visible text', () => {
    const source = fixture('placeholder.md');
    const { html } = doc(source);
    assert.equal(dom(html)('kbd').length, 0);
    assert.equal(dom(html)('slug, task, path').length, 0, 'no element is made from a placeholder');
    assert.equal(squash(visible(html)), squash(source), 'the same characters as the source, for the placeholders and for the kbd element');
    assert.ok(visible(html).includes('<slug>') && visible(html).includes('<kbd>x</kbd>') && visible(html).includes('<TASK>') && visible(html).includes('<path:line>'));
  });

  it('block html is visible text', () => {
    const source = fixture('hostile-html.md');
    const block = source.split('\n\n')[3];
    assert.ok(block.startsWith('<div class="box"') && block.endsWith('</div>'), 'the block of the fixture is the div with the details element');
    const { html } = doc(source);
    const $ = dom(html);
    assert.equal($('div').length, 0);
    assert.equal($('details').length, 0);
    assert.equal($('summary').length, 0);
    assert.ok(visible(html).includes(block), 'the source text of the block is visible');
    const holder = $('p').filter((_, p) => $(p).text() === block);
    assert.equal(holder.length, 1, 'the block is held by one p element');
  });

  it('image becomes a link with its alt text', () => {
    const result = doc(fixture('image.md'));
    const $ = dom(result.html);
    assert.equal($('img').length, 0);
    assert.equal($('a').length, 1);
    assert.equal($('a').text(), 'alt text');
    assert.equal($('a').attr('href'), 'https://example.com/a.png');
    assert.deepEqual(result.links, [{ kind: 'image', url: 'https://example.com/a.png', line: 1, rendered: true }]);
  });

  it('output is byte identical in one process and in two', () => {
    const names = readdirSync(FIXTURES).filter((n) => n.endsWith('.md')).sort();
    const render = () => names.map((name) => JSON.stringify(doc(fixture(name))));
    const first = render();
    const second = render();
    assert.deepEqual(second, first, 'two calls in one process');
    assert.ok(first.every((json) => JSON.parse(json).html !== ''), 'every fixture renders to something, so equality is not the equality of empty results');
    assert.equal(doc(fixture('image.md')).html, '<p><a href="https://example.com/a.png">alt text</a></p>', 'and what it renders is the rendering');
    assert.deepEqual(doc(fixture('headings.md')).headings.map((h) => h.id), ['heading-one', 'what-this-does-not-prove', 'what-this-does-not-prove-1', 'level-three-with-code', 'the-deepest-level']);
    assert.deepEqual(doc(fixture('headings.md')).headings, doc(fixture('headings.md')).headings, 'the slugger starts again on every call');
    const script = `import { readFileSync } from 'node:fs'; import { transformDocument } from ${JSON.stringify(pathToFileURL(MODULE).href)};
const dir = ${JSON.stringify(FIXTURES)};
console.log(JSON.stringify(${JSON.stringify(names)}.map((name) => JSON.stringify(transformDocument(${JSON.stringify(PATH)}, readFileSync(dir + '/' + name, 'utf8'))))));`;
    const runs = [0, 1].map(() => {
      const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8', timeout: 60000 });
      assert.equal(run.status, 0, run.stderr);
      return JSON.parse(run.stdout);
    });
    assert.deepEqual(runs[0], first, 'a first process equals this process');
    assert.deepEqual(runs[1], runs[0], 'two processes');
    assert.ok(first.every((json) => !/\d{4}-\d{2}-\d{2}T\d{2}:/.test(JSON.parse(json).html)), 'no timestamp in the html');
  });

  it('package.json lists the six dependencies with exact versions', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
    const EXACT = { 'remark-gfm': '4.0.1', 'remark-rehype': '11.1.2', 'rehype-stringify': '10.0.1', 'remark-parse': '11.0.0', unified: '11.0.5', 'github-slugger': '2.0.0' };
    for (const [name, version] of Object.entries(EXACT)) {
      assert.equal(pkg.dependencies?.[name], version, `package.json lists ${name} ${version}`);
      assert.match(pkg.dependencies[name], /^\d+\.\d+\.\d+$/, `${name} has no ^ or ~`);
      assert.equal(lock.packages['']?.dependencies?.[name], version, `the lock root lists ${name}`);
      assert.equal(lock.packages[`node_modules/${name}`]?.version, version, `the lock holds ${name}`);
    }
    for (const name of ['unified', 'github-slugger']) {
      const copies = Object.keys(lock.packages).filter((key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`));
      assert.deepEqual(copies, [`node_modules/${name}`], `one copy of ${name}`);
    }
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    assert.deepEqual(names.filter((n) => /^(?:remark|rehype)/.test(n)).sort(), ['rehype-stringify', 'remark-gfm', 'remark-parse', 'remark-rehype'], 'no other remark or rehype package');
    assert.deepEqual(names.filter((n) => /^(?:marked|markdown-it|showdown|remarkable|commonmark|micromark|@mdx-js\/.*)$/.test(n)), [], 'no other Markdown library');
  });

  it('module reads no clock, random value, environment or file system and never allows dangerous html', () => {
    const source = readFileSync(MODULE, 'utf8');
    const imports = [...source.matchAll(/^import .*? from '([^']+)';$/gm)].map((m) => m[1]).sort();
    assert.deepEqual(imports, ['github-slugger', 'rehype-stringify', 'remark-gfm', 'remark-parse', 'remark-rehype', 'unified', 'yaml']);
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const pattern of [/\bDate\b/, /Math\.random/, /\bprocess\b/, /node:/, /\brequire\b/, /\bperformance\b/, /crypto/, /\bfetch\b/, /\bsetTimeout\b/]) assert.ok(!pattern.test(code), `no ${pattern}`);
    assert.ok(!/allowDangerousHtml:\s*true/.test(source), 'allowDangerousHtml is never true');
    assert.equal([...source.matchAll(/allowDangerousHtml: false/g)].length, 2, 'remark-rehype and rehype-stringify both say false');
  });
});

// ---- U1: isSafeUrl ---------------------------------------------------------------------------------------------------------------------------------------

describe('isSafeUrl rule table', () => {
  const safe = [
    ['https://example.com/', 'allowed scheme'],
    ['http://example.com/', 'allowed scheme'],
    ['HTTPS://EXAMPLE.COM/', 'allowed scheme in upper case'],
    ['mailto:a@example.com', 'allowed scheme'],
    ['MailTo:a@example.com', 'allowed scheme in mixed case'],
    ['../other.md', 'relative path'],
    ['#heading', 'fragment'],
    ['?q=a:b', 'colon after ?'],
    ['./a:b', 'colon after /'],
    ['docs/x.md#a:b', 'colon after / and #'],
    ['', 'empty target'],
    ['//example.com/a', 'network-path reference'],
    ['\\example.com', 'backslash path, no colon'],
    [' https://example.com/', 'leading space is stripped, then an allowed scheme'],
    ['\u0001mailto:a@example.com', 'leading control character is stripped, then an allowed scheme'],
    ['ht\ttps://example.com/', 'tab inside an allowed scheme is removed'],
    ['ht\ntp://example.com/', 'line feed inside an allowed scheme is removed'],
    ['mail\rto:a@example.com', 'carriage return inside an allowed scheme is removed'],
    ['#a:b', 'colon after #, no / or ? before it'],
    ['#sec:x', 'colon after #, no / or ? before it'],
    ['a/b:c', 'colon after / only'],
    ['a?b:c', 'colon after ? only'],
    ['a#b:c', 'colon after # only'],
    ['ht\t\ttps://example.com/', 'two tabs inside an allowed scheme are all removed'],
    ['ht\n\ntp://example.com/', 'two line feeds inside an allowed scheme are all removed'],
    ['mail\r\rto:a@example.com', 'two carriage returns inside an allowed scheme are all removed'],
    ['h\tt\nt\rps://example.com/', 'a tab, a line feed and a carriage return inside one scheme'],
    ['\u0000https://example.com/', 'a leading NUL is stripped, then an allowed scheme'],
    ['  https://example.com/', 'two leading spaces are both stripped'],
    ['\u0001\u0002\u001f mailto:a@example.com', 'several leading control characters and a space are all stripped'],
  ];
  const unsafe = [
    ['javascript:alert(1)', 'script scheme'],
    ['JaVaScRiPt:alert(1)', 'script scheme in mixed case'],
    ['vbscript:x', 'script scheme'],
    ['data:text/html,x', 'data scheme'],
    ['ftp://example.com/a', 'scheme outside the set'],
    ['file:///etc', 'scheme outside the set'],
    ['path:line', 'scheme-looking text'],
    ['C:\\x', 'drive letter reads as a scheme'],
    ['javascript://%0Aalert(1)', 'script scheme with a slash after the colon'],
    [' javascript:x', 'leading space is stripped like a browser does'],
    ['\u0001javascript:x', 'leading control character is stripped'],
    ['\u0000\u001f javascript:x', 'leading control characters and space are stripped'],
    ['java\tscript:x', 'tab inside the scheme is removed'],
    ['java\nscript:x', 'line feed inside the scheme is removed'],
    ['java\rscript:x', 'carriage return inside the scheme is removed'],
    ['%6Aavascript:x', 'percent-encoded scheme is not an allowed scheme'],
    ['java\\script:x', 'backslash inside the scheme'],
    ['httpx://a', 'scheme that only starts like http'],
    ['xhttps://a', 'scheme that only ends like https'],
    ['mailtox:a', 'scheme that only starts like mailto'],
    ['https :x', 'space before the colon'],
    ['!https://example.com/', 'the strip stops at the space, so an exclamation mark stays in the scheme'],
    ['\u007fjavascript:x', 'a delete character is not stripped'],
    ['\u00a0https://example.com/', 'a no-break space is not stripped'],
  ];
  for (const [url, why] of safe) it(`safe: ${JSON.stringify(url)} (${why})`, () => assert.equal(isSafeUrl(url), true));
  for (const [url, why] of unsafe) it(`unsafe: ${JSON.stringify(url)} (${why})`, () => assert.equal(isSafeUrl(url), false));
  for (const value of [undefined, null, 1, {}, ['https://example.com/']]) it(`unsafe: a ${typeof value} value is never a target`, () => assert.equal(isSafeUrl(value), false));

  it('the entity form of the fixture arrives decoded and is not a link', () => {
    const { links, html } = doc('[x](java&#x73;cript:alert(1))');
    assert.deepEqual(links, [{ kind: 'link', url: 'javascript:alert(1)', line: 1, rendered: false }]);
    assert.equal(dom(html)('a').length, 0);
  });

  // ---- closed world: every member of every class, every anchor and every operator boundary of the rule has a row of its own ----
  const hex = hex4;

  // The leading strip: every character from U+0000 to U+0020 is removed before the scheme is read.
  for (let code = 0; code <= 0x20; code++) {
    const ch = String.fromCharCode(code);
    it(`strip: U+${hex(code)} before a script scheme is removed, so the target is unsafe`, () => assert.equal(isSafeUrl(`${ch}javascript:x`), false));
    it(`strip: U+${hex(code)} before an allowed scheme is removed, so the target is safe`, () => assert.equal(isSafeUrl(`${ch}https://example.com/`), true));
    it(`strip: U+${hex(code)} before a colon is removed, so the scheme is empty and the target is unsafe`, () => assert.equal(isSafeUrl(`${ch}:x`), false));
    it(`strip: U+${hex(code)} twice before an allowed scheme: both are removed`, () => assert.equal(isSafeUrl(`${ch}${ch}mailto:a@example.com`), true));
  }
  // Every other printable ASCII character stays in front of the scheme and makes it a scheme that is not allowed; only the three terminators put the colon inside a path.
  for (let code = 0x21; code <= 0x7e; code++) {
    const ch = String.fromCharCode(code);
    const expected = '/?#'.includes(ch);
    it(`first character ${JSON.stringify(ch)} before an allowed scheme: ${expected ? 'safe, it ends the part before the colon' : 'unsafe, it belongs to the scheme'}`, () => assert.equal(isSafeUrl(`${ch}https://example.com/`), expected));
    it(`${JSON.stringify(ch)} directly before the colon of x: ${expected ? 'safe, a path' : 'unsafe, a scheme of one character'}`, () => assert.equal(isSafeUrl(`${ch}:x`), expected));
  }
  for (const ch of ['\u007f', '\u0080', '\u009f', '\u00a0', '\u1680', '\u2000', '\u2028', '\u3000', '\ufeff']) {
    it(`first character U+${hex(ch.charCodeAt(0))} is not stripped: an allowed scheme behind it is not a scheme`, () => assert.equal(isSafeUrl(`${ch}https://example.com/`), false));
  }
  it('a control character inside the scheme is not removed (only tab, line feed and carriage return are)', () => {
    for (const ch of ['\u0000', '\u0001', '\u001f', ' ', '\u007f']) assert.equal(isSafeUrl(`ht${ch}tps://example.com/`), false, JSON.stringify(ch));
  });
  it('a space after the scheme name is not removed', () => assert.equal(isSafeUrl('https ://example.com/'), false));
  for (let code = 0; code <= 0x20; code++) {
    if ([9, 10, 13].includes(code)) continue;
    const ch = String.fromCharCode(code);
    it(`a U+${hex4(code)} inside the scheme is not removed, so the scheme is not an allowed one`, () => {
      assert.equal(isSafeUrl(`ht${ch}tps://example.com/`), false);
      assert.equal(isSafeUrl(`mail${ch}to:a@example.com`), false);
      assert.equal(isSafeUrl(`java${ch}script:x`), false);
    });
    it(`a U+${hex4(code)} after the colon changes nothing`, () => assert.equal(isSafeUrl(`https:${ch}//example.com/`), true));
  }

  // The scheme list: each member in every case, then the neighbours outside it.
  for (const [scheme, target] of [['http', 'http://example.com/'], ['https', 'https://example.com/'], ['mailto', 'mailto:a@example.com']]) {
    it(`safe: ${scheme} in lower case`, () => assert.equal(isSafeUrl(target), true));
    it(`safe: ${scheme} in upper case`, () => assert.equal(isSafeUrl(target.replace(scheme, scheme.toUpperCase())), true));
    for (let i = 0; i < scheme.length; i++) {
      const flipped = scheme.slice(0, i) + scheme[i].toUpperCase() + scheme.slice(i + 1);
      it(`safe: ${flipped} has one upper-case letter`, () => assert.equal(isSafeUrl(target.replace(scheme, flipped)), true));
    }
    it(`safe: ${scheme} with nothing after the colon`, () => assert.equal(isSafeUrl(`${scheme}:`), true));
  }
  const notAllowed = ['httpss', 'httpx', 'xhttp', 'http2', 'http-s', 'http.s', 'http+s', 'https2', 'hxxps', 'htps', 'htt', 'ttp', 'mailt', 'mail', 'mailtoo', 'mailto2', 'xmailto', 'mailtp', 'mail-to',
    'javascript', 'vbscript', 'livescript', 'data', 'ftp', 'sftp', 'file', 'blob', 'about', 'chrome', 'view-source', 'ws', 'wss', 'tel', 'sms', 'sip', 'cid', 'git', 'ssh', 'irc', 'news', 'magnet', 'intent', 'jar', 'x', 'h', 'path', 'C', 'a', 'a1', 'http\u017f'];
  for (const scheme of notAllowed) {
    it(`unsafe: the scheme ${JSON.stringify(scheme)} is not on the list`, () => assert.equal(isSafeUrl(`${scheme}://example.com/`), false));
    it(`unsafe: the scheme ${JSON.stringify(scheme)} is not on the list, whatever follows the colon`, () => assert.equal(isSafeUrl(`${scheme}:x`), false));
  }
  for (const scheme of ['HTTPSS', 'XHTTP', 'MAILTOO', 'JAVASCRIPT', 'DATA', 'FTP', 'Javascript', 'jAvAsCrIpT', 'Data', 'vbScript']) {
    it(`unsafe: the scheme ${scheme} in this case is not on the list either`, () => assert.equal(isSafeUrl(`${scheme}:x`), false));
  }

  // The colon and the three terminators: the first colon decides, and only a terminator before it makes the target a path.
  const colons = [
    ['/:x', true, 'the colon follows a slash at index 0'],
    ['?:x', true, 'the colon follows a question mark at index 0'],
    ['#:x', true, 'the colon follows a number sign at index 0'],
    ['javascript:/x', false, 'a slash after the colon does not make the scheme a path'],
    ['javascript:?x', false, 'a question mark after the colon does not make the scheme a path'],
    ['javascript:#x', false, 'a number sign after the colon does not make the scheme a path'],
    ['a:/b', false, 'a slash right after a one-letter scheme'],
    ['https:/x', true, 'an allowed scheme and a slash'],
    ['http:?x', true, 'an allowed scheme and a question mark'],
    ['mailto:#x', true, 'an allowed scheme and a number sign'],
    ['a:b:c', false, 'two colons: the first one ends the scheme'],
    ['https:a:b', true, 'two colons behind an allowed scheme'],
    ['javascript:a:b', false, 'two colons behind a script scheme'],
    ['a/b:javascript:x', true, 'the first colon follows a slash, so the whole target is a path'],
    ['a?b:javascript:x', true, 'the first colon follows a question mark'],
    ['a#b:javascript:x', true, 'the first colon follows a number sign'],
    ['javascript:alert(1)//a:b', false, 'the first colon decides, not a later one'],
    ['javascript:x?a:b', false, 'a later colon after a question mark does not decide'],
    ['javascript:x#a:b', false, 'a later colon after a number sign does not decide'],
    ['https://example.com:8080/', true, 'a port is a later colon'],
    ['x:', false, 'a scheme of one letter with nothing after the colon'],
    ['javascript:', false, 'a script scheme with nothing after the colon'],
    [':x', false, 'an empty scheme: the colon is at index 0'],
    [':', false, 'a colon alone'],
    ['::', false, 'two colons'],
    [':/x', false, 'an empty scheme and a slash'],
    [':?x', false, 'an empty scheme and a question mark'],
    [':#x', false, 'an empty scheme and a number sign'],
    [':https://example.com/', false, 'an empty scheme before an allowed scheme'],
    ['\t:x', false, 'a tab is removed, then the scheme is empty'],
    [' :x', false, 'a space is stripped, then the scheme is empty'],
    ['\u0001:x', false, 'a control character is stripped, then the scheme is empty'],
    ['https', true, 'no colon: a word is a relative path'],
    ['javascript', true, 'no colon: a script word is a relative path'],
    ['a b', true, 'no colon: text with a space'],
  ];
  for (const [url, expected, why] of colons) it(`${expected ? 'safe' : 'unsafe'}: ${JSON.stringify(url)} (${why})`, () => assert.equal(isSafeUrl(url), expected));

  // The same rule seen through a link: an empty scheme and the near neighbours are text, never an anchor.
  const viaLink = [
    ['[a](<:x>)', 'a', false], ['[a](<::x>)', 'a', false], ['[a](< :x>)', 'a', false], ['[a](<:/x>)', 'a', false], ['[a](<:#x>)', 'a', false], ['[a](<:https://example.com/>)', 'a', false],
    ['[a](</:x>)', 'a', true], ['[a](<?:x>)', 'a', true], ['[a](<#:x>)', 'a', true], ['[a](<a/b:c>)', 'a', true], ['[a](<x:y>)', 'a', false],
  ];
  for (const [source, label, rendered] of viaLink) {
    it(`link ${source} is ${rendered ? 'an anchor' : 'text'}`, () => {
      const result = doc(source);
      assert.equal(dom(result.html)('a').length, rendered ? 1 : 0);
      assert.equal(visible(result.html), label);
      assert.equal(result.links.length, 1);
      assert.equal(result.links[0].rendered, rendered);
    });
  }

  // ---- closed world, round 3: the terminator is searched in the cleaned text, never in the raw one ----
  // The cleaning removes leading characters, spaces and tabs, so an index taken in the raw text is further on than the index of the colon in the cleaned text.
  const cleanedLeads = [['control characters', '\u0001'], ['NUL characters', '\u0000'], ['spaces', ' '], ['tabs', '\t'], ['line feeds', '\n'], ['carriage returns', '\r'], ['mixed control characters', '\u0001\u001f\u0000'], ['a control character and a space', '\u0001 ']];
  for (const [name, lead] of cleanedLeads) {
    for (const count of [1, 2, 3, 10]) {
      for (const terminator of ['/', '?', '#']) {
        it(`safe: ${count} leading ${name}, then ${JSON.stringify(terminator)} and a colon later`, () => {
          assert.equal(isSafeUrl(`${lead.repeat(count)}${terminator}a:b`), true);
          assert.equal(isSafeUrl(`${lead.repeat(count)}x${terminator}a:b`), true);
        });
      }
      it(`unsafe: ${count} leading ${name}, then a script scheme`, () => assert.equal(isSafeUrl(`${lead.repeat(count)}javascript:x`), false));
      it(`unsafe: ${count} leading ${name}, then a colon first`, () => assert.equal(isSafeUrl(`${lead.repeat(count)}a:/b`), false));
    }
  }
  // A tab, a line feed or a carriage return inside the target is removed too: the terminator and the colon are found in the text without them.
  for (const [name, inner] of [['tab', '\t'], ['line feed', '\n'], ['carriage return', '\r'], ['mixed', '\t\n\r']]) {
    for (const count of [1, 3, 10]) {
      for (const terminator of ['/', '?', '#']) {
        it(`safe: ${count} ${name} inside the path before ${JSON.stringify(terminator)}, then a colon`, () => {
          assert.equal(isSafeUrl(`a${inner.repeat(count)}${terminator}b:c`), true);
          assert.equal(isSafeUrl(`a${terminator}${inner.repeat(count)}b:c`), true);
        });
        it(`unsafe: ${count} ${name} inside the scheme before its colon and ${JSON.stringify(terminator)} after it`, () => assert.equal(isSafeUrl(`ab${inner.repeat(count)}c:${terminator}b`), false));
      }
    }
  }
  const viaCleanedLink = [
    ['[a](<\u0001\u0001\u0001/a:b>)', '%01%01%01/a:b'], ['[a](<\u0001/a:b>)', '%01/a:b'], ['[a](<\t\t\t/a:b>)', '%09%09%09/a:b'], ['[a](<   /a:b>)', '%20%20%20/a:b'],
    ['[a](<  ?a:b>)', '%20%20?a:b'], ['[a](<\t#a:b>)', '%09#a:b'],
  ];
  for (const [source, href] of viaCleanedLink) {
    it(`link ${JSON.stringify(source)} is an anchor: the colon follows a terminator`, () => {
      const result = doc(source);
      assert.deepEqual(dom(result.html)('a').toArray().map((a) => a.attribs.href), [href]);
      assert.equal(result.links[0].rendered, true);
    });
  }
  // The strip is anchored at the start and stops at the first character that is not a control character or a space: whatever follows it stays.
  for (const [url, expected, why] of [
    ['x https://example.com/', false, 'a letter, then a space, then an allowed scheme'], ['x\u0001https://example.com/', false, 'a letter, then a control character'], ['\u00a0 https://example.com/', false, 'a no-break space, then a space'], ['\u00a0\u0001https://example.com/', false, 'a no-break space, then a control character'],
    ['\u3000 https://example.com/', false, 'an ideographic space, then a space'], ['\ufeff https://example.com/', false, 'a BOM, then a space'], ['\u2028 https://example.com/', false, 'a line separator, then a space'], ['\u200b https://example.com/', false, 'a zero-width space, then a space'],
    ['/ https://example.com/', true, 'a slash, then a space, then a scheme: a path'], ['# https://example.com/', true, 'a number sign first: a fragment'], ['? https://example.com/', true, 'a question mark first: a query'], ['. https://example.com/', false, 'a dot, then a space'],
    [' x https://example.com/', false, 'a space, a letter, a space and an allowed scheme'], ['\u0001 x\u0001https://example.com/', false, 'the strip stops at the letter'], ['x javascript:x', false, 'a letter, a space and a script scheme'], ['x mailto:a@example.com', false, 'a letter, a space and mailto'],
    ['\u0001 \u001f https://example.com/', true, 'every control character and space in a run is stripped'], ['\t \u0001\u0000 \nmailto:a@example.com', true, 'a run of controls and spaces of every kind'],
  ]) {
    it(`${expected ? 'safe' : 'unsafe'}: ${JSON.stringify(url)} (${why})`, () => assert.equal(isSafeUrl(url), expected));
  }
  it('the answer is a boolean, never a truthy value', () => {
    for (const url of ['https://example.com/', 'a/b', '', 'javascript:x', ':x']) assert.equal(typeof isSafeUrl(url), 'boolean');
  });

  // The characters outside printable ASCII: only the C0 controls and the space are stripped in front, only tab, line feed and carriage return are removed inside, and no other character ends the
  // part before the colon: it is part of the scheme.
  for (const ch of SWEEP) {
    const stripped = ch.charCodeAt(0) <= 0x20;
    const removed = ch === '\t' || ch === '\n' || ch === '\r';
    it(`${label(ch)} in front of, inside and next to a scheme`, () => {
      assert.equal(isSafeUrl(`${ch}https://example.com/`), stripped, 'in front of an allowed scheme');
      assert.equal(isSafeUrl(`${ch}${ch}https://example.com/`), stripped, 'twice in front of an allowed scheme');
      assert.equal(isSafeUrl(`${ch}javascript:x`), false, 'in front of a script scheme');
      assert.equal(isSafeUrl(`ht${ch}tps://example.com/`), removed, 'inside https');
      assert.equal(isSafeUrl(`mail${ch}to:a@example.com`), removed, 'inside mailto');
      assert.equal(isSafeUrl(`https${ch}://example.com/`), removed, 'after https');
      assert.equal(isSafeUrl(`${ch}a:b`), false, 'in front of a one-letter scheme');
      assert.equal(isSafeUrl(`a${ch}b:c`), false, 'inside a scheme that is not allowed');
      assert.equal(isSafeUrl(`a${ch}:c`), false, 'right before the colon');
      assert.equal(isSafeUrl(`https:${ch}//example.com/`), true, 'after the colon of an allowed scheme');
      assert.equal(isSafeUrl(`javascript:${ch}x`), false, 'after the colon of a script scheme');
      assert.equal(isSafeUrl(`${ch}/a:b`), true, 'in front of a path');
      assert.equal(isSafeUrl(`x/${ch}:y`), true, 'after a slash');
      assert.equal(isSafeUrl(`x${ch}/a:y`), true, 'before a slash');
    });
  }
});

// ---- U2: html to text ------------------------------------------------------------------------------------------------------------------------------------

describe('html to text rule table', () => {
  const rows = [
    ['block html at the top level', '<div>a</div>', '<p>&#x3C;div>a&#x3C;/div></p>'],
    ['a closing tag alone is a block', '</div>', '<p>&#x3C;/div></p>'],
    ['inline html in a paragraph', 'a <b>x</b> c', '<p>a &#x3C;b>x&#x3C;/b> c</p>'],
    ['inline html in a heading', '# T <span>x</span>', '<h1 id="t-spanxspan">T &#x3C;span>x&#x3C;/span></h1>'],
    ['inline html in a link label', '[<img src=x onerror=alert(1)>](https://example.com/)', '<p><a href="https://example.com/">&#x3C;img src=x onerror=alert(1)></a></p>'],
    ['inline html in a list item', '- <b>c</b>', '<ul>\n<li>&#x3C;b>c&#x3C;/b></li>\n</ul>'],
    ['block html in a list item', '- <div>x</div>', '<ul>\n<li>&#x3C;div>x&#x3C;/div></li>\n</ul>'],
    ['block html in a block quote', '> <div>x</div>', '<blockquote>\n<p>&#x3C;div>x&#x3C;/div></p>\n</blockquote>'],
    ['a processing instruction', '<?php echo 1 ?>', '<p>&#x3C;?php echo 1 ?></p>'],
    ['a declaration', '<!DOCTYPE html>', '<p>&#x3C;!DOCTYPE html></p>'],
    ['a cdata section', '<![CDATA[x]]>', '<p>&#x3C;![CDATA[x]]></p>'],
    ['a multi-line block keeps its line breaks', '<div>\nhi\n</div>', '<p>&#x3C;div>\nhi\n&#x3C;/div></p>'],
    ['block html keeps its trailing spaces', '<div>x</div>   ', '<p>&#x3C;div>x&#x3C;/div>   </p>'],
    ['block html keeps its leading spaces', '   <div>x</div>', '<p>   &#x3C;div>x&#x3C;/div></p>'],
  ];
  for (const [name, source, expected] of rows) {
    it(name, () => {
      const { html } = doc(source);
      assert.equal(html, expected);
      assert.equal(dom(html)(FORBIDDEN).length, 0, 'no element of the source');
    });
  }

  it('inline html in a table cell', () => {
    const { html } = doc('| a |\n| - |\n| <i>b</i> |');
    const $ = dom(html);
    assert.equal($('i').length, 0);
    assert.equal($('td').text(), '<i>b</i>');
    assert.ok(html.includes('<td>&#x3C;i>b&#x3C;/i></td>'));
  });

  it('the visible text of every row holds the source characters', () => {
    for (const [, source] of rows.filter(([name]) => !name.startsWith('inline html in a heading') && !name.includes('list item') && !name.includes('quote') && !name.includes('link label'))) {
      assert.equal(squash(visible(doc(source).html)), squash(source));
    }
  });

  // Closed world of the parents: html below a flow parent (root, block quote, list item) is a paragraph of its own; below any other parent it is text in place.
  const more = [
    ['inline html in emphasis', '*a <b>x</b> c*', '<p><em>a &#x3C;b>x&#x3C;/b> c</em></p>'],
    ['inline html in strong', '**a <b>x</b> c**', '<p><strong>a &#x3C;b>x&#x3C;/b> c</strong></p>'],
    ['inline html in strikethrough', '~~a <b>x</b>~~', '<p><del>a &#x3C;b>x&#x3C;/b></del></p>'],
    ['inline html in a table header cell', '| <i>h</i> |\n| - |\n| b |', '<table>\n<thead>\n<tr>\n<th>&#x3C;i>h&#x3C;/i></th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>b</td>\n</tr>\n</tbody>\n</table>'],
    ['inline html in a reference link label', '[<b>x</b>][r]\n\n[r]: https://e.com/', '<p><a href="https://e.com/">&#x3C;b>x&#x3C;/b></a></p>'],
    ['block html in a list item in a block quote', '> - <div>x</div>', '<blockquote>\n<ul>\n<li>&#x3C;div>x&#x3C;/div></li>\n</ul>\n</blockquote>'],
    ['block html split by a blank line is three blocks', '<div>\n\ntext\n\n</div>', '<p>&#x3C;div></p>\n<p>text</p>\n<p>&#x3C;/div></p>'],
    ['inline html in a heading keeps its slug text', '# <b>x</b>', '<h1 id="bxb">&#x3C;b>x&#x3C;/b></h1>'],
  ];
  for (const [name, source, expected] of more) {
    it(name, () => {
      const { html } = doc(source);
      assert.equal(html, expected);
      assert.equal(dom(html)(FORBIDDEN).length, 0, 'no element of the source');
    });
  }

  const hand = {
    html: (value = '<b>') => ({ type: 'html', value }),
    root: (...children) => ({ type: 'root', children }),
    cell: (...children) => ({ type: 'tableCell', children }),
  };
  const rendered = (...children) => renderTree(hand.root(...children), { path: PATH }).html;
  const handRows = [
    ['root', () => rendered(hand.html()), '<p>&#x3C;b></p>'],
    ['block quote', () => rendered({ type: 'blockquote', children: [hand.html()] }), '<blockquote>\n<p>&#x3C;b></p>\n</blockquote>'],
    ['list item', () => rendered({ type: 'list', ordered: false, spread: false, children: [{ type: 'listItem', spread: false, children: [hand.html()] }] }), '<ul>\n<li>&#x3C;b></li>\n</ul>'],
    ['paragraph', () => rendered({ type: 'paragraph', children: [hand.html()] }), '<p>&#x3C;b></p>'],
    ['heading', () => rendered({ type: 'heading', depth: 1, children: [hand.html()] }), '<h1 id="b">&#x3C;b></h1>'],
    ['emphasis', () => rendered({ type: 'paragraph', children: [{ type: 'emphasis', children: [hand.html()] }] }), '<p><em>&#x3C;b></em></p>'],
    ['strong', () => rendered({ type: 'paragraph', children: [{ type: 'strong', children: [hand.html()] }] }), '<p><strong>&#x3C;b></strong></p>'],
    ['strikethrough', () => rendered({ type: 'paragraph', children: [{ type: 'delete', children: [hand.html()] }] }), '<p><del>&#x3C;b></del></p>'],
    ['link', () => rendered({ type: 'paragraph', children: [{ type: 'link', url: 'https://e.com/', children: [hand.html()] }] }), '<p><a href="https://e.com/">&#x3C;b></a></p>'],
    ['link reference', () => rendered({ type: 'paragraph', children: [{ type: 'linkReference', identifier: 'r', children: [hand.html()] }] }, { type: 'definition', identifier: 'r', url: 'https://e.com/' }), '<p><a href="https://e.com/">&#x3C;b></a></p>'],
    ['table cell', () => rendered({ type: 'table', align: [null], children: [{ type: 'tableRow', children: [hand.cell(hand.html())] }] }), '<table>\n<thead>\n<tr>\n<th>&#x3C;b></th>\n</tr>\n</thead>\n</table>'],
    ['list', () => rendered({ type: 'list', ordered: false, spread: false, children: [hand.html()] }), '<ul>\n&#x3C;b>\n</ul>'],
    ['table', () => rendered({ type: 'table', align: [null], children: [hand.html()] }), '<table>\n<thead>\n&#x3C;b>\n</thead>\n</table>'],
  ];
  for (const [parent, run, expected] of handRows) it(`a hand-built html node below a ${parent} becomes the text of its value`, () => assert.equal(run(), expected));
  it('the value of an html node is the text as it is, whitespace included', () => {
    assert.equal(rendered(hand.html('  <b>  ')), '<p>  &#x3C;b>  </p>');
    assert.equal(rendered({ type: 'paragraph', children: [hand.html('\t<b>\n')] }), '<p>\t&#x3C;b>\n</p>');
  });
});

// ---- U3: comments and translated-from ----------------------------------------------------------------------------------------------------------------------

describe('comment and translated-from rule table', () => {
  const dropped = [
    ['a comment on its own line', '<!-- c -->'],
    ['the shared rules marker', '<!-- proofline:shared-rules:begin v1 -->'],
    ['a multi-line comment', '<!--\nx\n-->'],
    ['the empty comment', '<!---->'],
    ['the short comment', '<!-->'],
    ['the dash comment', '<!--->'],
    ['a comment with leading spaces', '   <!-- c -->'],
  ];
  for (const [name, comment] of dropped) {
    it(`dropped: ${name}`, () => {
      const { html } = doc(`before\n\n${comment}\n\nafter`);
      assert.equal(html, '<p>before</p>\n<p>after</p>');
      assert.ok(!html.includes('<!--'));
    });
  }

  it('dropped: an inline comment inside a paragraph', () => {
    assert.equal(doc('a <!-- c --> b').html, '<p>a  b</p>');
  });

  const shown = [
    ['a comment followed by text on the same line', '<!-- a --> tail', '<p>&#x3C;!-- a --> tail</p>'],
    ['two comments on one line', '<!-- a --><!-- b -->', '<p>&#x3C;!-- a -->&#x3C;!-- b --></p>'],
    ['a comment inside a fenced code block', '```\n<!-- keep -->\n```', '<pre><code>&#x3C;!-- keep -->\n</code></pre>'],
    ['a comment inside a code span', '`<!-- keep -->`', '<p><code>&#x3C;!-- keep --></code></p>'],
    ['html that ends in the comment close and is not a comment', 'x <a--> y', '<p>x &#x3C;a--> y</p>'],
    ['a comment that holds the early close --!> before its end', '<!-- a --!> b -->', '<p>&#x3C;!-- a --!> b --></p>'],
    ['a block that holds the early close --!> and markup before its end', '<!-- a --!>\n<script>x</script>\n-->', '<p>&#x3C;!-- a --!>\n&#x3C;script>x&#x3C;/script>\n--></p>'],
    ['a comment holding the early close --!> and a translated-from header is text too', `<!-- translated-from: docs/a.md; blob: ${BLOB} --!> -->`, `<p>&#x3C;!-- translated-from: docs/a.md; blob: ${BLOB} --!> --></p>`],
  ];
  for (const [name, source, expected] of shown) {
    it(`shown, not dropped: ${name}`, () => {
      const { html } = doc(source);
      assert.equal(html, expected);
      assert.ok(!html.includes('<!--'), 'the html still holds 0 comment sequences');
    });
  }

  it('read: the strict header gives the source and the blob', () => {
    assert.deepEqual(doc(HEADER).translatedFrom, { source: 'docs/guides/daily-use.md', blob: BLOB });
    assert.equal(doc(HEADER).html, '');
  });

  it('read: compact spacing and an inline position', () => {
    assert.deepEqual(doc(`<!--translated-from:a/b.md;blob:${BLOB}-->`).translatedFrom, { source: 'a/b.md', blob: BLOB });
    assert.deepEqual(doc(`text ${HEADER} more`).translatedFrom, { source: 'docs/guides/daily-use.md', blob: BLOB });
  });

  it('read: the header after other comments and text', () => {
    assert.deepEqual(doc(`<!-- other -->\n\ntext\n\n${HEADER}\n`).translatedFrom, { source: 'docs/guides/daily-use.md', blob: BLOB });
  });

  it('no header gives null', () => {
    assert.equal(doc('text').translatedFrom, null);
    assert.equal(doc('<!-- an ordinary comment -->').translatedFrom, null);
  });

  it('a comment that only mentions the word later is an ordinary comment', () => {
    for (const comment of ['<!-- see translated-from: nothing -->', '<!-- note translated-from -->', `<!-- x translated-from: docs/a.md; blob: ${BLOB} -->`]) {
      const result = doc(`before\n\n${comment}\n\nafter`);
      assert.equal(result.translatedFrom, null, comment);
      assert.equal(result.html, '<p>before</p>\n<p>after</p>', comment);
    }
  });

  const accepted = ['a.md', 'docs/guides/daily-use.md', 'A_b-c.9/d.e.md', 'docs/guides/tr/x_y.md'];
  for (const source of accepted) {
    it(`read: the source ${source} is a repository path`, () => {
      assert.deepEqual(doc(`<!-- translated-from: ${source}; blob: ${BLOB} -->`).translatedFrom, { source, blob: BLOB });
    });
  }

  it('a header inside a code span is code text, not a header', () => {
    const result = doc(`Use \`${HEADER}\` here`);
    assert.equal(result.translatedFrom, null);
    assert.ok(visible(result.html).includes('translated-from'), 'the code text stays visible');
  });

  const malformed = [
    ['the blob is missing', '<!-- translated-from: docs/a.md -->'],
    ['the blob has 39 digits', `<!-- translated-from: docs/a.md; blob: ${BLOB.slice(1)} -->`],
    ['the blob has 41 digits', `<!-- translated-from: docs/a.md; blob: ${BLOB}0 -->`],
    ['the blob is upper case', `<!-- translated-from: docs/a.md; blob: ${BLOB.toUpperCase()} -->`],
    ['the semicolon is missing', `<!-- translated-from: docs/a.md blob: ${BLOB} -->`],
    ['the source is empty', `<!-- translated-from: ; blob: ${BLOB} -->`],
    ['the source holds a space', `<!-- translated-from: docs/a b.md; blob: ${BLOB} -->`],
    ['extra text follows the blob', `<!-- translated-from: docs/a.md; blob: ${BLOB} extra -->`],
    ['the word is alone', '<!-- translated-from -->'],
    ['the source holds an element without a space', `<!-- translated-from: x<script>alert(1)</script>.md; blob: ${BLOB} -->`],
    ['the source holds a less-than sign', `<!-- translated-from: docs/a<b.md; blob: ${BLOB} -->`],
    ['the source holds an ampersand', `<!-- translated-from: docs/a&b.md; blob: ${BLOB} -->`],
    ['the source holds a double quote', `<!-- translated-from: docs/a"b.md; blob: ${BLOB} -->`],
    ['the source holds a single quote', `<!-- translated-from: docs/a'b.md; blob: ${BLOB} -->`],
    ['the source holds a colon', `<!-- translated-from: javascript:x; blob: ${BLOB} -->`],
    ['the source holds a backslash', `<!-- translated-from: docs\\a.md; blob: ${BLOB} -->`],
    ['the source holds parentheses', `<!-- translated-from: docs/a(1).md; blob: ${BLOB} -->`],
    ['the source holds a non-ASCII letter', `<!-- translated-from: docs/a\u00e9.md; blob: ${BLOB} -->`],
    ['the source holds a percent sign', `<!-- translated-from: docs/a%20b.md; blob: ${BLOB} -->`],
  ];
  for (const [name, comment] of malformed) {
    it(`throws: malformed header, ${name}`, () => {
      const error = thrown(() => doc(`text\n\n${comment}\n`));
      assert.match(error.message, /^transform: docs\/test\.md:3: malformed translated-from header$/);
    });
  }

  it('throws: a second header', () => {
    const error = thrown(() => doc(`${HEADER}\n\ntext\n\n${HEADER}\n`));
    assert.match(error.message, /^transform: docs\/test\.md:5: a second translated-from header$/);
  });

  it('fragment mode drops every comment and reads nothing', () => {
    assert.equal(renderMarkdown('<!-- translated-from: bad -->\n\ntext'), '<p>text</p>');
    assert.equal(renderMarkdown(`${HEADER}\n\ntext\n\n${HEADER}`), '<p>text</p>');
    assert.equal(renderMarkdown('<!-- c --> tail'), '<p>&#x3C;!-- c --> tail</p>');
  });

  // ---- closed world of the comment test: the opener, the single closer at the end, the early close and the trim ----
  const around = (comment) => `before\n\n${comment}\n\nafter`;
  const droppedMore = [
    ['--! without the closing bracket', '<!-- a --! b -->'],
    ['!> without the two hyphens', '<!-- hi !> there -->'],
    ['!> alone', '<!-- a !> b -->'],
    ['-! and one hyphen', '<!-- a -! b -->'],
    ['-!> with one hyphen', '<!-- a -!> b -->'],
    ['--! then a space then >', '<!-- a --! > b -->'],
    ['--! at the start of the text', '<!-- --! b -->'],
    ['!> at the start of the text', '<!-- !> b -->'],
    ['!> at the end of the text', '<!-- b !> -->'],
    ['--! at the end of the text', '<!-- b --! -->'],
    ['-- !> with a space', '<!-- a -- !> b -->'],
    ['a long run of hyphens', '<!-- a ------ b -->'],
    ['trailing spaces after the comment', '<!-- c -->   '],
    ['a trailing tab after the comment', '<!-- c -->\t'],
    ['no spaces inside', '<!--c-->'],
    ['--! over two lines', '<!-- a --!\nb -->'],
    ['!> over two lines', '<!-- a !>\nb -->'],
  ];
  for (const [name, comment] of droppedMore) {
    it(`dropped: ${name}`, () => {
      const result = doc(around(comment));
      assert.equal(result.html, '<p>before</p>\n<p>after</p>');
      assert.equal(result.translatedFrom, null);
    });
  }
  const shownMore = [
    ['--!> over two lines', '<!-- a\n--!>\n b -->', '<p>&#x3C;!-- a\n--!>\nb --></p>'],
    ['--!> directly after the opener', '<!----!> x -->', '<p>&#x3C;!----!> x --></p>'],
    ['!> directly after the opener', '<!--!> x -->', '<p>&#x3C;!--!> x --></p>'],
    ['two closers at the end', '<!-- a -->-->', '<p>&#x3C;!-- a -->--></p>'],
    ['--!> in the middle of a long text', '<!-- one two --!> three four -->', '<p>&#x3C;!-- one two --!> three four --></p>'],
  ];
  for (const [name, comment, expected] of shownMore) {
    it(`shown, not dropped: ${name}`, () => assert.equal(doc(comment).html, expected));
  }

  // The same test on a hand-built node: the opener must be exactly `<!--`, the first closer must end the value, the value is trimmed.
  const asNode = (value) => renderTree({ type: 'root', children: [{ type: 'html', value }] }, { path: PATH }).html;
  const nodeDropped = ['<!-- x -->', '\n<!-- x -->\t\n', '  <!-- x -->  ', '<!--x-->', '<!-->', '<!--->', '<!---->', '<!-- -->', '<!-- -- -->', '<!-- a ---->', '<!--\n-->'];
  for (const value of nodeDropped) it(`a hand-built html node ${JSON.stringify(value)} is a comment and is dropped`, () => assert.equal(asNode(value), ''));
  const nodeShown = [
    ['<!-x -->', '<p>&#x3C;!-x --></p>', 'the opener has one hyphen'],
    ['<!x -->', '<p>&#x3C;!x --></p>', 'the opener has none'],
    ['<--x -->', '<p>&#x3C;--x --></p>', 'the opener has no bang'],
    ['!-- x -->', '<p>!-- x --></p>', 'the opener has no less-than sign'],
    ['x<!-- x -->', '<p>x&#x3C;!-- x --></p>', 'text before the opener'],
    ['<!-- x --', '<p>&#x3C;!-- x --</p>', 'the closer has no bracket'],
    ['<!-- x ->', '<p>&#x3C;!-- x -></p>', 'the closer has one hyphen'],
    ['<!-- x -- >', '<p>&#x3C;!-- x -- ></p>', 'the closer has a space'],
    ['<!--', '<p>&#x3C;!--</p>', 'the opener alone'],
    ['<!-- a -->-->', '<p>&#x3C;!-- a -->--></p>', 'two closers'],
    ['<!-- a --> b', '<p>&#x3C;!-- a --> b</p>', 'text after the closer'],
    ['<!-- a --!> b -->', '<p>&#x3C;!-- a --!> b --></p>', 'the early close'],
  ];
  for (const [value, expected, why] of nodeShown) it(`a hand-built html node ${JSON.stringify(value)} is shown as text (${why})`, () => assert.equal(asNode(value), expected));

  // ---- closed world of the header: the anchors, the separators, the whitespace, the blob and every character of the source ----
  const header = (source = 'docs/a.md', blob = BLOB, separators = {}) => {
    const { head = 'translated-from:', afterHead = ' ', beforeSemi = '', afterSemi = ' ', afterBlobWord = ' ' } = separators;
    return `<!-- ${head}${afterHead}${source}${beforeSemi};${afterSemi}blob:${afterBlobWord}${blob} -->`;
  };
  const malformedAt3 = /^transform: docs\/test\.md:3: malformed translated-from header$/;
  const readsFrom = (comment, expected) => assert.deepEqual(doc(`text\n\n${comment}\n`).translatedFrom, expected);
  const rejectsHeader = (comment) => assert.match(thrown(() => doc(`text\n\n${comment}\n`)).message, malformedAt3);

  it('throws: malformed header, a second translated-from after other text holds a valid header', () => {
    rejectsHeader(`<!-- translated-from: bad one translated-from: docs/a.md; blob: ${BLOB} -->`);
    rejectsHeader(`<!-- translated-from: x; translated-from: docs/a.md; blob: ${BLOB} -->`);
    rejectsHeader(`<!-- translated-from: docs/a.md; blob: ${BLOB} translated-from: docs/b.md; blob: ${BLOB} -->`);
  });
  const headRows = [
    ['the word continues', 'translated-fromx:'],
    ['a space before the colon', 'translated-from :'],
    ['the colon is missing', 'translated-from'],
    ['the colon is a semicolon', 'translated-from;'],
    ['the head has a trailing hyphen', 'translated-from-:'],
  ];
  for (const [name, head] of headRows) it(`throws: malformed header, ${name}`, () => rejectsHeader(header('docs/a.md', BLOB, { head })));
  const notHeaders = [
    ['the first letter in upper case', 'Translated-from:'],
    ['all words in upper case', 'TRANSLATED-FROM:'],
    ['an underscore for the hyphen', 'translated_from:'],
    ['the word one letter short', 'translated-fro:'],
    ['the word with a space', 'translated from:'],
    ['the words swapped', 'from-translated:'],
    ['a leading hyphen', '-translated-from:'],
    ['a different word', 'translation-of:'],
  ];
  for (const [name, head] of notHeaders) {
    it(`an ordinary comment: ${name}`, () => {
      const result = doc(around(header('docs/a.md', BLOB, { head })));
      assert.equal(result.translatedFrom, null);
      assert.equal(result.html, '<p>before</p>\n<p>after</p>');
    });
  }
  const spaces = [['none', ''], ['one space', ' '], ['three spaces', '   '], ['a tab', '\t'], ['a line feed', '\n'], ['a carriage return and a line feed', '\r\n'], ['mixed', ' \t\n ']];
  for (const slot of ['afterHead', 'beforeSemi', 'afterSemi', 'afterBlobWord']) {
    for (const [name, space] of spaces) {
      it(`read: ${name} in the slot ${slot}`, () => readsFrom(header('docs/a.md', BLOB, { [slot]: space }), { source: 'docs/a.md', blob: BLOB }));
    }
  }
  it('read: leading and trailing whitespace of the comment of every kind', () => {
    for (const [lead, trail] of [['', ''], ['  ', '  '], ['\t', '\t'], ['\n', '\n'], ['\n\n  ', ' \n\n']]) readsFrom(`<!--${lead}translated-from: docs/a.md; blob: ${BLOB}${trail}-->`, { source: 'docs/a.md', blob: BLOB });
  });
  it('read: a header over several lines', () => readsFrom(`<!--\ntranslated-from:\n  docs/a.md\n;\n  blob:\n  ${BLOB}\n-->`, { source: 'docs/a.md', blob: BLOB }));
  for (const [name, comment] of [
    ['the semicolon is a comma', header('docs/a.md', BLOB).replace(';', ',')],
    ['two semicolons', header('docs/a.md', BLOB).replace(';', ';;')],
    ['the word blob is in upper case', header().replace('blob:', 'Blob:')],
    ['the word blob has no colon', header().replace('blob:', 'blob')],
    ['the word blob is another word', header().replace('blob:', 'hash:')],
    ['the word blob is cut', header().replace('blob:', 'blo:')],
    ['text between the semicolon and the word blob', header().replace('; blob:', '; x blob:')],
    ['text before the source', header().replace('translated-from: ', 'translated-from: x ')],
    ['two sources', header('docs/a.md docs/b.md')],
    ['the blob is empty', header('docs/a.md', '')],
    ['the blob is a word', header('docs/a.md', 'blob')],
    ['the blob is 40 characters and then more', header('docs/a.md', `${BLOB}a`)],
    ['the blob is 80 hex digits', header('docs/a.md', BLOB + BLOB)],
    ['the blob is 20 hex digits', header('docs/a.md', BLOB.slice(0, 20))],
    ['the blob is 1 hex digit', header('docs/a.md', 'a')],
    ['the blob has a space inside', header('docs/a.md', `${BLOB.slice(0, 20)} ${BLOB.slice(20)}`)],
  ]) it(`throws: malformed header, ${name}`, () => rejectsHeader(comment));

  const HEX = '0123456789abcdef';
  for (const digit of HEX) it(`read: the blob made of the digit ${digit} only`, () => readsFrom(header('docs/a.md', digit.repeat(40)), { source: 'docs/a.md', blob: digit.repeat(40) }));
  it('read: a blob with every hex digit in it', () => readsFrom(header('docs/a.md', HEX + HEX + HEX.slice(0, 8)), { source: 'docs/a.md', blob: HEX + HEX + HEX.slice(0, 8) }));
  // Every printable ASCII character that is not a lower-case hex digit is rejected in the first, the middle and the last place of the blob.
  for (let code = 0x20; code <= 0x7e; code++) {
    const ch = String.fromCharCode(code);
    if (HEX.includes(ch)) continue;
    it(`throws: malformed header, the blob holds ${JSON.stringify(ch)}`, () => {
      for (const blob of [ch + 'a'.repeat(39), 'a'.repeat(20) + ch + 'a'.repeat(19), 'a'.repeat(39) + ch]) rejectsHeader(header('docs/a.md', blob));
    });
  }
  for (const ch of ['\u00e9', '\u0131', '\u0660', '\uff10', '\u00a0']) {
    it(`throws: malformed header, the blob holds U+${hex4(ch.charCodeAt(0))}`, () => {
      for (const blob of [ch + 'a'.repeat(39), 'a'.repeat(20) + ch + 'a'.repeat(19), 'a'.repeat(39) + ch]) rejectsHeader(header('docs/a.md', blob));
    });
  }

  // The source: letters, digits, `.`, `_`, `-` and `/` are read; every other printable ASCII character and a few others are malformed, one row per character.
  const ALLOWED_SOURCE = new Set([...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-/']);
  for (let code = 0x20; code <= 0x7e; code++) {
    const ch = String.fromCharCode(code);
    // A space is whitespace to the header, so at either end of the source it is a separator; inside the source it is malformed.
    const places = /\s/.test(ch) ? [`x${ch}y.md`] : [ch, `${ch}x.md`, `x${ch}y.md`, `x.m${ch}`];
    if (ALLOWED_SOURCE.has(ch)) {
      it(`read: the source character ${JSON.stringify(ch)} in every place`, () => {
        for (const source of places) readsFrom(header(source), { source, blob: BLOB });
      });
    } else {
      it(`throws: malformed header, the source holds ${JSON.stringify(ch)}`, () => {
        for (const source of places) rejectsHeader(header(source));
      });
    }
  }
  for (const ch of ['\u00e9', '\u0131', '\u00a0', '\u2215', '\uff0f', '\u2010', '\u0660', '\uff21', '\t']) {
    it(`throws: malformed header, the source holds U+${hex4(ch.charCodeAt(0))}`, () => {
      for (const source of /\s/.test(ch) ? [`x${ch}y.md`] : [`${ch}x.md`, `x${ch}y.md`, `x.m${ch}`]) rejectsHeader(header(source));
    });
  }
  it('read: a source of one character of each kind', () => {
    for (const source of ['a', 'Z', '0', '9', '.', '_', '-', '/', '..', '../a.md', './a.md', '/a.md', 'a/', 'docs/guides/tr/x_y-z.9.md']) readsFrom(header(source), { source, blob: BLOB });
  });

  it('throws: a second header whose own text is malformed names the malformed header, not the second one', () => {
    const error = thrown(() => doc(`${HEADER}\n\ntext\n\n<!-- translated-from: bad -->\n`));
    assert.match(error.message, /^transform: docs\/test\.md:5: malformed translated-from header$/);
  });
  it('throws: a second valid header names the line of the second one', () => {
    assert.match(thrown(() => doc(`${HEADER}\n\n${HEADER}\n`)).message, /^transform: docs\/test\.md:3: a second translated-from header$/);
  });
  it('a second header of another source is also a second header', () => {
    assert.match(thrown(() => doc(`${HEADER}\n\n<!-- translated-from: docs/other.md; blob: ${'a'.repeat(40)} -->\n`)).message, /a second translated-from header$/);
  });
  it('fragment mode: a header of any shape is dropped and never read', () => {
    for (const comment of [HEADER, header('docs/a b.md'), '<!-- translated-from -->', `<!-- translated-from: bad translated-from: docs/a.md; blob: ${BLOB} -->`]) {
      assert.equal(renderMarkdown(`before\n\n${comment}\n\nafter`), '<p>before</p>\n<p>after</p>');
    }
  });
  it('read: the header comes out in the result and the comment leaves no trace in the html', () => {
    const result = doc(`before\n\n${HEADER}\n\nafter`);
    assert.deepEqual(result.translatedFrom, { source: 'docs/guides/daily-use.md', blob: BLOB });
    assert.equal(result.html, '<p>before</p>\n<p>after</p>');
  });

  // ---- closed world, round 3: the characters outside ASCII in every class of the header ----

  it('the representative of each general category belongs to it, and the sweep holds every category', () => {
    for (const [category, ch] of Object.entries(CATEGORY)) assert.ok(new RegExp(`^\\p{${category}}$`, 'u').test(ch), `${category} ${label(ch)}`);
    assert.equal(Object.keys(CATEGORY).length, 30);
    assert.ok(SWEEP.length > 200);
  });
  for (const ch of SWEEP) {
    const space = JS_SPACE.has(ch);
    if (space) {
      it(`${label(ch)} is white space: read in every separator slot, malformed inside the source and inside the blob`, () => {
        for (const slot of ['afterHead', 'beforeSemi', 'afterSemi', 'afterBlobWord']) readsFrom(header('docs/a.md', BLOB, { [slot]: ch }), { source: 'docs/a.md', blob: BLOB });
        rejectsHeader(header(`x${ch}y.md`));
        for (const blob of [ch + 'a'.repeat(39), 'a'.repeat(20) + ch + 'a'.repeat(19)]) rejectsHeader(header('docs/a.md', blob));
        readsFrom(header('docs/a.md', BLOB + ch), { source: 'docs/a.md', blob: BLOB });
      });
    } else {
      it(`${label(ch)} is not white space: malformed in the source, the blob and every separator slot`, () => {
        for (const source of [`${ch}x.md`, `x${ch}y.md`, `x.m${ch}`, ch]) rejectsHeader(header(source));
        for (const blob of [ch + 'a'.repeat(39), 'a'.repeat(20) + ch + 'a'.repeat(19), 'a'.repeat(39) + ch, 'a'.repeat(40) + ch, ch + 'a'.repeat(40)]) rejectsHeader(header('docs/a.md', blob));
        for (const slot of ['afterHead', 'beforeSemi', 'afterSemi', 'afterBlobWord']) rejectsHeader(header('docs/a.md', BLOB, { [slot]: ch }));
      });
    }
  }
  // Look-alikes of the head, the hyphen, the colon, the semicolon and the word blob: the first four make an ordinary comment or a malformed header, never a header.
  for (const ch of ['\u2010', '\u2011', '\u2012', '\u2013', '\u2212', '\ufe63', '\uff0d', '\u00ad']) {
    it(`an ordinary comment: the hyphen of the head is ${label(ch)}`, () => {
      const result = doc(around(header('docs/a.md', BLOB, { head: `translated${ch}from:` })));
      assert.equal(result.translatedFrom, null);
      assert.equal(result.html, '<p>before</p>\n<p>after</p>');
    });
  }
  for (const ch of ['\uff1a', '\ua789', '\ufe55', '\u2236']) it(`throws: malformed header, the colon of the head is ${label(ch)}`, () => rejectsHeader(header('docs/a.md', BLOB, { head: `translated-from${ch}` })));
  for (const ch of ['\u037e', '\uff1b', '\u061b', '\ufe54']) it(`throws: malformed header, the semicolon is ${label(ch)}`, () => rejectsHeader(header('docs/a.md', BLOB).replace(';', ch)));
  for (const ch of ['\uff1a', '\ua789', '\ufe55', '\u2236', '\u200b']) it(`throws: malformed header, the colon of blob is ${label(ch)}`, () => rejectsHeader(header('docs/a.md', BLOB).replace('blob:', `blob${ch}`)));
  // The header is the whole comment text, not one line of it: a line break (of any kind that a multi-line regular expression knows) before more text is malformed.
  for (const [name, lineTerminator] of [['a line feed', '\n'], ['a carriage return', '\r'], ['a carriage return line feed', '\r\n'], ['a line separator', '\u2028'], ['a paragraph separator', '\u2029'], ['two line feeds', '\n\n'], ['a line feed and spaces', '\n  ']]) {
    it(`throws: malformed header, ${name} and more text after the blob`, () => {
      rejectsHeader(`<!-- translated-from: docs/a.md; blob: ${BLOB}${lineTerminator}more -->`);
      rejectsHeader(`<!-- translated-from: docs/a.md; blob: ${BLOB}${lineTerminator}x: ${BLOB} -->`);
      rejectsHeader(`<!-- translated-from: docs/a.md; blob: ${BLOB}${lineTerminator}translated-from: docs/b.md; blob: ${BLOB} -->`);
    });
    it(`throws: malformed header, ${name} and more text before the next part of the header`, () => {
      rejectsHeader(`<!-- translated-from: docs/a.md${lineTerminator}x; blob: ${BLOB} -->`);
      rejectsHeader(`<!-- translated-from: docs/a.md; blob: ${lineTerminator}x ${BLOB} -->`);
    });
  }
  // A hand-built html node whose value is not a string, or is a string with white space around it: the value is read as the text of its string form, trimmed.
  for (const [name, value, dropped] of [
    ['an array of one comment', ['<!-- c -->'], true], ['an array of one comment with an early close', ['<!-- a --!> b -->'], false], ['an object that prints as a comment', { toString: () => '<!-- c -->' }, true], ['an object that prints as a comment with an early close', { toString: () => '<!-- a --!> b -->' }, false],
    ['a String object that is a comment with white space around it', new String(' \n<!-- c -->\t '), true], ['a comment with white space of every kind around it', ' \u00a0\u2028\n\t<!-- c -->\r \u3000\ufeff', true], ['a comment with spaces in front', '   <!-- c -->', true], ['a comment with spaces behind', '<!-- c -->   ', true],
    ['a comment with a line break behind', '<!-- c -->\n', true], ['a comment with a line break in front', '\n<!-- c -->', true], ['a comment with another comment behind', '<!-- c --><!-- d -->', false], ['a comment with text behind', '<!-- c --> x', false], ['a comment with text in front', 'x <!-- c -->', false],
    ['a comment with an early close and white space around it', ' <!-- a --!> b --> ', false], ['an unclosed comment', '<!-- c', false], ['an unclosed comment with white space', '  <!-- c  ', false],
  ]) {
    it(`a hand-built html node holding ${name} is ${dropped ? 'a comment and dropped' : 'not a comment and shown as text'}`, () => {
      const asNode = (node) => renderTree({ type: 'root', children: [{ type: 'paragraph', children: [node] }] }, { path: PATH }).html;
      const block = (node) => renderTree({ type: 'root', children: [node] }, { path: PATH }).html;
      assert.equal(asNode({ type: 'html', value }), dropped ? '<p></p>' : asNode({ type: 'text', value: String(value) }));
      assert.equal(block({ type: 'html', value }), dropped ? '' : block({ type: 'paragraph', children: [{ type: 'text', value: String(value) }] }));
    });
  }
  for (const [name, wrap] of [['no white space', (c) => c], ['spaces', (c) => `  ${c}  `], ['line breaks', (c) => `\n${c}\n`], ['a tab and a no-break space', (c) => `\t${c}\u00a0`], ['a BOM and an ideographic space', (c) => `\ufeff${c}\u3000`]]) {
    it(`a hand-built header comment with ${name} around it is read`, () => {
      const node = { type: 'html', value: wrap(`<!-- translated-from: docs/a.md; blob: ${BLOB} -->`) };
      assert.deepEqual(renderTree({ type: 'root', children: [node] }, { path: PATH }).translatedFrom, { source: 'docs/a.md', blob: BLOB });
      assert.deepEqual(renderTree({ type: 'root', children: [{ type: 'paragraph', children: [node] }] }, { path: PATH }).translatedFrom, { source: 'docs/a.md', blob: BLOB });
    });
  }
  it('the position of a malformed or a second header is the line of its own comment, below any parent', () => {
    const bad = '<!-- translated-from: x -->';
    assert.match(thrown(() => doc(`a\n\n> b\n>\n> ${bad}`)).message, /^transform: docs\/test\.md:5: malformed translated-from header$/);
    assert.match(thrown(() => doc(`- a\n\n  ${bad}`)).message, /^transform: docs\/test\.md:3: malformed translated-from header$/);
    assert.match(thrown(() => doc(`${bad}`)).message, /^transform: docs\/test\.md:1: malformed translated-from header$/);
    assert.match(thrown(() => doc(`${HEADER}\n\n> b\n>\n> ${HEADER}`)).message, /^transform: docs\/test\.md:5: a second translated-from header$/);
  });

  // The ends of the comment: `trim()` removes exactly the white space of a regular expression; any other character at an end is text, so it is no comment, no header or a malformed one.
  for (const ch of SWEEP) {
    const space = JS_SPACE.has(ch);
    it(`${label(ch)} at the start and at the end of a comment is ${space ? 'white space: the header is read' : 'text: an ordinary comment at the start, a malformed header at the end'}`, () => {
      const expected = { source: 'docs/a.md', blob: BLOB };
      if (space) {
        for (const [lead, trail] of [[ch, ''], ['', ch], [ch, ch], [ch + ch, ch + ch]]) readsFrom(`<!--${lead}translated-from: docs/a.md; blob: ${BLOB}${trail}-->`, expected);
      } else {
        const result = doc(around(`<!--${ch}translated-from: docs/a.md; blob: ${BLOB}-->`));
        assert.equal(result.translatedFrom, null);
        assert.equal(result.html, '<p>before</p>\n<p>after</p>');
        rejectsHeader(`<!--translated-from: docs/a.md; blob: ${BLOB}${ch}-->`);
      }
    });
    it(`${label(ch)} around a hand-built html node that is a comment ${space ? 'is white space: the comment is dropped' : 'is text: the node is shown as text'}`, () => {
      const value = `${ch}<!-- c -->${ch}`;
      const asNode = (node) => renderTree({ type: 'root', children: [{ type: 'paragraph', children: [node] }] }, { path: PATH }).html;
      assert.equal(asNode({ type: 'html', value }), space ? '<p></p>' : asNode({ type: 'text', value }));
      assert.equal(renderTree({ type: 'root', children: [{ type: 'html', value }] }, { path: PATH }).html, space ? '' : asNode({ type: 'text', value }));
    });
  }
});

// ---- U4: links and images ---------------------------------------------------------------------------------------------------------------------------------

describe('link and image rule table', () => {
  const kinds = sections('node-kinds.md');
  const link = (url, line, rendered, kind = 'link') => ({ kind, url, line, rendered });
  const rows = [
    ['an inline link', '[a](https://example.com/)', '<p><a href="https://example.com/">a</a></p>', [link('https://example.com/', 1, true)]],
    ['an inline link with an unsafe target shows its label', '[x](javascript:alert(1))', '<p>x</p>', [link('javascript:alert(1)', 1, false)]],
    ['an unsafe link keeps the markup of its label', '[**x**](javascript:alert(1))', '<p><strong>x</strong></p>', [link('javascript:alert(1)', 1, false)]],
    ['a link title is not copied', kinds.get('link-title'), '<p><a href="https://example.com/">a</a></p>\n', [link('https://example.com/', 1, true)]],
    ['references: full, shortcut and collapsed', kinds.get('reference-safe'), '<p>See <a href="https://example.com/guide">the guide</a> and <a href="../other.md">shortcut</a> and <a href="#top">collapsed</a>.</p>', [link('https://example.com/guide', 3, true), link('../other.md', 4, true), link('#top', 5, true)]],
    ['a reference with an unsafe definition shows its label', kinds.get('reference-unsafe'), '<p>See the guide.</p>', [link('javascript:alert(1)', 3, false)]],
    ['angle autolinks: safe, unsafe scheme and path:line', kinds.get('angle-autolinks'), '<p><a href="https://example.com/">https://example.com/</a> and &#x3C;javascript:alert(1)> and &#x3C;path:line></p>', [link('https://example.com/', 1, true), link('javascript:alert(1)', 1, false), link('path:line', 1, false)]],
    ['autolink literals', kinds.get('literals'), '<p><a href="http://www.example.com">www.example.com</a> and <a href="https://example.com">https://example.com</a> and <a href="mailto:a@example.com">a@example.com</a></p>', [link('http://www.example.com', 1, true), link('https://example.com', 1, true), link('mailto:a@example.com', 1, true)]],
    ['an image is a link with its alt text', fixture('image.md'), '<p><a href="https://example.com/a.png">alt text</a></p>', [link('https://example.com/a.png', 1, true, 'image')]],
    ['an image with an unsafe target shows its alt text', '![alt](javascript:alert(1))', '<p>alt</p>', [link('javascript:alert(1)', 1, false, 'image')]],
    ['an image with an empty alt text shows its target', kinds.get('image-empty-alt'), '<p><a href="https://example.com/a.png">https://example.com/a.png</a></p>', [link('https://example.com/a.png', 1, true, 'image')]],
    ['an image inside a link is text, in tree order', kinds.get('image-in-link'), '<p><a href="https://example.com/">alt text</a></p>', [link('https://example.com/', 1, true), link('https://example.com/a.png', 1, false, 'image')]],
    ['html inside a label is text', kinds.get('html-in-label'), '<p><a href="https://example.com/">&#x3C;img src=x onerror=alert(1)></a></p>', [link('https://example.com/', 1, true)]],
    ['an image reference', '![alt][i]\n\n[i]: https://example.com/i.png', '<p><a href="https://example.com/i.png">alt</a></p>', [link('https://example.com/i.png', 3, true, 'image')]],
    ['an image reference with an unsafe definition', '![alt][i]\n\n[i]: javascript:alert(1)', '<p>alt</p>', [link('javascript:alert(1)', 3, false, 'image')]],
    ['the line of a target is the line where it is written', '[a\nb](https://example.com/)', '<p><a href="https://example.com/">a\nb</a></p>', [link('https://example.com/', 2, true)]],
    ['a target with a space keeps its decoded form in the list', '[a](<../my file.md>)', '<p><a href="../my%20file.md">a</a></p>', [link('../my file.md', 1, true)]],
    ['mailto in mixed case is unchanged', '[m](MailTo:a@example.com)', '<p><a href="MailTo:a@example.com">m</a></p>', [link('MailTo:a@example.com', 1, true)]],
    ['two links on different lines each have the line of their own target', '[a](https://a.example/)\n\ntext\n\n[b](https://b.example/)', '<p><a href="https://a.example/">a</a></p>\n<p>text</p>\n<p><a href="https://b.example/">b</a></p>', [link('https://a.example/', 1, true), link('https://b.example/', 5, true)]],
    ['a target on the line after the opening parenthesis has that line', '[a](\nhttps://example.com/)', '<p><a href="https://example.com/">a</a></p>', [link('https://example.com/', 2, true)]],
    ['a target after spaces and a line break has the line where it starts', '[a](  \n  https://example.com/)', '<p><a href="https://example.com/">a</a></p>', [link('https://example.com/', 2, true)]],
    ['a lone carriage return is a line break for the line of a target', '[a](https://a.example/)\r\r[b](https://b.example/)', '<p><a href="https://a.example/">a</a></p>\n<p><a href="https://b.example/">b</a></p>', [link('https://a.example/', 1, true), link('https://b.example/', 3, true)]],
    ['carriage return line feed is one line break for the line of a target', '[a](https://a.example/)\r\n\r\n[b](https://b.example/)', '<p><a href="https://a.example/">a</a></p>\n<p><a href="https://b.example/">b</a></p>', [link('https://a.example/', 1, true), link('https://b.example/', 3, true)]],
    ['an image whose alt text spans two lines has the line of its target', '![a\nb](https://e.com/i.png)', '<p><a href="https://e.com/i.png">a\nb</a></p>', [link('https://e.com/i.png', 2, true, 'image')]],
    ['an image after a link on an earlier line has the line of its own target', '[a](https://a.example/)\n\n![b](https://e.com/i.png)', '<p><a href="https://a.example/">a</a></p>\n<p><a href="https://e.com/i.png">b</a></p>', [link('https://a.example/', 1, true), link('https://e.com/i.png', 3, true, 'image')]],
    ['duplicate definitions: the first one wins', '[a][x]\n\n[x]: https://first.com/\n[x]: https://second.com/', '<p><a href="https://first.com/">a</a></p>', [link('https://first.com/', 3, true)]],
    ['duplicate definitions: the first one wins whatever the case of the label', '[a][X]\n\n[x]: https://first.com/\n[X]: https://second.com/', '<p><a href="https://first.com/">a</a></p>', [link('https://first.com/', 3, true)]],
    ['duplicate definitions: an unsafe first one is not replaced by a safe second one', '[a][x]\n\n[x]: javascript:alert(1)\n[x]: https://second.com/', '<p>a</p>', [link('javascript:alert(1)', 3, false)]],
    ['duplicate definitions: an image reference takes the first one too', '![a][x]\n\n[x]: https://first.com/i.png\n[x]: https://second.com/i.png', '<p><a href="https://first.com/i.png">a</a></p>', [link('https://first.com/i.png', 3, true, 'image')]],
  ];
  for (const [name, source, expected, links] of rows) {
    it(name, () => {
      const result = doc(source);
      assert.equal(result.html.trimEnd(), expected.trimEnd());
      assert.deepEqual(result.links, links);
      assert.equal(dom(result.html)('img, [title]').length, 0);
    });
  }

  it('an image reference without a definition shows its source text', () => {
    const source = 'see ![x][nope] ok';
    const result = renderTree({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'see ' }, { type: 'imageReference', identifier: 'nope', label: 'nope', referenceType: 'full', alt: 'x', position: { start: { line: 1, column: 5, offset: 4 }, end: { line: 1, column: 15, offset: 14 } } }] }] }, { path: PATH, source });
    assert.equal(result.html, '<p>see ![x][nope]</p>');
    assert.deepEqual(result.links, []);
  });

  it('rewrite is called once per rendered target, in tree order, with the path, the line and the kind', () => {
    const calls = [];
    const source = 'See [a](docs/a.md) and ![i](img/i.png) and [bad](javascript:x) and <https://example.com/> and [![in](x.png)](y.md).\n\n[r]\n\n[r]: z.md';
    const result = doc(source, { rewrite: (url, info) => { calls.push([url, info]); return `/base/${url}`; } });
    assert.deepEqual(calls, [
      ['docs/a.md', { path: PATH, line: 1, kind: 'link' }],
      ['img/i.png', { path: PATH, line: 1, kind: 'image' }],
      ['https://example.com/', { path: PATH, line: 1, kind: 'link' }],
      ['y.md', { path: PATH, line: 1, kind: 'link' }],
      ['z.md', { path: PATH, line: 5, kind: 'link' }],
    ]);
    assert.deepEqual(dom(result.html)('a').toArray().map((a) => a.attribs.href), ['/base/docs/a.md', '/base/img/i.png', '/base/https://example.com/', '/base/y.md', '/base/z.md']);
    assert.deepEqual(result.links.map((l) => [l.url, l.rendered]), [['docs/a.md', true], ['img/i.png', true], ['javascript:x', false], ['https://example.com/', true], ['y.md', true], ['x.png', false], ['z.md', true]], 'the list holds the original targets');
  });

  it('rewrite never sees an unsafe target and cannot make one a link', () => {
    const calls = [];
    const result = doc('[x](javascript:alert(1)) and ![i](data:text/html,x)', { rewrite: (url) => { calls.push(url); return 'https://ok.example/'; } });
    assert.deepEqual(calls, []);
    assert.equal(dom(result.html)('a').length, 0);
    assert.equal(visible(result.html), 'x and i');
  });

  const unsafeResults = [['javascript:alert(1)'], ['ftp://example.com/'], [undefined], [42], [null]];
  for (const [value] of unsafeResults) {
    it(`throws when rewrite returns ${String(value)}`, () => {
      const error = thrown(() => doc('\n\n[a](docs/a.md)', { rewrite: () => value }));
      assert.match(error.message, /^transform: docs\/test\.md:3: rewrite returned an unsafe target$/);
    });
  }

  it('an unsafe rewrite result throws for an image too', () => {
    assert.match(thrown(() => doc('![a](a.png)', { rewrite: () => 'javascript:x' })).message, /^transform: docs\/test\.md:1: rewrite returned an unsafe target$/);
  });

  it('a throw of rewrite propagates unchanged', () => {
    const boom = new Error('boom from rewrite');
    assert.equal(thrown(() => doc('[a](docs/a.md)', { rewrite: () => { throw boom; } })), boom);
  });

  it('a rewrite that returns the target unchanged gives the same html as no rewrite', () => {
    const source = fixture('links.md');
    assert.equal(doc(source, { rewrite: (url) => url }).html, doc(source).html);
  });

  it('every section of node-kinds.md renders without an element of the source', () => {
    assert.ok(kinds.size >= 14);
    for (const [name, source] of kinds) {
      const { html } = doc(source);
      assert.equal(dom(html)(FORBIDDEN).length, 0, name);
      assert.deepEqual(attributeNames(dom(html)).filter((n) => n !== 'href' && n !== 'align' && n !== 'id'), [], name);
    }
  });

  // ---- closed world: the in-link flag, the definitions, the lines of the targets, the labels of images, rewrite ----
  const IMG = 'https://e.com/x.png';
  const moreRows = [
    ['an image in a reference link is text, not a nested anchor', `[![a](${IMG})][r]\n\n[r]: https://e.com/`, '<p><a href="https://e.com/">a</a></p>', [link('https://e.com/', 3, true), link(IMG, 1, false, 'image')]],
    ['an image reference in an inline link is text, not a nested anchor', '[![a][i]](https://e.com/)\n\n[i]: https://e.com/i.png', '<p><a href="https://e.com/">a</a></p>', [link('https://e.com/', 1, true), link('https://e.com/i.png', 3, false, 'image')]],
    ['an image reference in a reference link is text, not a nested anchor', '[![a][i]][r]\n\n[i]: https://e.com/i.png\n[r]: https://e.com/', '<p><a href="https://e.com/">a</a></p>', [link('https://e.com/', 4, true), link('https://e.com/i.png', 3, false, 'image')]],
    ['an image in a link with an unsafe target is text, and so is the link', `[![a](${IMG})](javascript:alert(1))`, '<p>a</p>', [link('javascript:alert(1)', 1, false), link(IMG, 1, false, 'image')]],
    ['an image in a reference link with an unsafe definition is text, and so is the link', `[![a](${IMG})][r]\n\n[r]: javascript:alert(1)`, '<p>a</p>', [link('javascript:alert(1)', 3, false), link(IMG, 1, false, 'image')]],
    ['an image reference in an inline link with an unsafe target is text', '[![a][i]](javascript:alert(1))\n\n[i]: https://e.com/i.png', '<p>a</p>', [link('javascript:alert(1)', 1, false), link('https://e.com/i.png', 3, false, 'image')]],
    ['an image in strong in a reference link is text', `[**![a](${IMG})**][r]\n\n[r]: https://e.com/`, '<p><a href="https://e.com/"><strong>a</strong></a></p>', [link('https://e.com/', 3, true), link(IMG, 1, false, 'image')]],
    ['an image with an unsafe target in a link is text and is not rendered either way', '[![a](javascript:x)](https://e.com/)', '<p><a href="https://e.com/">a</a></p>', [link('https://e.com/', 1, true), link('javascript:x', 1, false, 'image')]],
    ['the second image of a link is text as well as the first', `[![a](${IMG})![b](${IMG})](https://e.com/)`, '<p><a href="https://e.com/">ab</a></p>', [link('https://e.com/', 1, true), link(IMG, 1, false, 'image'), link(IMG, 1, false, 'image')]],
    ['an image after a link is not in the link', `[a](https://e.com/) ![b](${IMG})`, `<p><a href="https://e.com/">a</a> <a href="${IMG}">b</a></p>`, [link('https://e.com/', 1, true), link(IMG, 1, true, 'image')]],
    ['an image before a link is not in the link', `![b](${IMG}) [a](https://e.com/)`, `<p><a href="${IMG}">b</a> <a href="https://e.com/">a</a></p>`, [link(IMG, 1, true, 'image'), link('https://e.com/', 1, true)]],
    ['an image with markup in its alt text shows the alt text as written', '![a <b>](https://e.com/i.png)', '<p><a href="https://e.com/i.png">a &#x3C;b></a></p>', [link('https://e.com/i.png', 1, true, 'image')]],
    ['an image with emphasis in its alt text shows the plain alt text', '![*a*](https://e.com/i.png)', '<p><a href="https://e.com/i.png">a</a></p>', [link('https://e.com/i.png', 1, true, 'image')]],
    ['a shortcut image reference', '![a]\n\n[a]: https://e.com/i.png', '<p><a href="https://e.com/i.png">a</a></p>', [link('https://e.com/i.png', 3, true, 'image')]],
    ['a collapsed image reference', '![a][]\n\n[a]: https://e.com/i.png', '<p><a href="https://e.com/i.png">a</a></p>', [link('https://e.com/i.png', 3, true, 'image')]],
    ['a definition title is not copied', '[a]\n\n[a]: https://e.com/ "t"', '<p><a href="https://e.com/">a</a></p>', [link('https://e.com/', 3, true)]],
    ['a definition target in angle brackets keeps its decoded form in the list', '[a][r]\n\n[r]: <https://e.com/a b>', '<p><a href="https://e.com/a%20b">a</a></p>', [link('https://e.com/a b', 3, true)]],
    ['a definition target that is a path', '[a][r]\n\n[r]: /x', '<p><a href="/x">a</a></p>', [link('/x', 3, true)]],
    ['a link with an empty label', '[](https://e.com/)', '<p><a href="https://e.com/"></a></p>', [link('https://e.com/', 1, true)]],
    ['a link on a later line with an empty label has the line of its target', '\n\n[](https://e.com/)', '<p><a href="https://e.com/"></a></p>', [link('https://e.com/', 3, true)]],
    ['a link with an angle target holding spaces around it', '[a]( <b> )', '<p><a href="b">a</a></p>', [link('b', 1, true)]],
    ['the first definition in document order wins when it is inside a block quote', '> [x]: https://first.com/\n\n[x]: https://second.com/\n\n[a][x]', '<blockquote>\n</blockquote>\n<p><a href="https://first.com/">a</a></p>', [link('https://first.com/', 1, true)]],
    ['the first definition in document order wins when it is at the top', '[x]: https://first.com/\n\n> [x]: https://second.com/\n\n[a][x]', '<blockquote>\n</blockquote>\n<p><a href="https://first.com/">a</a></p>', [link('https://first.com/', 1, true)]],
    ['the first definition wins over a later one in a list and a block quote', '- [x]: https://first.com/\n\n> [x]: https://second.com/\n\n[a][x]', '<ul>\n<li></li>\n</ul>\n<blockquote>\n</blockquote>\n<p><a href="https://first.com/">a</a></p>', [link('https://first.com/', 1, true)]],
    ['an angle autolink with a data target is shown with its brackets', '<data:text/html,x>', '<p>&#x3C;data:text/html,x></p>', [link('data:text/html,x', 1, false)]],
    ['an angle autolink with an ftp target is shown with its brackets', '<ftp://e.com/>', '<p>&#x3C;ftp://e.com/></p>', [link('ftp://e.com/', 1, false)]],
    ['an angle autolink with a script scheme in upper case is shown with its brackets', '<JAVASCRIPT:x>', '<p>&#x3C;JAVASCRIPT:x></p>', [link('JAVASCRIPT:x', 1, false)]],
    ['an angle autolink of an address is a mailto link', '<a@b.com>', '<p><a href="mailto:a@b.com">a@b.com</a></p>', [link('mailto:a@b.com', 1, true)]],
    ['an angle autolink with mailto is a link', '<mailto:a@b.com>', '<p><a href="mailto:a@b.com">mailto:a@b.com</a></p>', [link('mailto:a@b.com', 1, true)]],
    ['an angle autolink in upper case is unchanged', '<HTTP://E.COM/>', '<p><a href="HTTP://E.COM/">HTTP://E.COM/</a></p>', [link('HTTP://E.COM/', 1, true)]],
    ['an ampersand in a target is escaped in the attribute and kept in the list', '<https://e.com/a?x=1&y=2>', '<p><a href="https://e.com/a?x=1&#x26;y=2">https://e.com/a?x=1&#x26;y=2</a></p>', [link('https://e.com/a?x=1&y=2', 1, true)]],
    ['an autolink literal on a later line has the line of its start', '\n\nsee www.example.com', '<p>see <a href="http://www.example.com">www.example.com</a></p>', [link('http://www.example.com', 3, true)]],
    ['an autolink literal on the second line of a paragraph', 'a\nb www.example.com', '<p>a\nb <a href="http://www.example.com">www.example.com</a></p>', [link('http://www.example.com', 2, true)]],
    ['an angle autolink on a later line has the line of its start', '\n\n<https://example.com/>', '<p><a href="https://example.com/">https://example.com/</a></p>', [link('https://example.com/', 3, true)]],
    ['an unsafe angle autolink on a later line has the line of its start', '\n\n<javascript:x>', '<p>&#x3C;javascript:x></p>', [link('javascript:x', 3, false)]],
    ['a label that holds an escaped bracket and a parenthesis: the line is the line of the real target', '[a\\](x\nb](https://e.com/)', '<p><a href="https://e.com/">a](x\nb</a></p>', [link('https://e.com/', 2, true)]],
    ['a one-letter target followed by a line break is on its own line', '[a](x\n)', '<p><a href="x">a</a></p>', [link('x', 1, true)]],
    ['a tab and a line break before the target', '[a](\t\nhttps://e.com/)', '<p><a href="https://e.com/">a</a></p>', [link('https://e.com/', 2, true)]],
    ['a tab before the target on the same line', '[a](\thttps://e.com/)', '<p><a href="https://e.com/">a</a></p>', [link('https://e.com/', 1, true)]],
    ['a title on the next line does not move the target', '[a](https://e.com/\n"t")', '<p><a href="https://e.com/">a</a></p>', [link('https://e.com/', 1, true)]],
    ['two links on one line have the same line', '[x](y) [a](https://e.com/)', '<p><a href="y">x</a> <a href="https://e.com/">a</a></p>', [link('y', 1, true), link('https://e.com/', 1, true)]],
    ['an image with a one-letter target followed by a line break', '![a](x\n)', '<p><a href="x">a</a></p>', [link('x', 1, true, 'image')]],
    ['an image with the target on the next line', '![a](\nhttps://e.com/i.png)', '<p><a href="https://e.com/i.png">a</a></p>', [link('https://e.com/i.png', 2, true, 'image')]],
    ['an image with spaces and a line break before the target', '![a](  \n  https://e.com/i.png)', '<p><a href="https://e.com/i.png">a</a></p>', [link('https://e.com/i.png', 2, true, 'image')]],
  ];
  for (const [name, source, expected, links] of moreRows) {
    it(name, () => {
      const result = doc(source);
      assert.equal(result.html.trimEnd(), expected.trimEnd());
      assert.deepEqual(result.links, links);
      assert.equal(dom(result.html)('img, [title]').length, 0);
      assert.equal(dom(result.html)('a a').length, 0, 'no anchor inside an anchor');
    });
  }

  // Hand-built trees: the same rules on shapes a parser does not make, so that every branch of the pass has a row.
  const T = (...c) => ({ type: 'root', children: c });
  const P_ = (...c) => ({ type: 'paragraph', children: c });
  const X = { type: 'text', value: 'x' };
  const def = (identifier, url) => ({ type: 'definition', identifier, url });
  const mk = {
    link: (url, ...children) => ({ type: 'link', url, children }),
    ref: (identifier, ...children) => ({ type: 'linkReference', identifier, children }),
    img: (url, alt = 'i') => ({ type: 'image', url, alt }),
    iref: (identifier, alt = 'i') => ({ type: 'imageReference', identifier, alt }),
  };
  const built = (tree, options = {}) => renderTree(tree, { path: PATH, ...options });
  const A = 'https://a.example/';
  const B = 'https://b.example/';
  const BI = 'https://b.example/i.png';
  const one = { html: `<p><a href="${A}">x</a></p>`, links: [link(A, null, true), link(B, null, false)] };
  const nested = [
    ['a link in a link', T(P_(mk.link(A, mk.link(B, X))))],
    ['a link reference in a link', T(P_(mk.link(A, mk.ref('r', X))), def('r', B))],
    ['a link in a link reference', T(P_(mk.ref('r', mk.link(B, X))), def('r', A))],
    ['a link reference in a link reference', T(P_(mk.ref('r', mk.ref('s', X))), def('r', A), def('s', B))],
  ];
  for (const [name, tree] of nested) it(`${name} is text, the outer one is the anchor`, () => {
    const result = built(tree);
    assert.equal(result.html, one.html);
    assert.deepEqual(result.links, one.links);
  });
  const imageKinds = [
    ['an image in a link', T(P_(mk.link(A, mk.img(BI))))],
    ['an image reference in a link', T(P_(mk.link(A, mk.iref('s'))), def('s', BI))],
    ['an image in a link reference', T(P_(mk.ref('r', mk.img(BI))), def('r', A))],
    ['an image reference in a link reference', T(P_(mk.ref('r', mk.iref('s'))), def('r', A), def('s', BI))],
  ];
  for (const [name, tree] of imageKinds) it(`${name} is its alt text, the link is the anchor`, () => {
    const result = built(tree);
    assert.equal(result.html, `<p><a href="${A}">i</a></p>`);
    assert.deepEqual(result.links, [link(A, null, true), link(BI, null, false, 'image')]);
  });
  const unsafeOuter = [
    ['an unsafe link', T(P_(mk.link('javascript:x', mk.img(BI))))],
    ['an unsafe link reference', T(P_(mk.ref('r', mk.img(BI))), def('r', 'javascript:x'))],
    ['an unsafe link with an image reference', T(P_(mk.link('javascript:x', mk.iref('s'))), def('s', BI))],
    ['an unsafe link reference with an image reference', T(P_(mk.ref('r', mk.iref('s'))), def('r', 'javascript:x'), def('s', BI))],
  ];
  for (const [name, tree] of unsafeOuter) it(`${name} holding an image shows the alt text and renders no link at all`, () => {
    const result = built(tree);
    assert.equal(result.html, '<p>i</p>');
    assert.deepEqual(result.links, [link('javascript:x', null, false), link(BI, null, false, 'image')]);
  });
  // The flag reaches every node type that has children, below an inline link and below a link reference.
  const below = {
    emphasis: (c) => ({ type: 'emphasis', children: c }),
    strong: (c) => ({ type: 'strong', children: c }),
    delete: (c) => ({ type: 'delete', children: c }),
    paragraph: (c) => P_(...c),
    blockquote: (c) => ({ type: 'blockquote', children: c }),
    heading: (c) => ({ type: 'heading', depth: 2, children: c }),
    list: (c) => ({ type: 'list', ordered: false, spread: false, children: [{ type: 'listItem', spread: false, children: c }] }),
    'task list': (c) => ({ type: 'list', ordered: false, spread: false, children: [{ type: 'listItem', checked: false, spread: false, children: c }] }),
    root: (c) => ({ type: 'root', children: c }),
    table: (c) => ({ type: 'table', align: [null], children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: c }] }] }),
  };
  const openers = {
    'an inline link': (c) => [P_(mk.link(A, ...c))],
    'a link reference': (c) => [P_(mk.ref('r', ...c)), def('r', A)],
  };
  const images = { 'an image': [mk.img(BI)], 'an image reference': [mk.iref('s')] };
  for (const [openerName, open] of Object.entries(openers)) {
    for (const [imageName, image] of Object.entries(images)) {
      for (const [wrapName, wrap] of Object.entries(below)) {
        it(`${imageName} below a ${wrapName} below ${openerName} is text`, () => {
          const result = built(T(...open([wrap(image)]), def('s', BI)));
          assert.equal(result.html.split('<a ').length - 1, 1, 'one anchor start tag');
          assert.deepEqual(result.links.map((l) => [l.kind, l.rendered]), [['link', true], ['image', false]]);
        });
      }
    }
  }
  it('an image reference and an image outside every link are links of their own', () => {
    const result = built(T(P_(mk.img(BI), mk.iref('s')), def('s', 'https://b.example/j.png')));
    assert.equal(result.html, `<p><a href="${BI}">i</a><a href="https://b.example/j.png">i</a></p>`);
    assert.deepEqual(result.links.map((l) => l.rendered), [true, true]);
  });
  it('a link without a children field is an empty anchor', () => {
    const result = built(T(P_({ type: 'link', url: A })));
    assert.equal(result.html, `<p><a href="${A}"></a></p>`);
    assert.deepEqual(result.links, [link(A, null, true)]);
  });
  it('the identifier of a reference matches its definition whatever the case of either', () => {
    for (const [reference, definition] of [['Foo', 'FOO'], ['foo', 'FOO'], ['FOO', 'foo'], ['fOo', 'FoO']]) {
      const result = built(T(P_(mk.ref(reference, X)), def(definition, A)));
      assert.equal(result.html, `<p><a href="${A}">x</a></p>`, `${reference} against ${definition}`);
    }
  });
  it('a reference whose identifier is another word than the definition has no definition', () => {
    const tree = T(P_({ type: 'linkReference', identifier: 'foo', children: [X], position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 9, offset: 8 } } }), def('bar', A));
    assert.equal(built(tree, { source: '[x][foo]' }).html, '<p>[x][foo]</p>');
  });
  it('the line of a reference is the line of its definition, else the line of the reference itself', () => {
    const at = (line) => ({ start: { line, column: 1, offset: 0 }, end: { line, column: 4, offset: 3 } });
    const withLine = built(T(P_({ ...mk.ref('r', X), position: at(9) }), { ...def('r', A), position: at(4) }), { source: '[a][r]' });
    assert.deepEqual(withLine.links, [link(A, 4, true)]);
    const without = built(T(P_({ ...mk.ref('r', X), position: at(9) }), def('r', A)), { source: '[a][r]' });
    assert.deepEqual(without.links, [link(A, 9, true)]);
    const image = built(T(P_({ ...mk.iref('r', 'x'), position: at(9) }), def('r', A)), { source: '![a][r]' });
    assert.deepEqual(image.links, [link(A, 9, true, 'image')]);
    const imageWith = built(T(P_({ ...mk.iref('r', 'x'), position: at(9) }), { ...def('r', A), position: at(4) }), { source: '![a][r]' });
    assert.deepEqual(imageWith.links, [link(A, 4, true, 'image')]);
  });
  it('the first definition wins whatever its position in a hand-built tree', () => {
    const result = built(T({ type: 'blockquote', children: [def('x', 'https://first.com/')] }, def('x', 'https://second.com/'), P_(mk.ref('X', X))));
    assert.deepEqual(result.links, [link('https://first.com/', null, true)]);
  });
  // The label of an image: its alt text when that is a non-empty string, else its target.
  const labels = [['an undefined alt text', undefined, 'https://a.example/i.png'], ['a null alt text', null, 'https://a.example/i.png'], ['an empty alt text', '', 'https://a.example/i.png'], ['a number as the alt text', 5, 'https://a.example/i.png'], ['a space as the alt text', ' ', ' '], ['an alt text', 'word', 'word'], ['a zero as a string', '0', '0']];
  for (const [name, alt, label] of labels) {
    it(`an image with ${name} shows ${JSON.stringify(label)}`, () => {
      const result = built(T(P_({ type: 'image', url: 'https://a.example/i.png', alt })));
      assert.equal(result.html, `<p><a href="https://a.example/i.png">${label}</a></p>`);
    });
    it(`an image reference with ${name} shows ${JSON.stringify(label)}`, () => {
      const result = built(T(P_({ type: 'imageReference', identifier: 'r', alt }), def('r', 'https://a.example/i.png')));
      assert.equal(result.html, `<p><a href="https://a.example/i.png">${label}</a></p>`);
    });
  }
  // The line of the target of an image whose tree has positions that the parser does not make.
  const imageAt = (position, source) => built(T(P_({ type: 'image', url: 'https://a.example/i.png', alt: 'a', ...(position ? { position } : {}) })), { source }).links[0].line;
  const pos = (startLine, startOffset, endLine, endOffset) => ({ start: { line: startLine, column: 1, offset: startOffset }, ...(endOffset === undefined ? {} : { end: { line: endLine, column: 1, offset: endOffset } }) });
  it('an image without a position has no line', () => assert.equal(imageAt(undefined, ''), null));
  it('an image with a start but no end has the line of its start', () => assert.equal(imageAt(pos(4, 0), '![a](x)'), 4));
  it('an image whose text has no ]( has the line of its start', () => assert.equal(imageAt(pos(4, 0, 4, 4), '![a] z'), 4));
  it('an image whose ]( lies beyond its end has the line of its start', () => assert.equal(imageAt(pos(1, 0, 1, 4), '![a] z\n](q)'), 1));
  it('an image whose range ends exactly where the ]( starts has the line of its start', () => assert.equal(imageAt(pos(1, 0, 2, 4), '![a\n](x)'), 1));
  it('the search for the target stops at the end of the image: a line break right after the end is not skipped', () => assert.equal(imageAt(pos(1, 0, 1, 7), '![a](  \nx)'), 1));
  it('a node whose position holds an end but no start has no line in its error', () => {
    const node = { type: 'strange', position: { end: { line: 3, column: 1, offset: 1 } } };
    assert.equal(thrown(() => built(T(node))).message, 'transform: docs/test.md: unsupported node type strange');
    assert.equal(thrown(() => built(T({ type: 'strange', position: {} }))).message, 'transform: docs/test.md: unsupported node type strange');
  });
  it('a definition whose position holds an end but no start gives the reference its own line', () => {
    const noStart = { end: { line: 2, column: 1, offset: 1 } };
    const ref = built(T(P_({ ...mk.ref('r', X), position: { start: { line: 9, column: 1, offset: 0 }, end: { line: 9, column: 4, offset: 3 } } }), { ...def('r', A), position: noStart }), { source: '[a][r]' });
    assert.deepEqual(ref.links, [link(A, 9, true)]);
    const image = built(T(P_({ ...mk.iref('r', 'x'), position: { start: { line: 9, column: 1, offset: 0 }, end: { line: 9, column: 4, offset: 3 } } }), { ...def('r', A), position: noStart }), { source: '![a][r]' });
    assert.deepEqual(image.links, [link(A, 9, true, 'image')]);
    assert.deepEqual(built(T(P_(mk.ref('r', X)), { ...def('r', A), position: noStart })).links, [link(A, null, true)]);
  });
  it('an image with an end but no start searches from the top of the text', () => {
    const node = { type: 'image', url: 'https://a.example/i.png', alt: 'a', position: { end: { line: 1, column: 1, offset: 12 } } };
    assert.equal(built(T(P_(node)), { source: '](\nhttps://e.com/)' }).links[0].line, 2);
  });
  it('the search for the target skips every space and line break inside the range', () => assert.equal(imageAt(pos(1, 0, 3, 11), '![a](  \n\n  x)'), 3));
  // A node that has to be sliced from the source and has no position is an error that names the type.
  for (const [type, node] of [['footnoteReference', { type: 'footnoteReference', identifier: 'a' }], ['footnoteDefinition', { type: 'footnoteDefinition', identifier: 'a', children: [] }]]) {
    it(`a ${type} without a position throws and names the type`, () => {
      const tree = type === 'footnoteDefinition' ? T(node) : T(P_(node));
      assert.match(thrown(() => built(tree)).message, new RegExp(`^transform: docs/test\\.md: node of type ${type} has no source position$`));
    });
  }
  it('a link reference without a definition and without a position throws and names the type', () => {
    assert.match(thrown(() => built(T(P_(mk.ref('zz', X))))).message, /^transform: docs\/test\.md: node of type linkReference has no source position$/);
  });
  it('an image reference without a definition and without a position throws and names the type', () => {
    assert.match(thrown(() => built(T(P_(mk.iref('zz'))))).message, /^transform: docs\/test\.md: node of type imageReference has no source position$/);
  });
  it('a node with a start but no end offset throws with the line of its start', () => {
    const node = { type: 'footnoteReference', identifier: 'a', position: { start: { line: 6, column: 1, offset: 0 }, end: { line: 6, column: 3 } } };
    assert.match(thrown(() => built(T(P_(node)), { source: '[^a]' })).message, /^transform: docs\/test\.md:6: node of type footnoteReference has no source position$/);
  });
  it('a node with an end but no start offset throws too', () => {
    const node = { type: 'footnoteReference', identifier: 'a', position: { start: { line: 6, column: 1 }, end: { line: 6, column: 3, offset: 3 } } };
    assert.match(thrown(() => built(T(P_(node)), { source: '[^a]' })).message, /^transform: docs\/test\.md:6: node of type footnoteReference has no source position$/);
  });
  it('a footnote reference and definition with a position show the slice of the source they cover', () => {
    const at = (a, b) => ({ start: { line: 1, column: 1, offset: a }, end: { line: 1, column: 1, offset: b } });
    const result = built(T(P_(X, { type: 'footnoteReference', identifier: 'a', position: at(1, 5) }), { type: 'footnoteDefinition', identifier: 'a', children: [], position: at(6, 13) }), { source: 'x[^a] [^a]: n' });
    assert.equal(result.html, '<p>x[^a]</p>\n<p>[^a]: n</p>');
  });

  // The line of the target of a link: where the search starts and when it is made at all.
  it('an empty label after an earlier link: the search starts at the link itself, not at the top of the document', () => {
    assert.deepEqual(doc('[x](y)\n\n[](https://e.com/)').links, [link('y', 1, true), link('https://e.com/', 3, true)]);
  });
  it('an empty label with the target on the next line has the line of its target', () => {
    assert.deepEqual(doc('[](\nhttps://e.com/)').links, [link('https://e.com/', 2, true)]);
  });
  it('an empty label with the target on the next line after an earlier link', () => {
    assert.deepEqual(doc('[x](y)\n\n[](\nhttps://e.com/)').links, [link('y', 1, true), link('https://e.com/', 4, true)]);
  });
  it('a hand-built link without children that covers text starting with a bracket has the line of its target', () => {
    const node = { type: 'link', url: 'https://e.com/', position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 2, column: 15, offset: 18 } } };
    assert.deepEqual(renderTree(T(P_(node)), { path: PATH, source: '[a](\nhttps://e.com/)' }).links, [link('https://e.com/', 2, true)]);
  });
  it('a hand-built link whose text does not start with a bracket has the line of its start, even when the text holds ]( further on', () => {
    const node = { type: 'link', url: 'https://e.com/', children: [{ type: 'text', value: 'a' }], position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 2, column: 15, offset: 22 } } };
    assert.deepEqual(renderTree(T(P_(node)), { path: PATH, source: 'see [a](\nhttps://e.com/)' }).links, [link('https://e.com/', 1, true)]);
  });
  it('a hand-built link whose text starts with an angle bracket is an angle autolink: unsafe, it shows the source text', () => {
    const node = { type: 'link', url: 'javascript:x', children: [{ type: 'text', value: 'javascript:x' }], position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 15, offset: 14 } } };
    const result = renderTree(T(P_(node)), { path: PATH, source: '<javascript:x>' });
    assert.equal(result.html, '<p>&#x3C;javascript:x></p>');
  });
  it('a hand-built link whose text does not start with an angle bracket or a bracket shows its label when unsafe', () => {
    const node = { type: 'link', url: 'javascript:x', children: [{ type: 'text', value: 'label' }], position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 15, offset: 14 } } };
    assert.equal(renderTree(T(P_(node)), { path: PATH, source: 'see javascript:x' }).html, '<p>label</p>');
  });
  it('a hand-built link without a position and a hand-built one with a position both keep their url in the list', () => {
    const at = { start: { line: 5, column: 1, offset: 0 }, end: { line: 5, column: 9, offset: 8 } };
    assert.deepEqual(renderTree(T(P_({ type: 'link', url: 'https://e.com/', children: [X] })), { path: PATH }).links, [link('https://e.com/', null, true)]);
    assert.deepEqual(renderTree(T(P_({ type: 'link', url: 'https://e.com/', children: [X], position: at })), { path: PATH, source: 'https://' }).links, [link('https://e.com/', 5, true)]);
  });
  it('a hand-built footnote reference with a position and no source option is sliced from an empty text', () => {
    const node = { type: 'footnoteReference', identifier: 'a', position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 5, offset: 4 } } };
    assert.equal(renderTree(T(P_(node)), { path: PATH }).html, '<p></p>');
  });

  // rewrite: what it returns is checked again, and only a safe string is used.
  for (const value of [':x', ' javascript:x', 'JAVASCRIPT:x', 'data:text/html,x', 'vbscript:x', 'file:///etc', 'x:y', 0, false, [], {}, true]) {
    it(`throws when rewrite returns ${JSON.stringify(value) ?? String(value)}`, () => {
      assert.match(thrown(() => doc('[a](docs/a.md)', { rewrite: () => value })).message, /^transform: docs\/test\.md:1: rewrite returned an unsafe target$/);
    });
  }
  for (const value of ['', '#a', '../b', '/c', 'mailto:x@y.z', 'HTTPS://X.Y/', 'http://x.y/', 'a/b:c', '?q=a:b', 'docs/x.md#a:b']) {
    it(`a rewrite that returns ${JSON.stringify(value)} is used as the target`, () => {
      const result = doc('[a](docs/a.md)', { rewrite: () => value });
      assert.equal(dom(result.html)('a').attr('href'), value);
      assert.deepEqual(result.links, [link('docs/a.md', 1, true)]);
    });
  }
  it('rewrite is called for an image reference with the kind image and the line of its definition', () => {
    const calls = [];
    const result = doc('![a][i]\n\n[i]: img/i.png', { rewrite: (url, info) => { calls.push([url, info]); return `/b/${url}`; } });
    assert.deepEqual(calls, [['img/i.png', { path: PATH, line: 3, kind: 'image' }]]);
    assert.equal(dom(result.html)('a').attr('href'), '/b/img/i.png');
  });
  it('rewrite is called for a link reference with the kind link and the line of its definition', () => {
    const calls = [];
    doc('[a][i]\n\n\n[i]: x.md', { rewrite: (url, info) => { calls.push([url, info]); return url; } });
    assert.deepEqual(calls, [['x.md', { path: PATH, line: 4, kind: 'link' }]]);
  });
  it('rewrite is called for an autolink literal, an angle autolink and an address', () => {
    const calls = [];
    doc('www.e.com <https://e.com/> a@b.com', { rewrite: (url, info) => { calls.push([url, info.kind, info.line]); return url; } });
    assert.deepEqual(calls, [['http://www.e.com', 'link', 1], ['https://e.com/', 'link', 1], ['mailto:a@b.com', 'link', 1]]);
  });
  it('rewrite is not called for a link below a link or for an unsafe angle autolink', () => {
    const calls = [];
    doc('[![a](x.png)](y.md) <javascript:x>', { rewrite: (url) => { calls.push(url); return url; } });
    assert.deepEqual(calls, ['y.md']);
  });
  it('rewrite sees the path of the document and the line of the target on a later line', () => {
    const calls = [];
    transformDocument('docs/other.md', '\n\n\n[a](x.md)', { rewrite: (url, info) => { calls.push(info); return url; } });
    assert.deepEqual(calls, [{ path: 'docs/other.md', line: 4, kind: 'link' }]);
  });
  it('a rewrite is not used in fragment mode and renderTree takes the same option', () => {
    assert.equal(renderMarkdown('[a](x.md)'), '<p><a href="x.md">a</a></p>');
    const result = built(T(P_(mk.link('x.md', X))), { rewrite: (url) => `/r/${url}` });
    assert.equal(result.html, '<p><a href="/r/x.md">x</a></p>');
  });

  // ---- closed world, round 3: hand-built shapes of children and positions, the target that rewrite receives, the start of the search for a target ----
  const BAD_CHILDREN = [['null', null], ['undefined', undefined], ['a number', 5], ['a string', 'x'], ['an empty object', {}], ['an array', []], ['a typeless node with a position', { value: 'x', position: pos(1, 1, 1, 2) }]];
  const noType = 'transform: docs/test.md: a node has no type';
  for (const [name, bad] of BAD_CHILDREN) {
    for (const [where, children] of [['alone', [bad]], ['after a text', [X, bad]], ['before a text', [bad, X]]]) {
      it(`a link with a position whose child is ${name} ${where} throws a node has no type error`, () => {
        assert.equal(thrown(() => built(T(P_({ type: 'link', url: 'x', children, position: pos(1, 0, 1, 6) })), { source: '[a](x)' })).message, noType);
      });
      it(`a link without a position whose child is ${name} ${where} throws a node has no type error`, () => {
        assert.equal(thrown(() => built(T(P_({ type: 'link', url: 'x', children })))).message, noType);
      });
      it(`a link reference with a position whose child is ${name} ${where} throws a node has no type error`, () => {
        assert.equal(thrown(() => built(T(P_({ type: 'linkReference', identifier: 'r', children, position: pos(1, 0, 1, 6) }), def('r', 'x')), { source: '[a][r]' })).message, noType);
      });
      it(`a link inside a link whose child is ${name} ${where} throws a node has no type error`, () => {
        assert.equal(thrown(() => built(T(P_(mk.link(A, { type: 'link', url: B, children, position: pos(1, 0, 1, 6) }))), { source: '[a](x)' })).message, noType);
      });
    }
  }

  // A line that is 0 is a line: only a missing or a null line is no line. Every place that reads a line keeps the 0.
  const at0 = (a, b) => pos(0, a, 0, b);
  it('an image whose position is on line 0 and whose text has no target has line 0', () => assert.deepEqual(built(T(P_({ type: 'image', url: 'x', alt: 'a', position: at0(0, 0) }))).links, [link('x', 0, true, 'image')]));
  it('an image whose position is on line 0 has the line of its target in the source when the source holds it', () => {
    assert.deepEqual(built(T(P_({ type: 'image', url: 'x', alt: 'a', position: at0(0, 6) })), { source: '![a](x)' }).links, [link('x', 1, true, 'image')]);
  });
  it('a link reference whose definition is on line 0 has line 0, whatever the line of the reference', () => {
    assert.deepEqual(built(T(P_({ ...mk.ref('r', X), position: pos(5, 0, 5, 3) }), { ...def('r', 'x'), position: at0(0, 0) }), { source: '[a][r]' }).links, [link('x', 0, true)]);
  });
  it('an image reference whose definition is on line 0 has line 0, whatever the line of the reference', () => {
    assert.deepEqual(built(T(P_({ ...mk.iref('r', 'a'), position: pos(5, 0, 5, 3) }), { ...def('r', 'x'), position: at0(0, 0) }), { source: '![a][r]' }).links, [link('x', 0, true, 'image')]);
  });
  it('a link reference on line 0 whose definition has no position has line 0', () => {
    assert.deepEqual(built(T(P_({ ...mk.ref('r', X), position: at0(0, 3) }), def('r', 'x')), { source: '[a][r]' }).links, [link('x', 0, true)]);
  });
  it('an image reference on line 0 whose definition has no position has line 0', () => {
    assert.deepEqual(built(T(P_({ ...mk.iref('r', 'a'), position: at0(0, 3) }), def('r', 'x')), { source: '![a][r]' }).links, [link('x', 0, true, 'image')]);
  });
  it('a link on line 0 whose text does not start with a bracket has line 0', () => {
    assert.deepEqual(built(T(P_({ type: 'link', url: 'x', children: [X], position: at0(0, 5) })), { source: 'see x' }).links, [link('x', 0, true)]);
  });
  it('a link on line 0 whose text starts with a bracket has the line of its target', () => {
    assert.deepEqual(built(T(P_({ type: 'link', url: 'x', children: [X], position: at0(0, 6) })), { source: '[a](x)' }).links, [link('x', 1, true)]);
  });
  for (const [name, start] of [['no line', { column: 1, offset: 0 }], ['a null line', { line: null, column: 1, offset: 0 }], ['an undefined line', { line: undefined, column: 1, offset: 0 }]]) {
    it(`an image whose start has ${name} has a null line`, () => {
      assert.deepEqual(built(T(P_({ type: 'image', url: 'x', alt: 'a', position: { start, end: { line: 1, column: 1, offset: 0 } } }))).links, [link('x', null, true, 'image')]);
    });
    it(`a definition whose start has ${name} gives the reference its own line`, () => {
      assert.deepEqual(built(T(P_({ ...mk.ref('r', X), position: pos(5, 0, 5, 3) }), { ...def('r', 'x'), position: { start, end: { line: 1, column: 1, offset: 0 } } }), { source: '[a][r]' }).links, [link('x', 5, true)]);
    });
  }
  for (const [name, position] of [['null', null], ['undefined', undefined], ['an empty object', {}], ['a start that is null', { start: null }], ['a start that is an empty object', { start: {} }]]) {
    it(`a definition whose position is ${name} gives the reference its own line, and a reference without one has a null line`, () => {
      assert.deepEqual(built(T(P_({ ...mk.ref('r', X), position: pos(5, 0, 5, 3) }), { ...def('r', 'x'), position }), { source: '[a][r]' }).links, [link('x', 5, true)]);
      assert.deepEqual(built(T(P_(mk.ref('r', X)), { ...def('r', 'x'), position })).links, [link('x', null, true)]);
    });
    it(`an image reference whose definition position is ${name} has the line of the reference`, () => {
      assert.deepEqual(built(T(P_({ ...mk.iref('r', 'a'), position: pos(5, 0, 5, 3) }), { ...def('r', 'x'), position }), { source: '![a][r]' }).links, [link('x', 5, true, 'image')]);
    });
    it(`an image whose position is ${name} has a null line`, () => assert.deepEqual(built(T(P_({ type: 'image', url: 'x', alt: 'a', position }))).links, [link('x', null, true, 'image')]));
    it(`a link whose position is ${name} has a null line`, () => assert.deepEqual(built(T(P_({ type: 'link', url: 'x', children: [X], position }))).links, [link('x', null, true)]));
  }
  it('the error of a rewrite that returns an unsafe target names line 0, a later line, and no line for a link without a position', () => {
    const unsafe = { rewrite: () => 'javascript:x' };
    const node = (position) => T(P_({ type: 'link', url: 'x', children: [X], ...(position ? { position } : {}) }));
    assert.equal(thrown(() => built(node(at0(0, 5)), { source: 'see x', ...unsafe })).message, 'transform: docs/test.md:0: rewrite returned an unsafe target');
    assert.equal(thrown(() => built(node(pos(7, 0, 7, 5)), { source: 'see x', ...unsafe })).message, 'transform: docs/test.md:7: rewrite returned an unsafe target');
    assert.equal(thrown(() => built(node(null), unsafe)).message, 'transform: docs/test.md: rewrite returned an unsafe target');
  });
  for (const [name, value] of [['a number', 5], ['null', null], ['undefined', undefined], ['an object', { href: 'x' }], ['an array', ['x']], ['true', true], ['a function', () => 'x']]) {
    it(`the error of a rewrite that returns ${name}`, () => {
      assert.equal(thrown(() => built(T(P_(mk.link('x', X))), { rewrite: () => value })).message, 'transform: docs/test.md: rewrite returned an unsafe target');
    });
  }
  for (const [name, value, href] of [['an empty string', '', ''], ['a space', ' ', '%20'], ['spaces around a path', ' y ', '%20y%20'], ['a fragment', '#a', '#a'], ['a path with a colon after a slash', '/a:b', '/a:b']]) {
    it(`a rewrite that returns ${name} is used as it is: ${JSON.stringify(value)}`, () => {
      const result = built(T(P_(mk.link('x', X))), { rewrite: () => value });
      assert.equal(dom(result.html)('a').attr('href'), href);
      assert.deepEqual(result.links, [link('x', null, true)]);
    });
  }
  for (const rewrite of [null, undefined, false, 0, '']) {
    it(`a rewrite that is ${JSON.stringify(rewrite) ?? 'undefined'} is no rewrite: the target is unchanged`, () => {
      const result = built(T(P_(mk.link('x.md', X))), { rewrite });
      assert.equal(result.html, '<p><a href="x.md">x</a></p>');
      assert.deepEqual(result.links, [link('x.md', null, true)]);
    });
  }
  it('transformDocument without a rewrite or with an undefined one leaves the target unchanged', () => {
    assert.equal(doc('[a](x.md)').html, '<p><a href="x.md">a</a></p>');
    assert.equal(doc('[a](x.md)', {}).html, '<p><a href="x.md">a</a></p>');
    assert.equal(doc('[a](x.md)', { rewrite: undefined }).html, '<p><a href="x.md">a</a></p>');
  });

  // The target that `rewrite` receives is the decoded target as the parser gives it, never trimmed or cleaned, and it is called with two arguments.
  for (const [source, url] of [['[a](< x.md >)', ' x.md '], ['[a](<\tx.md>)', '\tx.md'], ['[a](<x.md\t>)', 'x.md\t'], ['[a](<  x.md  >)', '  x.md  '], ['[a](<\u00a0x.md\u00a0>)', '\u00a0x.md\u00a0'], ['[a](<x y.md>)', 'x y.md'],
    ['[a](<\u0001x.md>)', '\u0001x.md'], ['[a](<x.md\u0001>)', 'x.md\u0001'], ['[a](<\u3000x.md>)', '\u3000x.md'], ['[a](<\ufeffx.md\ufeff>)', '\ufeffx.md\ufeff']]) {
    it(`rewrite receives ${JSON.stringify(url)} for ${JSON.stringify(source)}, and the list holds it too`, () => {
      const calls = [];
      const result = doc(source, { rewrite: (...args) => { calls.push(args); return args[0]; } });
      assert.deepEqual(calls, [[url, { path: PATH, line: 1, kind: 'link' }]]);
      assert.equal(calls[0].length, 2);
      assert.deepEqual(result.links, [link(url, 1, true)]);
    });
  }
  it('rewrite receives an image target untrimmed, with the kind image, and a reference definition untrimmed', () => {
    const calls = [];
    const rewrite = (url, info) => { calls.push([url, info.kind, info.line]); return url; };
    doc('![a](< i.png >)\n\n[b][r]\n\n![c][s]\n\n[r]: < y.md >\n[s]: < j.png >', { rewrite });
    assert.deepEqual(calls, [[' i.png ', 'image', 1], [' y.md ', 'link', 7], [' j.png ', 'image', 8]]);
  });

  // The search for the target of a link starts after the last child of its label, or after the opening bracket when there is none; it never starts in an earlier link.
  const twoLinks = '[a](https://a.example/)\nx [](https://b.example/)';
  const wraps = [['a paragraph', (text) => text], ['a block quote', (text) => text.split('\n').map((l) => `> ${l}`).join('\n')], ['a list item', (text) => `- ${text.split('\n').join('\n  ')}`], ['a block quote in a list item', (text) => `- ${text.split('\n').map((l) => `> ${l}`).join('\n  ')}`]];
  for (const [name, wrap] of wraps) {
    it(`an empty label after an earlier link on an earlier line has the line of its own target, in ${name}`, () => {
      assert.deepEqual(doc(wrap(twoLinks)).links, [link('https://a.example/', 1, true), link('https://b.example/', 2, true)]);
      assert.deepEqual(doc(wrap('[a](https://a.example/)\n\n\nx [](https://b.example/)')).links, [link('https://a.example/', 1, true), link('https://b.example/', 4, true)]);
      assert.deepEqual(doc(wrap('[a](https://a.example/)\nx [](https://b.example/)\ny [](https://c.example/)')).links.map((l) => l.line), [1, 2, 3]);
    });
    it(`an empty alt text after an earlier image on an earlier line has the line of its own target, in ${name}`, () => {
      assert.deepEqual(doc(wrap('![a](https://a.example/i.png)\nx ![](https://b.example/i.png)')).links, [link('https://a.example/i.png', 1, true, 'image'), link('https://b.example/i.png', 2, true, 'image')]);
    });
    it(`a label with text after an earlier link on an earlier line has the line of its own target, in ${name}`, () => {
      assert.deepEqual(doc(wrap('[a](https://a.example/)\nx [b](https://b.example/)')).links.map((l) => l.line), [1, 2]);
      assert.deepEqual(doc(wrap('[a](https://a.example/)\nx [b\\](\nc](https://b.example/)')).links.map((l) => l.line), [1, 3]);
    });
  }
  it('a hand-built link whose last child has no position searches from the start of the link, not from the top of the text or from its parent', () => {
    const first = { type: 'link', url: 'https://a.example/', children: [X], position: pos(1, 0, 1, 23) };
    const second = (children) => ({ type: 'link', url: 'https://b.example/', children, position: pos(2, 25, 2, 50) });
    const source = '[a](https://a.example/)\nx [](https://b.example/)';
    for (const children of [[], [X], [X, X], [{ type: 'text', value: 'x', position: {} }], [{ type: 'text', value: 'x', position: { end: {} } }], [{ type: 'text', value: 'x', position: { end: { line: 2, column: 1 } } }]]) {
      assert.deepEqual(built(T(P_(first, X, second(children))), { source }).links.map((l) => l.line), [1, 2], JSON.stringify(children));
    }
  });
  it('a hand-built link whose last child has an end offset searches from that offset', () => {
    const label = { type: 'text', value: 'a](\nx)', position: pos(1, 1, 1, 8) };
    const node = { type: 'link', url: 'https://b.example/', children: [label], position: pos(1, 0, 3, 28) };
    assert.deepEqual(built(T(P_(node)), { source: '[a\\](\nx)](\nhttps://b.example/)' }).links.map((l) => l.line), [3]);
  });
  it('a hand-built link whose last child end is not a number searches from the start of the link', () => {
    const label = { type: 'text', value: 'a', position: { start: { line: 1, column: 1, offset: 1 }, end: { line: 1, column: 1, offset: '8' } } };
    const node = { type: 'link', url: 'https://b.example/', children: [label], position: pos(1, 0, 3, 28) };
    assert.deepEqual(built(T(P_(node)), { source: '[a\\](\nx)](\nhttps://b.example/)' }).links.map((l) => l.line), [2]);
  });

  // Every shape of position, on every node kind that reads one: the line is that of the start, the offsets are those of the start and the end, and a missing part is no value and no error of another shape.
  const S4 = { line: 4, column: 1, offset: 0 };
  const E4 = { line: 4, column: 5, offset: 4 };
  const noPosition = (type, line) => (line === null ? `transform: docs/test.md: node of type ${type} has no source position` : `transform: docs/test.md:${line}: node of type ${type} has no source position`);
  const SHAPES = [
    ['an end that is null', { start: S4, end: null }, { fn: noPosition('footnoteReference', 4), fd: noPosition('footnoteDefinition', 4), link: noPosition('link', 4), image: link('x', 4, true, 'image'), lref: noPosition('linkReference', 4), child: link('x', 1, true) }],
    ['a start that is null', { start: null, end: E4 }, { fn: noPosition('footnoteReference', null), fd: noPosition('footnoteDefinition', null), link: link('x', null, true), image: link('x', 1, true, 'image'), lref: noPosition('linkReference', null), child: link('x', 4, true) }],
    ['a start and an end that are null', { start: null, end: null }, { fn: noPosition('footnoteReference', null), fd: noPosition('footnoteDefinition', null), link: link('x', null, true), image: link('x', null, true, 'image'), lref: noPosition('linkReference', null), child: link('x', 1, true) }],
    ['an end that is undefined', { start: S4, end: undefined }, { fn: noPosition('footnoteReference', 4), fd: noPosition('footnoteDefinition', 4), link: noPosition('link', 4), image: link('x', 4, true, 'image'), lref: noPosition('linkReference', 4), child: link('x', 1, true) }],
    ['a start with a line only', { start: { line: 4 }, end: E4 }, { fn: noPosition('footnoteReference', 4), fd: noPosition('footnoteDefinition', 4), link: link('x', 4, true), image: link('x', 1, true, 'image'), lref: noPosition('linkReference', 4), child: link('x', 4, true) }],
    ['an end with a line only', { start: S4, end: { line: 4 } }, { fn: noPosition('footnoteReference', 4), fd: noPosition('footnoteDefinition', 4), link: noPosition('link', 4), image: link('x', 4, true, 'image'), lref: noPosition('linkReference', 4), child: link('x', 1, true) }],
  ];
  const outcome = (mdast, source) => {
    try {
      return built(mdast, { source }).links[0];
    } catch (error) {
      return error.message;
    }
  };
  for (const [name, position, expected] of SHAPES) {
    it(`a position with ${name}: a footnote reference and a footnote definition name the type and the line`, () => {
      assert.equal(outcome(T(P_({ type: 'footnoteReference', identifier: 'a', position })), '[^a]'), expected.fn);
      assert.equal(outcome(T({ type: 'footnoteDefinition', identifier: 'a', children: [], position }), '[^a]: x'), expected.fd);
    });
    it(`a position with ${name}: a link, an image and a link reference`, () => {
      assert.deepEqual(outcome(T(P_({ type: 'link', url: 'x', children: [X], position })), '[a](x)'), expected.link);
      assert.deepEqual(outcome(T(P_({ type: 'image', url: 'x', alt: 'a', position })), '![a](x)'), expected.image);
      assert.equal(outcome(T(P_({ type: 'linkReference', identifier: 'zz', children: [X], position })), '[a][zz]'), expected.lref);
    });
    it(`a position with ${name} on the last child of a link`, () => {
      assert.deepEqual(outcome(T(P_({ type: 'link', url: 'x', children: [{ type: 'text', value: 'a', position }], position: { start: S4, end: E4 } })), '[a](x)'), expected.child);
    });
  }

  // The search for a target skips white space only: every character that `\s` matches, and nothing else, between `](` and the target.
  for (const ch of SWEEP) {
    it(`${label(ch)} between the parenthesis and the target of an image ${JS_SPACE.has(ch) ? 'is skipped' : 'is not skipped'}`, () => {
      const source = `![a](${ch}\nhttps://e.com/i.png)`;
      const expected = JS_SPACE.has(ch) ? (ch === '\n' ? 3 : 2) : 1;
      assert.equal(imageAt(pos(1, 0, 3, source.length), source), expected);
      const spaced = `![a](${ch}${ch}\nx)`;
      assert.equal(imageAt(pos(1, 0, 4, spaced.length), spaced), JS_SPACE.has(ch) ? (ch === '\n' ? 4 : ch === '\r' ? 3 : 2) : 1);
    });
  }

  // The flag that says "inside a link" goes down through every kind of container, and is never set by a container that is not a link: a link or an image in a heading, a table cell, a list item,
  // a block quote or any inline wrapper is an anchor of its own; the same inside a link is text.
  const CONTAINERS_FOR_LINKS = [
    ['a paragraph', (...c) => T({ type: 'paragraph', children: c }), 'p'],
    ['an emphasis', (...c) => T(P_({ type: 'emphasis', children: c })), 'em'],
    ['a strong', (...c) => T(P_({ type: 'strong', children: c })), 'strong'],
    ['a delete', (...c) => T(P_({ type: 'delete', children: c })), 'del'],
    ['a heading', (...c) => T({ type: 'heading', depth: 2, children: c }), 'h2'],
    ['a block quote', (...c) => T({ type: 'blockquote', children: c }), 'blockquote'],
    ['a list item', (...c) => T({ type: 'list', ordered: false, spread: false, children: [{ type: 'listItem', spread: false, children: c }] }), 'li'],
    ['an ordered list item', (...c) => T({ type: 'list', ordered: true, start: 3, spread: false, children: [{ type: 'listItem', spread: false, children: c }] }), 'li'],
    ['a table cell', (...c) => T({ type: 'table', align: [null], children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: c }] }] }), 'th'],
    ['a table body cell', (...c) => T({ type: 'table', align: [null], children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: [X] }] }, { type: 'tableRow', children: [{ type: 'tableCell', children: c }] }] }), 'td'],
    ['a root', (...c) => ({ type: 'root', children: c }), null],
  ];
  const ENTRIES = [
    ['a link', (url) => mk.link(url, X)], ['an image', (url) => mk.img(url, 'i')], ['a link reference', () => mk.ref('r', X)], ['an image reference', () => mk.iref('r', 'i')],
  ];
  const withDefs = (tree) => ({ ...tree, children: [...tree.children, def('r', 'https://r.example/')] });
  for (const [cname, container, tag] of CONTAINERS_FOR_LINKS) {
    for (const [ename, entry] of ENTRIES) {
      it(`${ename} in ${cname} is an anchor of its own`, () => {
        const node = entry('https://e.example/');
        // a root holds the node through a paragraph; the other containers, the heading and the cell included, hold it directly
        const result = built(withDefs(cname === 'a root' ? container(P_(node)) : container(node)));
        const $ = dom(result.html);
        assert.equal($('a').length, 1, result.html);
        assert.equal(result.links.length, 1);
        assert.equal(result.links[0].rendered, true);
        if (tag) assert.equal($(`${tag} a`).length, 1, result.html);
      });
    }
  }
  for (const [cname, wrap] of [['a block quote', (n) => ({ type: 'blockquote', children: [P_(n)] })], ['a list', (n) => ({ type: 'list', ordered: false, spread: false, children: [{ type: 'listItem', spread: false, children: [P_(n)] }] })], ['a table', (n) => ({ type: 'table', align: [null], children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: [n] }] }] })],
    ['a heading', (n) => ({ type: 'heading', depth: 1, children: [n] })], ['a paragraph', (n) => P_(n)], ['a root', (n) => ({ type: 'root', children: [P_(n)] })]]) {
    for (const [ename, entry] of ENTRIES) {
      it(`${ename} inside ${cname} that a link holds is text`, () => {
        const outer = mk.link('https://o.example/', wrap(entry('https://e.example/')));
        const result = built(withDefs(T(P_(outer))));
        assert.deepEqual(result.links.map((l) => [l.url, l.rendered]).slice(0, 1), [['https://o.example/', true]]);
        assert.equal(result.links.filter((l) => l.rendered).length, 1);
        assert.ok(!result.html.includes('e.example') && !result.html.includes('r.example'), result.html);
        const linkRef = built(withDefs(T(P_(mk.ref('o', wrap(entry('https://e.example/')))), def('o', 'https://o.example/'))));
        assert.equal(linkRef.links.filter((l) => l.rendered).length, 1);
        assert.ok(!linkRef.html.includes('e.example') && !linkRef.html.includes('r.example'), linkRef.html);
      });
    }
  }
  it('a root inside a root is a container like the others: a link in it is an anchor, and the flag of a link around it holds', () => {
    const inner = (...c) => ({ type: 'root', children: c });
    const a = built(T(inner(P_(mk.link(A, X)))));
    assert.equal(a.html, `<p><a href="${A}">x</a></p>`);
    assert.deepEqual(a.links, [link(A, null, true)]);
    const b = built(T(inner(inner(P_(mk.img(BI, 'i'))))));
    assert.equal(b.html, `<p><a href="${BI}">i</a></p>`);
    const c = built(T(P_(mk.link(A, inner(P_(mk.link(B, X)), P_(mk.img(BI, 'i')))))));
    assert.deepEqual(c.links, [link(A, null, true), link(B, null, false), link(BI, null, false, 'image')]);
    assert.equal(c.html.includes('b.example'), false);
  });
  it('a link and an image in a parsed heading, table cell, list item and block quote are anchors', () => {
    const result = doc('# [a](https://e.com/) ![i](https://e.com/i.png)\n\n| [b](https://e.com/b) | ![j](https://e.com/j.png) |\n|---|---|\n| [c](https://e.com/c) | text |\n\n- [d](https://e.com/d)\n\n> [e](https://e.com/e) ![k](https://e.com/k.png)');
    assert.deepEqual(dom(result.html)('a').toArray().map((a) => a.attribs.href), ['https://e.com/', 'https://e.com/i.png', 'https://e.com/b', 'https://e.com/j.png', 'https://e.com/c', 'https://e.com/d', 'https://e.com/e', 'https://e.com/k.png']);
    assert.deepEqual(dom(result.html)('h1 a, th a, td a, li a, blockquote a').length, 8);
    assert.deepEqual(result.links.map((l) => l.rendered), [true, true, true, true, true, true, true, true]);
    assert.deepEqual(result.headings, [{ depth: 1, text: 'a i', id: 'a-i' }]);
  });

  // The key of a definition: the identifier as a string, in upper case, so that a reference that differs in case only finds it.
  for (const [name, defined, used] of [['a lower-case and an upper-case letter', 'r', 'R'], ['a sharp s and its expansion', '\u00df', 'ss'], ['a dotless i and an i', '\u0131', 'i'], ['a number and its text', 5, '5'], ['a text and its number', '5', 5], ['no identifier at all', undefined, undefined],
    ['a long s and an s', '\u017f', 's'], ['a Greek final sigma and a sigma', '\u03c2', '\u03c3']]) {
    it(`a reference finds the definition that differs by ${name}`, () => {
      const result = built(T(P_({ type: 'linkReference', identifier: used, children: [X] }), { type: 'definition', identifier: defined, url: 'x' }));
      assert.deepEqual(result.links, [link('x', null, true)]);
      const image = built(T(P_({ type: 'imageReference', identifier: used, alt: 'a' }), { type: 'definition', identifier: defined, url: 'x' }));
      assert.deepEqual(image.links, [link('x', null, true, 'image')]);
    });
  }
  for (const [name, defined, used] of [['an i with a dot above and an i', '\u0130', 'i'], ['a letter and another', 'a', 'b'], ['an empty text and a space', '', ' '], ['a text and its prefix', 'ab', 'a'], ['a text with a space inside and without', 'a b', 'ab']]) {
    it(`a reference does not find the definition that differs by ${name}`, () => {
      assert.match(thrown(() => built(T(P_({ type: 'linkReference', identifier: used, children: [X] }), { type: 'definition', identifier: defined, url: 'x' }))).message, /^transform: docs\/test\.md: node of type linkReference has no source position$/);
    });
  }
});

// ---- U5: heading ids ---------------------------------------------------------------------------------------------------------------------------------------

describe('heading id rule table', () => {
  const ids = (source) => doc(source).headings.map((h) => h.id);
  it('duplicates get -1, -2', () => assert.deepEqual(ids('# A\n\n# A\n\n# A'), ['a', 'a-1', 'a-2']));
  it('the same text in another case is a duplicate', () => assert.deepEqual(ids('# Hello World\n\n# hello world'), ['hello-world', 'hello-world-1']));
  it('two calls in one process start again', () => {
    assert.deepEqual(ids('# A\n\n# A'), ['a', 'a-1']);
    assert.deepEqual(ids('# A\n\n# A'), ['a', 'a-1']);
    assert.deepEqual(ids('# A'), ['a']);
  });
  it('a code span in a heading is part of its text', () => {
    assert.deepEqual(doc('## The `paginate()` call').headings, [{ depth: 2, text: 'The paginate() call', id: 'the-paginate-call' }]);
  });
  it('html in a heading is slugged from the text as shown', () => {
    assert.deepEqual(doc(sections('node-kinds.md').get('heading-html')).headings, [{ depth: 1, text: 'Title <span>x</span>', id: 'title-spanxspan' }]);
  });
  it('emphasis in a heading is not part of its text', () => {
    assert.deepEqual(doc('# *a* and **b**').headings, [{ depth: 1, text: 'a and b', id: 'a-and-b' }]);
  });
  it('an empty heading has an empty id and no id attribute', () => {
    const result = doc('#');
    assert.deepEqual(result.headings, [{ depth: 1, text: '', id: '' }]);
    assert.equal(result.html, '<h1></h1>');
  });
  it('the id of a heading with a colon and a parenthesis', () => {
    assert.deepEqual(ids('# Combined commands: diff-digest (A235)'), ['combined-commands-diff-digest-a235']);
  });
  it('headings in a block quote and in a list are listed in tree order', () => {
    assert.deepEqual(doc('> # Quoted\n\n- # In list\n\n# Last').headings.map((h) => h.text), ['Quoted', 'In list', 'Last']);
  });
  it('setext headings keep their depth', () => {
    assert.deepEqual(doc('Title\n=====\n\nSub\n---').headings.map((h) => [h.depth, h.id]), [[1, 'title'], [2, 'sub']]);
  });
  it('only headings carry an id', () => {
    const { html } = doc('# T\n\ntext[^1]\n\n[^1]: note\n\n| a |\n| - |\n| b |\n\n```js\nx\n```\n\n- [x] item\n\n[r]: https://example.com/\n\n[r]');
    assert.deepEqual(dom(html)('[id]').toArray().map((el) => el.tagName), ['h1']);
  });
  it('an image in a heading contributes its alt text', () => {
    assert.deepEqual(doc('# ![alt](https://example.com/a.png) x').headings, [{ depth: 1, text: 'alt x', id: 'alt-x' }]);
  });


  // ---- closed world, round 3: a heading that slugs to nothing has no id; the slugger goes on counting ----
  for (const [name, source, text] of [['punctuation only', '# !!!', '!!!'], ['an emoji only', '# \u{1f600}', '\u{1f600}'], ['an empty heading', '#', ''], ['a symbol', '# \u00a9', '\u00a9'], ['an ideograph run is a slug of its own', '# \u4e2d', '\u4e2d']]) {
    it(`a heading of ${name} has no id and an empty id in the list`, () => {
      const result = accepted(() => doc(source));
      const expectedId = name.startsWith('an ideograph') ? '\u4e2d' : '';
      assert.deepEqual(result.headings, [{ depth: 1, text, id: expectedId }]);
      assert.equal(dom(result.html)('h1').attr('id'), expectedId === '' ? undefined : expectedId);
      assert.equal(result.html, expectedId === '' ? `<h1>${text}</h1>` : `<h1 id="${expectedId}">${text}</h1>`);
    });
  }
  it('empty ids are counted by the slugger: the second heading with no slug gets -1, the third -2', () => {
    const result = accepted(() => doc('# !!!\n\n# ???\n\n#\n\n# \u{1f600}\n\n# word'));
    assert.deepEqual(result.headings.map((h) => h.id), ['', '-1', '-2', '-3', 'word']);
    assert.deepEqual(dom(result.html)('h1').toArray().map((h) => h.attribs.id), [undefined, '-1', '-2', '-3', 'word']);
    assert.equal(result.html, '<h1>!!!</h1>\n<h1 id="-1">???</h1>\n<h1 id="-2"></h1>\n<h1 id="-3">\u{1f600}</h1>\n<h1 id="word">word</h1>');
  });
  it('a heading with no slug before and after a heading with one keeps the ids apart', () => {
    assert.deepEqual(doc('# !!!\n\n# a\n\n# !!!\n\n# a').headings.map((h) => h.id), ['', 'a', '-1', 'a-1']);
  });
  it('a hand-built heading without children has no id, and a second one whose text has no slug gets -1', () => {
    const none = renderTree({ type: 'root', children: [{ type: 'heading', depth: 3, children: [] }, { type: 'heading', depth: 2, children: [{ type: 'text', value: '?!' }] }] }, { path: PATH });
    assert.equal(none.html, '<h3></h3>\n<h2 id="-1">?!</h2>');
    assert.deepEqual(none.headings, [{ depth: 3, text: '', id: '' }, { depth: 2, text: '?!', id: '-1' }]);
  });
  it('the id is the slug of the visible text, with the case folded and the punctuation dropped', () => {
    assert.deepEqual(doc('# Hello, World! (v2)').headings, [{ depth: 1, text: 'Hello, World! (v2)', id: 'hello-world-v2' }]);
    assert.deepEqual(doc('# A_b - C.d').headings.map((h) => h.id), ['a_b---cd']);
  });
  it('the text of a heading is the visible text of its parts: a break and a definition-free node add nothing, a nested part adds its own text', () => {
    const text = (value) => ({ type: 'text', value });
    const result = renderTree({ type: 'root', children: [{ type: 'heading', depth: 2, children: [text('a'), { type: 'break' }, text('b'), { type: 'emphasis', children: [text('c'), { type: 'strong', children: [{ type: 'inlineCode', value: 'd' }] }] }, { type: 'html', value: '<e>' }] }] }, { path: PATH });
    assert.deepEqual(result.headings, [{ depth: 2, text: 'abcd<e>', id: 'abcde' }]);
    assert.equal(result.html, '<h2 id="abcde">a<br>\nb<em>c<strong><code>d</code></strong></em>&#x3C;e></h2>');
  });
  it('one slugger serves the whole document, whatever holds the heading, and a new one is made for every call', () => {
    const result = doc('# a\n\n> # a\n\n- # a\n\n1. ## a\n\n# A');
    assert.deepEqual(result.headings.map((h) => h.id), ['a', 'a-1', 'a-2', 'a-3', 'a-4']);
    for (let call = 0; call < 3; call++) assert.deepEqual(doc('# a\n\n# a').headings.map((h) => h.id), ['a', 'a-1']);
    assert.equal(renderMarkdown('# a\n\n# a'), '<h1 id="a">a</h1>\n<h1 id="a-1">a</h1>');
    assert.equal(renderMarkdown('# a\n\n# a'), '<h1 id="a">a</h1>\n<h1 id="a-1">a</h1>');
    const tree = { type: 'root', children: [{ type: 'heading', depth: 1, children: [{ type: 'text', value: 'a' }] }, { type: 'heading', depth: 1, children: [{ type: 'text', value: 'a' }] }] };
    assert.deepEqual(renderTree(tree, { path: PATH }).headings.map((h) => h.id), ['a', 'a-1']);
    assert.deepEqual(renderTree(tree, { path: PATH }).headings.map((h) => h.id), ['a', 'a-1']);
  });
});

// ---- U6: frontmatter ---------------------------------------------------------------------------------------------------------------------------------------

describe('frontmatter rule table', () => {
  it('a mapping', () => {
    const result = doc('---\na: 1\nb: [x, y]\n---\nbody');
    assert.deepEqual(result.frontmatter, { a: 1, b: ['x', 'y'] });
    assert.equal(result.html, '<p>body</p>');
  });
  it('keys keep their source order', () => assert.deepEqual(Object.keys(doc('---\nb: 1\na: 2\n---\n').frontmatter), ['b', 'a']));
  it('no frontmatter gives an empty object', () => {
    const result = doc('body');
    assert.deepEqual(result.frontmatter, {});
    assert.equal(result.html, '<p>body</p>');
  });
  it('an empty block gives an empty object', () => {
    const result = doc('---\n---\nbody');
    assert.deepEqual(result.frontmatter, {});
    assert.equal(result.html, '<p>body</p>');
  });
  it('the ... closer', () => assert.deepEqual(doc('---\na: 1\n...\nbody').frontmatter, { a: 1 }));
  it('trailing spaces on the opener and the closer', () => {
    const result = doc('---  \na: 1\n---\t \nbody');
    assert.deepEqual(result.frontmatter, { a: 1 });
    assert.equal(result.html, '<p>body</p>');
  });
  it('a leading U+FEFF before the opener', () => {
    const result = doc('\uFEFF---\na: 1\n---\nbody');
    assert.deepEqual(result.frontmatter, { a: 1 });
    assert.equal(result.html, '<p>body</p>');
  });
  it('carriage return line feed line endings', () => {
    const result = doc('---\r\na: 1\r\n---\r\nbody\r\n');
    assert.deepEqual(result.frontmatter, { a: 1 });
    assert.equal(result.html, '<p>body</p>');
  });
  it('a block that is not on the first line is not frontmatter', () => {
    const result = doc('x\n\n---\na: 1\n---\n');
    assert.deepEqual(result.frontmatter, {});
    assert.ok(visible(result.html).includes('a: 1'), 'its text stays visible');
  });
  it('throws when the block is not closed', () => {
    assert.match(thrown(() => doc('---\na: 1\nbody')).message, /^transform: docs\/test\.md:1: frontmatter is not closed$/);
  });
  it('throws on a YAML error', () => {
    assert.match(thrown(() => doc('---\na: [\n---\nbody')).message, /^transform: docs\/test\.md:1: frontmatter is not valid YAML: /);
  });
  it('throws on a scalar', () => {
    assert.match(thrown(() => doc('---\njust text\n---\n')).message, /^transform: docs\/test\.md:1: frontmatter is not a mapping$/);
  });
  it('throws on a sequence', () => {
    assert.match(thrown(() => doc('---\n- a\n- b\n---\n')).message, /^transform: docs\/test\.md:1: frontmatter is not a mapping$/);
  });
  it('the lines after the block are the lines of the file', () => {
    assert.deepEqual(doc('---\na: 1\nb: 2\n---\n\n[x](https://example.com/)').links, [{ kind: 'link', url: 'https://example.com/', line: 6, rendered: true }]);
    assert.match(thrown(() => doc(`---\na: 1\n---\n\n${HEADER}\n\n${HEADER}`)).message, /^transform: docs\/test\.md:7: a second translated-from header$/);
  });
  it('the offsets after the block are the offsets of the file, so a source slice is whole', () => {
    assert.equal(doc('---\na: 1\n---\n\nsee <path:line>').html, '<p>see &#x3C;path:line></p>');
    assert.equal(doc('\uFEFF---\na: 1\n---\n\nsee <path:line>').html, '<p>see &#x3C;path:line></p>');
  });
  const bothLinks = [{ kind: 'link', url: 'https://example.com/', line: 5, rendered: true }, { kind: 'link', url: 'path:line', line: 5, rendered: false }];
  it('carriage return line feed endings keep the lines and the offsets of the file', () => {
    const result = doc('---\r\na: 1\r\n---\r\n\r\n[x](https://example.com/) and <path:line>\r\n');
    assert.deepEqual(result.links, bothLinks);
    assert.equal(result.html, '<p><a href="https://example.com/">x</a> and &#x3C;path:line></p>');
  });
  it('lone carriage return endings keep the lines and the offsets of the file', () => {
    const result = doc('---\ra: 1\r---\r\r[x](https://example.com/) and <path:line>\r');
    assert.deepEqual(result.links, bothLinks);
    assert.equal(result.html, '<p><a href="https://example.com/">x</a> and &#x3C;path:line></p>');
  });
  it('a lone carriage return right after a line feed is a line of its own, so the closer behind it is found', () => {
    assert.match(thrown(() => doc('---\n\r---\nbody')).message, /^transform: docs\/test\.md:1: frontmatter is not a mapping$/);
    assert.match(thrown(() => doc('---\n\r\r---\nbody')).message, /^transform: docs\/test\.md:1: frontmatter is not a mapping$/);
  });
  it('line feed, carriage return and carriage return line feed endings in one block keep the line of the file', () => {
    const result = doc('---\na: 1\r\nb: 2\r---\n[x](https://example.com/) and <path:line>');
    assert.deepEqual(result.links, [{ kind: 'link', url: 'https://example.com/', line: 5, rendered: true }, { kind: 'link', url: 'path:line', line: 5, rendered: false }]);
    assert.equal(result.html, '<p><a href="https://example.com/">x</a> and &#x3C;path:line></p>');
  });
  it('fragment mode removes a leading U+FEFF so its source slices stay whole', () => {
    assert.equal(renderMarkdown('\uFEFFsee <path:line> and [^1]'), '<p>see &#x3C;path:line> and [^1]</p>');
    assert.equal(renderMarkdown('see <path:line> and [^1]'), '<p>see &#x3C;path:line> and [^1]</p>');
  });
  it('fragment mode does not split a leading block off', () => {
    assert.ok(visible(renderMarkdown('---\nname: x\n---\n\nbody')).includes('name: x'));
  });
  it('a path that is not a non-empty string throws', () => {
    for (const path of ['', undefined, 5]) assert.match(thrown(() => transformDocument(path, 'x')).message, /^transform: /);
  });
  it('a source that is not a string throws', () => {
    for (const source of [undefined, null, 5, Buffer.from('x')]) assert.match(thrown(() => transformDocument(PATH, source)).message, /^transform: docs\/test\.md: source must be a string$/);
  });
  it('options that are not an object or a rewrite that is not a function throw', () => {
    assert.match(thrown(() => transformDocument(PATH, 'x', null)).message, /options must be an object/);
    assert.match(thrown(() => transformDocument(PATH, 'x', { rewrite: 'no' })).message, /options\.rewrite must be a function/);
  });
  it('renderMarkdown takes a string', () => {
    assert.match(thrown(() => renderMarkdown(5)).message, /^transform: /);
  });

  // ---- closed world: the opener, the closer, the YAML value, the mask, the BOM and the argument checks ----
  // A first line that only starts like the opener is not an opener: the document renders and nothing throws.
  const notOpeners = [
    ['four hyphens', '----\ntext', '<hr>\n<p>text</p>'],
    ['five hyphens', '-----\ntext', '<hr>\n<p>text</p>'],
    ['three hyphens and a word', '--- x\ntext', '<p>--- x\ntext</p>'],
    ['three hyphens and a letter', '---x\ntext', '<p>---x\ntext</p>'],
    ['three hyphens and a no-break space', '---\u00a0\ntext', '<p>---\u00a0\ntext</p>'],
    ['three hyphens and a form feed', '---\f\ntext', '<p>---\f\ntext</p>'],
    ['two hyphens', '--\ntext', '<p>--\ntext</p>'],
    ['a space before the hyphens', ' ---\ntext', '<hr>\n<p>text</p>'],
    ['a tab before the hyphens', '\t---\ntext', '<pre><code>---\n</code></pre>\n<p>text</p>'],
    ['an empty first line', '\n---\na: 1\n---\nbody', '<hr>\n<h2 id="a-1">a: 1</h2>\n<p>body</p>'],
    ['three dots', '...\ntext', '<p>...\ntext</p>'],
    ['three dots and a space', '... \ntext', '<p>...\ntext</p>'],
    ['four dots', '....\ntext', '<p>....\ntext</p>'],
    ['two dots', '..\ntext', '<p>..\ntext</p>'],
    ['three dots and a closer-like block', '...\na: 1\n...\nbody', '<p>...\na: 1\n...\nbody</p>'],
    ['hyphens with spaces between', '- - -\ntext', '<hr>\n<p>text</p>'],
    ['four hyphens and a block that looks like frontmatter', '----\na: 1\n---\nbody', '<hr>\n<h2 id="a-1">a: 1</h2>\n<p>body</p>'],
  ];
  for (const [name, source, expected] of notOpeners) {
    it(`not an opener: ${name}`, () => {
      const result = doc(source);
      assert.deepEqual(result.frontmatter, {});
      assert.equal(result.html, expected);
    });
  }
  for (const [name, opener] of [['no trailing whitespace', '---'], ['one trailing space', '--- '], ['trailing spaces', '---   '], ['one trailing tab', '---\t'], ['trailing tabs', '---\t\t'], ['spaces and tabs mixed', '--- \t \t']]) {
    it(`an opener: ${name}`, () => {
      const result = doc(`${opener}\na: 1\n---\nbody`);
      assert.deepEqual(result.frontmatter, { a: 1 });
      assert.equal(result.html, '<p>body</p>');
    });
  }
  it('a document that is only an opener is not closed', () => {
    for (const source of ['---', '---\n', '---\r\n', '---\r', '---  \n', '---\n\n']) assert.match(thrown(() => doc(source)).message, /^transform: docs\/test\.md:1: frontmatter is not closed$/, JSON.stringify(source));
  });
  // The closer is a line of its own: three hyphens or three dots, then spaces and tabs only.
  const notClosers = [
    ['four hyphens', '----'], ['three hyphens and a word', '--- x'], ['three hyphens and a letter', '---x'], ['a space before three hyphens', ' ---'], ['a tab before three hyphens', '\t---'],
    ['two hyphens', '--'], ['four dots', '....'], ['three dots and a word', '... x'], ['three dots and a letter', '...x'], ['two dots', '..'], ['a space before three dots', ' ...'],
    ['a word before three hyphens', 'b---'], ['a value that ends in three dots', 'a: b...'], ['a value that ends in three hyphens', 'a: b---'], ['three hyphens and a no-break space', '---\u00a0'],
    ['hyphens and a dot', '--.'], ['dots and a hyphen', '..-'], ['a hyphen and two dots', '-..'], ['an ellipsis character', '\u2026'], ['an em dash', '\u2014'],
  ];
  for (const [name, line] of notClosers) {
    it(`not a closer: ${name}`, () => assert.match(thrown(() => doc(`---\na: 1\n${line}\nbody`)).message, /^transform: docs\/test\.md:1: frontmatter is not closed$/));
  }
  it('a line that only starts like a closer is YAML text, and the real closer after it ends the block', () => {
    assert.match(thrown(() => doc('---\na: 1\n----\nb: 2\n---\nbody')).message, /^transform: docs\/test\.md:1: frontmatter is not valid YAML: /);
  });
  for (const [name, closer] of [['three hyphens', '---'], ['three dots', '...'], ['three hyphens and spaces', '---  '], ['three dots and a tab', '...\t'], ['three hyphens, a tab and a space', '---\t '], ['three dots and spaces', '...   ']]) {
    it(`a closer: ${name}`, () => {
      const result = doc(`---\na: 1\n${closer}\nbody`);
      assert.deepEqual(result.frontmatter, { a: 1 });
      assert.equal(result.html, '<p>body</p>');
    });
  }
  it('a closer on the last line without a line break', () => {
    for (const closer of ['---', '...', '---  ']) {
      const result = doc(`---\na: 1\n${closer}`);
      assert.deepEqual(result.frontmatter, { a: 1 });
      assert.equal(result.html, '');
    }
  });
  it('the first closer ends the block: a later line of hyphens is part of the body', () => {
    const result = doc('---\na: 1\n---\nb: 2\n---\nbody');
    assert.deepEqual(result.frontmatter, { a: 1 });
    assert.equal(result.html, '<h2 id="b-2">b: 2</h2>\n<p>body</p>');
  });
  it('the first closer ends the block: a dots line after a hyphens closer is part of the body', () => {
    assert.deepEqual(doc('---\na: 1\n...\nb: 2\n---\nbody').frontmatter, { a: 1 });
  });
  it('an opener and a closer with nothing between give an empty object, and a second hyphens line is a thematic break', () => {
    const result = doc('---\n---\n---\nbody');
    assert.deepEqual(result.frontmatter, {});
    assert.equal(result.html, '<hr>\n<p>body</p>');
  });
  // The YAML value.
  it('YAML 1.2 core: a merge key is a key named <<, not a merge', () => {
    assert.deepEqual(doc('---\nbase: &b {x: 1}\nchild:\n  <<: *b\n  y: 2\n---\n').frontmatter, { base: { x: 1 }, child: { '<<': { x: 1 }, y: 2 } });
  });
  it('an alias bomb throws instead of being expanded', () => {
    const bomb = 'a: &a [x]\nb: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]\nc: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]\nd: &d [*c, *c, *c, *c, *c, *c, *c, *c, *c, *c]\ne: [*d, *d, *d, *d, *d, *d, *d, *d, *d, *d]\n';
    assert.match(thrown(() => doc(`---\n${bomb}---\n`)).message, /^transform: docs\/test\.md:1: frontmatter is not valid YAML: Excessive alias count/);
    const many = `a: &a [x]\nl: [${Array(1000).fill('*a').join(', ')}]\n`;
    assert.match(thrown(() => doc(`---\n${many}---\n`)).message, /not valid YAML: Excessive alias count/);
  });
  it('a few aliases are fine', () => {
    const few = `base: &x [1, 2, 3]\nlist: [${Array(60).fill('*x').join(', ')}]\n`;
    assert.equal(doc(`---\n${few}---\n`).frontmatter.list.length, 60);
  });
  it('throws on duplicate keys with the YAML message', () => {
    const error = thrown(() => doc('---\na: 1\na: 2\n---\nbody'));
    assert.match(error.message, /^transform: docs\/test\.md:1: frontmatter is not valid YAML: Map keys must be unique/);
    assert.ok(!error.message.includes('\n'), 'the message holds the first line of the YAML message only');
  });
  it('throws on duplicate keys below a key', () => {
    assert.match(thrown(() => doc('---\na:\n  b: 1\n  b: 2\n---\n')).message, /not valid YAML: Map keys must be unique/);
  });
  it('keys that differ in case are not duplicates', () => assert.deepEqual(doc('---\nA: 1\na: 2\n---\n').frontmatter, { A: 1, a: 2 }));
  it('a flow mapping is a mapping', () => assert.deepEqual(doc('---\n{a: 1, b: [x]}\n---\n').frontmatter, { a: 1, b: ['x'] }));
  it('a nested mapping is kept', () => assert.deepEqual(doc('---\na:\n  b: c\n---\n').frontmatter, { a: { b: 'c' } }));
  for (const [name, block] of [['only a comment', '# c\n'], ['only comments', '# a\n# b\n'], ['only blank lines', '\n\n'], ['only spaces', '   \n'], ['the word null', 'null\n'], ['a tilde', '~\n'], ['null in a comment line after', 'null # c\n']]) {
    it(`an empty value gives an empty object: ${name}`, () => {
      const result = doc(`---\n${block}---\nb`);
      assert.deepEqual(result.frontmatter, {});
      assert.equal(result.html, '<p>b</p>');
    });
  }
  for (const [name, block] of [['zero', '0'], ['a number', '42'], ['false', 'false'], ['true', 'true'], ['an empty string', '""'], ['a string', 'just text'], ['a tagged string', '!!str x'], ['a sequence', '- a'], ['a flow sequence', '[a]'], ['an empty flow sequence', '[]'], ['a date-like word', '2020-01-01']]) {
    it(`a value that is not a mapping throws: ${name}`, () => {
      assert.match(thrown(() => doc(`---\n${block}\n---\nb`)).message, /^transform: docs\/test\.md:1: frontmatter is not a mapping$/);
    });
  }
  it('an empty flow mapping is an empty object', () => assert.deepEqual(doc('---\n{}\n---\nb').frontmatter, {}));
  // The mask: nothing of the block reaches the body, and no character of it moves an offset.
  it('every kind of character in the block is masked and the offsets after it hold', () => {
    const block = 'a: "!@#$%^&*() \\u00e9 \u4e2d \ud83d\ude00 \u2028 <script>x</script>"\nb:\t"tab"\n';
    const result = doc(`---\n${block}---\n\nsee <path:line> and [x](https://example.com/)`);
    assert.equal(result.html, '<p>see &#x3C;path:line> and <a href="https://example.com/">x</a></p>');
    assert.deepEqual(result.links, [{ kind: 'link', url: 'path:line', line: 6, rendered: false }, { kind: 'link', url: 'https://example.com/', line: 6, rendered: true }]);
  });
  it('an astral character in the block does not move the offsets of the body', () => {
    const result = doc('---\na: "\ud83d\ude00\ud83d\ude00\ud83d\ude00"\n---\n\nsee <path:line>');
    assert.equal(result.html, '<p>see &#x3C;path:line></p>');
    assert.deepEqual(result.frontmatter, { a: '\ud83d\ude00\ud83d\ude00\ud83d\ude00' });
  });
  it('a non-ASCII value and a tab in the block are masked', () => {
    const result = doc('---\na: "\u00e9\u4e2d"\nb: "x\ty"\n---\n\nsee <path:line>');
    assert.equal(result.html, '<p>see &#x3C;path:line></p>');
  });
  it('the block is masked up to and including the closer line, and not one character more', () => {
    assert.equal(doc('---\na: 1\n---\n# T\n\ntext <path:line>').html, '<h1 id="t">T</h1>\n<p>text &#x3C;path:line></p>');
    assert.equal(doc('---\na: 1\n---\ntext <path:line>').html, '<p>text &#x3C;path:line></p>');
    assert.equal(doc('---\na: 1\n...\n    code\n').html, '<pre><code>code\n</code></pre>');
  });
  it('the mask keeps every line break of the block, so a heading on the first line after it is on line 4 of the file', () => {
    const result = doc('---\na: 1\n---\n[x](https://example.com/)');
    assert.deepEqual(result.links, [{ kind: 'link', url: 'https://example.com/', line: 4, rendered: true }]);
  });
  // The BOM: only leading ones are removed, every one of them.
  it('a BOM that is not the first character stays in the text', () => assert.equal(doc('a\ufeffb').html, '<p>a\ufeffb</p>'));
  it('a BOM after a line break stays in the text', () => assert.equal(doc('a\n\ufeffb').html, '<p>a\n\ufeffb</p>'));
  it('two leading BOMs are both removed and the offsets of the body hold', () => {
    assert.equal(doc('\ufeff\ufeffsee <path:line>').html, '<p>see &#x3C;path:line></p>');
    assert.equal(renderMarkdown('\ufeff\ufeffsee <path:line>'), '<p>see &#x3C;path:line></p>');
  });
  it('three leading BOMs are all removed and the offsets of the body hold', () => {
    assert.equal(doc('\ufeff\ufeff\ufeffsee <path:line>').html, '<p>see &#x3C;path:line></p>');
  });
  it('two leading BOMs before an opener still make a frontmatter block', () => {
    const result = doc('\ufeff\ufeff---\na: 1\n---\nbody');
    assert.deepEqual(result.frontmatter, { a: 1 });
    assert.equal(result.html, '<p>body</p>');
  });
  it('a BOM in a document without frontmatter keeps the slices whole', () => {
    assert.equal(doc('\ufeffsee <path:line> and [^1]').html, '<p>see &#x3C;path:line> and [^1]</p>');
  });
  // Every printable character next to the three hyphens or the three dots: the opener and the closer have no other neighbour than spaces and tabs.
  for (const ch of PRINTABLE.filter((c) => c !== ' ')) {
    it(`not an opener: three hyphens then ${JSON.stringify(ch)}`, () => {
      const result = doc(`---${ch}\ntext`);
      assert.deepEqual(result.frontmatter, {});
      assert.ok(visible(result.html).includes('text'));
    });
    it(`not a closer: three hyphens then ${JSON.stringify(ch)}`, () => assert.match(thrown(() => doc(`---\na: 1\n---${ch}\nbody`)).message, /frontmatter is not closed$/));
    it(`not a closer: three dots then ${JSON.stringify(ch)}`, () => assert.match(thrown(() => doc(`---\na: 1\n...${ch}\nbody`)).message, /frontmatter is not closed$/));
  }
  for (const ch of PRINTABLE) {
    it(`not an opener: ${JSON.stringify(ch)} then three hyphens`, () => {
      const result = doc(`${ch}---\ntext`);
      assert.deepEqual(result.frontmatter, {});
      assert.ok(visible(result.html).includes('text'));
    });
    it(`not a closer: ${JSON.stringify(ch)} then three hyphens`, () => assert.match(thrown(() => doc(`---\na: 1\n${ch}---\nbody`)).message, /frontmatter is not closed$/));
    it(`not a closer: ${JSON.stringify(ch)} then three dots`, () => assert.match(thrown(() => doc(`---\na: 1\n${ch}...\nbody`)).message, /frontmatter is not closed$/));
  }
  for (const ch of ['\u000b', '\f', '\u00a0', '\u1680', '\u2003', '\u200b', '\u3000', '\ufeff', '\u0085']) {
    it(`not an opener, not a closer: U+${hex4(ch.charCodeAt(0))} after the hyphens is not a space or a tab`, () => {
      assert.deepEqual(doc(`---${ch}\ntext`).frontmatter, {});
      assert.match(thrown(() => doc(`---\na: 1\n---${ch}\nbody`)).message, /frontmatter is not closed$/);
      assert.match(thrown(() => doc(`---\na: 1\n...${ch}\nbody`)).message, /frontmatter is not closed$/);
    });
  }
  it('every printable ASCII character in the block is masked: none of them reaches the body', () => {
    const quoted = (text) => `"${text.replace(/[\\"]/g, '\\$&')}"`;
    const result = doc(`---\na: ${quoted(PRINTABLE.join(''))}\nb: ${quoted('\u00e9\u4e2d\ud83d\ude00\u0131')}\nc:\t${quoted('\t')}\n---\nbody`);
    assert.equal(result.html, '<p>body</p>');
    assert.equal(result.frontmatter.a, PRINTABLE.join(''));
  });
  it('every printable ASCII character in the block leaves the offsets of the body whole', () => {
    const quoted = (text) => `"${text.replace(/[\\"]/g, '\\$&')}"`;
    const result = doc(`---\na: ${quoted(PRINTABLE.join(''))}\n---\n\nsee <path:line>`);
    assert.equal(result.html, '<p>see &#x3C;path:line></p>');
  });
  // The arguments.
  for (const path of ['', undefined, null, 5, {}, ['a.md']]) {
    it(`a path of ${JSON.stringify(path) ?? String(path)} throws the invalid path error`, () => {
      assert.equal(thrown(() => transformDocument(path, 'x')).message, 'transform: (invalid path): path must be a non-empty string');
      assert.equal(thrown(() => renderTree({ type: 'root', children: [] }, { path })).message, 'transform: (invalid path): path must be a non-empty string');
    });
  }
  for (const value of [undefined, null, 5, {}, ['x'], true]) {
    it(`renderMarkdown of ${JSON.stringify(value) ?? String(value)} throws the fragment error`, () => assert.equal(thrown(() => renderMarkdown(value)).message, 'transform: (fragment): text must be a string'));
  }
  for (const options of [null, 5, 'x', true]) {
    it(`options of ${JSON.stringify(options)} throw`, () => assert.equal(thrown(() => transformDocument(PATH, 'x', options)).message, 'transform: docs/test.md: options must be an object'));
  }
  for (const rewrite of [null, 5, 'no', {}, true, false]) {
    it(`a rewrite of ${JSON.stringify(rewrite)} throws`, () => assert.equal(thrown(() => transformDocument(PATH, 'x', { rewrite })).message, 'transform: docs/test.md: options.rewrite must be a function'));
  }
  it('no options, empty options and a rewrite that is undefined are all fine', () => {
    for (const options of [undefined, {}, { rewrite: undefined }]) assert.equal(transformDocument(PATH, 'x', options).html, '<p>x</p>');
  });
  it('an empty source is an empty document', () => {
    const result = doc('');
    assert.deepEqual([result.html, result.frontmatter, result.headings, result.links, result.translatedFrom], ['', {}, [], [], null]);
    assert.equal(renderMarkdown(''), '');
  });

  // ---- closed world, round 3: the line and the column of a YAML error, the strict parser, the removal of the BOM ----
  const yamlText = (text) => `transform: docs/test.md:1: frontmatter is not valid YAML: ${text}`;
  const yamlError = (source) => thrown(() => doc(source)).message;
  const EOLS = [['line feed', '\n'], ['carriage return line feed', '\r\n']];
  // The YAML parser reports the line of its own text: the text starts at the line after the opener, whatever the opener ends with, and every line break of the block counts once.
  for (const [name, eol] of EOLS) {
    for (const blanks of [0, 1, 2, 3]) {
      it(`the YAML error line: duplicate key, ${name} endings, ${blanks} blank lines after the opener`, () => {
        assert.equal(yamlError(`---${eol}${eol.repeat(blanks)}a: 1${eol}a: 2${eol}---${eol}x`), yamlText(`Map keys must be unique at line ${2 + blanks}, column 1:`));
        assert.equal(yamlError(`---  ${eol}${eol.repeat(blanks)}a: 1${eol}a: 2${eol}---  ${eol}x`), yamlText(`Map keys must be unique at line ${2 + blanks}, column 1:`));
        assert.equal(yamlError(`\ufeff---${eol}${eol.repeat(blanks)}a: 1${eol}a: 2${eol}---${eol}x`), yamlText(`Map keys must be unique at line ${2 + blanks}, column 1:`));
        assert.equal(yamlError(`\ufeff\ufeff---${eol}${eol.repeat(blanks)}a: 1${eol}a: 2${eol}---${eol}x`), yamlText(`Map keys must be unique at line ${2 + blanks}, column 1:`));
      });
    }
    it(`the YAML error line: the error is on the third and the fourth line, ${name} endings`, () => {
      assert.equal(yamlError(`---${eol}a: 1${eol}b: 2${eol}b: 3${eol}---${eol}x`), yamlText('Map keys must be unique at line 3, column 1:'));
      assert.equal(yamlError(`---${eol}a: 1${eol}b: 2${eol}c: 3${eol}c: 4${eol}---${eol}x`), yamlText('Map keys must be unique at line 4, column 1:'));
    });
    it(`the YAML error line and column: an indented duplicate key, ${name} endings`, () => {
      assert.equal(yamlError(`---${eol}a:${eol}  b: 1${eol}  b: 2${eol}---${eol}x`), yamlText('Map keys must be unique at line 3, column 3:'));
    });
    it(`the YAML error on the first line: ${name} endings`, () => {
      assert.equal(yamlError(`---${eol}\ta: 1${eol}---${eol}x`), yamlText('Tabs are not allowed as indentation at line 1, column 1:'));
      assert.equal(yamlError(`---${eol}a: [${eol}b: 1${eol}---${eol}x`), yamlText('Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 1:'));
    });
  }
  it('the YAML error line: line feed, carriage return line feed and carriage return line feed endings in one block', () => {
    assert.equal(yamlError('---\na: 1\r\nb: 2\r\nb: 3\n---\nx'), yamlText('Map keys must be unique at line 3, column 1:'));
    assert.equal(yamlError('---\r\na: 1\nb: 2\nb: 3\r\n---\nx'), yamlText('Map keys must be unique at line 3, column 1:'));
    assert.equal(yamlError('---\na: 1\r\na: 2\r---\nx'), yamlText('Map keys must be unique at line 2, column 1:'));
  });
  // A lone carriage return is a line break of the file but not one of the YAML parser, which then reads the block as one line: the text it is given is the whole block, from the first character after the opener's break.
  for (const blanks of [0, 1, 2, 3]) {
    it(`the YAML error column: duplicate key, lone carriage return endings, ${blanks} blank lines after the opener`, () => {
      assert.equal(yamlError(`---\r${'\r'.repeat(blanks)}a: 1\ra: 2\r---\rx`), yamlText(`Nested mappings are not allowed in compact mappings at line 1, column ${4 + blanks}:`));
    });
  }
  // Each error that the parser only makes in its strict mode throws, with its column.
  for (const [name, value, column, parsed] of [['a double-quoted scalar', '"x"#c', 7, 'x'], ['a single-quoted scalar', "'x'#c", 7, 'x'], ['a flow sequence', '[1, 2]#c', 10, [1, 2]], ['a flow mapping', '{b: 1}#c', 10, { b: 1 }], ['a block scalar header', '|#c\n  t', 5, 't\n']]) {
    it(`strict YAML: a comment glued to ${name} throws`, () => {
      assert.equal(yamlError(`---\na: ${value}\n---\nb`), yamlText(`Comments must be separated from other tokens by white space characters at line 1, column ${column}:`));
    });
    it(`strict YAML: a comment after a space behind ${name} is a comment`, () => {
      assert.deepEqual(doc(`---\na: ${value.replace('#', ' #')}\n---\nb`).frontmatter, { a: parsed });
    });
  }
  it('YAML 1.2 core: the values that the 1.1 schema, a BigInt option or a loose parser would change', () => {
    assert.deepEqual(doc('---\na: yes\nb: 010\nc: 0o10\nd: 1_000\ne: 0x1F\nf: ~\ng: null\nh: 10\ni: 1.5\nj: .inf\nk: on\n---\nx').frontmatter, { a: 'yes', b: 10, c: 8, d: '1_000', e: 31, f: null, g: null, h: 10, i: 1.5, j: Infinity, k: 'on' });
    assert.deepEqual(doc('---\na: 2001-01-01\nb: 12:30:45\nc: !!str 1\nd: "x"\n---\nx').frontmatter, { a: '2001-01-01', b: '12:30:45', c: '1', d: 'x' });
  });
  it('keys that are not strings become the text of the JavaScript object key, as the parser makes it', () => {
    assert.deepEqual(doc('---\n1: a\ntrue: b\n~: c\n1.5: d\n0x10: f\n---\nx').frontmatter, { 1: 'a', true: 'b', '': 'c', 1.5: 'd', 16: 'f' });
    assert.deepEqual(Object.keys(doc('---\n1: a\ntrue: b\n~: c\n1.5: d\n---\nx').frontmatter), ['1', 'true', '', '1.5']);
  });
  it('a key that is a collection becomes its flow text, with the warning of the parser, which is not silenced', async () => {
    const warnings = [];
    const printers = process.listeners('warning');
    process.removeAllListeners('warning');
    process.on('warning', (warning) => warnings.push(warning.message));
    try {
      assert.deepEqual(doc('---\n[a]: 1\n? {x: 1}\n: 2\n---\nx').frontmatter, { '[ a ]': 1, '{ x: 1 }': 2 });
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.removeAllListeners('warning');
      for (const printer of printers) process.on('warning', printer);
    }
    assert.equal(warnings.length, 1, 'the parser warns once for the whole block');
    assert.match(warnings[0], /^Keys with collection values will be stringified due to JS Object restrictions: "\[ a \]"/);
  });
  it('an anchor and an alias give the same value, and a merge key is a key of its own', () => {
    assert.deepEqual(doc('---\na: &x [1, 2]\nb: *x\n---\nx').frontmatter, { a: [1, 2], b: [1, 2] });
    assert.deepEqual(doc('---\nbase: &b {k: 1}\nuse:\n  <<: *b\n  j: 2\n---\nx').frontmatter, { base: { k: 1 }, use: { '<<': { k: 1 }, j: 2 } });
  });
  it('the frontmatter is a plain object with the keys in source order, not a Map and not a null-prototype object', () => {
    const { frontmatter } = doc('---\nz: 1\ny:\n  x: [1, 2]\n---\n');
    assert.equal(Object.getPrototypeOf(frontmatter), Object.prototype);
    assert.equal(Object.getPrototypeOf(frontmatter.y), Object.prototype);
    assert.deepEqual(frontmatter, { z: 1, y: { x: [1, 2] } });
  });
  it('a tag the schema does not know gives its value and a warning of the parser, which is not silenced', async () => {
    const warnings = [];
    const listener = (warning) => warnings.push(warning);
    const printers = process.listeners('warning');
    process.removeAllListeners('warning');
    process.on('warning', listener);
    try {
      assert.deepEqual(doc('---\na: !foo bar\n---\nx').frontmatter, { a: 'bar' });
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.off('warning', listener);
      for (const printer of printers) process.on('warning', printer);
    }
    assert.deepEqual(warnings.map((w) => w.code), ['TAG_RESOLVE_FAILED']);
  });

  // The BOM: only U+FEFF is removed, one or many, and only at the very start. Everything else stays: it is text, so before the opener it means there is no opener.
  const BOM_COUNTS = [0, 1, 2, 3, 7];
  const bom = (count) => '\ufeff'.repeat(count);
  const KEPT_AS_TEXT = [['U+200B', '\u200b'], ['U+200C', '\u200c'], ['U+200D', '\u200d'], ['U+2060', '\u2060'], ['U+00A0', '\u00a0'], ['U+0085', '\u0085'], ['U+2028', '\u2028'], ['U+2029', '\u2029'], ['U+3000', '\u3000'], ['U+000B', '\v'], ['U+000C', '\f'],
    ['U+1680', '\u1680'], ['U+2003', '\u2003'], ['U+202F', '\u202f'], ['U+180E', '\u180e'], ['U+00AD', '\u00ad'], ['U+FFFE', '\ufffe'], ['U+FFFD', '\ufffd'], ['U+1F600', '\u{1f600}'], ['U+E0001', '\u{e0001}']];
  for (const [name, ch] of KEPT_AS_TEXT) {
    for (const count of BOM_COUNTS) {
      it(`${count} BOM then ${name}: the character is kept in a document, and with it there is no opener`, () => {
        const result = doc(`${bom(count)}${ch}---\na: 1\n---\nx`);
        assert.deepEqual(result.frontmatter, {});
        assert.equal(dom(result.html)('h2').text(), `${ch}---\na: 1`);
        assert.equal(dom(result.html)('p').text(), 'x');
      });
      it(`${count} BOM then ${name}: the character is kept in a fragment, in front of a number sign that is then no heading`, () => {
        assert.equal(renderMarkdown(`${bom(count)}${ch}hello <b>x</b>`), `<p>${ch}hello &#x3C;b>x&#x3C;/b></p>`);
        assert.equal(renderMarkdown(`${bom(count)}${ch}# t`), `<p>${ch}# t</p>`);
        assert.deepEqual(doc(`${bom(count)}${ch}# t\n\ntext`).headings, []);
      });
    }
  }
  for (const [name, ch, docHtml, fragHtml] of [
    ['a space', ' ', '<hr>\n<h2 id="a-1">a: 1</h2>\n<p>x</p>', '<p>hello &#x3C;b>x&#x3C;/b></p>'],
    ['a tab', '\t', '<pre><code>---\n</code></pre>\n<h2 id="a-1">a: 1</h2>\n<p>x</p>', '<pre><code>hello &#x3C;b>x&#x3C;/b>\n</code></pre>'],
    ['a line feed', '\n', '<hr>\n<h2 id="a-1">a: 1</h2>\n<p>x</p>', '<p>hello &#x3C;b>x&#x3C;/b></p>'],
    ['a carriage return', '\r', '<hr>\n<h2 id="a-1">a: 1</h2>\n<p>x</p>', '<p>hello &#x3C;b>x&#x3C;/b></p>'],
    ['four spaces', '    ', '<pre><code>---\n</code></pre>\n<h2 id="a-1">a: 1</h2>\n<p>x</p>', '<pre><code>hello &#x3C;b>x&#x3C;/b>\n</code></pre>'],
    ['a blank line and a space', '\n ', '<hr>\n<h2 id="a-1">a: 1</h2>\n<p>x</p>', '<p>hello &#x3C;b>x&#x3C;/b></p>'],
  ]) {
    for (const count of BOM_COUNTS) {
      it(`${count} BOM then ${name}: no opener in a document, the white space is read as markdown`, () => {
        const result = doc(`${bom(count)}${ch}---\na: 1\n---\nx`);
        assert.deepEqual(result.frontmatter, {});
        assert.equal(result.html, docHtml);
      });
      it(`${count} BOM then ${name}: a fragment reads the white space as markdown`, () => assert.equal(renderMarkdown(`${bom(count)}${ch}hello <b>x</b>`), fragHtml));
    }
  }
  it('a BOM is removed at the start only: one after the first character, after a break or after the frontmatter stays', () => {
    assert.equal(renderMarkdown('a\ufeffb'), '<p>a\ufeffb</p>');
    assert.equal(renderMarkdown('\ufeffa\ufeffb'), '<p>a\ufeffb</p>');
    assert.equal(renderMarkdown('\ufeff\ufeffa\ufeff\ufeffb\ufeff'), '<p>a\ufeff\ufeffb\ufeff</p>');
    assert.equal(renderMarkdown('a\n\n\ufeffb'), '<p>a</p>\n<p>\ufeffb</p>');
    assert.equal(doc('---\na: 1\n---\n\ufeffx').html, '<p>\ufeffx</p>');
    assert.equal(doc('\ufeff---\na: 1\n---\n\ufeff\ufeffx').html, '<p>\ufeff\ufeffx</p>');
    assert.deepEqual(doc('x\n\ufeff---\na: 1\n---\n').frontmatter, {});
  });
  // Every position of the three characters of the opener and of the closer is a character of its own: any other character in one place of them, or a mix of hyphens and dots, makes a line that is neither.
  const THREES = [];
  for (const c of [...PRINTABLE, ...SWEEP.filter((x) => !['\t', '\n', '\r'].includes(x))]) {
    THREES.push(`${c}--`, `-${c}-`, `--${c}`);
  }
  it('a first line that has two hyphens and one other character, in any place, or fewer hyphens, is no opener', () => {
    for (const first of [...THREES, '--', '-', '', ' --', '-- -', '- --', '- - -', '___', '***', '===', '\u2014', '\u2013\u2013\u2013', '\u2010\u2010\u2010', '\u2212\u2212\u2212', '...', '. . .', '--.', '-.-', '.--', '-..', '.-.', '..-']) {
      if (/^---[ \t]*$/.test(first)) continue;
      assert.deepEqual(doc(`${first}\na: 1\n---\nx`).frontmatter, {}, JSON.stringify(first));
    }
  });
  it('a line that has two of the three characters of a closer and one other, in any place, or a mix of hyphens and dots, is no closer', () => {
    const notClosed = /^transform: docs\/test\.md:1: frontmatter is not closed$/;
    const lines = [...THREES, ...THREES.map((three) => three.replaceAll('-', '.')), '--.', '-.-', '.--', '-..', '.-.', '..-', '--', '..', '-', '.', '-.', '.-', '\u2014', '\u2013\u2013\u2013', '\u2026'];
    for (const line of lines) {
      if (/^(?:---|\.\.\.)[ \t]*$/.test(line)) continue;
      assert.match(thrown(() => doc(`---\na: 1\n${line}\nx`)).message, notClosed, JSON.stringify(line));
    }
  });
  for (const count of [1, 2, 3, 7]) {
    for (const [name, eol] of [['line feed', '\n'], ['carriage return line feed', '\r\n'], ['carriage return', '\r'], ['no line break at all', '']]) {
      it(`${count} BOM before an opener that is never closed throws, ${name}`, () => {
        const notClosed = 'transform: docs/test.md:1: frontmatter is not closed';
        assert.equal(thrown(() => doc(`${bom(count)}---`)).message, notClosed);
        if (eol === '') return;
        assert.equal(thrown(() => doc(`${bom(count)}---${eol}a: 1${eol}body`)).message, notClosed);
        assert.equal(thrown(() => doc(`${bom(count)}---${eol}`)).message, notClosed);
        assert.equal(thrown(() => doc(`${bom(count)}---${eol}a: 1${eol}--${eol}b`)).message, notClosed);
      });
    }
  }
  it('a text of BOMs only is an empty document', () => {
    for (const count of [1, 2, 3, 7]) {
      assert.equal(renderMarkdown(bom(count)), '');
      assert.deepEqual([doc(bom(count)).html, doc(bom(count)).frontmatter], ['', {}]);
    }
  });
  for (const count of BOM_COUNTS) {
    for (const [name, eol] of [['line feed', '\n'], ['carriage return line feed', '\r\n'], ['carriage return', '\r']]) {
      it(`${count} BOM, ${name} endings: the lines and the offsets of the body are those of the text after the BOMs`, () => {
        const result = doc(`${bom(count)}---${eol}a: 1${eol}---${eol}${eol}[x](https://example.com/) and <path:line> and [^n]${eol}`);
        assert.deepEqual(result.frontmatter, { a: eol === '\r' ? '1\r' : 1 }, 'a lone carriage return is not a line break of the YAML parser');
        assert.equal(result.html, '<p><a href="https://example.com/">x</a> and &#x3C;path:line> and [^n]</p>');
        assert.deepEqual(result.links, [{ kind: 'link', url: 'https://example.com/', line: 5, rendered: true }, { kind: 'link', url: 'path:line', line: 5, rendered: false }]);
      });
    }
  }

  // The opener and the closer: three hyphens (or dots) and then spaces and tabs only. Every other character next to them, on either side, makes the line something else.
  for (const ch of SWEEP.filter((c) => c !== '\t' && c !== '\n' && c !== '\r')) {
    it(`${label(ch)} next to the hyphens of the opener or of the closer makes neither`, () => {
      const notClosed = /^transform: docs\/test\.md:1: frontmatter is not closed$/;
      assert.deepEqual(doc(`---${ch}\na: 1\n---\nx`).frontmatter, {});
      if (ch !== '\ufeff') assert.deepEqual(doc(`${ch}---\na: 1\n---\nx`).frontmatter, {}, 'only a BOM is removed in front of an opener');
      assert.match(thrown(() => doc(`---\na: 1\n---${ch}\nx`)).message, notClosed);
      assert.match(thrown(() => doc(`---\na: 1\n...${ch}\nx`)).message, notClosed);
      assert.match(thrown(() => doc(`---\na: 1\n${ch}---\nx`)).message, notClosed);
      assert.match(thrown(() => doc(`---\na: 1\n${ch}...\nx`)).message, notClosed);
    });
    it(`${label(ch)} in front of a BOM: the BOM is not at the start, so it is kept and there is no opener`, () => {
      if (ch === '\ufeff') return;
      assert.deepEqual(doc(`${ch}\ufeff---\na: 1\n---\nx`).frontmatter, {});
      assert.deepEqual(doc(`\ufeff${ch}\ufeff---\na: 1\n---\nx`).frontmatter, {});
      assert.equal(renderMarkdown(`${ch}\ufeffa`).includes('\ufeff'), true);
      assert.equal(renderMarkdown(`\ufeff${ch}\ufeffa`).includes('\ufeff'), true);
      assert.equal(visible(renderMarkdown(`${ch}\ufeffa`)).endsWith('\ufeffa'), true);
    });
    it(`${label(ch)} inside the frontmatter block is masked, and the lines and offsets after the block hold`, () => {
      const result = doc(`---\na: "${ch}"\n---\n\n[x](https://example.com/) <path:line>`);
      assert.equal(result.html, '<p><a href="https://example.com/">x</a> &#x3C;path:line></p>');
      assert.deepEqual(result.links.map((l) => l.line), [5, 5]);
      assert.equal(typeof result.frontmatter.a, 'string');
    });
  }
  it('a document of only a closed block, with the closer at the very end of the text, with and without a line break', () => {
    for (const eol of ['\n', '\r\n', '\r']) {
      for (const closer of ['---', '...', '---  ', '...\t']) {
        for (const tail of ['', eol]) {
          const result = doc(`---${eol}a: 1${eol}${closer}${tail}`);
          assert.deepEqual([result.frontmatter.a === 1 || result.frontmatter.a === '1\r', result.html], [true, ''], JSON.stringify([eol, closer, tail]));
        }
      }
      assert.deepEqual(doc(`---${eol}---`).frontmatter, {});
      assert.deepEqual(doc(`---${eol}...${eol}`).frontmatter, {});
    }
  });
  // The line of an error in a document is the line of the file, whatever the line endings, the BOMs in front and the block above.
  for (const [name, eol] of [['line feed', '\n'], ['carriage return line feed', '\r\n'], ['carriage return', '\r']]) {
    for (const count of [0, 1, 2]) {
      for (const [block, lines] of [['no frontmatter', 0], ['a frontmatter block', 3]]) {
        it(`the line of an error: ${name} endings, ${count} BOM, ${block}`, () => {
          const head = `${bom(count)}${block === 'no frontmatter' ? '' : `---${eol}a: 1${eol}---${eol}`}`;
          const at = (n) => `transform: docs/test.md:${lines + n}: `;
          assert.equal(thrown(() => doc(`${head}x${eol}${eol}<!-- translated-from: bad -->${eol}`)).message, `${at(3)}malformed translated-from header`);
          assert.equal(thrown(() => doc(`${head}${HEADER}${eol}${eol}y${eol}${eol}${HEADER}${eol}`)).message, `${at(5)}a second translated-from header`);
          assert.equal(thrown(() => doc(`${head}x${eol}${eol}[a](${eol}y.md)${eol}`, { rewrite: () => 'javascript:x' })).message, `${at(4)}rewrite returned an unsafe target`);
          assert.equal(thrown(() => doc(`${head}x${eol}${eol}![a](y.png)${eol}`, { rewrite: () => 'javascript:x' })).message, `${at(3)}rewrite returned an unsafe target`);
          assert.deepEqual(doc(`${head}[a](${eol}y.md)${eol}${eol}[b][r]${eol}${eol}[r]: z.md${eol}`).links.map((l) => [l.url, l.line]), [['y.md', lines + 2], ['z.md', lines + 6]]);
        });
      }
    }
  }
  it('the first closer ends the block: a second block-like text after it is body text', () => {
    const result = doc('---\na: 1\n---\n---\nb: 2\n---\nx');
    assert.deepEqual(result.frontmatter, { a: 1 });
    assert.equal(result.html, '<hr>\n<h2 id="b-2">b: 2</h2>\n<p>x</p>');
    assert.deepEqual(doc('---\na: 1\n...\n---\nb: 2\n...\nx').frontmatter, { a: 1 });
  });
  it('a dots closer ends a hyphens block and a hyphens closer ends a block that was opened with hyphens only', () => {
    assert.deepEqual(doc('---\na: 1\n...\nbody').frontmatter, { a: 1 });
    assert.deepEqual(doc('---\na: 1\n---\nbody').frontmatter, { a: 1 });
    assert.deepEqual(doc('...\na: 1\n---\nbody').frontmatter, {});
  });
});

// ---- U7: the rebuild of the mdast --------------------------------------------------------------------------------------------------------------------------

describe('rebuild rule table', () => {
  const text = (value, extra = {}) => ({ type: 'text', value, ...extra });
  const para = (...children) => ({ type: 'paragraph', children });
  const tree = (...children) => ({ type: 'root', children });
  const html = (mdast, source = '') => renderTree(mdast, { path: PATH, source }).html;
  const position = (start, end) => ({ start: { line: 1, column: start + 1, offset: start }, end: { line: 1, column: end + 1, offset: end } });

  it('data.hName, hProperties and hChildren on a text node are not copied', () => {
    assert.equal(html(tree(para(text('x', { data: { hName: 'script', hProperties: { onload: 'a' }, hChildren: [text('evil')] } })))), '<p>x</p>');
  });
  it('data on a heading with an empty text is not copied either', () => {
    assert.equal(html(tree({ type: 'heading', depth: 1, children: [], data: { hName: 'script', hProperties: { onclick: 'a' } } })), '<h1></h1>');
  });
  it('data on a paragraph is not copied', () => {
    assert.equal(html(tree({ ...para(text('x')), data: { hName: 'div', hProperties: { onclick: 'a', class: 'c' } } })), '<p>x</p>');
  });
  it('data on a heading is not copied; the id is the slug', () => {
    assert.equal(html(tree({ type: 'heading', depth: 2, children: [text('Title')], data: { hName: 'script', hProperties: { id: 'evil', onclick: 'a' } } })), '<h2 id="title">Title</h2>');
  });
  it('data on a link and on inline code is not copied', () => {
    const result = html(tree(para({ type: 'link', url: 'https://example.com/', children: [text('a')], data: { hProperties: { onclick: 'a' } } }, { type: 'inlineCode', value: 'c', data: { hName: 'script' } })));
    assert.equal(result, '<p><a href="https://example.com/">a</a><code>c</code></p>');
  });
  it('lang and meta of a code block are not copied', () => {
    const result = html(tree({ type: 'code', lang: 'js" onmouseover=alert(1)', meta: 'x', value: 'code' }));
    assert.equal(result, '<pre><code>code\n</code></pre>');
  });
  it('title of a link is not copied', () => {
    assert.equal(html(tree(para({ type: 'link', url: 'https://example.com/', title: 'javascript:alert(1)', children: [text('a')] }))), '<p><a href="https://example.com/">a</a></p>');
  });
  it('an html node with data becomes text', () => {
    assert.equal(html(tree({ type: 'html', value: '<script>x</script>', data: { hName: 'script' } })), '<p>&#x3C;script>x&#x3C;/script></p>');
  });
  it('an html node in a paragraph becomes text', () => {
    assert.equal(html(tree(para({ type: 'html', value: '<b>' }))), '<p>&#x3C;b></p>');
  });
  it('a raw node (the shape allowDangerousHtml makes) is an unknown type', () => {
    assert.match(thrown(() => html(tree({ type: 'raw', value: '<script>x</script>' }))).message, /^transform: docs\/test\.md: unsupported node type raw$/);
  });
  for (const type of ['yaml', 'toml', 'mdxJsxFlowElement', 'mdxFlowExpression', 'containerDirective', 'math']) {
    it(`an unknown node type throws: ${type}`, () => {
      assert.match(thrown(() => html(tree({ type, value: 'x', children: [text('y')] }))).message, new RegExp(`^transform: docs/test\\.md: unsupported node type ${type}$`));
    });
  }
  it('an unknown node with children is not turned into a div', () => {
    assert.match(thrown(() => html(tree({ type: 'unknownThing', children: [text('y')] }))).message, /unsupported node type unknownThing/);
  });
  it('an unknown node inside a paragraph throws too', () => {
    assert.match(thrown(() => html(tree(para({ type: 'strange' })))).message, /unsupported node type strange/);
  });
  it('a node without a type throws', () => {
    assert.match(thrown(() => html(tree({ value: 'x' }))).message, /^transform: docs\/test\.md: a node has no type$/);
  });
  it('a tree that is not a root throws', () => {
    assert.match(thrown(() => html(para(text('x')))).message, /^transform: docs\/test\.md: the tree is not a root node$/);
  });
  for (const align of ['justify', 'LEFT', '', 5, undefined]) {
    it(`a table alignment of ${String(align)} throws`, () => {
      const cell = { type: 'tableCell', children: [text('a')] };
      assert.match(thrown(() => html(tree({ type: 'table', align: [align], children: [{ type: 'tableRow', children: [cell] }] }))).message, /unsupported table alignment/);
    });
  }
  it('a table alignment of left, right, center and null is kept', () => {
    const row = (tag) => ({ type: 'tableRow', children: ['a', 'b', 'c', 'd'].map((v) => ({ type: 'tableCell', children: [text(v)] })) });
    const result = html(tree({ type: 'table', align: ['left', 'right', 'center', null], children: [row(), row()] }));
    assert.deepEqual(dom(result)('thead th').toArray().map((th) => th.attribs.align), ['left', 'right', 'center', undefined]);
  });
  it('a checked list item shows its marker as text and has no input', () => {
    const result = html(tree({ type: 'list', ordered: false, spread: false, children: [{ type: 'listItem', checked: true, spread: false, children: [para(text('done'))] }, { type: 'listItem', checked: false, spread: false, children: [para(text('open'))] }] }));
    assert.equal(result, '<ul>\n<li>[x] done</li>\n<li>[ ] open</li>\n</ul>');
  });
  it('a checked list item whose first child is not a paragraph gets a paragraph for the marker', () => {
    const result = dom(html(tree({ type: 'list', ordered: false, spread: false, children: [{ type: 'listItem', checked: false, spread: false, children: [{ type: 'code', value: 'x' }] }] })));
    assert.equal(result('input').length, 0);
    assert.ok(result('li').text().startsWith('[ ] '));
    assert.equal(result('li > pre > code').length, 1);
  });
  it('an empty checked list item still shows its marker', () => {
    assert.equal(html(tree({ type: 'list', ordered: false, spread: false, children: [{ type: 'listItem', checked: true, spread: false, children: [] }] })), '<ul>\n<li>[x] </li>\n</ul>');
  });
  it('an ordered list keeps its start only when it is not 1', () => {
    const list = (start) => tree({ type: 'list', ordered: true, start, spread: false, children: [{ type: 'listItem', spread: false, children: [para(text('a'))] }] });
    assert.ok(html(list(3)).startsWith('<ol start="3">'));
    assert.ok(html(list(1)).startsWith('<ol>'));
  });
  it('a definition node is dropped', () => {
    assert.equal(html(tree(para(text('x')), { type: 'definition', identifier: 'a', label: 'a', url: 'javascript:alert(1)', title: null })), '<p>x</p>');
  });
  it('a reference without a definition shows its source text', () => {
    const source = 'see [x][nope] ok';
    assert.equal(html(tree(para(text('see '), { type: 'linkReference', identifier: 'nope', label: 'nope', referenceType: 'full', children: [text('x')], position: position(4, 13) })), source), '<p>see [x][nope]</p>');
  });
  it('a footnote reference and definition show their source text', () => {
    const result = doc(sections('node-kinds.md').get('footnote'));
    assert.equal(result.html, '<p>Text with a note.[^1]</p>\n<p>[^1]: The note text.</p>');
  });
  it('a heading depth outside 1 to 6 reaches the guard, which throws', () => {
    assert.match(thrown(() => html(tree({ type: 'heading', depth: 7, children: [text('x')] }))).message, /^transform: docs\/test\.md: unsafe output: the element h7$/);
  });
  it('the guard runs inside the pipeline on the result of remark-rehype', () => {
    assert.match(thrown(() => html(tree({ type: 'heading', depth: 0, children: [text('x')] }))).message, /unsafe output/);
  });
  it('the task markers of a parsed list are text', () => {
    assert.equal(doc(sections('node-kinds.md').get('task-list')).html, '<ul>\n<li>[x] done item</li>\n<li>[ ] open item</li>\n</ul>');
  });
  it('a fence with an info string has no class', () => {
    assert.equal(doc(sections('node-kinds.md').get('fence-info')).html, '<pre><code>code\n</code></pre>');
  });
  it('a right-aligned table keeps align as an attribute', () => {
    const result = doc(sections('node-kinds.md').get('right-aligned-table')).html;
    assert.deepEqual(dom(result)('th, td').toArray().map((c) => c.attribs.align), [undefined, 'right', undefined, 'right']);
    assert.equal(dom(result)('[style]').length, 0);
  });
  it('html in a heading, a table cell and a list item stays text', () => {
    const cell = doc(sections('node-kinds.md').get('html-in-cell-and-item')).html;
    assert.equal(dom(cell)('i, b').length, 0);
    assert.ok(visible(cell).includes('<i>b</i>') && visible(cell).includes('<b>c</b>'));
  });
  it('a comment followed by text on the same line shows as text', () => {
    assert.equal(doc(sections('node-kinds.md').get('comment-then-text')).html, '<p>&#x3C;!-- c --> trailing text</p>');
  });
  // One row per node type the pass copies by hand: `data` (hName, hProperties, hChildren) of the source node never reaches the output.
  const poison = { hName: 'script', hProperties: { onclick: 'a', id: 'evil', className: ['c'] }, hChildren: [{ type: 'text', value: 'evil' }] };
  const li = (extra = {}, children = [para(text('a'))]) => ({ type: 'listItem', spread: false, children, ...extra });
  const cellTable = (table = {}, row = {}, cell = {}) => ({ type: 'table', align: ['left'], children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: [text('a')], ...cell }], ...row }], ...table });
  const dataRows = [
    ['root', (x) => ({ type: 'root', children: [para(text('x'))], ...x }), '<p>x</p>'],
    ['paragraph', (x) => tree({ ...para(text('x')), ...x }), '<p>x</p>'],
    ['blockquote', (x) => tree({ type: 'blockquote', children: [para(text('x'))], ...x }), '<blockquote>\n<p>x</p>\n</blockquote>'],
    ['emphasis', (x) => tree(para({ type: 'emphasis', children: [text('x')], ...x })), '<p><em>x</em></p>'],
    ['strong', (x) => tree(para({ type: 'strong', children: [text('x')], ...x })), '<p><strong>x</strong></p>'],
    ['delete', (x) => tree(para({ type: 'delete', children: [text('x')], ...x })), '<p><del>x</del></p>'],
    ['list', (x) => tree({ type: 'list', ordered: false, spread: false, children: [li()], ...x }), '<ul>\n<li>a</li>\n</ul>'],
    ['listItem', (x) => tree({ type: 'list', ordered: false, spread: false, children: [li(x)] }), '<ul>\n<li>a</li>\n</ul>'],
    ['table', (x) => tree(cellTable(x)), '<table>\n<thead>\n<tr>\n<th align="left">a</th>\n</tr>\n</thead>\n</table>'],
    ['tableRow', (x) => tree(cellTable({}, x)), '<table>\n<thead>\n<tr>\n<th align="left">a</th>\n</tr>\n</thead>\n</table>'],
    ['tableCell', (x) => tree(cellTable({}, {}, x)), '<table>\n<thead>\n<tr>\n<th align="left">a</th>\n</tr>\n</thead>\n</table>'],
    ['code', (x) => tree({ type: 'code', value: 'c', ...x }), '<pre><code>c\n</code></pre>'],
    ['inlineCode', (x) => tree(para({ type: 'inlineCode', value: 'c', ...x })), '<p><code>c</code></p>'],
    ['thematicBreak', (x) => tree({ type: 'thematicBreak', ...x }), '<hr>'],
    ['break', (x) => tree(para(text('a'), { type: 'break', ...x }, text('b'))), '<p>a<br>\nb</p>'],
    ['image', (x) => tree(para({ type: 'image', url: 'https://e.com/i.png', alt: 'a', ...x })), '<p><a href="https://e.com/i.png">a</a></p>'],
    ['html', (x) => tree(para({ type: 'html', value: '<b>', ...x })), '<p>&#x3C;b></p>'],
  ];
  for (const [type, build, expected] of dataRows) {
    it(`data on a ${type} node is not copied`, () => {
      assert.equal(html(build({})), expected, 'the clean tree');
      assert.equal(html(build({ data: poison })), expected, 'the tree with data');
      assert.equal(html(build({ data: { hProperties: { onclick: 'a' } } })), expected, 'the tree with an event property');
    });
  }

  it('a list item that is loose by its own spread gives paragraphs, in a tight list', () => {
    assert.equal(html(tree({ type: 'list', ordered: false, spread: false, children: [li({ spread: true })] })), '<ul>\n<li>\n<p>a</p>\n</li>\n</ul>');
  });
  it('a loose list gives paragraphs in items that are tight themselves', () => {
    assert.equal(html(tree({ type: 'list', ordered: false, spread: true, children: [li()] })), '<ul>\n<li>\n<p>a</p>\n</li>\n</ul>');
  });
  it('a tight list and tight items give no paragraph', () => {
    assert.equal(html(tree({ type: 'list', ordered: false, spread: false, children: [li(), li()] })), '<ul>\n<li>a</li>\n<li>a</li>\n</ul>');
  });
  it('a table without an align array is rendered, not thrown on', () => {
    const result = dom(html(tree({ type: 'table', children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: [text('a')] }] }] })));
    assert.equal(result('table').length, 1);
    assert.equal(result('thead').length, 1);
  });
  it('a loose list from the parser: the list spread is kept', () => {
    assert.equal(doc('- a\n\n- b').html, '<ul>\n<li>\n<p>a</p>\n</li>\n<li>\n<p>b</p>\n</li>\n</ul>');
  });
  it('a loose item from the parser: the item spread is kept', () => {
    assert.equal(doc('- a\n\n  b\n- c').html, '<ul>\n<li>\n<p>a</p>\n<p>b</p>\n</li>\n<li>\n<p>c</p>\n</li>\n</ul>');
  });
  it('a tight list from the parser has no paragraph in its items', () => {
    assert.equal(doc('- a\n- b').html, '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
  });
  it('a thematic break is kept', () => {
    assert.equal(doc('a\n\n---\n\nb').html, '<p>a</p>\n<hr>\n<p>b</p>');
    assert.equal(doc('***').html, '<hr>');
  });
  it('a hard break is kept', () => {
    assert.equal(doc('a  \nb').html, '<p>a<br>\nb</p>');
    assert.equal(doc('a\\\nb').html, '<p>a<br>\nb</p>');
  });
  it('a thematic break and a hard break together', () => {
    assert.equal(doc('a  \nb\n\n---').html, '<p>a<br>\nb</p>\n<hr>');
  });
  it('strikethrough is a del element', () => {
    assert.equal(doc('~~gone~~').html, '<p><del>gone</del></p>');
  });
  it('emphasis is an em element and strong is a strong element', () => {
    assert.equal(doc('*a* and _b_').html, '<p><em>a</em> and <em>b</em></p>');
    assert.equal(doc('**c** and __d__').html, '<p><strong>c</strong> and <strong>d</strong></p>');
    assert.equal(doc('***e***').html, '<p><em><strong>e</strong></em></p>');
  });
  it('a definition inside a block quote is found by a reference outside it', () => {
    const result = doc('> [x]: https://example.com/\n\n[a][x]');
    assert.equal(result.html, '<blockquote>\n</blockquote>\n<p><a href="https://example.com/">a</a></p>');
    assert.deepEqual(result.links, [{ kind: 'link', url: 'https://example.com/', line: 1, rendered: true }]);
  });
  it('a definition inside a list item is found by a reference outside it', () => {
    const result = doc('- [x]: https://example.com/\n\n[a][x]');
    assert.equal(result.html, '<ul>\n<li></li>\n</ul>\n<p><a href="https://example.com/">a</a></p>');
    assert.deepEqual(result.links, [{ kind: 'link', url: 'https://example.com/', line: 1, rendered: true }]);
  });
  it('a definition inside a block quote is found by an image reference outside it', () => {
    const result = doc('> [x]: https://example.com/i.png\n\n![a][x]');
    assert.deepEqual(result.links, [{ kind: 'image', url: 'https://example.com/i.png', line: 1, rendered: true }]);
  });
  it('an image in strong in a link is text, not a nested link', () => {
    const result = doc('[**![a](https://e.com/x.png)**](https://e.com/)');
    assert.equal(result.html, '<p><a href="https://e.com/"><strong>a</strong></a></p>');
    assert.deepEqual(result.links, [{ kind: 'link', url: 'https://e.com/', line: 1, rendered: true }, { kind: 'image', url: 'https://e.com/x.png', line: 1, rendered: false }]);
  });
  it('an image in emphasis and in strikethrough in a link is text, not a nested link', () => {
    assert.equal(doc('[*![a](https://e.com/x.png)*](https://e.com/)').html, '<p><a href="https://e.com/"><em>a</em></a></p>');
    assert.equal(doc('[~~![a](https://e.com/x.png)~~](https://e.com/)').html, '<p><a href="https://e.com/"><del>a</del></a></p>');
  });
  // The flag "inside a link label" is carried through every node type that has children (a hand-built tree can hold them below a link).
  const wrappers = {
    emphasis: (c) => ({ type: 'emphasis', children: c }),
    strong: (c) => ({ type: 'strong', children: c }),
    delete: (c) => ({ type: 'delete', children: c }),
    paragraph: (c) => para(...c),
    blockquote: (c) => ({ type: 'blockquote', children: c }),
    heading: (c) => ({ type: 'heading', depth: 1, children: c }),
    list: (c) => ({ type: 'list', ordered: false, spread: false, children: [li({}, c)] }),
    table: (c) => ({ type: 'table', align: [null], children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: c }] }] }),
  };
  for (const [name, wrap] of Object.entries(wrappers)) {
    it(`an image below a ${name} below a link is text`, () => {
      const result = renderTree(tree(para({ type: 'link', url: 'https://e.com/', children: [wrap([{ type: 'image', url: 'https://e.com/x.png', alt: 'a' }])] })), { path: PATH });
      assert.equal(result.html.split('<a ').length - 1, 1, 'one anchor start tag in the html as written (a parser would reshape a block inside an anchor)');
      assert.deepEqual(result.links.map((l) => [l.kind, l.rendered]), [['link', true], ['image', false]]);
    });
  }

  it('a document nested too deeply throws the transform error with its path, not a bare RangeError', () => {
    const error = thrown(() => doc(`${'>'.repeat(5000)} x`));
    assert.ok(!(error instanceof RangeError), 'the error is not the engine stack error');
    assert.match(error.message, /^transform: docs\/test\.md: /);
    assert.match(thrown(() => renderMarkdown(`${'>'.repeat(3000)} x`)).message, /^transform: \(fragment\): /);
  });
  it('the deep nesting error says what happened and keeps the message of the engine error', () => {
    assert.match(thrown(() => doc(`${'>'.repeat(5000)} x`)).message, /^transform: docs\/test\.md: the document could not be rendered: .+/);
    assert.match(thrown(() => renderMarkdown(`${'>'.repeat(3000)} x`)).message, /^transform: \(fragment\): the document could not be rendered: .+/);
  });
  it('a RangeError of the pipeline is reported with the path and its own message, word for word', () => {
    const error = thrown(() => doc('[a](x.md)', { rewrite: () => { throw new RangeError('depth of the hook'); } }));
    assert.equal(error.message, 'transform: docs/test.md: the document could not be rendered: depth of the hook');
    assert.ok(!(error instanceof RangeError));
    assert.equal(thrown(() => transformDocument('docs/other.md', '[a](x.md)', { rewrite: () => { throw new RangeError('x'); } })).message, 'transform: docs/other.md: the document could not be rendered: x');
  });
  it('an error that is not a RangeError from the pipeline keeps its own message and type', () => {
    const boom = new TypeError('boom of the hook');
    const error = thrown(() => doc('[a](docs/a.md)', { rewrite: () => { throw boom; } }));
    assert.equal(error, boom);
    assert.ok(error instanceof TypeError);
    assert.equal(error.message, 'boom of the hook');
  });

  it('the input tree is not changed', () => {
    const input = tree({ type: 'heading', depth: 1, children: [text('T')], data: { hName: 'script' } });
    const before = JSON.stringify(input);
    html(input);
    assert.equal(JSON.stringify(input), before);
  });

  // ---- closed world of the rebuild: every node type that the pass names, every value of every field it reads, every type it must not know ----
  const KNOWN = ['root', 'paragraph', 'blockquote', 'emphasis', 'strong', 'delete', 'tableRow', 'tableCell', 'heading', 'thematicBreak', 'break', 'text', 'inlineCode', 'code', 'list', 'listItem', 'table', 'html', 'link', 'linkReference', 'image', 'imageReference', 'definition', 'footnoteReference', 'footnoteDefinition'];
  const unknownTypes = ['raw', 'yaml', 'toml', 'mdxJsxFlowElement', 'mdxJsxTextElement', 'mdxFlowExpression', 'mdxTextExpression', 'mdxjsEsm', 'containerDirective', 'leafDirective', 'textDirective', 'math', 'inlineMath',
    'footnote', 'element', 'comment', 'doctype', 'tableCaption', 'inline_code', 'inline code', 'x', ' ', '', 'paragraphs', 'textt', 'hr', 'br', 'a', 'p', 'div', 'script', 'span', 'img', 'ul', 'ol', 'li', 'em', 'b', 'i', 'pre', 'h1'];
  for (const known of KNOWN) {
    for (const variant of new Set([known.toLowerCase(), known.toUpperCase(), known[0].toUpperCase() + known.slice(1), `${known}x`, `x${known}`, `${known} `, ` ${known}`, known.slice(0, -1)])) {
      if (KNOWN.includes(variant)) continue;
      unknownTypes.push(variant);
    }
  }
  unknownTypes.push(...STRANGE_WORDS.filter((w) => !unknownTypes.includes(w)), ...'abcdefghijklmnopqrstuvwxyz'.split('').filter((w) => !unknownTypes.includes(w)));
  for (const type of unknownTypes) {
    it(`an unknown node type throws: ${JSON.stringify(type)}`, () => {
      assert.equal(thrown(() => html(tree(para({ type, value: 'x', children: [text('y')] })))).message, `transform: docs/test.md: unsupported node type ${type}`);
    });
  }
  it('an unknown node type at the top of the tree throws too, and names the line of its position', () => {
    const node = { type: 'strange', position: { start: { line: 7, column: 1, offset: 0 }, end: { line: 7, column: 2, offset: 1 } } };
    assert.equal(thrown(() => html(tree(node))).message, 'transform: docs/test.md:7: unsupported node type strange');
  });
  it('an unknown node type deep in the tree throws', () => {
    assert.match(thrown(() => html(tree({ type: 'blockquote', children: [{ type: 'list', ordered: false, spread: false, children: [li({}, [para({ type: 'emphasis', children: [{ type: 'strange' }] })])] }] }))).message, /unsupported node type strange$/);
  });
  for (const [name, node] of [['an empty object', {}], ['a type that is a number', { type: 5 }], ['a type that is null', { type: null }], ['no type but a value', { value: 'x' }], ['a number', 5], ['a string', 'x'], ['an array', []], ['null', null], ['undefined', undefined], ['true', true]]) {
    it(`a child that is ${name} throws a node has no type error`, () => {
      assert.equal(thrown(() => html(tree(para(node)))).message, 'transform: docs/test.md: a node has no type');
    });
    it(`a child of the root that is ${name} throws a node has no type error`, () => {
      assert.equal(thrown(() => html(tree(node))).message, 'transform: docs/test.md: a node has no type');
    });
  }
  it('a tree that is not a root throws, whatever its type', () => {
    for (const node of [text('x'), para(text('x')), { type: 'rooted', children: [] }, { type: 'Root', children: [] }]) {
      assert.equal(thrown(() => html(node)).message, 'transform: docs/test.md: the tree is not a root node');
    }
  });
  // The alignment of a table: four values are kept, everything else throws.
  for (const align of ['left', 'right', 'center', null]) {
    for (const place of ['first', 'last']) {
      it(`a table alignment of ${JSON.stringify(align)} is kept in the ${place} column`, () => {
        const cells = (v) => ({ type: 'tableRow', children: [text('a'), text('b')].map((t) => ({ type: 'tableCell', children: [t] })) });
        const result = html(tree({ type: 'table', align: place === 'first' ? [align, null] : [null, align], children: [cells(), cells()] }));
        const heads = dom(result)('thead th').toArray().map((th) => th.attribs.align);
        assert.deepEqual(heads, (place === 'first' ? [align, null] : [null, align]).map((a) => a ?? undefined));
        assert.deepEqual(dom(result)('tbody td').toArray().map((td) => td.attribs.align), heads);
      });
    }
  }
  for (const align of [...STRANGE_WORDS, 'Left', 'Center', 'RIGHT', 'start', 'end', 'top', 'middle', 'char', ' left', 'left ', 'l', 'lef', 'leftt', 'centre', true, false, 0, 1, {}, ['left'], NaN]) {
    it(`a table alignment of ${JSON.stringify(align) ?? String(align)} throws, in any column`, () => {
      const row = { type: 'tableRow', children: [{ type: 'tableCell', children: [text('a')] }, { type: 'tableCell', children: [text('b')] }] };
      for (const aligns of [[align, null], [null, align], ['left', align]]) {
        assert.equal(thrown(() => html(tree({ type: 'table', align: aligns, children: [row] }))).message, `transform: docs/test.md: unsupported table alignment ${String(align)}`);
      }
    });
  }
  it('a table alignment that is not an array is the same as no alignment', () => {
    const row = { type: 'tableRow', children: [{ type: 'tableCell', children: [text('a')] }] };
    for (const align of [undefined, null, 'left', 5, {}]) assert.equal(dom(html(tree({ type: 'table', align, children: [row] })))('table').length, 1);
  });
  // The heading depth is copied, never computed: 1 to 6 give h1 to h6, anything else reaches the guard.
  for (const depth of [1, 2, 3, 4, 5, 6]) {
    it(`a heading of depth ${depth} is h${depth} with its id, and the list says so`, () => {
      const result = renderTree(tree({ type: 'heading', depth, children: [text('x')] }), { path: PATH });
      assert.equal(result.html, `<h${depth} id="x">x</h${depth}>`);
      assert.deepEqual(result.headings, [{ depth, text: 'x', id: 'x' }]);
    });
  }
  for (const depth of [0, 7, 8, 10, 11, 60, -1, 1.5, undefined, null, NaN]) {
    it(`a heading of depth ${String(depth)} reaches the guard, which throws`, () => {
      assert.match(thrown(() => html(tree({ type: 'heading', depth, children: [text('x')] }))).message, new RegExp(`^transform: docs/test\\.md: unsafe output: the element h${String(depth).replace('.', '\\.')}$`));
    });
  }
  // The task marker: only a boolean makes one.
  for (const [checked, marker] of [[true, '[x] '], [false, '[ ] ']]) {
    it(`a list item with checked ${checked} starts with ${JSON.stringify(marker)}`, () => assert.equal(html(tree({ type: 'list', ordered: false, spread: false, children: [li({ checked })] })), `<ul>\n<li>${marker}a</li>\n</ul>`));
  }
  for (const checked of [null, undefined, 'true', 'false', 1, 0, '', {}, []]) {
    it(`a list item with checked ${JSON.stringify(checked) ?? 'undefined'} has no marker`, () => assert.equal(html(tree({ type: 'list', ordered: false, spread: false, children: [li({ checked })] })), '<ul>\n<li>a</li>\n</ul>'));
  }
  it('the marker goes before the text of the first paragraph and nowhere else', () => {
    const result = html(tree({ type: 'list', ordered: false, spread: true, children: [li({ checked: true }, [para(text('one')), para(text('two'))])] }));
    assert.equal(result, '<ul>\n<li>\n<p>[x] one</p>\n<p>two</p>\n</li>\n</ul>');
  });
  it('the marker of an item whose first child is a table is a paragraph of its own before it', () => {
    const result = html(tree({ type: 'list', ordered: false, spread: false, children: [li({ checked: false }, [{ type: 'table', align: [null], children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: [text('c')] }] }] }])] }));
    assert.ok(result.startsWith('<ul>\n<li>[ ] \n<table>'), result);
    assert.equal(dom(result)('li > table').length, 1);
    assert.equal(dom(result)('input').length, 0);
  });
  // The list: ordered and start are read, and start only counts for an ordered list.
  const listOf = (extra) => tree({ type: 'list', spread: false, children: [li()], ...extra });
  for (const [name, extra, expected] of [
    ['ordered from 0', { ordered: true, start: 0 }, '<ol start="0">\n<li>a</li>\n</ol>'],
    ['ordered from 1', { ordered: true, start: 1 }, '<ol>\n<li>a</li>\n</ol>'],
    ['ordered from 2', { ordered: true, start: 2 }, '<ol start="2">\n<li>a</li>\n</ol>'],
    ['ordered from 10', { ordered: true, start: 10 }, '<ol start="10">\n<li>a</li>\n</ol>'],
    ['ordered with no start', { ordered: true }, '<ol>\n<li>a</li>\n</ol>'],
    ['ordered with a null start', { ordered: true, start: null }, '<ol>\n<li>a</li>\n</ol>'],
    ['unordered with no start', { ordered: false }, '<ul>\n<li>a</li>\n</ul>'],
    ['unordered with a null start', { ordered: false, start: null }, '<ul>\n<li>a</li>\n</ul>'],
    ['with no ordered field', {}, '<ul>\n<li>a</li>\n</ul>'],
  ]) it(`a list that is ${name}`, () => assert.equal(html(listOf(extra)), expected));
  it('an unordered list that carries a start reaches the guard, which throws', () => {
    assert.equal(thrown(() => html(listOf({ ordered: false, start: 5 }))).message, 'transform: docs/test.md: unsafe output: the property start on ul');
  });
  for (const [source, expected] of [['0. a', '<ol start="0">\n<li>a</li>\n</ol>'], ['1. a', '<ol>\n<li>a</li>\n</ol>'], ['2. a\n3. b', '<ol start="2">\n<li>a</li>\n<li>b</li>\n</ol>'], ['10. a', '<ol start="10">\n<li>a</li>\n</ol>'], ['- a', '<ul>\n<li>a</li>\n</ul>']]) {
    it(`a parsed list ${JSON.stringify(source)}`, () => assert.equal(doc(source).html, expected));
  }
  // Nodes without a children field are empty, not an error.
  for (const [name, node, expected] of [
    ['paragraph', { type: 'paragraph' }, '<p></p>'],
    ['block quote', { type: 'blockquote' }, '<blockquote>\n</blockquote>'],
    ['list', { type: 'list', ordered: false, spread: false }, '<ul>\n</ul>'],
    ['emphasis in a paragraph', para({ type: 'emphasis' }), '<p><em></em></p>'],
    ['strong in a paragraph', para({ type: 'strong' }), '<p><strong></strong></p>'],
    ['strikethrough in a paragraph', para({ type: 'delete' }), '<p><del></del></p>'],
  ]) it(`a ${name} without children is empty`, () => assert.equal(html(tree(node)), expected));
  it('a heading without children is empty, has depth and an empty id and no id attribute', () => {
    const result = renderTree(tree({ type: 'heading', depth: 2 }), { path: PATH });
    assert.equal(result.html, '<h2></h2>');
    assert.deepEqual(result.headings, [{ depth: 2, text: '', id: '' }]);
  });
  it('the text of a heading is the text of its text and code nodes only: a hard break adds nothing', () => {
    const result = renderTree(tree({ type: 'heading', depth: 1, children: [text('a'), { type: 'break' }, text('b')] }), { path: PATH });
    assert.deepEqual(result.headings, [{ depth: 1, text: 'ab', id: 'ab' }]);
    assert.equal(result.html, '<h1 id="ab">a<br>\nb</h1>');
  });
  it('the text of a heading goes through a link and emphasis down to the text', () => {
    assert.deepEqual(doc('# [*a*](u) **b** `c`').headings, [{ depth: 1, text: 'a b c', id: 'a-b-c' }]);
  });
  it('the text of a heading holds an image reference by its alt text', () => {
    assert.deepEqual(doc('# ![alt][i] x\n\n[i]: https://e.com/i.png').headings, [{ depth: 1, text: 'alt x', id: 'alt-x' }]);
  });
  // Code: the value only.
  it('an empty fence is an empty code element', () => assert.equal(doc('```\n```').html, '<pre><code></code></pre>'));
  it('the value of a code node is kept with its line breaks', () => assert.equal(html(tree({ type: 'code', value: 'a\n\nb' })), '<pre><code>a\n\nb\n</code></pre>'));
  it('the value of inline code is escaped and kept', () => assert.equal(html(tree(para({ type: 'inlineCode', value: 'a<b&c' }))), '<p><code>a&#x3C;b&#x26;c</code></p>'));
  it('the value of a text node is escaped and kept', () => assert.equal(html(tree(para(text('a<b&c>d')))), '<p>a&#x3C;b&#x26;c>d</p>'));
  // Extra fields are never copied, on any node type.
  const extras = { children: [{ type: 'html', value: '<script>x</script>' }], hName: 'script', hProperties: { onclick: 'a' }, properties: { onclick: 'a' }, tagName: 'script', className: ['c'], style: 'x', title: 't', lang: 'js', meta: 'm', label: 'l', id: 'evil', href: 'javascript:x', src: 'x', align: 'justify', identifier: 'zz', referenceType: 'full' };
  const leafRows = [
    ['text', (x) => tree(para({ type: 'text', value: 'x', ...x })), '<p>x</p>'],
    ['inlineCode', (x) => tree(para({ type: 'inlineCode', value: 'x', ...x })), '<p><code>x</code></p>'],
    ['code', (x) => tree({ type: 'code', value: 'x', ...x }), '<pre><code>x\n</code></pre>'],
    ['thematicBreak', (x) => tree({ type: 'thematicBreak', ...x }), '<hr>'],
    ['break', (x) => tree(para(text('a'), { type: 'break', ...x }, text('b'))), '<p>a<br>\nb</p>'],
  ];
  for (const [type, build, expected] of leafRows) {
    it(`fields that the pass does not name on a ${type} node are not copied (children, tag names, properties)`, () => assert.equal(html(build(extras)), expected));
  }
  // The same for the node types that hold children, identifiers or targets of their own: those fields are read, the rest is not.
  const { children: _children, identifier: _identifier, referenceType: _referenceType, ...extrasWithoutChildren } = extras;
  for (const [type, build, expected] of [
    ['paragraph', (x) => tree({ ...para(text('x')), ...x }), '<p>x</p>'],
    ['blockquote', (x) => tree({ type: 'blockquote', children: [para(text('x'))], ...x }), '<blockquote>\n<p>x</p>\n</blockquote>'],
    ['emphasis', (x) => tree(para({ type: 'emphasis', children: [text('x')], ...x })), '<p><em>x</em></p>'],
    ['strong', (x) => tree(para({ type: 'strong', children: [text('x')], ...x })), '<p><strong>x</strong></p>'],
    ['delete', (x) => tree(para({ type: 'delete', children: [text('x')], ...x })), '<p><del>x</del></p>'],
    ['list', (x) => tree({ type: 'list', ordered: false, spread: false, children: [li()], ...x }), '<ul>\n<li>a</li>\n</ul>'],
    ['listItem', (x) => tree({ type: 'list', ordered: false, spread: false, children: [li(x)] }), '<ul>\n<li>a</li>\n</ul>'],
    ['heading', (x) => tree({ type: 'heading', depth: 2, children: [text('x')], ...x }), '<h2 id="x">x</h2>'],
    ['link', (x) => tree(para({ type: 'link', url: 'https://e.com/', children: [text('x')], ...x })), '<p><a href="https://e.com/">x</a></p>'],
    ['linkReference', (x) => tree(para({ type: 'linkReference', identifier: 'r', children: [text('x')], ...x }), { type: 'definition', identifier: 'r', url: 'https://e.com/' }), '<p><a href="https://e.com/">x</a></p>'],
    ['imageReference', (x) => tree(para({ type: 'imageReference', identifier: 'r', alt: 'x', ...x }), { type: 'definition', identifier: 'r', url: 'https://e.com/' }), '<p><a href="https://e.com/">x</a></p>'],
    ['image', (x) => tree(para({ type: 'image', url: 'https://e.com/', alt: 'x', ...x })), '<p><a href="https://e.com/">x</a></p>'],
    ['definition', (x) => tree(para(text('x')), { type: 'definition', identifier: 'r', url: 'https://e.com/', ...x }), '<p>x</p>'],
    ['html', (x) => tree(para({ type: 'html', value: '<b>', ...x })), '<p>&#x3C;b></p>'],
  ]) {
    it(`fields that the pass does not name on a ${type} node are not copied (tag names, properties, class, style)`, () => {
      const clean = html(build({}));
      assert.equal(clean, expected, 'the clean tree');
      assert.equal(html(build(extrasWithoutChildren)), expected, 'the tree with the fields');
    });
  }
  it('a footnote reference and a footnote definition do not copy their data or other fields either', () => {
    const at = (a, b) => ({ start: { line: 1, column: 1, offset: a }, end: { line: 1, column: 1, offset: b } });
    const bag = { data: { hName: 'script', hProperties: { onclick: 'a' } }, hName: 'script', properties: { onclick: 'a' } };
    const result = renderTree(tree(para(text('x'), { type: 'footnoteReference', identifier: 'a', position: at(1, 5), ...bag }), { type: 'footnoteDefinition', identifier: 'a', children: [text('q')], position: at(6, 13), ...bag }), { path: PATH, source: 'x[^a] [^a]: n' });
    assert.equal(result.html, '<p>x[^a]</p>\n<p>[^a]: n</p>');
  });
  it('a tree with every node kind is not changed by the render and renders the same twice', () => {
    const input = tree(
      { type: 'heading', depth: 1, children: [text('T'), { type: 'inlineCode', value: 'c' }], data: { hName: 'script' } },
      para(text('a'), { type: 'emphasis', children: [text('b')] }, { type: 'break' }, { type: 'link', url: 'https://e.com/', children: [{ type: 'image', url: 'https://e.com/i.png', alt: 'i' }] }, { type: 'html', value: '<b>' }),
      { type: 'list', ordered: true, start: 3, spread: false, children: [li({ checked: true }), li({ checked: false }, [{ type: 'code', value: 'x' }])] },
      { type: 'table', align: ['left', null], children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: [text('h')] }, { type: 'tableCell', children: [text('i')] }] }] },
      { type: 'blockquote', children: [para(text('q'))] },
      { type: 'thematicBreak' },
      { type: 'html', value: '<!-- c -->' },
      { type: 'definition', identifier: 'r', url: 'https://e.com/' },
    );
    const before = JSON.stringify(input);
    const first = renderTree(input, { path: PATH });
    assert.equal(JSON.stringify(input), before, 'the input tree is whole after the first render');
    const second = renderTree(input, { path: PATH });
    assert.deepEqual(second, first);
    assert.equal(JSON.stringify(input), before, 'and after the second');
  });
  it('the mode of renderTree decides whether a header comment is read: document reads it, fragment does not', () => {
    const header = { type: 'html', value: `<!-- translated-from: a.md; blob: ${'0'.repeat(40)} -->` };
    assert.deepEqual(renderTree(tree(header), { path: PATH }).translatedFrom, { source: 'a.md', blob: '0'.repeat(40) });
    assert.deepEqual(renderTree(tree(header), { path: PATH, mode: 'document' }).translatedFrom, { source: 'a.md', blob: '0'.repeat(40) });
    assert.equal(renderTree(tree(header), { path: PATH, mode: 'fragment' }).translatedFrom, null);
    assert.equal(renderTree(tree(header), { path: PATH, mode: 'fragment' }).html, '');
  });
  it('a header comment in a hand-built tree: a malformed one and a second one throw like a parsed one', () => {
    const header = (value) => ({ type: 'html', value });
    assert.match(thrown(() => html(tree(header('<!-- translated-from: x -->')))).message, /^transform: docs\/test\.md: malformed translated-from header$/);
    const good = `<!-- translated-from: a.md; blob: ${'0'.repeat(40)} -->`;
    assert.match(thrown(() => html(tree(header(good), header(good)))).message, /^transform: docs\/test\.md: a second translated-from header$/);
  });
  it('a header comment inside a paragraph, a block quote and a list item is read', () => {
    const good = { type: 'html', value: `<!-- translated-from: a.md; blob: ${'1'.repeat(40)} -->` };
    for (const node of [para(good), { type: 'blockquote', children: [good] }, { type: 'list', ordered: false, spread: false, children: [li({}, [good])] }]) {
      assert.deepEqual(renderTree(tree(node), { path: PATH }).translatedFrom, { source: 'a.md', blob: '1'.repeat(40) });
    }
  });


  // ---- closed world, round 3: the shapes of hand-built nodes: children that are not an array, a leaf that carries children, the position and the line of every error ----
  const MISSING = Symbol('a property that is not there');
  const withKids = (node, kids) => (kids === MISSING ? node : { ...node, children: kids });
  const NOT_ARRAYS = [['a string', 'xy'], ['an empty string', ''], ['a number', 5], ['zero', 0], ['true', true], ['false', false], ['null', null], ['undefined', undefined], ['an empty object', {}], ['an array-like object', { length: 1, 0: text('a') }],
    ['a set', new Set([text('a')])], ['a missing property', MISSING]];
  const EMPTY_TABLE = '<table>\n<thead>\n<tr>\n</tr>\n</thead>\n</table>';
  const CONTAINERS = [
    ['root', (kids) => withKids({ type: 'root' }, kids), ''],
    ['paragraph', (kids) => tree(withKids({ type: 'paragraph' }, kids)), '<p></p>'],
    ['blockquote', (kids) => tree(withKids({ type: 'blockquote' }, kids)), '<blockquote>\n</blockquote>'],
    ['emphasis', (kids) => tree(para(withKids({ type: 'emphasis' }, kids))), '<p><em></em></p>'],
    ['strong', (kids) => tree(para(withKids({ type: 'strong' }, kids))), '<p><strong></strong></p>'],
    ['delete', (kids) => tree(para(withKids({ type: 'delete' }, kids))), '<p><del></del></p>'],
    ['tableRow', (kids) => tree({ type: 'table', align: [], children: [withKids({ type: 'tableRow' }, kids)] }), EMPTY_TABLE],
    ['tableCell', (kids) => tree({ type: 'table', align: [], children: [{ type: 'tableRow', children: [withKids({ type: 'tableCell' }, kids)] }] }), EMPTY_TABLE],
    ['heading', (kids) => tree(withKids({ type: 'heading', depth: 1 }, kids)), '<h1></h1>'],
    ['list', (kids) => tree(withKids({ type: 'list', ordered: false, spread: false }, kids)), '<ul>\n</ul>'],
    ['listItem', (kids) => tree({ type: 'list', ordered: false, spread: false, children: [withKids({ type: 'listItem', spread: false }, kids)] }), '<ul>\n<li></li>\n</ul>'],
    ['table', (kids) => tree(withKids({ type: 'table', align: [] }, kids)), '<table>\n</table>'],
    ['link', (kids) => tree(para(withKids({ type: 'link', url: 'x' }, kids))), '<p><a href="x"></a></p>'],
    ['linkReference', (kids) => tree(para(withKids({ type: 'linkReference', identifier: 'r' }, kids)), { type: 'definition', identifier: 'r', url: 'x' }), '<p><a href="x"></a></p>'],
  ];
  for (const [type, build, expected] of CONTAINERS) {
    for (const [name, kids] of NOT_ARRAYS) {
      it(`a ${type} whose children are ${name} has no children`, () => {
        const result = accepted(() => renderTree(build(kids), { path: PATH }));
        assert.equal(result.html, expected);
        assert.deepEqual(result.headings, type === 'heading' ? [{ depth: 1, text: '', id: '' }] : []);
      });
    }
  }
  it('a definition is found whatever the container that holds it, and a container whose children are not an array hides none and breaks none', () => {
    const ref = para({ type: 'linkReference', identifier: 'r', children: [text('a')] });
    const defn = { type: 'definition', identifier: 'r', url: 'https://d.example/' };
    const found = '<p><a href="https://d.example/">a</a></p>';
    const quote = (...children) => ({ type: 'blockquote', children });
    const item = (...children) => ({ type: 'list', ordered: false, spread: false, children: [{ type: 'listItem', spread: false, children }] });
    assert.equal(html(tree(ref, defn)), found);
    assert.equal(html(tree(ref, quote(defn))), `${found}\n<blockquote>\n</blockquote>`);
    assert.equal(html(tree(ref, item(defn))), `${found}\n<ul>\n<li></li>\n</ul>`);
    assert.equal(html(tree(ref, quote(quote(quote(defn))))), `${found}\n<blockquote>\n<blockquote>\n<blockquote>\n</blockquote>\n</blockquote>\n</blockquote>`);
    assert.equal(html(tree(quote(defn, ref))), `<blockquote>\n${found}\n</blockquote>`);
    for (const [name, kids] of NOT_ARRAYS) assert.equal(html(tree(ref, quote(...[]), { ...quote(), children: kids }, defn)), `${found}\n<blockquote>\n</blockquote>\n<blockquote>\n</blockquote>`, name);
    assert.equal(thrown(() => html(tree(ref, { type: 'blockquote', children: { 0: defn } }))).message, 'transform: docs/test.md: node of type linkReference has no source position', 'a definition held by an object that is no array is not a definition');
    for (const [name, holder] of [['a set', new Set([defn])], ['an object with a forEach method', { forEach: (visit) => visit(defn) }], ['an array-like object', { length: 1, 0: defn }], ['a string', 'x']]) {
      assert.equal(thrown(() => html(tree(ref, { type: 'blockquote', children: holder }))).message, 'transform: docs/test.md: node of type linkReference has no source position', `a definition held by ${name} is not a definition`);
    }
  });

  // A leaf is rebuilt from its value only: what it carries as children is neither read nor copied, whatever it is.
  const LEAF_KIDS = [['a null child', [null]], ['an undefined child', [undefined]], ['a text child', [text('evil')]], ['a child without a known type', [{ type: 'strange' }]], ['a string', 'xy'], ['a number', 5], ['an empty object', {}], ['an empty array', []], ['a bad child and a good one', [null, text('evil')]]];
  const LEAVES = [
    ['text', (kids) => tree(para({ type: 'text', value: 'x', children: kids })), '<p>x</p>'],
    ['inlineCode', (kids) => tree(para({ type: 'inlineCode', value: 'x', children: kids })), '<p><code>x</code></p>'],
    ['code', (kids) => tree({ type: 'code', value: 'x', children: kids }), '<pre><code>x\n</code></pre>'],
    ['thematicBreak', (kids) => tree({ type: 'thematicBreak', children: kids }), '<hr>'],
    ['break', (kids) => tree(para({ type: 'break', children: kids })), '<p><br>\n</p>'],
    ['html', (kids) => tree({ type: 'html', value: '<b>', children: kids }), '<p>&#x3C;b></p>'],
    ['html in a paragraph', (kids) => tree(para({ type: 'html', value: '<b>', children: kids })), '<p>&#x3C;b></p>'],
    ['a comment', (kids) => tree({ type: 'html', value: '<!-- c -->', children: kids }), ''],
    ['definition', (kids) => tree({ type: 'definition', identifier: 'a', url: 'x', children: kids }, para(text('q'))), '<p>q</p>'],
    ['image', (kids) => tree(para({ type: 'image', url: 'x', alt: 'a', children: kids })), '<p><a href="x">a</a></p>'],
    ['imageReference', (kids) => tree(para({ type: 'imageReference', identifier: 'a', alt: 'a', children: kids }), { type: 'definition', identifier: 'a', url: 'x' }), '<p><a href="x">a</a></p>'],
  ];
  for (const [type, build, expected] of LEAVES) {
    for (const [name, kids] of LEAF_KIDS) it(`a ${type} node that carries ${name} as children is rebuilt without them`, () => assert.equal(accepted(() => renderTree(build(kids), { path: PATH })).html, expected));
  }
  it('a footnote reference that carries a null child shows its source text', () => {
    assert.equal(renderTree(tree(para({ type: 'footnoteReference', identifier: 'a', children: [null], position: position(0, 4) })), { path: PATH, source: '[^a]' }).html, '<p>[^a]</p>');
  });
  it('a footnote definition that carries a null child shows its source text', () => {
    assert.equal(renderTree(tree({ type: 'footnoteDefinition', identifier: 'a', children: [null], position: position(0, 7) }), { path: PATH, source: '[^a]: n' }).html, '<p>[^a]: n</p>');
  });

  // The line of an error is the line of the position of the node that raised it, and no line when there is none.
  const at = (line, start = 0, end = 1) => ({ start: { line, column: 1, offset: start }, end: { line, column: 2, offset: end } });
  const errorOf = (mdast, source = '') => thrown(() => renderTree(mdast, { path: PATH, source })).message;
  const justify = (extra = {}) => ({ type: 'table', align: ['justify'], children: [], ...extra });
  it('a table with a bad alignment names its own line', () => {
    assert.equal(errorOf(tree(justify({ position: at(3) }))), 'transform: docs/test.md:3: unsupported table alignment justify');
    assert.equal(errorOf(tree(justify({ position: at(12) }))), 'transform: docs/test.md:12: unsupported table alignment justify');
    assert.equal(errorOf(tree(justify({ position: at(1) }))), 'transform: docs/test.md:1: unsupported table alignment justify');
  });
  it('a table with a bad alignment on line 0 names line 0', () => assert.equal(errorOf(tree(justify({ position: at(0) }))), 'transform: docs/test.md:0: unsupported table alignment justify'));
  it('a table with a bad alignment and no position, an empty position or a start without a line names no line', () => {
    for (const position of [undefined, null, {}, { start: null }, { start: {} }, { start: { line: null } }, { start: { line: undefined } }, { end: at(5).end }]) {
      assert.equal(errorOf(tree(justify({ position }))), 'transform: docs/test.md: unsupported table alignment justify', JSON.stringify(position));
    }
  });
  it('a table with a bad alignment below a block quote, a list item and a root on other lines names its own line, not the line of a parent', () => {
    const parent = (children) => ({ type: 'blockquote', position: at(1, 0, 9), children });
    assert.equal(errorOf({ type: 'root', position: at(1, 0, 9), children: [parent([justify({ position: at(4, 6, 9) })])] }), 'transform: docs/test.md:4: unsupported table alignment justify');
    assert.equal(errorOf({ type: 'root', position: at(2, 0, 9), children: [{ type: 'list', ordered: false, spread: false, position: at(2, 0, 9), children: [{ type: 'listItem', spread: false, position: at(2, 0, 9), children: [justify({ position: at(6, 6, 9) })] }] }] }), 'transform: docs/test.md:6: unsupported table alignment justify');
    assert.equal(errorOf({ type: 'root', position: at(9, 0, 9), children: [parent([justify()])] }), 'transform: docs/test.md: unsupported table alignment justify');
  });
  for (const align of ['justify', 'LEFT', 'left ', ' left', '', 5, 0, undefined, true, false, {}, [], ['left'], 'centre', 'l', 'rightt']) {
    it(`a table alignment of ${JSON.stringify(align) ?? 'undefined'} (${typeof align}) throws with its own text`, () => {
      assert.equal(errorOf(tree({ type: 'table', align: [align], children: [], position: at(2) })), `transform: docs/test.md:2: unsupported table alignment ${String(align)}`);
    });
  }
  it('the first bad alignment is the one named, wherever it stands', () => {
    assert.equal(errorOf(tree({ type: 'table', align: ['left', 'justify', 'x'], children: [] })), 'transform: docs/test.md: unsupported table alignment justify');
    assert.equal(errorOf(tree({ type: 'table', align: [null, 'center', 'right', 'q'], children: [] })), 'transform: docs/test.md: unsupported table alignment q');
  });
  for (const [name, align] of [['a string', 'justify'], ['a word of valid letters', 'left'], ['a number', 5], ['true', true], ['an object', { 0: 'justify' }], ['null', null], ['undefined', undefined], ['a missing property', MISSING]]) {
    it(`a table whose align is ${name} instead of an array is read as having no alignment and renders`, () => {
      const node = { type: 'table', children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: [text('a')] }] }] };
      assert.equal(renderTree(tree(align === MISSING ? node : { ...node, align }), { path: PATH }).html, EMPTY_TABLE);
    });
  }
  it('the alignment array that was given is not changed, and the output has its own copy', () => {
    const align = ['left', null, 'center'];
    const mdast = tree({ type: 'table', align, children: [{ type: 'tableRow', children: [{ type: 'tableCell', children: [text('a')] }, { type: 'tableCell', children: [text('b')] }, { type: 'tableCell', children: [text('c')] }] }] });
    renderTree(mdast, { path: PATH });
    assert.deepEqual(align, ['left', null, 'center']);
    assert.equal(mdast.children[0].align, align);
  });
  for (const [name, type] of [['a number', 5], ['null', null], ['undefined', undefined], ['true', true], ['an object', {}], ['an array', ['text']], ['a function', () => 'text']]) {
    it(`a node whose type is ${name} names no line, with a position or without`, () => {
      assert.equal(errorOf(tree(para({ type, position: at(4) }))), 'transform: docs/test.md: a node has no type');
      assert.equal(errorOf(tree(para({ type, value: 'x' }))), 'transform: docs/test.md: a node has no type');
      assert.equal(errorOf(tree({ type, position: at(4) })), 'transform: docs/test.md: a node has no type');
    });
  }
  for (const [name, node] of [['a paragraph', para(text('x'))], ['a text node', { ...text('x'), position: at(4) }], ['a rooted type', { type: 'rooted', children: [], position: at(4) }], ['an upper-case root', { type: 'Root', children: [], position: at(4) }]]) {
    it(`a tree that is ${name} is not a root node, and no line is named`, () => assert.equal(errorOf(node), 'transform: docs/test.md: the tree is not a root node'));
  }
  it('a tree that is not a root and has a position names no line', () => {
    assert.equal(errorOf({ type: 'paragraph', position: at(4), children: [] }), 'transform: docs/test.md: the tree is not a root node');
  });
  it('an unknown node type names its own line, line 0, and no line when there is no position', () => {
    assert.equal(errorOf(tree({ type: 'weird', position: at(7) })), 'transform: docs/test.md:7: unsupported node type weird');
    assert.equal(errorOf(tree({ type: 'weird', position: at(0) })), 'transform: docs/test.md:0: unsupported node type weird');
    assert.equal(errorOf(tree({ type: 'weird' })), 'transform: docs/test.md: unsupported node type weird');
    assert.equal(errorOf(tree(para({ type: 'weird', position: at(3) }))), 'transform: docs/test.md:3: unsupported node type weird');
  });
  it('a node that has to be sliced and has no offsets names its line, line 0 and the type; a position with a line only keeps that line', () => {
    const lineOnly = (line) => ({ start: { line }, end: { line } });
    assert.equal(errorOf(tree(para({ type: 'footnoteReference', identifier: 'a', position: lineOnly(6) }))), 'transform: docs/test.md:6: node of type footnoteReference has no source position');
    assert.equal(errorOf(tree(para({ type: 'footnoteReference', identifier: 'a', position: lineOnly(0) }))), 'transform: docs/test.md:0: node of type footnoteReference has no source position');
    assert.equal(errorOf(tree({ type: 'footnoteDefinition', identifier: 'a', children: [], position: lineOnly(2) })), 'transform: docs/test.md:2: node of type footnoteDefinition has no source position');
    assert.equal(errorOf(tree(para({ type: 'linkReference', identifier: 'zz', children: [], position: lineOnly(8) }))), 'transform: docs/test.md:8: node of type linkReference has no source position');
    assert.equal(errorOf(tree(para({ type: 'imageReference', identifier: 'zz', alt: 'a', position: lineOnly(9) }))), 'transform: docs/test.md:9: node of type imageReference has no source position');
  });
  for (const [name, start, end] of [['a start offset that is a string', { line: 2, offset: '0' }, { line: 2, offset: 4 }], ['an end offset that is a string', { line: 2, offset: 0 }, { line: 2, offset: '4' }], ['an end offset that is null', { line: 2, offset: 0 }, { line: 2, offset: null }],
    ['a start offset that is undefined', { line: 2 }, { line: 2, offset: 4 }], ['no end', { line: 2, offset: 0 }, undefined], ['no start', undefined, { line: 2, offset: 4 }]]) {
    it(`a footnote reference with ${name} has no source position`, () => {
      const position = { ...(start === undefined ? {} : { start }), ...(end === undefined ? {} : { end }) };
      const line = start === undefined ? '' : ':2';
      assert.equal(errorOf(tree(para({ type: 'footnoteReference', identifier: 'a', position })), '[^a]'), `transform: docs/test.md${line}: node of type footnoteReference has no source position`);
    });
  }
  // The parser options: single and double tilde make a strikethrough, three tildes at the start of a line make a code fence, an unmatched run is text.
  for (const [source, expected] of [['~a~', '<p><del>a</del></p>'], ['~~a~~', '<p><del>a</del></p>'], ['x ~a~ y', '<p>x <del>a</del> y</p>'], ['a~b~c', '<p>a<del>b</del>c</p>'], ['~~a b~~', '<p><del>a b</del></p>'], ['~a~~', '<p>~a~~</p>'], ['~~a~', '<p>~~a~</p>'],
    ['~ a ~', '<p>~ a ~</p>'], ['~~~a~~~', '<pre><code></code></pre>']]) {
    it(`strikethrough: ${JSON.stringify(source)} gives ${JSON.stringify(expected)}`, () => {
      assert.equal(renderMarkdown(source), expected);
      assert.equal(doc(source).html, expected);
    });
  }
  // A value of an html, text or code node that is not a string is shown as its text, as a string (the pass never reads it as one).
  for (const [name, value, shown] of [['a number', 5, '5'], ['null', null, 'null'], ['undefined', undefined, 'undefined'], ['an object', {}, '[object Object]'], ['an array', ['a'], 'a'], ['true', true, 'true'], ['a symbol', Symbol('s'), 'Symbol(s)']]) {
    it(`an html node whose value is ${name} is shown as the text ${JSON.stringify(shown)}`, () => {
      assert.equal(renderTree(tree({ type: 'html', value }), { path: PATH }).html, `<p>${shown}</p>`);
      assert.equal(renderTree(tree(para({ type: 'html', value })), { path: PATH }).html, `<p>${shown}</p>`);
    });
  }
  it('a table alignment that is a symbol is named by its description', () => {
    assert.equal(errorOf(tree({ type: 'table', align: [Symbol('x')], children: [] })), 'transform: docs/test.md: unsupported table alignment Symbol(x)');
  });
  it('the fragment path gives the same error shape on a nesting that runs out of stack, and names the fragment', () => {
    const error = thrown(() => renderMarkdown(`${'> '.repeat(3000)}x`));
    assert.match(error.message, /^transform: \(fragment\): the document could not be rendered: Maximum call stack size exceeded$/);
    assert.ok(error instanceof Error && !(error instanceof RangeError));
    assert.match(thrown(() => doc(`${'> '.repeat(3000)}x`)).message, /^transform: docs\/test\.md: the document could not be rendered: Maximum call stack size exceeded$/);
  });
  it('a call without the options object, or without any argument, throws the error of its own kind', () => {
    assert.equal(thrown(() => renderTree({ type: 'root', children: [] })).message, 'transform: (invalid path): path must be a non-empty string');
    assert.equal(thrown(() => renderTree({ type: 'root', children: [] }, undefined)).message, 'transform: (invalid path): path must be a non-empty string');
    assert.equal(thrown(() => renderMarkdown()).message, 'transform: (fragment): text must be a string');
    assert.equal(thrown(() => transformDocument()).message, 'transform: (invalid path): path must be a non-empty string');
    assert.equal(thrown(() => transformDocument(PATH)).message, 'transform: docs/test.md: source must be a string');
    assert.equal(transformDocument(PATH, 'x').html, '<p>x</p>');
    assert.equal(transformDocument(PATH, 'x', undefined).html, '<p>x</p>');
    assert.equal(renderTree({ type: 'root', children: [] }, { path: PATH }).html, '');
  });
  it('renderTree reads the header in its default mode and ignores it in the fragment mode, and its default source is the empty text', () => {
    const header = { type: 'html', value: `<!-- translated-from: a.md; blob: ${'1'.repeat(40)} -->` };
    assert.deepEqual(renderTree(tree(header), { path: PATH }).translatedFrom, { source: 'a.md', blob: '1'.repeat(40) });
    assert.deepEqual(renderTree(tree(header), { path: PATH, mode: 'document' }).translatedFrom, { source: 'a.md', blob: '1'.repeat(40) });
    assert.equal(renderTree(tree(header), { path: PATH, mode: 'fragment' }).translatedFrom, null);
    assert.equal(renderTree(tree(header), { path: PATH, mode: 'anything else' }).translatedFrom, null);
    assert.deepEqual(Object.keys(renderTree(tree(), { path: PATH })).sort(), ['headings', 'html', 'links', 'translatedFrom']);
    assert.equal(renderTree(tree(para({ type: 'footnoteReference', identifier: 'a', position: position(0, 1) })), { path: PATH }).html, '<p></p>', 'the default source is the empty text, so any slice of it is empty');
    assert.equal(renderTree(tree(para({ type: 'footnoteReference', identifier: 'a', position: position(0, 0) })), { path: PATH }).html, '<p></p>');
    assert.equal(renderTree(tree(para({ type: 'footnoteReference', identifier: 'a', position: position(0, 0) })), { path: PATH, source: 5 }).html, '<p></p>');
    assert.equal(renderTree(tree(para({ type: 'footnoteReference', identifier: 'a', position: position(0, 1) })), { path: PATH, source: 5 }).html, '<p>5</p>');
  });
  it('a footnote reference with offsets 0 and 0 is the empty text, and one with offsets inside the source is that slice', () => {
    assert.equal(renderTree(tree(para({ type: 'footnoteReference', identifier: 'a', position: at(1, 0, 0) })), { path: PATH, source: '[^a]' }).html, '<p></p>');
    assert.equal(renderTree(tree(para({ type: 'footnoteReference', identifier: 'a', position: at(1, 1, 3) })), { path: PATH, source: '[^a]' }).html, '<p>^a</p>');
  });
});

// ---- U8: the hast guard -------------------------------------------------------------------------------------------------------------------------------------

describe('hast guard rule table', () => {
  const el = (tagName, properties = {}, children = []) => ({ type: 'element', tagName, properties, children });
  const wrap = (...children) => ({ type: 'root', children });
  const accepts = (node) => assert.doesNotThrow(() => assertSafeHast(wrap(node), PATH));
  const rejects = (node, what) => assert.match(thrown(() => assertSafeHast(wrap(node), PATH)).message, new RegExp(`^transform: docs/test\\.md: unsafe output: ${what}`));

  for (const tag of ['p', 'blockquote', 'ul', 'li', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'em', 'strong', 'del', 'br', 'hr']) {
    it(`allowed: ${tag} with no properties`, () => accepts(el(tag)));
    it(`rejected: ${tag} with a property`, () => rejects(el(tag, { title: 'x' }), `the property title on ${tag}`));
  }
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    it(`allowed: ${tag} with an id`, () => accepts(el(tag, { id: 'a-b' })));
    it(`allowed: ${tag} with no properties`, () => accepts(el(tag)));
    it(`rejected: ${tag} with a class`, () => rejects(el(tag, { className: ['x'] }), `the property className on ${tag}`));
  }
  it('rejected: h7 and h0', () => {
    rejects(el('h7'), 'the element h7');
    rejects(el('h0'), 'the element h0');
  });
  it('rejected: an empty id', () => rejects(el('h1', { id: '' }), 'an id that is not a non-empty string'));
  it('rejected: an id that is not a string', () => rejects(el('h1', { id: 5 }), 'an id that is not a non-empty string'));
  it('rejected: an id on a p', () => rejects(el('p', { id: 'x' }), 'the property id on p'));
  it('allowed: ol with an integer start and with none', () => {
    accepts(el('ol', { start: 3 }));
    accepts(el('ol'));
  });
  it('rejected: ol start as a string, a fraction or a class', () => {
    rejects(el('ol', { start: '3' }), 'a start that is not an integer');
    rejects(el('ol', { start: 2.5 }), 'a start that is not an integer');
    rejects(el('ol', { className: ['x'] }), 'the property className on ol');
  });
  for (const tag of ['th', 'td']) {
    for (const align of ['left', 'center', 'right']) it(`allowed: ${tag} align ${align}`, () => accepts(el(tag, { align })));
    it(`allowed: ${tag} with no properties`, () => accepts(el(tag)));
    it(`rejected: ${tag} align justify`, () => rejects(el(tag, { align: 'justify' }), 'an align of justify'));
    it(`rejected: ${tag} style`, () => rejects(el(tag, { style: 'text-align:right' }), `the property style on ${tag}`));
  }
  it('allowed: a with a safe href', () => {
    for (const href of ['https://example.com/', 'http://example.com/', 'mailto:a@example.com', '../a.md', '#h', '']) accepts(el('a', { href }));
  });
  it('rejected: a with an unsafe href', () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,x', 'ftp://example.com/', ' JaVaScRiPt:x']) rejects(el('a', { href }), 'an href that is not a safe target');
    rejects(el('a', { href: 5 }), 'an href that is not a safe target');
  });
  for (const property of ['title', 'target', 'rel', 'onclick', 'className', 'style', 'id', 'download']) {
    it(`rejected: a with ${property}`, () => rejects(el('a', { href: 'https://example.com/', [property]: 'x' }), `the property ${property} on a`));
  }
  for (const tag of ['script', 'img', 'input', 'div', 'span', 'section', 'sup', 'kbd', 'details', 'summary', 'iframe', 'object', 'embed', 'style', 'svg', 'form', 'button', 'link', 'meta', 'base', 'audio', 'video', 'font', 'dl', 'footer', 'aside']) {
    it(`rejected: the element ${tag}`, () => rejects(el(tag), `the element ${tag}`));
  }
  for (const property of ['className', 'style', 'title', 'lang', 'onclick', 'onerror', 'dataFoo', 'data-foo', 'ariaLabel', 'aria-label', 'role', 'tabIndex']) {
    it(`rejected: p with ${property}`, () => rejects(el('p', { [property]: 'x' }), `the property ${property} on p`));
  }
  it('rejected: a raw node and a comment node and a doctype', () => {
    rejects({ type: 'raw', value: '<script>x</script>' }, 'a raw node');
    rejects({ type: 'raw', value: '<script>x</script>', children: [] }, 'a raw node');
    rejects({ type: 'comment', value: 'x' }, 'a comment node');
    rejects({ type: 'doctype' }, 'a doctype node');
  });
  it('rejected: a text node without a string value', () => rejects({ type: 'text', value: 5 }, 'a text node without a string value'));
  it('rejected: a node that is not an object', () => rejects('x', 'a node that is not an object'));
  it('rejected: an element without a tag name', () => rejects({ type: 'element', properties: {}, children: [] }, 'the element undefined'));
  it('rejected: an element whose children are not an array', () => rejects({ type: 'element', tagName: 'p', properties: {} }, 'a element node without children'));
  it('rejected: an unsafe element deep in the tree', () => rejects(el('ul', {}, [el('li', {}, [el('p', {}, [{ type: 'text', value: 'x' }, el('img', { src: 'x' })])])]), 'the element img'));
  it('rejected: an unsafe property deep in the tree', () => rejects(el('ul', {}, [el('li', {}, [el('a', { href: 'javascript:x' })])]), 'an href that is not a safe target'));
  it('allowed: text nodes between elements', () => accepts(el('ul', {}, [{ type: 'text', value: '\n' }, el('li', {}, [{ type: 'text', value: '<b>x</b>' }])])));
  // Closed world: every element name of HTML that the allowlist does not name is rejected, so a name added to the allowlist by mistake is seen.
  const HTML_NAMES = ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', 'aside', 'audio', 'b', 'base', 'basefont', 'bdi', 'bdo', 'bgsound', 'big', 'blink', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'content', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'dir', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'font', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'image', 'img', 'input', 'ins', 'isindex', 'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'listing', 'main', 'map', 'mark', 'marquee', 'math', 'menu', 'menuitem', 'meta', 'meter', 'multicol', 'nav', 'nextid', 'nobr', 'noembed', 'noframes', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'picture', 'plaintext', 'pre', 'progress', 'q', 'rb', 'rbc', 'rp', 'rt', 'rtc', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select', 'shadow', 'slot', 'small', 'source', 'spacer', 'span', 'strike', 'strong', 'style', 'sub', 'summary', 'sup', 'svg', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'tt', 'u', 'ul', 'var', 'video', 'wbr', 'xmp'];
  const ALLOWED_NAMES = new Set(['a', 'p', 'blockquote', 'ul', 'li', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'em', 'strong', 'del', 'br', 'hr', 'ol', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  it('the closed-world list holds the allowed names and many more', () => {
    assert.ok(HTML_NAMES.filter((name) => ALLOWED_NAMES.has(name)).length === ALLOWED_NAMES.size);
    assert.ok(HTML_NAMES.filter((name) => !ALLOWED_NAMES.has(name)).length > 100);
  });
  for (const tag of HTML_NAMES.filter((name) => !ALLOWED_NAMES.has(name))) {
    it(`closed world: the element ${tag} is rejected`, () => rejects(el(tag), `the element ${tag}`));
  }
  for (const tag of ['h10', 'h1x', 'xh1', 'h01', 'h', 'H1', 'h1 ', 'h7', 'h0', '', 'olx', 'tdx', 'thx', 'ax', 'pp', 'P']) {
    it(`rejected: the element name ${JSON.stringify(tag)} matches no allowed name exactly`, () => rejects(el(tag), `the element ${tag}`));
  }
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    it(`allowed: ${tag} holds a child element of the allowed set`, () => accepts(el(tag, { id: 'x' }, [el('em', {}, [{ type: 'text', value: 'x' }])])));
  }
  for (const [name, properties] of [['an empty array', []], ['a non-empty array', ['id']], ['a string', 'id'], ['a number', 5], ['true', true]]) {
    it(`rejected: p whose properties are ${name}`, () => rejects(el('p', properties), 'properties of p that are not an object'));
    it(`rejected: h1 whose properties are ${name}`, () => rejects(el('h1', properties), 'properties of h1 that are not an object'));
    it(`rejected: a whose properties are ${name}`, () => rejects(el('a', properties), 'properties of a that are not an object'));
  }
  it('allowed: an element with no properties key and one with null properties', () => {
    accepts({ type: 'element', tagName: 'p', children: [] });
    accepts({ type: 'element', tagName: 'p', properties: null, children: [] });
  });
  it('rejected: a root that holds a node of an unknown kind', () => rejects({ type: 'foo', children: [] }, 'a foo node'));
  it('the error names the path', () => assert.match(thrown(() => assertSafeHast(wrap(el('img')), 'docs/other.md')).message, /^transform: docs\/other\.md: unsafe output: /));

  // ---- closed world of the guard: the property-by-element matrix, the near names, every kind of node and every shape of a field ----
  const rejectsExactly = (node, what) => assert.equal(thrown(() => assertSafeHast(wrap(node), PATH)).message, `transform: docs/test.md: unsafe output: ${what}`);
  const BARE_TAGS = ['p', 'blockquote', 'ul', 'li', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'em', 'strong', 'del', 'br', 'hr'];
  const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const ALL_TAGS = [...BARE_TAGS, ...HEADING_TAGS, 'ol', 'th', 'td', 'a'];
  // The one value per property that the allowlist accepts, and the elements that it accepts it on.
  const GRANTS = { id: [HEADING_TAGS, 'a-b'], start: [['ol'], 3], align: [['th', 'td'], 'left'], href: [['a'], 'https://example.com/'] };
  const PROPERTY_NAMES = ['id', 'start', 'align', 'href', 'src', 'class', 'className', 'style', 'title', 'lang', 'data-x', 'dataX', 'aria-x', 'ariaX', 'ariaLabel', 'onclick', 'onerror', 'onload', 'onClick', 'name', 'target', 'rel', 'role', 'hidden',
    'tabIndex', 'width', 'height', 'alt', 'colSpan', 'rowSpan', 'type', 'value', 'checked', 'disabled', 'download', 'xmlns', 'is', 'slot', 'dir', 'accessKey', 'contentEditable', 'draggable', 'srcSet', 'action', 'formAction', 'reversed', 'valign', 'bgColor'];
  for (const tag of ALL_TAGS) {
    for (const name of PROPERTY_NAMES) {
      const grant = GRANTS[name];
      if (grant !== undefined && grant[0].includes(tag)) {
        it(`matrix: ${name} on ${tag} is accepted with its valid value`, () => accepts(el(tag, { [name]: grant[1] })));
      } else {
        it(`matrix: ${name} on ${tag} is rejected`, () => rejectsExactly(el(tag, { [name]: grant === undefined ? 'x' : grant[1] }), `the property ${name} on ${tag}`));
      }
    }
  }
  // Names that look like a granted name are not granted, on the element that holds the grant.
  const NEAR = {
    id: ['Id', 'ID', 'ids', 'xid', 'idx', ' id', 'id ', '', 'i', 'd'],
    start: ['Start', 'START', 'starts', 'tart', 'sstart', 'startx', ' start', 'start ', 'star', 'begin'],
    align: ['Align', 'ALIGN', 'aligns', 'lign', 'valign', 'xalign', 'alignx', ' align', 'align ', 'char', 'charoff', 'bgcolor'],
    href: ['Href', 'HREF', 'hrefs', 'hre', 'xhref', ' href', 'href ', 'ref', 'xlink:href', 'xlinkHref', 'src'],
  };
  for (const [granted, names] of Object.entries(NEAR)) {
    for (const tag of GRANTS[granted][0]) {
      for (const name of names) {
        it(`near name: ${JSON.stringify(name)} on ${tag} is rejected like any other property`, () => rejectsExactly(el(tag, { [name]: GRANTS[granted][1] }), `the property ${name} on ${tag}`));
      }
    }
  }
  // Every granted property keeps its own value rule on every element that holds it.
  for (const tag of HEADING_TAGS) {
    for (const [name, value] of [['empty string', ''], ['number', 5], ['zero', 0], ['null', null], ['undefined', undefined], ['true', true], ['array', ['x']], ['object', {}]]) {
      it(`${tag} with an id that is a ${name} is rejected`, () => rejectsExactly(el(tag, { id: value }), 'an id that is not a non-empty string'));
    }
    it(`${tag} accepts an id of one character and an id with a space`, () => {
      accepts(el(tag, { id: 'a' }));
      accepts(el(tag, { id: 'a b' }));
    });
  }
  for (const [name, value] of [['a string', '3'], ['a fraction', 2.5], ['NaN', NaN], ['infinity', Infinity], ['null', null], ['undefined', undefined], ['true', true], ['an array', [3]], ['an object', {}], ['an empty string', '']]) {
    it(`ol with a start that is ${name} is rejected`, () => rejectsExactly(el('ol', { start: value }), 'a start that is not an integer'));
  }
  for (const start of [0, 1, 2, 3, 10, 100, -1, -10]) it(`ol with the integer start ${start} is accepted`, () => accepts(el('ol', { start })));
  for (const tag of ['th', 'td']) {
    for (const [name, value] of [['upper case', 'LEFT'], ['capitalised', 'Left'], ['center in upper case', 'CENTER'], ['right in upper case', 'RIGHT'], ['justify', 'justify'], ['an empty string', ''], ['start', 'start'], ['end', 'end'], ['top', 'top'], ['middle', 'middle'], ['char', 'char'],
      ['a trailing space', 'left '], ['a leading space', ' left'], ['a prefix', 'lef'], ['a suffix', 'leftt'], ['British spelling', 'centre'], ['null', null], ['undefined', undefined], ['a number', 5], ['zero', 0], ['true', true], ['an array', ['left']], ['an object', {}]]) {
      it(`${tag} with an align that is ${name} is rejected`, () => rejectsExactly(el(tag, { align: value }), `an align of ${String(value)}`));
    }
    for (const align of ['left', 'center', 'right']) it(`${tag} with the align ${align} is accepted next to children`, () => accepts(el(tag, { align }, [{ type: 'text', value: 'x' }, el('em', {}, [{ type: 'text', value: 'y' }])])));
  }
  for (const [name, value] of [['javascript', 'javascript:alert(1)'], ['javascript in upper case', 'JAVASCRIPT:x'], ['javascript after a space', ' javascript:x'], ['javascript after a tab inside', 'java\tscript:x'], ['an empty scheme', ':x'], ['data', 'data:text/html,x'], ['ftp', 'ftp://example.com/'],
    ['vbscript', 'vbscript:x'], ['file', 'file:///etc'], ['a drive letter', 'C:\\x'], ['a number', 5], ['zero', 0], ['null', null], ['undefined', undefined], ['true', true], ['an array', ['https://example.com/']], ['an object', {}]]) {
    it(`a with an href that is ${name} is rejected`, () => rejectsExactly(el('a', { href: value }), 'an href that is not a safe target'));
  }
  for (const href of ['https://example.com/', 'HTTPS://EXAMPLE.COM/', 'http://example.com/', 'mailto:a@example.com', 'MAILTO:a@example.com', '../a.md', '/a.md', 'a.md', '#h', '?q=1', '', 'a/b:c', 'a?b:c', 'a#b:c', ' https://example.com/', '\u0001https://example.com/']) {
    it(`a with the href ${JSON.stringify(href)} is accepted`, () => accepts(el('a', { href })));
  }
  it('an element with one granted property and one that is not granted is rejected for the one that is not', () => {
    rejectsExactly(el('a', { href: 'https://example.com/', start: 3 }), 'the property start on a');
    rejectsExactly(el('a', { start: 3, href: 'https://example.com/' }), 'the property start on a');
    rejectsExactly(el('h1', { id: 'x', align: 'left' }), 'the property align on h1');
    rejectsExactly(el('ol', { start: 3, id: 'x' }), 'the property id on ol');
    rejectsExactly(el('td', { align: 'left', href: 'https://example.com/' }), 'the property href on td');
    rejectsExactly(el('th', { align: 'left', start: 3 }), 'the property start on th');
  });
  it('an element with every property that it holds is accepted: a holds only href, h1 only id', () => {
    accepts(el('a', { href: 'https://example.com/' }));
    accepts(el('h1', { id: 'x' }));
    accepts(el('ol', { start: 3 }));
    accepts(el('td', { align: 'right' }));
  });
  // The element names: each allowed name, and the neighbours of each one.
  for (const tag of ALL_TAGS) {
    for (const variant of new Set([tag.toUpperCase(), tag[0].toUpperCase() + tag.slice(1), `${tag}x`, `x${tag}`, `${tag} `, ` ${tag}`, tag.slice(0, -1), `${tag}${tag}`, `${tag}1`, `/${tag}`, `<${tag}>`])) {
      if (ALL_TAGS.includes(variant)) continue;
      it(`rejected: the element ${JSON.stringify(variant)} is not the allowed name ${tag}`, () => rejectsExactly(el(variant), `the element ${variant}`));
    }
  }
  for (const [name, tag] of [['an array that holds h1', ['h1']], ['a String object of h1', new String('h1')], ['an object that reads as h2', { toString: () => 'h2' }], ['an object that reads as p', { toString: () => 'p' }], ['an array that holds hr', ['hr']]]) {
    it(`rejected: an element whose tag name is ${name}, not a string`, () => rejectsExactly({ type: 'element', tagName: tag, properties: {}, children: [] }, `the element ${String(tag)}`));
  }
  for (const word of STRANGE_WORDS.filter((w) => !ALL_TAGS.includes(w))) it(`rejected: the element ${JSON.stringify(word)}`, () => rejectsExactly(el(word), `the element ${word}`));
  for (const word of STRANGE_WORDS) {
    for (const tag of ['th', 'td']) it(`${tag} with an align of ${JSON.stringify(word)} is rejected`, () => rejectsExactly(el(tag, { align: word }), `an align of ${word}`));
  }
  // Every one-character name and every name of two lower-case letters: only the allowed ones pass.
  for (const ch of PRINTABLE) {
    if (['p', 'a'].includes(ch)) continue;
    it(`rejected: the element of the one character ${JSON.stringify(ch)}`, () => rejectsExactly(el(ch), `the element ${ch}`));
  }
  const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const TWO_ALLOWED = ['ul', 'li', 'em', 'hr', 'br', 'tr', 'th', 'td', 'ol'];
  for (const first of LOWER) {
    for (const second of LOWER) {
      const name = first + second;
      if (TWO_ALLOWED.includes(name)) continue;
      it(`rejected: the element ${name}`, () => rejectsExactly(el(name), `the element ${name}`));
    }
  }
  for (const ch of PRINTABLE) {
    if ('123456r'.includes(ch)) continue;
    it(`rejected: the element h${JSON.stringify(ch)} (h and one character that is not a level)`, () => rejectsExactly(el(`h${ch}`), `the element h${ch}`));
    if (ch !== 'h') it(`rejected: the element ${JSON.stringify(ch)}1 (one character and the level 1)`, () => rejectsExactly(el(`${ch}1`), `the element ${ch}1`));
  }
  for (const tag of ALL_TAGS) {
    for (const value of [0, '', false, NaN]) {
      it(`rejected: ${tag} whose properties are the falsy ${JSON.stringify(value) ?? String(value)}`, () => rejectsExactly(el(tag, value), `properties of ${tag} that are not an object`));
    }
  }
  for (const tag of [5, null, undefined, {}, [], true, false, 0]) {
    it(`rejected: an element whose tag name is ${JSON.stringify(tag) ?? 'undefined'}`, () => rejectsExactly({ type: 'element', tagName: tag, properties: {}, children: [] }, `the element ${String(tag)}`));
  }
  for (const tag of ALL_TAGS) {
    it(`allowed: ${tag} with an empty children array and with text`, () => {
      accepts(el(tag));
      accepts(el(tag, {}, [{ type: 'text', value: '' }, { type: 'text', value: 'x' }]));
    });
    for (const [name, properties] of [['an array', []], ['a string', 'id'], ['a number', 5], ['true', true], ['a function', () => ({})]]) {
      it(`rejected: ${tag} whose properties are ${name}`, () => rejectsExactly(el(tag, properties), `properties of ${tag} that are not an object`));
    }
    it(`allowed: ${tag} with no properties key, null properties and an empty object`, () => {
      accepts({ type: 'element', tagName: tag, children: [] });
      accepts({ type: 'element', tagName: tag, properties: null, children: [] });
      accepts(el(tag, {}));
    });
    it(`rejected: ${tag} whose children are not an array`, () => {
      for (const children of [undefined, null, 'x', {}, 5, true]) rejectsExactly({ type: 'element', tagName: tag, properties: {}, children }, 'a element node without children');
    });
  }
  // The node types: root, element and text are the only ones.
  for (const type of ['raw', 'comment', 'doctype', 'foo', 'Element', 'ELEMENT', 'Text', 'TEXT', 'Root', 'ROOT', 'elements', 'texts', 'roots', 'textx', 'xroot', 'xelement', '', ' ', 'element ', ' text', 'cdata', 'instruction', 'mdxJsxFlowElement']) {
    it(`rejected: a node of the type ${JSON.stringify(type)}`, () => rejectsExactly({ type, value: 'x', children: [], tagName: 'p', properties: {} }, `a ${type} node`));
  }
  for (const type of [undefined, null, 5, true, {}]) {
    it(`rejected: a node whose type is ${JSON.stringify(type) ?? 'undefined'}`, () => rejectsExactly({ type, children: [] }, `a ${String(type)} node`));
  }
  for (const [name, node] of [['null', null], ['undefined', undefined], ['a number', 5], ['a string', 'x'], ['true', true], ['zero', 0], ['an empty string', '']]) {
    it(`rejected: a child that is ${name} is a node that is not an object`, () => assert.equal(thrown(() => assertSafeHast(wrap(node), PATH)).message, 'transform: docs/test.md: unsafe output: a node that is not an object'));
    it(`rejected: a tree that is ${name} is a node that is not an object`, () => assert.equal(thrown(() => assertSafeHast(node, PATH)).message, 'transform: docs/test.md: unsafe output: a node that is not an object'));
  }
  for (const [name, value] of [['a number', 5], ['null', null], ['undefined', undefined], ['an array', []], ['an object', {}], ['true', true]]) {
    it(`rejected: a text node whose value is ${name}`, () => rejectsExactly({ type: 'text', value }, 'a text node without a string value'));
  }
  for (const value of ['', 'x', '<script>alert(1)</script>', '-->', '\u0000']) it(`allowed: a text node whose value is ${JSON.stringify(value)}`, () => accepts({ type: 'text', value }));
  it('allowed: a text node that holds children is not walked into', () => accepts({ type: 'text', value: 'x', children: [el('script')] }));
  for (const children of [undefined, null, 'x', {}, 5]) {
    it(`rejected: a root whose children are ${JSON.stringify(children) ?? 'undefined'}`, () => assert.equal(thrown(() => assertSafeHast({ type: 'root', children }, PATH)).message, 'transform: docs/test.md: unsafe output: a root node without children'));
  }
  it('allowed: an empty root, a root of text and an element as the tree itself', () => {
    assertSafeHast({ type: 'root', children: [] }, PATH);
    assertSafeHast({ type: 'root', children: [{ type: 'text', value: 'x' }] }, PATH);
    assertSafeHast(el('p'), PATH);
  });
  // The walk reaches every node: a bad node is found wherever it stands.
  it('rejected: a bad element in any place among many children', () => {
    const ok = () => el('li', {}, [{ type: 'text', value: 'x' }]);
    const bad = el('script');
    for (const children of [[bad, ok(), ok()], [ok(), bad, ok()], [ok(), ok(), bad], [{ type: 'text', value: 'x' }, bad]]) rejectsExactly(el('ul', {}, children), 'the element script');
    for (const children of [[bad, ok()], [ok(), bad]]) assert.throws(() => assertSafeHast({ type: 'root', children }, PATH), /unsafe output: the element script$/);
  });
  it('rejected: a bad property in any place among many children', () => {
    const ok = () => el('a', { href: 'https://example.com/' });
    const bad = el('a', { href: 'javascript:x' });
    for (const children of [[bad, ok(), ok()], [ok(), bad, ok()], [ok(), ok(), bad]]) rejectsExactly(el('p', {}, children), 'an href that is not a safe target');
  });
  it('rejected: a bad element at the bottom of a deep chain, with allowed elements all the way down', () => {
    let node = el('img');
    for (const tag of ['strong', 'em', 'p', 'li', 'ul', 'blockquote']) node = el(tag, {}, [node]);
    rejectsExactly(node, 'the element img');
  });
  it('allowed: every allowed element in one tree', () => {
    const leaf = [{ type: 'text', value: 'x' }];
    const tree = wrap(
      el('h1', { id: 'a' }, leaf), el('h2', { id: 'b' }, leaf), el('h3', { id: 'c' }, leaf), el('h4', { id: 'd' }, leaf), el('h5', { id: 'e' }, leaf), el('h6', { id: 'f' }, leaf),
      el('blockquote', {}, [el('p', {}, [el('em', {}, leaf), el('strong', {}, leaf), el('del', {}, leaf), el('code', {}, leaf), el('br'), el('a', { href: '#h' }, leaf)])]),
      el('ul', {}, [el('li', {}, leaf)]), el('ol', { start: 2 }, [el('li', {}, leaf)]), el('pre', {}, [el('code', {}, leaf)]), el('hr'),
      el('table', {}, [el('thead', {}, [el('tr', {}, [el('th', { align: 'left' }, leaf)])]), el('tbody', {}, [el('tr', {}, [el('td', { align: 'right' }, leaf), el('td', {}, leaf)])])]),
    );
    assert.equal(assertSafeHast(tree, PATH), undefined);
  });
  it('the guard changes nothing and returns nothing', () => {
    const tree = wrap(el('h1', { id: 'a' }, [{ type: 'text', value: 'x' }]), el('a', { href: '#h' }, []));
    const before = JSON.stringify(tree);
    assert.equal(assertSafeHast(tree, PATH), undefined);
    assert.equal(JSON.stringify(tree), before);
  });
  it('the error holds the path it was given and nothing else of the document', () => {
    assert.equal(thrown(() => assertSafeHast(wrap(el('img')), 'a/b/c.md')).message, 'transform: a/b/c.md: unsafe output: the element img');
  });
  it('the property named in the error is the first one of the element that is not granted', () => {
    rejectsExactly(el('p', { title: 'a', lang: 'b' }), 'the property title on p');
    rejectsExactly(el('p', { lang: 'b', title: 'a' }), 'the property lang on p');
  });

  // ---- closed world, round 3: every bad node below every element, with or without a granted property, at every depth ----
  const MISSING_KEY = Symbol('a key that is not there');
  const PARENT_PROPS = { a: { href: 'https://example.com/' }, h1: { id: 'a' }, h2: { id: 'a' }, h3: { id: 'a' }, h4: { id: 'a' }, h5: { id: 'a' }, h6: { id: 'a' }, ol: { start: 2 }, th: { align: 'left' }, td: { align: 'right' } };
  const parentOf = (tag, children, withProperty = true) => el(tag, withProperty ? (PARENT_PROPS[tag] ?? {}) : {}, children);
  const BAD_NODES = [
    ['a script element', () => el('script', {}, [{ type: 'text', value: 'alert(1)' }]), 'the element script'],
    ['an img element with a src', () => el('img', { src: 'x' }), 'the element img'],
    ['a div element', () => el('div'), 'the element div'],
    ['an element without a tag name', () => ({ type: 'element', properties: {}, children: [] }), 'the element undefined'],
    ['an onclick property on a p', () => el('p', { onclick: 'a()' }), 'the property onclick on p'],
    ['a title on a p', () => el('p', { title: 'x' }, [{ type: 'text', value: 'x' }]), 'the property title on p'],
    ['an id on a p', () => el('p', { id: 'x' }), 'the property id on p'],
    ['a class on an h2', () => el('h2', { id: 'a', className: ['x'] }), 'the property className on h2'],
    ['a style on a td', () => el('td', { style: 'x' }), 'the property style on td'],
    ['a javascript href on an a', () => el('a', { href: 'javascript:alert(1)' }), 'an href that is not a safe target'],
    ['an a without an href string', () => el('a', { href: 5 }), 'an href that is not a safe target'],
    ['an empty id on an h1', () => el('h1', { id: '' }), 'an id that is not a non-empty string'],
    ['a string start on an ol', () => el('ol', { start: '3' }), 'a start that is not an integer'],
    ['a justify align on a th', () => el('th', { align: 'justify' }), 'an align of justify'],
    ['an element whose children are not an array', () => ({ type: 'element', tagName: 'p', properties: {} }), 'a element node without children'],
    ['a raw node', () => ({ type: 'raw', value: '<script>x</script>' }), 'a raw node'],
    ['a comment node', () => ({ type: 'comment', value: 'x' }), 'a comment node'],
    ['a doctype node', () => ({ type: 'doctype' }), 'a doctype node'],
    ['a text node without a string value', () => ({ type: 'text', value: 5 }), 'a text node without a string value'],
    ['a child that is null', () => null, 'a node that is not an object'],
    ['a child that is a string', () => 'x', 'a node that is not an object'],
    ['a child of an unknown type', () => ({ type: 'foo', children: [] }), 'a foo node'],
    ['a bad node two levels down', () => el('em', {}, [el('strong', {}, [el('img')])]), 'the element img'],
    ['an a with an unsafe href below an em', () => el('em', {}, [el('a', { href: 'data:text/html,x' })]), 'an href that is not a safe target'],
  ];
  const PARENT_TAGS = [...BARE_TAGS, ...HEADING_TAGS, 'ol', 'th', 'td', 'a'];
  for (const tag of PARENT_TAGS) {
    for (const [name, build, what] of BAD_NODES) {
      it(`rejected: ${name} below ${tag}${PARENT_PROPS[tag] ? ' with its granted property' : ''}`, () => {
        rejectsExactly(parentOf(tag, [build()]), what);
        rejectsExactly(parentOf(tag, [{ type: 'text', value: 'x' }, build()]), what);
        rejectsExactly(parentOf(tag, [build(), { type: 'text', value: 'x' }]), what);
      });
    }
    it(`rejected: a bad node below ${tag} without a property, and below ${tag} in a root, a li and a p`, () => {
      rejectsExactly(parentOf(tag, [el('script')], false), 'the element script');
      rejectsExactly(el('ul', {}, [el('li', {}, [parentOf(tag, [el('script')])])]), 'the element script');
      rejectsExactly(el('blockquote', {}, [el('p', {}, [parentOf(tag, [el('p', { onclick: 'x' })])])]), 'the property onclick on p');
    });
    it(`allowed: ${tag} holds text, an em and an a with a safe href, and the walk goes on through it`, () => {
      accepts(parentOf(tag, [{ type: 'text', value: 'x' }, el('em', {}, [{ type: 'text', value: 'y' }]), el('a', { href: '#h' }, [])]));
    });
    it(`the problem of ${tag} itself is named before the problem of its child`, () => {
      rejectsExactly({ ...parentOf(tag, [el('script')]), properties: { ...PARENT_PROPS[tag], onclick: 'x' } }, `the property onclick on ${tag}`);
    });
  }
  // `properties`: absent, null and undefined mean none; any other value that is not an object is an error, the falsy ones too.
  for (const [name, properties] of [['zero', 0], ['an empty string', ''], ['false', false], ['NaN', Number.NaN], ['a function', () => ({})], ['a symbol', Symbol('p')], ['a bigint', 0n]]) {
    for (const tag of ['p', 'h1', 'a', 'ol', 'td']) it(`rejected: ${tag} whose properties are ${name}`, () => rejectsExactly(el(tag, properties), `properties of ${tag} that are not an object`));
  }
  for (const [name, properties] of [['missing', MISSING_KEY], ['null', null], ['undefined', undefined], ['an empty object', {}]]) {
    for (const tag of ['p', 'h1', 'a', 'ol', 'td', 'br']) {
      it(`allowed: ${tag} whose properties are ${name}`, () => accepts(properties === MISSING_KEY ? { type: 'element', tagName: tag, children: [] } : { type: 'element', tagName: tag, properties, children: [] }));
    }
  }
  // The heading names: exactly `h` and one digit from 1 to 6, whole; a line break or any other character in or around the name is another name.
  for (const name of ['h1\n', 'h1\nx', '\nh1', 'x\nh1', 'h1\r', 'h1\u2028', 'h1\u2029x', 'h\n1', 'h1\n\n', 'xh1', 'h1x', ' h1', 'h1 ', 'h 1', 'h-1', 'h1.', 'h12', 'h01', 'hh1', 'h1h1', 'h1\nh2']) {
    it(`rejected: the element name ${JSON.stringify(name)} is no heading`, () => rejectsExactly(el(name), `the element ${name}`));
  }
  for (const ch of SWEEP) {
    it(`rejected: the element names h${label(ch)} and ${label(ch)}1 are no headings`, () => {
      rejectsExactly(el(`h${ch}`), `the element h${ch}`);
      rejectsExactly(el(`${ch}1`), `the element ${ch}1`);
      rejectsExactly(el(`h1${ch}`), `the element h1${ch}`);
      rejectsExactly(el(`h${ch}1`), `the element h${ch}1`);
    });
  }
  it('a symbol is named by its description in the messages of the guard', () => {
    rejectsExactly(el('th', { align: Symbol('x') }), 'an align of Symbol(x)');
    rejectsExactly({ type: Symbol('t'), children: [] }, 'a Symbol(t) node');
    rejectsExactly({ type: 'element', tagName: Symbol('t'), properties: {}, children: [] }, 'the element Symbol(t)');
  });
  it('the walk reaches a bad node at the end of a long list of children under an element that holds a property', () => {
    const many = Array.from({ length: 30 }, () => ({ type: 'text', value: 'x' }));
    rejectsExactly(el('a', { href: '#h' }, [...many, el('script')]), 'the element script');
    rejectsExactly(el('h1', { id: 'a' }, [...many, el('em', {}, [...many, el('img')])]), 'the element img');
  });
  it('an element is checked before its children and its properties before its children', () => {
    rejectsExactly(el('script', {}, [el('img')]), 'the element script');
    rejectsExactly(el('p', { onclick: 'x' }, [el('img')]), 'the property onclick on p');
    rejectsExactly(el('a', { href: 'javascript:x' }, [el('img')]), 'an href that is not a safe target');
    rejectsExactly(el('div', { onclick: 'x' }, [el('img')]), 'the element div');
  });
});

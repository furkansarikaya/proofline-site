// Node tests for the indexing switch, the sitemap, robots.txt and the verification tags (TASK-006).
// The first group tests src/lib/indexing.ts as plain functions. The second group builds the real site once per variant of the four environment
// variables, sequentially, in a `before` hook (so the per-test budgets measure assertions only), into one folder of its own inside the repository.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { ENV_KEYS, NOT_FOUND, canonicalUrl, logLines, pageAddresses, readIndexing, robotsTxt, sitemapXml, verificationMeta } from '../src/lib/indexing.ts';
import { ORIGIN, absoluteUrl } from '../src/lib/meta.ts';
import { alternates, index } from '../src/lib/translations.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CLOSED_ROBOTS = 'User-agent: *\nDisallow: /\n';
const OPEN_ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
const BLOCKED = 'indexing: blocked (VERCEL_ENV is not production and SITE_INDEXABLE is not 1)';
const GOOGLE = 'g00gle-t3st-v4lue-7f3a';
const BING = 'b1ng-t3st-v4lue-9c2d';
// hostile verification values: every one of the five characters, a typed entity and a closing tag; the google value is also padded with white space
const HOSTILE_GOOGLE = 'a"b<script>alert(\'x\')</script>&amp;c>d';
const HOSTILE_BING = '<b>"q" & \'r\'</b>';
const HOSTILE_GOOGLE_RAW = `a&quot;b&lt;script&gt;alert(&apos;x&apos;)&lt;/script&gt;&amp;amp;c&gt;d`;
const HOSTILE_BING_RAW = '&lt;b&gt;&quot;q&quot; &amp; &apos;r&apos;&lt;/b&gt;';

// ---- the module as plain functions ----------------------------------------------------------------------------------------------------

describe('indexing module', () => {
  it('indexing module decides from the two variables only', () => {
    assert.deepEqual([...ENV_KEYS], ['VERCEL_ENV', 'SITE_INDEXABLE', 'GOOGLE_SITE_VERIFICATION', 'BING_SITE_VERIFICATION']);
    assert.equal(NOT_FOUND, '/404.html');

    for (const vercel of [undefined, 'production', 'preview', 'Production']) {
      for (const flag of [undefined, '1', '0', 'true', '', ' 1']) {
        const env = {};
        if (vercel !== undefined) env.VERCEL_ENV = vercel;
        if (flag !== undefined) env.SITE_INDEXABLE = flag;
        const state = readIndexing(env);
        const open = vercel === 'production' || flag === '1';
        assert.equal(state.indexable, open, `VERCEL_ENV=${vercel} SITE_INDEXABLE=${flag} is ${open ? 'indexable' : 'closed'}`);
        const reason = open ? (vercel === 'production' ? 'VERCEL_ENV=production' : 'SITE_INDEXABLE=1') : 'VERCEL_ENV is not production and SITE_INDEXABLE is not 1';
        assert.equal(state.reason, reason, `the reason of VERCEL_ENV=${vercel} SITE_INDEXABLE=${flag}`);
      }
    }
    assert.equal(readIndexing({ VERCEL_ENV: 'production', SITE_INDEXABLE: '1' }).reason, 'VERCEL_ENV=production', 'production wins when both hold');

    // the verification entries: fixed order, trimmed, null when unset, empty or white space, and never tied to the mode
    const bare = readIndexing({});
    assert.deepEqual(bare.verification.map((v) => [v.console, v.name, v.content]), [['google', 'google-site-verification', null], ['bing', 'msvalidate.01', null]]);
    const set = readIndexing({ GOOGLE_SITE_VERIFICATION: ` ${GOOGLE} `, BING_SITE_VERIFICATION: '   ' });
    assert.deepEqual(set.verification.map((v) => v.content), [GOOGLE, null]);
    assert.deepEqual(
      readIndexing({ VERCEL_ENV: 'production', GOOGLE_SITE_VERIFICATION: GOOGLE }).verification,
      readIndexing({ GOOGLE_SITE_VERIFICATION: GOOGLE }).verification,
      'the verification entries do not depend on the mode',
    );

    // the three log lines, never a value
    assert.deepEqual(logLines(bare), [BLOCKED, 'verification tag: absent (google)', 'verification tag: absent (bing)']);
    const production = readIndexing({ VERCEL_ENV: 'production', GOOGLE_SITE_VERIFICATION: GOOGLE });
    assert.deepEqual(logLines(production), ['indexing: allowed (VERCEL_ENV=production)', 'verification tag: present (google)', 'verification tag: absent (bing)']);
    const flagged = readIndexing({ SITE_INDEXABLE: '1', GOOGLE_SITE_VERIFICATION: GOOGLE, BING_SITE_VERIFICATION: BING });
    const lines = logLines(flagged);
    assert.deepEqual(lines, ['indexing: allowed (SITE_INDEXABLE=1)', 'verification tag: present (google)', 'verification tag: present (bing)']);
    for (const line of lines) assert.ok(!line.includes(GOOGLE) && !line.includes(BING), `no log line holds a verification value: ${line}`);
    assert.deepEqual(logLines(readIndexing({ GOOGLE_SITE_VERIFICATION: '', BING_SITE_VERIFICATION: BING })).slice(1), ['verification tag: absent (google)', 'verification tag: present (bing)']);

    // canonical: only indexable, never the not-found page, always the page's own apex address
    const open = readIndexing({ VERCEL_ENV: 'production' });
    assert.equal(canonicalUrl('/', open), `${ORIGIN}/`);
    assert.equal(canonicalUrl('/tr/', open), `${ORIGIN}/tr/`);
    assert.equal(canonicalUrl(NOT_FOUND, open), null);
    assert.equal(canonicalUrl('/', bare), null);
    assert.equal(canonicalUrl(NOT_FOUND, bare), null);

    // robots.txt text, byte for byte
    assert.equal(robotsTxt(bare), CLOSED_ROBOTS);
    assert.equal(robotsTxt(open), OPEN_ROBOTS);
    assert.equal(robotsTxt(readIndexing({ SITE_INDEXABLE: '1' })), OPEN_ROBOTS);
  });

  it('page list and sitemap text are built from the pages and the translation index', () => {
    assert.deepEqual(
      pageAddresses(['./tr/index.astro', './index.astro', './404.astro', './_partial.astro', './_dir/inner.astro', './docs/guide.astro', './docs/index.astro']),
      ['/', '/docs/', '/docs/guide/', '/tr/'],
      'sorted, with 404 and every underscore file left out',
    );
    assert.deepEqual(pageAddresses(['./x.astro', './x/index.astro']), ['/x/'], 'one address once');
    assert.throws(() => pageAddresses(['./index.astro', './[slug].astro']), /sitemap: dynamic route \.\/\[slug\]\.astro needs its addresses listed/);

    const text = sitemapXml(['/', '/tr/', '/solo/']);
    const alt = (hreflang, href) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>\n`;
    const pair = alt('en', `${ORIGIN}/`) + alt('tr', `${ORIGIN}/tr/`) + alt('x-default', `${ORIGIN}/`);
    assert.equal(
      text,
      '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + `  <url>\n    <loc>${ORIGIN}/</loc>\n${pair}  </url>\n`
        + `  <url>\n    <loc>${ORIGIN}/tr/</loc>\n${pair}  </url>\n`
        + `  <url>\n    <loc>${ORIGIN}/solo/</loc>\n  </url>\n`
        + '</urlset>\n',
    );
    assert.deepEqual(alternates('/solo/'), [], 'a page without a pair has no alternates in the index either');
    assert.equal(alternates('/').map((a) => `${a.hreflang} ${a.href}`).join('|'), `en ${ORIGIN}/|tr ${ORIGIN}/tr/|x-default ${ORIGIN}/`);
    assert.ok(!/lastmod|changefreq|priority/.test(text), 'no lastmod, changefreq or priority');
    assert.ok(sitemapXml(['/a&b/']).includes(`<loc>${absoluteUrl('/a')}&amp;b/</loc>`), 'an address is escaped');
  });
});

// ---- the XML escaping of the sitemap: every rule of escapeXml, on every value that reaches the text ----------------------------------------

/** Runs `fn` while the translation index answers `alternates` with `stub`; the original is put back even when `fn` throws. */
function withAlternates(stub, fn) {
  const original = index.alternates;
  index.alternates = stub;
  try {
    return fn();
  } finally {
    index.alternates = original;
  }
}

const SPECIAL = "&\"<>'";
const SPECIAL_ESCAPED = '&amp;&quot;&lt;&gt;&apos;';
const RULES = [
  { name: 'ampersand', char: '&', escaped: '&amp;' },
  { name: 'double-quote', char: '"', escaped: '&quot;' },
  { name: 'less-than', char: '<', escaped: '&lt;' },
  { name: 'greater-than', char: '>', escaped: '&gt;' },
  { name: 'apostrophe', char: "'", escaped: '&apos;' },
];

/** The sitemap text of one page whose address, alternate hreflang and alternate href carry `loc`, `hreflang` and `href` verbatim. */
function sitemapWith(page, hreflang, href) {
  return withAlternates(() => [{ hreflang, href }], () => sitemapXml([page]));
}

/** What one entry looks like when every value is written once, escaped as given. */
const entryOf = (loc, hreflang, href) => `  <url>\n    <loc>${loc}</loc>\n    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>\n  </url>\n`;
const wrap = (entries) => '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
  + entries
  + '</urlset>\n';

describe('sitemap XML escaping', () => {
  for (const rule of RULES) {
    it(`escapeXml ${rule.name} rule: ${rule.char} is written as ${rule.escaped} in a loc, an alternate href and an alternate hreflang`, () => {
      // the character is written twice in each of the three values, so a rule that replaces only the first occurrence fails too
      const twice = (before, between, after) => `${before}${rule.char}${between}${rule.char}${after}`;
      const twiceEscaped = (before, between, after) => `${before}${rule.escaped}${between}${rule.escaped}${after}`;
      const text = sitemapWith(twice('/p', 'q', 'r/'), twice('h', 'l', 'm'), twice('https://example.test/a', 'b', 'c/'));
      assert.equal(text, wrap(entryOf(`${ORIGIN}${twiceEscaped('/p', 'q', 'r/')}`, twiceEscaped('h', 'l', 'm'), twiceEscaped('https://example.test/a', 'b', 'c/'))));
      // the character itself survives nowhere in the three values: count its raw occurrences outside the fixed markup
      const values = [...text.matchAll(/<loc>(.*?)<\/loc>|hreflang="(.*?)" href="(.*?)"\/>/g)].flatMap((m) => m.slice(1).filter((v) => v !== undefined));
      assert.equal(values.length, 3, 'three values were found');
      for (const value of values) {
        assert.equal(value.split(rule.escaped).length - 1, 2, `the escape of the ${rule.name} rule is there twice in ${value}`);
        const stripped = value.split(rule.escaped).join('');
        assert.ok(!stripped.includes(rule.char), `no raw ${rule.name} character is left in ${value}`);
      }
    });
  }

  it('escapeXml escapes the loc value with all five special characters in order, without a double escape', () => {
    const text = sitemapWith(`/${SPECIAL}${SPECIAL}/`, 'en', 'https://example.test/');
    assert.ok(text.includes(`<loc>${ORIGIN}/${SPECIAL_ESCAPED}${SPECIAL_ESCAPED}/</loc>`), 'the loc holds the five escapes twice');
    assert.ok(!text.includes('&amp;amp;') && !text.includes('&amp;lt;') && !text.includes('&amp;quot;'), 'an escape is never escaped again');
  });

  it('escapeXml escapes the alternate href value with all five special characters', () => {
    const text = sitemapWith('/x/', 'en', `https://example.test/?a=${SPECIAL}${SPECIAL}`);
    assert.ok(text.includes(`href="https://example.test/?a=${SPECIAL_ESCAPED}${SPECIAL_ESCAPED}"/>`), 'the href holds the five escapes twice');
    assert.ok(!text.includes('&amp;amp;'), 'an escape is never escaped again');
  });

  it('escapeXml escapes the alternate hreflang value with all five special characters', () => {
    const text = sitemapWith('/x/', `x${SPECIAL}${SPECIAL}`, 'https://example.test/');
    assert.ok(text.includes(`hreflang="x${SPECIAL_ESCAPED}${SPECIAL_ESCAPED}"`), 'the hreflang holds the five escapes twice');
    assert.ok(!text.includes('&amp;amp;'), 'an escape is never escaped again');
  });

  it('escapeXml escapes the ampersand first: a typed entity is escaped once and a produced one is not escaped again', () => {
    // an ampersand that is already part of text such as `&lt;` becomes `&amp;lt;`, once; the ampersand of a produced `&lt;` stays a single one
    const typed = sitemapWith('/t/', 'en', 'https://example.test/?a=&lt;&amp;&quot;');
    assert.ok(typed.includes('href="https://example.test/?a=&amp;lt;&amp;amp;&amp;quot;"/>'), 'a typed entity is escaped as text');
    const produced = sitemapWith('/t/', '<<', '>>');
    assert.ok(produced.includes('hreflang="&lt;&lt;" href="&gt;&gt;"/>'), 'a produced entity keeps its single ampersand');
    assert.ok(!produced.includes('&amp;'), 'the produced escapes are not escaped again');
    const loc = sitemapWith('/<&>/', 'en', 'https://example.test/');
    assert.ok(loc.includes(`<loc>${ORIGIN}/&lt;&amp;&gt;/</loc>`), 'the loc holds each escape once and in order');
  });

  it('escapeXml leaves a value without special characters as it is, and the real index is back after an injected one', () => {
    const plain = sitemapWith('/plain-page/', 'x-default', 'https://example.test/a-b_c.d/');
    assert.equal(plain, wrap(entryOf(`${ORIGIN}/plain-page/`, 'x-default', 'https://example.test/a-b_c.d/')));
    assert.equal(sitemapXml(['/solo/']).includes('xhtml:link'), false, 'the stub is gone: an unpaired page has no alternates again');
    assert.equal(alternates('/').length, 3, 'the real alternates answer again');
  });
});

// ---- the page list: every rule of pageAddresses, one named test each --------------------------------------------------------------------

describe('page list rules', () => {
  it('pageAddresses strips the .astro suffix at the end of the name only', () => {
    assert.deepEqual(pageAddresses(['./a.astro']), ['/a/']);
    assert.deepEqual(pageAddresses(['./x.astroid.astro']), ['/x.astroid/'], 'a name that holds .astro inside keeps it');
    assert.deepEqual(pageAddresses(['./docs/guide.astro']), ['/docs/guide/'], 'a nested file keeps its folder');
  });

  it('pageAddresses sorts the addresses, whatever the order of the files', () => {
    assert.deepEqual(pageAddresses(['./z.astro', './a.astro', './m/index.astro', './index.astro', './b/c.astro']), ['/', '/a/', '/b/c/', '/m/', '/z/']);
    assert.deepEqual(pageAddresses(['./b.astro', './a.astro']), ['/a/', '/b/']);
    assert.deepEqual(pageAddresses([]), [], 'no file, no address');
  });

  it('pageAddresses leaves out the not-found page and only that page', () => {
    assert.deepEqual(pageAddresses(['./404.astro', './index.astro']), ['/']);
    assert.deepEqual(pageAddresses(['./404.astro']), []);
    assert.deepEqual(pageAddresses(['./docs/404.astro']), ['/docs/404/'], 'only the root 404.astro is the not-found page');
  });

  it('pageAddresses leaves out a name that starts with an underscore at any depth', () => {
    for (const file of ['./_x.astro', './a/_x.astro', './a/b/_x.astro', './_a/x.astro', './a/_b/x.astro', './a/b/_c/d/x.astro', './_d/index.astro', './a/_d/index.astro', './a/b/_index.astro']) {
      assert.deepEqual(pageAddresses([file, './keep.astro']), ['/keep/'], `${file} is not a page`);
    }
    assert.deepEqual(pageAddresses(['./a_b.astro', './a/b_/c_d.astro']), ['/a/b_/c_d/', '/a_b/'], 'an underscore inside a name does not hide the page');
    assert.deepEqual(pageAddresses(['./_[slug].astro', './a/_[slug]/index.astro']), [], 'an underscore name is left out before the dynamic route check');
  });

  it('pageAddresses refuses a dynamic route at any depth with its file name in the message', () => {
    for (const file of ['./[slug].astro', './a/[slug].astro', './[a]/index.astro', './a/[...rest].astro', './a/[b]/c.astro']) {
      assert.throws(() => pageAddresses(['./index.astro', file]), new RegExp(`sitemap: dynamic route ${file.replace(/[.[\]]/g, '\\$&')} needs its addresses listed`), file);
    }
  });

  it('pageAddresses turns a last index segment into its folder address and keeps any other index segment', () => {
    assert.deepEqual(pageAddresses(['./index.astro']), ['/']);
    assert.deepEqual(pageAddresses(['./x/index.astro']), ['/x/']);
    assert.deepEqual(pageAddresses(['./x/y/index.astro']), ['/x/y/']);
    assert.deepEqual(pageAddresses(['./x/index/y.astro']), ['/x/index/y/'], 'an index folder in the middle stays');
    assert.deepEqual(pageAddresses(['./indexx.astro', './x/index2.astro']), ['/indexx/', '/x/index2/'], 'a name that only starts with index stays');
    assert.deepEqual(pageAddresses(['./x/index/index.astro']), ['/x/index/'], 'only one index segment is removed');
  });

  it('pageAddresses lists one address once, however many files and repeats lead to it', () => {
    assert.deepEqual(pageAddresses(['./x.astro', './x/index.astro']), ['/x/']);
    assert.deepEqual(pageAddresses(['./x/index.astro', './x/index.astro', './index.astro', './index.astro']), ['/', '/x/']);
  });
});

describe('verification meta helper', () => {
  it('verificationMeta writes a tag whose content holds no raw quote, angle bracket or ampersand', () => {
    const google = readIndexing({ GOOGLE_SITE_VERIFICATION: `  ${HOSTILE_GOOGLE}  ` }).verification[0];
    assert.equal(verificationMeta(google), `<meta name="google-site-verification" content="${HOSTILE_GOOGLE_RAW}">`);
    const bing = readIndexing({ BING_SITE_VERIFICATION: HOSTILE_BING }).verification[1];
    assert.equal(verificationMeta(bing), `<meta name="msvalidate.01" content="${HOSTILE_BING_RAW}">`);
    // each of the five characters, twice, one rule at a time
    for (const rule of RULES) {
      const one = readIndexing({ GOOGLE_SITE_VERIFICATION: `a${rule.char}b${rule.char}c` }).verification[0];
      assert.equal(verificationMeta(one), `<meta name="google-site-verification" content="a${rule.escaped}b${rule.escaped}c">`, `the ${rule.name} rule`);
    }
    // a plain value is written as it is, and an unset one writes nothing
    const plain = readIndexing({ GOOGLE_SITE_VERIFICATION: GOOGLE }).verification[0];
    assert.equal(verificationMeta(plain), `<meta name="google-site-verification" content="${GOOGLE}">`);
    assert.equal(verificationMeta(readIndexing({}).verification[0]), null);
  });
});

// ---- the variant builds ---------------------------------------------------------------------------------------------------------------

const VARIANTS = {
  closed: {},
  production: { VERCEL_ENV: 'production' },
  'indexable-flag': { SITE_INDEXABLE: '1' },
  'preview-flag': { VERCEL_ENV: 'preview', SITE_INDEXABLE: '1' },
  preview: { VERCEL_ENV: 'preview' },
  'flag-0': { SITE_INDEXABLE: '0' },
  'flag-true': { SITE_INDEXABLE: 'true' },
  'flag-empty': { SITE_INDEXABLE: '' },
  'verified-open': { VERCEL_ENV: 'production', GOOGLE_SITE_VERIFICATION: GOOGLE, BING_SITE_VERIFICATION: BING },
  'verified-closed': { GOOGLE_SITE_VERIFICATION: GOOGLE },
  'verified-hostile': { VERCEL_ENV: 'production', GOOGLE_SITE_VERIFICATION: `  ${HOSTILE_GOOGLE}  `, BING_SITE_VERIFICATION: HOSTILE_BING },
  'verification-empty': { VERCEL_ENV: 'production', GOOGLE_SITE_VERIFICATION: '', BING_SITE_VERIFICATION: '  ' },
};

/** Every file under dir as a sorted list of POSIX relative paths. */
function walk(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(join(dir, name)).isDirectory()) out.push(...walk(join(dir, name), rel));
    else out.push(rel);
  }
  return out.sort();
}

/** The whole tree as text: every relative path with the sha256 of its bytes. Equal text means an identical tree. */
const treeOf = (dir) => walk(dir).map((rel) => `${rel} ${createHash('sha256').update(readFileSync(join(dir, rel))).digest('hex')}`).join('\n');

/** The address a built page answers on: index.html is /, x/index.html is /x/, 404.html stays itself. */
const addressOf = (rel) => (rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? `/${rel.slice(0, -'index.html'.length)}` : `/${rel}`);

/** The head children of a page that matter to the mode: charset, viewport, robots meta and title. */
function headSignature($) {
  const wanted = ['meta[charset]', 'meta[name=viewport]', 'meta[name=robots]', 'title'];
  return $('head').children().toArray()
    .map((el) => (el.tagName === 'meta' ? (el.attribs.charset !== undefined ? 'meta[charset]' : `meta[name=${el.attribs.name}]`) : el.tagName))
    .filter((s) => wanted.includes(s));
}

describe('variant builds', () => {
  const builds = {};
  let parent = '';

  before(() => {
    mkdirSync(join(root, '.cache'), { recursive: true });
    parent = mkdtempSync(join(root, '.cache', 'proofline-indexing-'));
    const scrubbed = { ...process.env };
    for (const key of ENV_KEYS) delete scrubbed[key];
    // The home pages read the pin facts of the pinned documents while they are built (TASK-019): the fetch runs once, before the variant builds.
    const fetched = spawnSync(process.execPath, [join(root, 'scripts', 'sync.mjs'), 'fetch'], { cwd: root, encoding: 'utf8', timeout: 120000, env: scrubbed });
    assert.equal(fetched.status, 0, `the fetch of the pinned documents exits 0: ${(fetched.stdout ?? '') + (fetched.stderr ?? '')}`.slice(-400));
    for (const [name, env] of Object.entries(VARIANTS)) {
      const outDir = join(parent, name);
      const r = spawnSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build', '--outDir', outDir], {
        cwd: root, encoding: 'utf8', timeout: 120000, env: { ...scrubbed, ...env },
      });
      builds[name] = { name, outDir, status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
    }
  }, { timeout: 900000 });

  after(() => {
    if (parent !== '') rmSync(parent, { recursive: true, force: true });
  });

  const lines = (b) => `${b.stdout}\n${b.stderr}`.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  const build = (name) => {
    const b = builds[name];
    assert.ok(b, `the ${name} build ran`);
    assert.equal(b.status, 0, `the ${name} build exits 0: ${(b.stderr + b.stdout).slice(-400)}`);
    return b;
  };
  const htmlOf = (b) => walk(b.outDir).filter((f) => f.endsWith('.html'));
  const pageOf = (b, rel) => load(readFileSync(join(b.outDir, rel), 'utf8'));
  const read = (b, rel) => (existsSync(join(b.outDir, rel)) ? readFileSync(join(b.outDir, rel), 'utf8') : '');
  const sitemapOf = (b) => load(read(b, 'sitemap.xml'), { xml: true });
  const sitemapEntries = (b) => sitemapOf(b)('url').toArray().map((url) => {
    const $url = sitemapOf(b)(url);
    return { loc: $url.children('loc').text(), links: $url.children('xhtml\\:link').toArray().map((l) => ({ hreflang: l.attribs.hreflang, href: l.attribs.href })) };
  });

  it('closed build: noindex on every page, closed robots.txt, no sitemap and the blocked log line', () => {
    const b = build('closed');
    const pages = htmlOf(b);
    assert.deepEqual(pages, ['404.html', 'index.html', 'tr/index.html']);
    for (const rel of pages) {
      const $ = pageOf(b, rel);
      assert.equal($('meta[name="robots"]').length, 1, `${rel} holds one robots meta`);
      assert.equal($('meta[name="robots"]').attr('content'), 'noindex, nofollow');
      assert.deepEqual(headSignature($), ['meta[charset]', 'meta[name=viewport]', 'meta[name=robots]', 'title'], `${rel} head signature`);
      // The home pages are the real ones: the pinned documents were fetched first and the pages were built from them.
      if (rel !== '404.html') assert.equal($('main h1.home-h1').length, 1, `${rel} holds the home headline`);
    }
    assert.equal(read(b, 'robots.txt'), CLOSED_ROBOTS);
    assert.equal(existsSync(join(b.outDir, 'sitemap.xml')), false, 'no sitemap is written');
    const indexing = lines(b).filter((l) => l.startsWith('indexing: '));
    assert.deepEqual(indexing, [BLOCKED], 'one indexing line, naming both variables');
    assert.match(indexing[0], /^indexing: blocked \(.*VERCEL_ENV.*SITE_INDEXABLE.*\)$/);
  });

  it('production build: no robots meta, open robots.txt with the sitemap address, sitemap present and the allowed log line', () => {
    const b = build('production');
    const pages = htmlOf(b);
    assert.deepEqual(pages, ['404.html', 'index.html', 'tr/index.html']);
    for (const rel of pages) {
      const $ = pageOf(b, rel);
      assert.equal($('meta[name="robots"]').length, 0, `${rel} holds no robots meta`);
      assert.doesNotMatch(read(b, rel), /noindex/, `${rel} holds no noindex`);
      assert.deepEqual(headSignature($), ['meta[charset]', 'meta[name=viewport]', 'title'], `${rel} head signature`);
    }
    assert.equal(read(b, 'robots.txt'), OPEN_ROBOTS);
    assert.ok(read(b, 'robots.txt').includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
    assert.ok(existsSync(join(b.outDir, 'sitemap.xml')), 'the sitemap is written');
    assert.deepEqual(lines(b).filter((l) => l.startsWith('indexing: ')), ['indexing: allowed (VERCEL_ENV=production)']);
  });

  it('indexing variables: only production or SITE_INDEXABLE=1 open the site', () => {
    const production = treeOf(build('production').outDir);
    const closed = treeOf(build('closed').outDir);
    assert.notEqual(production, closed, 'the two modes differ');
    const expectations = {
      'indexable-flag': [production, 'indexing: allowed (SITE_INDEXABLE=1)'],
      'preview-flag': [production, 'indexing: allowed (SITE_INDEXABLE=1)'],
      preview: [closed, BLOCKED],
      'flag-0': [closed, BLOCKED],
      'flag-true': [closed, BLOCKED],
      'flag-empty': [closed, BLOCKED],
    };
    for (const [name, [tree, line]] of Object.entries(expectations)) {
      const b = build(name);
      assert.equal(treeOf(b.outDir), tree, `${name} produces the ${tree === production ? 'indexable' : 'closed'} output`);
      assert.deepEqual(lines(b).filter((l) => l.startsWith('indexing: ')), [line], `${name} logs one indexing line`);
    }
    for (const name of Object.keys(VARIANTS)) {
      const b = build(name);
      const log = lines(b);
      assert.equal(log.filter((l) => l.startsWith('indexing: ')).length, 1, `${name}: one indexing line`);
      assert.equal(log.filter((l) => /^verification tag: .* \(google\)$/.test(l)).length, 1, `${name}: one google line`);
      assert.equal(log.filter((l) => /^verification tag: .* \(bing\)$/.test(l)).length, 1, `${name}: one bing line`);
    }
  });

  it('sitemap lists the built pages with https addresses, trailing slashes and no lastmod', () => {
    const b = build('production');
    const text = read(b, 'sitemap.xml');
    const expected = htmlOf(b).filter((rel) => rel !== '404.html').map((rel) => `${ORIGIN}${addressOf(rel)}`).sort();
    const entries = sitemapEntries(b);
    assert.deepEqual(entries.map((e) => e.loc), expected, 'the sitemap lists exactly the built pages except 404.html');
    assert.ok(expected.length >= 2);
    const addresses = [...entries.map((e) => e.loc), ...entries.flatMap((e) => e.links.map((l) => l.href))];
    for (const address of addresses) {
      assert.ok(address.startsWith(`${ORIGIN}/`), `${address} starts with the https origin`);
      assert.ok(address.endsWith('/'), `${address} ends with a slash`);
    }
    assert.ok(!/pagefind|\.md\b|404/.test(entries.map((e) => e.loc).join(' ')), 'no pagefind file, Markdown copy or 404 page is listed');
    const namespaces = text.replace(/xmlns(?::xhtml)?="http:\/\/[^"]*"/g, '');
    assert.ok(!namespaces.includes('http://'), 'the only http:// strings are the two namespace names of the root element');
    assert.equal(text.match(/http:\/\//g)?.length, 2, 'two namespace names');
    assert.ok(!/lastmod/.test(text), 'no lastmod');
    assert.ok(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset '), 'an XML declaration and a urlset root');
    assert.ok(text.endsWith('</urlset>\n'));
  });

  it('sitemap alternates equal the head alternates and unpaired pages have none', () => {
    const b = build('production');
    const entries = sitemapEntries(b);
    const byAddress = new Map(entries.map((e) => [e.loc, e.links]));
    for (const rel of htmlOf(b)) {
      const head = pageOf(b, rel)('link[rel="alternate"][hreflang]').toArray().map((l) => ({ hreflang: l.attribs.hreflang, href: l.attribs.href }));
      const address = `${ORIGIN}${addressOf(rel)}`;
      if (rel === '404.html') {
        assert.equal(byAddress.has(address), false, '404.html is not in the sitemap');
        assert.deepEqual(head, [], '404.html has no alternates in its head');
        continue;
      }
      assert.deepEqual(byAddress.get(address), head, `${rel}: the sitemap alternates equal the head alternates`);
    }
    for (const address of [`${ORIGIN}/`, `${ORIGIN}/tr/`]) {
      assert.deepEqual(byAddress.get(address).map((l) => l.hreflang), ['en', 'tr', 'x-default'], `${address} lists en, tr and x-default`);
    }
    assert.deepEqual(byAddress.get(`${ORIGIN}/`), byAddress.get(`${ORIGIN}/tr/`), 'the pair lists the same three');
    // a page with no pair has none, in the index and in a sitemap entry built for it
    assert.deepEqual(alternates('/solo/'), []);
    assert.equal(sitemapXml(['/solo/']).includes('xhtml:link'), false);
  });

  it('indexable pages hold one own canonical, closed pages none', () => {
    const open = build('production');
    for (const rel of htmlOf(open)) {
      const links = pageOf(open, rel)('link[rel="canonical"]');
      if (rel === '404.html') {
        assert.equal(links.length, 0, '404.html holds no canonical');
        continue;
      }
      assert.equal(links.length, 1, `${rel} holds exactly one canonical`);
      assert.equal(links.attr('href'), `${ORIGIN}${addressOf(rel)}`, `${rel}: the canonical is the page's own address`);
    }
    for (const name of ['closed', 'verified-closed']) {
      const b = build(name);
      for (const rel of htmlOf(b)) assert.equal(pageOf(b, rel)('link[rel="canonical"]').length, 0, `${name} ${rel} holds no canonical`);
    }
  });

  it('verification tags follow their variables and the log says present or absent per console', () => {
    const tag = (b, rel, name) => pageOf(b, rel)(`meta[name="${name}"]`);
    const expectTags = (b, google, bing) => {
      for (const rel of htmlOf(b)) {
        const g = tag(b, rel, 'google-site-verification');
        const m = tag(b, rel, 'msvalidate.01');
        assert.equal(g.length, google === null ? 0 : 1, `${b.name} ${rel}: google tag`);
        assert.equal(m.length, bing === null ? 0 : 1, `${b.name} ${rel}: bing tag`);
        if (google !== null) assert.equal(g.attr('content'), google);
        if (bing !== null) assert.equal(m.attr('content'), bing);
        if (google !== null && bing !== null) {
          const metas = pageOf(b, rel)('head meta').toArray().map((el) => el.attribs.name);
          assert.ok(metas.indexOf('google-site-verification') < metas.indexOf('msvalidate.01'), `${b.name} ${rel}: google before bing`);
        }
      }
      const log = lines(b);
      assert.equal(log.includes(`verification tag: ${google === null ? 'absent' : 'present'} (google)`), true, `${b.name}: google log line`);
      assert.equal(log.includes(`verification tag: ${bing === null ? 'absent' : 'present'} (bing)`), true, `${b.name}: bing log line`);
    }
    const open = build('verified-open');
    assert.ok(htmlOf(open).includes('404.html'), 'the not-found page is among the pages checked');
    expectTags(open, GOOGLE, BING);
    expectTags(build('closed'), null, null);
    expectTags(build('verification-empty'), null, null);
    expectTags(build('verified-closed'), GOOGLE, null);

    // hostile values: the raw attribute holds no raw quote or angle bracket, and a parser reads the trimmed value back exactly
    const hostile = build('verified-hostile');
    assert.ok(htmlOf(hostile).includes('404.html'), 'the not-found page is among the pages checked');
    const cases = [['google-site-verification', HOSTILE_GOOGLE, HOSTILE_GOOGLE_RAW], ['msvalidate.01', HOSTILE_BING, HOSTILE_BING_RAW]];
    for (const rel of htmlOf(hostile)) {
      const raw = read(hostile, rel);
      for (const [name, value, escaped] of cases) {
        const tags = [...raw.matchAll(new RegExp(`<meta name="${name.replace('.', '\\.')}"([^>]*)>`, 'g'))];
        assert.equal(tags.length, 1, `${rel}: one raw ${name} tag`);
        const attribute = tags[0][1].match(/^ content="([^"<>]*)"$/);
        assert.ok(attribute, `${rel}: the raw ${name} tag is \`content="..."\` with no raw quote or angle bracket inside: ${tags[0][0]}`);
        assert.equal(attribute[1], escaped, `${rel}: the raw ${name} value is written with entities`);
        assert.equal(pageOf(hostile, rel)(`meta[name="${name}"]`).attr('content'), value, `${rel}: a parser reads the trimmed ${name} value back`);
      }
      assert.equal(raw.includes('<script>alert'), false, `${rel}: no raw script text`);
      assert.equal(pageOf(hostile, rel)('script:not([src]):not([type="application/ld+json"])').length, 0, `${rel}: the value opened no script element`);
    }
    const log = lines(hostile);
    assert.equal(log.includes('verification tag: present (google)'), true, 'hostile build: google log line');
    assert.equal(log.includes('verification tag: present (bing)'), true, 'hostile build: bing log line');
  });

  it('no verification value appears in build output or in dist outside its own meta tag', () => {
    for (const name of Object.keys(VARIANTS)) {
      const b = build(name);
      for (const line of lines(b)) {
        assert.ok(!line.includes(GOOGLE) && !line.includes(BING), `${name}: an output line holds a verification value: ${line}`);
      }
    }
    for (const name of ['verified-open', 'verified-closed']) {
      const b = build(name);
      const own = { 'google-site-verification': GOOGLE, 'msvalidate.01': BING };
      for (const rel of walk(b.outDir)) {
        const bytes = readFileSync(join(b.outDir, rel));
        if (!rel.endsWith('.html')) {
          for (const value of [GOOGLE, BING]) assert.equal(bytes.includes(value), false, `${name} ${rel} holds no verification value`);
          continue;
        }
        for (const [metaName, value] of Object.entries(own)) {
          const $ = load(bytes.toString('utf8'));
          $(`meta[name="${metaName}"]`).remove();
          assert.equal($.html().includes(value), false, `${name} ${rel}: the value of ${metaName} appears only inside its own meta tag`);
        }
      }
    }
    const hostile = build('verified-hostile');
    const forms = [HOSTILE_GOOGLE, HOSTILE_BING, HOSTILE_GOOGLE_RAW, HOSTILE_BING_RAW];
    for (const line of lines(hostile)) {
      for (const form of forms) assert.equal(line.includes(form), false, `hostile build: an output line holds a verification value: ${line}`);
    }
    for (const rel of walk(hostile.outDir)) {
      const text = readFileSync(join(hostile.outDir, rel), 'utf8');
      if (!rel.endsWith('.html')) {
        for (const form of forms) assert.equal(text.includes(form), false, `hostile ${rel} holds no verification value`);
        continue;
      }
      for (const form of [HOSTILE_GOOGLE, HOSTILE_BING]) assert.equal(text.includes(form), false, `hostile ${rel}: no raw value`);
      const without = text.replace(/<meta name="(?:google-site-verification|msvalidate\.01)" content="[^"<>]*">/g, '');
      assert.notEqual(without, text, `hostile ${rel}: the two tags were found and removed`);
      for (const form of forms) assert.equal(without.includes(form), false, `hostile ${rel}: the value appears only inside its own meta tag`);
    }
    const open = build('verified-open');
    for (const rel of ['robots.txt', 'sitemap.xml']) {
      assert.ok(read(open, rel) !== '', `${rel} is built`);
      for (const value of [GOOGLE, BING]) assert.equal(read(open, rel).includes(value), false, `${rel} holds no verification value`);
    }
  });

  it('verification tags do not depend on the indexing mode', () => {
    const open = build('verified-open');
    const closed = build('verified-closed');
    assert.deepEqual(htmlOf(open), htmlOf(closed));
    for (const rel of htmlOf(open)) {
      const a = pageOf(open, rel);
      const c = pageOf(closed, rel);
      assert.equal(a('meta[name="google-site-verification"]').length, 1, `${rel}: the indexable build prints the google tag`);
      assert.equal(c('meta[name="google-site-verification"]').length, 1, `${rel}: the closed build prints the google tag`);
      assert.equal(a.html(a('meta[name="google-site-verification"]')), c.html(c('meta[name="google-site-verification"]')), `${rel}: the same tag in both builds`);
      assert.equal(c('meta[name="robots"]').length, 1, `${rel}: the closed build is still closed`);
      assert.equal(a('meta[name="robots"]').length, 0, `${rel}: the indexable build is still open`);
    }
  });
});

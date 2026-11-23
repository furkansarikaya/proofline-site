// Node tests for the site header, footer, copyable command component and the controls script source (TASK-005).
// Units import src/lib/nav.ts; source checks read the icon files and public/assets/controls.js; the built-page group builds once into a private
// output directory (never dist/, so it cannot race tests/site.test.mjs). The browser behaviour of the script is tests/controls.mjs.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { MENU, REPO_URL, SITE_REPO_URL, controlsScript, licenseHref, menu, pinnedCommit } from '../src/lib/nav.ts';
import { switcherTarget } from '../src/lib/translations.ts';
import { makeTempDir, removeTempDirs, sweepStale } from './temp-dirs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
sweepStale();
after(removeTempDirs);

const FIVE_PAIRS = [
  { en: '/', tr: '/tr/' },
  { en: '/get-started/', tr: '/tr/baslarken/' },
  { en: '/docs/', tr: '/tr/docs/' },
  { en: '/trust/', tr: '/tr/guven/' },
  { en: '/claude-code-and-codex/', tr: '/tr/claude-code-ve-codex/' },
];
const MENU_EN = [
  { href: '/', label: 'Home' },
  { href: '/get-started/', label: 'Get started' },
  { href: '/docs/', label: 'Docs' },
  { href: '/trust/', label: 'Trust' },
  { href: '/claude-code-and-codex/', label: 'Claude Code + Codex' },
];
const MENU_TR = [
  { href: '/tr/', label: 'Ana sayfa' },
  { href: '/tr/baslarken/', label: 'Başlarken' },
  { href: '/tr/docs/', label: 'Belgeler' },
  { href: '/tr/guven/', label: 'Güven' },
  { href: '/tr/claude-code-ve-codex/', label: 'Claude Code ve Codex' },
];
const REPO = 'https://github.com/furkansarikaya/proofline';
const SITE_REPO = 'https://github.com/furkansarikaya/proofline-site';
const COMMAND = ['/plugin marketplace add furkansarikaya/proofline', '/plugin install proofline@proofline'];
const FOOTER = {
  en: 'No cookies and no analytics scripts. The host keeps ordinary request logs. MIT licensed (LICENSE). Built with proofline.',
  tr: 'Çerez ve analitik betiği yok. Barındırıcı olağan istek günlüklerini tutar. MIT lisanslı (LICENSE). proofline ile yapıldı.',
};
const HOMES = { en: 'index.html', tr: 'tr/index.html' };

/** Text of a file under the repository root, or '' when it is absent (a missing file fails an assertion, not a crash). */
const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');
const squash = (text) => text.replace(/\s+/g, ' ').trim();

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

// ---- source checks --------------------------------------------------------------------------------------------------------------------

describe('icons and controls script source', () => {
  it('icon files use currentColor only', () => {
    for (const name of ['github', 'sun', 'moon']) {
      const rel = `src/assets/icons/${name}.svg`;
      assert.ok(existsSync(join(root, rel)), `${rel} exists`);
      const text = read(rel);
      assert.ok(text.includes('currentColor'), `${rel} draws with currentColor`);
      const paints = [...text.matchAll(/\s(fill|stroke)\s*=\s*"([^"]*)"/g)].map((m) => m[2]);
      assert.ok(paints.length >= 1, `${rel} sets a fill or a stroke`);
      for (const value of paints) assert.ok(value === 'currentColor' || value === 'none', `${rel}: fill or stroke "${value}" is currentColor or none`);
      assert.doesNotMatch(text, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${rel} holds no colour literal`);
      assert.doesNotMatch(text, /<style|\sstyle\s*=/i, `${rel} holds no style element or attribute`);
    }
  });

  it('controls script is at most 2048 bytes and copied to dist', () => {
    const source = join(root, 'public', 'assets', 'controls.js');
    assert.ok(existsSync(source), 'public/assets/controls.js exists');
    const bytes = readFileSync(source);
    assert.ok(bytes.length >= 1 && bytes.length <= 2048, `controls.js is 1 to 2048 bytes, found ${bytes.length}`);
    const copy = join(built.outDir, 'assets', 'controls.js');
    assert.ok(existsSync(copy), 'the build holds assets/controls.js');
    assert.ok(readFileSync(copy).equals(bytes), 'the built file is byte-equal to the source');
  });

  it('controls script uses no cookie or network and one storage key', () => {
    const text = read('public/assets/controls.js');
    assert.ok(text.length > 0, 'controls.js exists and is not empty');
    for (const token of ['document.cookie', 'fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'eval']) {
      assert.ok(!text.includes(token), `controls.js holds no ${token}`);
    }
    const calls = [...text.matchAll(/(?:localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem|key|clear)\s*\(\s*([^,)]*)/g)];
    assert.ok(calls.length >= 2, `controls.js reads and writes the stored choice, found ${calls.length} storage calls`);
    for (const [, method, arg] of calls) assert.ok(['getItem', 'setItem', 'removeItem'].includes(method) && /^(['"])theme\1$/.test(arg.trim()), `storage ${method}(${arg}) uses the key 'theme'`);
    assert.doesNotMatch(text, /sessionStorage|indexedDB|caches\b/, 'only localStorage is used');
  });
});

describe('navigation module', () => {
  it('menu lists entries in order and only built pages', () => {
    assert.deepEqual(menu('en', FIVE_PAIRS), MENU_EN);
    assert.deepEqual(menu('tr', FIVE_PAIRS), MENU_TR);
    assert.deepEqual(menu('en', [FIVE_PAIRS[4], FIVE_PAIRS[0]]), [MENU_EN[0], MENU_EN[4]], 'the fixed order holds whatever the order of the pairs');
    assert.deepEqual(menu('en'), [MENU_EN[0], MENU_EN[1]], 'the real pairs give Home and Get started');
    assert.deepEqual(menu('tr'), [MENU_TR[0], MENU_TR[1]]);
    assert.deepEqual(menu('en', []), [], 'no pair, no entry');
    assert.deepEqual(menu('en', [{ en: '/other/', tr: '/tr/baska/' }]), [], 'an unknown pair adds no entry');
    assert.deepEqual(MENU.map((e) => e.surface), ['site', 'site', 'docs', 'site', 'site']);
    for (const rel of walk(join(built.outDir)).filter((f) => f.endsWith('.html'))) {
      const $ = load(readFileSync(join(built.outDir, rel), 'utf8'));
      for (const href of $('header nav a').toArray().map((a) => a.attribs.href)) {
        const target = href === '/' ? 'index.html' : `${href.slice(1)}index.html`;
        assert.ok(existsSync(join(built.outDir, target)), `${rel}: the menu link ${href} exists in the build`);
      }
    }
  });

  it('controlsScript is true for the site pages only', () => {
    for (const page of ['/', '/tr/', '/get-started/', '/tr/baslarken/', '/trust/', '/tr/guven/', '/claude-code-and-codex/', '/tr/claude-code-ve-codex/']) {
      assert.equal(controlsScript(page), true, `${page} loads the controls script`);
    }
    for (const page of ['/404.html', '/docs/', '/tr/docs/', '/docs/guide/', '/other/']) assert.equal(controlsScript(page), false, `${page} does not`);
  });

  it('repository addresses are the two proofline repositories', () => {
    assert.equal(REPO_URL, REPO);
    assert.equal(SITE_REPO_URL, SITE_REPO);
  });
});

// ---- the built pages ------------------------------------------------------------------------------------------------------------------

const built = { parent: '', outDir: '', status: -1, output: '' };

// The output directory is inside the repository (the git-ignored .cache folder): Astro builds an output directory outside the working directory through one
// shared fallback folder (.tmp), which would race the private build of tests/design.test.mjs. A folder of its own per run has no such shared state.
before(() => {
  mkdirSync(join(root, '.cache'), { recursive: true });
  built.parent = mkdtempSync(join(root, '.cache', 'proofline-site-'));
  built.outDir = join(built.parent, 'dist');
  // The home pages read the pin facts of the pinned documents while they are built (TASK-019), so the fetch comes first, as in `npm run build`.
  const fetched = spawnSync(process.execPath, [join(root, 'scripts', 'sync.mjs'), 'fetch'], { cwd: root, encoding: 'utf8' });
  const r = fetched.status === 0
    ? spawnSync(process.execPath, [join(root, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'build', '--outDir', built.outDir], { cwd: root, encoding: 'utf8' })
    : fetched;
  built.status = r.status;
  built.output = `${fetched.stdout ?? ''}${fetched.stderr ?? ''}${r.stdout ?? ''}${r.stderr ?? ''}`;
}, { timeout: 120000 });

after(() => {
  if (built.parent !== '') rmSync(built.parent, { recursive: true, force: true });
});

/** A built page parsed with cheerio; fails the test when the build did not produce it. */
function page(rel) {
  assert.equal(built.status, 0, `the private build exits 0: ${built.output.slice(-400)}`);
  const file = join(built.outDir, rel);
  assert.ok(existsSync(file), `${rel} is built`);
  return load(readFileSync(file, 'utf8'));
}

const PAGES = [['en', 'index.html', '/'], ['tr', 'tr/index.html', '/tr/']];

describe('built pages', { timeout: 120000 }, () => {
  it('header order on English and Turkish pages', () => {
    for (const [lang, rel] of [...PAGES, ['en', '404.html']]) {
      const $ = page(rel);
      assert.equal($('header').length, 1, `${rel} holds one header`);
      assert.deepEqual($('body').find('header, main, footer').toArray().map((el) => el.tagName), ['header', 'main', 'footer'], `${rel}: header, main, footer in that order`);
      const roles = $('header a[href], header button').toArray().map((el) => {
        if ($(el).hasClass('brand')) return 'brand';
        if (el.attribs.id === 'b-gh') return 'github';
        if (el.attribs.id === 'b-lang') return 'language';
        if (el.attribs.id === 'b-theme') return 'theme';
        assert.equal($(el).closest('nav').length, 1, `${rel}: an unnamed header control is a menu link`);
        return 'menu';
      });
      // The real pairs list two entries today: Home and Get started (TASK-021).
      assert.deepEqual(roles, ['brand', 'menu', 'menu', 'github', 'language', 'theme'], `${rel} header order`);
      const brand = $('header .brand');
      assert.equal(squash(brand.text()), 'proofline');
      assert.equal(brand.attr('href'), lang === 'tr' ? '/tr/' : '/', `${rel} brand target`);
      assert.equal($('header nav').length, 1, `${rel} holds one nav`);
      assert.equal($('header nav a').first().attr('href'), lang === 'tr' ? '/tr/' : '/', `${rel} menu starts with Home`);
      assert.equal($('header nav a').first().text(), lang === 'tr' ? 'Ana sayfa' : 'Home');
    }
    const aria = page('index.html')('header nav a[aria-current="page"]');
    assert.equal(aria.length, 1, 'the entry of the current page is marked');
    assert.equal(aria.attr('href'), '/');
  });

  it('menu never links to a missing address', () => {
    page('index.html');
    const listed = (rel) => new Set(page(rel)('header nav a').toArray().map((a) => a.attribs.href));
    for (const entry of MENU) {
      const both = existsSync(join(built.outDir, entry.en === '/' ? 'index.html' : `${entry.en.slice(1)}index.html`))
        && existsSync(join(built.outDir, `${entry.tr.slice(1)}index.html`));
      assert.equal(listed('index.html').has(entry.en), both, `/ lists ${entry.en} exactly when both pages are built`);
      assert.equal(listed('tr/index.html').has(entry.tr), both, `/tr/ lists ${entry.tr} exactly when both pages are built`);
    }
    for (const rel of walk(built.outDir).filter((f) => f.endsWith('.html'))) {
      const $ = load(readFileSync(join(built.outDir, rel), 'utf8'));
      const hrefs = $('header a[href]').toArray().map((a) => a.attribs.href).filter((h) => h.startsWith('/'));
      assert.ok(hrefs.length >= 3, `${rel} header holds same-origin links`);
      for (const href of hrefs) assert.ok(existsSync(join(built.outDir, `${href.slice(1)}index.html`)), `${rel}: ${href} exists in the build`);
    }
  });

  it('GitHub link address name and referrer', () => {
    const names = { en: 'proofline on GitHub', tr: "GitHub'da proofline" };
    for (const [lang, rel] of PAGES) {
      const $ = page(rel);
      const link = $('a#b-gh');
      assert.equal(link.length, 1);
      assert.equal(link.attr('href'), REPO);
      assert.equal(link.attr('aria-label'), names[lang]);
      assert.ok(!/noreferrer/i.test(link.attr('rel') ?? ''), `${rel}: the GitHub link has no noreferrer`);
      assert.equal(link.find('svg').length, 1, 'the link holds one icon');
      assert.equal(link.find('svg').attr('aria-hidden'), 'true');
      assert.equal(link.find('svg').attr('focusable'), 'false');
      assert.equal(link.text().trim(), '', 'the icon is the only content');
      assert.equal($('meta[name="referrer"]').filter((_, el) => /no-referrer/i.test(el.attribs.content ?? '')).length, 0, `${rel} sets no referrer policy of no-referrer`);
      assert.equal($('a[rel~="noreferrer"]').length, 0, `${rel} has no link with noreferrer`);
    }
  });

  it('language link shows the other language only', () => {
    const expected = {
      en: { text: 'TR', name: 'TR: read this page in Turkish', lang: 'tr', hreflang: 'tr' },
      tr: { text: 'EN', name: 'EN: bu sayfayı İngilizce oku', lang: 'en', hreflang: 'en' },
    };
    for (const [lang, rel, address] of PAGES.map(([l, r, a]) => [l, r, a])) {
      const link = page(rel)('a#b-lang');
      assert.equal(link.length, 1);
      assert.equal(link.text().trim(), expected[lang].text);
      assert.equal(link.attr('href'), switcherTarget(address).href);
      assert.equal(link.attr('aria-label'), expected[lang].name);
      assert.equal(link.attr('lang'), expected[lang].lang);
      assert.equal(link.attr('hreflang'), expected[lang].hreflang);
      assert.equal(link.prop('tagName'), 'A', 'the language control is a link, not a button');
      // On the real home pages (TASK-019) the link leads from one home page to the other and back.
      assert.equal(link.attr('href'), lang === 'en' ? '/tr/' : '/', `${rel}: the language link leads to the other home page`);
      assert.equal(page(rel)('main h1.home-h1').length, 1, `${rel}: the page is the real home page`);
    }
    const notFound = page('404.html')('a#b-lang');
    assert.equal(notFound.attr('href'), switcherTarget('/404.html').href);
    assert.equal(page('404.html')('link[hreflang]').length, 0, 'the link element count stays 0 on 404');
  });

  it('theme button holds two cells and starts hidden', () => {
    const names = {
      en: { light: 'Theme: light. Switch to dark', dark: 'Theme: dark. Switch to light' },
      tr: { light: 'Tema: açık. Koyu temaya geç', dark: 'Tema: koyu. Açık temaya geç' },
    };
    for (const [lang, rel] of PAGES) {
      const $ = page(rel);
      const button = $('button#b-theme');
      assert.equal(button.length, 1);
      assert.equal(button.attr('type'), 'button');
      assert.ok(button.hasClass('theme'));
      assert.equal(button.find('.cell.cell-sun svg').length, 1, 'a sun cell');
      assert.equal(button.find('.cell.cell-moon svg').length, 1, 'a moon cell');
      assert.equal(button.attr('aria-label'), names[lang].light);
      assert.equal(button.attr('data-name-light'), names[lang].light);
      assert.equal(button.attr('data-name-dark'), names[lang].dark);
      assert.equal($('html').hasClass('js'), false, 'the page ships without the js class');
    }
    const $ = page('index.html');
    const href = $('link[rel~=stylesheet]').attr('href');
    const css = readFileSync(join(built.outDir, href), 'utf8');
    const hidden = /(?:^|[},\s])\.theme\s*(?:,[^{}]*)?\{[^{}]*display\s*:\s*none/.test(css);
    const shown = /\.js\s+\.theme\s*(?:,[^{}]*)?\{[^{}]*display\s*:\s*(?!none)[a-z-]+/.test(css);
    assert.ok(hidden, 'the stylesheet hides .theme by default');
    assert.ok(shown, 'the stylesheet shows .theme under html.js');
  });

  it('footer text and links in both languages', () => {
    const pin = JSON.parse(read('sync/pin.json'));
    assert.match(pin.commit, /^[0-9a-f]{40}$/, 'sync/pin.json holds a commit');
    for (const [lang, rel] of PAGES) {
      const $ = page(rel);
      assert.equal($('footer').length, 1);
      assert.equal($('footer p').length, 1, 'one paragraph');
      assert.equal(squash($('footer p').text()), FOOTER[lang]);
      const links = $('footer a').toArray().map((a) => [squash($(a).text()), a.attribs.href, a.attribs.rel]);
      assert.deepEqual(links, [
        ['LICENSE', `${REPO}/blob/${pin.commit}/LICENSE`, undefined],
        [lang === 'tr' ? 'proofline ile yapıldı' : 'Built with proofline', SITE_REPO, undefined],
      ]);
    }
    // the unit cases of the pin reader and the link builder
    const dir = makeTempDir('proofline-site-');
    assert.equal(pinnedCommit(dir), null, 'no sync/pin.json gives null');
    assert.equal(licenseHref(null), `${REPO}/blob/main/LICENSE`);
    mkdirSync(join(dir, 'sync'));
    const commit = 'abcdef0123456789abcdef0123456789abcdef01';
    writeFileSync(join(dir, 'sync', 'pin.json'), JSON.stringify({ commit, tag: 'v0.0.1' }));
    assert.equal(pinnedCommit(dir), commit);
    assert.equal(licenseHref(commit), `${REPO}/blob/${commit}/LICENSE`);
    assert.equal(pinnedCommit(root), pin.commit, 'the default root is the repository');
    writeFileSync(join(dir, 'sync', 'pin.json'), JSON.stringify({ commit: 'main', tag: 'x' }));
    assert.throws(() => pinnedCommit(dir), /sync\/pin\.json/);
    writeFileSync(join(dir, 'sync', 'pin.json'), JSON.stringify({ commit: commit.toUpperCase(), tag: 'x' }));
    assert.throws(() => pinnedCommit(dir), /sync\/pin\.json/, 'only lower-case hex of 40 characters');
  });

  it('footer LICENSE link uses the main address while sync/pin.json is missing', () => {
    const empty = makeTempDir('proofline-site-');
    assert.equal(pinnedCommit(empty), null, 'no sync folder gives null');
    assert.equal(licenseHref(pinnedCommit(empty)), `${REPO}/blob/main/LICENSE`, 'no pin: the LICENSE link is on main');
    mkdirSync(join(empty, 'sync'));
    assert.equal(pinnedCommit(empty), null, 'a sync folder without pin.json gives null');
    assert.equal(licenseHref(pinnedCommit(empty)), `${REPO}/blob/main/LICENSE`);
    assert.equal(licenseHref(null), `${REPO}/blob/main/LICENSE`);
  });
});

// ---- the pin reader: every rule of pinnedCommit in src/lib/nav.ts, one named test each -----------------------------------------------------

/** A temp root whose sync/pin.json holds exactly `text`. */
function pinRoot(text) {
  const dir = makeTempDir('proofline-site-');
  mkdirSync(join(dir, 'sync'));
  writeFileSync(join(dir, 'sync', 'pin.json'), text);
  return dir;
}
const pinWith = (commit) => pinRoot(JSON.stringify({ commit, tag: 'v0.0.1' }));
const PIN_ERROR = /sync\/pin\.json/;
const HEX40 = 'abcdef0123456789abcdef0123456789abcdef01';

describe('pinnedCommit', () => {
  it('accepts a 40-character lower-case hex commit and uses it in the LICENSE link', () => {
    for (const commit of [HEX40, '0'.repeat(40), 'f'.repeat(40), '0123456789012345678901234567890123456789', 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678']) {
      assert.equal(pinnedCommit(pinWith(commit)), commit, `${commit} is accepted unchanged`);
      assert.equal(licenseHref(pinnedCommit(pinWith(commit))), `${REPO}/blob/${commit}/LICENSE`, 'the LICENSE link carries the commit');
    }
  });

  it('rejects a lower-case hex commit of 7 to 39 characters', () => {
    for (let length = 7; length <= 39; length += 1) {
      const commit = HEX40.slice(0, length);
      assert.throws(() => pinnedCommit(pinWith(commit)), PIN_ERROR, `${length} characters throw`);
    }
    assert.throws(() => pinnedCommit(pinWith('')), PIN_ERROR, 'an empty commit throws');
    assert.throws(() => pinnedCommit(pinWith('abcdef0')), PIN_ERROR, 'a 7-character short commit throws');
  });

  it('rejects a commit longer than 40 characters or with extra characters around it', () => {
    for (const commit of [`${HEX40}0`, `${HEX40}${HEX40}`, `${HEX40}\n`, ` ${HEX40}`, `${HEX40} `, `x${HEX40.slice(1)}`, `${HEX40.slice(0, 39)}-`]) {
      assert.throws(() => pinnedCommit(pinWith(commit)), PIN_ERROR, `${JSON.stringify(commit)} throws`);
    }
    assert.throws(() => pinnedCommit(pinWith(`x${HEX40}`)), PIN_ERROR, 'a leading extra character throws');
    assert.throws(() => pinnedCommit(pinWith(`${HEX40}x`)), PIN_ERROR, 'a trailing extra character throws');
  });

  it('rejects a 40-character upper-case or mixed-case hex commit', () => {
    assert.throws(() => pinnedCommit(pinWith(HEX40.toUpperCase())), PIN_ERROR, 'upper-case throws');
    assert.throws(() => pinnedCommit(pinWith(`A${HEX40.slice(1)}`)), PIN_ERROR, 'one upper-case letter at the start throws');
    assert.throws(() => pinnedCommit(pinWith(`${HEX40.slice(0, 39)}F`)), PIN_ERROR, 'one upper-case letter at the end throws');
  });

  it('rejects a 40-character commit with a non-hex character', () => {
    assert.equal(HEX40.length, 40);
    for (const bad of ['g', 'z', 'G', '-', ' ', '/', '.']) {
      assert.throws(() => pinnedCommit(pinWith(`${bad}${HEX40.slice(1)}`)), PIN_ERROR, `${JSON.stringify(bad)} at the start throws`);
      assert.throws(() => pinnedCommit(pinWith(`${HEX40.slice(0, 39)}${bad}`)), PIN_ERROR, `${JSON.stringify(bad)} at the end throws`);
    }
    assert.throws(() => pinnedCommit(pinWith('g'.repeat(40))), PIN_ERROR, 'forty g characters throw');
    assert.throws(() => pinnedCommit(pinWith('z'.repeat(40))), PIN_ERROR, 'forty z characters throw');
  });

  it('rejects the value main', () => {
    assert.throws(() => pinnedCommit(pinWith('main')), PIN_ERROR);
    assert.throws(() => pinnedCommit(pinWith('main'.repeat(10))), PIN_ERROR, 'a 40-character non-hex text throws');
  });

  it('rejects a missing or non-string commit field', () => {
    assert.throws(() => pinnedCommit(pinRoot(JSON.stringify({ tag: 'v0.0.1' }))), PIN_ERROR, 'a missing commit field throws');
    assert.throws(() => pinnedCommit(pinRoot('{}')), PIN_ERROR, 'an empty object throws');
    for (const commit of [null, 0, 1234567, 12345678901234567890, true, false, [], [HEX40], { value: HEX40 }]) {
      assert.throws(() => pinnedCommit(pinWith(commit)), PIN_ERROR, `${JSON.stringify(commit)} as the commit throws`);
    }
    for (const text of ['null', '[]', '"abc"', '12']) assert.throws(() => pinnedCommit(pinRoot(text)), PIN_ERROR, `the JSON value ${text} throws`);
  });

  it('throws on malformed JSON and never returns null for it', () => {
    for (const text of ['', '{', '{"commit":', 'not json', `{commit: "${HEX40}"}`, `{"commit": "${HEX40}",}`, `{"commit": '${HEX40}'}`]) {
      assert.throws(() => pinnedCommit(pinRoot(text)), PIN_ERROR, `${JSON.stringify(text)} throws`);
      assert.throws(() => pinnedCommit(pinRoot(text)), /not readable JSON/, 'the message says the file is not readable JSON');
    }
  });

  it('names sync/pin.json in every error', () => {
    const cases = [pinWith('main'), pinWith(HEX40.slice(0, 7)), pinWith(HEX40.toUpperCase()), pinWith('g'.repeat(40)), pinWith(7), pinRoot('{}'), pinRoot('{'), pinRoot('')];
    for (const dir of cases) {
      let error;
      try {
        pinnedCommit(dir);
      } catch (caught) {
        error = caught;
      }
      assert.ok(error instanceof Error, 'the malformed pin throws an Error');
      assert.match(error.message, PIN_ERROR, 'the message names sync/pin.json');
      assert.ok(error.message.startsWith('sync/pin.json'), 'the message starts with the file name');
    }
  });
});

describe('built pages, command block', { timeout: 120000 }, () => {
  it('command block is English and not translated', () => {
    for (const [lang, rel] of PAGES) {
      const $ = page(rel);
      const pre = $('pre#cmd');
      assert.equal(pre.length, 1);
      assert.equal(pre.attr('lang'), 'en', `${rel}: the command block is English`);
      assert.equal(pre.attr('translate'), 'no', `${rel}: the command block is not translated`);
      assert.equal(pre.text(), COMMAND.join('\n'), `${rel}: the two lines, no leading or trailing newline`);
      // The home pages keep one command block with the copy button: the first-screen block; the two step blocks are plain pre elements without an id.
      assert.equal($('main .home-hero pre#cmd').length, 1, `${rel}: the one command block is the first-screen block of the home page`);
      assert.equal($('main pre.home-call[id]').length, 0, `${rel}: the step blocks have no id`);
      assert.equal($('html').attr('lang'), lang);
      const copy = $('button#b-copy');
      assert.equal(copy.length, 1);
      assert.equal(copy.attr('type'), 'button');
      assert.equal(copy.text().trim(), lang === 'tr' ? 'Kopyala' : 'Copy');
      assert.equal(copy.attr('aria-label'), lang === 'tr' ? 'Kurulum komutlarını kopyala' : 'Copy the install commands');
      assert.equal(copy.attr('data-done'), lang === 'tr' ? 'Kopyalandı' : 'Copied');
      assert.equal(copy.attr('data-fail'), lang === 'tr' ? 'Kopyalanamadı; komut seçildi, elle kopyalayın' : 'Could not copy; the command is selected, copy it by hand');
      const live = $('#live');
      assert.equal(live.attr('role'), 'status');
      assert.equal(live.prop('tagName'), 'SPAN', 'the live region is a span');
      assert.equal(live.text(), '', 'the live region starts empty');
      assert.equal($('p').toArray().filter((p) => $(p).text().trim() === '').length, 0, 'no empty paragraph');
    }
  });
});

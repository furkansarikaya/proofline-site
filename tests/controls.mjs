// Browser checks of the header controls, the theme choice and the copy button (TASK-005): run only by `npm run test:controls`, never by `node --test`
// discovery (ADR 0009). Serves the built dist/ with scripts/serve-dist.mjs and drives the Playwright library's Chromium; build first (`npm run build`).
// No sleep: the 1800 ms reset of the copy button is moved with the Playwright clock, everything else waits on browser events.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../scripts/serve-dist.mjs';
import { removeTempDirs, sweepStale } from './temp-dirs.mjs';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
sweepStale();

// DESIGN.md colour table: --bg, --accent in the two schemes, as computed rgb colours.
const BG = { light: 'rgb(222, 218, 211)', dark: 'rgb(13, 15, 16)' };
const BG_TOKEN = { light: '#dedad3', dark: '#0d0f10' };
const ACCENT = { light: 'rgb(37, 111, 130)', dark: 'rgb(74, 163, 184)' };
const COMMAND = '/plugin marketplace add furkansarikaya/proofline\n/plugin install proofline@proofline';
const HOMES = [['en', '/'], ['tr', '/tr/']];
const NAMES = {
  en: { light: 'Theme: light. Switch to dark', dark: 'Theme: dark. Switch to light', done: 'Copied', fail: 'Could not copy; the command is selected, copy it by hand' },
  tr: { light: 'Tema: açık. Koyu temaya geç', dark: 'Tema: koyu. Açık temaya geç', done: 'Kopyalandı', fail: 'Kopyalanamadı; komut seçildi, elle kopyalayın' },
};

let site;
let browser;

before(async () => {
  site = await startServer({ root: dist });
  browser = await chromium.launch();
}, { timeout: 120000 });

after(async () => {
  try {
    await browser?.close();
    await site?.close();
  } finally {
    removeTempDirs();
  }
});

/** A page of a fresh context (so local storage never leaks between tests) that fails the test on a page error. */
async function open(options = {}, setup = async () => {}) {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1440, height: 900 }, ...options });
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await setup(page, context);
  return { page, context, errors, close: () => context.close() };
}

const go = async (page, path) => {
  const response = await page.goto(`${site.url}${path}`);
  assert.equal(response?.status(), 200, `${path} answers 200`);
};

const bgToken = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase());
const bgColor = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
// A change of the system setting reaches matchMedia listeners in the next rendering update: wait for two frames, not for a time.
const nextFrames = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
const selected = (page) => page.evaluate(() => getSelection().toString());

describe('header controls in a real browser', { timeout: 120000 }, () => {
  it('controls are at least 44 pixels with a focus ring and tab order', async () => {
    for (const width of [390, 768, 1440]) {
      for (const [lang, path] of HOMES) {
        const tab = await open({ viewport: { width, height: 900 } });
        const { page } = tab;
        await go(page, path);
        const box = async (selector) => {
          const target = page.locator(selector).first();
          assert.equal(await target.isVisible(), true, `${selector} is visible at ${width}px (${lang})`);
          return target.boundingBox();
        };
        for (const selector of ['#b-gh', '#b-lang']) {
          const b = await box(selector);
          assert.ok(b.width >= 44 && b.height >= 44, `${selector} is at least 44 by 44 at ${width}px, found ${b.width} by ${b.height}`);
        }
        const theme = await box('#b-theme');
        assert.ok(theme.width >= 88 && theme.height >= 44, `the theme button is at least 88 by 44 at ${width}px, found ${theme.width} by ${theme.height}`);
        const copy = await box('#b-copy');
        assert.ok(copy.height >= 44 && copy.width >= 44, `the copy button is at least 44 high at ${width}px, found ${copy.width} by ${copy.height}`);
        for (const b of await page.locator('header nav a').all()) {
          const m = await b.boundingBox();
          assert.ok(m.width >= 44 && m.height >= 44, `a menu link is at least 44 by 44 at ${width}px (${lang}), found ${m.width} by ${m.height}`);
        }
        // footer links are 44 high where the footer is set for touch (phone and tablet, up to 820px)
        if (width <= 820) {
          for (const b of await page.locator('footer a').all()) {
            const f = await b.boundingBox();
            assert.ok(f.height >= 44, `a footer link is at least 44 high at ${width}px (${lang}), found ${f.height}`);
          }
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `no horizontal scroll at ${width}px`);

        // keyboard: the tab order and the ring of each control
        const order = [];
        for (let i = 0; i < 12 && !order.includes('b-copy'); i += 1) {
          await page.keyboard.press('Tab');
          const state = await page.evaluate(() => {
            const el = document.activeElement;
            const css = getComputedStyle(el);
            return {
              key: el.id || (el.classList.contains('brand') ? 'brand' : el.closest('nav') ? 'menu' : el.tagName),
              style: css.outlineStyle, width: css.outlineWidth, offset: css.outlineOffset, color: css.outlineColor,
            };
          });
          order.push(state.key);
          assert.equal(state.style, 'solid', `${state.key} shows a ring when reached by keyboard`);
          assert.equal(state.width, '2px', `${state.key} ring is 2px`);
          assert.equal(state.offset, '3px', `${state.key} ring offset is 3px`);
          assert.equal(state.color, ACCENT.light, `${state.key} ring is --accent`);
        }
        assert.deepEqual(order, ['brand', 'menu', 'b-gh', 'b-lang', 'b-theme', 'b-copy'], `tab order at ${width}px (${lang})`);
        assert.deepEqual(tab.errors, []);
        await tab.close();
      }
    }
    const phone = await open({ viewport: { width: 390, height: 900 } });
    await go(phone.page, '/');
    const [brand, menu] = await Promise.all([phone.page.locator('header .brand').boundingBox(), phone.page.locator('header nav').boundingBox()]);
    const tools = await phone.page.locator('#b-theme').boundingBox();
    assert.ok(Math.abs(brand.y - tools.y) < 30, 'on a phone the brand and the tools share row 1');
    assert.ok(menu.y >= brand.y + brand.height - 1, 'on a phone the menu is on row 2');
    await phone.close();
    const dark = await open({ colorScheme: 'dark' });
    await go(dark.page, '/');
    await dark.page.keyboard.press('Tab');
    assert.equal(await dark.page.evaluate(() => getComputedStyle(document.activeElement).outlineColor), ACCENT.dark, 'the ring is the dark --accent in the dark scheme');
    await dark.close();
  });

  it('theme button sets and remembers the dark theme', async () => {
    for (const [lang, path] of HOMES) {
      const tab = await open({}, async (page) => {
        await page.addInitScript(() => {
          window.__themeAtBody = 'not seen';
          new MutationObserver((_, observer) => {
            if (!document.body) return;
            window.__themeAtBody = document.documentElement.getAttribute('data-theme');
            observer.disconnect();
          }).observe(document, { childList: true, subtree: true });
        });
      });
      const { page } = tab;
      await go(page, path);
      assert.equal(await page.evaluate(() => window.__themeAtBody), null, 'with no saved choice no attribute is set when the body appears');
      const button = page.locator('#b-theme');
      assert.equal(await button.isVisible(), true, 'the button is shown once the script ran');
      assert.equal(await button.getAttribute('aria-label'), NAMES[lang].light);
      assert.equal(await page.locator('html').getAttribute('data-theme'), null);
      await button.click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'dark');
      assert.equal(await button.getAttribute('aria-label'), NAMES[lang].dark);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'b-theme', 'focus stays on the button');
      assert.equal(await bgToken(page), BG_TOKEN.dark, 'the page shows the dark theme');
      assert.equal(await page.evaluate(() => Object.keys(localStorage).join()), 'theme', 'theme is the only key written');
      await page.reload();
      assert.equal(await page.evaluate(() => window.__themeAtBody), 'dark', 'after a reload data-theme is set before the body is parsed');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      assert.equal(await page.locator('#b-theme').getAttribute('aria-label'), NAMES[lang].dark);
      await page.locator('#b-theme').click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'a second press switches back');
      assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'light');
      assert.deepEqual(tab.errors, []);
      await tab.close();
    }
  });

  it('page follows the system theme with no saved choice', async () => {
    for (const [lang, path] of HOMES) {
      const tab = await open({ colorScheme: 'light' });
      const { page } = tab;
      await go(page, path);
      assert.equal(await bgToken(page), BG_TOKEN.light);
      assert.equal(await bgColor(page), BG.light);
      assert.equal(await page.locator('#b-theme').count(), 1, 'the page has the theme button');
      assert.equal(await page.locator('#b-theme').getAttribute('aria-label'), NAMES[lang].light);
      await page.emulateMedia({ colorScheme: 'dark' });
      await nextFrames(page);
      assert.equal(await bgToken(page), BG_TOKEN.dark, 'a later change of the system setting is followed');
      assert.equal(await bgColor(page), BG.dark);
      assert.equal(await page.locator('#b-theme').getAttribute('aria-label'), NAMES[lang].dark, 'the button name follows the system too');
      await page.emulateMedia({ colorScheme: 'light' });
      await nextFrames(page);
      assert.equal(await bgColor(page), BG.light);
      assert.equal(await page.locator('#b-theme').getAttribute('aria-label'), NAMES[lang].light);
      assert.equal(await page.evaluate(() => localStorage.length), 0, 'following the system stores nothing');
      assert.deepEqual(tab.errors, []);
      await tab.close();

      const dark = await open({ colorScheme: 'dark' });
      await go(dark.page, path);
      assert.equal(await bgColor(dark.page), BG.dark, 'a dark system opens the dark theme');
      assert.equal(await dark.page.locator('#b-theme').getAttribute('aria-label'), NAMES[lang].dark);
      await dark.close();
    }
  });
});

/**
 * The message element as a sighted visitor meets it: its box, its computed rules, whether it is clipped or hidden by the visually-hidden recipe, and the contrast of
 * its text against what is behind it. Colours are composited with their alpha channels (WCAG relative luminance from the browser's own rgba values): the
 * background is the stack of every translucent background above the element laid over white, the text is laid over that.
 */
function readMessage(page) {
  return page.evaluate(() => {
    const el = document.getElementById('live');
    const css = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const block = el.closest('.install').getBoundingClientRect();
    const parse = (c) => { const n = c.match(/[\d.]+/g).map(Number); return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 }; };
    const over = (base, c) => base.map((v, k) => c.rgb[k] * c.a + v * (1 - c.a));
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.a > 0) layers.push(c);
      if (c.a === 1) break;
    }
    let bg = [255, 255, 255];
    for (const layer of layers.reverse()) bg = over(bg, layer);
    const text = over(bg, parse(css.color));
    const lum = (rgb) => rgb.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((a, v, k) => a + v * [0.2126, 0.7152, 0.0722][k], 0);
    const a = lum(text);
    const b = lum(bg);
    return {
      text: el.textContent, className: el.className, width: rect.width, height: rect.height, clip: css.clip, overflow: css.overflow, position: css.position,
      visibility: css.visibility, display: css.display, opacity: css.opacity, fontSize: css.fontSize, lineHeight: css.lineHeight, color: css.color,
      padding: [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft].join(' '),
      borderTop: [css.borderTopWidth, css.borderTopStyle, css.borderTopColor].join(' '),
      inside: rect.left >= block.left - 0.5 && rect.right <= block.right + 0.5 && rect.top >= block.top - 0.5 && rect.bottom <= block.bottom + 0.5,
      contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    };
  });
}

// DESIGN.md colour table: --ink and --rule in the two schemes, as the browser computes them.
const INK = { light: 'rgb(10, 10, 10)', dark: 'rgb(232, 228, 220)' };
const RULE = { light: 'rgba(10, 10, 10, 0.3)', dark: 'rgba(232, 228, 220, 0.26)' };

/** Every rule of the .msg unit in the refused state, one assertion each, so a change to any one of them names itself. */
function assertMessageShown(m, label, scheme) {
  assert.equal(m.className, 'msg', `${label}: the refused state puts the msg class on the live region`);
  assert.equal(m.display, 'block', `${label}: .msg display is block`);
  assert.equal(m.padding, '10px 14px 10px 14px', `${label}: .msg padding is 10px 14px`);
  assert.equal(m.borderTop, `1px solid ${RULE[scheme]}`, `${label}: .msg border-top is 1px solid --rule`);
  assert.equal(m.lineHeight, '21px', `${label}: .msg line-height is 1.5 of 14px`);
  assert.equal(m.fontSize, '14px', `${label}: .msg font-size is 14px`);
  assert.equal(m.color, INK[scheme], `${label}: .msg text colour is --ink, opaque`);
  assert.ok(m.contrast >= 4.5, `${label}: the message contrast with alpha is at least 4.5, found ${m.contrast.toFixed(2)}`);
  assert.ok(m.width >= 100 && m.height >= 14, `${label}: the message has a real box, found ${m.width} by ${m.height}`);
  assert.equal(m.clip, 'auto', `${label}: the message is not clipped`);
  assert.equal(m.visibility, 'visible', `${label}: the message is not hidden`);
  assert.equal(m.opacity, '1', `${label}: the message is opaque`);
  assert.notEqual(m.position, 'absolute', `${label}: the message is not taken out of the flow like the screen-reader-only text`);
  assert.ok(m.inside, `${label}: the message sits inside the command block`);
}

function assertMessageHidden(m, label) {
  assert.equal(m.className, 'sr', `${label}: the live region carries the sr class`);
  assert.ok(m.clip !== 'auto' && m.width <= 1 && m.height <= 1, `${label}: the message is visually hidden (found clip ${m.clip}, ${m.width} by ${m.height})`);
}

describe('copy button and blocked script in a real browser', { timeout: 120000 }, () => {
  it('pages work with the controls script blocked', async () => {
    for (const scheme of ['light', 'dark']) {
      for (const [lang, path] of HOMES) {
        let blocked = 0;
        const tab = await open({ colorScheme: scheme }, async (_page, context) => {
          await context.route('**/assets/controls.js', (route) => { blocked += 1; return route.abort(); });
        });
        const { page } = tab;
        await go(page, path);
        assert.equal(blocked, 1, 'the script request was blocked');
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('js')), false, 'the js class is not set');
        assert.equal(await bgColor(page), BG[scheme], `${path} follows the ${scheme} system theme`);
        assert.equal(await page.locator('#b-theme').isVisible(), false, 'the theme button is hidden');
        assert.equal(await page.locator('#b-copy').isVisible(), false, 'the copy button is hidden');
        for (const selector of ['#b-gh', '#b-lang', 'header nav a', 'header .brand']) assert.equal(await page.locator(selector).first().isVisible(), true, `${selector} stays visible`);
        await page.locator('#cmd').selectText();
        assert.equal((await selected(page)).trim(), COMMAND, 'the command can be selected by hand');
        assert.notEqual(await page.evaluate(() => getComputedStyle(document.querySelector('#cmd')).userSelect), 'none', 'the command is not made unselectable');
        // the language link and a menu link navigate
        await page.locator('#b-lang').click();
        await page.waitForURL(`${site.url}${lang === 'en' ? '/tr/' : '/'}`);
        assert.equal(await page.locator('html').getAttribute('lang'), lang === 'en' ? 'tr' : 'en');
        await page.locator('header nav a').first().click();
        await page.waitForURL(`${site.url}${lang === 'en' ? '/tr/' : '/'}`);
        assert.equal(await bgColor(page), BG[scheme], 'the system theme holds after navigation');
        assert.deepEqual(tab.errors, []);
        await tab.close();
      }
    }
  });

  it('copy button copies and reports both outcomes', async () => {
    for (const [lang, path] of HOMES) {
      const granted = await open({ permissions: ['clipboard-read', 'clipboard-write'] }, async (page) => { await page.clock.install(); });
      const { page } = granted;
      await go(page, path);
      const copy = page.locator('#b-copy');
      assert.equal(await copy.isVisible(), true);
      assert.equal(await page.locator('#live').textContent(), '');
      await copy.click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), COMMAND, 'the clipboard holds the two lines as shown');
      assert.equal(await page.locator('#live').textContent(), NAMES[lang].done, 'the polite region says it');
      assert.equal(await page.locator('#live').getAttribute('role'), 'status');
      assert.equal(await copy.evaluate((el) => el.classList.contains('done')), true, 'the button shows the done state');
      assert.match(await copy.evaluate((el) => getComputedStyle(el, '::after').content), /✓/, 'the done state shows a check mark');
      await page.clock.fastForward(1999);
      assert.equal(await copy.evaluate((el) => el.classList.contains('done')), false, 'the button returns in under 2 seconds');
      assert.equal(await page.locator('#live').textContent(), '', 'the message is cleared');
      assert.equal(await copy.textContent(), lang === 'tr' ? 'Kopyala' : 'Copy');
      assert.deepEqual(granted.errors, []);
      await granted.close();

      const refused = await open({}, async (page2) => {
        await page2.clock.install();
        await page2.addInitScript(() => {
          Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new DOMException('refused', 'NotAllowedError')) });
        });
      });
      await go(refused.page, path);
      await refused.page.locator('#b-copy').click();
      assert.equal(await refused.page.locator('#live').textContent(), NAMES[lang].fail, 'the region says the write was refused');
      assert.equal((await selected(refused.page)).trim(), COMMAND, 'the command is selected');
      assert.equal(await refused.page.locator('#b-copy').evaluate((el) => el.classList.contains('done')), false, 'no check mark on a refusal');
      assert.equal(await refused.page.locator('#b-copy').evaluate((el) => getComputedStyle(el, '::after').content), 'none');
      await refused.page.clock.fastForward(1999);
      assert.equal(await refused.page.locator('#live').textContent(), '', 'the message is cleared after the reset');
      assert.deepEqual(refused.errors, []);
      await refused.close();
    }
  });

  // One test per scheme, width and language (about 400 ms each, under the 2000 ms unit budget); the first holds the refused state, the second the copied one.
  for (const scheme of ['light', 'dark']) {
    for (const width of [390, 1440]) {
      for (const [lang, path] of HOMES) {
        const label = `${path} at ${width}px in ${scheme}`;

        // The representative case (English page, 390 px, light, refused state) keeps the original test name with no suffix, so the measured duration of that name is replaced by a current reading.
        const representative = lang === 'en' && width === 390 && scheme === 'light';
        const refusedTitle = representative ? 'refused write shows the message to a sighted visitor' : `refused write shows the message to a sighted visitor: refused state on ${label}`;

        it(refusedTitle, async () => {
          const refused = await open({ colorScheme: scheme, viewport: { width, height: 900 } }, async (page) => {
            await page.clock.install();
            await page.addInitScript(() => {
              Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new DOMException('refused', 'NotAllowedError')) });
            });
          });
          const { page } = refused;
          await go(page, path);
          assertMessageHidden(await readMessage(page), `${label}, default state`);
          await page.locator('#b-copy').click();
          await page.waitForFunction(() => document.getElementById('live').textContent !== '');
          const shown = await readMessage(page);
          assert.equal(shown.text, NAMES[lang].fail, `${label}: the visible message is the AC-14 wording`);
          assertMessageShown(shown, `${label}, refused state`, scheme);
          assert.equal(await page.locator('#live').getAttribute('role'), 'status', 'the polite live region keeps announcing it');
          assert.equal(await page.locator('#live').getAttribute('aria-hidden'), null, 'the live region is not hidden from screen readers');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, `${label}: no horizontal scroll with the message`);
          assert.equal((await selected(page)).trim(), COMMAND, `${label}: the command stays selected`);
          const copy = await page.locator('#b-copy').boundingBox();
          assert.ok(copy.height >= 44, `${label}: the copy button stays at least 44 high`);
          await page.clock.fastForward(1999);
          const after = await readMessage(page);
          assert.equal(after.text, '', `${label}: the message text is cleared after the reset`);
          assertMessageHidden(after, `${label}, after the reset`);
          assert.deepEqual(refused.errors, []);
          await refused.close();
        });

        it(`refused write shows the message to a sighted visitor: copied state keeps it hidden on ${label}`, async () => {
          const granted = await open({ colorScheme: scheme, viewport: { width, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }, async (page) => { await page.clock.install(); });
          await go(granted.page, path);
          await granted.page.locator('#b-copy').click();
          await granted.page.waitForFunction(() => document.getElementById('live').textContent !== '');
          const done = await readMessage(granted.page);
          assert.equal(done.text, NAMES[lang].done, `${label}: the copied wording`);
          assertMessageHidden(done, `${label}, copied state`);
          await granted.page.clock.fastForward(1999);
          assertMessageHidden(await readMessage(granted.page), `${label}, copied state after the reset`);
          assert.deepEqual(granted.errors, []);
          await granted.close();
        });
      }
    }
  }
});

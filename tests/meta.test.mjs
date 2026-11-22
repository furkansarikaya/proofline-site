// Node tests for the page head builders of TASK-004 (src/lib/meta.ts): titles, descriptions and the JSON-LD block.
// Pure functions only: no build and no file system. Warnings are recorded through the callback, never read from stderr.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME, NAME, PHRASE, brand, buildDescription, buildHead, buildTitle, charCount, websiteJsonLd,
} from '../src/lib/meta.ts';

const EN_BRAND = 'proofline: a deterministic engineering team for Claude Code and Codex';
const TR_BRAND = 'proofline: Claude Code ve Codex için deterministik bir mühendislik ekibi';

/** A lead of exactly `n` characters made of whole words, ending in a letter. */
function leadOf(n) {
  const words = ['steady', 'proof', 'before', 'merge', 'every', 'change', 'carries', 'its', 'own', 'evidence'];
  let text = '';
  for (let i = 0; text.length < n; i++) text += (i === 0 ? '' : ' ') + words[i % words.length];
  text = text.slice(0, n);
  return text.endsWith(' ') ? `${text.slice(0, -1)}x` : text;
}

/** A recorder for the warn callback. */
function recorder() {
  const calls = [];
  return { calls, warn: (message) => calls.push(message) };
}

describe('title builder', () => {
  it('buildTitle joins page title, name and phrase in both languages', () => {
    assert.equal(brand('en'), EN_BRAND);
    assert.equal(brand('tr'), TR_BRAND);
    assert.equal(buildTitle('/get-started/', 'en', { kind: 'site', text: 'Get started' }), `Get started | ${EN_BRAND}`);
    assert.equal(buildTitle('/tr/baslarken/', 'tr', { kind: 'site', text: 'Başlarken' }), `Başlarken | ${TR_BRAND}`);
  });

  it('buildTitle rejects a 41-character site title and accepts 40', () => {
    const ok = 'a'.repeat(40);
    assert.equal(buildTitle('/forty/', 'en', { kind: 'site', text: ok }), `${ok} | ${EN_BRAND}`);
    const long = 'a'.repeat(41);
    assert.throws(() => buildTitle('/forty-one/', 'en', { kind: 'site', text: long }), (error) => {
      assert.match(error.message, /\/forty-one\//, 'the message names the page');
      assert.match(error.message, /41/, 'the message names the length');
      return true;
    });
    // The cap counts characters, not UTF-16 units: forty emoji pass, forty-one fail.
    assert.equal(charCount('😀'.repeat(40)), 40);
    assert.doesNotThrow(() => buildTitle('/emoji/', 'en', { kind: 'site', text: '😀'.repeat(40) }));
    assert.throws(() => buildTitle('/emoji/', 'en', { kind: 'site', text: '😀'.repeat(41) }), /\/emoji\//);
    assert.throws(() => buildTitle('/empty/', 'en', { kind: 'site', text: '   ' }), /\/empty\//);
  });

  it('home title is the name and phrase only', () => {
    assert.equal(buildTitle(HOME.en, 'en', { kind: 'home' }), EN_BRAND);
    assert.equal(buildTitle(HOME.tr, 'tr', { kind: 'home' }), TR_BRAND);
    assert.throws(() => buildTitle('/other/', 'en', { kind: 'home' }), /\/other\//);
    assert.throws(() => buildTitle(HOME.en, 'en', { kind: 'site', text: 'Home' }), /\//);
    const outputs = [
      buildTitle(HOME.en, 'en', { kind: 'home' }),
      buildTitle(HOME.tr, 'tr', { kind: 'home' }),
      buildTitle('/a/', 'en', { kind: 'site', text: 'A' }),
      buildTitle('/tr/a/', 'tr', { kind: 'site', text: 'A' }),
      buildTitle('/b/', 'en', { kind: 'synced', h1: 'Ship it' }),
      buildTitle('/tr/b/', 'tr', { kind: 'synced', h1: 'Gönder' }),
    ];
    for (const title of outputs) {
      assert.ok(!title.endsWith(NAME), `${title} does not end with the name alone`);
      const lang = title.endsWith(PHRASE.tr) ? 'tr' : 'en';
      assert.ok(title.endsWith(PHRASE[lang]), `${title} ends with the phrase of its language`);
    }
  });

  it('synced titles keep the full H1 and warn only above 120', () => {
    const h1 = 'x'.repeat(48);
    const kept = recorder();
    assert.equal(buildTitle('/synced/', 'en', { kind: 'synced', h1 }, kept.warn), `${h1} | ${EN_BRAND}`);
    assert.equal(charCount(`${h1} | ${EN_BRAND}`), 120);
    assert.deepEqual(kept.calls, [], 'exactly 120 characters prints no warning');

    const tr = recorder();
    assert.equal(buildTitle('/tr/synced/', 'tr', { kind: 'synced', h1 }, tr.warn), `${h1} | ${TR_BRAND}`);
    assert.equal(tr.calls.length, 1, 'the Turkish suffix is longer, so 123 characters warn once');

    const over = recorder();
    const long = 'y'.repeat(49);
    assert.equal(buildTitle('/synced-121/', 'en', { kind: 'synced', h1: long }, over.warn), `${long} | ${EN_BRAND}`, 'the H1 is never cut');
    assert.equal(over.calls.length, 1);
    assert.match(over.calls[0], /\/synced-121\//);
    assert.match(over.calls[0], /121/);
    assert.throws(() => buildTitle('/blank/', 'en', { kind: 'synced', h1: ' ' }), /\/blank\//);
  });
});

describe('description builder', () => {
  it('buildDescription stays within 70 to 160 for six leads', () => {
    for (const lang of ['en', 'tr']) {
      const suffix = ` ${brand(lang)}.`;
      for (const n of [20, 120, 400]) {
        const lead = leadOf(n);
        assert.equal(lead.length, n);
        const description = buildDescription('/page/', lang, lead);
        const length = charCount(description);
        assert.ok(length >= 70 && length <= 160, `${lang} ${n}: ${length} characters`);
        assert.ok(description.endsWith(suffix), `${lang} ${n}: ends with the name, phrase and a full stop`);
        const part = description.slice(0, -suffix.length);
        if (n === 20) {
          assert.equal(part, lead, 'a short lead is used whole with no ellipsis');
          assert.ok(!description.includes('…'));
        } else {
          assert.ok(part.endsWith('…'), `${lang} ${n}: a cut lead ends with the ellipsis`);
          const kept = part.slice(0, -1);
          assert.ok(lead.startsWith(kept), 'the kept text is the start of the lead');
          assert.equal(lead[kept.length], ' ', 'the cut sits on a word boundary');
          assert.ok(!kept.endsWith(' '), 'no space before the ellipsis');
        }
      }
    }
  });

  it('buildDescription keeps a lead whole at the room limit and cuts one character above', () => {
    const room = { en: 89, tr: 86 };
    for (const lang of ['en', 'tr']) {
      const exact = leadOf(room[lang]);
      const whole = buildDescription('/p/', lang, exact);
      assert.equal(charCount(whole), 160);
      assert.ok(!whole.includes('…'));
      const above = buildDescription('/p/', lang, leadOf(room[lang] + 1));
      assert.ok(above.includes('…'));
      assert.ok(charCount(above) <= 160);
    }
  });

  it('buildDescription collapses white space, keeps a hard cut for one long word and rejects an empty lead', () => {
    assert.ok(buildDescription('/p/', 'en', '  a   b\n\tc  ').startsWith('a b c proofline'));
    const word = buildDescription('/p/', 'en', 'z'.repeat(300));
    assert.ok(word.startsWith('z'.repeat(88) + '…'));
    assert.equal(charCount(word), 160);
    assert.throws(() => buildDescription('/empty/', 'en', ' \n '), /\/empty\//);
  });
});

describe('json-ld and head', () => {
  it('websiteJsonLd names the brand of the page language', () => {
    for (const [lang, path, expected] of [['en', '/', EN_BRAND], ['tr', '/tr/', TR_BRAND]]) {
      const text = websiteJsonLd(path, lang);
      assert.ok(text.startsWith('{') && text.endsWith('}'), `a JSON object for ${path}, got "${text}"`);
      const parsed = JSON.parse(text);
      assert.equal(parsed['@context'], 'https://schema.org');
      assert.equal(parsed['@type'], 'WebSite');
      assert.equal(parsed.name, expected);
      assert.equal(parsed.url, `https://proofline.technology${path}`);
      assert.deepEqual(Object.keys(parsed), ['@context', '@type', 'name', 'url'], 'fixed key order');
    }
  });

  it('websiteJsonLd escapes every less-than sign so the block cannot close its script element', () => {
    const text = websiteJsonLd('/<x>/', 'en');
    assert.ok(text.startsWith('{') && text.endsWith('}'), `a JSON object, got "${text}"`);
    assert.ok(!text.includes('<'));
    assert.equal(JSON.parse(text).url, 'https://proofline.technology/<x>/');
  });

  it('buildHead carries the one title, description, image and a block on the home pages only', () => {
    const home = buildHead({ page: '/', lang: 'en', title: { kind: 'home' }, lead: 'A short lead for the home page.' });
    assert.equal(home.title, EN_BRAND);
    assert.equal(home.ogImage, 'https://proofline.technology/og-default.png');
    assert.equal(home.ogImageAlt, EN_BRAND);
    assert.equal(JSON.parse(home.jsonLd).name, EN_BRAND);
    const inner = buildHead({ page: '/tr/x/', lang: 'tr', title: { kind: 'site', text: 'Başlarken' }, lead: 'Kısa bir giriş.' });
    assert.equal(inner.title, `Başlarken | ${TR_BRAND}`);
    assert.equal(inner.ogImageAlt, TR_BRAND);
    assert.equal(inner.jsonLd, null);
    assert.ok(inner.description.endsWith(` ${TR_BRAND}.`));
  });
});

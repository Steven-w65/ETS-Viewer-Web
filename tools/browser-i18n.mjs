import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { zipSync, strToU8 } from 'fflate';
import { silentMp3 } from './media-fixtures.mjs';

const engine = process.env.ETS_BROWSER_ENGINE || 'chromium';
const base = process.env.ETS_BASE_URL || 'http://127.0.0.1:4192';
const root = '.qa/i18n-browser';
let browser,
  server,
  checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
const pack = async (name) => JSON.parse(await readFile(`src/i18n/resources/${name}.json`, 'utf8'));
const en = {
  ...(await pack('en')),
  ...(await pack('app.en')),
  ...(await pack('reading.en')),
  ...(await pack('importing.en')),
};
const zh = {
  ...(await pack('zh-CN')),
  ...(await pack('app.zh-CN')),
  ...(await pack('reading.zh-CN')),
  ...(await pack('importing.zh-CN')),
};
const languages = async (page, values) => {
  await page.evaluate((values) => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: values });
    window.dispatchEvent(new Event('languagechange'));
  }, values);
};
const htmlLanguage = async (page, value) =>
  page.waitForFunction((value) => document.documentElement.lang === value, value);
async function contextFor(values, preference, stale, blocked = false) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: values[0] || 'en-US',
  });
  await context.addInitScript(
    ({ values, preference, stale, blocked }) => {
      Object.defineProperty(navigator, 'languages', { configurable: true, value: values });
      if (preference) localStorage.setItem('ets-language', preference);
      if (stale) localStorage.setItem('i18nextLng', stale);
      if (blocked) {
        Storage.prototype.getItem = () => {
          throw new Error('Storage blocked');
        };
        Storage.prototype.setItem = () => {
          throw new Error('Storage blocked');
        };
      }
    },
    { values, preference, stale, blocked },
  );
  return context;
}
try {
  await mkdir(root, { recursive: true });
  const long = 'Original stored answer 中文 & English. '.repeat(220);
  const docs = [
    {
      structure_type: 'collector.choose',
      info: {
        stid: '原始-group',
        audio: 'clip.mp3',
        st_nr: 'Original shared transcript',
        xtlist: [
          { xt_xh: '23', xt_nr: 'Original prompt α', xt_pic: '缺失 图.png', answer: 'B' },
          { xt_xh: '25', xt_nr: 'Original prompt β', answer: 'AC' },
        ],
      },
    },
    {
      structure_type: 'collector.word',
      info: { stid: 'word-one', xh: '100', value: 'Original word task' },
    },
    {
      structure_type: 'collector.word',
      info: { stid: 'word-two', xh: '200', value: 'Original next word task' },
    },
    {
      structure_type: 'collector.dialogue',
      info: {
        stid: 'dialogue',
        question: [
          {
            xh: '51',
            ask: 'Original dialogue prompt',
            std: [{ value: long }, { value: 'HIDDEN ALTERNATIVE' }],
          },
          {
            xh: '55',
            ask: 'Original empty task',
            std: [{ value: '' }, { value: 'DO NOT PROMOTE' }],
          },
        ],
      },
    },
  ];
  const records = Object.fromEntries(
    docs.map((doc, i) => [
      `题库/原始试卷/content_${i + 1}/content.json`,
      strToU8(JSON.stringify(doc)),
    ]),
  );
  records['题库/原始试卷/content_1/material/clip.mp3'] = silentMp3();
  const zip = `${root}/bank.zip`;
  await writeFile(zip, zipSync(records));
  if (!process.env.ETS_BASE_URL) {
    server = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4192',
        '--strictPort',
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  browser = await (engine === 'webkit' ? webkit : chromium).launch({
    headless: true,
    ...(engine === 'chromium' && process.platform === 'win32' ? { channel: 'msedge' } : {}),
  });
  const context = await contextFor(['en-US']);
  if (engine === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.addInitScript(() => {
    globalThis.i18nStats = { created: 0, revoked: 0, pauses: 0, workers: 0 };
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL),
      pause = HTMLMediaElement.prototype.pause,
      WorkerClass = Worker;
    URL.createObjectURL = (...args) => {
      globalThis.i18nStats.created++;
      return create(...args);
    };
    URL.revokeObjectURL = (...args) => {
      globalThis.i18nStats.revoked++;
      return revoke(...args);
    };
    HTMLMediaElement.prototype.pause = function (...args) {
      globalThis.i18nStats.pauses++;
      return pause.apply(this, args);
    };
    window.Worker = class extends WorkerClass {
      constructor(...args) {
        super(...args);
        globalThis.i18nStats.workers++;
      }
    };
  });
  const page = await context.newPage(),
    errors = [],
    remote = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
      remote.push(request.url());
  });
  await page.goto(base);
  await htmlLanguage(page, 'en');
  await page.locator('.settings-button').click();
  const selector = page.locator('.language-setting select');
  check(
    (await selector
      .locator('option')
      .evaluateAll((options) => options.map((option) => option.value).join('|'))) ===
      'auto|en|zh-CN',
    'Selector is generated from exactly the registered locales plus Auto',
  );
  check((await selector.inputValue()) === 'auto', 'First visit defaults to Auto');
  await page.getByRole('radio', { name: en['settings.theme.dark'], exact: true }).check();
  await selector.selectOption('zh-CN');
  await htmlLanguage(page, 'zh-CN');
  check(
    (await page.locator('.settings-button').getAttribute('aria-expanded')) === 'true',
    'Settings stays open during manual switching',
  );
  check(
    (await page.locator('.settings-button').innerText()) === zh['settings.title'],
    'Settings text switches immediately',
  );
  check(
    (await page.locator('.welcome-description').innerText()) === zh['welcome.description'],
    'Welcome description is localized',
  );
  check(
    (await page.locator('html').getAttribute('data-theme')) === 'dark',
    'Language does not reset theme',
  );
  check(
    (await page.evaluate(() => localStorage.getItem('ets-language'))) === 'zh-CN',
    'Manual preference is stored once',
  );
  await page.getByRole('button', { name: zh['folderGuide.title'], exact: true }).click();
  await page.getByRole('tab', { name: 'Android', exact: true }).click();
  const android =
    '/storage/emulated/0/Android/data/com.ets100.secondary/files/Download/ETS_SECONDARY/resource';
  check(
    (await page.locator('.folder-guide-path code').innerText()) === android,
    'Android path is exact in Chinese',
  );
  if (engine === 'chromium') {
    await page.locator('.folder-guide-copy').click();
    await page.waitForFunction(() =>
      navigator.clipboard.readText().then((text) => text.endsWith('ETS_SECONDARY/resource')),
    );
    check(
      (await page.evaluate(() => navigator.clipboard.readText())) === android,
      'Native clipboard copies the original Android path',
    );
  }
  await page.locator('.settings-button').click();
  await selector.selectOption('en');
  await htmlLanguage(page, 'en');
  check(
    (await page.locator('.folder-guide-toggle').getAttribute('aria-expanded')) === 'true',
    'Folder guide remains expanded through language changes',
  );
  check(
    (await page
      .getByRole('tab', { name: 'Android', exact: true })
      .getAttribute('aria-selected')) === 'true',
    'Platform selection remains unchanged',
  );
  await page.getByRole('button', { name: en['settings.title'], exact: true }).click();
  await page.locator('input[accept*="zip"]').setInputFiles(zip);
  await page.locator('.paper-row').first().waitFor();
  check(
    (await page.locator('.stats strong').allTextContents()).join('|') === '1|4|6',
    'Statistics retain real values',
  );
  await page.locator('.paper-row').first().click();
  await page.locator('.part-section .collapse-toggle').first().click();
  await page.locator('.shared-material .collapse-toggle').click();
  const reader = await page.locator('.reader').elementHandle();
  const card = await page.locator('.part-section .collapse-toggle').first().elementHandle();
  let audio;
  if (engine === 'chromium') {
    audio = await page.locator('.shared-material audio').elementHandle();
    await audio.evaluate(async (node) => {
      await node.play();
    });
  }
  await page.locator('.settings-button').click();
  await selector.selectOption('auto');
  await page.locator('.settings-button').click();
  await page.locator('.preview-button').click();
  const dialog = page.locator('.answer-preview-dialog');
  await dialog.waitFor();
  const modal = await dialog.elementHandle(),
    close = await dialog.locator('button').elementHandle();
  const before = await page.evaluate(() => ({ ...globalThis.i18nStats }));
  check(
    (await dialog.locator('h3').allTextContents()).join('|') ===
      'Multiple Choice · 1–2|Word / Sentence · 1|Word / Sentence · 1|Dialogue · 1–2',
    'English preview local numbering resets for repeated groups',
  );
  await languages(page, ['ja-JP', 'zh-CN', 'en-US']);
  await htmlLanguage(page, 'zh-CN');
  await page.getByRole('dialog', { name: zh['preview.title'], exact: true }).waitFor();
  check(
    await modal.evaluate(
      (node) => node === document.querySelector('.answer-preview-dialog') && node.open,
    ),
    'Auto language event preserves the open dialog node',
  );
  check(
    await close.evaluate((node) => node === document.activeElement),
    'Dialog focus stays on the same Close button',
  );
  check(
    (await dialog.locator('h3').allTextContents()).join('|') ===
      '选择题 · 1–2|单词／句子 · 1|单词／句子 · 1|对话 · 1–2',
    'Chinese preview retains identical local group ranges',
  );
  check(
    (await dialog.locator('.preview-number').allTextContents()).join('|') === '1.|2.|1.|1.|1.|2.',
    'Question numbering is unaffected by locale',
  );
  check(
    (await dialog.innerText()).includes(long.trim()) &&
      !(await dialog.innerText()).includes('HIDDEN ALTERNATIVE') &&
      !(await dialog.innerText()).includes('DO NOT PROMOTE'),
    'Source answers stay original and first-only',
  );
  check(
    (await dialog.locator('.preview-choice-box').allTextContents()).join('|') === 'B|AC',
    'Choice boxes contain only original options',
  );
  check(
    JSON.stringify(before) === JSON.stringify(await page.evaluate(() => globalThis.i18nStats)),
    'Language switch creates no media URLs, pauses or new import workers',
  );
  if (audio)
    check(
      await audio.evaluate(
        (node) =>
          node.isConnected &&
          !node.paused &&
          node === document.querySelector('.shared-material audio'),
      ),
      'Playing audio retains its node and continues across language changes',
    );
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  check(
    await reader.evaluate((node) => node === document.querySelector('.reader')),
    'Reader node is preserved',
  );
  check(
    (await card.getAttribute('aria-expanded')) === 'true',
    'Question card expansion is preserved',
  );
  check(
    (await page.locator('.reading-header h1').innerText()).includes('原始-group'),
    'Imported group identifier remains verbatim',
  );
  await page.locator('.warnings-button').click();
  const warning = page.locator('.warning-dialog'),
    warningNode = await warning.elementHandle();
  await page.getByRole('dialog', { name: zh['warnings.title'], exact: true }).waitFor();
  check(
    await warning.getByText('缺失 图.png', { exact: true }).isVisible(),
    'Missing filename remains exact in localized warnings',
  );
  const source = await warning
    .locator('dd code')
    .filter({ hasText: 'content.json' })
    .first()
    .textContent();
  await languages(page, ['en-GB']);
  await htmlLanguage(page, 'en');
  check(
    await warningNode.evaluate(
      (node) => node.open && node === document.querySelector('.warning-dialog'),
    ),
    'Warning dialog stays open on locale changes',
  );
  check(
    (await warning.locator('dd code').filter({ hasText: 'content.json' }).first().textContent()) ===
      source,
    'Source JSON path is not translated',
  );
  await page.keyboard.press('Escape');
  await warning.waitFor({ state: 'hidden' });
  const downloadEn = page.waitForEvent('download');
  await page.locator('.paper-actions .export-button').last().click();
  const bytesEn = await readFile(await (await downloadEn).path());
  await languages(page, ['zh-CN']);
  await htmlLanguage(page, 'zh-CN');
  const downloadZh = page.waitForEvent('download');
  await page.locator('.paper-actions .export-button').last().click();
  const bytesZh = await readFile(await (await downloadZh).path());
  check(bytesEn.equals(bytesZh), 'Export bytes are independent of UI language');
  check(
    bytesZh.toString('utf8').includes('Question: 原始-group/23') &&
      bytesZh.toString('utf8').includes('Question: 原始-group/25'),
    'Export retains original question numbers',
  );
  check(
    (await page.evaluate(() => localStorage.getItem('ets-language'))) === 'auto',
    'Auto remains stored as Auto after resolved language changes',
  );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    if (!(await page.locator('.preview-button').isVisible()))
      await page.locator('.question-row.selected').click();
    const rects = await page.locator('.paper-actions button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const r = button.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    check(
      rects[0].x + rects[0].w <= rects[1].x &&
        rects[0].y === rects[1].y &&
        rects[0].h === rects[1].h,
      `${width}px: Preview stays left of Export at equal height`,
    );
    await page.locator('.settings-button').click();
    check(
      await page.locator('.settings-menu').evaluate((node) => node.scrollWidth <= node.clientWidth),
      `${width}px: translated Settings fits its container`,
    );
    await page.locator('.settings-button').click();
    await page.locator('.preview-button').click();
    await dialog.waitFor();
    check(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
      `${width}px: translated preview has no horizontal overflow`,
    );
    await page.screenshot({ path: `${root}/${width}-${engine}.png`, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}px: no page overflow`,
    );
  }
  await page.locator('.settings-button').click();
  await selector.selectOption('zh-CN');
  await page.reload();
  await htmlLanguage(page, 'zh-CN');
  check(
    (await page.locator('.welcome-description').innerText()) === zh['welcome.description'],
    'Manual language survives reload',
  );
  check(
    (await page.locator('.paper-row').count()) === 0,
    'Question bank is not persisted on reload',
  );
  check(
    await page.evaluate(() =>
      Object.keys(localStorage).every((key) => ['ets-language', 'ets-appearance'].includes(key)),
    ),
    'Only harmless UI preferences are stored',
  );
  check(remote.length === 0, 'No external translation/content requests');
  check(errors.length === 0, 'No application errors: ' + errors.join(';'));
  await context.close();
  const probes = [
    { languages: ['ja-JP', 'fr-FR', 'en-US'], expected: 'en' },
    { languages: ['ja-JP', 'zh-CN', 'en-US'], expected: 'zh-CN' },
    { languages: ['zh-TW', 'en-US'], expected: 'en' },
    { languages: ['zh-Hant', 'en-US'], expected: 'en' },
    { languages: ['zh-SG', 'en-US'], expected: 'zh-CN' },
    { languages: ['zh-CN'], preference: 'en', expected: 'en' },
    { languages: ['en-US'], preference: 'zh-CN', expected: 'zh-CN' },
    { languages: ['zh-CN'], preference: 'fr', expected: 'zh-CN' },
    { languages: ['en-US'], stale: 'zh-CN', expected: 'en' },
  ];
  for (const probe of probes) {
    const context = await contextFor(probe.languages, probe.preference, probe.stale);
    const page = await context.newPage();
    await page.goto(base);
    await htmlLanguage(page, probe.expected);
    check(
      (await page.locator('html').getAttribute('lang')) === probe.expected,
      `Negotiation: ${JSON.stringify(probe)}`,
    );
    await context.close();
  }
  const blocked = await contextFor(['en-US'], undefined, undefined, true),
    blockedPage = await blocked.newPage();
  await blockedPage.goto(base);
  await blockedPage.locator('.settings-button').click();
  await blockedPage.locator('.language-setting select').selectOption('zh-CN');
  await htmlLanguage(blockedPage, 'zh-CN');
  check(
    (await blockedPage.locator('.language-setting select').inputValue()) === 'zh-CN',
    'Blocked storage still supports manual switching in memory',
  );
  await blocked.close();
  console.log(
    JSON.stringify(
      { engine, version: browser.version(), checks, realDevices: 'not tested', screenshots: root },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server?.kill();
}

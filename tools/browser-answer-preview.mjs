import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium, webkit } from 'playwright';
import { strToU8, zipSync } from 'fflate';
import { silentMp3 } from './media-fixtures.mjs';

const root = '.qa/answer-preview',
  base = process.env.ETS_BASE_URL || 'http://127.0.0.1:4185';
const engine = process.env.ETS_BROWSER_ENGINE || 'chromium';
let server,
  browser,
  checks = 0,
  downloads = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
try {
  await mkdir(root, { recursive: true });
  const long = '中文 reference answer & special characters. '.repeat(180);
  const documents = [
    {
      structure_type: 'collector.choose',
      info: {
        stid: 'one',
        audio: 'clip.mp3',
        xtlist: Array.from({ length: 12 }, (_, i) => ({
          xt_xh: String(i + 1),
          xt_nr: 'Hidden choice prompt',
          answer: i === 4 ? '' : ['B', 'C', 'AC', 'A,B', '', 'NONSTANDARD'.repeat(20)][i] || 'A',
          xxlist: [{ xx_mc: 'A', xx_nr: 'Hidden option' }],
        })),
      },
    },
    {
      structure_type: 'collector.word',
      info: { stid: 'two', xh: '13', value: 'Hidden word prompt' },
    },
    {
      structure_type: 'collector.fill',
      info: {
        stid: 'three',
        std: [
          { th: '14', value: 'First blank' },
          { th: '15', value: 'Second blank' },
        ],
      },
    },
    {
      structure_type: 'collector.dialogue',
      info: {
        stid: 'four',
        value: 'Hidden shared transcript',
        question: [
          {
            xh: '16',
            ask: 'Hidden dialogue prompt',
            std: [
              {
                value: `<p>${long}</p><p>Last paragraph.<img src="https://invalid.example/hidden.png"></p>`,
              },
              { value: 'HIDDEN ALTERNATIVE' },
            ],
          },
        ],
      },
    },
    {
      structure_type: 'collector.role',
      info: {
        stid: 'five',
        question: [
          {
            xh: '17',
            ask: 'Hidden role prompt',
            std: [{ value: '' }, { value: 'HIDDEN ALTERNATIVE' }],
          },
        ],
      },
    },
    {
      structure_type: 'collector.3q5a',
      info: {
        stid: 'six',
        question: [
          { xh: '18', ask: 'Hidden interview prompt', std: [{ value: 'First interview answer' }] },
          { xh: '20', ask: 'Hidden second prompt', std: [{ value: 'Second interview answer' }] },
        ],
      },
    },
    {
      structure_type: 'collector.picture',
      info: {
        stid: 'seven',
        value: 'Hidden picture prompt',
        topic: 'Hidden picture topic',
        keypoint: 'Hidden key points',
        std: [{ value: 'First picture answer' }, { value: 'HIDDEN ALTERNATIVE' }],
      },
    },
    {
      structure_type: 'collector.read',
      info: { stid: 'eight', xh: '22', value: 'Hidden reading passage' },
    },
  ];
  const records = Object.fromEntries(
    documents.map((doc, i) => [
      `bank/原始 Paper/content_${i + 1}/content.json`,
      strToU8(JSON.stringify(doc)),
    ]),
  );
  records['bank/原始 Paper/content_1/material/clip.mp3'] = silentMp3();
  records['bank/Other Paper/content_1/content.json'] = strToU8(
    JSON.stringify({
      structure_type: 'collector.picture',
      info: { stid: 'other', value: 'Other prompt', std: [{ value: 'OTHER PAPER ANSWER' }] },
    }),
  );
  const zip = `${root}/preview.zip`;
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
        '4185',
        '--strictPort',
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await { chromium, webkit }[engine].launch({
    headless: true,
    ...(engine === 'chromium' && process.platform === 'win32' ? { channel: 'msedge' } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [],
    remote = [];
  await page.addInitScript(() => {
    globalThis.previewURLs = { created: 0, revoked: 0, pauses: 0 };
    const make = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL),
      pause = HTMLMediaElement.prototype.pause;
    URL.createObjectURL = (blob) => {
      globalThis.previewURLs.created++;
      return make(blob);
    };
    URL.revokeObjectURL = (url) => {
      globalThis.previewURLs.revoked++;
      revoke(url);
    };
    HTMLMediaElement.prototype.pause = function () {
      globalThis.previewURLs.pauses++;
      return pause.call(this);
    };
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
      remote.push(request.url());
  });
  page.on('download', () => downloads++);
  await page.goto(base);
  check(
    (await page.getByRole('button', { name: 'Preview Answers', exact: true }).count()) === 0,
    'Preview hidden on welcome',
  );
  await page.locator('input[type=file][accept]').setInputFiles(zip);
  await page.locator('.paper-row').filter({ hasText: '原始 Paper' }).click();
  await page.locator('.reader').waitFor();
  const trigger = page.getByRole('button', { name: 'Preview Answers', exact: true });
  const order = async (width) => {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(240);
    const a = await trigger.boundingBox(),
      b = await page.getByRole('button', { name: 'Export Paper', exact: true }).boundingBox();
    check(
      a && b && a.x + a.width <= b.x && Math.abs(a.y - b.y) < 1,
      `${width}px: Preview stays directly left of Export`,
    );
    check(a.height === b.height, `${width}px: action heights match`);
    check(
      await page.locator('.paper-actions').evaluate(
        (el) =>
          [...el.children]
            .filter((n) => n.tagName === 'BUTTON')
            .map((n) => n.getAttribute('aria-label'))
            .join('|') === 'Preview Answers|Export Paper',
      ),
      `${width}px: action DOM order preserved`,
    );
  };
  await order(1280);
  const reader = await page.locator('.reader').elementHandle();
  await page.locator('.part-section .collapse-toggle').first().click();
  await page.waitForTimeout(240);
  await page.locator('.reading-scroll').evaluate((el) => (el.scrollTop = 100));
  const scroll = await page.locator('.reading-scroll').evaluate((el) => el.scrollTop);
  const before = await page.evaluate(() => ({ ...globalThis.previewURLs }));
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Answer Preview', exact: true });
  await dialog.waitFor();
  await page.waitForTimeout(240);
  check((await dialog.locator('.preview-group').count()) === 8, 'Every group appears once');
  check(
    (await dialog.locator('.preview-entry').count()) === 21,
    'Every actual sub-question appears once',
  );
  const headings = await dialog.locator('h3').allTextContents();
  check(
    headings.join('|') ===
      'Multiple Choice · 1–12|Word / Sentence · 1|Fill in the Blanks · 1–2|Dialogue · 1|Role-play · 1|Questions & Answers · 1–2|Picture Description · 1|Reading · 1',
    'All eight structural labels in original order with local group ranges',
  );
  check(
    (await dialog
      .locator('.preview-group')
      .evaluateAll((groups) =>
        groups
          .map((group) =>
            [...group.querySelectorAll('.preview-number')].map((el) => el.textContent).join(','),
          )
          .join('|'),
      )) === '1.,2.,3.,4.,5.,6.,7.,8.,9.,10.,11.,12.|1.|1.,2.|1.|1.|1.,2.|1.|1.',
    'Each group starts at one with no gaps for missing answers',
  );
  check(
    await dialog.getByText('原始 Paper', { exact: true }).isVisible(),
    'Original paper name retained',
  );
  check((await dialog.innerText()).includes(long.trim()), 'Long Chinese answer remains complete');
  check(
    !(await dialog.innerText()).includes('HIDDEN ALTERNATIVE'),
    'Only first stored answer displayed',
  );
  check(
    !(await dialog.innerText()).includes('Hidden '),
    'No prompts, options, transcripts or topic',
  );
  check(
    (await dialog.locator('img,audio,video,iframe,script').count()) === 0,
    'Preview renders no media or unsafe markup',
  );
  check(
    (await dialog.getByText('—', { exact: true }).count()) === 4,
    'Missing/answerless tasks remain in place',
  );
  check(
    await dialog.getByText('A,B', { exact: true }).isVisible(),
    'Multi-option answer not reduced',
  );
  check(
    await dialog
      .locator('.preview-choice-box')
      .first()
      .evaluate((el) => el.textContent === 'B' && el.previousElementSibling.textContent === '1.'),
    'Question number stays outside choice box',
  );
  check(
    await dialog
      .locator('.is-single-choice')
      .first()
      .evaluate(
        (el) =>
          el.clientWidth >= 32 &&
          el.clientWidth <= 36 &&
          el.clientHeight >= 32 &&
          el.clientHeight <= 36,
      ),
    'Single choice uses compact square',
  );
  check(
    await dialog
      .locator('.answer-preview-body')
      .evaluate((el) => el.scrollHeight > el.clientHeight),
    'Long preview scrolls independently',
  );
  check(
    await dialog
      .locator('.answer-preview-header')
      .evaluate((el) => el.getBoundingClientRect().height < 110),
    'Header remains compact',
  );
  check(
    await page.evaluate(() => document.body.style.overflow === 'hidden'),
    'Modal locks background scrolling',
  );
  await page.keyboard.press('Tab');
  check(
    await page.locator('.answer-preview-body').evaluate((el) => el === document.activeElement),
    'Tab reaches the keyboard-scrollable answer region',
  );
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(180);
  check(
    await dialog.locator('.answer-preview-body').evaluate((el) => el.scrollTop > 0),
    'PageDown scrolls long answers using the keyboard',
  );
  await page.keyboard.press('Shift+Tab');
  check(
    await page
      .getByRole('button', { name: 'Close answer preview' })
      .evaluate((el) => el === document.activeElement),
    'Shift+Tab stays in preview',
  );
  check(
    JSON.stringify(before) === JSON.stringify(await page.evaluate(() => globalThis.previewURLs)),
    'Preview creates/releases no Blob URLs and does not pause media',
  );
  check(downloads === 0, 'Preview never exports or downloads');
  await page.screenshot({ path: `${root}/desktop-${engine}.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  check(
    await trigger.evaluate((el) => el === document.activeElement),
    'Escape restores trigger focus',
  );
  check(
    await reader.evaluate((el) => el === document.querySelector('.reader')),
    'Reader is not remounted',
  );
  check(
    (await page.locator('.part-section .collapse-toggle').first().getAttribute('aria-expanded')) ===
      'true',
    'Question expansion preserved',
  );
  check(
    (await page.locator('.reading-scroll').evaluate((el) => el.scrollTop)) === scroll,
    'Reading scroll preserved',
  );
  await trigger.click();
  await dialog.waitFor();
  const reversal = await dialog.evaluate(async (node) => {
    node.querySelector('button').click();
    await new Promise((resolve) => setTimeout(resolve, 35));
    document.querySelector('.preview-button').click();
    await new Promise((resolve) => setTimeout(resolve, 240));
    return node.open && node === document.querySelector('.answer-preview-dialog');
  });
  check(reversal, 'Rapid close/reopen cancels exit and preserves dialog identity');
  await page.getByRole('button', { name: 'Close answer preview' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await dialog.waitFor({ state: 'hidden' });
  check(
    await page.evaluate(() => document.body.style.overflow !== 'hidden'),
    'Live reduced motion finishes the exit and releases scroll lock',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: /Shared Material/ }).click();
  if (engine === 'chromium') {
    await page.locator('.shared-material audio').waitFor();
    const audio = await page.locator('.shared-material audio').elementHandle();
    await audio.evaluate(async (el) => {
      await el.play();
    });
    const mediaBefore = await page.evaluate(() => ({ ...globalThis.previewURLs }));
    await trigger.click();
    await dialog.waitFor();
    check(
      await audio.evaluate(
        (el) => el.isConnected && el === document.querySelector('.shared-material audio'),
      ),
      'Playing audio survives opening preview',
    );
    check(
      JSON.stringify(mediaBefore) ===
        JSON.stringify(await page.evaluate(() => globalThis.previewURLs)),
      'Opening preview does not pause or recreate playing audio',
    );
    await page.getByRole('button', { name: 'Close answer preview' }).click();
    await dialog.waitFor({ state: 'hidden' });
    check(await audio.evaluate((el) => el.isConnected), 'Audio node survives closing preview');
    await audio.evaluate((el) => el.pause());
  }
  for (const width of [390, 320, 720, 800]) {
    // Match existing mobile navigation: use the current group to enter reading.
    await page.setViewportSize({ width, height: 844 });
    if (width <= 720 && !(await trigger.isVisible()))
      await page.locator('.question-row').first().click();
    await order(width);
    await trigger.click();
    await dialog.waitFor();
    await page.waitForTimeout(240);
    check(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      `${width}px: long answers do not overflow dialog`,
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}px: no page overflow`,
    );
    check(
      await dialog
        .locator('.preview-choices')
        .evaluate(
          (el) =>
            new Set([...el.children].map((n) => Math.round(n.getBoundingClientRect().top))).size >
            1,
        ),
      `${width}px: choice items wrap`,
    );
    if (width <= 720)
      check(
        await dialog.evaluate(
          (el) =>
            Math.abs(el.getBoundingClientRect().height - innerHeight) < 2 &&
            Math.abs(el.getBoundingClientRect().width - innerWidth) < 2,
        ),
        `${width}px: mobile preview fills viewport`,
      );
    await page.getByRole('button', { name: 'Close answer preview' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await dialog.waitFor();
  await page.screenshot({ path: `${root}/mobile-${engine}.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Back to question list' }).click();
  await page.waitForFunction(() => document.querySelector('.app')?.dataset.screen === 'questions');
  await page.locator('.question-row.selected').waitFor({ state: 'visible' });
  // content-visibility can skip offscreen row rendering; compare selected content,
  // independently of whether Chromium has painted its text yet.
  const selected = await page.locator('.question-row.selected').textContent();
  await page.locator('.question-row.selected').click();
  await trigger.click();
  await dialog.waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Back to question list' }).click();
  await page.waitForFunction(() => document.querySelector('.app')?.dataset.screen === 'questions');
  await page.locator('.question-row.selected').waitFor({ state: 'visible' });
  check(
    (await page.locator('.question-row.selected').textContent()) === selected,
    'Preview preserves mobile navigation selection: ' +
      JSON.stringify({
        before: selected,
        after: await page.locator('.question-row.selected').textContent(),
      }),
  );
  await page.locator('.question-row').first().click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  await page.keyboard.press('Escape');
  await trigger.click();
  await dialog.waitFor();
  check(
    (await page.locator('html').getAttribute('data-theme')) === 'light',
    'Preview uses existing Light theme',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check(
    await dialog.evaluate((el) => getComputedStyle(el).transitionDuration === '0s'),
    'Preview respects reduced motion',
  );
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'All Papers', exact: true }).click();
  await page.locator('.paper-row').filter({ hasText: 'Other Paper' }).click();
  await trigger.click();
  await dialog.waitFor();
  check(
    await dialog.getByText('OTHER PAPER ANSWER', { exact: true }).isVisible(),
    'Selecting a new paper previews only that paper',
  );
  check(
    (await dialog.getByText('First blank', { exact: true }).count()) === 0,
    'Old paper answers not retained',
  );
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Paper', exact: true }).click();
  await download;
  check(downloads === 1, 'Export remains an independent working action');
  check(remote.length === 0, 'No external resource requests from preview');
  check(errors.length === 0, 'No browser errors: ' + errors.join('; '));
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

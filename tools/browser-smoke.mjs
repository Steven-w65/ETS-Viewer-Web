import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { zipSync, strToU8, zlibSync } from 'fflate';
const playwright = await import(
  process.env.ETS_PLAYWRIGHT_PATH
    ? pathToFileURL(process.env.ETS_PLAYWRIGHT_PATH).href
    : 'playwright'
);
const root = path.resolve('.qa/browser'),
  screenshots = path.resolve('docs/screenshots');
await mkdir(root, { recursive: true });
await mkdir(screenshots, { recursive: true });
// Fully synthetic ETS records, never a copy of a private bank.
const png = (() => {
  const w = 1200,
    h = 600,
    raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = y * (1 + w * 3) + 1 + x * 3;
      raw[p] = 180 + (y % 30);
      raw[p + 1] = 198 + (x % 30);
      raw[p + 2] = 192;
    }
  function chunk(type, bytes) {
    const b = Buffer.alloc(bytes.length + 12);
    b.writeUInt32BE(bytes.length);
    b.write(type, 4);
    b.set(bytes, 8);
    let c = 0xffffffff;
    for (const value of b.subarray(4, b.length - 4)) {
      c ^= value;
      for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    b.writeUInt32BE((c ^ 0xffffffff) >>> 0, b.length - 4);
    return b;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
})();
const records = {};
for (let paper = 0; paper < 2; paper++)
  for (let i = 0; i < 22; i++) {
    const id = String(10001 + i),
      kind =
        [
          'collector.choose',
          'collector.dialogue',
          'collector.picture',
          'collector.role',
          'collector.3q5a',
          'collector.fill',
          'collector.read',
          'collector.word',
        ][i] || 'collector.choose';
    let info;
    if (kind === 'collector.choose')
      info = {
        stid: id,
        st_nr: '<p>A conversation about a weekend at the library.</p>',
        st_sm: 'Read the original questions and stored reference answers.',
        xtlist: [
          {
            xt_xh: '1',
            xt_nr: 'ets_th1 What does the woman suggest?',
            xt_value: 'M: Shall we visit the library this afternoon?\nW: We could go after lunch.',
            answer: 'B',
            xxlist: [
              {
                xx_mc: 'A',
                xx_nr: 'Visit early in the morning.',
                ...(i === 0 ? { xx_wj: 'choice.png' } : {}),
              },
              { xx_mc: 'B', xx_nr: 'Go to the library after lunch.' },
              { xx_mc: 'C', xx_nr: 'Stay home for the afternoon.' },
            ],
          },
          {
            xt_xh: '2',
            xt_nr: 'Where will they meet?',
            answer: 'A',
            xxlist: [{ xx_mc: 'A', xx_nr: 'At the entrance.' }],
          },
        ],
      };
    if (kind === 'collector.dialogue')
      info = {
        stid: id,
        value:
          '<p>M: What did you enjoy about the trip?</p><p>W: I especially enjoyed walking through the old town.</p>',
        question: [
          {
            xh: '1',
            ask: 'ets_th1 Ask two questions about the trip.',
            std: [
              { value: 'What was your favorite place to visit?<br>Did you try any local food?' },
              { value: 'Which part of the old town did you like most?' },
              { value: 'Would you like to visit again?' },
            ],
          },
          {
            xh: '2',
            ask: 'Describe a place you would like to visit.',
            std: [{ value: 'I would like to visit a quiet town near the coast.' }],
          },
        ],
      };
    if (kind === 'collector.picture')
      info = {
        stid: id,
        topic: 'A quiet afternoon.',
        value: 'Describe the original picture.',
        image: '示意 图.png',
        std: [{ value: 'The picture shows a calm afternoon.' }],
        keypoint: 'Source key points.',
        analyze: 'Source explanation.',
      };
    if (kind === 'collector.role' || kind === 'collector.3q5a')
      info = {
        stid: id,
        value: 'Shared interview.',
        question: [
          {
            ask: 'Where do you study?',
            keywords: 'Source keywords.',
            std: [{ value: 'At school.' }, { value: 'I study at school.' }],
          },
        ],
      };
    if (kind === 'collector.fill')
      info = {
        stid: id,
        value: 'Source fill passage.',
        std: [
          { th: '15', value: 'A/B' },
          { xth: '16', value: '2026/10/19' },
        ],
      };
    if (kind === 'collector.read' || kind === 'collector.word')
      info = {
        stid: id,
        value: '<p>Original first paragraph.</p><p>Original second paragraph.</p>',
      };
    const p = `Demo ETS/${paper ? '试卷 Beta' : '试卷 Alpha'}/content_${id}/content.json`;
    records[p] = strToU8(JSON.stringify({ structure_type: kind, info }));
    if (i === 2) records[p.replace('content.json', 'material/示意 图.png')] = png;
    if (i === 0) records[p.replace('content.json', 'material/choice.png')] = png;
    if (i === 4) records[p.replace('content.json', 'content2.json')] = records[p];
  }
const zipPath = path.join(root, 'demo-bank.zip');
await writeFile(zipPath, zipSync(records));
for (const [name, bytes] of Object.entries(records)) {
  const dest = path.join(root, name);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
}
const hostile = {
  structure_type: 'collector.dialogue',
  info: {
    stid: 'unsafe',
    question: [
      {
        xh: '1',
        ask: 'Prompt',
        std: [
          {
            value:
              '<script>globalThis.pwned=1</script><p onclick="globalThis.pwned=1">Safe answer</p><img src="https://evil.invalid/pixel"><iframe src="https://evil.invalid/frame"></iframe><svg onload="alert(1)"></svg>',
          },
        ],
      },
    ],
  },
};
await writeFile(
  path.join(root, 'unsafe.zip'),
  zipSync({ 'p/content_unsafe/content.json': strToU8(JSON.stringify(hostile)) }),
);
let server, browser;
const base = process.env.ETS_BASE_URL ?? 'http://127.0.0.1:4173';
try {
  if (!process.env.ETS_BASE_URL) {
    server = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4173',
        '--strictPort',
      ],
      { stdio: 'ignore', windowsHide: true },
    );
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const engine = process.env.ETS_BROWSER_ENGINE ?? 'chromium';
  browser = await playwright[engine].launch({
    headless: true,
    ...(engine === 'chromium' && process.platform === 'win32'
      ? { channel: process.env.ETS_BROWSER_CHANNEL ?? 'msedge' }
      : {}),
  });
  let assertions = 0;
  const check = (value, message) => {
    assert.ok(value, message);
    assertions++;
  };
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    colorScheme: 'dark',
    acceptDownloads: true,
  });
  const page = await desktop.newPage(),
    errors = [],
    remote = [];
  await page.addInitScript(() => {
    globalThis.imageURLs = new Set();
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      if (blob.type.startsWith('image/')) globalThis.imageURLs.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      globalThis.imageURLs.delete(url);
      revoke(url);
    };
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(base)) remote.push(r.url());
  });
  await page.goto(base);
  await page.getByRole('button', { name: 'Select Folder', exact: true }).waitFor();
  check(
    await page.getByRole('button', { name: 'Import ZIP', exact: true }).isVisible(),
    'ZIP import visible',
  );
  await writeFile(
    path.join(root, 'root-images.zip'),
    zipSync({
      'content.json': strToU8(
        JSON.stringify({
          structure_type: 'collector.picture',
          info: {
            stid: 'root-picture',
            value: 'Original root-level image',
            image: './示意 图.png',
            std: [{ value: 'Stored answer' }],
          },
        }),
      ),
      'material/示意 图.png': png,
    }),
  );
  await page.screenshot({
    path: path.join(screenshots, `desktop-welcome-${engine}.png`),
    animations: 'disabled',
  });
  await page.locator('input[accept]').setInputFiles(zipPath);
  await page.getByRole('heading', { name: /^All Papers/ }).waitFor();
  check((await page.locator('.paper-row').count()) === 2, 'ZIP imports both papers');
  await page.locator('.paper-row').filter({ hasText: '试卷 Alpha' }).click();
  await page.getByRole('heading', { name: 'Question 10001', exact: true }).waitFor();
  check(
    (await page.locator('.answer-card').first().innerText()) === 'REFERENCE ANSWER\nB',
    'Primary answer visible',
  );
  check(
    (await page.locator('.part-section .collapse-toggle').first().getAttribute('aria-expanded')) ===
      'false',
    'Question defaults collapsed',
  );
  await page.locator('.part-section .collapse-toggle').first().click();
  await page.locator('.option img.source-image').waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.option img')].some((img) => img.naturalWidth === 1200),
  );
  check(
    await page.locator('.option img.source-image').isVisible(),
    'Image-based choice resolves through the local asset reader',
  );
  check(
    await page
      .locator('.collapse-shell')
      .last()
      .evaluate((el) => getComputedStyle(el).transitionDuration === '0.2s'),
    'Collapse transition lasts 200ms',
  );
  check(
    await page
      .locator('.reader')
      .evaluate((el) => getComputedStyle(el).animationDuration === '0.14s'),
    'Question navigation transition lasts 140ms',
  );
  const heights = await page
    .locator('.part-section')
    .first()
    .evaluate(async (el) => {
      const shell = el.querySelector('.collapse-shell'),
        button = el.querySelector('.collapse-toggle');
      await new Promise((r) => setTimeout(r, 220));
      const start = shell.getBoundingClientRect().height;
      button.click();
      await new Promise((r) => setTimeout(r, 80));
      const middle = shell.getBoundingClientRect().height;
      await new Promise((r) => setTimeout(r, 150));
      const end = shell.getBoundingClientRect().height;
      button.click();
      return { start, middle, end };
    });
  check(
    heights.start > heights.middle && heights.middle > 0 && heights.end === 0,
    'Collapse animates layout smoothly to zero height',
  );
  check(
    await page.getByText('Go to the library after lunch.', { exact: true }).isVisible(),
    'Options retained',
  );
  await page.setViewportSize({ width: 1100, height: 800 });
  check(
    (await page.locator('.part-section .collapse-toggle').first().getAttribute('aria-expanded')) ===
      'true',
    'Resize preserves expansion',
  );
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('heading', { name: 'Question 10002', exact: true }).waitFor();
  check(
    (await page.locator('.part-section .collapse-toggle').first().getAttribute('aria-expanded')) ===
      'false',
    'Changing group resets cards',
  );
  check(
    await page.getByText('Did you try any local food?', { exact: false }).isVisible(),
    'Formatted primary answer visible',
  );
  await page.screenshot({
    path: path.join(screenshots, `desktop-reading-${engine}.png`),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: /Additional Reference Answers/ }).click();
  check(
    await page.getByText('Would you like to visit again?', { exact: true }).isVisible(),
    'Additional answers accessible',
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Shared Material/ }).click();
  await page.locator('img.source-image').waitFor();
  await page.waitForFunction(() => [...document.images].some((i) => i.naturalWidth === 1200));
  const dimensions = await page.locator('img.source-image').evaluate((img) => ({
    width: img.clientWidth,
    height: img.clientHeight,
    ratio: img.naturalWidth / img.naturalHeight,
  }));
  check(
    dimensions.width <= 820 &&
      Math.abs(dimensions.width / dimensions.height - dimensions.ratio) < 0.01,
    'Image fits reading column and retains aspect ratio',
  );
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export Paper/ }).click();
  const download = await downloadWait;
  const exported = await readFile(await download.path());
  check(exported.subarray(0, 3).equals(Buffer.from([239, 187, 191])), 'Export has UTF-8 BOM');
  const text = exported.toString('utf8');
  check((text.match(/Question group:/g) || []).length === 22, 'Export includes full paper');
  check(!text.includes('Would you like to visit again?'), 'Export excludes extra answers');
  check(
    text.includes('A. Visit early in the morning. [Image: choice.png]') &&
      text.includes('Question: 10006/15') &&
      text.includes('2026/10/19'),
    'Mixed eight-type paper export preserves option images, fill numbers, and slash text',
  );
  check(
    await page
      .locator('.toast')
      .evaluate((el) => getComputedStyle(el).animationDuration === '0.18s'),
    'Toast enters in 180ms',
  );
  await page.waitForFunction(() => !!document.querySelector('.toast.is-leaving'));
  check(
    await page
      .locator('.toast')
      .evaluate((el) => getComputedStyle(el).animationDuration === '0.18s'),
    'Toast exits in 180ms',
  );
  await page.locator('.toast').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.locator('.sidebar').waitFor({ state: 'hidden' });
  check(!(await page.locator('.sidebar').isVisible()), 'Sidebar collapses');
  check(
    await page
      .locator('.bank-layout')
      .evaluate((el) => getComputedStyle(el).transitionDuration === '0.2s'),
    'Sidebar transition lasts 200ms',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Back to question list' }).click();
  check(
    (await page.locator('.sidebar').isVisible()) &&
      (await page.locator('.sidebar').evaluate((el) => !el.inert)),
    'Mobile navigation remains usable after collapsing the desktop sidebar',
  );
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check(
    await page
      .locator('.collapse-shell')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration === '0s'),
    'Reduced motion disables collapse transitions',
  );
  check(
    await page.locator('.reader').evaluate((el) => getComputedStyle(el).animationName === 'none'),
    'Reduced motion disables navigation animations',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  check((await page.locator('input[type=search]').count()) === 0, 'No search control');
  await page.getByRole('button', { name: 'Change Bank', exact: true }).click();
  check(
    (await page.evaluate(() => globalThis.imageURLs.size)) === 0,
    'Replacing the bank releases image URLs',
  );
  await page.locator('input[webkitdirectory]').setInputFiles(path.join(root, 'Demo ETS'));
  await page.getByRole('heading', { name: /^All Papers/ }).waitFor();
  check(
    (await page.locator('.paper-row').count()) === 2,
    'Folder import works in automated picker',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Import ZIP', exact: true }).waitFor();
  check((await page.locator('.paper-row').count()) === 0, 'Refresh does not restore bank');
  await page.locator('input[accept]').setInputFiles(path.join(root, 'unsafe.zip'));
  await page.getByRole('heading', { name: /^All Papers/ }).waitFor();
  await page.locator('.paper-row').click();
  await page.getByText('Safe answer', { exact: true }).waitFor();
  check(
    (await page.evaluate(() => globalThis.pwned)) === undefined,
    'Imported script/event handlers cannot execute',
  );
  check(
    (await page.locator('script[src^=https],iframe,svg[onload]').count()) === 0,
    'Active HTML stripped',
  );
  check(remote.length === 0, 'Imported content makes no remote requests');
  check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
  await page.getByRole('button', { name: 'Change Bank', exact: true }).click();
  await page.locator('input[accept]').setInputFiles(path.join(root, 'root-images.zip'));
  await page.locator('.paper-row').click();
  await page.getByRole('button', { name: /Shared Material/ }).click();
  await page.waitForFunction(() => [...document.images].some((img) => img.naturalWidth === 1200));
  check(
    await page.locator('img.source-image').isVisible(),
    'Root-level ZIP resolves a ./ reference from material/',
  );
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  const phone = await mobile.newPage();
  await phone.goto(base);
  await phone.getByRole('button', { name: 'Select Folder', exact: true }).waitFor();
  check(
    await phone.getByRole('button', { name: 'Select Folder', exact: true }).isVisible(),
    'Mobile shows Select Folder',
  );
  check(
    await phone.getByRole('button', { name: 'Import ZIP', exact: true }).isVisible(),
    'Mobile shows Import ZIP',
  );
  await phone.locator('input[accept]').setInputFiles(zipPath);
  await phone.locator('.paper-row').first().waitFor();
  await phone.locator('.paper-row').filter({ hasText: '试卷 Alpha' }).click();
  check(
    await phone.getByRole('heading', { name: '试卷 Alpha', exact: true }).isVisible(),
    'Mobile opens question list',
  );
  check(!(await phone.locator('.workspace').isVisible()), 'Mobile list occupies its own page');
  await phone.locator('.nav-list').evaluate((el) => {
    el.scrollTop = 550;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  // Record the user's actual list position at activation: WebKit may scroll an
  // offscreen row into view before dispatching the automated click.
  await phone
    .locator('.question-row')
    .nth(6)
    .evaluate((el) =>
      el.addEventListener(
        'click',
        () => {
          globalThis.activatedListScroll = document.querySelector('.nav-list').scrollTop;
        },
        { capture: true, once: true },
      ),
    );
  await phone.locator('.question-row').nth(6).click();
  const saved = await phone.evaluate(() => globalThis.activatedListScroll);
  check(await phone.locator('.workspace').isVisible(), 'Mobile opens reading page');
  await phone.getByRole('button', { name: 'Back to question list' }).click();
  const restored = await phone.locator('.nav-list').evaluate((el) => el.scrollTop);
  check(Math.abs(restored - saved) < 2, `Question list scroll restored (${saved} → ${restored})`);
  await phone.locator('.nav-list').evaluate((el) => (el.scrollTop = 0));
  await phone.locator('.question-row').nth(1).click();
  await phone.getByRole('heading', { name: 'Question 10002', exact: true }).waitFor();
  await phone.screenshot({
    path: path.join(screenshots, `mobile-reading-${engine}.png`),
    animations: 'disabled',
  });
  check(
    await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'No horizontal page overflow',
  );
  await phone.getByRole('button', { name: 'Previous', exact: true }).click();
  check(
    await phone.getByRole('button', { name: 'Previous', exact: true }).isDisabled(),
    'Mobile previous stops at first group',
  );
  await phone.getByRole('button', { name: 'Back to question list' }).click();
  await phone.locator('.question-row').last().click();
  check(
    await phone.getByRole('button', { name: 'Next', exact: true }).isDisabled(),
    'Mobile next stops at last group',
  );
  await phone.setViewportSize({ width: 320, height: 568 });
  check(
    await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'No overflow at 320px width',
  );
  await phone.getByRole('button', { name: 'Settings', exact: true }).click();
  await phone.getByLabel('Dark', { exact: true }).check();
  check((await phone.locator('html').getAttribute('data-theme')) === 'dark', 'Appearance changes');
  await phone.reload();
  await phone.getByRole('button', { name: 'Select Folder', exact: true }).waitFor();
  check(
    (await phone.locator('html').getAttribute('data-theme')) === 'dark',
    'Only appearance persists',
  );
  // The automated picker cannot prove OS chooser support. Exercise empty-path fallback explicitly.
  await phone.locator('input[webkitdirectory]').evaluate((el) => {
    const data = new DataTransfer();
    data.items.add(new File(['{}'], 'content.json'));
    el.files = data.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await phone.getByRole('alert').waitFor();
  check(
    (await phone.getByRole('alert').innerText()).includes('Import ZIP'),
    'Missing relative paths offer ZIP fallback',
  );
  console.log(
    JSON.stringify(
      {
        browser: engine,
        version: browser.version(),
        assertions,
        desktop: 'PASS',
        mobileEmulation: 'PASS',
        screenshots,
        realMobileDevices: 'not tested',
      },
      null,
      2,
    ),
  );
  await mobile.close();
  await desktop.close();
} catch (error) {
  if (browser)
    for (const [i, context] of browser.contexts().entries())
      for (const [j, p] of context.pages().entries()) {
        await p.screenshot({ path: path.join(root, `failure-${i}-${j}.png`) }).catch(() => {});
        console.error((await p.locator('body').innerText()).slice(0, 2500));
      }
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}

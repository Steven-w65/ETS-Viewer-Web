import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { zipSync, strToU8 } from 'fflate';
const base = process.env.ETS_BASE_URL || 'http://127.0.0.1:4179',
  root = path.resolve('.qa/warnings'),
  engine = process.env.ETS_BROWSER_ENGINE || 'chromium';
let server,
  browser,
  checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
try {
  await mkdir(root, { recursive: true });
  const source = 'bank/paper/content_1/content.json';
  const document = {
    structure_type: 'collector.role',
    info: {
      stid: 'warnings',
      question: [
        {
          xh: '1',
          ask: '<p>Original question.</p><img src="ques1askimg.jpg">',
          askimg: 'ques1askimg.jpg',
          std: [{ value: 'Stored reference answer' }],
        },
        { xh: '2', ask: 'Second question.', askimg: '嵌套目录/'.repeat(10) + '图 片.png' },
        { xh: '3', ask: 'Third question.', askaudio: 'sound.mp3' },
        { xh: '4', ask: 'Fourth question.', askvideo: 'lesson.mp4' },
      ],
    },
  };
  const read = {
    structure_type: 'collector.read',
    info: { stid: 'other', value: 'Other original question.' },
  };
  const records = {
    [source]: strToU8(JSON.stringify(document)),
    [source.replace('content.json', 'content2.json')]: strToU8(JSON.stringify(document)),
    'bank/paper/content_2/content.json': strToU8(JSON.stringify(read)),
    'bank/second/content_3/content.json': strToU8(
      JSON.stringify({ ...read, info: { ...read.info, stid: 'second' } }),
    ),
  };
  const fixture = path.join(root, 'warnings.zip'),
    clean = path.join(root, 'clean.zip'),
    empty = path.join(root, 'unsupported.zip');
  await writeFile(fixture, zipSync(records));
  await writeFile(
    clean,
    zipSync({ 'bank/paper/content_1/content.json': strToU8(JSON.stringify(read)) }),
  );
  await writeFile(
    empty,
    zipSync({
      'bank/paper/content_1/content.json': strToU8(
        JSON.stringify({ structure_type: 'collector.unsupported', info: {} }),
      ),
    }),
  );
  for (const [name, bytes] of Object.entries(records)) {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
  if (!process.env.ETS_BASE_URL) {
    server = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4179',
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
  browser = await { chromium, webkit }[engine].launch({
    headless: true,
    ...(engine === 'chromium' && process.platform === 'win32' ? { channel: 'msedge' } : {}),
  });
  const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: 'dark',
    }),
    page = await context.newPage(),
    errors = [],
    remote = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
      remote.push(request.url());
  });
  await page.goto(base);
  check((await page.locator('.warnings-button').count()) === 0, 'No indicator before import');
  await page.locator('input[accept]').setInputFiles(fixture);
  const trigger = page.getByRole('button', { name: 'View 4 import warnings', exact: true }),
    settings = page.getByRole('button', { name: 'Settings', exact: true });
  await trigger.waitFor();
  const warningBox = await trigger.boundingBox(),
    settingsBox = await settings.boundingBox();
  check(
    warningBox.x + warningBox.width <= settingsBox.x && Math.abs(warningBox.y - settingsBox.y) < 5,
    'Compact warning button immediately precedes Settings',
  );
  check((await page.locator('.warnings-button').count()) === 1, 'One global warning indicator');
  check(
    (await page
      .locator('.reading-scroll .warnings,.overview-scroll .warnings,.mobile-bank-notes .warnings')
      .count()) === 0,
    'Inline warning lists removed',
  );
  await page.locator('.paper-row').first().click();
  await page.getByText('Stored reference answer', { exact: true }).waitFor();
  check(await trigger.isVisible(), 'Warnings survive choosing a paper');
  await trigger.click();
  let dialog = page.getByRole('dialog', { name: 'Import warnings', exact: true });
  check(
    await dialog.evaluate((el) => el.matches(':modal')),
    'Native modal semantics block background interaction',
  );
  check(
    await page
      .getByRole('button', { name: 'Close import warnings' })
      .evaluate((el) => el === document.activeElement),
    'Initial focus goes to Close',
  );
  check(
    await page.evaluate(() => document.body.style.overflow === 'hidden'),
    'Background page scroll locked',
  );
  check(
    (await page.locator('.warning-list > li').count()) === 4,
    'Duplicate source copies and repeated image references do not inflate count',
  );
  for (const name of [
    'ques1askimg.jpg',
    '嵌套目录/'.repeat(10) + '图 片.png',
    'sound.mp3',
    'lesson.mp4',
  ])
    check(
      await dialog.getByText(name, { exact: true }).isVisible(),
      'Actual reference displayed: ' + name,
    );
  check(
    (await dialog.getByText(source, { exact: true }).count()) === 4,
    'Source JSON remains separate in all four warnings',
  );
  check(
    (await dialog.getByRole('heading', { name: 'Audio not found', exact: true }).isVisible()) &&
      (await dialog.getByRole('heading', { name: 'Video not found', exact: true }).isVisible()),
    'Media failures classified correctly',
  );
  check(
    (await page.locator('.technical-toggle[aria-expanded="true"]').count()) === 0,
    'Technical details start collapsed',
  );
  await page.locator('.technical-toggle').first().click();
  check(
    await dialog
      .getByText('bank/paper/content_1/material/ques1askimg.jpg', { exact: true })
      .isVisible(),
    'Technical details preserve validated candidate path',
  );
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    check(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      'Keyboard focus stays in the modal',
    );
  }
  check(
    await dialog.evaluate((el) => getComputedStyle(el).transitionDuration === '0.18s'),
    'Dialog entrance is 180ms',
  );
  await page.screenshot({
    path: path.join(root, 'desktop-' + engine + '.png'),
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  check(
    await trigger.evaluate((el) => el === document.activeElement),
    'Escape closes and returns focus',
  );
  check(
    await page.evaluate(() => document.body.style.overflow !== 'hidden'),
    'Closing restores page scroll',
  );
  await trigger.click();
  await page.getByRole('button', { name: 'Close import warnings' }).click();
  await dialog.waitFor({ state: 'hidden' });
  check(
    await trigger.evaluate((el) => el === document.activeElement),
    'Close button restores trigger focus',
  );
  await trigger.click();
  await page.mouse.click(8, 100);
  await dialog.waitFor({ state: 'hidden' });
  check(true, 'Backdrop dismisses the dialog');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('heading', { name: 'Question other', exact: true }).waitFor();
  check(await trigger.isVisible(), 'Warnings survive question-group navigation');
  await page.getByRole('button', { name: 'All Papers', exact: true }).click();
  await page.locator('.paper-row').last().click();
  await page.getByRole('heading', { name: 'Question second', exact: true }).waitFor();
  check(await trigger.isVisible(), 'Warnings survive switching papers');
  await page.setViewportSize({ width: 320, height: 740 });
  await trigger.click();
  await page.getByRole('dialog').waitFor();
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'No horizontal overflow on mobile',
  );
  const mobileDialog = await dialog.boundingBox();
  check(
    mobileDialog.x >= 0 && mobileDialog.x + mobileDialog.width <= 320 && mobileDialog.height <= 740,
    'Dialog fits a 320px viewport',
  );
  check(
    await page.locator('.warning-dialog-body').evaluate((el) => el.scrollHeight > el.clientHeight),
    'Long list scrolls inside the dialog',
  );
  check(
    await page
      .locator('.warning-entry')
      .evaluateAll((entries) => entries.every((el) => el.scrollWidth <= el.clientWidth)),
    'Long Unicode path wraps within its entry',
  );
  await page.screenshot({
    path: path.join(root, 'mobile-dark-' + engine + '.png'),
    animations: 'disabled',
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check(
    await dialog.evaluate((el) => getComputedStyle(el).animationName === 'none'),
    'Reduced motion disables dialog animation',
  );
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await settings.click();
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  await page.keyboard.press('Escape');
  await trigger.click();
  await page.screenshot({
    path: path.join(root, 'mobile-light-' + engine + '.png'),
    animations: 'disabled',
  });
  check(
    (await page.locator('html').getAttribute('data-theme')) === 'light',
    'Light theme preserved',
  );
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Change Bank', exact: true }).click();
  check((await page.locator('.warnings-button').count()) === 0, 'Clearing bank clears indicator');
  await page.locator('input[webkitdirectory]').setInputFiles(path.join(root, 'bank'));
  await trigger.waitFor();
  await trigger.click();
  check(
    (await page.locator('.warning-list > li').count()) === 4,
    'Folder import has equivalent warnings to ZIP',
  );
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Change Bank', exact: true }).click();
  await page.locator('input[accept]').setInputFiles(clean);
  await page.locator('.paper-row').waitFor();
  check(
    (await page.locator('.warnings-button').count()) === 0,
    'New clean bank replaces previous warnings',
  );
  await page.getByRole('button', { name: 'Change Bank', exact: true }).click();
  await page.locator('input[accept]').setInputFiles(empty);
  await page.getByRole('heading', { name: 'No Exams Found', exact: true }).waitFor();
  await page.getByRole('button', { name: 'View 1 import warning', exact: true }).click();
  check(
    (await page
      .getByText('Some resources could not be loaded. Other questions remain available.', {
        exact: true,
      })
      .count()) === 0,
    'Failed/empty bank does not claim available questions',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.reload();
  await page.getByRole('button', { name: 'Select Folder', exact: true }).waitFor();
  check(
    (await page.locator('.warnings-button').count()) === 0,
    'Warnings are not persisted across reload',
  );
  check(errors.length === 0, 'No browser page errors: ' + errors.join(', '));
  check(remote.length === 0, 'No external requests');
  console.log(
    JSON.stringify(
      {
        engine,
        version: browser.version(),
        checks,
        mobile: '320px emulation',
        realDevices: 'not tested',
        screenshots: root,
      },
      null,
      2,
    ),
  );
} catch (error) {
  for (const context of browser?.contexts() || [])
    for (const page of context.pages())
      await page
        .screenshot({ path: path.join(root, 'failure-' + engine + '.png') })
        .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}

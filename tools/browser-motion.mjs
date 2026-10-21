import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { zipSync, strToU8 } from 'fflate';

const root = '.qa/motion',
  port = 4183;
const base = process.env.ETS_BASE_URL || `http://127.0.0.1:${port}`;
const engine = process.env.ETS_BROWSER_ENGINE || 'chromium';
let server,
  browser,
  checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
try {
  await mkdir(root, { recursive: true });
  const record = {
    structure_type: 'collector.role',
    info: {
      stid: 'first',
      value: 'Shared passage. '.repeat(140),
      keypoint: 'Key points. '.repeat(50),
      analyze: 'Original explanation.',
      question: [
        {
          ask: '<p>Question prompt.</p>' + '<p>Long question text.</p>'.repeat(30),
          askimg: 'missing.png',
          analyze: 'Original part explanation.',
          std: [
            { value: 'First stored answer. '.repeat(250) },
            { value: 'Second answer. '.repeat(30) },
            { value: 'Third answer.' },
          ],
        },
      ],
    },
  };
  const entries = {
    'bank/paper/content_1/content.json': strToU8(JSON.stringify(record)),
    'bank/paper/content_2/content.json': strToU8(
      JSON.stringify({
        structure_type: 'collector.picture',
        info: {
          stid: 'second',
          value: 'Picture prompt.',
          keypoint: 'Key points. '.repeat(50),
          analyze: 'Original group explanation.',
          std: [{ value: 'Stored answer. '.repeat(250) }],
        },
      }),
    ),
    'bank/another/content_3/content.json': strToU8(
      JSON.stringify({ ...record, info: { ...record.info, stid: 'third' } }),
    ),
  };
  const zip = `${root}/motion.zip`;
  await writeFile(zip, zipSync(entries));
  const image = await readFile('tests/media-fixtures/rotated.jpg');
  if (!process.env.ETS_BASE_URL) {
    server = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
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
  await page.getByRole('button', { name: 'Where are my question files?' }).waitFor();
  await page.waitForTimeout(240);
  const settle = () => page.waitForTimeout(240);
  const sample = async (selector, action, wait = 60) =>
    page
      .locator(selector)
      .first()
      .evaluate(
        async (node, { action, wait }) => {
          const read = () => ({
            height: node.getBoundingClientRect().height,
            opacity: Number(getComputedStyle(node).opacity),
          });
          const before = read();
          if (action === 'guide') document.querySelector('.folder-guide-toggle').click();
          if (action === 'tab') document.querySelector('[role=tab]:last-child').click();
          if (action === 'card') node.parentElement.querySelector('button').click();
          await new Promise((r) => setTimeout(r, wait));
          const middle = read();
          await new Promise((r) => setTimeout(r, 240));
          return { before, middle, after: read() };
        },
        { action, wait },
      );

  const guide = await sample('.folder-guide-shell', 'guide');
  check(
    guide.middle.height > 0 && guide.middle.height < guide.after.height,
    'Guide expands through intermediate heights: ' + JSON.stringify(guide),
  );
  check(
    guide.middle.opacity > 0 && guide.middle.opacity < 1,
    'Disclosure fades complement height expansion',
  );
  const tabs = await sample('.folder-guide-shell', 'tab');
  check(
    tabs.middle.height > tabs.before.height && tabs.middle.height < tabs.after.height,
    'Long Android path changes intrinsic height smoothly',
  );
  check(
    await page
      .locator('.folder-guide-shell')
      .evaluate(
        (el) =>
          Math.abs(el.clientHeight - el.firstElementChild.getBoundingClientRect().height) <= 1,
      ),
    'Expanded guide fits its full natural contents',
  );
  await page.getByRole('button', { name: 'Where are my question files?' }).evaluate((button) => {
    for (let i = 0; i < 9; i++) button.click();
  });
  await settle();
  check(
    await page.locator('.folder-guide-shell').evaluate((el) => el.clientHeight === 0 && el.inert),
    'Rapid guide toggles finish closed without leftover space',
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settle();
  await page.getByRole('radio', { name: 'Dark', exact: true }).focus();
  await page.keyboard.press('Escape');
  check(
    await page
      .getByRole('button', { name: 'Settings', exact: true })
      .evaluate((el) => document.activeElement === el),
    'Settings Escape restores focus',
  );
  check(
    await page.locator('.settings-menu').evaluate((el) => el.inert),
    'Settings exits remain mounted and inaccessible',
  );
  await page.waitForTimeout(50);
  check(
    await page.locator('.settings-menu').evaluate((el) => {
      const n = Number(getComputedStyle(el).opacity);
      return n > 0 && n < 1;
    }),
    'Settings has an actual exit fade',
  );
  await settle();
  check(
    (await page.locator('.settings-menu').count()) === 0,
    'Settings removes the completed exit',
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sameSettings = await page.locator('.settings-menu').evaluate(async (node) => {
    const button = document.querySelector('.settings-button');
    button.click();
    await new Promise((r) => setTimeout(r, 30));
    button.click();
    await new Promise((r) => setTimeout(r, 240));
    return node === document.querySelector('.settings-menu') && !node.inert;
  });
  check(sameSettings, 'Quick Settings reversal keeps control identity');
  await page.keyboard.press('Escape');
  await settle();
  const opacityReversal = await page.evaluate(async () => {
    const trigger = document.querySelector('.settings-button');
    trigger.click();
    await new Promise((r) => setTimeout(r, 45));
    await new Promise((r) => requestAnimationFrame(r));
    const menu = document.querySelector('.settings-menu');
    const before = Number(getComputedStyle(menu).opacity);
    trigger.click();
    await Promise.resolve();
    const immediate = Number(getComputedStyle(menu).opacity);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { before, immediate, after: Number(getComputedStyle(menu).opacity) };
  });
  check(
    opacityReversal.after <= opacityReversal.before + 0.02,
    'An interrupted entrance reverses opacity without flashing: ' + JSON.stringify(opacityReversal),
  );
  await settle();
  await page.locator('input[type=file][accept]').setInputFiles(zip);
  await page.locator('.paper-row').first().waitFor();
  await page.locator('.paper-row').filter({ hasText: 'paper' }).click();
  await page.locator('.reader').waitFor();
  await settle();
  check(await page.locator('.answer-card').first().isVisible(), 'First answer remains visible');
  check(
    await page
      .locator('.reader')
      .evaluate((el) => getComputedStyle(el).animationDuration === '0.15s'),
    'View fade uses shared 150ms timing',
  );
  const question = page.locator('.part-section .collapse-card').first();
  const questionShell = '.part-section .collapse-shell';
  const expand = await sample(questionShell, 'card');
  check(
    expand.middle.height > 0 && expand.middle.height < expand.after.height,
    'Long question expands smoothly',
  );
  check(
    expand.middle.opacity > 0 && expand.middle.opacity < 1,
    'Question content fades during expansion',
  );
  check(
    await question.locator('.media-fallback').isVisible(),
    'Missing-media fallback fits expanded content',
  );
  const lateImage = await question.locator('.collapse-content').evaluate(
    async (node, bytes) => {
      const shell = node.closest('.collapse-shell');
      const before = shell.getBoundingClientRect().height;
      const image = document.createElement('img');
      image.className = 'source-image';
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }));
      node.append(image);
      image.src = url;
      await image.decode();
      await new Promise((r) => setTimeout(r, 65));
      const middle = shell.getBoundingClientRect().height;
      await new Promise((r) => setTimeout(r, 250));
      const after = shell.getBoundingClientRect().height;
      const natural = shell.firstElementChild.getBoundingClientRect().height;
      URL.revokeObjectURL(url);
      return { before, middle, after, natural };
    },
    [...image],
  );
  check(
    lateImage.before < lateImage.middle && lateImage.middle < lateImage.after,
    'Late image growth animates without an abrupt container jump',
  );
  check(
    Math.abs(lateImage.after - lateImage.natural) < 1,
    'Late image and long text are not clipped',
  );
  const retained = await question.evaluate(async (node) => {
    const button = node.querySelector('button'),
      child = node.querySelector('.collapse-content');
    button.click();
    await new Promise((r) => setTimeout(r, 45));
    button.click();
    await new Promise((r) => setTimeout(r, 260));
    return (
      child === node.querySelector('.collapse-content') &&
      button.getAttribute('aria-expanded') === 'true'
    );
  });
  check(retained, 'Rapid card reversal does not remount content');
  const collapse = await sample(questionShell, 'card');
  check(
    collapse.before.height > collapse.middle.height &&
      collapse.middle.height > 0 &&
      collapse.after.height === 0,
    'Long question collapses smoothly to zero',
  );
  check(
    collapse.middle.opacity > 0 && collapse.middle.opacity < 1,
    'Collapsing question fades without disappearing at once',
  );
  for (const name of [/Shared Material/, /Additional Reference Answers/, 'Explanation']) {
    const toggle = page.getByRole('button', { name });
    await toggle.click();
    await settle();
    check(
      await toggle.evaluate((el) => {
        const panel = document.getElementById(el.getAttribute('aria-controls'));
        return (
          Math.abs(
            panel.getBoundingClientRect().height -
              panel.firstElementChild.getBoundingClientRect().height,
          ) < 1
        );
      }),
      `Natural content fits ${name}`,
    );
    await toggle.click();
    await settle();
  }
  await page.locator('.reading-scroll').evaluate((el) => (el.scrollTop = 120));
  const scroll = await page.locator('.reading-scroll').evaluate((el) => el.scrollTop);
  await question
    .locator('button')
    .first()
    .evaluate((el) => el.click());
  await settle();
  check(
    Math.abs((await page.locator('.reading-scroll').evaluate((el) => el.scrollTop)) - scroll) < 3,
    'Disclosure does not reset reading scroll',
  );
  await page.getByRole('button', { name: /View .* import warnings/ }).click();
  await page.waitForTimeout(50);
  const enteringDialog = await page.locator('.warning-dialog').evaluate((el) => ({
    opacity: Number(getComputedStyle(el).opacity),
    backdrop: Number(getComputedStyle(el, '::backdrop').opacity),
  }));
  check(
    enteringDialog.opacity > 0 && enteringDialog.opacity < 1,
    'Warning dialog has an intermediate entrance opacity',
  );
  check(
    enteringDialog.backdrop > 0 && enteringDialog.backdrop < 1,
    'Warning backdrop fades in with the dialog',
  );
  await settle();
  const technical = page.getByRole('button', { name: 'Technical details', exact: true }).first();
  await technical.click();
  await settle();
  check(
    (await technical.getAttribute('aria-expanded')) === 'true',
    'Warning technical details use accessible disclosure',
  );
  await technical.click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  check(
    await page
      .locator('.warning-dialog')
      .evaluate(
        (el) =>
          el.open &&
          Number(getComputedStyle(el).opacity) > 0 &&
          Number(getComputedStyle(el).opacity) < 1,
      ),
    'Warning remains modal during its exit fade',
  );
  await settle();
  check(
    await page
      .getByRole('button', { name: /View .* import warnings/ })
      .evaluate((el) => el === document.activeElement),
    'Warning exit restores trigger focus',
  );
  await page.locator('.reading-scroll').evaluate((el) => (el.scrollTop = 500));
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  check(
    (await page.locator('.reading-scroll').evaluate((el) => el.scrollTop)) === 0,
    'Group navigation keeps intentional scroll reset',
  );
  for (const name of ['Key Points', 'Explanation']) {
    const toggle = page.getByRole('button', { name, exact: true });
    await toggle.click();
    await settle();
    check(
      await toggle.evaluate((el) => {
        const panel = document.getElementById(el.getAttribute('aria-controls'));
        return (
          Math.abs(
            panel.getBoundingClientRect().height -
              panel.firstElementChild.getBoundingClientRect().height,
          ) < 1
        );
      }),
      `Group ${name} fits without clipping`,
    );
    await toggle.click();
    await settle();
  }
  await settle();
  const sidebar = await page.locator('.sidebar-heading').evaluate(async (node) => {
    const before = node.getBoundingClientRect().width;
    document.querySelector('.sidebar-toggle').click();
    await new Promise((r) => setTimeout(r, 60));
    return {
      before,
      during: node.getBoundingClientRect().width,
      track: node.parentElement.getBoundingClientRect().width,
    };
  });
  check(
    sidebar.before === sidebar.during && sidebar.track > 0 && sidebar.track < sidebar.before,
    'Sidebar clips stable-width labels while its track animates',
  );
  await settle();
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await settle();
  await page.setViewportSize({ width: 390, height: 844 });
  const reader = await page.locator('.reader').elementHandle();
  await page.getByRole('button', { name: 'Back to question list' }).click();
  await page.locator('.question-row').nth(1).click();
  check(
    await reader.evaluate((el) => el === document.querySelector('.reader')),
    'Mobile return to the same group preserves Reader identity',
  );
  check(
    await page.locator('.reader').evaluate((el) => el.getAnimations().length > 0),
    'Mobile reading return fades without remounting',
  );
  await page.setViewportSize({ width: 320, height: 568 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Mobile layout has no horizontal overflow',
  );
  const mobileQuestion = page.locator('.part-section .collapse-toggle').first();
  await mobileQuestion.click();
  await settle();
  await mobileQuestion.click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(30);
  check(
    (await page.locator('.part-section .collapse-content').count()) === 0,
    'Live reduced motion finishes a pending exit immediately',
  );
  check(
    await page
      .locator('.collapse-shell')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration === '0s'),
    'Reduced motion removes panel transitions',
  );
  check(
    await page.locator('.reader').evaluate((el) => getComputedStyle(el).animationName === 'none'),
    'Reduced motion removes view fades',
  );
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.keyboard.press('Escape');
  check(
    (await page.locator('.settings-menu').count()) === 0,
    'Reduced motion removes Settings immediately',
  );
  check(errors.length === 0, 'No uncaught browser errors: ' + errors.join('; '));
  check(remote.length === 0, 'No remote media or question requests');
  await page.screenshot({ path: `${root}/mobile-${engine}.png`, animations: 'disabled' });
  const legacy = await context.newPage();
  await legacy.addInitScript(() => {
    delete window.ResizeObserver;
  });
  await legacy.goto(base);
  await legacy.getByRole('button', { name: 'Where are my question files?' }).click();
  await legacy.getByRole('tab', { name: 'Android' }).click();
  await legacy.waitForTimeout(240);
  check(
    await legacy
      .locator('.folder-guide-shell')
      .evaluate((el) => el.clientHeight >= el.firstElementChild.getBoundingClientRect().height - 1),
    'Missing ResizeObserver keeps disclosure contents readable',
  );
  await legacy.locator('input[type=file][accept]').setInputFiles(zip);
  await legacy.locator('.paper-row').filter({ hasText: 'paper' }).click();
  await legacy.locator('.part-section .collapse-toggle').first().click();
  await legacy.waitForTimeout(240);
  check(
    await legacy
      .locator('.part-section .collapse-shell')
      .first()
      .evaluate(
        (el) =>
          el.clientHeight > 0 &&
          el.clientHeight >= el.firstElementChild.getBoundingClientRect().height - 1,
      ),
    'Missing ResizeObserver keeps lazy question content readable',
  );
  await legacy.close();
  console.log(
    JSON.stringify(
      { engine, version: browser.version(), checks, realDevices: 'not tested' },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server?.kill();
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
const base = process.env.ETS_BASE_URL || 'http://127.0.0.1:4178';
const engine = process.env.ETS_BROWSER_ENGINE || 'chromium';
const WINDOWS = '%APPDATA%\\ETS';
const ANDROID =
  '/storage/emulated/0/Android/data/com.ets100.secondary/files/Download/ETS_SECONDARY/resource';
const root = '.qa/folder-locations';
let server,
  browser,
  checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
try {
  await mkdir(root, { recursive: true });
  if (!process.env.ETS_BASE_URL) {
    server = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4178',
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
  });
  if (engine === 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await context.newPage(),
    errors = [],
    remote = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
      remote.push(request.url());
  });
  await page.goto(base);
  await page.getByRole('button', { name: 'Select Folder', exact: true }).waitFor();
  const toggle = page.getByRole('button', { name: 'Where are my question files?', exact: true });
  check((await toggle.getAttribute('aria-expanded')) === 'false', 'Initially collapsed');
  check(
    (await page.getByRole('tab').count()) === 0,
    'Collapsed contents excluded from accessibility tree',
  );
  const collapsed = await page.locator('.folder-guide').boundingBox();
  check(collapsed.height <= 48, 'Collapsed guide remains compact');
  const actions = await page.locator('.import-actions').boundingBox(),
    privacy = await page.locator('.privacy').boundingBox();
  check(
    actions.y + actions.height < collapsed.y && collapsed.y + collapsed.height < privacy.y,
    'Guide sits between import controls and privacy',
  );
  check(
    await page
      .locator('.import-actions')
      .evaluate((el) => getComputedStyle(el).flexDirection === 'row'),
    'Desktop import buttons stay side by side',
  );
  await page.screenshot({ path: root + '/collapsed-' + engine + '.png' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Windows' }).waitFor();
  check(
    (await page.getByRole('tabpanel').locator('code').textContent()) === WINDOWS,
    'Exact Windows path',
  );
  check(
    (await page.getByRole('tab', { name: 'Windows' }).getAttribute('aria-selected')) === 'true',
    'Windows selected by default',
  );
  check(
    await page
      .getByText('Press Win + R, paste the path, and press Enter.', { exact: true })
      .isVisible(),
    'Windows instruction',
  );
  check(
    await page
      .locator('.folder-guide-shell')
      .evaluate((el) => getComputedStyle(el).transitionDuration.includes('0.2s')),
    'Disclosure uses a 200ms transition',
  );
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight');
  check(
    await page
      .getByRole('tab', { name: 'Android' })
      .evaluate(
        (el) => el === document.activeElement && el.getAttribute('aria-selected') === 'true',
      ),
    'Arrow keys select and focus Android',
  );
  check(
    (await page.getByRole('tabpanel').locator('code').textContent()) === ANDROID,
    'Exact Android path',
  );
  check(
    await page
      .getByText(
        'Android may restrict access to this folder. If necessary, import an accessible copy or ZIP archive.',
        { exact: true },
      )
      .isVisible(),
    'Android restriction note',
  );
  check(
    await page
      .getByText('Locations may vary by app version and device.', { exact: true })
      .isVisible(),
    'Location disclaimer',
  );
  const copyAndroid = page.getByRole('button', { name: 'Copy Android folder path' });
  if (engine === 'chromium') {
    await copyAndroid.click();
    await page.getByText('Copied', { exact: true }).waitFor();
    check(
      (await page.evaluate(() => navigator.clipboard.readText())) === ANDROID,
      'Actual clipboard contains exact Android path',
    );
    await page.getByRole('tab', { name: 'Windows' }).click();
    await page.getByRole('button', { name: 'Copy Windows folder path' }).click();
    await page.getByText('Copied', { exact: true }).waitFor();
    check(
      (await page.evaluate(() => navigator.clipboard.readText())) === WINDOWS,
      'Actual clipboard contains exact Windows path',
    );
  }
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied');
        },
      },
    });
  });
  await page.getByRole('tab', { name: 'Windows' }).click();
  await page.getByRole('button', { name: 'Copy Windows folder path' }).click();
  await page
    .getByText('Could not copy. Select the path and copy it manually.', { exact: true })
    .waitFor();
  check(
    (await page.getByText('Copied', { exact: true }).count()) === 0,
    'Clipboard failure does not claim success',
  );
  await page.getByRole('tab', { name: 'Android' }).click();
  await page.waitForTimeout(240);
  await page.screenshot({ path: root + '/desktop-' + engine + '.png', animations: 'disabled' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      width + 'px viewport has no horizontal overflow',
    );
    const box = await copyAndroid.boundingBox();
    check(
      box.x >= 0 && box.x + box.width <= width && box.height >= 36,
      'Copy stays within narrow viewport and has a usable tap target',
    );
    check(
      await page
        .locator('.import-actions')
        .evaluate((el) => getComputedStyle(el).flexDirection === 'column'),
      'Mobile import buttons remain stacked',
    );
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  await page.keyboard.press('Escape');
  check(
    (await page.locator('html').getAttribute('data-theme')) === 'light',
    'Existing Light theme works',
  );
  await page.waitForTimeout(240);
  await page.screenshot({
    path: root + '/mobile-light-' + engine + '.png',
    animations: 'disabled',
  });
  check(
    await page.evaluate(() => Object.keys(localStorage).length === 1),
    'Only the existing theme preference is persisted',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check(
    await page
      .locator('.folder-guide-shell')
      .evaluate((el) => getComputedStyle(el).transitionDuration === '0s'),
    'Reduced motion disables disclosure transition',
  );
  check(
    await page
      .locator('.folder-guide-toggle > svg:last-child')
      .evaluate((el) => getComputedStyle(el).transitionDuration === '0s'),
    'Reduced motion disables chevron transition',
  );
  await toggle.click();
  check(
    (await page.getByRole('tab').count()) === 0,
    'Collapse hides tabs from accessibility immediately',
  );
  await toggle.click();
  check(
    (await page.getByRole('tab', { name: 'Android' }).getAttribute('aria-selected')) === 'true',
    'Platform preserved across collapse',
  );
  await page.reload();
  check(
    (await toggle.getAttribute('aria-expanded')) === 'false',
    'Reload starts collapsed without saved state',
  );
  await toggle.click();
  check(
    (await page.getByRole('tab', { name: 'Windows' }).getAttribute('aria-selected')) === 'true',
    'Reload defaults to Windows without platform persistence',
  );
  const folderPicker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Select Folder', exact: true }).click();
  check(
    (await folderPicker).isMultiple(),
    'Folder import still opens the multiple-file folder picker',
  );
  const zipPicker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import ZIP', exact: true }).click();
  check(!(await zipPicker).isMultiple(), 'ZIP import still opens the single-file picker');
  check(errors.length === 0, 'No page errors: ' + errors.join(', '));
  check(remote.length === 0, 'No external requests');
  console.log(
    JSON.stringify(
      {
        engine,
        version: browser.version(),
        checks,
        clipboard:
          engine === 'chromium'
            ? 'Native copy/read verified for both exact paths'
            : 'Failure handling verified; native clipboard not read',
        mobile: '320px/390px emulation',
        screenshots: root,
      },
      null,
      2,
    ),
  );
} catch (error) {
  for (const context of browser?.contexts() || [])
    for (const page of context.pages())
      await page.screenshot({ path: root + '/failure-' + engine + '.png' }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}

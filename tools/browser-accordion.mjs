import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { zipSync, strToU8 } from 'fflate';

const engine = process.env.ETS_BROWSER_ENGINE || 'chromium';
const probe = process.env.ETS_ACCORDION_PROBE === '1';
const port = engine === 'webkit' ? 4195 : 4194;
const base = process.env.ETS_BASE_URL || `http://127.0.0.1:${port}`;
const root = '.qa/accordion';
let server,
  browser,
  checks = 0,
  maxDrift = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};

// Sample text glyph bounds and the header box every animation frame. Starting
// before real pointer/key input also covers the pressed and focused states.
async function sample(button, action) {
  await button.scrollIntoViewIfNeeded();
  await button.evaluate((node) => {
    const read = () => {
      const label = node.querySelector('.collapse-label');
      const range = document.createRange();
      range.selectNodeContents(label.firstChild);
      const text = range.getBoundingClientRect(),
        box = node.getBoundingClientRect();
      const icon = node.querySelector('svg').getBoundingClientRect();
      const style = getComputedStyle(node),
        scroll = document.querySelector('.reading-scroll');
      const panel = document.getElementById(node.getAttribute('aria-controls'));
      return {
        x: text.x,
        y: text.y,
        w: text.width,
        h: text.height,
        headerY: box.y,
        headerH: box.height,
        headerW: box.width,
        border: style.borderBottomWidth,
        padding: style.padding,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        transform: style.transform,
        iconW: icon.width,
        iconH: icon.height,
        iconLayoutW: getComputedStyle(node.querySelector('svg')).width,
        iconLayoutH: getComputedStyle(node.querySelector('svg')).height,
        iconTransform: getComputedStyle(node.querySelector('svg')).transform,
        panelH: panel.getBoundingClientRect().height,
        scrollTop: scroll.scrollTop,
        clientWidth: scroll.clientWidth,
        scrollHeight: scroll.scrollHeight,
        clientHeight: scroll.clientHeight,
      };
    };
    const frames = [read()];
    window.accordionFrames = new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        frames.push(read());
        if (performance.now() - start < 340) requestAnimationFrame(tick);
        else resolve(frames);
      };
      requestAnimationFrame(tick);
    });
  });
  await action();
  return button.page().evaluate(() => window.accordionFrames);
}
function drift(frames) {
  return Math.max(
    ...frames.map((frame) =>
      Math.max(Math.abs(frame.x - frames[0].x), Math.abs(frame.y - frames[0].y)),
    ),
  );
}
try {
  await mkdir(root, { recursive: true });
  const document = {
    structure_type: 'collector.role',
    info: {
      stid: 'accordion',
      value: 'Original shared material. '.repeat(90),
      question: [
        {
          xh: '23',
          ask: '<p>Original question prompt with a longer description.</p>'.repeat(50),
          std: [
            { value: 'First stored answer.' },
            { value: 'Additional answer. '.repeat(170) },
            { value: 'Third reference answer.' },
          ],
        },
      ],
    },
  };
  const zip = `${root}/bank.zip`;
  await writeFile(
    zip,
    zipSync({ 'bank/paper/content_1/content.json': strToU8(JSON.stringify(document)) }),
  );
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
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  browser = await (engine === 'webkit' ? webkit : chromium).launch({
    headless: true,
    ...(engine === 'chromium' && process.platform === 'win32'
      ? { channel: 'msedge', args: ['--disable-features=OverlayScrollbar,FluentOverlayScrollbar'] }
      : {}),
  });
  const combos =
    probe || process.env.ETS_ACCORDION_QUICK === '1'
      ? [{ width: 1280, locale: 'en', theme: 'light' }]
      : [1280, 390, 320].flatMap((width) =>
          ['en', 'zh-CN'].flatMap((locale) =>
            ['light', 'dark'].map((theme) => ({ width, locale, theme })),
          ),
        );
  const findings = [];
  for (const { width, locale, theme } of combos) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true });
    await context.addInitScript(
      ({ locale, theme }) => {
        localStorage.setItem('ets-language', locale);
        localStorage.setItem('ets-appearance', theme);
        Object.defineProperty(navigator, 'languages', { configurable: true, value: [locale] });
      },
      { locale, theme },
    );
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base);
    await page.locator('input[accept*="zip"]').setInputFiles(zip);
    await page.locator('.paper-row').first().click();
    if (width <= 720) await page.locator('.question-row').first().click();
    await page.waitForTimeout(180);
    check(
      (await page.locator('html').getAttribute('lang')) === locale,
      `Requested locale ${locale} is active`,
    );
    check(
      (await page.locator('html').getAttribute('data-theme')) === theme,
      `Requested theme ${theme} is active`,
    );
    const buttons = page.locator('.collapse-toggle');
    await buttons.first().waitFor();
    if (probe) {
      const variants = [
        { name: 'current', css: '' },
        { name: 'reserved-border', css: '.collapse-toggle {border-bottom:1px solid transparent;}' },
        {
          name: 'reserved-border-and-gutter',
          css: '.collapse-toggle {border-bottom:1px solid transparent;} .reading-scroll {scrollbar-gutter:stable;}',
        },
      ];
      for (const variant of variants) {
        const style = variant.css ? await page.addStyleTag({ content: variant.css }) : null;
        for (const index of [2, 1, 0]) {
          const button = buttons.nth(index);
          const frames = await sample(button, () => button.click());
          findings.push({
            variant: variant.name,
            section: index,
            drift: drift(frames),
            before: frames[0],
            after: frames.at(-1),
          });
          await button.click();
          await page.waitForTimeout(240);
        }
        await style?.evaluate((node) => node.remove());
      }
      console.log(JSON.stringify({ engine, findings }, null, 2));
      await writeFile(`${root}/probe-${engine}.json`, JSON.stringify(findings, null, 2));
      await context.close();
      continue;
    }
    const modes = width > 720 ? ['mouse', 'keyboard'] : ['touch', 'keyboard'];
    for (const mode of modes) {
      for (const index of [2, 1, 0]) {
        const button = buttons.nth(index);
        if (mode === 'keyboard') await button.focus();
        const activate = () =>
          mode === 'keyboard'
            ? button.press(index === 1 ? 'Space' : 'Enter')
            : mode === 'touch'
              ? button.tap()
              : button.click();
        for (const expanded of [true, false]) {
          const frames = await sample(button, activate),
            amount = drift(frames);
          maxDrift = Math.max(maxDrift, amount);
          const name = `${engine}/${width}/${locale}/${theme}/${mode}/section${index}/${expanded ? 'open' : 'close'}`;
          check(
            amount <= 0.02,
            `${name}: glyphs moved ${amount}px: ${JSON.stringify({ before: frames[0], after: frames.at(-1) })}`,
          );
          check(
            frames.every(
              (frame) =>
                Math.abs(frame.headerH - frames[0].headerH) <= 0.02 &&
                Math.abs(frame.headerW - frames[0].headerW) <= 0.02,
            ),
            `${name}: header dimensions changed`,
          );
          check(
            frames.every((frame) => frame.transform === 'none'),
            `${name}: header transformed`,
          );
          check(
            frames.every((frame) => frame.iconLayoutW === '16px' && frame.iconLayoutH === '16px'),
            `${name}: chevron layout box must remain fixed`,
          );
          const fullHeight = Math.max(...frames.map((frame) => frame.panelH));
          check(
            fullHeight > 0 &&
              frames.some((frame) => frame.panelH > 0.5 && frame.panelH < fullHeight - 0.5),
            `${name}: expansion/collapse must include intermediate heights`,
          );
          check(
            (await button.getAttribute('aria-expanded')) === String(expanded),
            `${name}: expansion state`,
          );
          const panel = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`);
          check(
            (await panel.evaluate((node) => node.inert)) === !expanded,
            `${name}: hidden content accessibility`,
          );
          const timing = await panel.evaluate(
            (node) => parseFloat(getComputedStyle(node).transitionDuration) * 1000,
          );
          check(timing >= 180 && timing <= 220, `${name}: content duration ${timing}ms`);
          const icon = button.locator('svg');
          check(
            (await icon.evaluate(
              (node) => parseFloat(getComputedStyle(node).transitionDuration) * 1000,
            )) === timing,
            `${name}: chevron duration matches content`,
          );
          if (mode === 'keyboard') {
            check(
              await button.evaluate(
                (node) =>
                  node === document.activeElement && getComputedStyle(node).outlineStyle !== 'none',
              ),
              `${name}: keyboard focus remains visible`,
            );
            check(
              await button.evaluate((node) => {
                const style = getComputedStyle(node),
                  rect = node.getBoundingClientRect(),
                  clip = node.parentElement.getBoundingClientRect();
                const outset = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
                return (
                  rect.x - outset >= clip.x &&
                  rect.right + outset <= clip.right &&
                  rect.y - outset >= clip.y &&
                  rect.bottom + outset <= clip.bottom
                );
              }),
              `${name}: card overflow must not clip the keyboard focus outline`,
            );
          }
        }
      }
    }
    // Current translations plus an intentionally long label at the narrowest
    // width exercise wrapping without changing any shipped translation.
    if (width === 320) {
      await buttons.nth(2).evaluate((node) => {
        node.querySelector('.collapse-label').firstChild.textContent +=
          ' — Additional accepted reference answer variants';
      });
      for (const expanded of [true, false]) {
        const frames = await sample(buttons.nth(2), () => buttons.nth(2).tap());
        check(
          drift(frames) <= 0.02,
          `${locale}/${theme}: wrapped long label remains stationary (${expanded})`,
        );
      }
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'Long labels do not cause horizontal page overflow',
      );
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await sample(buttons.nth(2), () => buttons.nth(2).click());
    check(
      drift(reduced) <= 0.02,
      `${width}/${locale}/${theme}: reduced motion label remains stationary`,
    );
    check(
      await buttons
        .nth(2)
        .locator('svg')
        .evaluate((node) => getComputedStyle(node).transitionDuration === '0s'),
      'Reduced motion disables chevron transition',
    );
    await buttons.nth(2).click();
    check(errors.length === 0, 'No browser errors: ' + errors.join(';'));
    console.log(JSON.stringify({ engine, width, locale, theme, checks, maxDrift }));
    await context.close();
  }
  if (!probe)
    console.log(
      JSON.stringify(
        { engine, version: browser.version(), checks, maxDrift, realDevices: 'not tested' },
        null,
        2,
      ),
    );
} finally {
  await browser?.close();
  server?.kill();
}

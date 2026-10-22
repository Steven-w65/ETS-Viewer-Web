import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit, firefox } from 'playwright';
import { zipSync, strToU8 } from 'fflate';
import { silentMp3, syntheticMp4 } from './media-fixtures.mjs';
const base = process.env.ETS_BASE_URL || 'http://127.0.0.1:4176',
  root = path.resolve('.qa/media-browser'),
  engine = process.env.ETS_BROWSER_ENGINE || 'chromium';
let server, browser, generator;
let checks = 0;
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
        '4176',
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
  generator = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32'
      ? { channel: process.env.ETS_BROWSER_CHANNEL || 'msedge' }
      : {}),
  });
  const capture = await generator.newPage();
  await capture.goto(base);
  const mp4 = await syntheticMp4(capture);
  await generator.close();
  generator = null;
  const jpeg = await readFile('tests/media-fixtures/rotated.jpg'),
    mp3 = silentMp3();
  const document = {
    structure_type: 'collector.role',
    info: {
      stid: 'media',
      value: 'Shared transcript.',
      audio: 'shared.mp3',
      image: 'material/%E5%9B%BE%20%E7%89%87.jpg',
      question: [
        {
          xh: '1',
          ask: 'Original question.',
          askaudio: 'nested/ask.mp3',
          askvideo: 'material/question%20clip.mp4',
          std: [{ value: 'First stored answer' }, { value: 'Second stored answer' }],
        },
        {
          xh: '2',
          ask: '<p>Inline media.</p><video autoplay loop poster="https://evil.invalid/poster.jpg" onplay="globalThis.mediaPwned=1"><source src="https://evil.invalid/remote.mp4"><source src="inline.mp4"></video>',
          std: [{ value: 'Inline stored answer' }],
        },
        {
          xh: '3',
          ask: 'Missing audio.',
          askaudio: 'missing.mp3',
          std: [{ value: 'Missing resource answer' }],
        },
        {
          xh: '4',
          ask: 'Unsupported video.',
          askvideo: 'corrupt.mp4',
          std: [{ value: 'Unsupported resource answer' }],
        },
      ],
    },
  };
  const other = {
    structure_type: 'collector.read',
    info: { stid: 'other', value: 'Other question.' },
  };
  const records = {
    'bank/paper/content_media/content2.json': strToU8(JSON.stringify(document)),
    'bank/paper/content_media/material/shared.mp3': mp3,
    'bank/paper/content_media/material/nested/ask.mp3': mp3,
    'bank/paper/content_media/material/question clip.mp4': mp4,
    'bank/paper/content_media/material/inline.mp4': mp4,
    'bank/paper/content_media/material/图 片.jpg': jpeg,
    'bank/paper/content_media/material/unreferenced.mp4': mp4,
    'bank/paper/content_media/material/corrupt.mp4': new Uint8Array([
      0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 109, 112, 52, 50,
    ]),
    'bank/paper/content_other/content.json': strToU8(JSON.stringify(other)),
  };
  const zip = path.join(root, 'media.zip');
  await writeFile(zip, zipSync(records));
  const rootless = path.join(root, 'rootless.zip');
  await writeFile(
    rootless,
    zipSync(
      Object.fromEntries(Object.entries(records).map(([name, bytes]) => [name.slice(5), bytes])),
    ),
  );
  for (const [name, bytes] of Object.entries(records)) {
    const dest = path.join(root, name);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
  }
  browser = await { chromium, webkit, firefox }[engine].launch({
    headless: true,
    ...(engine === 'chromium' && process.platform === 'win32'
      ? { channel: process.env.ETS_BROWSER_CHANNEL || 'msedge' }
      : {}),
  });
  const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: 'dark',
    }),
    page = await context.newPage(),
    errors = [],
    remote = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { configurable: true, value: ['en-US'] });
    globalThis.activeMediaURLs = new Set();
    const make = URL.createObjectURL.bind(URL),
      release = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = make(blob);
      globalThis.activeMediaURLs.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      globalThis.activeMediaURLs.delete(url);
      release(url);
    };
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
      remote.push(request.url());
  });
  await page.goto(base);
  const capabilities = await page.evaluate(
    async ({ audio, video }) => {
      globalThis.mediaPolicyViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        if (event.effectiveDirective === 'media-src')
          globalThis.mediaPolicyViolations.push(event.blockedURI);
      });
      const probe = (kind, bytes, mime) =>
        new Promise((resolve) => {
          const el = document.createElement(kind),
            url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
          const finish = (status) => {
            clearTimeout(timer);
            el.pause();
            el.removeAttribute('src');
            el.load();
            URL.revokeObjectURL(url);
            resolve(status);
          };
          const timer = setTimeout(() => finish('timeout'), 5000);
          el.onloadedmetadata = () => finish('supported');
          el.onerror = () => finish('native-error-' + el.error?.code);
          el.src = url;
          el.preload = 'metadata';
        });
      return {
        audio: await probe('audio', audio, 'audio/mpeg'),
        video: await probe('video', video, 'video/mp4'),
      };
    },
    { audio: [...mp3], video: [...mp4] },
  );
  check(
    capabilities.audio !== 'timeout' && capabilities.video !== 'timeout',
    'Native codec probes finish with support or an explicit error',
  );
  const playable = capabilities.audio === 'supported' && capabilities.video === 'supported';
  await page.locator('input[accept]').setInputFiles(zip);
  await page.locator('.paper-row').click();
  await page.getByText('First stored answer', { exact: true }).waitFor();
  check((await page.locator('audio,video').count()) === 0, 'Owned media starts collapsed');
  check(
    (await page.locator('.question-row').count()) === 2,
    'content/content2 resources produce the expected group count',
  );
  const toggle = page
    .locator('.part-section')
    .first()
    .getByRole('button', { name: /^Question / });
  await toggle.click();
  if (playable) {
    await page.locator('.part-section').first().locator('audio').waitFor();
    await page.locator('.part-section').first().locator('video').waitFor();
    check(
      (await page.locator('audio').count()) === 1 && (await page.locator('video').count()) === 1,
      'Only current question media is rendered',
    );
    check(
      (await page.locator('img[src$=".mp3"],img[src$=".mp4"]').count()) === 0,
      'Audio/video never receive image rendering',
    );
    const audio = page.locator('audio').first(),
      video = page.locator('video').first();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('audio,video')].every(
        (el) => el.readyState >= 1 && Number.isFinite(el.duration),
      ),
    );
    check(
      await audio.evaluate(
        (el) => el.controls && !el.autoplay && !el.loop && el.preload === 'metadata',
      ),
      'Audio uses native controls without autoplay/loop',
    );
    check(
      await video.evaluate(
        (el) =>
          el.controls && !el.autoplay && !el.loop && el.playsInline && el.preload === 'metadata',
      ),
      'Video uses native inline controls without autoplay/loop',
    );
    await audio.evaluate(async (el) => {
      await el.play();
    });
    await page.waitForFunction(() => document.querySelector('audio').currentTime > 0.05);
    check(await audio.evaluate((el) => !el.paused), 'Synthetic MP3 really plays');
    await audio.evaluate((el) => {
      el.pause();
      el.currentTime = 0.3;
    });
    check(await audio.evaluate((el) => Math.abs(el.currentTime - 0.3) < 0.1), 'MP3 seeking works');
    await video.evaluate(async (el) => {
      await el.play();
    });
    await page.waitForFunction(() => document.querySelector('video').currentTime > 0.05);
    check(await video.evaluate((el) => !el.paused), 'Native H264 MP4 really plays');
    await page.evaluate(() => {
      globalThis.oldVideo = document.querySelector('video');
      globalThis.oldAudio = document.querySelector('audio');
    });
    await toggle.click();
    check(
      await page.evaluate(() => globalThis.oldVideo.paused && globalThis.oldAudio.paused),
      'Collapse pauses current media immediately',
    );
    await page.locator('.part-section').first().locator('video').waitFor({ state: 'detached' });
    check(
      await page.evaluate(() => globalThis.activeMediaURLs.size === 0),
      'URLs release after the collapse transition',
    );
  } else {
    for (const kind of ['audio', 'video'])
      if (capabilities[kind] !== 'supported')
        await page
          .locator('.part-section')
          .first()
          .getByText(
            new RegExp(
              `This ${kind} format is not supported|${kind[0].toUpperCase() + kind.slice(1)} unavailable`,
            ),
          )
          .waitFor();
    check(true, 'Unavailable platform codecs receive accurate audio/video fallbacks');
    await toggle.click();
    await page
      .locator('.part-section')
      .first()
      .locator('.collapse-content')
      .waitFor({ state: 'detached' });
  }
  await page.getByRole('button', { name: /Shared Material/ }).click();
  await page.locator('img.source-image').waitFor();
  check(
    await page
      .locator('img.source-image')
      .evaluate((img) => img.naturalWidth === 24 && img.naturalHeight === 48),
    'EXIF-oriented JPEG decodes with the correct displayed dimensions',
  );
  if (capabilities.audio === 'supported')
    check(
      (await page.locator('.shared-material audio').count()) === 1,
      'Shared audio remains in Shared Material',
    );
  check(
    await page
      .locator('.collapse-shell')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration.split(',')[0] === '0.2s'),
    'Existing collapse duration remains 200ms',
  );
  if (playable) {
    await toggle.click();
    await page.locator('.part-section').first().locator('video').waitFor();
    await page
      .locator('.part-section')
      .first()
      .locator('video')
      .evaluate(async (el) => {
        await el.play();
        globalThis.navigatedVideo = el;
      });
  }
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('heading', { name: 'Question other', exact: true }).waitFor();
  if (playable)
    check(
      await page.evaluate(() => globalThis.navigatedVideo.paused),
      'Group navigation pauses old video',
    );
  check(
    await page.evaluate(() => globalThis.activeMediaURLs.size === 0),
    'Group navigation releases unused media URLs',
  );
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByText('First stored answer', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('.part-section')
    .first()
    .getByRole('button', { name: /^Question / })
    .click();
  if (playable) {
    await page.locator('.part-section').first().locator('video').waitFor();
    await page
      .locator('.part-section')
      .first()
      .locator('video')
      .evaluate(async (el) => {
        await el.play();
        globalThis.mobileVideo = el;
      });
  }
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Mobile native controls do not overflow',
  );
  await page.setViewportSize({ width: 320, height: 740 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Native controls also fit a 320px viewport',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, `mobile-${engine}.png`), animations: 'disabled' });
  await page.getByRole('button', { name: 'Back to question list' }).click();
  if (playable)
    check(
      await page.evaluate(() => globalThis.mobileVideo.paused),
      'Leaving mobile reading pauses video',
    );
  check((await page.locator('video').count()) === 0, 'Hidden reader releases media components');
  await page.locator('.question-row').first().click();
  if (playable) {
    await page.locator('.part-section').first().locator('video').waitFor();
    check(
      await page
        .locator('.part-section')
        .first()
        .locator('video')
        .evaluate((el) => el.paused),
      'Returning to reading never resumes automatically',
    );
  }
  await page
    .locator('.part-section')
    .nth(1)
    .getByRole('button', { name: /^Question / })
    .click();
  if (playable) {
    await page.locator('.part-section').nth(1).locator('video').waitFor();
    check(
      await page
        .locator('.part-section')
        .nth(1)
        .locator('video')
        .evaluate((el) => !el.autoplay && !el.loop && !el.hasAttribute('poster')),
      'Safe inline source references do not copy unsafe playback attributes',
    );
  }
  await page
    .locator('.part-section')
    .nth(2)
    .getByRole('button', { name: /^Question / })
    .click();
  await page.getByText('Audio unavailable: missing.mp3', { exact: true }).waitFor();
  check(true, 'Missing MP3 uses an audio fallback');
  await page
    .locator('.part-section')
    .nth(3)
    .getByRole('button', { name: /^Question / })
    .click();
  await page
    .locator('.part-section')
    .nth(3)
    .getByText(/This video format is not supported|Video unavailable/)
    .waitFor();
  check(true, 'A present undecodable MP4 receives a codec/playback fallback');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Change Bank', exact: true }).click();
  check(
    await page.evaluate(() => globalThis.activeMediaURLs.size === 0),
    'Changing banks releases all remaining URLs',
  );
  const verifyImport = async (message) => {
    await page.locator('.paper-row').click();
    await page.getByText('First stored answer', { exact: true }).waitFor();
    await page
      .locator('.part-section')
      .first()
      .getByRole('button', { name: /^Question / })
      .click();
    if (playable) {
      await page.locator('.part-section').first().locator('video').waitFor();
      check((await page.locator('audio,video').count()) === 2, message);
    } else {
      for (const kind of ['audio', 'video'])
        if (capabilities[kind] !== 'supported')
          await page
            .locator('.part-section')
            .first()
            .getByText(
              new RegExp(
                `This ${kind} format is not supported|${kind[0].toUpperCase() + kind.slice(1)} unavailable`,
              ),
            )
            .waitFor();
      check(true, message + ' (native codec fallback)');
    }
  };
  await page.locator('input[webkitdirectory]').setInputFiles(path.join(root, 'bank'));
  await verifyImport('Folder import retains the same owned audio/video as ZIP');
  await page.getByRole('button', { name: 'Change Bank', exact: true }).click();
  await page.locator('input[accept]').setInputFiles(rootless);
  await verifyImport('ZIP without a wrapper preserves local media ownership');
  check(remote.length === 0, 'No imported media makes remote requests');
  check(
    await page.evaluate(() => globalThis.mediaPwned === undefined),
    'Imported media handlers never execute',
  );
  check(errors.length === 0, `No browser page errors: ${errors.join(', ')}`);
  check(
    await page.evaluate(() => globalThis.mediaPolicyViolations.length === 0),
    'Security policy permits local Blob media',
  );
  console.log(
    JSON.stringify(
      {
        engine,
        version: browser.version(),
        checks,
        nativeCodecs: capabilities,
        mp3: playable ? 'PLAYED' : 'not played; native codec unavailable',
        mp4: playable ? 'PLAYED' : 'not played; native codec unavailable',
        mobile: 'EMULATED',
        realDevices: 'not tested',
      },
      null,
      2,
    ),
  );
} catch (error) {
  for (const context of browser?.contexts() || [])
    for (const [i, page] of context.pages().entries())
      await page
        .screenshot({ path: path.join(root, `failure-${engine}-${i}.png`) })
        .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await generator?.close();
  server?.kill();
}

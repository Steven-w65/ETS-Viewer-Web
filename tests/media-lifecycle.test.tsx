import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MediaResources } from '../src/core/media/resources';
import { LocalMedia } from '../src/components/LocalMedia';
import { Reader } from '../src/components/Reader';
import { parseDocument } from '../src/core/parser';
const source = 'bank/p/content_1/content.json';
const audio = new Blob([new Uint8Array([255, 251, 144, 192, 0, 0, 0, 0])]);
const video = new Blob([
  new Uint8Array([
    0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 109, 112, 52, 50,
  ]),
]);
const make = () =>
  new MediaResources(
    new Map([
      ['bank/p/content_1/material/a.mp3', audio],
      ['bank/p/content_1/material/v.mp4', video],
    ]),
  );
const create = vi.fn(),
  revoke = vi.fn(),
  pause = vi.fn(),
  load = vi.fn();
beforeEach(() => {
  let n = 0;
  create.mockReset().mockImplementation(() => `blob:media-${++n}`);
  revoke.mockReset();
  pause.mockReset();
  load.mockReset();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(load);
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('shares URLs during use, revokes only on final release and supports reacquisition', async () => {
  const r = make(),
    a = await r.acquire('a.mp3', source),
    b = await r.acquire('a.mp3', source);
  expect(a.url).toBe(b.url);
  expect(create).toHaveBeenCalledTimes(1);
  a.release();
  expect(revoke).not.toHaveBeenCalled();
  r.dispose();
  expect(revoke).not.toHaveBeenCalled();
  b.release();
  expect(revoke).toHaveBeenCalledTimes(1);
  await expect(r.acquire('a.mp3', source)).rejects.toMatchObject({
    diagnostic: { category: 'blob_lifecycle' },
  });
  const next = make(),
    first = await next.acquire('a.mp3', source);
  first.release();
  const second = await next.acquire('a.mp3', source);
  expect(second.url).not.toBe(first.url);
  second.release();
  next.dispose();
});
it('does not create a URL if the bank is disposed during pending validation', async () => {
  const r = make(),
    pending = r.acquire('a.mp3', source);
  r.dispose();
  await expect(pending).rejects.toMatchObject({ diagnostic: { category: 'blob_lifecycle' } });
  expect(create).not.toHaveBeenCalled();
});
it('renders MP3/MP4 only with the correct native controls and pauses/releases on unmount', async () => {
  const r = make(),
    v = render(
      <>
        <LocalMedia reference="a.mp3" source={source} resources={r} />
        <LocalMedia reference="v.mp4" source={source} resources={r} />
      </>,
    );
  await waitFor(() => expect(v.container.querySelectorAll('audio,video')).toHaveLength(2));
  expect(v.container.querySelector('img')).toBeNull();
  for (const el of v.container.querySelectorAll('audio,video')) {
    expect(el).toHaveAttribute('controls');
    expect(el).not.toHaveAttribute('autoplay');
    expect(el).not.toHaveAttribute('loop');
    expect(el).toHaveAttribute('preload', 'metadata');
  }
  expect(v.container.querySelector('video')).toHaveAttribute('playsinline');
  v.unmount();
  expect(pause).toHaveBeenCalledTimes(2);
  expect(revoke).toHaveBeenCalledTimes(2);
  r.dispose();
});
it('keeps shared/question media collapsed by default, pauses immediately on collapse and when reading is hidden', async () => {
  const q = parseDocument(
      {
        structure_type: 'collector.role',
        info: {
          stid: 'g',
          audio: 'a.mp3',
          question: [{ ask: 'Prompt', askvideo: 'v.mp4', std: [{ value: 'Stored answer' }] }],
        },
      },
      source,
    ),
    r = make();
  const v = render(<Reader question={q} resources={r} />);
  expect(screen.getByText('Stored answer')).toBeVisible();
  expect(v.container.querySelector('audio,video')).toBeNull();
  const toggle = screen.getByRole('button', { name: /^Question / });
  fireEvent.click(toggle);
  await waitFor(() => expect(v.container.querySelector('video')).not.toBeNull());
  fireEvent.click(toggle);
  expect(pause).toHaveBeenCalled();
  expect(v.container.querySelector('video')).not.toBeNull();
  expect(revoke).not.toHaveBeenCalled();
  await waitFor(() => expect(v.container.querySelector('video')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: /Shared Material/ }));
  await waitFor(() => expect(v.container.querySelector('audio')).not.toBeNull());
  pause.mockClear();
  v.rerender(<Reader question={q} resources={r} active={false} />);
  expect(pause).toHaveBeenCalled();
  expect(v.container.querySelector('audio')).toBeNull();
  v.unmount();
  r.dispose();
});
it('stops media on group changes and records codec failures separately from missing files', async () => {
  const r = make(),
    q = parseDocument(
      {
        structure_type: 'collector.role',
        info: { stid: 'g', question: [{ ask: 'Prompt', askvideo: 'v.mp4' }] },
      },
      source,
    );
  const v = render(<Reader key="one" question={q} resources={r} />);
  fireEvent.click(screen.getByRole('button', { name: /^Question / }));
  await waitFor(() => expect(v.container.querySelector('video')).not.toBeNull());
  const el = v.container.querySelector('video')!;
  Object.defineProperty(el, 'error', { value: { code: 3 } });
  fireEvent.error(el);
  expect(await screen.findByText(/Video unavailable/)).toBeVisible();
  expect(
    r.diagnostics.some((d) => d.category === 'video_playback' && d.resolvedPath?.endsWith('v.mp4')),
  ).toBe(true);
  v.rerender(<Reader key="two" question={q} resources={r} />);
  expect(pause).toHaveBeenCalled();
  expect(v.container.querySelector('video')).toBeNull();
  v.unmount();
  r.dispose();
});
it('distinguishes audio missing files, unsafe references and unsupported video codecs in concise fallbacks', async () => {
  const r = make(),
    v = render(
      <>
        <LocalMedia reference="missing.mp3" source={source} resources={r} />
        <LocalMedia reference="https://evil/clip.mp4" source={source} resources={r} />
      </>,
    );
  expect(await screen.findByText('Audio unavailable: missing.mp3')).toBeVisible();
  expect(await screen.findByText('Video unavailable')).toBeVisible();
  expect(r.diagnostics.map((d) => d.category)).toContain('unsafe_path');
  v.unmount();
  vi.mocked(HTMLMediaElement.prototype.canPlayType).mockReturnValue('');
  const next = render(<LocalMedia reference="v.mp4" source={source} resources={r} />);
  expect(
    await screen.findByText('This video format is not supported by your browser'),
  ).toBeVisible();
  next.unmount();
  r.dispose();
});
it('does not recreate playback URLs on a normal rerender', async () => {
  const r = make(),
    v = render(<LocalMedia reference="a.mp3" source={source} resources={r} />);
  await waitFor(() => expect(v.container.querySelector('audio')).not.toBeNull());
  v.rerender(<LocalMedia reference="a.mp3" source={source} resources={r} />);
  await act(async () => {});
  expect(create).toHaveBeenCalledTimes(1);
  v.unmount();
  r.dispose();
});
it('tries the next local HTML source when the browser rejects the first media type', async () => {
  const webm = new Blob([new Uint8Array([26, 69, 223, 163, 0]), 'webm']);
  const r = new MediaResources(
    new Map([
      ['bank/p/content_1/material/first.webm', webm],
      ['bank/p/content_1/material/next.mp4', video],
    ]),
  );
  vi.mocked(HTMLMediaElement.prototype.canPlayType).mockImplementation((type) =>
    type === 'video/webm' ? '' : 'probably',
  );
  const v = render(
    <LocalMedia reference="first.webm" alternatives={['next.mp4']} source={source} resources={r} />,
  );
  await waitFor(() =>
    expect(v.container.querySelector('video')).toHaveAttribute('src', 'blob:media-2'),
  );
  expect(screen.queryByText(/not supported by your browser/)).toBeNull();
  expect(revoke).toHaveBeenCalledWith('blob:media-1');
  v.unmount();
  r.dispose();
});
it('shows a media-only first stored answer while keeping question media and later answers collapsed', async () => {
  const q = parseDocument(
    {
      structure_type: 'collector.role',
      info: {
        stid: 'g',
        question: [
          {
            askaudio: 'a.mp3',
            std: [{ value: '', audio: 'a.mp3' }, { value: '<video src="v.mp4"></video>' }],
          },
        ],
      },
    },
    source,
  );
  const r = make(),
    v = render(<Reader question={q} resources={r} />);
  await waitFor(() => expect(v.container.querySelector('.answer-card audio')).not.toBeNull());
  expect(screen.queryByText('Answer not found')).toBeNull();
  expect(v.container.querySelector('.collapse-content audio,video')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Additional Reference Answers/ }));
  await waitFor(() =>
    expect(v.container.querySelector('.additional-answers video')).not.toBeNull(),
  );
  expect(v.container.querySelector('.answer-card audio')).not.toBeNull();
  v.unmount();
  r.dispose();
});

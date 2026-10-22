import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '../src/i18n';
import { Reader } from '../src/components/Reader';
import { AnswerPreview } from '../src/components/AnswerPreview';
import { LocalMedia } from '../src/components/LocalMedia';
import { RichText } from '../src/components/RichText';
import { selectAnswerPreview } from '../src/core/answerPreview';
import { MediaResources } from '../src/core/media/resources';
import type { Kind, Paper, Question, SubQuestion } from '../src/types';

const source = '原始 Bank/p/content_1/content.json';
const part = (extra: Partial<SubQuestion> = {}): SubQuestion => ({
  number: '90',
  officialNumber: '23',
  prompt: '原始 Question prompt',
  context: 'W: Original transcript',
  options: [{ label: 'A', text: 'Original option' }],
  answers: [
    { text: '原始 Answer & English', field: 'std' },
    { text: 'Additional source', field: 'ref' },
  ],
  explanation: 'Original explanation',
  images: [],
  translation: 'Original translation',
  ...extra,
});
const group = (kind: Kind = 'collector.choose', extra: Partial<Question> = {}): Question => ({
  id: kind,
  kind,
  source,
  parts: [
    part(),
    part({
      number: '25',
      officialNumber: undefined,
      prompt: 'Second prompt',
      context: '',
      answers: [],
      translation: '',
      explanation: '',
    }),
  ],
  context: 'M: Original shared passage',
  instructions: 'Original instruction',
  topic: '原始 Topic',
  images: [],
  explanation: 'Original group explanation',
  keyPoints: 'Original key points',
  ...extra,
});
const paper = (questions: Question[]): Paper => ({
  id: '原始 Paper',
  title: '源试卷 / Original',
  key: 'p',
  questions,
  modified: null,
});
const switchLanguage = (locale: string) =>
  act(async () => {
    await i18n.changeLanguage(locale);
  });
const create = vi.fn(),
  revoke = vi.fn(),
  pause = vi.fn();
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  let next = 0;
  create.mockReset().mockImplementation(() => `blob:reading-${++next}`);
  revoke.mockReset();
  pause.mockReset();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.style.overflow = '';
});

it('updates an expanded Reader in place while preserving source content and official numbering', async () => {
  const q = group('collector.choose', {
    sharedMaterials: [
      { label: 'Context', text: 'Other context' },
      { label: '原始自定义标题', text: 'Custom material' },
    ],
  });
  q.parts[0].supplements = [
    { label: 'Keywords', text: 'Original keywords' },
    { label: 'Source label', text: 'Custom supplement' },
  ];
  const original = structuredClone(q),
    resources = new MediaResources(new Map());
  const view = render(<Reader question={q} resources={resources} />);
  const question = screen.getAllByRole('button', { name: /^Question / })[0];
  const shared = screen.getByRole('button', { name: /^Shared Material/ });
  const more = screen.getByRole('button', { name: /^Additional Reference Answers/ });
  expect(question).toHaveAttribute('aria-expanded', 'false');
  expect(shared).toHaveAttribute('aria-expanded', 'false');
  expect(more).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(question);
  fireEvent.click(shared);
  fireEvent.click(more);
  const reader = view.container.querySelector('article');
  await switchLanguage('zh-CN');
  expect(screen.getByRole('article', { name: '题目与参考答案' })).toBe(reader);
  expect(screen.getByRole('navigation', { name: '子题' })).toBeVisible();
  expect(screen.getByText('跳转至')).toBeVisible();
  for (const label of ['Q23', 'Q25'])
    expect(screen.getByRole('button', { name: label })).toBeVisible();
  expect(question).toHaveAttribute('aria-expanded', 'true');
  expect(shared).toHaveAttribute('aria-expanded', 'true');
  expect(more).toHaveAttribute('aria-expanded', 'true');
  expect(question).toHaveAccessibleName('题目 原始 Question prompt');
  expect(shared).toHaveAccessibleName('共用材料 文章、听力文本与背景');
  expect(more).toHaveAccessibleName('其他参考答案 另有 1 个');
  for (const heading of ['说明', '背景', '听力文本', '关键词', '选项', '译文']) {
    expect(screen.getByRole('heading', { name: heading })).toBeVisible();
  }
  expect(screen.getAllByRole('heading', { name: '参考答案' })).toHaveLength(2);
  expect(screen.getByText('未找到参考答案')).toBeVisible();
  for (const text of [
    '原始自定义标题',
    'Source label',
    '原始 Answer & English',
    'Original option',
    'Additional source',
    'Other context',
    'Original shared passage',
    'Original instruction',
    '原始 Topic',
  ]) {
    expect(screen.getByText(text, { exact: true })).toBeVisible();
  }
  expect(screen.getByText('参考答案按题库中保存的原文显示。')).toBeVisible();
  expect(screen.getAllByRole('button', { name: '解析' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: '要点' })).toBeVisible();
  expect(q).toEqual(original);
  view.unmount();
  resources.dispose();
});

it('renders all structural preview types live and keeps first answers, local numbering and choice boxes', async () => {
  const types: Kind[] = [
    'collector.choose',
    'collector.word',
    'collector.fill',
    'collector.dialogue',
    'collector.role',
    'collector.3q5a',
    'collector.picture',
    'collector.read',
    'collector.future',
  ];
  const data = paper(types.map((kind) => group(kind)));
  data.questions[1].parts[0].firstSourceAnswer = { text: '', field: 'std' };
  const original = structuredClone(data);
  render(<AnswerPreview paper={data} />);
  const trigger = screen.getByRole('button', { name: 'Preview Answers' });
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Answer Preview' });
  const choice = dialog.querySelector('.preview-choice-box');
  const entry = dialog.querySelector('.preview-entry');
  await switchLanguage('zh-CN');
  expect(screen.getByRole('dialog', { name: '答案预览' })).toBe(dialog);
  expect(trigger).toHaveAccessibleName('预览答案');
  expect(trigger).toHaveAttribute('title', '预览源试卷 / Original的全部参考答案');
  expect(within(dialog).getByRole('button', { name: '关闭答案预览' })).toHaveFocus();
  expect(within(dialog).getByRole('region', { name: '试卷答案' })).toBeVisible();
  const labels = [
    '选择题',
    '单词／句子',
    '填空题',
    '对话',
    '角色扮演',
    '问答',
    '看图描述',
    '朗读',
    '题组',
  ];
  for (const label of labels)
    expect(within(dialog).getByRole('heading', { name: `${label} · 1–2` })).toBeVisible();
  expect(dialog.querySelector('.preview-entry')).toBe(entry);
  expect(dialog.querySelector('.preview-choice-box')).toBe(choice);
  expect(choice).toHaveTextContent(/^原始 Answer & English$/);
  expect(choice?.previousElementSibling).toHaveTextContent('1.');
  expect(Array.from(dialog.querySelectorAll('.preview-number'), (el) => el.textContent)).toEqual([
    '1.',
    '2.',
    '1.',
    '2.',
    '1.',
    '2.',
    '1.',
    '2.',
    '1.',
    '2.',
    '1.',
    '2.',
    '1.',
    '2.',
    '1.',
    '2.',
    '1.',
    '2.',
  ]);
  const secondGroup = dialog.querySelectorAll('.preview-group')[1];
  expect(secondGroup.querySelector('.preview-answer')).toHaveTextContent('—');
  expect(within(dialog).queryByText('Additional source')).toBeNull();
  expect(within(dialog).getByText('源试卷 / Original')).toBeVisible();
  expect(data).toEqual(original);
  expect(selectAnswerPreview(data).map((g) => g.label)).toEqual([
    'questionTypes.multipleChoice',
    'questionTypes.wordSentence',
    'questionTypes.fillBlanks',
    'questionTypes.dialogue',
    'questionTypes.rolePlay',
    'questionTypes.questionsAnswers',
    'questionTypes.pictureDescription',
    'questionTypes.reading',
    'questionTypes.unknown',
  ]);
});

it('localizes preview empty states and Reader fallback previews without inventing answers', async () => {
  const resources = new MediaResources(new Map());
  const view = render(
    <>
      <AnswerPreview paper={paper([])} />
      <Reader
        question={group('collector.read', {
          context: '',
          instructions: 'Source instructions',
          parts: [part({ prompt: '', context: '', answers: [] })],
        })}
        resources={resources}
      />
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Preview Answers' }));
  await switchLanguage('zh-CN');
  expect(within(screen.getByRole('dialog')).getByText('暂无答案')).toBeVisible();
  expect(screen.getByRole('button', { name: '共用材料 说明' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '题目 查看原题' })).toBeInTheDocument();
  view.unmount();
  resources.dispose();
});

it('updates missing image, audio and video fallbacks without changing their original filenames', async () => {
  const resources = new MediaResources(new Map());
  const view = render(
    <>
      {['原始图.png', 'Original audio.mp3', 'clip.mp4'].map((reference) => (
        <LocalMedia key={reference} reference={reference} source={source} resources={resources} />
      ))}
    </>,
  );
  await screen.findByText('Image unavailable: 原始图.png');
  await switchLanguage('zh-CN');
  for (const text of [
    '图片不可用：原始图.png',
    '音频不可用：Original audio.mp3',
    '视频不可用：clip.mp4',
  ])
    expect(screen.getByText(text)).toBeVisible();
  view.unmount();
  resources.dispose();
});

const audio = new Blob([new Uint8Array([255, 251, 144, 192, 0, 0, 0, 0])]);
const video = new Blob([
  new Uint8Array([
    0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 109, 112, 52, 50,
  ]),
]);
it('keeps active media nodes, playback positions and leased URLs through a live locale change', async () => {
  const resources = new MediaResources(
    new Map([
      ['原始 Bank/p/content_1/material/音频.mp3', audio],
      ['原始 Bank/p/content_1/material/movie.mp4', video],
    ]),
  );
  const q = group('collector.role', {
    parts: [part({ prompt: '<audio src="音频.mp3"></audio><video src="movie.mp4"></video>' })],
  });
  const view = render(<Reader question={q} resources={resources} />);
  fireEvent.click(screen.getByRole('button', { name: /^Question / }));
  await waitFor(() => expect(view.container.querySelectorAll('audio,video')).toHaveLength(2));
  const nodes = Array.from(view.container.querySelectorAll<HTMLMediaElement>('audio,video'));
  const urls = nodes.map((node) => node.src);
  nodes[0].currentTime = 12;
  nodes[1].currentTime = 34;
  pause.mockClear();
  await switchLanguage('zh-CN');
  expect(Array.from(view.container.querySelectorAll('audio,video'))).toEqual(nodes);
  expect(nodes.map((node) => node.src)).toEqual(urls);
  expect(nodes.map((node) => node.currentTime)).toEqual([12, 34]);
  expect(nodes[0]).toHaveAccessibleName('音频：音频.mp3');
  expect(nodes[1]).toHaveAccessibleName('视频：movie.mp4');
  expect(create).toHaveBeenCalledTimes(2);
  expect(revoke).not.toHaveBeenCalled();
  expect(pause).not.toHaveBeenCalled();
  view.unmount();
  resources.dispose();
});

it('localizes unsupported formats, playback failures and loading notices live', async () => {
  vi.mocked(HTMLMediaElement.prototype.canPlayType).mockReturnValue('');
  const resources = new MediaResources(
    new Map([
      ['原始 Bank/p/content_1/material/clip.mp4', video],
      ['原始 Bank/p/content_1/material/sound.mp3', audio],
    ]),
  );
  const view = render(<LocalMedia reference="clip.mp4" source={source} resources={resources} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading media…');
  await screen.findByText('This video format is not supported by your browser');
  await switchLanguage('zh-CN');
  expect(screen.getByText('浏览器不支持此视频格式')).toBeVisible();
  view.unmount();
  vi.mocked(HTMLMediaElement.prototype.canPlayType).mockReturnValue('probably');
  const next = render(<LocalMedia reference="sound.mp3" source={source} resources={resources} />);
  expect(screen.getByRole('status')).toHaveTextContent('正在加载媒体…');
  await waitFor(() => expect(next.container.querySelector('audio')).not.toBeNull());
  fireEvent.error(next.container.querySelector('audio')!);
  expect(screen.getByText('音频不可用：sound.mp3')).toBeVisible();
  await switchLanguage('en');
  expect(screen.getByText('Audio unavailable: sound.mp3')).toBeVisible();
  next.unmount();
  resources.dispose();
});

it('updates the formatting-limit notice while keeping unformatted source text intact', async () => {
  const resources = new MediaResources(new Map());
  const sourceText = '原始内容 & English';
  const view = render(
    <RichText
      value={'<b>'.repeat(81) + sourceText + '</b>'.repeat(81)}
      source={source}
      resources={resources}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Formatting limit reached.');
  await switchLanguage('zh-CN');
  expect(screen.getByRole('status')).toHaveTextContent(
    '格式复杂度超出限制，已显示原始文本和图片引用。',
  );
  expect(screen.getByText(sourceText, { exact: true })).toBeVisible();
  view.unmount();
  resources.dispose();
});

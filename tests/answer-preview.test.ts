import { expect, it } from 'vitest';
import {
  selectAnswerPreview,
  previewAnswerText,
  firstStoredAnswer,
} from '../src/core/answerPreview';
import type { Kind, Paper, Question, SubQuestion } from '../src/types';
import { parseDocument } from '../src/core/parser';
import { reconcileCopies } from '../src/core/scanner/copies';
import { formatAnswers } from '../src/core/exporter';

const part = (
  number = '',
  answers = ['First', 'Alternative'],
  extra: Partial<SubQuestion> = {},
): SubQuestion => ({
  number,
  prompt: 'Secret prompt',
  context: 'Secret transcript',
  options: [],
  images: [],
  explanation: '',
  translation: '',
  answers: answers.map((text) => ({ text, field: 'std' })),
  ...extra,
});
const group = (kind: Kind, parts: SubQuestion[], id: string = kind): Question => ({
  id,
  kind,
  source: id + '/content.json',
  parts,
  context: 'Hidden material',
  instructions: '',
  topic: '',
  images: [],
  explanation: '',
  keyPoints: '',
});
const paper = (questions: Question[]): Paper => ({
  id: '原始 Paper',
  key: 'paper',
  questions,
  modified: null,
});

it('returns structural translation keys for all types and a neutral unknown key', () => {
  const labels = {
    choose: 'questionTypes.multipleChoice',
    word: 'questionTypes.wordSentence',
    fill: 'questionTypes.fillBlanks',
    dialogue: 'questionTypes.dialogue',
    role: 'questionTypes.rolePlay',
    '3q5a': 'questionTypes.questionsAnswers',
    picture: 'questionTypes.pictureDescription',
    read: 'questionTypes.reading',
    unknown: 'questionTypes.unknown',
  };
  const groups = Object.keys(labels).map((type) => group(`collector.${type}`, [part('1')], type));
  expect(selectAnswerPreview(paper(groups)).map((g) => g.label)).toEqual(Object.values(labels));
});
it('preserves mixed group order, separate repeated types, part order and raw first answers without mutation', () => {
  const data = paper([
    group('collector.choose', [part('3', ['B', 'A']), part('4', ['AC'])], 'a'),
    group('collector.picture', [part('5', ['中文\nLong & <b>original</b>'])], 'b'),
    group('collector.choose', [part('6', [])], 'c'),
  ]);
  const original = structuredClone(data);
  const result = selectAnswerPreview(data);
  expect(result.map((g) => g.structureType)).toEqual([
    'collector.choose',
    'collector.picture',
    'collector.choose',
  ]);
  expect(result.flatMap((g) => g.entries.map((e) => [e.number, e.answer]))).toEqual([
    ['1', 'B'],
    ['2', 'AC'],
    ['1', '中文\nLong & <b>original</b>'],
    ['1', null],
  ]);
  expect(new Set(result.flatMap((g) => g.entries.map((e) => e.id))).size).toBe(4);
  expect(data).toEqual(original);
});
it('uses local display numbers without modifying official/source numbers or export numbering', () => {
  const data = paper([
    group('collector.fill', [
      part('1', ['A'], { officialNumber: '10' }),
      part('2'),
      part('', []),
      part('1', [], { numberOrigin: 'display' }),
      part('03'),
    ]),
  ]);
  const original = structuredClone(data);
  const exported = formatAnswers(data.id, data.questions);
  const result = selectAnswerPreview(data)[0];
  expect(result.entries.map((e) => e.number)).toEqual(['1', '2', '3', '4', '5']);
  expect(result.numberLabel).toBe('1–5');
  expect(data).toEqual(original);
  expect(formatAnswers(data.id, data.questions)).toBe(exported);
  expect(exported).toContain('Question: collector.fill/10');
  expect(exported).toContain('Question: collector.fill/03');
});
it('numbers by actual group order despite repeated source numbers and gaps', () => {
  const data = paper([
    group('collector.role', [part('1'), part('1'), part('3')]),
    group('collector.word', [part('8'), part('10')]),
    group('collector.read', [part('11'), part('12')]),
  ]);
  const result = selectAnswerPreview(data);
  expect(result.map((g) => g.entries.map((e) => e.number))).toEqual([
    ['1', '2', '3'],
    ['1', '2'],
    ['1', '2'],
  ]);
  expect(result.map((g) => g.numberLabel)).toEqual(['1–3', '1–2', '1–2']);
});
it('resets consecutive groups of the same type independently, including single-question groups', () => {
  const result = selectAnswerPreview(
    paper([
      group('collector.word', [part('21')], 'first'),
      group('collector.word', [part('22')], 'second'),
      group('collector.read', [part('23', [])]),
      group('collector.dialogue', [part('24'), part('', []), part('26')]),
    ]),
  );
  expect(result.map((g) => g.entries.map((entry) => entry.number))).toEqual([
    ['1'],
    ['1'],
    ['1'],
    ['1', '2', '3'],
  ]);
  expect(result.map((g) => g.numberLabel)).toEqual(['1', '1', '1', '1–3']);
  expect(result[3].entries[1].answer).toBeNull();
});
it('keeps unique stable entry IDs independent of local display numbers and source number values', () => {
  const data = paper([
    group('collector.word', [part('Q-A')], 'same-source'),
    group('collector.role', [part('9007199254740993'), part('9007199254740995')], 'same-source'),
  ]);
  const result = selectAnswerPreview(data);
  expect(result.map((g) => g.numberLabel)).toEqual(['1', '1–2']);
  const ids = result.flatMap((g) => g.entries.map((e) => e.id));
  expect(new Set(ids).size).toBe(3);
  data.questions[0].parts[0].officialNumber = '500';
  data.questions[1].parts[1].number = '700';
  expect(selectAnswerPreview(data).flatMap((g) => g.entries.map((e) => e.id))).toEqual(ids);
});
it('retains answerless tasks and empty groups without inventing parts or promoting later answers', () => {
  const empty = part('1', ['', 'Do not promote']);
  expect(firstStoredAnswer(empty)?.text).toBe('');
  const result = selectAnswerPreview(
    paper([
      group('collector.read', [part('', [])]),
      group('collector.picture', [empty]),
      group('collector.word', []),
    ]),
  );
  expect(result.map((g) => g.entries.length)).toEqual([1, 1, 0]);
  expect(result.map((g) => g.numberLabel)).toEqual(['1', '1', undefined]);
  expect(result[1].entries[0].answer).toBe('');
  expect(selectAnswerPreview(paper([]))).toEqual([]);
});
it('retains an empty first source variant through actual parsing without changing Reader answers', () => {
  for (const kind of ['dialogue', 'role', '3q5a', 'picture']) {
    for (const empty of ['', ' ', '<p></p>', '<img src="answer.png">']) {
      const row = { xh: '1', ask: 'Prompt', std: [{ value: empty }, { value: 'Do not promote' }] };
      const info =
        kind === 'picture'
          ? { stid: 'q', value: 'Prompt', std: row.std }
          : { stid: 'q', question: [row] };
      const question = parseDocument(
        { structure_type: `collector.${kind}`, info },
        'p/q/content.json',
      );
      const entry = selectAnswerPreview(paper([question]))[0].entries[0];
      expect(previewAnswerText(entry.answer ?? '')).toBe('');
      expect(question.parts[0].answers.at(-1)?.text).toBe('Do not promote');
      if (!empty.includes('img')) expect(question.parts[0].answers).toHaveLength(1);
    }
  }
});
it('preserves empty first source answers through complementary content.json/content2.json reconciliation', () => {
  const data = {
    structure_type: 'collector.dialogue',
    info: {
      stid: 'same',
      question: [{ xh: '1', ask: 'Prompt', std: [{ value: '' }, { value: 'Alternative' }] }],
    },
  };
  const one = parseDocument(data, 'p/q/content.json');
  const two = parseDocument(
    { ...data, info: { ...data.info, value: 'Shared transcript' } },
    'p/q/content2.json',
  );
  const merged = reconcileCopies([one, two], []);
  expect(merged).toHaveLength(1);
  expect(previewAnswerText(selectAnswerPreview(paper(merged))[0].entries[0].answer ?? '')).toBe('');
  expect(merged[0].parts[0].answers[0].text).toBe('Alternative');
});
it('formats safe text with paragraph breaks and original Chinese, special characters and long answers', () => {
  expect(previewAnswerText('<p>中文 &amp; English</p><p>Second<br>line.</p>')).toBe(
    '中文 & English\n\nSecond\nline.',
  );
  expect(previewAnswerText('First\n\nSecond < 3 & literal.')).toBe(
    'First\n\nSecond < 3 & literal.',
  );
  const long = 'Stored answer. '.repeat(20_000);
  expect(previewAnswerText(long)).toBe(long.trim());
});
it('never exposes imported images, audio/video fallback text, scripts or unsafe HTML as preview resources', () => {
  const text = previewAnswerText(
    '<script>hidden()</script><style>hidden</style><p><b>B</b><img src="https://evil/image.png" alt="hidden"></p><audio src="sound.mp3">hidden audio</audio><video>hidden video</video><iframe>hidden frame</iframe><svg>hidden svg</svg>',
  );
  expect(text).toBe('B');
  expect(previewAnswerText('<img src="answer.png">')).toBe('');
});

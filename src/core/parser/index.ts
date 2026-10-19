import {
  KIND_LABELS,
  type Kind,
  type Question,
  type StoredAnswer,
  type SubQuestion,
} from '../../types';
import { plainText } from '../markup';
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
function text(x: unknown): string {
  if (x == null) return '';
  if (typeof x !== 'string' && typeof x !== 'number')
    throw new Error('Expected a text field, found ' + typeof x);
  return String(x).trim();
}
const prompt = (x: unknown) =>
  text(x)
    .replace(/^\s*ets_th\d+\s*/, '')
    .trim();
function objects(x: unknown, field: string): Obj[] {
  if (x == null) return [];
  if (!Array.isArray(x) || !x.every(isObj)) throw new Error(field + ' must be an array of objects');
  return x;
}
const images = (info: Obj, ...keys: string[]) => keys.map((k) => text(info[k])).filter(Boolean);
const part = (values: Partial<SubQuestion>): SubQuestion => ({
  number: '',
  prompt: '',
  context: '',
  options: [],
  answers: [],
  explanation: '',
  images: [],
  translation: '',
  ...values,
});
const key = (stid: string, number: string) => JSON.stringify([stid, number]);
export function metadataAnswerMap(metadata: unknown): Map<string, StoredAnswer> {
  const result = new Map<string, StoredAnswer>();
  if (!Array.isArray(metadata)) return result;
  for (const entry of objects(metadata, 'metadata')) {
    if (entry.code_id !== 'answer' || !('code_json_array' in entry)) continue;
    if (typeof entry.code_json_array !== 'string')
      throw new Error('code_json_array must be JSON text');
    for (const [i, row] of objects(
      JSON.parse(entry.code_json_array),
      'code_json_array',
    ).entries()) {
      const stid = text(row.stid),
        number = text(row.xth),
        answer = text(row.answer);
      if (!stid || !number || !answer) continue;
      const id = key(stid, number);
      if (result.has(id) && result.get(id)!.text !== answer)
        throw new Error(`Conflicting metadata answers for ${stid}/${number}`);
      result.set(id, { text: answer, field: `info.json:answer[${i}].answer` });
    }
  }
  return result;
}
function references(info: Obj, field: string): StoredAnswer[] {
  const result: StoredAnswer[] = [];
  const explicit = text(info.answer);
  if (explicit) result.push({ text: explicit, field: field + '.answer' });
  for (const k of ['std', 'ref'])
    for (const [i, row] of objects(info[k], field + '.' + k).entries()) {
      const value = text(row.value);
      if (plainText(value)) result.push({ text: value, field: `${field}.${k}[${i}].value` });
    }
  return result;
}
export function parseDocument(input: unknown, source: string, metadata?: unknown): Question {
  let data = input;
  if (Array.isArray(data)) {
    metadata = data;
    const wrapper = objects(data, 'metadata').find((x) => x.code_id === 'content_choose');
    if (!wrapper || typeof wrapper.code_json_obj !== 'string')
      throw new Error('Metadata does not contain a complete supported question');
    data = { structure_type: 'collector.choose', info: JSON.parse(wrapper.code_json_obj) };
  }
  if (!isObj(data)) throw new Error('No supported ETS collector schema');
  if (typeof data.structure_type !== 'string' || !Object.hasOwn(KIND_LABELS, data.structure_type))
    throw new Error(
      'Unsupported question format: ' + String(data.structure_type ?? 'no collector schema'),
    );
  const kind = data.structure_type as Kind;
  if (!isObj(data.info)) throw new Error('info must be an object');
  const info = data.info,
    stid = text(info.stid);
  if (!stid) throw new Error('Question has no stid; no ID mapping can be established');
  const q: Question = {
    id: stid,
    kind,
    source,
    parts: [],
    context: '',
    instructions: '',
    topic: '',
    images: [],
    explanation: '',
    keyPoints: '',
  };
  const seen = new Set<string>();
  function number(item: Obj, k: string, field: string) {
    const n = text(item[k]);
    if (!n || seen.has(n)) throw new Error(`${field}.${k} must identify a distinct sub-question`);
    seen.add(n);
    return n;
  }
  if (kind === 'collector.choose') {
    const map = metadataAnswerMap(metadata);
    q.parts = objects(info.xtlist, 'info.xtlist').map((item, i) => {
      const field = `info.xtlist[${i}]`,
        n = number(item, 'xt_xh', field);
      const p = part({
        number: n,
        prompt: prompt(item.xt_nr),
        context: text(item.xt_value),
        images: images(item, 'xt_pic'),
        explanation: text(item.xt_analy),
      });
      if (!(p.prompt || p.context || p.images.length || text(info.st_nr)))
        throw new Error(field + ' has no question content');
      const explicit = text(item.answer);
      p.answers = explicit
        ? [{ text: explicit, field: field + '.answer' }]
        : map.has(key(stid, n))
          ? [map.get(key(stid, n))!]
          : [];
      p.options = objects(item.xxlist, field + '.xxlist').map((o) => ({
        label: text(o.xx_mc),
        text: text(o.xx_nr),
      }));
      return p;
    });
    if (!q.parts.length) throw new Error('Choice group has no sub-questions');
    q.context = text(info.st_nr);
    q.instructions = text(info.st_sm);
    q.images = images(info, 'st_pic');
  } else if (kind === 'collector.dialogue') {
    q.parts = objects(info.question, 'info.question').map((item, i) => {
      const field = `info.question[${i}]`;
      const p = part({
        number: number(item, 'xh', field),
        prompt: prompt(item.ask),
        images: images(item, 'askimg'),
        answers: references(item, field),
        explanation: text(item.analyze),
      });
      if (!p.prompt && !p.images.length) throw new Error(field + ' has no question content');
      return p;
    });
    if (!q.parts.length) throw new Error('Dialogue group has no sub-questions');
    q.context = text(info.value);
    q.images = images(info, 'image');
  } else if (kind === 'collector.picture') {
    if (!['value', 'topic', 'image'].some((k) => text(info[k])))
      throw new Error('Picture record has no question content');
    q.parts = [part({ prompt: prompt(info.value), answers: references(info, 'info') })];
    q.topic = text(info.topic);
    q.images = images(info, 'image');
    q.explanation = text(info.analyze);
    q.keyPoints = text(info.keypoint);
  } else {
    if (!prompt(info.value) && !images(info, 'image').length)
      throw new Error('Word/reading record has no question content');
    q.parts = [
      part({
        number: text(info.xh),
        prompt: prompt(info.value),
        explanation: text(info.analyze),
        translation: text(info.translate),
      }),
    ];
    q.images = images(info, 'image');
  }
  return q;
}
const titles = new WeakMap<Question, string>();
export function questionTitle(q: Question): string {
  if (!titles.has(q))
    titles.set(
      q,
      plainText(
        q.topic ||
          q.parts.find((p) => p.prompt || p.context)?.prompt ||
          q.parts.find((p) => p.prompt || p.context)?.context ||
          q.context,
      ) || KIND_LABELS[q.kind],
    );
  return titles.get(q)!;
}

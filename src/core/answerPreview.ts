import { Parser } from 'htmlparser2';
import type { Paper, SubQuestion } from '../types';
import { questionTypeKey } from '../i18n/questionTypeLabels';
export interface AnswerPreviewEntry {
  id: string;
  number: string;
  answer: string | null;
}
export interface AnswerPreviewGroup {
  id: string;
  structureType: string;
  /** Translation key; localized only by the consuming UI. */
  label: string;
  numberLabel?: string;
  isMultipleChoice: boolean;
  entries: AnswerPreviewEntry[];
}
export const firstStoredAnswer = (part: SubQuestion) =>
  part.firstSourceAnswer ?? part.answers[0] ?? null;

/** Presentation only: consumes normalized state, without reading files or changing it. */
export function selectAnswerPreview(paper: Paper): AnswerPreviewGroup[] {
  return paper.questions.map((group, groupIndex) => {
    const id = group.source + ':' + groupIndex;
    const entries = group.parts.map((part, i) => ({
      id: id + ':' + i,
      number: String(i + 1),
      answer: firstStoredAnswer(part)?.text ?? null,
    }));
    return {
      id,
      structureType: group.kind,
      label: questionTypeKey(group.kind),
      numberLabel: entries.length
        ? entries.length === 1
          ? '1'
          : `1–${entries.length}`
        : undefined,
      isMultipleChoice: group.kind === 'collector.choose',
      entries,
    };
  });
}

const hidden = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'head',
  'template',
  'svg',
  'math',
  'audio',
  'video',
]);
const paragraphs = new Set(['p', 'div', 'blockquote', 'ul', 'ol']);
/** Safe text formatting, not a second question parser; no DOM or resource URLs. */
export function previewAnswerText(value: string): string {
  const chunks: string[] = [];
  let suppressed = 0;
  const parser = new Parser(
    {
      onopentag(tag) {
        if (hidden.has(tag)) {
          suppressed++;
          return;
        }
        if (suppressed) return;
        if (paragraphs.has(tag)) chunks.push('\n\n');
        else if (['br', 'li', 'tr'].includes(tag)) chunks.push('\n');
        else if (['td', 'th'].includes(tag)) chunks.push('\t');
      },
      onclosetag(tag) {
        if (hidden.has(tag)) {
          suppressed = Math.max(0, suppressed - 1);
          return;
        }
        if (!suppressed && paragraphs.has(tag)) chunks.push('\n\n');
      },
      ontext(text) {
        if (!suppressed) chunks.push(text);
      },
    },
    { decodeEntities: true },
  );
  parser.end(value.replace(/<\/br\s*>/gi, '<br>'));
  return chunks
    .join('')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

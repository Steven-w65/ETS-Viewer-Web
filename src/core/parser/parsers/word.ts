import type { QuestionTypeParser } from '../types';
import { passage } from '../utils/passage';
export const wordParser: QuestionTypeParser = {
  type: 'collector.word',
  label: 'Word / sentence',
  parse: passage,
};

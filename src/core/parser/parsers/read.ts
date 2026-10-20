import type { QuestionTypeParser } from '../types';
import { passage } from '../utils/passage';
export const readParser: QuestionTypeParser = {
  type: 'collector.read',
  label: 'Reading',
  parse: passage,
};

import type { QuestionTypeParser } from '../types';
import { questionList } from '../utils/questionList';
export const threeQFiveAParser: QuestionTypeParser = {
  type: 'collector.3q5a',
  label: 'Three-question response',
  parse: (info, context) => questionList(info, context, true),
};

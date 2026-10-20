import type { QuestionTypeParser } from '../types';
import { questionList } from '../utils/questionList';
export const dialogueParser: QuestionTypeParser = {
  type: 'collector.dialogue',
  label: 'Dialogue',
  parse: questionList,
};

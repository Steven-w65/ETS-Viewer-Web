import type { QuestionTypeParser } from '../types';
import { questionList } from '../utils/questionList';
export const roleParser: QuestionTypeParser = {
  type: 'collector.role',
  label: 'Role play',
  parse: questionList,
};

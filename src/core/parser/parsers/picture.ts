import type { QuestionTypeParser } from '../types';
import { text, prompt } from '../utils/text';
import { images } from '../utils/fields';
import { references } from '../utils/answers';
import { ParseError } from '../diagnostics';
export const pictureParser: QuestionTypeParser = {
  type: 'collector.picture',
  label: 'Picture response',
  parse(info, context) {
    const q = context.createQuestion();
    if (
      !['value', 'topic', 'image'].map((k) => text(info[k])).some(Boolean) &&
      !q.media?.some((m) => m.reference)
    )
      throw new ParseError('Picture record has no question content', 'info');
    q.parts = [context.createPart({ prompt: prompt(info.value), ...references(info, 'info') })];
    q.topic = text(info.topic);
    q.images = images(info, 'image');
    q.explanation = text(info.analyze);
    q.keyPoints = text(info.keypoint);
    return q;
  },
};

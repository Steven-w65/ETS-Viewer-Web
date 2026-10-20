import type { Kind } from '../../types';
import type { QuestionTypeParser } from './types';
import { chooseParser } from './parsers/choose';
import { dialogueParser } from './parsers/dialogue';
import { roleParser } from './parsers/role';
import { threeQFiveAParser } from './parsers/threeQFiveA';
import { fillParser } from './parsers/fill';
import { pictureParser } from './parsers/picture';
import { readParser } from './parsers/read';
import { wordParser } from './parsers/word';
export const parserRegistry = new Map<Kind, QuestionTypeParser>();
export function registerParser(parser: QuestionTypeParser): void {
  if (parserRegistry.has(parser.type)) throw new Error('Parser already registered: ' + parser.type);
  parserRegistry.set(parser.type, parser);
}
[
  chooseParser,
  dialogueParser,
  roleParser,
  threeQFiveAParser,
  fillParser,
  pictureParser,
  readParser,
  wordParser,
].forEach(registerParser);

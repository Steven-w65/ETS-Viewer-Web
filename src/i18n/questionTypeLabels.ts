const keys: Readonly<Record<string, string>> = {
  'collector.choose': 'questionTypes.multipleChoice',
  'collector.word': 'questionTypes.wordSentence',
  'collector.fill': 'questionTypes.fillBlanks',
  'collector.dialogue': 'questionTypes.dialogue',
  'collector.role': 'questionTypes.rolePlay',
  'collector.3q5a': 'questionTypes.questionsAnswers',
  'collector.picture': 'questionTypes.pictureDescription',
  'collector.read': 'questionTypes.reading',
};
export const questionTypeKey = (kind: string) => keys[kind] ?? 'questionTypes.unknown';

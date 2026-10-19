export const KIND_LABELS = {
  'collector.choose': 'Multiple choice',
  'collector.dialogue': 'Dialogue',
  'collector.picture': 'Picture response',
  'collector.word': 'Word / sentence',
  'collector.read': 'Reading',
} as const;
export type Kind = keyof typeof KIND_LABELS;
export interface StoredAnswer {
  text: string;
  field: string;
}
export interface Option {
  label: string;
  text: string;
}
export interface SubQuestion {
  number: string;
  prompt: string;
  context: string;
  options: Option[];
  answers: StoredAnswer[];
  explanation: string;
  images: string[];
  translation: string;
}
export interface Question {
  id: string;
  kind: Kind;
  source: string;
  parts: SubQuestion[];
  context: string;
  instructions: string;
  topic: string;
  images: string[];
  explanation: string;
  keyPoints: string;
}
export interface Paper {
  key: string;
  id: string;
  questions: Question[];
  modified: number | null;
}
export interface Issue {
  path: string;
  message: string;
}
export interface VirtualFile {
  path: string;
  blob: Blob;
}
export interface Bank {
  name: string;
  papers: Paper[];
  issues: Issue[];
  filesScanned: number;
  assets: Map<string, Blob>;
}
export interface Progress {
  phase: 'Reading files...' | 'Parsing questions...' | 'Processing images...' | 'Ready';
  completed: number;
  total: number;
}

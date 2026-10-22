export const KIND_LABELS: Readonly<Record<string, string>> = {
  'collector.choose': 'Multiple choice',
  'collector.dialogue': 'Dialogue',
  'collector.picture': 'Picture response',
  'collector.word': 'Word / sentence',
  'collector.read': 'Reading',
  'collector.role': 'Role play',
  'collector.3q5a': 'Three-question response',
  'collector.fill': 'Fill in the blanks',
} as const;
export type Kind = `collector.${string}`;
export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | { [key: string]: MetadataValue };
export interface SupplementaryContent {
  label: string;
  text: string;
  images?: string[];
  media?: MediaReference[];
}
export interface MediaReference {
  kind: 'image' | 'audio' | 'video';
  reference: string;
  field: string;
}
export interface StoredAnswer {
  media?: MediaReference[];
  text: string;
  field: string;
}
export interface Option {
  label: string;
  text: string;
  images?: string[];
}
export interface SubQuestion {
  numberOrigin?: 'source' | 'display';
  sourceNumberLabels?: { text: string; field: string; source: string }[];
  promptVariants?: { source: string; text: string }[];
  officialNumber?: string;
  promptField?: string;
  supplements?: SupplementaryContent[];
  media?: MediaReference[];
  metadata?: Record<string, MetadataValue>;
  number: string;
  prompt: string;
  context: string;
  options: Option[];
  answers: StoredAnswer[];
  /** First source variant before empty variants are excluded from Reader answers. */
  firstSourceAnswer?: StoredAnswer;
  explanation: string;
  images: string[];
  translation: string;
}
export interface Question {
  media?: MediaReference[];
  paperId?: string;
  typeLabel?: string;
  displayTitle?: string;
  sharedMaterials?: SupplementaryContent[];
  sourceFiles?: string[];
  identity?: { origin: 'source' | 'resource'; originalId?: string; resourceId: string };
  metadata?: Record<string, MetadataValue>;
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
  title?: string;
  key: string;
  id: string;
  questions: Question[];
  /** The paper directory's own modification time; null when unavailable. */
  modified: number | null;
}
export interface Issue {
  /** Original resource reference, independent of the owning JSON path. Unsafe absolute references are redacted. */
  reference?: string;
  mediaKind?: 'image' | 'audio' | 'video' | 'unknown' | 'data';
  resolvedPath?: string;
  candidates?: string[];
  category?: string;
  /** Imported virtual source/JSON path, never an operating-system absolute path. */
  path: string;
  message: string;
  /** Optional structured UI message; original diagnostic text stays available locally. */
  messageKey?: string;
  messageParams?: Record<string, string | number>;
  code?: string;
  severity?: 'info' | 'warning' | 'error';
  structureType?: string;
  questionId?: string;
  field?: string;
}
export interface VirtualFile {
  path: string;
  blob: Blob;
  directory?: false;
}
export interface VirtualDirectory {
  path: string;
  directory: true;
  /** The directory entry's own modification time, never a descendant file time. */
  modified?: number | null;
}
export type VirtualEntry = VirtualFile | VirtualDirectory;
export interface Bank {
  diagnostics?: Issue[];
  coverage?: {
    observed: Record<string, number>;
    successful: number;
    partial: number;
    unsupported: number;
    variants: Record<string, number>;
  };
  name: string;
  papers: Paper[];
  issues: Issue[];
  filesScanned: number;
  assets: Map<string, Blob>;
}
export const questionKindLabel = (q: Question) => q.typeLabel || KIND_LABELS[q.kind] || q.kind;
export interface Progress {
  phase:
    | 'Reading files...'
    | 'Parsing questions...'
    | 'Processing images...'
    | 'Processing media...'
    | 'Ready';
  completed: number;
  total: number;
}

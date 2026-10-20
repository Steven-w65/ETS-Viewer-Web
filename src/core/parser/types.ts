import type { Issue, Kind, Question, SubQuestion } from '../../types';
export type JsonObject = Record<string, unknown>;
export interface ParseOptions {
  officialNumbers?: ReadonlyMap<string, string>;
  displayTitle?: string;
}
export interface ParseContext {
  source: string;
  kind: Kind;
  id: string;
  metadata: unknown;
  diagnostics: Issue[];
  officialNumbers?: ReadonlyMap<string, string>;
  createQuestion(): Question;
  createPart(values?: Partial<SubQuestion>): SubQuestion;
  report(
    code: string,
    message: string,
    field?: string,
    severity?: 'info' | 'warning' | 'error',
  ): void;
  variant(field: string, message: string): void;
}
export interface QuestionTypeParser {
  type: Kind;
  label: string;
  parse(info: JsonObject, context: ParseContext): Question;
}
export interface ParseResult {
  question?: Question;
  diagnostics: Issue[];
  partial: boolean;
  structureType?: string;
}

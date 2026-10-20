# Modular ETS parser architecture

The importer supplies a virtual filesystem. The scanner discovers resource copies,
reads local metadata, reconciles normalized groups, builds papers, and validates media
references. The parser registry dispatches solely on `structure_type`. Neither parser
selection nor answer extraction depends on region, folder counts, or UI state.

```text
src/core/parser/
├── index.ts                  parseDocumentResult; compatibility parseDocument; titles
├── registry.ts               Static Map and registerParser
├── types.ts                  QuestionTypeParser, ParseContext, ParseResult, ParseOptions
├── context.ts                Source identity, constructors, bounded inert metadata
├── diagnostics.ts            ParseError with code and field
├── parsers/
│   ├── choose.ts
│   ├── dialogue.ts
│   ├── role.ts
│   ├── threeQFiveA.ts
│   ├── fill.ts
│   ├── picture.ts
│   ├── read.ts
│   └── word.ts
└── utils/
    ├── answers.ts            Ordered stored references and exact metadata ID joins
    ├── fields.ts             Images and bounded unknown metadata
    ├── media.ts              Explicit owned audio/video fields
    ├── numbering.ts          Explicit field precedence and official template mappings
    ├── passage.ts            Shared reading/word adapter
    ├── questionList.ts       Shared dialogue/role/3q5a adapter
    ├── text.ts               Scalar validation and leading ETS marker removal
    └── validation.ts         Object/array checks and partial row recovery

src/core/scanner/
├── index.ts                  Discovery, encodings, papers, local coverage summary
├── copies.ts                 ID-based copy reconciliation
└── metadata.ts               Scoped paper/resource bindings and template mappings
```

## Contract

`QuestionTypeParser` declares `type`, `label`, and
`parse(info: JsonObject, context: ParseContext): Question`. The entry point validates
the envelope and registry lookup. Each module validates its own structure and returns
the common `Question`/`SubQuestion` model from `src/types/index.ts`.

`ParseContext` carries source path, collector kind, group identity, answer metadata,
official number mappings, constructors with compatible defaults, and structured
`report`/`variant` helpers. Core parsing does not import React, use browser storage,
fetch data, load assets, or execute source metadata. Array rows are checked at runtime;
malformed rows generate partial-parse warnings while valid sibling rows survive. An
entirely invalid group fails. Duplicate choice IDs retain the previous strict failure
behavior; duplicate fill numbers preserve separate blanks with a warning.

`parseDocumentResult` returns `{question?, diagnostics, partial, structureType?}` without
throwing for unsupported input. `parseDocument` remains a throwing compatibility entry
point for existing callers. `metadataAnswerMap` is still exported from the entry point.

The normalized fields keep prompts, options, contexts, supplements, and answers separate:

- `Option.images` contains local image references; options retain label/text/order.
- `SubQuestion.supplements` contains source keywords, never answers.
- Optional `Question.media`, `SubQuestion.media`, `StoredAnswer.media`, and supplementary
  media retain resource kind, reference, and original field ownership. Parsers never
  create URLs or load resources. Media-only stored answers retain their source order.
- `officialNumber` is optional and requires an explicit matching template marker.
  `number` normally remains the original local ID. A choice number derived from a
  numbering-only prompt is marked `numberOrigin: 'display'`; it is never an answer
  join or complementary copy-merge key. `sourceNumberLabels` retains the literal
  source labels even when a distinct local ID exists. A missing number remains
  empty; UI positions never become official IDs or answer-join keys.
- `Question.sharedMaterials` holds additional distinct shared source fields.
- `identity` distinguishes original `stid` from a missing-ID resource locator.
- `source`, `sourceFiles`, and optional `promptVariants` preserve copy provenance.
- `paperId`, optional `displayTitle`, paper `title`, and bounded inert `metadata` preserve
  validated contextual information. Unknown metadata is limited to 32 entries per object,
  32 array values, shallow nesting, and 1,024 characters per string; it is never rendered.
- Every answer retains its source field. The first answer is primary; later answers
  remain ordered alternatives of the same sub-question.

The reader and exporter consume these fields generically. Adding a collector does not
require adding source-field checks to UI components or the exporter.

The shared media pipeline is `core/media/references.ts` → `paths.ts`/`resolve.ts` →
`classify.ts`/`imageHeader.ts` → `resources.ts` → `LocalMedia`. Resolution returns a typed
resource; React does not infer a renderer from a directory or filename. `MediaResources`
owns bank validation and shares URLs through consumer leases. `MediaVisibility` pauses
players immediately during collapse/navigation while retaining URLs through the existing
exit transition. The page security policy permits Blob media and blocks external media.
See [media-handling.md](media-handling.md) for lifecycle and diagnostic details.

## Add a collector

1. Add a module under `parsers/` implementing the interface.
2. Validate the real source structure with the shared helpers. Preserve original
   relationships and diagnose ambiguity rather than guessing answers or IDs.
3. Register the module in the static built-in list in `registry.ts`.
4. Add independent normal/optional/malformed/answerless fixtures and tests under
   `tests/parsers/`; cover mixed import, rendering, and export when adding normalized fields.
5. Run `npm test`, `npm run build`, and the relevant browser/regression checks.

Illustrative independently authored adapter:

```ts
import type { QuestionTypeParser } from '../types';
import { text } from '../utils/text';
import { ParseError } from '../diagnostics';

export const exampleParser: QuestionTypeParser = {
  type: 'collector.example',
  label: 'Example',
  parse(info, context) {
    const prompt = text(info.value);
    if (!prompt) throw new ParseError('Missing original content', 'info.value');
    return {
      ...context.createQuestion(),
      parts: [context.createPart({ prompt })],
    };
  },
};
// In registry.ts after importing the module:
registerParser(exampleParser);
```

`Kind` accepts `collector.*`; the parser's label flows through normalized data to
navigation and export. Duplicate registration throws. This is a static module registry,
with no dynamic plugin installation or externally loaded code.

## Diagnostics and coverage

An `Issue` carries `severity`, `code`, relative `path`, and, when available,
`structureType`, `questionId`, and `field`. Codes cover unsupported structures, invalid
JSON/files, invalid fields, missing structure/identity/numbering, ambiguity, partial
rows, field variants, copy equivalence/complement/conflict, and missing media.
Normal answerless reading and word tasks do not produce missing-answer warnings.

The returned `Bank.diagnostics` contains informational conditions as well as warnings
and errors. The header warning dialog consumes `Bank.issues`, which excludes informational
entries and deduplicates underlying failures within their source record. Media references,
source JSON paths, and resolved/candidate paths remain separate. `Bank.coverage` counts observed collector types by resource, successfully and
partially parsed resource directories, unsupported types, and encountered field variants.
`content.json`/`content2.json` attempts in the same resource/type count as one observation.
A resource with a partial source attempt is counted as partial even if another usable
copy exists. Conflicting usable revisions do not inflate the successful resource count.
These objects are local and ephemeral; there is no dashboard, telemetry, or persistence.

See [data-format.md](data-format.md) for exact field/copy/metadata rules and source
references, and [verification.md](verification.md) for executed checks and limits.

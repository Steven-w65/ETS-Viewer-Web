# ETS data formats and compatibility

## Input and dispatch

Supported envelopes have a recognized `structure_type` and an `info` object. Parsers
are registered by structure; folder names, geography, and resource counts never select
one. Scalar text accepts strings/numbers and rejects objects/booleans. Prompt cleaning
removes the existing leading `ets_th<digits>` substitution marker and preserves safe
source formatting. A missing `stid` uses an explicitly marked owning-resource locator,
not an invented source ID. Missing local numbers stay empty.

| Collector            | Parts               | Source fields and behavior                                                                                                                          |
| -------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collector.choose`   | `info.xtlist[]`     | `xt_xh`; `xt_nr` prompt; distinct `xt_value` context; `xt_pic`, `xt_analy`; `xxlist[]` labels/text/images; explicit answer then exact metadata join |
| `collector.role`     | `info.question[]`   | `xh` when present; `ask`, `askimg`, `askaudio`, `askvideo`, `analyze`; explicit answer then ordered `std[].value` / `ref[].value`                   |
| `collector.3q5a`     | `info.question[]`   | Same ownership as role; additionally accepts string entries in `std[]`; alternatives remain answers of one actual question                          |
| `collector.fill`     | `info.std[]`        | One source row per blank; `xth` then `th`; `value` is one intact stored answer; explicit audio/video remains with that answer                       |
| `collector.dialogue` | `info.question[]`   | `ask`, `askimg`, `askaudio`, `askvideo`, `analyze`; ordered references; `keywords` supplementary                                                    |
| `collector.picture`  | One unnumbered part | `topic`, `value`, `image`, `analyze`; ordered references; `keypoint` supplementary                                                                  |
| `collector.read`     | One part            | `xh`, `value`, `image`, `translate`, `analyze`; preserve paragraphs and legitimate answer absence                                                   |
| `collector.word`     | One part            | Preserve the existing desktop `xh`, `value`, `image`, `translate`, `analyze` behavior; no inferred answers                                          |

## Scoped field rules

Choice uses meaningful `xt_nr` first. If it is absent or contains only an explicit
numeric label such as `15.`, use `xt_value` as the prompt and record the variant. The
number-only label supplies a display-origin number only when `xt_xh` is absent.
Literal number-only labels are retained as source provenance when a distinct local
ID exists. Display-derived numbers never serve as answer or complementary-copy join
keys. Otherwise distinct
`xt_value` remains question-specific context; an exactly equal prompt is not repeated.
Shared `st_nr` takes precedence over group `value`; a distinct nonempty group `value`
is retained as additional Shared Material. Nothing is copied into every part.

Choice options preserve `xx_mc`, `xx_nr`, and optional `xx_wj` image references in order.
Text-only, image-only, and combined options use the same safe local image resolver.
Options are not marked correct. Fill uses `xth` before `th`, reports conflicting values,
retains duplicate numbered rows separately, and preserves unnumbered source order.
Slashes are never split, including dates and ordinary punctuation.

Explicit `answer`, `std[].value`, and `ref[].value` retain their order and original field
provenance. Only the 3q5a adapter accepts string `std` entries. Keywords, key points,
speech evaluators, prompts, and unknown metadata never become answers. Word/read
adapters retain their verified answerless behavior even if an unrelated `answer` field
exists. A malformed question row can be skipped with a partial warning while valid
sibling questions survive. An entirely unusable group is rejected. Duplicate choice
IDs remain a strict error because their answer join is ambiguous.

Sibling `info.json` may be a metadata array: `code_id=answer` contains JSON text
`code_json_array` with `{stid,xth,answer}` rows. Join on both IDs, never array position;
explicit answers win. Both `stid` and `xt_xh` must be explicit source fields: a resource
locator or prompt display number cannot substitute for either ID. Conflicting or
malformed metadata is diagnosed and discarded
without losing valid explicit answers. A `content_choose` wrapper with JSON text
`code_json_obj` can supply a complete choice group as fallback.

## Content copies

The scanner validates **both** `content.json` and `content2.json`. `info.json` is tried
as a complete group only when neither content file is usable. No global deduplication
crosses resource directories or papers.

1. Same owning directory, collector, group ID, and equivalent complete normalized
   content load once. Both filenames remain in `sourceFiles`.
2. A verified copy convention adds one numeric display prefix (`6. `, for example)
   to an otherwise exact prompt. It is accepted only with matching explicit local
   question IDs and otherwise identical content; it is not text similarity matching.
   The first prompt remains displayed, and the alternate is retained in `promptVariants`.
   A prefix is not automatically an official number. Different numeric prefixes on
   both source sentences are not stripped to force equivalence.
3. Complementary nonconflicting fields merge only for matching explicit source
   group/collector IDs and unique explicit part IDs. Resource-locator identities
   remain separate from original source IDs, including identical-looking strings.
   Missing fields can be filled; new part IDs append in
   the second source's order. Options require matching unique labels in the same order.
   Answers may extend an exact ordered prefix but never change existing answer text/order.
   A choice copy with a real `xt_nr` can restore the prompt when the other copy promoted
   the exact same `xt_value` transcript to its prompt. Shared ownership stays intact.
4. Different nonempty prompts, answers, materials, or other incompatible fields retain
   both usable revisions and generate `conflicting_copies`. Different group IDs or
   collector kinds also remain separate.
5. Unnumbered or repeated-number rows are never joined by guessed position. Exactly
   equivalent complete lists can load once; otherwise they remain diagnosed revisions.

Invalid copies produce local diagnostics while valid copies continue. Filename order
chooses the representation of equivalent content, not precedence for conflicting data.

## Papers, ordering, and metadata

The established desktop layout is
`<bank>/<paper-id>/content_<group-id>/{content.json,content2.json,info.json,material/…}`.
Without a reliable metadata relationship, grouping and depth-first lexical order stay
compatible with the desktop scanner. A `content_*` directory belongs to its parent paper;
other sources retain their physical directory grouping. `File.lastModified` is not
treated as a directory timestamp.

For Android-style `<root>/data/<paper-id>` and `<root>/resource/<resource-id>/` layouts,
the scanner recognizes `sectionData[].sectionItemData[].fileName` relationships and
source order. Root-level index objects with `items[].{id,name,fileIdentifiers}` or
`byId[paperId].{name,file_identifiers}` are also supported. Exact resource paths resolve
only under that metadata document's resource root, including ZIPs without an enclosing
folder. Missing/unsafe references and conflicting ownership/order generate diagnostics;
the scanner does not search unrelated roots by basename.

Question-local `res.json.exam_type_list[]` can supply `exam_type_name` when its collector
matches uniquely. Exact `exam_list[].exam_id` or row `exam_id` matches allow
`exam_info[].value` markers such as `ets_th7=15.` (also the tested whitespace form).
An exam list singleton without an ID may be used within that same resource. Conflicting
markers remain unresolved. `officialNumber` is used by Qn labels and exports; local IDs
remain available. Template placeholders such as `{{st1}}` are not mapped using numeric
ID offsets, folder counts, timestamps, region assumptions, or nearby unrelated configs.
When those relationships are unavailable, original ordering and local numbering remain.

## Assets and exports

Media candidates are scoped to the original source JSON directory and its own
`material/` directory. An existing `material/` prefix is not duplicated. Exact matching
preserves case, Unicode, spaces, nested directories, and validated URL-decoded references.
If multiple candidates exist, resolution reports ambiguity instead of choosing one.
There is no cross-resource basename search. Traversal, absolute paths, external URLs,
`file:` references, and active markup are rejected.

Group `audio`/`video`, question `askaudio`/`askvideo`, choice `xt_wj`, and stored-reference
`audio`/`video` fields retain their explicit owners. Safe `<img>`, `<audio>`, `<video>`,
and nested `<source>` markup retains only resource references, not source playback or
script attributes. Empty-text stored references survive when they explicitly contain
media; empty rows without content remain absent. Reading/word evaluator fields still
never become answers. No directory scan invents visible media associations.

The resolver checks extension/MIME hints against bounded container signatures. Raster
headers, EXIF display dimensions, and image decode results are validated. MP3 and
browser-compatible MP4 use local Blob URLs with native controls; supported additional
containers remain subject to browser codecs. Players never autoplay or loop. Card
collapse and navigation pause playback; the final consumer releases each URL. Folder
and ZIP imports retain the same supported media under existing safety limits.
See [media-handling.md](media-handling.md) for the complete policy and diagnosis evidence.

Export uses only normalized fields: every group/part in paper order, source prompt,
context, relevant options, and first stored answer or `Answer not found`. It preserves
the desktop separators, UTF-8 BOM, LF newlines, and Windows-safe filenames where fields
are unchanged. New option images use `[Image: reference]` placeholders; normalized
supplementary material and explicit official numbers are included where applicable.
Later reference variants are never exported as extra questions or joined into answers.

## Evidence and boundaries

The existing desktop parser/scanner/exporter were inspected read-only and checked
against the authorized local bank. Third-party references informed independently
implemented compatibility rules; their application code was not copied or executed:

- [ETS100 structure documentation](https://github.com/laststudio/Fuck_ets100/blob/public/ets读取/ets100答案解析方法.md) describes the seven standard collectors and source fields.
- [Local reading logic](https://github.com/laststudio/Fuck_ets100/blob/public/ets读取/本地模式读取逻辑.md) describes data/resource relationships and template markers. Only explicit, scoped relationships are adopted here.
- [ETS-Answer-Parser](https://github.com/happycola233/ETS-Answer-Parser/blob/main/src/E听说解析.py) provides evidence for choice field variants and stored answer arrays.
- [get_ets100_answers](https://github.com/RootPlayer596/get_ets100_answers/blob/main/main.py) provides evidence for numbering-only choice prompts and `th` fill numbering. Its slash-splitting convention is deliberately not adopted.
- [Windows parser reference](https://github.com/banglee13/Fuck_ets100_win/blob/main/src/core/answer_parser.py) provides additional collector examples.
- [Resource metadata repository](https://github.com/laststudio/ets100_resources) documents paper/resource index relationships, separate from stored answers.

These are examples rather than a universal ETS specification. Unknown collectors,
databases, encrypted payloads, ambiguous template placeholders, and unverified field
semantics produce diagnostics or remain unsupported. Synthetic fixtures cover new
formats; the available real bank covers the original five collectors. No private bank
or downloaded third-party implementation is shipped with this repository.

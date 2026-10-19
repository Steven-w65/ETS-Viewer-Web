# ETS data and desktop parity

Reference: the read-only ETS-Viewer desktop `core/parser.py`, `scanner.py`,
`exporter.py`, `ui/renderer.py`, `ui/navigation.py`, documentation and tests,
inspected on 2026-10-19. No desktop files are copied into the running app.

## Layout and scanning

Observed bank: `<bank>/<paper-id>/content_<group-id>/{content.json,content2.json,info.json,material/…}`.
One containing directory produces one group: try content.json, then content2.json,
then the supported info.json wrapper. Read sibling info.json first for metadata.
The first valid copy wins. Invalid copies produce warnings. Other files are
identified by content, including JSON without an extension. Known media, fonts,
template metadata, dictionaries and common/config are supporting assets.
Group by the source parent; if that parent's name starts with content\_, use its
parent. Distinct directories with identical IDs remain distinct. Match Python's
lexicographic depth-first directory traversal and original sub-question order.
Browser File.lastModified is not a directory timestamp and is never used as one.

## Collector schemas

All have `structure_type` and an `info` object with a nonempty scalar `stid`.
Text permits strings/numbers, rejects booleans/objects. Strip only a leading
`ets_th<digits>` substitution marker from prompts.

| Kind               | Parts               | Shared/group fields             | Part fields and answers                                                                                              |
| ------------------ | ------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| collector.choose   | info.xtlist         | st_nr, st_sm, st_pic            | distinct xt_xh; xt_nr, xt_value, xt_pic, xt_analy; xxlist with xx_mc/xx_nr; explicit answer, otherwise metadata join |
| collector.dialogue | info.question       | value, image                    | distinct xh; ask, askimg, analyze; answer then every nonempty std[].value then ref[].value                           |
| collector.picture  | one unnumbered part | topic, image, analyze, keypoint | value; answer then std[].value then ref[].value                                                                      |
| collector.word     | one part            | image                           | xh, value, analyze, translate; no stored answers in the supported desktop adapter                                    |
| collector.read     | one part            | image                           | xh, value, analyze, translate; no stored answers in the supported desktop adapter                                    |

Metadata is an array of objects. `code_id=content_choose` contains a JSON string
`code_json_obj` holding choice info. `code_id=answer` contains JSON string
`code_json_array`: rows `{stid,xth,answer}`. Join by BOTH stid and xth, never row
position. Explicit part answers take precedence. Conflicting metadata answers
invalidate that metadata. Speech evaluator/AI/keyword fields never become answers.
Each stored answer retains its original field provenance. Empty answers stay absent.

## Images and formatting

Resolve beside the source JSON, then in that question's material directory.
Never search by basename elsewhere. Web intentionally rejects absolute and file:
paths: browsers cannot access desktop paths. Preserve basic safe HTML formatting,
tables, Unicode, paragraphs, emphasis, line breaks (including legacy </br>) and
images. Remove active markup and all imported resource attributes. Render only
validated local raster images (16 MiB, 40 million pixels maximum).

## Export

Match `format_answers`: header, Task, first-answer-only notice, 72-character group
and answer separators, group type, topic/instructions/context, every part prompt,
context/translation/options and first stored answer or Answer not found. Plain
text collapses whitespace and decodes HTML entities. UTF-8 BOM, LF newlines,
Windows-safe paper filename and .txt extension. Browser download replaces the
desktop save dialog; the browser controls the final destination.

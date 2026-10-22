# Verification — modular parsing, local media, UI motion and answer preview, 2026-10-22

## Executed checks

| Check                             | Result                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Unit/component tests              | 230 passed in 29 files, including media, welcome help, warnings, motion, folder dates and answer preview        |
| TypeScript strict check           | Passed as part of `npm run build`                                                                               |
| Vite production build             | Passed; static assets and a dedicated import worker generated                                                   |
| Edge 155.0.4283.62                | 49 UI assertions passed; prior 32 media checks include actual synthetic MP3 and H.264 MP4 playback, MP3 seeking |
| Playwright WebKit 27.2 on Windows | 49 UI assertions passed; prior 19 media checks verify fallbacks because native MP3/MP4 is unavailable           |
| Playwright Firefox 157            | Could not launch (`spawn UNKNOWN` in this run); browser behavior unverified                                     |
| Welcome folder-location guide     | 34 Chromium and 32 WebKit checks passed; native clipboard copy/read verified in Chromium for both paths         |
| Detailed UI motion                | 45 checks per engine passed in Edge and WebKit, including intermediate frames, reversals and dynamic height     |
| Authorized real-bank regression   | 55 groups, 140 sub-questions, 1,744 stored answers; 5 papers, 795 scanned files                                 |
| Desktop integrity                 | 188 baseline source files checked by SHA-256; 0 changed                                                         |

The global npm installation on this machine lacks `lru-cache`; project scripts were
executed with the existing isolated npm copy. No application dependency was added.
The earlier clean installation/lockfile validation
remains documented in project history; no fresh dependency installation was required
for this implementation. `test:media` was added as a verification script.

## Parser and import coverage

Each of the eight collectors has an independent test file. Tests cover normal content,
missing/optional fields, malformed structures, empty groups, and missing answers.
Special fixtures exercise choice `xt_nr`/`xt_value` precedence and exact duplicate text,
number-only prompt labels, group `st_nr`/`value`, text/image/combined options, `xth`/`th`
fill numbering, duplicate and missing numbers, slash-containing answers, ordered
reference variants, keywords, key points, evaluator exclusion, and source media.

Registry tests exercise unknown types and registration without entry-point changes.
Scanner tests cover equivalent/complementary/conflicting/unrelated content copies,
number-prefix variants, ambiguous unnumbered rows, damaged primary copies, supported
metadata wrapper fallback, Unicode/UTF-16/extensionless input, folder/ZIP equivalence,
Android data/resource bindings, `items`/`byId` indexes, exact template number mappings,
conflicting ownership, rootless ZIP metadata, and retained media ownership.

Existing security and lifecycle tests continue to cover archive path/CRC/size checks,
decompression bounds, source-local raster lookup, hostile markup, excessive formatting
fallback, Blob URL disposal, worker cancellation/replacement/unmount, appearance,
default collapse state, navigation limits, and neutral missing answers.

## Real-bank comparison

The private local bank was read in place and was not copied into the repository.
All 55 pairs of content files reconcile to one group each. Original group order,
question IDs, sub-question order, options, images, translations, explanations, and
every stored answer/provenance field remain compatible with the desktop reference.
No unsupported collector or partial source was present in that bank.

There is one intentional representation improvement: 40 choice sub-questions have
no meaningful `xt_nr`; the exact `xt_value` text becomes the prompt instead of staying
in the transcript slot. `tools/check-parity.mjs` explicitly verifies that exact source
text movement, projects only this documented change plus optional new metadata, and
then compares all original fields and all five legacy text exports against Python.
It does not claim the enhanced representation's exports are byte-identical where
prompt ownership changed. New image-option and all-eight-type exports have separate
unit and production-browser assertions.

The desktop scanner reports 0 issues for the current bank; the web reports 16 image
availability warnings for JPG references that are genuinely absent. Four dialogue groups
contain corresponding explicitly referenced `askvideo` MP4 files; the parser now preserves
those video references without pretending they replace missing images. The bank contains
207 raster and 301 audio/video files, now retained in the media asset index. No other media
failure was reported during bounded validation. Normal answerless tasks
are not treated as parse failures. New role/3q5a/fill compatibility is verified with
synthetic fixtures and mixed browser imports; the available real bank covers the
original five collectors.

## Browser and visual checks

The complete answer-preview implementation and its dedicated browser coverage are
documented in [answer-preview.md](answer-preview.md).
Its final dedicated browser checks pass 69 assertions in Edge and 66 in Windows
WebKit, including actual keyboard scrolling, source-order preservation, action
alignment at five viewport widths, focus restoration and Reader/media continuity.
Preview numbers now reset to 1 in each original group, with local heading ranges.
Regression tests cover repeated-type groups, missing answers without gaps, stable
entry IDs, and unchanged source/official numbers, regular Reader labels and exports.

The production preview is temporary and local. Both browser engines check ZIP and
automated folder imports, all eight types in one paper, equivalent-copy counts,
image-option decoding, aspect ratio, first/additional answers, full-paper BOM download,
fill/slash/option-image export, desktop/sidebar navigation, mobile hierarchy and scroll
restoration, resize state, 320px overflow, settings persistence, refreshed bank removal,
hostile imported content without script execution or remote requests, and image URL
release on bank change. Screenshot inputs are synthetic records.

Animation assertions verify a 200ms collapse with a measured intermediate height,
150ms question navigation fade, 200ms sidebar transition, and 180ms toast entry/exit.
They also check that reduced motion disables transitions and animations, and that a
desktop-collapsed sidebar remains usable after switching to mobile navigation.
Component tests verify exiting content is inaccessible and then removed; reduced
motion removes it immediately. Button hover transitions share a 140ms token.
Detailed motion implementation, regressions and compatibility limits are documented
in [ui-motion.md](ui-motion.md).

## Paper dates

Seventeen folder-date regressions cover explicit ZIP directory times, exact paper
ownership and Unicode wrappers, omitted directory entries, ignored child-file and
ancestor/nested-folder dates, logical Android ownership, invalid/missing timestamps,
invalid ZIP calendar fields, duplicate/unsafe directories and the date-only label.
Browser fixtures store Oct 19 on paper directories and Oct 21 on their content files;
the sidebar must display Oct 19. Folder selection must omit the date because the
current picker provides no directory timestamp. Neither creation dates nor file dates
are inferred. Directory entries do not enter question parsing, media assets or the
scanned-file count.

An automated folder-picker probe in Edge and WebKit returned 50 files and zero
directory entries. File modification timestamps were available, while directory
timestamps were not. This confirms why Select Folder omits the date in the current
browser-only implementation. No native integration or additional permission was added.

## Header import-warning dialog

Nine new diagnostic/component regressions verify real JPG/PNG/MP3/MP4 references,
Unicode filenames, separate source JSON paths, folder/ZIP parity, distinct failures in
one source record, duplicated diagnostic events, informational-only/zero counts, unknown
references, truthful empty-bank messaging, warning replacement, scroll-lock cleanup,
Close/Escape/backdrop dismissal, focus restoration, and Tab/Shift+Tab boundary cycling.

Inspection established that the previous resolver already retained `Issue.reference`,
but the scanner formatted a generic category message and the old inline list displayed
only `Issue.path` and `message`. Shared helpers now format the existing `Issue` model
and deduplicate exact underlying failures without merging different references or source
records. Raw `Bank.diagnostics` remains available; `Bank.issues` and the dialog exclude
informational events. Unnamed references preserve their field/kind identity, so malformed
audio and video fields do not collapse into one failure.

The inspected `586945/content_632503/content.json` resource has four distinct missing
JPG references, `ques1askimg.jpg` through `ques4askimg.jpg`; they are not duplicated scans
or non-image resources mislabeled as images. The full bank still has 16 missing JPG
warnings across four resources. The source bank remains read-only and is not shipped.

`node tools/browser-warnings.mjs` passes 45 checks in both Edge and WebKit. These cover
the one global header indicator immediately before Settings, removal of inline lists,
exact resource/source/candidate details, equivalent copies without inflated counts,
native modal semantics, keyboard containment and restored focus, Close/Escape/backdrop
dismissal, body scroll locking, 180ms animations, reduced motion, 320px wrapping and
dialog scrolling, themes, navigation/paper changes, folder/ZIP parity, bank replacement,
empty-bank messaging, and session-only warnings. Screenshots under ignored `.qa/warnings/`
use synthetic records. Physical mobile devices and screen-reader software were not tested.

The full suite passes 186 tests across 25 files; the production build, Chromium media
playback checks, existing UI suite, and real-bank answer/export comparison pass. The
dialog lists import-time diagnostics. Codec/playback failures discovered later retain
their existing player fallback and in-memory runtime diagnostics; they are not silently
reclassified as missing files or promoted into a new global warning system.

## Welcome folder-location guide

The compact disclosure starts collapsed between the import buttons and privacy note.
Windows defaults to exactly `%APPDATA%\ETS`; Android displays exactly
`/storage/emulated/0/Android/data/com.ets100.secondary/files/Download/ETS_SECONDARY/resource`.
Both instructions and the version/device disclaimer are shown with the selected platform.

Nine focused component tests cover initial placement/state, exact paths, tab state,
clipboard success only after completion, failed/unavailable clipboard access and retry,
stale asynchronous results after tab switching, keyboard controls, and unchanged folder/
ZIP callbacks and progress behavior. The full suite, including parser and media tests,
passes with 177 tests across 23 files.

`node tools/browser-folder-locations.mjs` passes 34 checks in Edge and 32 in WebKit.
The Chromium check writes each path through the real Clipboard API, reads it back, and
asserts exact equality. Both engines verify failure guidance, keyboard selection,
200ms transitions, reduced motion, default/reset state without persistence, light/dark
themes, real file-picker triggers, and no horizontal overflow at 320px/390px. WebKit's
native clipboard contents were not read. Screenshots are generated under ignored
`.qa/folder-locations/`; native mobile pickers and physical devices remain untested.
The component is informational only and never accesses either displayed path.

## Media regression and playback checks

58 additional tests cover extension/MIME/signature classification, JSON/unknown exclusion,
type disagreement, source-local resolution, material prefixes, Unicode/encoded spaces,
nested/rootless paths, exact case, missing/unsafe/ambiguous resources, duplicate basenames,
EXIF-rotated JPEGs, folder/ZIP parity, all eight parser adapters, explicit semantic owners,
safe HTML source alternatives, media-only references, and fill-answer audio. Lifecycle
tests verify concurrent URL leases, final release/reacquisition, disposal while validation
is pending, stable rerenders, native element types/attributes, collapse pause before exit,
hidden-reader cleanup, group navigation, codec errors, and accurate local read failures.

`tools/browser-media.mjs` imports a fully synthetic bank through wrapped ZIP, rootless
ZIP, and folder inputs. It creates a short silent MP3 from MPEG frames and a tiny H.264
MP4 from native canvas recording, without private content or a transcoder. Chromium
actually plays both files; MP3 seeking is checked. Tests verify native controls,
metadata preload, no autoplay/loop, playsInline, correct cards, unreferenced-file exclusion,
EXIF image dimensions, existing transition duration, 320px/mobile fit, collapse/navigation/back
pause, URL release on bank change, missing/undecodable fallbacks, safe markup, no remote
requests, and CSP permission for local Blob media.

WebKit on Windows returns native media error 4 for both fixtures even in isolated native
elements, independently of the application. Its 19 checks therefore verify supported
image/import/layout/security behavior and accurate unsupported-media fallbacks; they do
not demonstrate successful MP3/MP4 playback. Firefox installation succeeded, but launching
its executable fails with Windows' “side-by-side configuration is incorrect” error. No
Firefox behavior is claimed, and the machine's runtime configuration was not changed.

The old CSP blocked local audio/video Blob URLs before the production-browser fix.
Adding `media-src blob:` permits browser-local playback and continues to reject remote
media. The EXIF dimension rejection, ZIP media omission, ambiguous scoped paths, and
duplicated material prefix were reproduced with targeted failing regressions. No evidence
showed generic material-directory image discovery or premature URL revocation causing
the real bank's missing JPGs. See [media-handling.md](media-handling.md) for the full analysis.

## Limits

- No physical mobile device, macOS browser, or operating-system mobile file picker was tested.
- WebKit on Windows is not proof of Safari's platform-specific file selection behavior.
- Large private banks were not stress-tested on low-memory phones.
- Unknown collectors, database schemas, encrypted data, ZIP64/split/encrypted archives,
  and non-UTF-8 legacy ZIP filenames remain unsupported.
- Ambiguous template IDs such as `{{st1}}` are not resolved with numerical offsets,
  timestamps, geography, or folder-count assumptions. Unnumbered conflicting revisions
  remain separate rather than receiving guessed joins.
- MP4/WebM container recognition does not guarantee codec support. No automatic conversion
  or exact codec identification is provided. Unsupported browser decoders show a fallback.
- WebKit's Windows build cannot verify native MP3/MP4 playback; Firefox could not launch.
- Existing 32 MiB per-resource media limits can reject larger local files. Large banks
  and long recordings were not stress-tested on low-memory phones.
- No deployment was performed. Imported content and diagnostics remain in memory only.

## Final review

During the earlier parser refactor, an independent read-only review found three related identity-join defects. Six new
regression tests failed before the fix pass and then passed with the complete 110-test
suite. The fixes require original group/local IDs for metadata answers, keep resource
locators out of exam-ID matching, and prevent resource/display identities from driving
complementary copy merges. The same pass retains literal numbering-only source labels
as provenance, because distinguishing those labels from IDs must not discard them.
No important findings remain unresolved. The production build and real-bank comparison
passed again after the fixes.

The reviewer deferred judgment on visual quality, real-bank parity, external format
coverage, and desktop immutability to the corresponding verification workflows. Those
were assessed through production browser measurements and screenshot inspection,
the exact regression comparison, the six reviewed source references plus implemented
fixtures, and the 188-file hash check. Physical-device behavior and unseen source
variants remain outside this evidence; the checked desktop source files are unchanged.

A separate independent read-only media review found three Important gaps: unsupported
first-source handling, media-only content dropped by text-only guards, and fill answers
bypassing media extraction. Six focused regressions failed first and passed after one
fix pass. A further targeted test reproduced untyped audio read failures and now verifies
`file_read` diagnostics. No Important media review finding remains unresolved. The full
suite, production build, real-bank comparison, and desktop hashes were checked again;
physical devices and unseen codecs remain outside this evidence.

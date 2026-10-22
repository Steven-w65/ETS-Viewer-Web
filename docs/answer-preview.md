# Complete paper answer preview — 2026-10-22

The selected-paper reading header contains one horizontal action group:
**Preview Answers**, then **Export Paper**. Both actions reuse the existing button
styling and height. Mobile keeps that order with accessible icon buttons and tooltips.
The welcome screen and unselected bank overview have no preview action.

Preview opens a centered 720px maximum-width native dialog on desktop and fills the
viewport on mobile. The compact header retains the existing paper title/name, a
Close button and a separately scrolling answer body. Shared 180ms transitions and
reduced-motion preferences apply. Close, Escape and backdrop dismissal restore focus
and release the body scroll lock. The dialog is portaled to the document body so it
does not interrupt action adjacency or depend on the mobile workspace's visibility.
Tab and Shift+Tab cycle between Close and the named, visibly focusable answer region.
PageDown and arrow keys can scroll long answers without releasing modal focus.

## Data and numbering

`selectAnswerPreview` reads only normalized `Paper.questions` and each group's
`parts`, preserving both orders. It retains separate groups with identical types.
It does not read files, rerun ETS parsers, mutate state, create resource URLs or
change export behavior. The shared first-answer selector uses `firstSourceAnswer`
when present, otherwise `answers[0]`. A missing, empty or media-only first answer
renders `—` without promoting an alternative. Empty groups are retained without
inventing sub-questions.

Import normalization previously dropped empty reference variants. The reference
utility now retains the original first variant separately from the accepted-answer
array, including its field and media provenance. Reader and export still use the
same accepted answers as before. Equivalent/complementary content copies preserve
this source detail; conflicting first variants remain separate revisions. This is
an additive model correction, not a new preview parser.

Preview numbers use each sub-question's position within its original group: `1`,
`2`, `3`, and so on. Every group resets independently, including consecutive groups
of the same type. Missing answers retain their position without creating gaps.
Headings use the matching local range (`1` for one question, `1–N` for several);
empty groups have no range. These are presentation numbers only: source numbers,
official numbers, question IDs, parser output, Reader numbering and export numbering
remain unchanged. Stable React keys continue to use group source/index and part
index, independently of displayed numbers. The old fallback-number note is removed.

The raw first answer remains unchanged in the selector. Display formatting converts
HTML to plain text, preserves paragraph breaks, Chinese and special characters, and
omits images, audio/video, script/style and active markup. It uses the existing
htmlparser2 dependency and never builds imported browser DOM. Long answers are not
truncated. Choice numbers sit outside subtle 34px boxes; multi-option and nonstandard
values wrap/grow rather than being reduced to one letter.

## Structural labels

| Normalized type      | Preview heading     |
| -------------------- | ------------------- |
| `collector.choose`   | Multiple Choice     |
| `collector.word`     | Word / Sentence     |
| `collector.fill`     | Fill in the Blanks  |
| `collector.dialogue` | Dialogue            |
| `collector.role`     | Role-play           |
| `collector.3q5a`     | Questions & Answers |
| `collector.picture`  | Picture Description |
| `collector.read`     | Reading             |
| Other collectors     | Question Group      |

Labels are centralized for preview presentation and ignore regional display titles.
The normalized model does not reliably separate word and sentence tasks, so the
combined label is used. Stored answers and paper names are never translated.
Existing parser semantics remain authoritative, including answerless word/reading
tasks and stored answer precedence.

## Verification and limits

New selector and integration tests cover all labels, order, first-only selection,
missing/empty/long/Chinese answers, safe markup, per-group numbering and heading
ranges, repeated-type resets, source/official-number immutability, stable IDs,
unchanged Reader/export numbering, action adjacency, focus, dismissal, scroll
lock and Reader state preservation. `tools/browser-answer-preview.mjs` imports a
synthetic mixed paper and measures action order/equal heights at 1280, 800, 720, 390
and 320px; choice wrapping, full-screen mobile layout and long-answer scrolling;
focus, actual PageDown scrolling, Escape, rapid close/reopen, live reduced motion,
themes, paper switching and independent export. The ZIP fixture includes an empty
first reference followed by a nonempty alternative, checked through the real import
worker as well as parser-to-selector unit coverage.

Browser instrumentation verifies that preview creates/releases no Blob URLs, makes
no external requests and does not remount Reader. Edge additionally verifies that
opening/closing preview preserves an existing playing audio node without pausing or
recreating it. Windows WebKit cannot decode the synthetic media and does not certify
native playback. Physical Android/iOS, macOS Safari and Firefox are not verified.
Screenshots use synthetic content only and are stored under ignored `.qa/answer-preview/`.

Final results:

- 230 tests passed in 29 files, including 17 preview tests.
- TypeScript strict check and Vite production build passed.
- Edge 155.0.4283.62: 69 dedicated preview checks, 49 existing UI/import/export checks,
  and 32 media checks including actual synthetic MP3 and MP4 playback.
- Playwright WebKit 27.2: 66 dedicated preview checks and 49 existing UI/import/export
  checks; native playback is not certified.
- Reference parity: 5 papers, 55 groups, 140 parts, all 1,744 accepted stored answers
  and all 5 legacy exports match the existing reference contract.
- 188 desktop reference source files verified unchanged by SHA-256.

Independent final review identified inaccessible keyboard scrolling and promotion of
an empty first source variant. Both were reproduced with failing regressions and
fixed; the full test suite and browser checks above passed afterwards. No review
findings were deferred.

Files added: `src/core/answerPreview.ts`, `src/components/AnswerPreview.tsx`,
`tests/answer-preview.test.ts`, `tests/answer-preview-ui.test.tsx`,
`tools/browser-answer-preview.mjs`, and this report. Integrations modify `src/App.tsx`,
`src/components/Icon.tsx`, `src/styles/app.css` and `docs/verification.md`. The source-order
correction modifies `src/types/index.ts`, `src/core/parser/utils/answers.ts`,
`src/core/parser/utils/questionList.ts`, `src/core/parser/parsers/picture.ts` and
`src/core/scanner/copies.ts`.

No dependencies, parser architecture changes, import/export behavior changes,
desktop modifications, persistent question storage or deployment are included.

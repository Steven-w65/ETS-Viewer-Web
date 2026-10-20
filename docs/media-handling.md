# Local media handling

## Investigation and reproduced failures

The previous scanner indexed raster extensions and visited explicit parser/HTML image
references. It did **not** turn every `material/` entry into an image. The available
local bank contains 795 files, including 207 raster files and 301 audio/video files.
Its 16 image warnings are references to JPG files absent from four dialogue resources.
Those resources contain explicitly referenced `askvideo` MP4 files, which were previously
ignored. No evidence establishes that those MP4s are replacements for the missing JPGs;
the missing-image warnings remain accurate and videos now render from their own fields.
The private bank was read in place and is not shipped in this repository.

Additional verified implementation defects:

- A valid 48×24 EXIF-orientation-6 JPEG decodes as 24×48 in the browser. Comparing raw
  header dimensions with displayed decode dimensions incorrectly rejected the image.
  A self-authored regression fixture now loads with the correct dimensions.
- ZIP import discarded audio/video files while folder import retained them. Both now
  retain supported media within the existing per-file, aggregate, and CRC checks.
- The resolver silently selected the first of multiple scoped candidates and could
  form `material/material/…`. Synthetic regressions verify ambiguity reporting and
  removal of the duplicated candidate; unrelated basenames are never substituted.
- The page CSP lacked `media-src blob:`, so new native players could not load local
  URLs. Actual production-browser playback reproduced the block before the CSP fix.
- Review regressions exposed discarded media-only questions/answers, omitted fill-answer
  audio, and failure to try a later HTML source after `canPlayType` rejected the first.
  All were reproduced before the focused fix pass.

No premature URL revocation was established as a cause of the original bank's missing
images. URL ownership was nevertheless strengthened and verified for active consumers,
concurrent use, pending validation, collapse, navigation, and bank replacement.

## Responsibilities and supported references

The eight question-type adapters and registry remain intact. Parsers preserve semantic
references; shared infrastructure handles resolution, validation, rendering, and cleanup.

| Source                                                    | Owner                             |
| --------------------------------------------------------- | --------------------------------- |
| `info.audio`, `info.video`, shared image/context fields   | Shared Material                   |
| `info.question[].askaudio`, `.askvideo`, `.askimg`        | That sub-question's Question card |
| `info.xtlist[].xt_wj`, choice images and option `xx_wj`   | That choice question/option       |
| Supported ordered `std[]`/`ref[]` rows' `audio`/`video`   | That stored reference answer      |
| Safe media markup inside an existing supported text field | That text field's existing card   |

Unknown metadata strings and unreferenced directory entries do not produce UI media.
Reading and word evaluator fields still never become stored answers. Empty-text source
references with explicit media remain valid stored answers; no answer is synthesized.

`classifyMedia` uses extensions and available MIME hints. `resolveMedia` then reads at
most a 4 KiB container prefix, with a bounded second read after an ID3 tag for MP3.
JPEG segment/header inspection is bounded by the image-size limit. AV decoding remains
the native browser's responsibility; validation never reads a complete video merely to
detect its type and does not claim that a container guarantees codec support.

| Kind    | Containers                       | Renderer                              |
| ------- | -------------------------------- | ------------------------------------- |
| Image   | JPEG, PNG, WebP, GIF, BMP        | Validated `<img>`                     |
| Audio   | MP3, WAV, Ogg Opus/Vorbis, M4A   | Native `<audio controls>`             |
| Video   | MP4, WebM                        | Native `<video controls playsInline>` |
| Data    | JSON                             | Parser only                           |
| Unknown | Other or unrecognized signatures | No automatic rendering                |

Conflicting media kinds fail as `type_mismatch`. Validated same-kind subtype/MIME
corrections use the actual signature and record an informational mismatch. Audio/video
is limited to 32 MiB per resource. Existing raster limits remain 16 MiB, 40 million
pixels, and 32,768 pixels per dimension. Archives keep all previous safety limits.

## Scoped paths and security

References resolve only beside their original JSON and inside its local `material/`.
Validated literal and URL-decoded candidates preserve the imported root, exact case,
Unicode, spaces, and nested paths. A reference already beginning with `material/`
does not get another prefix. Multiple exact candidates are an error, including ambiguous
literal-percent versus decoded filenames. Network URLs, schemes, absolute paths, NULs,
and traversal segments are rejected before accessing a file. There is no global search
or operating-system path lookup.

Folder and ZIP imports both produce normalized virtual paths. Wrapper folders need not
be stripped because the source JSON and its media keep the same relative root. Duplicate
virtual paths are rejected. ZIP safety limits, symlink rejection, and CRC checks remain.

Imported HTML becomes an allowlisted AST, never `innerHTML`. Only media source references
are retained; event handlers, autoplay, loop, poster/track URLs, frames, and scripts are
not copied. Unsafe source candidates are diagnosed and can fall through to later safe
HTML sources. The CSP permits only Blob media, and synthetic browser tests verify that
imported media produces no remote requests or script execution.

## Playback, URL ownership, and diagnostics

Native controls use `preload="metadata"` and never autoplay or loop. Video fits the
reading column, uses `playsInline`, and preserves its content with `object-fit: contain`.
The first stored answer remains visible; Question, Shared Material, and later references
retain their existing independent collapsed defaults and transition durations.

Each mounted renderer acquires a lease. Validation is cached by source/reference and
active URLs are shared by resolved virtual path. Ordinary rerenders do not recreate
URLs. Collapse pauses immediately; its URL stays alive through the 200 ms exit transition,
then the element detaches and the final lease revokes the URL. Group changes, hidden mobile
reading, document visibility changes, and unmount pause players. Bank disposal rejects
new acquisitions and drops bank caches while existing consumers finish cleanup safely.
No Base64 conversion, persistent bank cache, transcoding, server, or media framework is used.

Import diagnostics live in `Bank.diagnostics`; runtime diagnostics live in the bank's
`MediaResources.diagnostics`. Both are local in-memory records. Media issues carry the
original relative reference (unsafe absolute/external references are redacted), source
JSON path, media kind, validated candidates, resolved path when available, and category:

`missing_reference`, `file_not_found`, `file_read`, `unsafe_path`, `ambiguous_path`,
`unsupported_type`, `type_mismatch`, `image_decode`, `audio_playback`, `video_playback`,
`blob_lifecycle`, or `size_limit`.

The reading UI shows concise Image/Audio/Video unavailable or unsupported-browser-format
messages. A present file that fails native decoding is distinguished from an absent file.
Native errors do not reliably identify the exact failing codec; no diagnostic claims to
know that codec. See [verification.md](verification.md) for actual test results and limits.

## Files for this media implementation

- `src/core/media/{types,classify,paths,imageHeader,resolve,references,resources}.ts`
- `src/core/images.ts`, `src/core/paths.ts`, `src/core/markup.ts`
- `src/core/importer/index.ts`, `src/core/scanner/{index,copies}.ts`
- `src/core/parser/context.ts`, shared answer/media/question-list/passage helpers, and
  choice/fill/picture adapters; `src/types/index.ts`
- `src/components/{LocalMedia,MediaVisibility,Reader,RichText}.tsx`, `src/App.tsx`,
  `src/styles/app.css`, `index.html`
- `tests/media-{assets,ownership,lifecycle,regressions}.test.*`,
  `tests/media-fixtures/rotated.jpg`, and the valid MP3 fixture in `tests/metadata.test.ts`
- `tools/browser-media.mjs`, `tools/media-fixtures.mjs`, `package.json` (`test:media`)
- `README.md`, `docs/{data-format,parser-architecture,media-handling,verification}.md`

Earlier authorized parser/import-screen changes remain in the same working tree. This
list describes the media feature rather than attributing all existing uncommitted work
to it. Browser smoke screenshots use synthetic content and may be refreshed by the checks.

# Using ETS Viewer Web

ETS Viewer Web reads the reference answers already stored in your local question bank.
Your files are processed in the browser, and the original bank stays unchanged.

[Back to the README](../README.md) · [Data formats](data-format.md) · [Media handling](media-handling.md)

## Open the app on your phone

1. Connect your computer and phone to the same trusted Wi-Fi network.
2. In the project folder on your computer, start Vite with network access:

   ```sh
   npm run dev -- --host 0.0.0.0
   ```

3. Open Vite's printed **Network** URL on your phone, such as `http://192.168.x.x:5173`.
4. Download the bank to the phone, then choose **Select Folder** or **Import ZIP**.

Allow the development server through the computer's firewall on the private network if
needed. VPNs, guest Wi-Fi isolation, and different networks can prevent access. On your
phone, `localhost` refers to the phone itself. No router forwarding is needed.

## Import a question bank

| Option            | When to use it                                                                                                                                                                 |
| :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Select Folder** | Select the bank root, a paper, or a question directory. The browser must return folder-relative paths from one selected root.                                                  |
| **Import ZIP**    | Open an archive containing the original directory structure. Use this if the browser or file provider cannot preserve folder paths. An enclosing top-level folder is optional. |

Both controls are available on desktop and mobile. Download cloud-only files through your
device's file provider first. Unicode filenames, spaces, and nested folders are supported.

A typical bank has this structure:

```text
ETS/
└── <paper-id>/
    └── content_<question-group-id>/
        ├── content.json
        ├── content2.json
        ├── info.json
        └── material/
            └── <original images, audio, and video>
```

The scanner validates both content files. Equivalent copies load once; complementary
fields merge by explicit IDs; conflicting revisions and unrelated groups remain available
with diagnostics. Supported `info.json` choice metadata is a fallback when neither content
file is usable. Other supported JSON can be identified by its content. Metadata-linked
layouts are also supported; see the [data format guide](data-format.md) for exact rules.

Invalid records produce warnings while valid records continue loading. The warning count
appears beside **Settings**. Open it to review the original media reference and source JSON
path; **Technical details** includes the attempted resolver paths. Warnings stay available
while the bank is open.

Canceling a file picker leaves the page unchanged. **Cancel import** stops the background
worker. **Change Bank** clears the current bank and releases its media resources.

## Navigate and read

Desktop uses a collapsible sidebar and opens the first question group when you select a
paper. Mobile uses separate paper, question-list, and reading pages. Returning to a list
restores its scroll position.

Questions, shared material, explanations, key points, and additional reference answers use
independent collapsible cards. The first accepted stored answer is visible immediately.
Missing answers show **Answer not found**. Use **Q1 / Q2** links to jump within a group and
**Previous / Next** to move between groups without wrapping past the paper's boundaries.
Changing groups resets reading scroll and card expansion; resizing preserves expansion.

Open **Settings** to choose System, Light, or Dark. System is the default. Transitions
respect reduced-motion preferences.

### Supported question formats

| Format                | Collector            |
| :-------------------- | :------------------- |
| Multiple choice       | `collector.choose`   |
| Role-play             | `collector.role`     |
| Questions and answers | `collector.3q5a`     |
| Fill in the blanks    | `collector.fill`     |
| Dialogue              | `collector.dialogue` |
| Picture description   | `collector.picture`  |
| Word / sentence       | `collector.word`     |
| Reading               | `collector.read`     |

The parser preserves stored answers and their source order. Keywords stay with their
question; prompts, speech evaluators, and unknown metadata never become answers. Word and
reading collectors preserve their supported answerless behavior.

### Images, audio, and video

Referenced media stays with its question, shared material, or stored-answer card. Files
do not appear simply because they share a `material/` directory.

| Type   | Supported containers      |
| :----- | :------------------------ |
| Images | PNG, JPEG, GIF, BMP, WebP |
| Audio  | MP3, WAV, Ogg, M4A        |
| Video  | MP4, WebM                 |

Audio and video use native browser controls and never autoplay. Collapsing a card, changing
groups, leaving mobile reading, or changing banks stops playback. Actual codec support
depends on your browser and operating system; a recognized container does not guarantee
playback. The app does not convert media. See [local media handling](media-handling.md) for
reference ownership, validation, and URL cleanup details.

## Preview a paper's answers

Choose **Preview Answers** beside **Export Paper** in the selected-paper header. The preview
shows the first original stored reference for each part as text, in source group order.
Questions are numbered from 1 within each group. Missing, empty, or media-only first
references display **—** without promoting a later alternative.

The preview uses a dialog on desktop and fills the screen on mobile. Close it with the
Close button, Escape, or the backdrop. Opening it preserves your reading position and
expanded cards. Preview numbering does not change the reader or export numbering. See the
[answer preview notes](answer-preview.md) for the precise first-source-answer rules.

## Export a paper

**Export Paper** downloads the entire selected paper as `.txt`, including every question
part, original options, and the first accepted stored answer for each part. The visible
group and collapsed cards do not limit the export.

Exports preserve the desktop text format, original ordering, UTF-8 BOM, LF newlines, and
Windows-safe filenames. Image options use `[Image: reference]` placeholders. Explicit
official numbers take precedence over local numbers when an unambiguous metadata mapping
exists. Your browser chooses the save destination; source files remain unchanged.

## Privacy and validation

Imported files and diagnostics remain in browser memory for the current session.
**Refreshing clears the bank.** Only the appearance preference is saved in `localStorage`.
The app has no accounts, backend, uploads, analytics, persistent bank restoration,
IndexedDB storage, or service worker cache.

Imported HTML becomes an allowlisted React tree. Scripts, styles, event handlers, frames,
links, and unsafe resource-loading attributes are removed. Media resolves only beside
its source JSON or inside its question-local `material/` directory. Remote URLs, absolute
paths, and `file:` references are rejected; unrelated directories are never searched.

### Resource limits

| Resource                                                    |                      Limit |
| :---------------------------------------------------------- | -------------------------: |
| Files / ZIP entries                                         |                     20,000 |
| Selected folder, using browser-backed files                 |                      1 GiB |
| Compressed ZIP                                              |                    128 MiB |
| Advertised uncompressed ZIP total, including ignored assets |                    256 MiB |
| Actual extracted total, checked during inflation            |                    256 MiB |
| Individual extracted data file / JSON                       |                     32 MiB |
| Individual audio/video resource                             |                     32 MiB |
| Raster image                                                | 16 MiB / 40 million pixels |
| Individual image width or height                            |              32,768 pixels |

ZIP headers, filenames, sizes, and CRCs are validated. Duplicate, absolute, and traversal
paths, symlinks, encrypted or split archives, and ZIP64 are rejected. Filenames must be
UTF-8; recreate legacy archives with Unicode filenames if necessary. Supported audio/video
is retained within the extraction limits; unknown template/support assets are skipped.

Media signatures are checked with bounded reads. Image dimensions are checked before
decoding, including EXIF orientation. Missing, mismatched, or undecodable media shows a
concise fallback. Active consumers share URLs, which are released after the final consumer
detaches. HTML fragments exceeding 20,000 formatting nodes or 80 nesting levels fall back
to their full safe text and image-reference labels, preserving stored answers and exports.
Large banks may still exceed a phone's available memory; import one paper at a time if needed.

## Troubleshooting

| Situation                                    | What to do                                                                                                                                                                                                |
| :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folder selection fails or loses paths        | Use **Import ZIP** with the original directory structure intact. Support depends on your browser and file provider.                                                                                       |
| Files are only available in cloud storage    | Download them to your device before importing.                                                                                                                                                            |
| **No Exams Found**                           | Check the selected folder and review import warnings. The bank must contain a supported ETS schema.                                                                                                       |
| Images are missing                           | Preserve the original relative assets beside the JSON or in its `material/` directory. Desktop absolute paths cannot be loaded.                                                                           |
| Audio/video is unavailable                   | Check the warning details for missing or mismatched files. For a present file with an unsupported codec, use a browser that can play the original file.                                                   |
| **Answer not found**                         | No answer was found in the supported stored-answer fields. Check the source bank.                                                                                                                         |
| A preview answer shows **—**                 | The first original reference is missing, empty, or media-only. The preview does not substitute a later alternative.                                                                                       |
| A paper's date is missing                    | Dates require the paper folder's own timestamp from an explicit ZIP directory entry. The folder picker returns no directory timestamp. Unknown dates are omitted; child-file dates are never substituted. |
| An import exceeds a size or memory limit     | Import a smaller bank or a single paper. See the limits above.                                                                                                                                            |
| npm reports `Cannot find module 'lru-cache'` | If this development checkout contains the ignored npm helper, replace `npm` with `node .qa/node_modules/npm/bin/npm-cli.js`. See the [environment notes](verification.md) for context.                    |

The app targets browsers with ES2022, module workers, `Blob.arrayBuffer`, and image decoding.
Chromium and WebKit checks include desktop and mobile emulation. Physical iPhone, iPad,
Android, macOS browsers, and native mobile file pickers remain unverified. See the
[verification report](verification.md) for executed checks and codec limitations.

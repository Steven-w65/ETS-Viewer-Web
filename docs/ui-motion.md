# UI motion verification — 2026-10-21

Motion changes preserve the existing layout, copy, themes, answer defaults, navigation,
statistics and local media ownership. No dependencies, parser/import/export changes,
desktop edits or deployment are included.

## Shared behavior

`src/styles/app.css` defines 140ms hover/focus, 200ms disclosure/chevron/sidebar,
150ms view/tab and 180ms overlay durations with shared easing. Existing view fades
run on mounting or mobile visibility changes, without extra Reader keys/remounts.

`AnimatedDisclosure` replaces Reader's private collapse logic and native warning
technical details. `AnimatedPanel` also powers the folder guide. A ResizeObserver
watches the natural inner flow, independent of the outer height transition, so late
images, media metadata, long text and responsive paths update the target height.
There are no animation loops or per-frame DOM measurements. A CSS-grid fallback
keeps content readable if ResizeObserver is unavailable; intrinsic changes in that
fallback do not receive the same measured height animation.

`usePresence` retains exiting children until the CSS duration ends, cancels stale
cleanup on reopening, and responds to live reduced-motion changes. Media pauses
immediately on collapse while its existing component and Blob URL survive the exit
and quick reversals. The existing media resource manager is unchanged.

Settings, warning dialog/backdrop and toast use reversible opacity transitions.
A browser regression reproduced Settings jumping from approximately 0.60 opacity
to 1 when an entrance was interrupted; the new transition continues from its current
opacity. CSS `@starting-style` supplies entrance states; older engines without it
show overlays immediately on entrance while retaining functional dismissal.

Sidebar children keep their original 288px/250px column width while the grid track
and opacity animate, preventing label rewrapping. Mobile restores the original fluid
width. Disclosures do not issue scroll commands; intentional group navigation resets
and existing mobile/list scroll restoration remain intact.

## Accessibility

Disclosures expose paired `aria-expanded`/`aria-controls` and immediately make closed
content inert and hidden from accessibility APIs. Closing a disclosure or Settings
returns focus from its controls to its trigger. Native dialog focus trapping, Escape,
backdrop dismissal, scroll locking and trigger restoration remain in place. Reduced
motion removes transitions and completes pending retained exits.

## Reproducible verification

| Check                                | Result                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Full Vitest suite                    | 196 tests passed in 26 files                                                   |
| Strict TypeScript / production build | Passed                                                                         |
| Edge 155.0.4283.62                   | 45 motion, 47 UI, 32 media, 34 folder guide, 45 warning checks passed          |
| Windows WebKit 27.2                  | 45 motion, 47 UI, 19 media fallback, 32 folder guide, 45 warning checks passed |
| Original desktop repository          | 188 baseline hashes checked; 0 changed                                         |

- `tests/motion.test.tsx`: CSS-driven exit lifetime, child identity during reversal,
  live reduced motion, observed intrinsic size, focus, Settings, toast and warning
  cleanup. Existing reading, import, media and diagnostic tests remain in the suite.
- `node tools/browser-motion.mjs`: actual intermediate height/opacity samples, late
  local JPEG growth, all disclosure types, long answers, platform height changes,
  interrupted overlay fades, dialog/backdrop entrance/exit, keyboard focus, sidebar
  widths, preserved scroll, mobile Reader identity and observer-unavailable fallback.
- Existing browser smoke/media/folder/warning tools verify imports, export, themes,
  navigation, exact clipboard paths, local MP3/MP4, URL cleanup and diagnostics.

Screenshots use synthetic records only. Firefox cannot launch on this host (`spawn
UNKNOWN` in this run). Windows WebKit reports native decoder error 4 even for the
synthetic MP3/MP4, so it verifies fallbacks rather than actual playback. Physical
Android/iOS devices, macOS Safari and low-memory phone performance are untested.
MP4 codec support remains browser-dependent.

A fresh-context read-only final review found no Critical, Important or Minor issues
in the completed diff. Runtime claims above come from the executed test/browser
tools, rather than the reviewer's static inspection.

## Files

Production changes: `src/components/AnimatedDisclosure.tsx`, `src/hooks/useMotion.ts`,
`src/styles/app.css`, `src/components/Reader.tsx`, `FolderLocations.tsx`,
`Warnings.tsx`, `Toast.tsx`, and `src/App.tsx`.

Verification changes: `tests/motion.test.tsx`, `tests/extended-reading.test.tsx`,
`tests/warnings.test.tsx`, `tools/browser-motion.mjs`, timing/selector assertions in
`tools/browser-smoke.mjs`, `browser-media.mjs`, `browser-warnings.mjs`, settled
screenshot timing in `browser-folder-locations.mjs`, and this document plus
`docs/verification.md`. No parser, importer, exporter or media infrastructure changed.

## Accordion header stability — 2026-10-23

A browser regression reproduced a 0.5px upward movement of the Additional Reference
Answers label. The expanded selector added a bottom border from 0px to 1px. In the
50px header, flex centering then positioned the text 0.5px higher. Question and
Shared Material headers with preview text instead gained 1px in total height.
Padding, typography, transforms and scroll position did not change. The tested
scroll container also retained its width when the expanded answer introduced
overflow, so scrollbar appearance was not the reproduced cause.

The shared `.collapse-toggle` now always reserves a 1px transparent bottom border.
Expansion changes its color only. The chevron has an explicit non-shrinking 16px
SVG layout box and remains the only transformed header element. The 200ms content
height/opacity and chevron transitions are preserved. No text positioning offsets
or state-dependent header dimensions are used.

The existing keyboard outline was also clipped by the card's `overflow: hidden`.
Its focus-visible outline now paints inside the header. This affects focus paint
only, without changing the label, padding, border geometry or animation.

`node tools/browser-accordion.mjs` runs actual pointer, emulated touch, Enter and
Space interactions against an imported synthetic bank. It samples text-glyph and
header bounds on every animation frame, checks intermediate content heights and
matching 200ms chevron timing, and verifies focus containment and reduced motion.
The matrix includes 1280px, 390px and 320px widths, Light/Dark, English/Simplified
Chinese, repeated open/close cycles, all three Reader accordions and an artificially
extended label at 320px. `ETS_BROWSER_ENGINE=webkit` runs the same matrix in WebKit;
`ETS_ACCORDION_QUICK=1` runs one layout, and `ETS_ACCORDION_PROBE=1` prints before/after
diagnostic measurements with temporary hypothesis styles instead of changing files.

The original browser regression failed with the measured 0.5px movement before the
CSS fix. A separate keyboard check failed for the clipped outline before its fix.
The complete Vitest suite remains green at 272 tests in 35 files, and strict
TypeScript plus the production build pass. Edge 155.0.4283.62 and Windows WebKit
27.2 each passed 1,512 browser assertions across the 12 width/language/theme
combinations. The maximum measured header-label displacement was 0px in both
engines. The inset focus ring was also visually inspected after keyboard activation.
Touch uses emulation; physical Android/iOS devices and macOS Safari are not claimed.

Files for this focused fix: `src/styles/app.css`,
`tools/browser-accordion.mjs` and this verification note. No React component,
parser, importer, media, navigation, preview, export, localization or theme logic
was modified.

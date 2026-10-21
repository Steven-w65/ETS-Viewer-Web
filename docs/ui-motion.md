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

| Check | Result |
| --- | --- |
| Full Vitest suite | 196 tests passed in 26 files |
| Strict TypeScript / production build | Passed |
| Edge 155.0.4283.62 | 45 motion, 47 UI, 32 media, 34 folder guide, 45 warning checks passed |
| Windows WebKit 27.2 | 45 motion, 47 UI, 19 media fallback, 32 folder guide, 45 warning checks passed |
| Original desktop repository | 188 baseline hashes checked; 0 changed |

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

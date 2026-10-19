# Verification — 2026-10-19

## Executed checks

| Check                                       | Actual result                                                      |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Vitest unit/component suite                 | 56 tests passed in 6 files                                         |
| TypeScript strict typecheck                 | Passed as part of npm run build                                    |
| Vite static production build                | Passed; independent assets in dist/                                |
| Clean npm installation                      | npm ci in isolated clean directory passed                          |
| Dependency audit of npm lockfile            | 0 reported vulnerabilities                                         |
| Python parser parity on available real bank | 55 groups, 140 parts, 1,744 stored answers matched field for field |
| Desktop full-paper text export parity       | All 5 papers matched exactly                                       |
| Chromium (installed Edge 155.0.4283.62)     | 36 browser assertions passed, desktop and mobile emulation         |
| Playwright WebKit 27.2 on Windows           | 36 browser assertions passed, desktop and mobile emulation         |

The parser parity comparison included 802 source files. The Python scanner
reported 7 source issues and the web scanner 23; the web scanner also proactively
checks referenced image paths/headers that the desktop scanner defers to rendering.
Question content and exports still matched exactly.

The final source-integrity comparison checked 188 files in the original desktop
project: **0 changed**. No deployment was performed.

An independent final code review identified root-level ZIP image lookup and
excessive HTML child counts as edge cases. Both received failing regression
tests and fixes, followed by the green full suite. The final formatting fallback
preserves the full safe text rather than truncating answers. Worker cancellation
tests also cover late results, stale errors during replacement, and unmount.

## Coverage

Synthetic tests cover all five collectors; numeric/string IDs; metadata wrappers,
joins, precedence and conflicts; stored answer ordering and missing answers;
malformed records; folder-relative paths, mixed/missing roots and Unicode;
wrapped ZIP equivalence; corrupt CRC, duplicate/traversal paths, configured limits,
false uncompressed-size headers; alternate copy fallback, UTF-16 and extensionless
JSON; separate papers with identical IDs; templates and unsupported databases;
question-local image ownership, remote/traversal rejection, pixel limits;
inert markup and legacy breaks; independently collapsed cards, visible primary
answers, Qn anchors and group boundaries; dialogue formatting and appearance.

Browser checks run against the actual static production build. They cover ZIP
and automated folder picker import; independent mobile pages; question-list scroll
restoration; resize/state preservation; default card state; additional answers;
real PNG decoding and aspect ratio; image URL release when changing banks;
full-paper UTF-8 BOM downloads; reload without bank restoration; both mobile
import buttons; missing relative-path ZIP fallback; group navigation boundaries;
320px overflow; theme persistence; no search input; malicious imported HTML without
script execution or any remote resource request. No browser page errors occurred
during the checked desktop flows.

Screenshots under screenshots/ are actual captures from these browser sessions,
using **synthetic** ETS records, rather than mockups or private question content.

## Limits of verification

- No physical iPhone, iPad, Android phone, or macOS browser was used.
- WebKit on Windows does not establish Safari's OS file picker behavior.
- Automated folder selection supplies real directory-relative File objects but
  does not prove a user's particular mobile file provider supports directory picks.
- ZIP64, encrypted/split archives and non-UTF-8 legacy ZIP filenames are explicitly
  unsupported. The user receives an import error.
- The app intentionally cannot use Windows absolute paths from desktop records.
- Extremely large and pathological real banks were not tested on low-memory phones.
- No deployment was performed. Network preview is a local development server only.

The machine's pre-existing global npm installation lacked lru-cache. Standard
package scripts were executed using an isolated npm 11.6.3 copy. A clean install
from package-lock.json succeeded; no global npm files were modified.

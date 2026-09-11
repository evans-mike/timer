# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A single-page "Time Timer" web app — a countdown timer with a circular visual progress arc (à la the physical Time Timer product). Pure static HTML/CSS/JS, no build step, no package manager, no framework.

- `index.html` — page structure and markup
- `timer.js` — all timer logic, state machine, and DOM wiring
- `styles.css` — all styling, including light/dark themes
- `sounds/` — start/finish audio cues (currently unused — see below)
- `timer.png` — favicon / apple touch icon

## Running / developing

There is no build or dev server tooling. Open `index.html` directly in a browser, or serve the directory with any static file server (e.g. `python3 -m http.server`) and visit it. There are no tests, linters, or package.json — nothing to install.

`gptcommit install` is used locally by the repo owner for commit messages (per README.md); not required for making changes.

## Architecture

Everything runs client-side with no dependencies except [NoSleep.js](https://github.com/richtr/NoSleep.js) (loaded from unpkg in `index.html`) for iOS screen-wake-lock fallback.

**State machine**: the timer is driven by a single `timerState` variable in `timer.js` with four states: `idle` → `running` ⇄ `paused` → `finished` → `idle`. `setTimerState()` is the single place that applies visual state (arc color via `stateColors`, icon, and the SVG foreground/background stacking order). Tapping the circle (`onCircleTap`) is the only state transition trigger besides changing the minutes/seconds dropdowns (which resets to `idle`).

**Timing**: the countdown uses `requestAnimationFrame` (`runAnimation`) driven off wall-clock deltas (`Date.now()`), not `setInterval` — this keeps the countdown accurate even if the tab is throttled. There's a dead/unused `setInterval`-based alternative (`runInterval`) left in the file; it is not called anywhere.

**Circle rendering**: the progress ring is an SVG arc path computed by `describeArc(cx, cy, r, angleDeg)`, redrawn every animation frame in `updateTimerTextAndArc()`. A `linearGradient` (`#trailGradient`) is rotated via `gradientTransform` to create a fading trail effect behind the arc head.

**Persistence**: `localStorage` stores the last-used time (`timerValue`, as `"MM:SS"`) and dark mode preference (`darkMode`), restored in `init()`.

**Screen wake lock**: `enableScreenAwake()` / `disableScreenAwake()` try the native Screen Wake Lock API first and fall back to NoSleep.js when unsupported (mainly iOS Safari). Called on entering/leaving the `running` state.

**Sounds**: `notify()` plays `sounds/_start.mp3` / `sounds/_finish.mp3` and triggers `navigator.vibrate()`. Note the underscore-prefixed filenames — these correspond to the muted/renamed files in `sounds/` (`_og_start.mp3`, `_og_finish.mp3` are the originals; `start.mp3`/`finish.mp3` also exist unused). Sound was intentionally muted per a past commit ("muted sounds for now").

## Notes for future changes

- Dark mode is applied via a `.dark-mode` class toggled on `<body>`; SVG fill colors for background/foreground circles are set directly via JS (not CSS) in several places (`init()`, `setTimerState()`, the dark-mode toggle handler) — when changing theme colors, all of these call sites need to stay in sync.
- The footer at the bottom of `index.html` (marked `ppj-signature: start/end`) is a site-credit snippet; treat it as boilerplate, not app logic.

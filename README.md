# NEXUS Signal Intelligence — Demo Simulation

A cinematic, sci-fi "signal analysis" dashboard built for a harmless prank between friends.

> **This is a simulation only.** It does not track any phone, read GPS, contact a telecom
> provider, or identify a subscriber. The entered number is never stored or sent anywhere.
> Every location, signal value and network result is preset demo data. The interface
> shows "DEMO SIMULATION" / "SIMULATION MODE" labels throughout.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure, inline SVG icons, dashboard panels, alert dialog |
| `styles.css` | Visual design: glass panels, neon accents, animations, responsive layout, reduced-motion support |
| `script.js`  | Simulation logic: validation, sequences, terminal, progress, map, sound, alert |
| `README.md`  | This file |

## Run it

1. Put all four files in the same folder.
2. Double-click `index.html` (or drag it into Chrome). No server, build step or install needed.

With an internet connection the map uses **Leaflet** + **OpenStreetMap** tiles.
Offline, the page automatically switches to a built-in stylised demo map — everything else
works the same.

## How the demo plays

| Click | What happens |
|-------|--------------|
| **1st — ANALYZE NUMBER** | Validates the number → scanning animation, matrix rain, progress ring, timestamped terminal log → shows the preset **Dawanau, Kano State** demo map with a fictional 5 KM radius, pulsing marker and radar. |
| **2nd — TRACK AGAIN** | New scan → "Signal instability detected" → "Connection interrupted" → "Network unavailable" → full-screen red alert: **NO NETWORK DETECTED · SIGNAL LOST · PLEASE VISIT THE NEAREST OFFICE.** |
| **3rd — RESTART SIMULATION** | Resets everything, ready to run again. |

- **RESET** works at any time, including mid-scan.
- The red alert can be closed with **DISMISS** or **Esc**; **RESTART SIMULATION** is on the alert and in the Alert Monitor panel.
- Clicking during a scan does nothing — only one scan can run at a time.

## Phone number validation

Accepted (spaces, dashes, brackets allowed):

- Nigerian local: `0` + 10 digits, e.g. `08038254949`
- Nigerian international: `+234` + 10 digits, e.g. `+2348038254949`
- Other international numbers: 7–15 digits

Empty input, letters, or a `0…` number that isn't 11 digits shows an inline error.

## Sound

Sound effects are **off by default** and never autoplay. Tap **SFX OFF** in the header to
turn them on. Sounds are generated in the browser with the Web Audio API (no audio files).

## Accessibility

- Keyboard friendly; visible focus rings; skip link.
- Progress ring exposes `role="progressbar"` with live values.
- Key events are announced to screen readers through a polite live region.
- The red alert is an `alertdialog` with focus trapped inside and Esc to close.
- `prefers-reduced-motion` turns off sweeps, pulses, matrix rain and typing animation.

## Customising

All preset data is in the `CONFIG` object at the top of `script.js`:

- `defaultNumber` — the number pre-filled in the input
- `demoLocation` — name, state, map centre and radius of the demo area
- `firstSequence` / `secondSequence` — the step messages, progress targets and extra terminal lines

Developer option: add `?speed=5` to the URL (1–20) to run the sequences faster, e.g. when testing.

## Privacy & safety

- No backend, no analytics, no tracking scripts, no cookies, no API keys.
- No use of the Geolocation API.
- The only external requests are the Leaflet library (unpkg.com, with Subresource Integrity)
  and OpenStreetMap map tiles. Map data © OpenStreetMap contributors.

Please keep the prank kind: reveal the joke afterwards, and don't use it to scare someone into
believing their phone or account is really blocked.

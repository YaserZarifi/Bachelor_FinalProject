# شهریاور — "Civic Signal" Design System

The single source of visual truth for the citizen web app, admin dashboard, and mobile app.
Replaces the previous "Aurora Glass" (indigo/violet glassmorphism) identity, which read as a
generic *AI purple gradient* look. Civic products want **high contrast, a warm human accent,
service green, and WCAG-grade legibility** — not blur-everything glass.

## Concept

**A city that signals.** A citizen sends a *signal* (a report) into the city; the city
answers and resolves it. The **beacon pin** is the brand mark. Amber is the "signal / attention"
of a reported problem; emerald is the city working and the problem resolved; coral is urgent.
Color carries real meaning, not decoration.

Grounded in the subject's world: street signage, streetlights at night, wayfinding maps,
transit lines, municipal markers.

## Palette (semantic)

Dark mode is the hero (ink canvas + glowing amber/emerald signals = "night city, streetlights").
Light mode is a cool paper (never cream), ink text, same accent story.

| Token | Hex | Meaning |
|-------|-----|---------|
| `ink-950` | `#080d18` | darkest canvas |
| `ink-900` | `#0c1322` | dark canvas |
| `ink-850` | `#111a2e` | dark raised surface |
| `ink-800` | `#17223a` | dark card |
| `ink-700` | `#1e2c49` | dark border/hover |
| **`beacon` (amber) — PRIMARY signal / attention** | 400 `#f9b526` · 500 `#f2a20d` · 600 `#d67f04` | the "report a problem" action, pins, highlights |
| **`civic` (emerald) — SUCCESS / RESOLVED / service** | 400 `#34d399` · 500 `#10b981` · 600 `#0d9c6e` | resolved, live, positive |
| **`coral` — URGENT / crisis** | 400 `#fb7185` · 500 `#f43f5e` · 600 `#e11d48` | urgent reports, emergency |
| **`sky` — INFO / in-progress** | 400 `#38bdf8` · 500 `#0ea5e9` | in-progress, informational |
| paper (light) | bg `#f5f7fa` · card `#ffffff` | light canvas / cards |
| slate/steel | Tailwind `slate` | neutral text, borders, muted |

Contrast rules: dark text on amber/emerald surfaces (signage-style), white text on ink/coral/sky.
Body text ≥ 4.5:1, secondary ≥ 3:1, in both themes.

## Typography

- **Vazirmatn** — all Persian UI + body. Full weight range (300–900) + tabular numerals for data.
- **Space Grotesk** — Latin display, the wordmark, big numbers/stats, English & numeric labels,
  data ticks. Technical/wayfinding character; gives the hierarchy the old single-face system lacked.
- Type scale is deliberate: oversized display for hero, tight tracking on headings, generous
  line-height (1.6) on Persian body.

## Signature elements

1. **Beacon pin** — location pin + radiating signal ring. Logo, map markers, empty states, loaders.
2. **Civic line (transit lifecycle)** — report status
   `SUBMITTED → REVIEWING → IN_PROGRESS → RESOLVED → CLOSED` drawn as a metro line with stations;
   the "done" segment animates in via `pathLength`. Used on citizen MyReports, mobile detail,
   admin detail. Encodes a *real* sequence, so the station/numbering device is earned.
3. **Wayfinding surfaces** — solid, confident, high-contrast cards (depth via elevation + hairline
   borders, not heavy blur). Signage-style eyebrows/labels, tabular numerals, a faint map-grid texture.

## Motion (sleek, purposeful — user wants smooth animation everywhere)

Signal pulse on pins · transit-line self-draw · section fade-up + stagger reveals · number
count-ups · map fly-to · shared-element report cards · stepper slides · modal spring.
GPU-only props (transform/opacity). `prefers-reduced-motion` always respected.

## Moving away from

Blur-everything glassmorphism · indigo/violet "AI aurora" · single-typeface flatness ·
decorative-only motion.

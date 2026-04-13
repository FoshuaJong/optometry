# NZ CL Calculator — CLAUDE.md

## Project overview
This project is a small, static, single-page web app that converts a spectacle refraction (OD/OS SPH/CYL/Axis/(ADD)) into a *starting* contact lens power estimate.
It is **reference-only**: it must not present itself as medical advice or as a substitute for professional fitting.

Primary goal: a clean, fast, mobile-friendly calculator UX with deterministic math and clear disclaimers.
Secondary goal (later): optionally add a lens catalogue for NZ-available products, but **do not** build that yet unless explicitly requested.

## Current scope (MVP)
- 3-step flow: Rx → Options → Results
- OD/OS inputs: SPH, CYL, Axis, optional ADD (MF mode toggle)
- Options: vertex distance, vertex threshold rule, rounding steps, toric preference threshold
- Output: starting CL SPH/CYL/Axis plus notes about assumptions
- Local-only / static hosting (no backend, no user accounts)

## Non-goals (avoid over-engineering)
- No brand database / manufacturer catalogue integration in MVP
- No persistence (no login, no cloud storage)
- No analytics, no tracking
- No “diagnosis”, no clinical recommendations beyond generic “verify clinically”
- No pixel-perfect cloning of other products’ UI (avoid IP/trade-dress issues)

## Key formulas & conventions
### Notation
- Assume minus-cylinder input for MVP.
- Axis is only meaningful when CYL != 0.

### Vertex conversion baseline
Use the standard effective power conversion:
- `F_cl = F_spec / (1 - d * F_spec)`, where `d` is vertex distance in meters.

For spherocyl (minus cyl), apply per meridian:
- `M1 = S`
- `M2 = S + C`
- `M1v = vertex(M1)`
- `M2v = vertex(M2)`
- Output (corneal plane):
  - `S' = M1v`
  - `C' = M2v - M1v`
  - `Axis' = Axis` (until lens availability constraints exist)

Vertex threshold rule (optional): only apply vertex when `|meridian| >= 4.00D`.

### Rounding (MVP)
Use generic rounding steps:
- Sphere rounded to nearest `0.25D` (or `0.50D` when selected).
- Cylinder rounded to nearest `0.
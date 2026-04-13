# CLAUDE.md — CL Calculator (NZ) Wireframe + Catalogue Plug‑in

## 0) Purpose (read this first)
This repo is a **static single-page web app** that reproduces the **visible** CL Calculator UI features/actions from the Pocket OD CL Calculator page text (not pixel-perfect styling). It is **reference-only**: never present as medical advice.

Claude Code reads this file at the start of every session; keep it concise and practical. [1](https://code.claude.com/docs/en/claude-directory)

---

## 1) Product definition
### What we’re building
A client-side web app that includes:
- Tool sub-nav pages: **All Contact Lenses**, **Vertex Chart**, **Radius Conversion**, **Rx Schedule**, **Brands**, **Results**
- A Results page containing:
  - OD/OS Rx entry with **SPH −/+**, **CYL −/+**, **Axis quick 90/180**, **ADD (for MF only)**
  - **Copy OD → OS**
  - **Dominant Eye** selector (Right/Left)
  - **Reset**, **Back**, **Next**
  - **Send Feedback** (mailto) and **Add to iPhone Home Screen** (modal)

### What we are NOT building (avoid over-engineering)
- No backend, no accounts, no telemetry.
- No “pixel-perfect clone” of competitor UI (avoid IP/trade-dress risk).
- No clinical “recommendations”. Output is a **starting estimate** only.

---

## 2) Acceptance criteria: “feature parity” checklist
### Global nav items (top bar)
- [ ] Contact Lenses
- [ ] Medications
- [ ] Clinical Tools
- [ ] CL Calculator (active)

### Tool sub-nav tabs (pages)
- [ ] All Contact Lenses
- [ ] Vertex Chart
- [ ] Radius Conversion
- [ ] Rx Schedule
- [ ] Brands
- [ ] Results

### Rx entry controls (Results page)
OD (Right Eye):
- [ ] SPH input with −/+ step buttons (0.25D default)
- [ ] CYL input with −/+ step buttons (0.25D default)
- [ ] Axis input + quick set buttons 90 and 180
- [ ] ADD input with −/+ step buttons (MF only label)

OS (Left Eye):
- [ ] SPH input with −/+ step buttons
- [ ] CYL input with −/+ step buttons
- [ ] Axis input + quick set buttons 90 and 180
- [ ] ADD input with −/+ step buttons (MF only label)

Cross-eye:
- [ ] Copy OD → OS

MF refinement:
- [ ] Dominant Eye toggle (Right/Left)

Flow + session:
- [ ] Reset (clears inputs + selection)
- [ ] Back navigation (moves to previous tab in tab order)
- [ ] Next navigation (moves to next tab in tab order)

Footer/actions:
- [ ] Disclaimer: “For reference only. Verify…”
- [ ] Send Feedback button (mailto)
- [ ] Add to iPhone Home Screen button (opens instructions modal)

---

## 3) Repo layout (do not rename without updating references)
- `index.html` — all UI markup; no build step required
- `styles.css` — styling only
- `apps.js` — app logic; event handlers; computations; catalogue loading
- `catalogue.json` — OPTIONAL drop-in data file (same directory). If missing, app runs in “no catalogue” mode.
- `catalogue.local.json` — gitignored local override; rename/symlink to `catalogue.json` to test locally without committing data.

Keep everything runnable by opening `index.html` directly. If fetch() fails due to file:// restrictions, run a simple local server (see Commands). Prefer **no frameworks**.

## 5) Commands
- `python -m http.server 8080` — local dev server (open http://localhost:8080)
- `npx serve .` — alternative if Node is available

---

## 4) Catalogue plug-in contract (important)
The app should attempt `fetch("./catalogue.json")`. If it fails, show “No catalogue loaded” but keep the app functional.

### Minimal schema (stable)
```json
{
  "brands": [
    {
      "id": "brand-id",
      "name": "Brand Name",
      "lenses": [
        {
          "id": "lens-id",
          "name": "Lens Name",
          "type": "soft|rgp|hybrid|other",
          "notes": "optional",
          "rounding": { "sphereStep": 0.25, "cylStep": 0.25, "axisStep": 10 },
          "availability": {
            "sphereRanges": [
              { "min": -12.0, "max": -6.5, "step": 0.50 },
              { "min": -6.0, "max": 8.0, "step": 0.25 }
            ],
            "cylValues": [-0.75, -1.25, -1.75, -2.25],
            "axisValues": [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180]
          }
        }
      ]
    }
  ]
}
``
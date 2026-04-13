# CLAUDE.md — CL Calculator (NZ) Wireframe + Catalogue Plug-in

## 0) Purpose
Static single-page web app reproducing the **visible** CL Calculator UI from PocketOD (https://pocketod.com/#contactlenscalculator). Reference-only — never present output as medical advice. No pixel-perfect clone (IP/trade-dress risk).

Claude Code reads this file at the start of every session; keep it concise and practical.

---

## 1) Product definition

### What we're building
Client-side SPA with:
- **Top nav:** Contact Lenses | Medications | Clinical Tools
- **Sub-nav (Contact Lenses section):** CL Calculator | All Contact Lenses | Vertex Chart | Radius Conversion
- **CL Calculator** is a step-based workflow (progress bar across top of card):
  1. **Rx Entry** — OD/OS prescription inputs
  2. **Lens Selection** — brand/option grid filtered by Rx
  3. **Order Detail** — selected lens parameters + fit summary

### What we are NOT building
- No backend, accounts, or telemetry.
- No clinical recommendations — output is a starting estimate only.
- No pixel-perfect clone of PocketOD styling.

---

## 2) Acceptance criteria

### Top nav
- [ ] Contact Lenses (active section)
- [ ] Medications (stub/inactive)
- [ ] Clinical Tools (stub/inactive)

### Sub-nav (Contact Lenses)
- [ ] CL Calculator (step-based, see below)
- [ ] All Contact Lenses (catalogue browse)
- [ ] Vertex Chart (conversion table)
- [ ] Radius Conversion (conversion table)

### Step 1 — Rx Entry
OD and OS sections (collapsible), each with:
- [ ] SPH input + sign toggle (−/+), step 0.25 D
- [ ] CYL input + sign toggle (−/+), step 0.25 D
- [ ] AXIS input + quick-set buttons (90 / 180), range 0–180°
- [ ] ADD input + sign toggle (MF only label), step 0.25 D
- [ ] Vertex Distance input (mm)

Cross-eye:
- [ ] Copy OD → OS button
- [ ] Clear Rx button (per eye or global)

Dominance:
- [ ] Dominant Eye toggle (OD / OS)

### Step 2 — Lens Selection
- [ ] Option grid (2-col, touch-friendly) showing brand/lens type cards
- [ ] Each card: icon, title, description, optional count badge
- [ ] Active/selected state (colored outline + check icon)
- [ ] Filtered by Rx values from Step 1

### Step 2 list view — lens result cards
- [ ] Result count + metadata header
- [ ] Sort controls
- [ ] Per-lens card: brand stripe, badges (brand/modality/DK), lens name, specs grid, Select button

### Step 3 — Order Detail
- [ ] Back button
- [ ] Lens name + brand label
- [ ] Fitting guide link (pill button)
- [ ] Parameter grid (label + value boxes, highlight key params)
- [ ] Warning note boxes (amber) where relevant

### Global controls (all steps)
- [ ] Reset button (clears all inputs + selection, top-right of card)
- [ ] Back / Next navigation buttons (bottom of card)
- [ ] Progress/steps bar (top of card, shows active step)

### Footer
- [ ] Disclaimer: "For reference only. Verify all parameters before prescribing."
- [ ] Send Feedback (mailto link)
- [ ] Add to iPhone Home Screen (opens modal with instructions)

---

## 3) Repo layout (do not rename without updating references)
- `index.html` — all UI markup; no build step
- `styles.css` — styling only
- `app.js` — logic, event handlers, computations, catalogue loading
- `catalogue.json` — optional drop-in data; if missing, app runs in "no catalogue" mode
- `catalogue.local.json` — gitignored local override (rename to `catalogue.json` to test)

Runnable by opening `index.html` directly. If `fetch()` fails (file:// restriction), use local server. **No frameworks.**

---

## 4) Commands
- `python -m http.server 8080` — local dev server → http://localhost:8080
- `npx serve .` — alternative if Node available

---

## 5) Catalogue plug-in contract

`fetch("./catalogue.json")` on load. Failure → show "No catalogue loaded", app stays functional.

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
              { "min": -6.0, "max": 8.0,  "step": 0.25 }
            ],
            "cylValues": [-0.75, -1.25, -1.75, -2.25],
            "axisValues": [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180]
          }
        }
      ]
    }
  ]
}
```

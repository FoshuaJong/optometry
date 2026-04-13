/**
 * apps.js — Feature-complete wireframe reproduction of the visible CL Calculator UI/actions.
 * - Implements all buttons/actions explicitly shown in the Pocket OD CL calculator snippet:
 *   - Sections: All Contact Lenses, Vertex Chart, Radius Conversion, Rx Schedule, Brands, Results
 *   - Rx entry: OD/OS SPH/CYL/Axis/ADD, SPH-/+, CYL-/+, axis quick 90/180
 *   - Copy OD -> OS, Dominant Eye Right/Left, Reset, Back, Next
 *   - Send Feedback, Add to iPhone Home Screen
 * - Catalogue plugin: attempts to load ./catalogue.json and use it for lens selection and rounding hints.
 */

// ---------- Utilities ----------
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtD(v) {
  if (!isNum(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}D`;
}

function roundToStep(v, step) {
  if (!isNum(v)) return v;
  const inv = 1 / step;
  return Math.round(v * inv) / inv;
}

// Vertex conversion baseline (for chart + computed output)
// F_cl = F_spec / (1 - d * F_spec), d in meters
function vertexConvert(Fspec, vertexMm) {
  if (!isNum(Fspec)) return null;
  const d = (isNum(vertexMm) ? vertexMm : 12) / 1000;
  const denom = (1 - d * Fspec);
  if (Math.abs(denom) < 1e-6) return Fspec;
  return Fspec / denom;
}

// Radius conversion (simple tool)
function dioptersToRadiusMm(D) {
  if (!isNum(D) || D === 0) return null;
  return 337.5 / D;
}
function radiusMmToDiopters(mm) {
  if (!isNum(mm) || mm === 0) return null;
  return 337.5 / mm;
}

// ---------- Catalogue plug-in ----------
/**
 * Expected optional file: ./catalogue.json
 * Minimal schema (you can extend later without changing app logic):
 * {
 *   "brands": [
 *     {
 *       "id": "acme",
 *       "name": "ACME Vision",
 *       "lenses": [
 *         {
 *           "id": "acme-daily",
 *           "name": "ACME Daily",
 *           "type": "soft",
 *           "notes": "optional",
 *           "rounding": { "sphereStep": 0.25, "cylStep": 0.25, "axisStep": 10 },
 *           "availability": {
 *             "sphereRanges": [ {"min": -12, "max": -6.5, "step": 0.5}, {"min": -6, "max": 8, "step": 0.25} ],
 *             "cylValues": [-0.75, -1.25, -1.75, -2.25],
 *             "axisValues": [10,20,...,180]
 *           }
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
const catalogue = {
  loaded: false,
  error: null,
  data: { brands: [] },
};

function flattenLenses(cat) {
  const out = [];
  for (const b of (cat?.brands || [])) {
    for (const l of (b?.lenses || [])) out.push({ ...l, brandId: b.id, brandName: b.name });
  }
  return out;
}

async function loadCatalogue() {
  catalogue.loaded = false;
  catalogue.error = null;
  catalogue.data = { brands: [] };
  renderCatalogueStatus("Loading catalogue…");

  try {
    const res = await fetch("./catalogue.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`catalogue.json not found (HTTP ${res.status})`);
    const data = await res.json();
    if (!data || !Array.isArray(data.brands)) throw new Error("Invalid catalogue schema: expected {brands: [...] }");

    catalogue.data = data;
    catalogue.loaded = true;
    renderCatalogueStatus(`Catalogue loaded: ${data.brands.length} brand(s), ${flattenLenses(data).length} lens(es).`);
  } catch (e) {
    catalogue.error = String(e?.message || e);
    catalogue.loaded = false;
    renderCatalogueStatus(`No catalogue loaded: ${catalogue.error}`);
  }

  renderAllLenses();
  renderBrandDropdown();
  renderBrandLenses();
  renderSelectedLens();
  computeAndRenderOutput();
}

// ---------- App state ----------
const state = {
  // tabs in this wireframe (explicitly present in source text)
  tabOrder: ["all", "vertex", "radius", "schedule", "brands", "results"],
  activeTab: "all",

  // selection
  selectedLensId: null,

  // Rx
  rx: {
    od: { sph: null, cyl: null, axis: null, add: null },
    os: { sph: null, cyl: null, axis: null, add: null },
  },

  // dominant eye (explicitly present in source text)
  dominantEye: "Right",

};

// Back/Next move across state.tabOrder:
function goBack() {
  const i = state.tabOrder.indexOf(state.activeTab);
  setTab(state.tabOrder[Math.max(0, i - 1)]);
}
function goNext() {
  const i = state.tabOrder.indexOf(state.activeTab);
  setTab(state.tabOrder[Math.min(state.tabOrder.length - 1, i + 1)]);
}

// ---------- Rendering + UI wiring ----------
function setTab(tab) {
  state.activeTab = tab;

  document.querySelectorAll(".tab").forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("tab-active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll(".panel").forEach(panel => {
    const show = panel.dataset.panel === tab;
    panel.classList.toggle("hidden", !show);
  });

  // When visiting certain tabs, refresh renders
  if (tab === "vertex") buildVertexTables();
  if (tab === "brands") renderBrandLenses();
  if (tab === "all") renderAllLenses();
  if (tab === "results") computeAndRenderOutput();
}

function renderCatalogueStatus(text) {
  const el = $("catalogueStatus");
  if (el) el.textContent = text;
}

function renderAllLenses() {
  const wrap = $("allLensList");
  if (!wrap) return;

  const q = ($("allSearch")?.value || "").trim().toLowerCase();
  const lenses = flattenLenses(catalogue.data);

  const filtered = lenses.filter(l => {
    if (!q) return true;
    return (l.name || "").toLowerCase().includes(q) || (l.brandName || "").toLowerCase().includes(q);
  });

  wrap.innerHTML = "";
  if (!catalogue.loaded) {
    wrap.innerHTML = `
      <div class="item">
        <div class="item-title">No catalogue</div>
        <div class="item-meta">Add a <code style="font-family:var(--mono)">catalogue.json</code> file to populate this list.</div>
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    wrap.innerHTML = `<div class="item"><div class="item-title">No matches</div><div class="item-meta">Try a different search.</div></div>`;
    return;
  }

  for (const l of filtered) {
    const div = document.createElement("div");
    div.className = "item";
    const selected = state.selectedLensId === l.id;

    div.innerHTML = `
      <div class="item-title">${escapeHtml(l.name || "Unnamed lens")}</div>
      <div class="item-meta">
        <span>Brand: ${escapeHtml(l.brandName || "—")}</span>
        <span>Type: ${escapeHtml(l.type || "—")}</span>
        ${l.notes ? `<span>Notes: ${escapeHtml(l.notes)}</span>` : ""}
      </div>
      <div class="item-actions">
        <button class="btn ${selected ? "btn-primary" : "btn-ghost"}" type="button" data-select-lens="${escapeHtml(l.id)}">
          ${selected ? "Selected" : "Select"}
        </button>
        <button class="btn btn-ghost" type="button" data-jump="results">Use in Results</button>
      </div>
    `;
    wrap.appendChild(div);
  }
}

function renderBrandDropdown() {
  const sel = $("brandSelect");
  if (!sel) return;

  const brands = (catalogue.data?.brands || []);
  const current = sel.value;

  sel.innerHTML = `<option value="">All brands</option>`;
  for (const b of brands) {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name || b.id;
    sel.appendChild(opt);
  }
  sel.value = current; // keep if possible
}

function renderBrandLenses() {
  const wrap = $("brandLensList");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!catalogue.loaded) {
    wrap.innerHTML = `<div class="item"><div class="item-title">No catalogue</div><div class="item-meta">Add catalogue.json to enable brand browsing.</div></div>`;
    return;
  }

  const brandId = $("brandSelect")?.value || "";
  const q = ($("brandSearch")?.value || "").trim().toLowerCase();

  const brands = (catalogue.data?.brands || []);
  const pickBrands = brandId ? brands.filter(b => b.id === brandId) : brands;

  let lenses = [];
  for (const b of pickBrands) {
    for (const l of (b.lenses || [])) lenses.push({ ...l, brandId: b.id, brandName: b.name });
  }

  if (q) {
    lenses = lenses.filter(l => (l.name || "").toLowerCase().includes(q));
  }

  if (lenses.length === 0) {
    wrap.innerHTML = `<div class="item"><div class="item-title">No matches</div><div class="item-meta">Try another brand or search.</div></div>`;
    return;
  }

  for (const l of lenses) {
    const div = document.createElement("div");
    div.className = "item";
    const selected = state.selectedLensId === l.id;

    const rounding = l.rounding || {};
    const roundingText = [
      rounding.sphereStep ? `sphereStep=${rounding.sphereStep}` : null,
      rounding.cylStep ? `cylStep=${rounding.cylStep}` : null,
      rounding.axisStep ? `axisStep=${rounding.axisStep}` : null,
    ].filter(Boolean).join(", ");

    div.innerHTML = `
      <div class="item-title">${escapeHtml(l.name || "Unnamed lens")}</div>
      <div class="item-meta">
        <span>Brand: ${escapeHtml(l.brandName || "—")}</span>
        <span>Type: ${escapeHtml(l.type || "—")}</span>
        ${roundingText ? `<span>Rounding: ${escapeHtml(roundingText)}</span>` : `<span>Rounding: (default)</span>`}
      </div>
      <div class="item-actions">
        <button class="btn ${selected ? "btn-primary" : "btn-ghost"}" type="button" data-select-lens="${escapeHtml(l.id)}">
          ${selected ? "Selected" : "Select"}
        </button>
        <button class="btn btn-ghost" type="button" data-jump="results">Go to Results</button>
      </div>
    `;
    wrap.appendChild(div);
  }
}

function renderSelectedLens() {
  const el = $("selectedLens");
  if (!el) return;

  const lens = getSelectedLens();
  if (!lens) {
    el.textContent = "None selected";
    return;
  }

  const rounding = lens.rounding || {};
  el.innerHTML = `
    <div><strong>${escapeHtml(lens.name || "Lens")}</strong></div>
    <div class="subtle">Brand: ${escapeHtml(lens.brandName || lens.brandId || "—")}</div>
    <div class="subtle">Rounding hints: sphereStep=${rounding.sphereStep ?? "default"}, cylStep=${rounding.cylStep ?? "default"}, axisStep=${rounding.axisStep ?? "default"}</div>
    <div class="subtle topgap"><button class="link" type="button" id="btnClearLens">Clear selection</button></div>
  `;

  $("btnClearLens")?.addEventListener("click", () => {
    state.selectedLensId = null;
    renderSelectedLens();
    computeAndRenderOutput();
    // update list buttons
    renderAllLenses();
    renderBrandLenses();
  });
}

function buildVertexTables() {
  const mm = parseNum($("vertexMmChart")?.value) ?? 12;

  const minusPowers = [-4,-5,-6,-7,-8,-9,-10,-12,-14,-16,-18,-20];
  const plusPowers  = [4,5,6,7,8,9,10,12,14,16,18,20];

  $("vertexMinusTable").innerHTML = buildSimpleTable(minusPowers, mm);
  $("vertexPlusTable").innerHTML  = buildSimpleTable(plusPowers, mm);
}

function buildSimpleTable(powers, vertexMm) {
  const rows = powers.map(p => {
    const v = vertexConvert(p, vertexMm);
    return `<tr><td>${fmtD(p)}</td><td>${fmtD(roundToStep(v, 0.01))}</td></tr>`;
  }).join("");

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Spectacle</th><th>Vertexed (CL plane)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function fillSchedule() {
  const body = $("scheduleBody");
  if (!body) return;
  const rows = [
    ["1", "Enter Rx", "OD/OS SPH/CYL/Axis/(ADD)"],
    ["2", "Select lens (optional)", "From Brands / All Contact Lenses"],
    ["3", "Review results", "Reference-only; verify clinically"],
    ["4", "Adjust & iterate", "Use −/+ buttons, axis quick set, Copy OD→OS"],
  ];
  body.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r[0])}</td>
      <td>${escapeHtml(r[1])}</td>
      <td class="subtle">${escapeHtml(r[2])}</td>
    </tr>
  `).join("");
}

// Compute output shown in Results panel
function computeAndRenderOutput() {
  const out = $("computedOutput");
  if (!out) return;

  // read inputs
  const rx = readRxFromUI();
  state.rx = rx;

  // apply rounding hints from selected lens if any
  const lens = getSelectedLens();
  const rounding = lens?.rounding || {};
  const sphereStep = rounding.sphereStep ?? 0.25;
  const cylStep = rounding.cylStep ?? 0.25;
  const axisStep = rounding.axisStep ?? 1;

  // compute: per meridian for spherocyl
  const od = convertSpherocyl(rx.od, sphereStep, cylStep, axisStep);
  const os = convertSpherocyl(rx.os, sphereStep, cylStep, axisStep);

  const lines = [];
  lines.push(`Selected lens: ${lens ? `${lens.name} (${lens.brandName || lens.brandId || "—"})` : "None"}`);
  lines.push(`Dominant eye: ${state.dominantEye}`);
  lines.push(`Rounding: sphereStep=${sphereStep}, cylStep=${cylStep}, axisStep=${axisStep}`);
  lines.push("");
  lines.push("OD (Right):");
  lines.push(...formatResultBlock(od));
  lines.push("");
  lines.push("OS (Left):");
  lines.push(...formatResultBlock(os));
  lines.push("");
  lines.push("Notes:");
  lines.push("- Reference-only output; verify clinically before prescribing.");
  lines.push("- Catalogue-aware availability constraints are stubs unless you supply catalogue.json.");

  out.textContent = lines.join("\n");
}

function readRxFromUI() {
  const od = {
    sph: parseNum($("od_sph")?.value),
    cyl: parseNum($("od_cyl")?.value),
    axis: parseNum($("od_axis")?.value),
    add: parseNum($("od_add")?.value),
  };
  const os = {
    sph: parseNum($("os_sph")?.value),
    cyl: parseNum($("os_cyl")?.value),
    axis: parseNum($("os_axis")?.value),
    add: parseNum($("os_add")?.value),
  };
  return { od, os };
}

function convertSpherocyl(eye, sphereStep, cylStep, axisStep) {
  const vertexMm = 12; // original snippet does not expose a user-set vertex control; keep fixed for now.

  const sph = eye.sph ?? 0;
  const cyl = eye.cyl ?? 0;
  const axis = eye.axis;

  // meridians (minus cyl assumed)
  const m1 = sph;
  const m2 = sph + cyl;

  const m1v = vertexConvert(m1, vertexMm);
  const m2v = vertexConvert(m2, vertexMm);

  let outSph = m1v;
  let outCyl = m2v - m1v;

  outSph = roundToStep(outSph, sphereStep);
  outCyl = roundToStep(outCyl, cylStep);

  // axis snapping (if axis exists)
  let outAxis = null;
  if (isNum(axis)) {
    let a = clamp(Math.round(axis), 1, 180);
    if (axisStep > 1) a = clamp(Math.round(a / axisStep) * axisStep, axisStep, 180);
    outAxis = a;
  }

  // availability constraints (stub): if catalogue provides axisValues/cylValues, snap to nearest
  const lens = getSelectedLens();
  if (lens?.availability) {
    outCyl = snapIfList(outCyl, lens.availability.cylValues);
    outAxis = snapIfList(outAxis, lens.availability.axisValues);
    // sphere ranges: choose nearest available step within ranges
    outSph = snapSphereToRanges(outSph, lens.availability.sphereRanges, sphereStep);
  }

  return { sph: outSph, cyl: outCyl, axis: outAxis, add: eye.add };
}

function snapIfList(value, list) {
  if (!isNum(value) || !Array.isArray(list) || list.length === 0) return value;
  let best = list[0];
  let bestDist = Math.abs(best - value);
  for (const v of list) {
    const d = Math.abs(v - value);
    if (d < bestDist) { best = v; bestDist = d; }
  }
  return best;
}

function snapSphereToRanges(value, ranges, fallbackStep) {
  if (!isNum(value) || !Array.isArray(ranges) || ranges.length === 0) return roundToStep(value, fallbackStep);
  // choose the range that contains value; else nearest boundary
  let bestVal = null;
  let bestDist = Infinity;

  for (const r of ranges) {
    const min = r.min, max = r.max, step = r.step ?? fallbackStep;
    if (![min, max, step].every(isNum)) continue;

    const clamped = clamp(value, Math.min(min, max), Math.max(min, max));
    const snapped = roundToStep(clamped, step);
    const dist = Math.abs(snapped - value);
    if (dist < bestDist) { bestDist = dist; bestVal = snapped; }
  }

  return bestVal ?? roundToStep(value, fallbackStep);
}

function formatResultBlock(r) {
  const lines = [];
  lines.push(`  SPH: ${fmtD(r.sph)}`);
  lines.push(`  CYL: ${fmtD(r.cyl)}`);
  lines.push(`  Axis: ${isNum(r.axis) ? `${r.axis}°` : "—"}`);
  if (isNum(r.add)) lines.push(`  ADD: ${fmtD(r.add)}`);
  return lines;
}

function getSelectedLens() {
  if (!catalogue.loaded || !state.selectedLensId) return null;
  const lenses = flattenLenses(catalogue.data);
  const l = lenses.find(x => x.id === state.selectedLensId);
  return l || null;
}

// ---------- Actions (buttons) ----------
function resetAll() {
  // Clear Rx inputs
  ["od_sph","od_cyl","od_axis","od_add","os_sph","os_cyl","os_axis","os_add"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });

  // Dominant eye default right
  document.querySelectorAll("input[name='dominant_eye']").forEach(r => {
    r.checked = (r.value === "Right");
  });
  state.dominantEye = "Right";

  // Clear selection
  state.selectedLensId = null;

  renderSelectedLens();
  renderAllLenses();
  renderBrandLenses();
  computeAndRenderOutput();
}

function copyODtoOS() {
  $("os_sph").value = $("od_sph").value;
  $("os_cyl").value = $("od_cyl").value;
  $("os_axis").value = $("od_axis").value;
  $("os_add").value = $("od_add").value;
  computeAndRenderOutput();
}

function nudgeField(fieldId, delta) {
  const el = $(fieldId);
  if (!el) return;
  const cur = parseNum(el.value) ?? 0;
  const next = roundToStep(cur + delta, 0.25);
  el.value = next.toFixed(2);
  computeAndRenderOutput();
}

function setAxis(fieldId, value) {
  const el = $(fieldId);
  if (!el) return;
  el.value = String(clamp(value, 1, 180));
  computeAndRenderOutput();
}

// ---------- DOM event wiring ----------
function wireEvents() {
  // Tabs
  document.addEventListener("click", (e) => {
    const tabBtn = e.target.closest(".tab");
    if (tabBtn) setTab(tabBtn.dataset.tab);

    const jumpBtn = e.target.closest("[data-jump]");
    if (jumpBtn) setTab(jumpBtn.dataset.jump);

    const selectBtn = e.target.closest("[data-select-lens]");
    if (selectBtn) {
      state.selectedLensId = selectBtn.dataset.selectLens;
      renderSelectedLens();
      renderAllLenses();
      renderBrandLenses();
      computeAndRenderOutput();
    }

    const nudgeBtn = e.target.closest("[data-nudge]");
    if (nudgeBtn) {
      const id = nudgeBtn.dataset.nudge;
      const delta = parseNum(nudgeBtn.dataset.delta) ?? 0;
      nudgeField(id, delta);
    }

    const axisBtn = e.target.closest("[data-axis]");
    if (axisBtn) {
      const id = axisBtn.dataset.axis;
      const v = parseNum(axisBtn.dataset.set) ?? null;
      if (v !== null) setAxis(id, v);
    }

    // Back/Next controls in Results panel
    if (e.target?.id === "btnBack") goBack();
    if (e.target?.id === "btnNext") goNext();

    // Global reset buttons
    if (e.target?.id === "btnResetAll") resetAll();
    if (e.target?.id === "btnCopyODtoOS") copyODtoOS();

    // Vertex chart rebuild
    if (e.target?.id === "btnBuildVertexChart") buildVertexTables();

    // Radius conversions
    if (e.target?.id === "btnDToR") {
      const D = parseNum($("dToR").value);
      const mm = dioptersToRadiusMm(D);
      $("dToROut").textContent = isNum(mm) ? `${mm.toFixed(2)} mm` : "—";
    }
    if (e.target?.id === "btnRToD") {
      const mm = parseNum($("rToD").value);
      const D = radiusMmToDiopters(mm);
      $("rToDOut").textContent = isNum(D) ? `${D.toFixed(2)} D` : "—";
    }

    // Feedback + Home Screen actions
    if (e.target?.id === "btnSendFeedback") {
      window.location.href = "mailto:contact@pocketod.com?subject=CL%20Calculator%20Feedback";
    }
    if (e.target?.id === "btnAddToHome") openModal();
    if (e.target?.id === "btnCloseModal") closeModal();

    // Catalogue reload
    if (e.target?.id === "btnReloadCatalogue") loadCatalogue();
  });

  // Search boxes
  $("allSearch")?.addEventListener("input", () => renderAllLenses());
  $("brandSearch")?.addEventListener("input", () => renderBrandLenses());
  $("brandSelect")?.addEventListener("change", () => renderBrandLenses());

  // Rx inputs: recompute on change
  ["od_sph","od_cyl","od_axis","od_add","os_sph","os_cyl","os_axis","os_add"].forEach(id => {
    $(id)?.addEventListener("input", () => computeAndRenderOutput());
  });

  // Dominant eye radio
  document.querySelectorAll("input[name='dominant_eye']").forEach(r => {
    r.addEventListener("change", () => {
      const checked = document.querySelector("input[name='dominant_eye']:checked");
      state.dominantEye = checked ? checked.value : "Right";
      computeAndRenderOutput();
    });
  });
}

function openModal() {
  $("modal").classList.remove("hidden");
}
function closeModal() {
  $("modal").classList.add("hidden");
}

// Basic HTML escaping
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Init ----------
function init() {
  fillSchedule();
  wireEvents();
  setTab("all");
  loadCatalogue();
}

init();
// NZ CL Calculator (wireframe)
// Scope: spectacle Rx -> starting CL power estimate (no lens catalogue).
// NOTE: Reference-only tool. Not medical advice.

const $ = (id) => document.getElementById(id);

const state = {
  step: 0,
  rx: {
    od: { sph: null, cyl: null, axis: null, add: null },
    os: { sph: null, cyl: null, axis: null, add: null },
  },
  options: {
    vertexMm: 12,
    vertexThreshold: true,
    roundSphStep: 0.25,
    roundCylStep: 0.25,
    toricPreferred: true,
    multifocal: false,
    dominantEye: "OD",
  },
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function parseNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function roundToStep(value, step) {
  if (value === null) return null;
  const inv = 1 / step;
  return Math.round(value * inv) / inv;
}

function fmtD(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}D`;
}

/**
 * Vertex conversion baseline:
 *   F_cl = F_spec / (1 - d * F_spec), where d in meters.
 * We apply per-meridian (sphere, sphere+cyl) for toric Rxs.
 * If vertexThreshold is enabled, only apply when |meridian| >= 4.00D.
 */
function vertexConvertMeridian(Fspec, dMeters, vertexThresholdEnabled) {
  if (Fspec === null) return null;
  const shouldVertex = !vertexThresholdEnabled || Math.abs(Fspec) >= 4.0;
  if (!shouldVertex) return Fspec;
  const denom = (1 - dMeters * Fspec);
  // Avoid divide-by-zero blowups; if denom is tiny, return raw as fallback.
  if (Math.abs(denom) < 1e-6) return Fspec;
  return Fspec / denom;
}

/**
 * Convert a spectacle spherocyl (minus cyl assumed) into a corneal-plane
 * starting CL spherocyl, axis preserved.
 *
 * NOTE: This is a baseline implementation for wireframing. Later:
 * - plus-cyl input + transposition
 * - lens-specific cylinder step availability (e.g., -0.75, -1.25 ...)
 * - axis availability (e.g., 10-degree steps)
 * - multifocal/monovision logic
 */
function convertRx({ sph, cyl, axis }, opts) {
  const d = (opts.vertexMm || 0) / 1000.0;

  const hasCyl = cyl !== null && cyl !== 0;
  if (!hasCyl) {
    // Sphere-only
    const vSph = vertexConvertMeridian(sph, d, opts.vertexThreshold);
    const outSph = roundToStep(vSph, opts.roundSphStep);
    return { sph: outSph, cyl: 0, axis: null, notes: ["Sphere-only conversion (wireframe)."] };
  }

  // Toric-ish conversion: per-meridian
  const m1 = sph;        // sphere meridian
  const m2 = sph + cyl;  // sphere+cyl meridian (minus-cyl assumed)

  const m1v = vertexConvertMeridian(m1, d, opts.vertexThreshold);
  const m2v = vertexConvertMeridian(m2, d, opts.vertexThreshold);

  let outSph = m1v;
  let outCyl = m2v - m1v;

  // Rounding (generic for now)
  outSph = roundToStep(outSph, opts.roundSphStep);
  outCyl = roundToStep(outCyl, opts.roundCylStep);

  const outAxis = axis ? clamp(Math.round(axis), 1, 180) : null;

  const notes = [
    "Minus-cylinder assumed.",
    "Axis preserved (no lens availability constraints applied).",
    "Generic rounding only (no brand catalogue).",
  ];

  // Suggest toric vs spherical based on CYL magnitude (wireframe rule)
  if (opts.toricPreferred && Math.abs(cyl) >= 0.75) {
    notes.push("Toric likely indicated (CYL magnitude ≥ 0.75D).");
  } else if (Math.abs(cyl) > 0) {
    notes.push("Consider spherical equivalent workflow (not implemented).");
  }

  return { sph: outSph, cyl: outCyl, axis: outAxis, notes };
}

function readInputs() {
  state.rx.od.sph = parseNum($("od_sph").value);
  state.rx.od.cyl = parseNum($("od_cyl").value);
  state.rx.od.axis = parseNum($("od_axis").value);
  state.rx.od.add = parseNum($("od_add").value);

  state.rx.os.sph = parseNum($("os_sph").value);
  state.rx.os.cyl = parseNum($("os_cyl").value);
  state.rx.os.axis = parseNum($("os_axis").value);
  state.rx.os.add = parseNum($("os_add").value);

  state.options.vertexMm = parseNum($("vertex_mm").value) ?? 12;
  state.options.vertexThreshold = $("apply_vertex_threshold").checked;
  state.options.roundSphStep = parseNum($("round_sph_step").value) ?? 0.25;
  state.options.roundCylStep = parseNum($("round_cyl_step").value) ?? 0.25;
  state.options.toricPreferred = $("toric_preferred").checked;
  state.options.multifocal = $("is_multifocal").checked;

  const dom = document.querySelector("input[name='dominant_eye']:checked");
  state.options.dominantEye = dom ? dom.value : "OD";
}

function validateStep0() {
  // Wireframe validation: only ensure sphere exists for each eye.
  const odOk = state.rx.od.sph !== null;
  const osOk = state.rx.os.sph !== null;
  const issues = [];
  if (!odOk) issues.push("OD SPH is required.");
  if (!osOk) issues.push("OS SPH is required.");
  return { ok: odOk && osOk, issues };
}

function setStep(next) {
  state.step = next;

  // tabs
  document.querySelectorAll(".step").forEach(btn => {
    const s = Number(btn.dataset.step);
    btn.classList.toggle("active", s === state.step);
    btn.setAttribute("aria-selected", String(s === state.step));
  });

  // panels
  document.querySelectorAll(".step-panel").forEach(panel => {
    const p = Number(panel.dataset.panel);
    panel.classList.toggle("hidden", p !== state.step);
  });
}

function syncMfUI() {
  const mf = $("is_multifocal").checked;
  // enable/disable dominant eye
  $("dominant_eye_fieldset").disabled = !mf;

  // show/hide ADD fields visually
  document.querySelectorAll(".mf-only").forEach(el => {
    el.style.opacity = mf ? "1" : "0.55";
  });
}

function renderResults() {
  const od = convertRx(state.rx.od, state.options);
  const os = convertRx(state.rx.os, state.options);

  const mfNote = state.options.multifocal
    ? `MF mode: ON (dominant eye = ${state.options.dominantEye})`
    : `MF mode: OFF`;

  $("result_od").textContent = [
    `OD STARTING CL (wireframe)`,
    `SPH: ${fmtD(od.sph)}`,
    `CYL: ${fmtD(od.cyl)}`,
    `AXIS: ${od.axis ? `${od.axis}°` : "—"}`,
    "",
    `Options: vertex=${state.options.vertexMm}mm, threshold=${state.options.vertexThreshold ? "on" : "off"}`,
    `Rounding: sph=${state.options.roundSphStep}, cyl=${state.options.roundCylStep}`,
    `${mfNote}`,
    "",
    "Notes:",
    ...od.notes.map(n => `- ${n}`),
  ].join("\n");

  $("result_os").textContent = [
    `OS STARTING CL (wireframe)`,
    `SPH: ${fmtD(os.sph)}`,
    `CYL: ${fmtD(os.cyl)}`,
    `AXIS: ${os.axis ? `${os.axis}°` : "—"}`,
    "",
    `Options: vertex=${state.options.vertexMm}mm, threshold=${state.options.vertexThreshold ? "on" : "off"}`,
    `Rounding: sph=${state.options.roundSphStep}, cyl=${state.options.roundCylStep}`,
    `${mfNote}`,
    "",
    "Notes:",
    ...os.notes.map(n => `- ${n}`),
  ].join("\n");
}

function resetAll() {
  // Clear inputs
  ["od_sph","od_cyl","od_axis","od_add","os_sph","os_cyl","os_axis","os_add"].forEach(id => $(id).value = "");
  $("vertex_mm").value = "12";
  $("apply_vertex_threshold").checked = true;
  $("round_sph_step").value = "0.25";
  $("round_cyl_step").value = "0.25";
  $("toric_preferred").checked = true;
  $("is_multifocal").checked = false;
  document.querySelector("input[name='dominant_eye'][value='OD']").checked = true;

  syncMfUI();
  setStep(0);
}

function copyODtoOS() {
  $("os_sph").value = $("od_sph").value;
  $("os_cyl").value = $("od_cyl").value;
  $("os_axis").value = $("od_axis").value;
  $("os_add").value = $("od_add").value;
}

// Wire up events
document.addEventListener("click", (e) => {
  const stepBtn = e.target.closest(".step");
  if (stepBtn) {
    const s = Number(stepBtn.dataset.step);
    readInputs();
    // Only allow jumping forward if step0 valid
    if (s > 0) {
      const v = validateStep0();
      if (!v.ok) {
        alert(v.issues.join("\n"));
        return;
      }
    }
    if (s === 2) renderResults();
    setStep(s);
  }
});

$("btnCopyODtoOS").addEventListener("click", () => copyODtoOS());
$("btnReset").addEventListener("click", () => resetAll());

$("btnNext0").addEventListener("click", () => {
  readInputs();
  const v = validateStep0();
  if (!v.ok) return alert(v.issues.join("\n"));
  setStep(1);
});

$("btnBack1").addEventListener("click", () => setStep(0));
$("btnNext1").addEventListener("click", () => {
  readInputs();
  syncMfUI();
  renderResults();
  setStep(2);
});

$("btnBack2").addEventListener("click", () => setStep(1));
$("btnRecalc").addEventListener("click", () => {
  readInputs();
  syncMfUI();
  renderResults();
});

// Sync MF UI when toggled
$("is_multifocal").addEventListener("change", () => syncMfUI());

// Init
syncMfUI();
setStep(0);
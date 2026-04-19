(function () {
  const VOCATIONS = ["Knight", "Paladin", "Sorcerer", "Druid", "Monk"];
  const ELEMENTS = [
    "Physical",
    "Fire",
    "Ice",
    "Earth",
    "Energy",
    "Death",
    "Holy",
    "Drown",
    "Life Drain",
    "Mana Drain",
  ];
  const ELEMENT_RE_PCT = /(Physical|Fire|Ice|Earth|Energy|Death|Holy|Drown|Life\s*Drain|Mana\s*Drain)\s*([+-])\s*(\d+)%?/gi;
  const ELEMENT_RE_RAW = /(\d+)\s+(Physical|Fire|Ice|Earth|Energy|Death|Holy|Drown)\b/gi;

  const norm = (s) => (s || "").trim().toLowerCase();
  const cellText = (c) => ((c && c.textContent) || "").replace(/\s+/g, " ").trim();

  function parseElementCell(text) {
    const out = [];
    const t = text || "";
    let m;
    ELEMENT_RE_PCT.lastIndex = 0;
    while ((m = ELEMENT_RE_PCT.exec(t)) !== null) {
      out.push({
        element: m[1].replace(/\s+/g, " ").toLowerCase(),
        sign: m[2],
        value: parseInt(m[3], 10),
      });
    }
    if (out.length === 0) {
      ELEMENT_RE_RAW.lastIndex = 0;
      while ((m = ELEMENT_RE_RAW.exec(t)) !== null) {
        out.push({ element: m[2].toLowerCase(), sign: "+", value: parseInt(m[1], 10) });
      }
    }
    return out;
  }

  function parseNumber(text) {
    const t = (text || "").replace(",", ".").trim();
    if (!t || t === "-" || /^nenhum[ao]?\.?$/i.test(t) || /^ningu[eé]m\.?$/i.test(t)) return null;
    const m = t.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  function isPureNumeric(text) {
    const t = (text || "").replace(",", ".").trim();
    return /^[-+]?\d+(\.\d+)?$/.test(t);
  }

  function isEmptyish(t) {
    return !t || t === "-" || /^nenhum[ao]?\.?$/i.test(t) || /^ningu[eé]m\.?$/i.test(t);
  }

  function inferColType(header, samples) {
    const h = norm(header);
    const meaningful = samples.map((s) => s.trim()).filter((v) => !isEmptyish(v));
    const unique = new Set(meaningful.map((v) => v.toLowerCase()));
    const mostlyUnique = meaningful.length >= 3 && unique.size / meaningful.length >= 0.8;

    if (h.includes("voc")) return "vocation";
    if (h.includes("proteç") || h.includes("protec")) return "element";
    if (h.includes("dano elemental") || h.includes("elemento")) return "element";
    if (h === "nome" || h.includes("name")) return mostlyUnique ? "skip" : "name";

    if (!meaningful.length) return "skip";

    const numericVals = meaningful.filter((v) => isPureNumeric(v));
    if (numericVals.length / meaningful.length > 0.7) {
      const distinct = new Set(numericVals.map((v) => parseFloat(v.replace(",", "."))));
      if (distinct.size < 2) return "skip";
      if (distinct.size <= 8) return "numenum";
      return "number";
    }

    const elementish = meaningful.filter(
      (v) =>
        /(Physical|Fire|Ice|Earth|Energy|Death|Holy|Drown|Life\s*Drain|Mana\s*Drain)\s*[+-]\s*\d/i.test(v) ||
        /^\d+\s+(Physical|Fire|Ice|Earth|Energy|Death|Holy|Drown)\b/i.test(v)
    ).length;
    if (elementish / meaningful.length > 0.4) return "element";

    const vocish = meaningful.filter((v) =>
      /(Knight|Paladin|Sorcerer|Druid|Monk|todas|todos)/i.test(v)
    ).length;
    if (vocish / meaningful.length > 0.85) return "vocation";

    const commaValues = meaningful.filter((v) => v.includes(","));
    if (commaValues.length >= 2) {
      const tokens = new Set();
      for (const v of meaningful) {
        for (const t of v.split(",").map((s) => s.trim().toLowerCase())) {
          if (t) tokens.add(t);
        }
      }
      if (tokens.size >= 2 && tokens.size <= 20) return "multienum";
    }

    if (unique.size > 0 && unique.size <= 15 && meaningful.length >= unique.size * 2) return "enum";

    if (mostlyUnique) return "skip";

    return "text";
  }

  function collectMultiTokens(samples) {
    const set = new Map();
    for (const s of samples) {
      if (!s || isEmptyish(s)) continue;
      for (const raw of s.split(",")) {
        const t = raw.trim();
        if (!t) continue;
        const key = t.toLowerCase();
        if (!set.has(key)) set.set(key, t);
      }
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "pt-br", { sensitivity: "base" }));
  }

  function collectEnumValues(samples) {
    const set = new Map();
    for (const s of samples) {
      const t = s.trim();
      if (!t || isEmptyish(t)) continue;
      const key = t.toLowerCase();
      if (!set.has(key)) set.set(key, t);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "pt-br", { sensitivity: "base" }));
  }

  function collectPresentVocations(samples) {
    const found = new Set();
    for (const s of samples) {
      const low = (s || "").toLowerCase();
      for (const v of VOCATIONS) if (low.includes(v.toLowerCase())) found.add(v);
    }
    return VOCATIONS.filter((v) => found.has(v));
  }

  function collectElementTypes(samples) {
    const found = new Set();
    for (const s of samples) {
      for (const p of parseElementCell(s)) found.add(p.element);
    }
    const ordered = [];
    for (const e of ELEMENTS) if (found.has(e.toLowerCase())) ordered.push(e);
    return ordered;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function buildColFilter(col) {
    const { idx, header, type, samples } = col;
    const hText = cellText(header) || `Coluna ${idx + 1}`;
    const wrap = document.createElement("div");
    wrap.className = "twf-col twf-col-" + type;
    wrap.dataset.col = String(idx);
    wrap.dataset.type = type;

    let body = "";
    if (type === "name" || type === "text") {
      body = `<input type="text" class="twf-input twf-wide" data-kind="text" placeholder="buscar...">`;
    } else if (type === "number") {
      body = `<span class="twf-range"><input type="number" class="twf-input twf-small" data-kind="min" placeholder="min" step="any"><span class="twf-dash">–</span><input type="number" class="twf-input twf-small" data-kind="max" placeholder="max" step="any"></span>`;
    } else if (type === "vocation") {
      const present = collectPresentVocations(samples);
      if (present.length < 2) return null;
      body = present
        .map(
          (v) => `<label class="twf-chip"><input type="checkbox" class="twf-chk" data-kind="voc" value="${v}"><span>${v}</span></label>`
        )
        .join("");
    } else if (type === "element") {
      const els = collectElementTypes(samples);
      if (!els.length) return null;
      body =
        els
          .map(
            (e) =>
              `<label class="twf-chip"><input type="checkbox" class="twf-chk" data-kind="el" value="${e.toLowerCase()}"><span>${e}</span></label>`
          )
          .join("") +
        `<span class="twf-range twf-range-alt">` +
        `<input type="number" class="twf-input twf-small" data-kind="elmin" placeholder="≥ %" step="1">` +
        `<input type="number" class="twf-input twf-small" data-kind="elmax" placeholder="≤ %" step="1">` +
        `</span>`;
    } else if (type === "enum") {
      const vals = collectEnumValues(samples);
      if (vals.length < 2) return null;
      body = vals
        .map(
          (v) =>
            `<label class="twf-chip"><input type="checkbox" class="twf-chk" data-kind="enum" value="${esc(v)}"><span>${esc(v)}</span></label>`
        )
        .join("");
    } else if (type === "multienum") {
      const toks = collectMultiTokens(samples);
      if (toks.length < 2) return null;
      body = toks
        .map(
          (v) =>
            `<label class="twf-chip"><input type="checkbox" class="twf-chk" data-kind="multi" value="${esc(v.toLowerCase())}"><span>${esc(v)}</span></label>`
        )
        .join("");
    } else if (type === "numenum") {
      const nums = Array.from(
        new Set(samples.filter((s) => isPureNumeric((s || "").trim())).map((s) => parseFloat(s.replace(",", "."))))
      ).sort((a, b) => a - b);
      if (nums.length < 2) return null;
      body = nums
        .map((n) => {
          const label = Number.isInteger(n) ? String(n) : String(n);
          return `<label class="twf-chip"><input type="checkbox" class="twf-chk" data-kind="numenum" value="${n}"><span>${label}</span></label>`;
        })
        .join("");
    }

    wrap.innerHTML = `<div class="twf-col-title">${esc(hText)}</div><div class="twf-col-body">${body}</div>`;
    return wrap;
  }

  function rowMatchesCol(cell, type, colFilter) {
    const text = cellText(cell);
    const low = text.toLowerCase();

    if (type === "name" || type === "text") {
      const q = (colFilter.querySelector('[data-kind="text"]')?.value || "").trim().toLowerCase();
      if (!q) return true;
      return low.includes(q);
    }
    if (type === "number") {
      const minEl = colFilter.querySelector('[data-kind="min"]');
      const maxEl = colFilter.querySelector('[data-kind="max"]');
      const hasMin = minEl && minEl.value !== "";
      const hasMax = maxEl && maxEl.value !== "";
      if (!hasMin && !hasMax) return true;
      const n = parseNumber(text);
      if (n === null) return false;
      if (hasMin && n < parseFloat(minEl.value)) return false;
      if (hasMax && n > parseFloat(maxEl.value)) return false;
      return true;
    }
    if (type === "vocation") {
      const sel = Array.from(colFilter.querySelectorAll('[data-kind="voc"]:checked')).map((x) => x.value.toLowerCase());
      if (!sel.length) return true;
      if (/\btodas\b|\btodos\b/.test(low)) return true;
      return sel.some((v) => low.includes(v));
    }
    if (type === "element") {
      const elSel = new Set(Array.from(colFilter.querySelectorAll('[data-kind="el"]:checked')).map((x) => x.value));
      const minEl = colFilter.querySelector('[data-kind="elmin"]');
      const maxEl = colFilter.querySelector('[data-kind="elmax"]');
      const hasMin = minEl && minEl.value !== "";
      const hasMax = maxEl && maxEl.value !== "";
      if (!elSel.size && !hasMin && !hasMax) return true;
      const min = hasMin ? parseFloat(minEl.value) : -Infinity;
      const max = hasMax ? parseFloat(maxEl.value) : Infinity;
      const parsed = parseElementCell(text);
      if (!parsed.length) return false;
      for (const p of parsed) {
        if (elSel.size && !elSel.has(p.element)) continue;
        const signed = p.sign === "-" ? -p.value : p.value;
        if (signed < min || signed > max) continue;
        return true;
      }
      return false;
    }
    if (type === "enum") {
      const sel = Array.from(colFilter.querySelectorAll('[data-kind="enum"]:checked')).map((x) => x.value.toLowerCase());
      if (!sel.length) return true;
      return sel.some((v) => v === low);
    }
    if (type === "multienum") {
      const sel = Array.from(colFilter.querySelectorAll('[data-kind="multi"]:checked')).map((x) => x.value);
      if (!sel.length) return true;
      const cellTokens = new Set(low.split(",").map((s) => s.trim()).filter(Boolean));
      return sel.some((v) => cellTokens.has(v));
    }
    if (type === "numenum") {
      const sel = Array.from(colFilter.querySelectorAll('[data-kind="numenum"]:checked')).map((x) => parseFloat(x.value));
      if (!sel.length) return true;
      const n = parseNumber(text);
      if (n === null) return false;
      return sel.some((v) => v === n);
    }
    return true;
  }

  function enhanceTable(table) {
    if (table.dataset.twfEnhanced === "1") return;

    const trs = Array.from(table.querySelectorAll(":scope > tbody > tr, :scope > tr"));
    if (trs.length < 4) return;

    const headerRow = trs[0];
    const headers = Array.from(headerRow.children).filter((c) => c.tagName === "TH");
    if (headers.length < 3) return;

    const dataRows = trs.slice(1).filter((tr) => tr.querySelectorAll(":scope > td").length >= Math.max(2, headers.length - 2));
    if (dataRows.length < 3) return;

    const sampleRows = dataRows;

    const colInfos = headers.map((th, idx) => {
      const samples = sampleRows.map((tr) => cellText(tr.children[idx]));
      const htext = cellText(th);
      const type = htext ? inferColType(htext, samples) : "skip";
      return { idx, header: th, type, samples };
    });

    const useful = colInfos.filter((c) => c.type !== "skip");
    const hasFilterable = useful.some((c) => c.type !== "text" && c.type !== "name");
    if (!hasFilterable) return;

    table.dataset.twfEnhanced = "1";

    const panel = document.createElement("div");
    panel.className = "twf-panel";
    panel.innerHTML =
      `<div class="twf-header">` +
      `<strong class="twf-title">Filtrar tabela</strong>` +
      `<span class="twf-count"></span>` +
      `<button type="button" class="twf-clear">Limpar</button>` +
      `<button type="button" class="twf-toggle" title="Recolher/expandir">−</button>` +
      `</div><div class="twf-body"></div>`;

    const body = panel.querySelector(".twf-body");
    const colFilters = [];
    for (const ci of useful) {
      const filter = buildColFilter(ci);
      if (!filter) continue;
      body.appendChild(filter);
      colFilters.push({ ...ci, el: filter });
    }
    if (!colFilters.length) return;

    table.parentNode.insertBefore(panel, table);

    const countEl = panel.querySelector(".twf-count");
    const clearBtn = panel.querySelector(".twf-clear");
    const toggleBtn = panel.querySelector(".twf-toggle");

    function apply() {
      let visible = 0;
      for (const row of dataRows) {
        let ok = true;
        for (const cf of colFilters) {
          if (!rowMatchesCol(row.children[cf.idx], cf.type, cf.el)) {
            ok = false;
            break;
          }
        }
        row.style.display = ok ? "" : "none";
        if (ok) visible++;
      }
      countEl.textContent = `${visible}/${dataRows.length} visíveis`;
    }

    function syncChipClasses() {
      panel.querySelectorAll(".twf-chip").forEach((chip) => {
        const input = chip.querySelector("input[type='checkbox']");
        if (input) chip.classList.toggle("twf-chip-on", input.checked);
      });
    }
    panel.addEventListener("input", () => { syncChipClasses(); apply(); });
    panel.addEventListener("change", () => { syncChipClasses(); apply(); });
    clearBtn.addEventListener("click", () => {
      panel.querySelectorAll('input[type="text"], input[type="number"]').forEach((i) => (i.value = ""));
      panel.querySelectorAll('input[type="checkbox"]').forEach((i) => (i.checked = false));
      apply();
    });
    toggleBtn.addEventListener("click", () => {
      const hidden = body.style.display === "none";
      body.style.display = hidden ? "" : "none";
      toggleBtn.textContent = hidden ? "−" : "+";
    });

    apply();
  }

  const AD_SELECTORS = [
    "ins[data-revive-zoneid]",
    "ins[data-revive-id]",
    "ins.adsbygoogle",
    'iframe[src*="banners.tibiabr"]',
    'iframe[src*="premiumads"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="doubleclick"]',
    'iframe[src*="googletagmanager"]',
    'script[src*="banners.tibiabr"]',
    'script[src*="premiumads"]',
    'script[src*="googletagmanager"]',
    'script[src*="connect.facebook.net"]',
    'script[src*="doubleclick"]',
    'script[src*="googlesyndication"]',
  ].join(",");

  function stripAds(root) {
    try {
      (root || document).querySelectorAll(AD_SELECTORS).forEach((el) => el.remove());
    } catch (e) {}
  }

  function watchAds() {
    stripAds(document);
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches(AD_SELECTORS)) n.remove();
          else stripAds(n);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    document.querySelectorAll("table").forEach(enhanceTable);
    watchAds();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

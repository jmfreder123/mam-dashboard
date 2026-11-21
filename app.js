(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Indicators (decision D069). dir 1: higher means more need. dir -1: lower means more need.
  // ---------------------------------------------------------------------------
  var IND = [
    { code: "inc185", domain: "income", label: "Kids below 185% of poverty", unit: "%", dir: 1, desc: "Children 6 to 17 in families under 185% of the poverty line, the FRPL reduced-price line." },
    { code: "pov517", domain: "income", label: "Kids below poverty", unit: "%", dir: 1, desc: "Children 5 to 17 below the poverty line." },
    { code: "unemp", domain: "income", label: "Unemployment rate", unit: "%", dir: 1, desc: "People 16 and over in the labor force who are out of work." },
    { code: "mhhi", domain: "income", label: "Median household income", unit: "$", dir: -1, desc: "Half of households earn more and half earn less (2024 dollars).", note: "Lower income counts as more need." },
    { code: "gini", domain: "income", label: "Gini index", unit: "", dir: 1, desc: "How spread out incomes are inside the district, from 0 (equal) to 1.", note: "This measures inequality, not how many families are poor. Here, higher counts as more need." },
    { code: "foodkids", domain: "food", label: "Kids far from a SNAP store", unit: "%", dir: 1, desc: "Children 0 to 17 who live more than 1 mile (town) or 10 miles (rural) by road from a store that takes SNAP.", note: "From USDA store locations (2025) and the 2020 Census, not the ACS. No margin of error." },
    { code: "snap", domain: "food", label: "SNAP households", unit: "%", dir: 1, desc: "Households that received SNAP (food stamps) in the past 12 months." },
    { code: "unins", domain: "health", label: "Kids uninsured", unit: "%", dir: 1, desc: "Children under 19 with no health insurance." },
    { code: "care", domain: "health", label: "Miles to a health center", unit: "mi", unitLabel: " (miles)", dir: 1, desc: "Average driving miles from children's homes to the nearest community health center (a federally funded clinic).", note: "From HRSA clinic locations (2026) and OpenStreetMap roads, not the ACS. Counts only community health centers, not every doctor's office. No margin of error." },
    { code: "crowd", domain: "needs", label: "Crowded housing", unit: "%", dir: 1, desc: "Households with more than one person per room." },
    { code: "plumb", domain: "needs", label: "No complete plumbing", unit: "%", dir: 1, desc: "Households lacking complete plumbing." },
    { code: "rentburden", domain: "needs", label: "Rent burden", unit: "%", dir: 1, desc: "Renter households paying 35 percent or more of income on rent." },
    { code: "homeval", domain: "needs", label: "Median home value", unit: "$", dir: -1, desc: "The middle value of owner-occupied homes. Half are worth more and half less.", note: "Lower value counts as more need (less household wealth)." },
    { code: "proptax", domain: "needs", label: "Median property taxes", unit: "$", unitLabel: " (dollars)", dir: -1, desc: "The middle amount of yearly real estate taxes paid on owner-occupied homes.", note: "Lower taxes count as more need (less local tax capacity)." },
    { code: "moved", domain: "needs", label: "Moved in the past year", unit: "%", dir: 1, desc: "People 1 and over who lived in a different house a year ago." },
    { code: "noveh", domain: "access", label: "No vehicle", unit: "%", dir: 1, desc: "Households with no vehicle available." },
    { code: "nobb", domain: "access", label: "No broadband", unit: "%", dir: 1, desc: "Households without a broadband internet subscription of any type." },
    { code: "nocomp", domain: "access", label: "No computer", unit: "%", dir: 1, desc: "Households without a computer." },
    { code: "nohs", domain: "family", label: "Adults without a diploma", unit: "%", dir: 1, desc: "Adults 25 and over without a high school diploma or equivalent." },
    { code: "lep", domain: "family", label: "Limited English", unit: "%", dir: 1, desc: "People 5 and over who speak English less than “very well.”" },
    { code: "singlepar", domain: "family", label: "Single-parent families", unit: "%", dir: 1, desc: "Families with their own children under 18 that are headed by a single parent." }
  ];
  var BY = {}; IND.forEach(function (d) { BY[d.code] = d; });
  // Groups for now (decisions D072, D073); to be renamed to MAM domains as they are added
  var DOMAINS = [
    { key: "income", label: "Income and work" },
    { key: "food", label: "Food" },
    { key: "health", label: "Health" },
    { key: "needs", label: "Housing" },
    { key: "access", label: "Getting around and getting online" },
    { key: "family", label: "Family and language" }
  ];

  // ---------------------------------------------------------------------------
  // Funding rules in law (decisions D064, D065). 2024-25 student counts fund 2025-26.
  // ---------------------------------------------------------------------------
  var LAW = {
    TN: { name: "Tennessee", formula: "TISA", base: 7295, w: 0.25, cpW: 0, cpLine: 0, year: "2025-26",
          who: "economically disadvantaged", measure: "Economically disadvantaged students (TDOE district profile, 2024-25)" },
    MS: { name: "Mississippi", formula: "MSFF", base: 6842.61, w: 0.30, cpW: 0.10, cpLine: 0.35, year: "FY26",
          who: "low-income", measure: "Identified students for school meals (MDE CEP list, April 14, 2025)" }
  };

  var STEPS = ["How it works", "Indicators", "Weights", "Scaling", "Money"];
  var STORE = "mam-dashboard-v1";
  var DATA = { MS: [], TN: [] };
  var RAW = {}; // the data files as loaded, kept for downloads
  var FEATURES = {};
  var state = { st: "MS", step: 0, picked: [], weights: {}, weightsTouched: false, scale: "rank", view: "index" };

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || "null");
      if (s && typeof s === "object") Object.keys(state).forEach(function (k) { if (k in s) state[k] = s[k]; });
    } catch (e) { /* storage unavailable */ }
    state.picked = state.picked.filter(function (c) { return BY[c]; });
    delete state.answers;
    state.step = Math.max(0, Math.min(Number(state.step) || 0, farthestStep()));
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------
  function fmtN(x, d) { return x.toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function fmtVal(code, x) {
    var u = BY[code].unit;
    if (u === "$") return "$" + fmtN(x, 0);
    if (u === "%") return fmtN(x, 1) + "%";
    if (u === "mi") return fmtN(x, 1) + " mi";
    return fmtN(x, 3);
  }
  function money(x) { var s = "$" + fmtN(Math.abs(x), 0); return x < 0 ? "−" + s : s; }
  function moneySigned(x) { return (x > 0 ? "+" : x < 0 ? "−" : "") + "$" + fmtN(Math.abs(x), 0); }
  function shortMoney(x) {
    var a = Math.abs(x), s;
    if (a >= 1e9) s = "$" + (a / 1e9).toFixed(2) + " billion";
    else if (a >= 1e6) s = "$" + (a / 1e6).toFixed(1) + " million";
    else s = "$" + fmtN(a, 0);
    return x < 0 ? "−" + s : s;
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(f); f = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = [];
      } else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    var h = rows.shift();
    return rows.map(function (r) { var o = {}; h.forEach(function (k, j) { o[k] = r[j]; }); return o; });
  }

  function build(dist, ind, food, housing, care) {
    var byId = {};
    ind.forEach(function (r) { byId[r.leaid] = r; });
    // food access comes from its own file (decision D073); its moe column is empty
    food.forEach(function (r) {
      var x = byId[r.leaid];
      if (x) { x.foodkids_est = r.foodkids_est; x.foodkids_moe = r.foodkids_moe; }
    });
    // housing comes from its own file (decision D075)
    housing.forEach(function (r) {
      var x = byId[r.leaid];
      if (x) { x.homeval_est = r.homeval_est; x.homeval_moe = r.homeval_moe; x.proptax_est = r.proptax_est; x.proptax_moe = r.proptax_moe; }
    });
    // distance to care comes from its own file (decision D078); its moe column is empty
    care.forEach(function (r) {
      var x = byId[r.leaid];
      if (x) { x.care_est = r.care_est; x.care_moe = r.care_moe; }
    });
    dist.forEach(function (d) {
      var x = byId[d.leaid];
      var vals = {}, moe = {};
      IND.forEach(function (i) { vals[i.code] = parseFloat(x[i.code + "_est"]); moe[i.code] = parseFloat(x[i.code + "_moe"]); });
      var stName = d.state === "MS" ? ", Mississippi" : ", Tennessee";
      DATA[d.state].push({
        leaid: d.leaid,
        name: d.name_census.replace(stName, ""),
        type: d.district_type,
        enroll: parseFloat(d.enroll_k12),
        basePct: parseFloat(d.base_pct),
        baseCount: parseFloat(d.base_count),
        vals: vals, moe: moe
      });
    });
    ["MS", "TN"].forEach(function (s) {
      DATA[s].sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    });
  }

  // ---------------------------------------------------------------------------
  // The math (same scaling rules as the Arizona lab)
  // ---------------------------------------------------------------------------
  function rows() { return DATA[state.st]; }
  function need(code) { var d = BY[code].dir; return rows().map(function (r) { return d * r.vals[code]; }); }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function sdPop(a) { var m = mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return Math.sqrt(s / a.length); }
  function percentRank(a, x) { var b = 0; for (var i = 0; i < a.length; i++) if (a[i] < x) b++; return b / (a.length - 1); }
  function scaleArr(a, method) {
    if (method === "rank") return a.map(function (x) { return percentRank(a, x) * 100; });
    if (method === "minmax") {
      var lo = Math.min.apply(null, a), hi = Math.max.apply(null, a);
      return a.map(function (x) { return hi === lo ? 0 : (x - lo) / (hi - lo) * 100; });
    }
    var m = mean(a), sd = sdPop(a);
    return a.map(function (x) { return sd === 0 ? 0 : (x - m) / sd; });
  }
  // rank 1 = most need; exact ties go to the district listed first alphabetically
  function rankDesc(v) {
    return v.map(function (x, i) {
      var r = 1;
      for (var j = 0; j < v.length; j++) { if (v[j] > x) r++; else if (v[j] === x && j < i) r++; }
      return r;
    });
  }
  function corr(a, b) {
    var ma = mean(a), mb = mean(b), sab = 0, saa = 0, sbb = 0;
    for (var i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) * (a[i] - ma); sbb += (b[i] - mb) * (b[i] - mb); }
    return sab / Math.sqrt(saa * sbb);
  }
  function evenWeights() {
    var k = state.picked.length, w = {};
    if (!k) return w;
    var base = Math.floor(100 / k), extra = 100 - base * k;
    state.picked.forEach(function (c, i) { w[c] = base + (i < extra ? 1 : 0); });
    return w;
  }
  function weightsNow() { return state.weightsTouched ? state.weights : evenWeights(); }
  function weightTotal() { var w = weightsNow(); return state.picked.reduce(function (s, c) { return s + (Number(w[c]) || 0); }, 0); }
  function ready() { return state.picked.length > 0 && weightTotal() === 100; }

  function dollars(law, count, enroll) {
    var d = count * law.w * law.base;
    if (law.cpW > 0) d += Math.max(0, count - law.cpLine * enroll) * law.cpW * law.base;
    return d;
  }

  // Re-share the state's actual count by the user's index (decision D065)
  function reshare(R, index) {
    var n = R.length;
    var order = R.map(function (r, i) { return i; }).sort(function (a, b) { return index[b] - index[a] || a - b; });
    var rates = R.map(function (r) { return r.basePct / 100; }).sort(function (a, b) { return b - a; });
    var cnt = new Array(n);
    order.forEach(function (i, k) { cnt[i] = rates[k] * R[i].enroll; });
    var N = R.reduce(function (s, r) { return s + r.baseCount; }, 0);
    var capped = new Array(n).fill(false);
    for (var it = 0; it < 100; it++) {
      var fixed = 0, free = 0;
      for (var i = 0; i < n; i++) { if (capped[i]) fixed += R[i].enroll; else free += cnt[i]; }
      var f = (N - fixed) / free, changed = false;
      for (i = 0; i < n; i++) if (!capped[i] && cnt[i] * f > R[i].enroll) { capped[i] = true; changed = true; }
      if (!changed) {
        for (i = 0; i < n; i++) cnt[i] = capped[i] ? R[i].enroll : cnt[i] * f;
        break;
      }
    }
    return cnt;
  }

  function results() {
    var R = rows(), law = LAW[state.st];
    // rank by who the state counts now (share of students), 1 = highest share
    var curRank = rankDesc(R.map(function (r) { return r.basePct; }));
    var out = R.map(function (r, i) {
      var cur = dollars(law, r.baseCount, r.enroll);
      return { r: r, curCount: r.baseCount, curDollars: cur, curRank: curRank[i] };
    });
    if (!ready()) return { ok: false, rows: out };
    var w = weightsNow(), scaled = {};
    state.picked.forEach(function (c) { scaled[c] = scaleArr(need(c), state.scale); });
    var index = R.map(function (r, i) {
      var s = 0;
      state.picked.forEach(function (c) { s += (Number(w[c]) || 0) * scaled[c][i]; });
      // rounded so that districts with mathematically equal scores tie exactly,
      // and ties then go to the district listed first alphabetically
      return Math.round(s / 100 * 1e9) / 1e9;
    });
    var rank = rankDesc(index);
    var cnt = reshare(R, index);
    out.forEach(function (o, i) {
      o.scaled = {};
      state.picked.forEach(function (c) { o.scaled[c] = scaled[c][i]; });
      o.index = index[i]; o.rank = rank[i];
      o.newCount = cnt[i];
      o.newDollars = dollars(law, cnt[i], o.r.enroll);
      o.change = o.newDollars - o.curDollars;
      o.perStudent = o.change / o.r.enroll;
    });
    return { ok: true, rows: out };
  }

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------
  function renderStepper() {
    var ol = $("stepper"); ol.innerHTML = "";
    var far = farthestStep();
    STEPS.forEach(function (s, i) {
      var li = el("li"), b = el("button", { type: "button", class: "stepbtn", "data-go": String(i) }, s);
      if (i === state.step) { b.className += " now"; b.setAttribute("aria-current", "step"); }
      else if (i < state.step) b.className += " done";
      if (i > far) { b.disabled = true; b.title = i <= 2 || state.picked.length < 2 ? "Pick at least two indicators first." : "Your weights need to add up to 100 first."; }
      li.appendChild(b);
      ol.appendChild(li);
    });
    document.querySelectorAll("[data-step]").forEach(function (p) { p.hidden = Number(p.getAttribute("data-step")) !== state.step; });
    $("backBtn").disabled = state.step === 0;
    $("nextBtn").hidden = state.step === STEPS.length - 1;
    var hint = "";
    if (state.step === 1 && state.picked.length < 2) hint = "Pick at least two indicators to go on.";
    if (state.step === 2 && weightTotal() !== 100) hint = "Your weights need to add up to 100.";
    $("navHint").textContent = hint;
    $("nextBtn").disabled = hint !== "";
  }

  var closedDomains = {};   // domains the user has closed on the indicators step
  function renderCards() {
    var box = $("indicatorCards"); box.innerHTML = "";
    var n = state.picked.length;
    $("pickCount").textContent = n + " selected" + (n > 0 && (n < 4 || n > 6) ? ". Four to six works best." : ".");
    var groups = {};
    DOMAINS.forEach(function (g) {
      var sec = el("div", { class: "domain" });
      var n = IND.filter(function (d) { return d.domain === g.key; }).length;
      var k = IND.filter(function (d) { return d.domain === g.key && state.picked.indexOf(d.code) >= 0; }).length;
      // each domain opens and closes; closed domains list what is picked in them
      var closed = !!closedDomains[g.key];
      var h = el("h3"), tb = el("button", { type: "button", class: "dtoggle", "aria-expanded": String(!closed), "aria-controls": "dom-" + g.key });
      tb.appendChild(el("span", { class: "chev", "aria-hidden": "true" }, closed ? "\u25B8" : "\u25BE"));
      tb.appendChild(document.createTextNode(g.label + " "));
      tb.appendChild(el("span", { class: "dcount" }, k + " of " + n + " picked"));
      tb.addEventListener("click", function () { closedDomains[g.key] = !closedDomains[g.key]; renderCards(); });
      h.appendChild(tb); sec.appendChild(h);
      var cards = el("div", { class: "cards", id: "dom-" + g.key });
      if (closed) {
        cards.hidden = true;
        var names = IND.filter(function (d) { return d.domain === g.key && state.picked.indexOf(d.code) >= 0; }).map(function (d) { return d.label; });
        if (names.length) sec.appendChild(el("p", { class: "dpicked" }, "Picked: " + names.join(", ")));
      }
      sec.appendChild(cards);
      box.appendChild(sec);
      groups[g.key] = cards;
    });
    IND.forEach(function (d) {
      var on = state.picked.indexOf(d.code) >= 0;
      var vals = rows().map(function (r) { return r.vals[d.code]; });
      var lab = el("label", { class: "card" + (on ? " on" : ""), for: "pick-" + d.code });
      var cb = el("input", { type: "checkbox", id: "pick-" + d.code });
      cb.checked = on;
      cb.addEventListener("change", function () {
        if (cb.checked) state.picked.push(d.code);
        else state.picked = state.picked.filter(function (c) { return c !== d.code; });
        if (state.weightsTouched) {
          var w = {}; state.picked.forEach(function (c) { w[c] = state.weights[c] || 0; }); state.weights = w;
        }
        update();
      });
      var txt = el("span");
      txt.appendChild(el("span", { class: "label" }, d.label));
      txt.appendChild(el("span", { class: "desc" }, d.desc));
      txt.appendChild(el("span", { class: "range" }, LAW[state.st].name + " districts: " + fmtVal(d.code, Math.min.apply(null, vals)) + " to " + fmtVal(d.code, Math.max.apply(null, vals))));
      if (d.note) txt.appendChild(el("span", { class: "note" }, d.note));
      lab.appendChild(cb); lab.appendChild(txt);
      groups[d.domain].appendChild(lab);
    });
    var warn = $("corrWarn"); warn.innerHTML = "";
    for (var i = 0; i < state.picked.length; i++) for (var j = i + 1; j < state.picked.length; j++) {
      var a = state.picked[i], b = state.picked[j];
      var r = corr(need(a), need(b));
      if (Math.abs(r) >= 0.8) warn.appendChild(el("p", null, BY[a].label + " and " + BY[b].label + " move closely together in " + LAW[state.st].name + " (correlation " + fmtN(r, 2) + "). Using both gives that idea extra weight."));
    }
  }

  function renderWeights() {
    var box = $("weights"); box.innerHTML = "";
    var w = weightsNow();
    state.picked.forEach(function (c) {
      var row = el("div", { class: "wrow" });
      row.appendChild(el("label", { class: "wl", for: "wn-" + c }, BY[c].label));
      var rg = el("input", { type: "range", min: "0", max: "100", step: "1", id: "wr-" + c, "aria-label": BY[c].label + " weight" });
      var nb = el("input", { type: "number", min: "0", max: "100", step: "1", id: "wn-" + c });
      rg.value = nb.value = w[c] || 0;
      function set(v) {
        if (!state.weightsTouched) { state.weights = evenWeights(); state.weightsTouched = true; }
        v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
        state.weights[c] = v; rg.value = nb.value = v;
        updateLive(); renderTotal(); renderStepper(); save();
      }
      rg.addEventListener("input", function () { set(rg.value); });
      nb.addEventListener("change", function () { set(nb.value); });
      row.appendChild(rg); row.appendChild(nb);
      box.appendChild(row);
    });
    renderTotal();
  }
  function renderTotal() {
    var t = weightTotal(), p = $("weightTotal");
    p.textContent = "Total: " + t + " of 100";
    p.className = "total " + (t === 100 ? "ok" : "bad");
  }

  function renderScale() {
    document.querySelectorAll("input[name=scale]").forEach(function (x) { x.checked = x.value === state.scale; });
    var box = $("scaleExample"); box.innerHTML = "";
    if (!state.picked.length) return;
    var c = state.picked[0], R = rows();
    var raw = R.map(function (r) { return r.vals[c]; });
    var nd = need(c);
    var s = { rank: scaleArr(nd, "rank"), minmax: scaleArr(nd, "minmax"), z: scaleArr(nd, "z") };
    var order = R.map(function (r, i) { return i; }).sort(function (a, b) { return nd[a] - nd[b]; });
    var picks = [0, 0.25, 0.5, 0.75, 1].map(function (q) { return order[Math.round(q * (order.length - 1))]; });
    var t = el("table");
    t.appendChild(el("caption", null, BY[c].label + ": five " + LAW[state.st].name + " districts, from least to most need"));
    var hr = el("tr");
    ["District", "Value", "Ranks", "0 to 100", "z-scores"].forEach(function (h, i) {
      var mine = (i === 2 && state.scale === "rank") || (i === 3 && state.scale === "minmax") || (i === 4 && state.scale === "z");
      hr.appendChild(el("th", null, h + (mine ? " (yours)" : "")));
    });
    t.appendChild(hr);
    picks.forEach(function (i) {
      var tr = el("tr");
      tr.appendChild(el("td", null, R[i].name));
      tr.appendChild(el("td", { class: "n" }, fmtVal(c, raw[i])));
      tr.appendChild(el("td", { class: "n" }, fmtN(s.rank[i], 1)));
      tr.appendChild(el("td", { class: "n" }, fmtN(s.minmax[i], 1)));
      tr.appendChild(el("td", { class: "n" }, fmtN(s.z[i], 2)));
      t.appendChild(tr);
    });
    var wrap = el("div", { class: "tablewrap" }); wrap.appendChild(t);
    box.appendChild(wrap);
  }

  // A district name that, when clicked, shows the district on the map
  function distLink(o, text) {
    return el("a", { href: "#mapView", class: "distlink", "data-leaid": o.r.leaid, title: "Show on the map" }, text || o.r.name);
  }
  var cameFrom = null;   // where the reader clicked a district name, to go back to
  function showFromLink(btn) {
    var leaid = btn.getAttribute("data-leaid");
    cameFrom = { y: window.scrollY, leaid: leaid, list: btn.closest("[id]") ? btn.closest("[id]").id : null, view: state.view };
    if (state.view === "rank") { state.view = "index"; updateLive(); save(); }
    focusDistrict(leaid);
    // show the bottom of the map and the district's facts under it
    // (the district sits near the middle of the map, the panel's buttons just under it)
    var panelTop = $("distPanel").getBoundingClientRect().top + window.scrollY;
    var mapTop = $("mapView").getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, mapTop - 12, panelTop - window.innerHeight + 170), behavior: "smooth" });
  }
  function goBack() {
    var c = cameFrom; cameFrom = null;
    renderDistPanel();
    if (!c) return;
    if (c.view !== state.view) { state.view = c.view; updateLive(); if (c.view !== "rank") sizeMap(false); save(); }
    window.scrollTo({ top: c.y, behavior: "smooth" });
    var list = c.list && document.getElementById(c.list);
    var b = list && list.querySelector('.distlink[data-leaid="' + c.leaid + '"]');
    if (b) b.focus({ preventScroll: true });
  }

  // Step 4: the state's current top ten next to the user's, as in the Arizona lab
  function renderCompare(res) {
    var now = $("cmpNow"), yours = $("cmpYours"), add = $("cmpAdded"), drop = $("cmpDropped");
    now.innerHTML = ""; yours.innerHTML = ""; add.innerHTML = ""; drop.innerHTML = "";
    var law = LAW[state.st], R = res.rows;
    function nm(o) { return o.r.name + (o.r.type !== "unified" ? " (city K-8)" : ""); }
    var topNow = R.slice().sort(function (a, b) { return a.curRank - b.curRank; }).slice(0, 10);
    topNow.forEach(function (o) { var li = el("li", { "data-leaid": o.r.leaid }); li.appendChild(distLink(o, nm(o))); now.appendChild(li); });
    if (!res.ok) {
      $("cmpNote").textContent = "Left: the ten " + law.name + " districts with the highest share of students in the state's current poverty count (" + law.measure + "). Choose indicators and weights to see your top ten beside it.";
      yours.appendChild(el("li", { class: "empty" }, "Choose indicators first."));
      return;
    }
    var topYours = R.slice().sort(function (a, b) { return a.rank - b.rank; }).slice(0, 10);
    var idsNow = topNow.map(function (o) { return o.r.leaid; }), idsYours = topYours.map(function (o) { return o.r.leaid; });
    Array.prototype.forEach.call(now.children, function (li, i) {
      if (idsYours.indexOf(idsNow[i]) < 0) { li.className = "notin"; li.title = "Not in your top ten"; }
    });
    topYours.forEach(function (o) {
      var li = el("li", { "data-leaid": o.r.leaid }); li.appendChild(distLink(o, nm(o)));
      if (idsNow.indexOf(o.r.leaid) < 0) { li.className = "notin"; li.title = "Not in the state's current top ten"; }
      yours.appendChild(li);
    });
    var both = topYours.filter(function (o) { return idsNow.indexOf(o.r.leaid) >= 0; }).length;
    $("cmpNote").textContent = both + " of 10 districts are in both top tens. Names in bold are not in the other list. The state's current count is " + law.measure + ".";
    function item(o) { var li = el("li"); li.appendChild(distLink(o, nm(o))); li.appendChild(document.createTextNode(": rank now " + o.curRank + ", your rank " + o.rank)); return li; }
    var added = topYours.filter(function (o) { return idsNow.indexOf(o.r.leaid) < 0; });
    var dropped = topNow.filter(function (o) { return idsYours.indexOf(o.r.leaid) < 0; });
    if (added.length) added.forEach(function (o) { add.appendChild(item(o)); }); else add.appendChild(el("li", null, "None. Your top ten has the same districts."));
    if (dropped.length) dropped.forEach(function (o) { drop.appendChild(item(o)); }); else drop.appendChild(el("li", null, "None."));
  }

  // Step 4: the All districts table can open across the full page
  var tableWide = false;
  function setTableWide(on) {
    var wrap = $("fullWrap"), sec = $("wideTable"), btn = $("expandBtn");
    if (on === tableWide) return;
    tableWide = on;
    if (on) {
      var panel = sec.querySelector(".panel"); panel.innerHTML = "";
      panel.appendChild(el("h2", null, "All districts"));
      panel.appendChild(wrap);
      wrap.classList.add("wide");
      sec.hidden = false;
      btn.textContent = "Collapse table";
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      $("fullHome").appendChild(wrap);
      wrap.classList.remove("wide");
      sec.hidden = true;
      btn.textContent = "Expand table";
    }
  }

  var sortKey = "rank", sortDir = 1;
  function renderMoney(res) {
    renderCompare(res);
    var law = LAW[state.st];
    var perStudent = law.w * law.base;
    $("fundIntro").textContent = law.name + "'s formula gives a district an extra " + money(perStudent) + " for each " + law.who + " student. That is " +
      fmtN(law.w * 100, 0) + "% of the " + money(law.base) + " the state starts with for every student." +
      (law.cpW ? " A district also gets " + money(law.cpW * law.base) + " more for each " + law.who + " student beyond " + fmtN(law.cpLine * 100, 0) + "% of its enrollment." : "") +
      " Below, the state still counts the same total number of " + law.who + " students, but your index decides which districts they are counted in.";
    $("fundNote").textContent = state.st === "TN"
      ? "Current counts: TDOE district profile 2024-25, economically disadvantaged percent (published as a whole number) times K-12 enrollment. Tennessee's 5% concentrated-poverty weight is set school by school, so it stays as it is and is not part of this comparison."
      : "Current counts: MDE Office of Child Nutrition CEP list (April 14, 2025), identified student percentage, times MDE K-12 enrollment for 2024-25. This is the school meals measure, close to but not confirmed identical to the count MSFF uses. The FY26 base of $6,842.61 is from a district's FY26 budget hearing, not yet confirmed in an MDE document.";
    var stats = $("fundStats"); stats.innerHTML = "";
    var gl = $("gainList"), ll = $("lossList"), tb = $("fullTable");
    gl.innerHTML = ""; ll.innerHTML = ""; tb.innerHTML = "";
    var R = res.rows;
    var cur = R.reduce(function (s, o) { return s + o.curDollars; }, 0);
    function stat(big, lbl) { var d = el("div", { class: "stat" }); d.appendChild(el("span", { class: "big" }, big)); d.appendChild(el("span", { class: "lbl" }, lbl)); stats.appendChild(d); }
    if (!res.ok) {
      stat(shortMoney(cur), "Extra money for students in poverty today");
      gl.appendChild(el("li", null, "Choose indicators and weights to see changes."));
      return;
    }
    var nw = R.reduce(function (s, o) { return s + o.newDollars; }, 0);
    var gain = R.filter(function (o) { return o.change > 0.5; }).length;
    var loss = R.filter(function (o) { return o.change < -0.5; }).length;
    var moved = R.reduce(function (s, o) { return s + Math.max(0, o.change); }, 0);
    stat(shortMoney(cur), "Extra money for students in poverty today");
    stat(shortMoney(nw), "The same money if your index decided who counts. " + (state.st === "MS" ? "In Mississippi the total can shift a little because of the extra for districts above 35%." : "The total stays the same."));
    stat(shortMoney(moved), "Moves from some districts to others");
    stat(String(gain), "Districts that would get more");
    stat(String(loss), "Districts that would get less");
    var byGain = R.slice().sort(function (a, b) { return b.change - a.change; });
    function moveItem(o) {
      var li = el("li");
      li.appendChild(distLink(o)); li.appendChild(document.createTextNode(" "));
      li.appendChild(el("span", { class: "amt " + (o.change >= 0 ? "up" : "down") }, moneySigned(o.change)));
      li.appendChild(el("span", { class: "muted" }, " (" + moneySigned(o.perStudent) + " per student)"));
      return li;
    }
    byGain.slice(0, 5).forEach(function (o) { if (o.change > 0.5) gl.appendChild(moveItem(o)); });
    byGain.slice(-5).reverse().forEach(function (o) { if (o.change < -0.5) ll.appendChild(moveItem(o)); });

    var cols = [
      { key: "name", head: "District", get: function (o) { return o.r.name; }, show: function (o) { return o.r.name + (o.r.type !== "unified" ? " (city K-8)" : ""); } },
      { key: "curRank", head: "Rank now", n: true, get: function (o) { return o.curRank; }, show: function (o) { return String(o.curRank); } },
      { key: "rank", head: "Your rank", n: true, get: function (o) { return o.rank; }, show: function (o) { return String(o.rank); } },
      { key: "moved", head: "Moved", n: true, get: function (o) { return o.curRank - o.rank; }, show: function (o) { return movedText(o.curRank - o.rank); } },
      { key: "enroll", head: "K-12 students", n: true, get: function (o) { return o.r.enroll; }, show: function (o) { return fmtN(o.r.enroll); } },
      { key: "curPct", head: "State's current poverty count", n: true, get: function (o) { return o.curCount / o.r.enroll; }, show: function (o) { return fmtN(100 * o.curCount / o.r.enroll, 1) + "%"; } },
      { key: "newPct", head: "Share under your index", n: true, get: function (o) { return o.newCount / o.r.enroll; }, show: function (o) { return fmtN(100 * o.newCount / o.r.enroll, 1) + "%"; } },
      { key: "cur", head: "Dollars now", n: true, get: function (o) { return o.curDollars; }, show: function (o) { return money(o.curDollars); } },
      { key: "new", head: "Dollars under your index", n: true, get: function (o) { return o.newDollars; }, show: function (o) { return money(o.newDollars); } },
      { key: "change", head: "Change", n: true, get: function (o) { return o.change; }, show: function (o) { return moneySigned(o.change); } },
      { key: "per", head: "Per student", n: true, get: function (o) { return o.perStudent; }, show: function (o) { return moneySigned(o.perStudent); } }
    ];
    var hr = el("tr");
    cols.forEach(function (c) {
      var th = el("th", { class: c.n ? "n" : "", scope: "col", tabindex: "0" }, c.head + (sortKey === c.key ? (sortDir > 0 ? " ▲" : " ▼") : ""));
      function go() { if (sortKey === c.key) sortDir = -sortDir; else { sortKey = c.key; sortDir = 1; } renderMoney(res); }
      th.addEventListener("click", go);
      th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      hr.appendChild(th);
    });
    tb.appendChild(hr);
    var col = cols.filter(function (c) { return c.key === sortKey; })[0];
    R.slice().sort(function (a, b) {
      var x = col.get(a), y = col.get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
    }).forEach(function (o) {
      var tr = el("tr");
      cols.forEach(function (c) {
        var td = c.key === "name" ? el("td") : el("td", { class: c.n ? "n" : "" }, c.show(o));
        if (c.key === "name") td.appendChild(distLink(o, c.show(o)));
        if (c.key === "change" || c.key === "per") td.className += o.change > 0.5 ? " up" : o.change < -0.5 ? " down" : "";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  // the farthest step that can be opened: the same rules as the Next button
  function farthestStep() {
    if (state.picked.length < 2) return 1;
    if (weightTotal() !== 100) return 2;
    return STEPS.length - 1;
  }

  // ---------------------------------------------------------------------------
  // Map
  // ---------------------------------------------------------------------------
  var W = 600, PAD = 8, mapRows = {}, projected = {};
  function ringsOf(g) { return g.type === "Polygon" ? [g.coordinates] : g.coordinates; }
  function buildMap() {
    var feats = FEATURES[state.st];
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, latSum = 0, latN = 0;
    feats.forEach(function (f) { ringsOf(f.geometry).forEach(function (poly) { poly[0].forEach(function (p) { latSum += p[1]; latN++; }); }); });
    var k = Math.cos(latSum / latN * Math.PI / 180);
    feats.forEach(function (f) {
      ringsOf(f.geometry).forEach(function (poly) { poly.forEach(function (ring) { ring.forEach(function (p) {
        var x = p[0] * k, y = -p[1];
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }); }); });
    });
    var s = (W - 2 * PAD) / (maxX - minX);
    var H = Math.round((maxY - minY) * s + 2 * PAD);
    var svg = $("map");
    svg.setAttribute("data-natural", W + " " + H);
    svg.innerHTML = "";
    var idx = {};
    rows().forEach(function (r, i) { idx[r.leaid] = i; });
    projected = {};
    feats.forEach(function (f) {
      var d = "";
      ringsOf(f.geometry).forEach(function (poly) { poly.forEach(function (ring) {
        ring.forEach(function (p, j) {
          var x = (p[0] * k - minX) * s + PAD, y = (-p[1] - minY) * s + PAD;
          d += (j ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
        });
        d += "Z";
      }); });
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill-rule", "evenodd");
      path.setAttribute("tabindex", "0");
      path.setAttribute("data-i", idx[f.properties.leaid]);
      svg.appendChild(path);
      projected[f.properties.leaid] = path;
    });
    atHome = true;
    sizeMap(true);
    if (focusId && projected[focusId]) { markMap(); setVB(zoomBox(focusId)); } else focusId = null;
  }

  var lastRes = null;
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function colorMap(res) {
    lastRes = res;
    var R = res.rows, n = R.length, view = state.view;
    var legend = $("legend"); legend.innerHTML = "";
    var title = $("mapTitle"), note = $("mapNote");
    function key(color, text) { var s = el("span"); var i = el("i"); i.style.background = color; s.appendChild(i); s.appendChild(document.createTextNode(text)); legend.appendChild(s); }
    var needCols = [css("--need-1"), css("--need-2"), css("--need-3"), css("--need-4"), css("--need-5")];
    var moneyCols = { g2: css("--gain-2"), g1: css("--gain-1"), f: css("--flat"), l1: css("--loss-1"), l2: css("--loss-2") };
    var cls;
    if (view === "money" && res.ok) {
      title.textContent = "Change in poverty-weight dollars";
      cls = R.map(function (o) {
        var p = o.perStudent;
        return p > 150 ? moneyCols.g2 : p > 20 ? moneyCols.g1 : p < -150 ? moneyCols.l2 : p < -20 ? moneyCols.l1 : moneyCols.f;
      });
      key(moneyCols.l2, "loses over $150"); key(moneyCols.l1, "loses $20 to $150"); key(moneyCols.f, "within $20"); key(moneyCols.g1, "gains $20 to $150"); key(moneyCols.g2, "gains over $150");
      note.textContent = "Per K-12 student. Hover over a district for a quick look, or click it to zoom in.";
    } else if (res.ok) {
      title.textContent = "Your index";
      cls = R.map(function (o) { return needCols[4 - Math.min(4, Math.floor((o.rank - 1) * 5 / n))]; });
      key(needCols[0], "lowest fifth"); key(needCols[1], ""); key(needCols[2], ""); key(needCols[3], ""); key(needCols[4], "highest fifth of need");
      note.textContent = "Districts ranked by your index within " + LAW[state.st].name + ". Hover over a district for a quick look, or click it to zoom in.";
    } else {
      title.textContent = "State's current poverty count";
      var pr = R.map(function (o) { return o.r.basePct; });
      var rk = rankDesc(pr);
      cls = rk.map(function (r) { return needCols[4 - Math.min(4, Math.floor((r - 1) * 5 / n))]; });
      key(needCols[0], "lowest fifth"); key(needCols[1], ""); key(needCols[2], ""); key(needCols[3], ""); key(needCols[4], "highest fifth");
      note.textContent = "Share of each district's students in the state's current poverty count: " + LAW[state.st].measure + ". Choose indicators to see your index. Click a district to zoom in.";
    }
    rows().forEach(function (r, i) { var p = projected[r.leaid]; if (p) p.setAttribute("fill", cls[i]); });
    ["index", "money", "rank"].forEach(function (v) { $("mv-" + v).setAttribute("aria-checked", String(state.view === v)); });
    $("mv-money").disabled = !res.ok;
    if (view === "rank") title.textContent = "Rankings";
  }

  function tipText(o) {
    var law = LAW[state.st], r = o.r, lines = [];
    lines.push(r.type !== "unified" ? "City K-8 system" : "Unified district");
    lines.push(fmtN(r.enroll) + " K-12 students");
    lines.push("State's current poverty count: " + fmtN(o.curCount, 0) + " (" + fmtN(100 * o.curCount / r.enroll, 1) + "%), " + money(o.curDollars));
    if (o.rank) {
      lines.push("Need rank: " + o.rank + " of " + rows().length);
      lines.push("Under your index: " + fmtN(o.newCount, 0) + " (" + fmtN(100 * o.newCount / r.enroll, 1) + "%), " + money(o.newDollars));
      lines.push("Change: " + moneySigned(o.change) + " (" + moneySigned(o.perStudent) + " per student)");
    }
    return lines;
  }
  function showTip(path, ev) {
    if (!lastRes) return;
    var o = lastRes.rows[Number(path.getAttribute("data-i"))];
    if (!o) return;
    var tip = $("tip"); tip.innerHTML = "";
    tip.appendChild(el("b", null, o.r.name));
    tipText(o).forEach(function (t) { tip.appendChild(el("div", null, t)); });
    tip.hidden = false;
    var box = $("map").parentNode.getBoundingClientRect();
    var x, y;
    if (ev && ev.clientX != null) { x = ev.clientX - box.left + 12; y = ev.clientY - box.top + 12; }
    else { var b = path.getBoundingClientRect(); x = b.left - box.left + b.width / 2; y = b.top - box.top + b.height / 2; }
    x = Math.min(x, box.width - tip.offsetWidth - 4); x = Math.max(4, x);
    tip.style.left = x + "px"; tip.style.top = y + "px";
    document.querySelectorAll("#map path.sel").forEach(function (p) { p.classList.remove("sel"); });
    path.classList.add("sel");
  }
  function hideTip() { $("tip").hidden = true; document.querySelectorAll("#map path.sel").forEach(function (p) { p.classList.remove("sel"); }); }

  function renderTop(res) {
    var ol = $("topList"); ol.innerHTML = "";
    if (!res.ok) { ol.appendChild(el("li", null, "Choose indicators to rank districts.")); return; }
    res.rows.slice().sort(function (a, b) { return a.rank - b.rank; }).slice(0, 10).forEach(function (o) {
      var li = el("li"); li.appendChild(distLink(o)); ol.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------------
  // One district: zoom on the map, a short panel under it, and a full page
  // ---------------------------------------------------------------------------
  var NBR = {};          // leaid -> neighboring leaids (34_dashboard_neighbors.do)
  var focusId = null;    // district zoomed on the map
  var pageId = null;     // district whose full page is open
  var vbNow = null, vbAnim = null;

  function rowOf(leaid) { if (!lastRes) return null; for (var i = 0; i < lastRes.rows.length; i++) if (lastRes.rows[i].r.leaid === leaid) return lastRes.rows[i]; return null; }
  function stateOf(leaid) { return leaid.slice(0, 2) === "28" ? "MS" : "TN"; }
  function baseVB() { var v = $("map").getAttribute("data-base").split(" ").map(Number); return v; }
  function clampVB(v) {
    var base = baseVB(), w = Math.min(base[2], Math.max(base[2] / 16, v[2])), h = w * base[3] / base[2];
    var x = Math.max(base[0], Math.min(base[0] + base[2] - w, v[0])), y = Math.max(base[1], Math.min(base[1] + base[3] - h, v[1]));
    return [x, y, w, h];
  }

  // The map box can be made taller or shorter by dragging the handle under it.
  // mapH holds each state's chosen height in pixels (null = the state's own shape).
  var mapH = { MS: null, TN: null };
  var atHome = true;   // the map shows its starting view (not zoomed or moved by the user)
  function naturalSize() { return $("map").getAttribute("data-natural").split(" ").map(Number); }
  function sizeMap(reset) {
    var box = $("map").parentNode, nat = naturalSize(), bw = box.clientWidth || 1;
    var natH = bw * nat[1] / nat[0];
    var h = mapH[state.st] ? mapH[state.st] : natH;
    box.style.height = Math.round(h) + "px";
    // the full-state view: the state's own box, widened or heightened to fill the map box
    var a = bw / h, base;
    if (a < nat[0] / nat[1]) { var bh = nat[0] / a; base = [0, -(bh - nat[1]) / 2, nat[0], bh]; }
    else { var w2 = nat[1] * a; base = [-(w2 - nat[0]) / 2, 0, w2, nat[1]]; }
    var old = $("map").getAttribute("data-base");
    var userHome = atHome;
    var wasZoomed = !reset && vbNow && old && vbNow[2] < Number(old.split(" ")[2]) - 0.5 && !userHome;
    $("map").setAttribute("data-base", base.join(" "));
    if (wasZoomed) {
      var cx = vbNow[0] + vbNow[2] / 2, cy = vbNow[1] + vbNow[3] / 2, w = vbNow[2], hh = w * base[3] / base[2];
      setVB(clampVB([cx - w / 2, cy - hh / 2, w, hh]));
    } else setVB(homeVB());
    $("mapHandle").setAttribute("aria-valuenow", String(Math.round(h)));
    stickyCheck();
  }
  // The starting view. When the box is taller than the state's own shape (Tennessee
  // dragged taller), the state fills the box's height and can be dragged sideways,
  // so a taller box shows a bigger map instead of empty space.
  function homeVB() {
    var base = baseVB(), nat = naturalSize();
    if (mapH[state.st] && base[1] < 0) {
      var w = nat[1] * base[2] / base[3];
      return clampVB([(nat[0] - w) / 2, 0, w, nat[1]]);
    }
    return base.slice();
  }
  // the live panel only stays in view while scrolling if it fits on the screen
  function stickyCheck() {
    var live = document.querySelector(".live");
    live.classList.toggle("nosticky", live.offsetHeight > window.innerHeight - 24);
  }
  function setVB(v) {
    vbNow = v;
    var svg = $("map"), base = baseVB(), zoomed = v[2] < base[2] - 0.5;
    svg.setAttribute("viewBox", v.map(function (x) { return x.toFixed(2); }).join(" "));
    svg.classList.toggle("zoomed", zoomed);
    $("zoomHint").hidden = !zoomed;
    $("zoomOut").disabled = !zoomed;
    $("zoomIn").disabled = v[2] <= base[2] / 16 + 0.01;
  }
  // + and - buttons: zoom around the middle of what is shown now
  function zoomBy(f) {
    atHome = false;
    var v = vbNow || baseVB(), w = v[2] / f, h = v[3] / f;
    animateVB(clampVB([v[0] + (v[2] - w) / 2, v[1] + (v[3] - h) / 2, w, h]));
  }
  function animateVB(to) {
    var from = vbNow || baseVB();
    if (vbAnim) cancelAnimationFrame(vbAnim);
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) { setVB(to); return; }
    var t0 = null, dur = 450;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setVB(from.map(function (a, i) { return a + (to[i] - a) * e; }));
      if (k < 1) vbAnim = requestAnimationFrame(step); else vbAnim = null;
    }
    vbAnim = requestAnimationFrame(step);
  }
  // the box around a district and its neighbors, with the map's own shape
  function zoomBox(leaid) {
    var base = baseVB(), ids = [leaid].concat(NBR[leaid] || []);
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach(function (id) {
      var p = projected[id]; if (!p) return;
      var b = p.getBBox();
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    });
    var w = (x1 - x0) * 1.08, h = (y1 - y0) * 1.08, aspect = base[2] / base[3];
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    if (w > base[2]) { w = base[2]; h = base[3]; }
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return clampVB([cx - w / 2, cy - h / 2, w, h]);
  }
  function markMap() {
    document.querySelectorAll("#map path.focus, #map path.nbr").forEach(function (p) { p.classList.remove("focus"); p.classList.remove("nbr"); });
    if (!focusId || !projected[focusId]) return;
    var svg = $("map");
    (NBR[focusId] || []).forEach(function (id) { var p = projected[id]; if (p) { p.classList.add("nbr"); svg.appendChild(p); } });
    projected[focusId].classList.add("focus");
    svg.appendChild(projected[focusId]);
  }
  function focusDistrict(leaid, instant) {
    if (!projected[leaid]) return;
    focusId = leaid;
    atHome = false;
    hideTip();
    markMap();
    var box = zoomBox(leaid);
    if (instant) setVB(box); else animateVB(box);
    renderDistPanel();
  }
  function clearFocus() {
    focusId = null;
    cameFrom = null;
    markMap();
    animateVB(baseVB());
    atHome = false;
    renderDistPanel();
  }

  function addFact(dl, k, v) { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", null, v)); }
  function factsList(o) {
    var r = o.r, law = LAW[state.st], dl = el("dl", { class: "facts" });
    addFact(dl, "Type", r.type !== "unified" ? "City K-8 system" : "Unified district (K-12)");
    addFact(dl, "K-12 students", fmtN(r.enroll));
    addFact(dl, "State's current poverty count", fmtN(o.curCount, 0) + " " + law.who + " students (" + fmtN(100 * o.curCount / r.enroll, 1) + "%)");
    addFact(dl, "Poverty money now", money(o.curDollars));
    return dl;
  }
  function yourList(o) {
    var n = rows().length;
    if (!lastRes.ok) return el("p", { class: "muted small" }, "Choose indicators and weights to see this district under your index.");
    var dl = el("dl", { class: "facts" }), d = o.curRank - o.rank;
    addFact(dl, "Need rank", o.rank + " of " + n + " under your index (" + o.curRank + " now, " + (d > 0 ? "up " + d : d < 0 ? "down " + (-d) : "no change") + ")");
    addFact(dl, "Would count", fmtN(o.newCount, 0) + " students (" + fmtN(100 * o.newCount / o.r.enroll, 1) + "%)");
    addFact(dl, "Poverty money", money(o.newDollars));
    addFact(dl, "Change", moneySigned(o.change) + " (" + moneySigned(o.perStudent) + " per student)");
    return dl;
  }
  function neighborButtons(leaid, onPick) {
    var ul = el("ul", { class: "nbrlist" });
    (NBR[leaid] || []).map(rowOf).filter(Boolean).sort(function (a, b) { return a.r.name < b.r.name ? -1 : 1; }).forEach(function (o) {
      var li = el("li"), b = el("button", { type: "button" });
      b.appendChild(document.createTextNode(o.r.name + " "));
      b.appendChild(el("span", { class: "sub" }, lastRes.ok ? "rank " + o.rank : fmtN(o.r.basePct, 0) + "% counted"));
      b.addEventListener("click", function () { onPick(o.r.leaid); });
      li.appendChild(b); ul.appendChild(li);
    });
    return ul;
  }

  function renderDistPanel() {
    var box = $("distPanel");
    var o = focusId && rowOf(focusId);
    if (!o) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = "";
    var head = el("div", { class: "dphead" });
    head.appendChild(el("h3", null, o.r.name));
    var btns = el("div", { class: "dpbtns" });
    if (cameFrom) {
      var back = el("button", { type: "button", class: "small" }, "Back to the list");
      back.addEventListener("click", goBack);
      btns.appendChild(back);
    }
    var out = el("button", { type: "button", class: "ghost small" }, "Whole state");
    out.addEventListener("click", clearFocus);
    btns.appendChild(out);
    head.appendChild(btns);
    box.appendChild(head);
    box.appendChild(factsList(o));
    box.appendChild(el("h4", null, "Under your index"));
    box.appendChild(yourList(o));
    box.appendChild(el("h4", null, "Bordering districts (" + (NBR[o.r.leaid] || []).length + ")"));
    box.appendChild(neighborButtons(o.r.leaid, function (id) { focusDistrict(id); }));
    var open = el("button", { type: "button", class: "ghost small" }, "Open the full district page");
    open.addEventListener("click", function () { openDistrictPage(o.r.leaid); });
    box.appendChild(open);
    box.hidden = false;
  }

  // need rank on one indicator: 1 = most need, equal values share a rank
  function indRank(code, leaid) {
    var d = BY[code].dir, R = rows(), x = null;
    R.forEach(function (r) { if (r.leaid === leaid) x = d * r.vals[code]; });
    var k = 1; R.forEach(function (r) { if (d * r.vals[code] > x) k++; });
    return k;
  }
  function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }

  function renderDistrictPage() {
    var page = $("districtPage"), col = page.parentNode;
    var o = pageId && rowOf(pageId);
    if (!o) { page.hidden = true; page.innerHTML = ""; col.classList.remove("dist-open"); return; }
    page.innerHTML = "";
    var law = LAW[state.st], r = o.r, n = rows().length;
    var back = el("button", { type: "button", class: "ghost small" }, "Back to the steps");
    back.addEventListener("click", function () { closeDistrictPage(); });
    page.appendChild(back);
    var h = el("h2", null, r.name); h.style.marginTop = "14px"; h.setAttribute("tabindex", "-1"); h.id = "dpTitle";
    page.appendChild(h);
    var raw = null; RAW.dist.forEach(function (d) { if (d.leaid === r.leaid) raw = d; });
    page.appendChild(el("p", { class: "muted small" }, law.name + " · federal ID " + r.leaid + (raw ? " · state district number " + raw.st_no : "")));

    page.appendChild(el("h3", null, "Basic facts"));
    page.appendChild(factsList(o));
    page.appendChild(el("h3", null, "Under your index"));
    page.appendChild(yourList(o));

    page.appendChild(el("h3", null, "Indicators"));
    page.appendChild(el("p", { class: "muted small" }, "Rank 1 is the most need among " + n + " " + law.name + " districts. The margin of error is the census range at 90 percent confidence: the true value is likely within that many points of the estimate."));
    DOMAINS.forEach(function (g) {
      var codes = IND.filter(function (d) { return d.domain === g.key; });
      page.appendChild(el("h4", null, g.label));
      var wrap = el("div", { class: "dtablewrap" }), t = el("table", { class: "dtable" });
      var hr = el("tr");
      [["Indicator", ""], ["This district", "n"], ["Margin of error", "n"], ["State median", "n"], ["Need rank", "n"]].forEach(function (c) { hr.appendChild(el("th", c[1] ? { class: c[1] } : null, c[0])); });
      t.appendChild(hr);
      codes.forEach(function (d) {
        var tr = el("tr"), v = r.vals[d.code], m = r.moe[d.code];
        var name = el("td", null, d.label); if (d.note) name.title = d.note; tr.appendChild(name);
        tr.appendChild(el("td", { class: "n" }, fmtVal(d.code, v)));
        tr.appendChild(el("td", { class: "n" }, isFinite(m) ? "± " + fmtVal(d.code, m) : "none published"));
        tr.appendChild(el("td", { class: "n" }, fmtVal(d.code, median(rows().map(function (x) { return x.vals[d.code]; })))));
        tr.appendChild(el("td", { class: "n" }, indRank(d.code, r.leaid) + " of " + n));
        t.appendChild(tr);
      });
      wrap.appendChild(t); page.appendChild(wrap);
    });

    var nb = (NBR[r.leaid] || []).map(rowOf).filter(Boolean).sort(function (a, b) { return a.r.name < b.r.name ? -1 : 1; });
    page.appendChild(el("h3", null, "Bordering districts (" + nb.length + ")"));
    var wrap = el("div", { class: "dtablewrap" }), t = el("table", { class: "dtable" }), hr = el("tr");
    var heads = [["District", ""], ["Students", "n"], ["State's current poverty count", "n"], ["Rank now", "n"]];
    if (lastRes.ok) heads = heads.concat([["Your rank", "n"], ["Change / student", "n"]]);
    heads.forEach(function (c) { hr.appendChild(el("th", c[1] ? { class: c[1] } : null, c[0])); });
    t.appendChild(hr);
    [o].concat(nb).forEach(function (x, i) {
      var tr = el("tr"), td = el("td");
      if (i === 0) td.appendChild(el("strong", null, x.r.name));
      else { var b = el("button", { type: "button", class: "plain" }, x.r.name); b.addEventListener("click", function () { openDistrictPage(x.r.leaid); }); td.appendChild(b); }
      tr.appendChild(td);
      tr.appendChild(el("td", { class: "n" }, fmtN(x.r.enroll)));
      tr.appendChild(el("td", { class: "n" }, fmtN(x.r.basePct, 1) + "%"));
      tr.appendChild(el("td", { class: "n" }, String(x.curRank)));
      if (lastRes.ok) { tr.appendChild(el("td", { class: "n" }, String(x.rank))); tr.appendChild(el("td", { class: "n" }, moneySigned(x.perStudent))); }
      t.appendChild(tr);
    });
    wrap.appendChild(t); page.appendChild(wrap);
    page.hidden = false;
    col.classList.add("dist-open");
  }

  function openDistrictPage(leaid) {
    if (location.hash !== "#district-" + leaid) { location.hash = "district-" + leaid; return; } // hashchange does the rest
    showDistrictFromHash();
  }
  function showDistrictFromHash() {
    var m = /^#district-(\d{7})$/.exec(location.hash);
    if (!m || !DATA[stateOf(m[1])].some(function (r) { return r.leaid === m[1]; })) { if (pageId) { pageId = null; renderDistrictPage(); } return; }
    var id = m[1], st = stateOf(id);
    if (state.st !== st) { state.st = st; focusId = null; buildMap(); update(); }
    pageId = id;
    focusDistrict(id, false);
    renderDistrictPage();
    window.scrollTo(0, 0);
    var h = $("dpTitle"); if (h) h.focus({ preventScroll: true });
  }
  function closeDistrictPage() {
    if (!pageId) return;
    pageId = null;
    if (/^#district-/.test(location.hash)) history.pushState(null, "", location.pathname + location.search);
    renderDistrictPage();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------------------
  // Update loop
  // ---------------------------------------------------------------------------
  function movedText(d) { return d > 0 ? "\u25B2 " + d : d < 0 ? "\u25BC " + (-d) : "no change"; }

  // Side-by-side rankings: who the state counts now, and the user's index
  function renderRanks(res) {
    var now = $("rankNow"), yours = $("rankYours");
    now.innerHTML = ""; yours.innerHTML = "";
    var up = $("moveUp"), down = $("moveDown");
    up.innerHTML = ""; down.innerHTML = "";
    var R = res.rows, n = R.length, law = LAW[state.st];
    function li(rank, o, showMove) {
      var x = el("li", { "data-leaid": o.r.leaid });
      x.appendChild(el("span", { class: "rk" }, rank + "."));
      x.appendChild(el("span", null, o.r.name));
      if (showMove) {
        var d = o.curRank - o.rank;
        x.appendChild(el("span", { class: "mv " + (d > 0 ? "up" : d < 0 ? "down" : "same") }, movedText(d)));
      } else x.appendChild(el("span"));
      return x;
    }
    R.slice().sort(function (a, b) { return a.curRank - b.curRank; }).forEach(function (o) { now.appendChild(li(o.curRank, o, false)); });
    if (!res.ok) {
      $("rankNote").textContent = "Left: " + n + " " + law.name + " districts ranked by the state's current poverty count, as a share of students (" + law.measure + "). Choose indicators to see your ranking beside it.";
      yours.appendChild(el("li", { class: "empty" }, "Choose indicators to rank districts."));
      up.appendChild(el("li", null, "Choose indicators first."));
      return;
    }
    $("rankNote").textContent = "Rank 1 is the most need. \u25B2 means a district ranks higher on your index than on the state's current measure. Hover a name to find it in both lists.";
    R.slice().sort(function (a, b) { return a.rank - b.rank; }).forEach(function (o) { yours.appendChild(li(o.rank, o, true)); });
    var byMove = R.slice().sort(function (a, b) { return (b.curRank - b.rank) - (a.curRank - a.rank) || a.rank - b.rank; });
    function mv(o) {
      var x = el("li");
      x.appendChild(el("span", null, o.r.name + " "));
      var d = o.curRank - o.rank;
      x.appendChild(el("span", { class: "amt " + (d > 0 ? "up" : "down") }, movedText(d)));
      x.appendChild(el("span", { class: "muted" }, " (" + o.curRank + " to " + o.rank + ")"));
      return x;
    }
    byMove.slice(0, 5).forEach(function (o) { if (o.curRank - o.rank > 0) up.appendChild(mv(o)); });
    byMove.slice(-5).reverse().forEach(function (o) { if (o.curRank - o.rank < 0) down.appendChild(mv(o)); });
  }
  function highlight(leaid) {
    document.querySelectorAll(".ranklist li.hl").forEach(function (x) { x.classList.remove("hl"); });
    if (leaid) document.querySelectorAll('.ranklist li[data-leaid="' + leaid + '"]').forEach(function (x) { x.classList.add("hl"); });
  }

  function updateLive() {
    var res = results();
    colorMap(res);
    renderTop(res);
    renderDistPanel();
    if (pageId) renderDistrictPage();
    $("mapView").hidden = state.view === "rank";
    $("rankView").hidden = state.view !== "rank";
    if (state.view === "rank") { hideTip(); renderRanks(res); }
    if (state.step === 4) renderMoney(res);
    else setTableWide(false);
    document.dispatchEvent(new CustomEvent("mam:update"));
    stickyCheck();
    return res;
  }
  function update() {
    ["MS", "TN"].forEach(function (s) { $("st-" + s).setAttribute("aria-checked", String(state.st === s)); });
    renderStepper();
    if (state.step === 1) renderCards();
    if (state.step === 2) renderWeights();
    if (state.step === 3) renderScale();
    updateLive();
    save();
  }

  // results for either state, for downloads; the page's own state is left as it was
  function resultsFor(st) {
    var keep = state.st;
    state.st = st;
    try { return results(); } finally { state.st = keep; }
  }

  function wire() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".distlink");
      if (b) { e.preventDefault(); showFromLink(b); }
    });
    $("expandBtn").addEventListener("click", function () {
      var on = !tableWide;
      setTableWide(on);
      if (!on) { $("fullDetails").open = true; $("fullDetails").scrollIntoView({ behavior: "smooth", block: "start" }); }
    });
    ["MS", "TN"].forEach(function (s) {
      $("st-" + s).addEventListener("click", function () {
        if (state.st === s) return;
        closeDistrictPage(); focusId = null;
        state.st = s; hideTip(); buildMap(); update();
      });
    });
    ["index", "money", "rank"].forEach(function (v) {
      $("mv-" + v).addEventListener("click", function () { state.view = v; updateLive(); if (v !== "rank") sizeMap(false); save(); });
    });
    ["rankNow", "rankYours"].forEach(function (id) {
      $(id).addEventListener("mouseover", function (e) { var x = e.target.closest("li"); highlight(x && x.getAttribute("data-leaid")); });
      $(id).addEventListener("mouseleave", function () { highlight(null); });
    });
    $("nextBtn").addEventListener("click", function () { closeDistrictPage(); if (state.step < STEPS.length - 1) { state.step++; update(); window.scrollTo(0, 0); } });
    $("backBtn").addEventListener("click", function () { closeDistrictPage(); if (state.step > 0) { state.step--; update(); window.scrollTo(0, 0); } });
    $("evenBtn").addEventListener("click", function () { state.weights = evenWeights(); state.weightsTouched = true; renderWeights(); renderStepper(); updateLive(); save(); });
    document.querySelectorAll("input[name=scale]").forEach(function (x) {
      x.addEventListener("change", function () { state.scale = x.value; renderScale(); updateLive(); save(); });
    });
    $("stepper").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-go]");
      if (!b || b.disabled) return;
      var i = Number(b.getAttribute("data-go"));
      if (i > farthestStep()) return;
      var wasOpen = !!pageId;
      closeDistrictPage();
      if (i !== state.step || wasOpen) { state.step = i; update(); }
    });
    var resetArmed = false;
    $("resetBtn").addEventListener("click", function () {
      if (!resetArmed) { resetArmed = true; $("resetBtn").textContent = "Click again to clear everything"; setTimeout(function () { resetArmed = false; $("resetBtn").textContent = "Start over"; }, 4000); return; }
      resetArmed = false; $("resetBtn").textContent = "Start over";
      var st = state.st;
      state = { st: st, step: 0, picked: [], weights: {}, weightsTouched: false, scale: "rank", view: "index" };
      sortKey = "rank"; sortDir = 1;
      closeDistrictPage(); focusId = null; markMap(); setVB(homeVB()); atHome = true;
      update();
    });
    var svg = $("map");
    // drag to move around when zoomed in
    var drag = null, dragged = false;
    svg.addEventListener("pointerdown", function (e) {
      if (!svg.classList.contains("zoomed") || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, v: (vbNow || baseVB()).slice(), id: e.pointerId };
      dragged = false;
    });
    svg.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!dragged && Math.abs(dx) + Math.abs(dy) < 5) return;
      if (!dragged) { dragged = true; atHome = false; svg.setPointerCapture(e.pointerId); svg.classList.add("dragging"); hideTip(); if (vbAnim) { cancelAnimationFrame(vbAnim); vbAnim = null; } }
      var k = drag.v[2] / svg.clientWidth;
      setVB(clampVB([drag.v[0] - dx * k, drag.v[1] - dy * k, drag.v[2], drag.v[3]]));
    });
    function endDrag(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag = null; svg.classList.remove("dragging");
      setTimeout(function () { dragged = false; }, 0);
    }
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("click", function (e) { if (dragged) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    $("zoomIn").addEventListener("click", function () { zoomBy(1.6); });
    $("zoomOut").addEventListener("click", function () { zoomBy(1 / 1.6); });
    // Whole state always fits the full state in the box (with space around it when the box is tall)
    $("zoomAll").addEventListener("click", function () { if (focusId) clearFocus(); else { animateVB(baseVB()); atHome = false; } });
    svg.addEventListener("mousemove", function (e) { if (drag && dragged) return; if (e.target.tagName === "path") showTip(e.target, e); });
    svg.addEventListener("mouseleave", hideTip);
    svg.addEventListener("click", function (e) {
      if (e.target.tagName !== "path") return;
      var o = lastRes && lastRes.rows[Number(e.target.getAttribute("data-i"))];
      if (o) focusDistrict(o.r.leaid);
    });
    svg.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.tagName === "path") {
        e.preventDefault();
        var o = lastRes && lastRes.rows[Number(e.target.getAttribute("data-i"))];
        if (o) focusDistrict(o.r.leaid);
      }
    });
    window.addEventListener("hashchange", showDistrictFromHash);
    var hd = $("mapHandle"), hdrag = null;
    function maxH() { return Math.max(320, Math.round(window.innerHeight * 0.9)); }
    function setH(h) { mapH[state.st] = Math.max(140, Math.min(maxH(), Math.round(h))); hideTip(); sizeMap(false); }
    hd.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      hdrag = { y: e.clientY, h: $("map").parentNode.clientHeight, id: e.pointerId };
      hd.setPointerCapture(e.pointerId); hd.classList.add("dragging"); e.preventDefault();
    });
    hd.addEventListener("pointermove", function (e) { if (hdrag && e.pointerId === hdrag.id) setH(hdrag.h + e.clientY - hdrag.y); });
    function hEnd() { hdrag = null; hd.classList.remove("dragging"); }
    hd.addEventListener("pointerup", hEnd);
    hd.addEventListener("pointercancel", hEnd);
    hd.addEventListener("dblclick", function () { mapH[state.st] = null; sizeMap(false); });
    hd.addEventListener("keydown", function (e) {
      var cur = $("map").parentNode.clientHeight;
      if (e.key === "ArrowDown") { e.preventDefault(); setH(cur + 40); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setH(cur - 40); }
      else if (e.key === "Home") { e.preventDefault(); mapH[state.st] = null; sizeMap(false); }
    });
    var rz = null;
    window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if ($("map").getAttribute("data-natural")) sizeMap(false); }, 120); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !focusId || pageId) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      clearFocus();
    });
    svg.addEventListener("focusin", function (e) { if (e.target.tagName === "path") showTip(e.target, null); });
    svg.addEventListener("focusout", hideTip);
  }

  Promise.all([
    fetch("data/districts.csv").then(function (r) { return r.text(); }),
    fetch("data/indicators.csv").then(function (r) { return r.text(); }),
    fetch("data/map.geojson").then(function (r) { return r.json(); }),
    fetch("data/food.csv").then(function (r) { return r.text(); }),
    fetch("data/neighbors.csv").then(function (r) { return r.text(); }),
    fetch("data/housing.csv").then(function (r) { return r.text(); }),
    fetch("data/care.csv").then(function (r) { return r.text(); })
  ]).then(function (x) {
    parseCSV(x[4]).forEach(function (r) { (NBR[r.leaid] = NBR[r.leaid] || []).push(r.neighbor_leaid); });
    RAW.dist = parseCSV(x[0]); RAW.ind = parseCSV(x[1]); RAW.food = parseCSV(x[3]); RAW.housing = parseCSV(x[5]); RAW.care = parseCSV(x[6]); RAW.map = x[2];
    build(RAW.dist, RAW.ind, RAW.food, RAW.housing, RAW.care);
    FEATURES.MS = x[2].features.filter(function (f) { return f.properties.leaid.slice(0, 2) === "28"; });
    FEATURES.TN = x[2].features.filter(function (f) { return f.properties.leaid.slice(0, 2) === "47"; });
    load();
    wire();
    buildMap();
    update();
    document.dispatchEvent(new CustomEvent("mam:ready"));
    if (/^#district-/.test(location.hash)) showDistrictFromHash();
  }).catch(function (e) {
    document.querySelector("main").insertAdjacentHTML("afterbegin", "<div class=\"warn\"><p>The data files could not be loaded. Open this page from its web address, not from a file on your computer.</p></div>");
    console.error(e);
  });

  window.__mam = {
    results: results, resultsFor: resultsFor, reshare: reshare, ready: ready, weightsNow: weightsNow,
    state: function () { return state; }, data: DATA, raw: RAW, LAW: LAW, IND: IND, BY: BY, DOMAINS: DOMAINS
  };
})();

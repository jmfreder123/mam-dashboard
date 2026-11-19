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
    { code: "unins", domain: "needs", label: "Kids uninsured", unit: "%", dir: 1, desc: "Children under 19 with no health insurance." },
    { code: "crowd", domain: "needs", label: "Crowded housing", unit: "%", dir: 1, desc: "Households with more than one person per room." },
    { code: "plumb", domain: "needs", label: "No complete plumbing", unit: "%", dir: 1, desc: "Households lacking complete plumbing." },
    { code: "rentburden", domain: "needs", label: "Rent burden", unit: "%", dir: 1, desc: "Renter households paying 35 percent or more of income on rent." },
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
    { key: "needs", label: "Health and housing" },
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

  var STEPS = ["The task", "Indicators", "Weights", "Scaling", "Money", "Reflect"];
  var STORE = "mam-dashboard-v1";
  var DATA = { MS: [], TN: [] };
  var FEATURES = {};
  var state = { st: "MS", step: 0, picked: [], weights: {}, weightsTouched: false, scale: "rank", answers: ["", "", ""], view: "index" };

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
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------
  function fmtN(x, d) { return x.toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function fmtVal(code, x) {
    var u = BY[code].unit;
    if (u === "$") return "$" + fmtN(x, 0);
    if (u === "%") return fmtN(x, 1) + "%";
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

  function build(dist, ind, food) {
    var byId = {};
    ind.forEach(function (r) { byId[r.leaid] = r; });
    // food access comes from its own file (decision D073); its moe column is empty
    food.forEach(function (r) {
      var x = byId[r.leaid];
      if (x) { x.foodkids_est = r.foodkids_est; x.foodkids_moe = r.foodkids_moe; }
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
    STEPS.forEach(function (s, i) {
      var li = el("li", null, s);
      if (i === state.step) { li.className = "now"; li.setAttribute("aria-current", "step"); }
      else if (i < state.step) li.className = "done";
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

  function renderCards() {
    var box = $("indicatorCards"); box.innerHTML = "";
    var n = state.picked.length;
    $("pickCount").textContent = n + " selected" + (n > 0 && (n < 4 || n > 6) ? ". Four to six works best." : ".");
    var groups = {};
    DOMAINS.forEach(function (g) {
      var sec = el("div", { class: "domain" });
      var n = IND.filter(function (d) { return d.domain === g.key; }).length;
      var k = IND.filter(function (d) { return d.domain === g.key && state.picked.indexOf(d.code) >= 0; }).length;
      sec.appendChild(el("h3", null, g.label + " "));
      sec.lastChild.appendChild(el("span", { class: "dcount" }, k + " of " + n + " picked"));
      var cards = el("div", { class: "cards" });
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

  var sortKey = "rank", sortDir = 1;
  function renderMoney(res) {
    var law = LAW[state.st];
    var perStudent = law.w * law.base;
    $("fundIntro").textContent = law.formula + " (" + law.name + ", " + law.year + ") pays " + money(perStudent) + " for each " + law.who + " student: " +
      fmtN(law.w * 100, 0) + "% of the " + money(law.base) + " base" +
      (law.cpW ? ", plus " + money(law.cpW * law.base) + " for each low-income student above " + fmtN(law.cpLine * 100, 0) + "% of a district's enrollment." : ".") +
      " Below, the same students are shared out by your index instead of by the state's current measure.";
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
      stat(shortMoney(cur), "poverty-weight dollars now");
      gl.appendChild(el("li", null, "Choose indicators and weights to see changes."));
      return;
    }
    var nw = R.reduce(function (s, o) { return s + o.newDollars; }, 0);
    var gain = R.filter(function (o) { return o.change > 0.5; }).length;
    var loss = R.filter(function (o) { return o.change < -0.5; }).length;
    var moved = R.reduce(function (s, o) { return s + Math.max(0, o.change); }, 0);
    stat(shortMoney(cur), "poverty-weight dollars now");
    stat(shortMoney(nw), "under your index" + (state.st === "MS" ? " (the 35% rule can change the total)" : " (same total)"));
    stat(shortMoney(moved), "moves to districts that gain");
    stat(gain + " / " + loss, "districts gain / lose");
    var byGain = R.slice().sort(function (a, b) { return b.change - a.change; });
    function moveItem(o) {
      var li = el("li");
      li.appendChild(el("span", null, o.r.name + " "));
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
      { key: "curPct", head: "Counted now", n: true, get: function (o) { return o.curCount / o.r.enroll; }, show: function (o) { return fmtN(100 * o.curCount / o.r.enroll, 1) + "%"; } },
      { key: "newPct", head: "Under your index", n: true, get: function (o) { return o.newCount / o.r.enroll; }, show: function (o) { return fmtN(100 * o.newCount / o.r.enroll, 1) + "%"; } },
      { key: "cur", head: "Dollars now", n: true, get: function (o) { return o.curDollars; }, show: function (o) { return money(o.curDollars); } },
      { key: "new", head: "Under your index", n: true, get: function (o) { return o.newDollars; }, show: function (o) { return money(o.newDollars); } },
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
        var td = el("td", { class: c.n ? "n" : "" }, c.show(o));
        if (c.key === "change" || c.key === "per") td.className += o.change > 0.5 ? " up" : o.change < -0.5 ? " down" : "";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  function renderReflect() {
    ["q1", "q2", "q3"].forEach(function (id, i) { if ($(id).value !== state.answers[i]) $(id).value = state.answers[i] || ""; });
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
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
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
      note.textContent = "Per K-12 student. Hover or tap a district for details.";
    } else if (res.ok) {
      title.textContent = "Your index";
      cls = R.map(function (o) { return needCols[4 - Math.min(4, Math.floor((o.rank - 1) * 5 / n))]; });
      key(needCols[0], "lowest fifth"); key(needCols[1], ""); key(needCols[2], ""); key(needCols[3], ""); key(needCols[4], "highest fifth of need");
      note.textContent = "Districts ranked by your index within " + LAW[state.st].name + ". Hover or tap a district for details.";
    } else {
      title.textContent = "Counted now";
      var pr = R.map(function (o) { return o.r.basePct; });
      var rk = rankDesc(pr);
      cls = rk.map(function (r) { return needCols[4 - Math.min(4, Math.floor((r - 1) * 5 / n))]; });
      key(needCols[0], "lowest fifth"); key(needCols[1], ""); key(needCols[2], ""); key(needCols[3], ""); key(needCols[4], "highest fifth");
      note.textContent = "Share of students the state counts now: " + LAW[state.st].measure + ". Choose indicators to see your index.";
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
    lines.push("Counted now: " + fmtN(o.curCount, 0) + " (" + fmtN(100 * o.curCount / r.enroll, 1) + "%), " + money(o.curDollars));
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
      ol.appendChild(el("li", null, o.r.name));
    });
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
      $("rankNote").textContent = "Left: " + n + " " + law.name + " districts ranked by the share of students the state counts now (" + law.measure + "). Choose indicators to see your ranking beside it.";
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
    $("mapView").hidden = state.view === "rank";
    $("rankView").hidden = state.view !== "rank";
    if (state.view === "rank") { hideTip(); renderRanks(res); }
    if (state.step === 4) renderMoney(res);
    return res;
  }
  function update() {
    ["MS", "TN"].forEach(function (s) { $("st-" + s).setAttribute("aria-checked", String(state.st === s)); });
    renderStepper();
    if (state.step === 1) renderCards();
    if (state.step === 2) renderWeights();
    if (state.step === 3) renderScale();
    if (state.step === 5) renderReflect();
    updateLive();
    save();
  }

  function wire() {
    ["MS", "TN"].forEach(function (s) {
      $("st-" + s).addEventListener("click", function () {
        if (state.st === s) return;
        state.st = s; hideTip(); buildMap(); update();
      });
    });
    ["index", "money", "rank"].forEach(function (v) {
      $("mv-" + v).addEventListener("click", function () { state.view = v; updateLive(); save(); });
    });
    ["rankNow", "rankYours"].forEach(function (id) {
      $(id).addEventListener("mouseover", function (e) { var x = e.target.closest("li"); highlight(x && x.getAttribute("data-leaid")); });
      $(id).addEventListener("mouseleave", function () { highlight(null); });
    });
    $("nextBtn").addEventListener("click", function () { if (state.step < STEPS.length - 1) { state.step++; update(); window.scrollTo(0, 0); } });
    $("backBtn").addEventListener("click", function () { if (state.step > 0) { state.step--; update(); window.scrollTo(0, 0); } });
    $("evenBtn").addEventListener("click", function () { state.weights = evenWeights(); state.weightsTouched = true; renderWeights(); renderStepper(); updateLive(); save(); });
    document.querySelectorAll("input[name=scale]").forEach(function (x) {
      x.addEventListener("change", function () { state.scale = x.value; renderScale(); updateLive(); save(); });
    });
    ["q1", "q2", "q3"].forEach(function (id, i) { $(id).addEventListener("input", function () { state.answers[i] = $(id).value; save(); }); });
    var resetArmed = false;
    $("resetBtn").addEventListener("click", function () {
      if (!resetArmed) { resetArmed = true; $("resetBtn").textContent = "Click again to clear everything"; setTimeout(function () { resetArmed = false; $("resetBtn").textContent = "Start over"; }, 4000); return; }
      resetArmed = false; $("resetBtn").textContent = "Start over";
      var st = state.st;
      state = { st: st, step: 0, picked: [], weights: {}, weightsTouched: false, scale: "rank", answers: ["", "", ""], view: "index" };
      sortKey = "rank"; sortDir = 1;
      update();
    });
    var svg = $("map");
    svg.addEventListener("mousemove", function (e) { if (e.target.tagName === "path") showTip(e.target, e); });
    svg.addEventListener("mouseleave", hideTip);
    svg.addEventListener("click", function (e) { if (e.target.tagName === "path") showTip(e.target, e); });
    svg.addEventListener("focusin", function (e) { if (e.target.tagName === "path") showTip(e.target, null); });
    svg.addEventListener("focusout", hideTip);
  }

  Promise.all([
    fetch("data/districts.csv").then(function (r) { return r.text(); }),
    fetch("data/indicators.csv").then(function (r) { return r.text(); }),
    fetch("data/map.geojson").then(function (r) { return r.json(); }),
    fetch("data/food.csv").then(function (r) { return r.text(); })
  ]).then(function (x) {
    build(parseCSV(x[0]), parseCSV(x[1]), parseCSV(x[3]));
    FEATURES.MS = x[2].features.filter(function (f) { return f.properties.leaid.slice(0, 2) === "28"; });
    FEATURES.TN = x[2].features.filter(function (f) { return f.properties.leaid.slice(0, 2) === "47"; });
    load();
    wire();
    buildMap();
    update();
  }).catch(function (e) {
    document.querySelector("main").insertAdjacentHTML("afterbegin", "<div class=\"warn\"><p>The data files could not be loaded. Open this page from its web address, not from a file on your computer.</p></div>");
    console.error(e);
  });

  window.__mam = { results: results, reshare: reshare, state: function () { return state; }, data: DATA, LAW: LAW };
})();

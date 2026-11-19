(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Downloads: pick the data, the state and the file type.
  // Every file is built in the browser from the same data files the page uses.
  // ---------------------------------------------------------------------------
  var REPO = "https://github.com/jmfreder123/mam-dashboard";
  var ST_NAME = { MS: "Mississippi", TN: "Tennessee" };
  var M; // window.__mam, set when the data are ready

  function $(id) { return document.getElementById(id); }
  function picked(name) { var x = document.querySelector("input[name=" + name + "]:checked"); return x ? x.value : null; }
  function today() { return new Date().toISOString().slice(0, 10); }

  // ---------------------------------------------------------------------------
  // The datasets. Each column: name, label, type ("str" or "num").
  // A value is a string (as written in the data file), a number, or null.
  // ---------------------------------------------------------------------------
  function states(sel) { return sel === "both" ? ["MS", "TN"] : [sel]; }

  function unitText(d) { return d.unit === "%" ? " (%)" : d.unit === "$" ? " (2024 dollars)" : d.code === "gini" ? " (0 to 1)" : ""; }

  function indicatorsData(sel) {
    var head = Object.keys(M.raw.ind[0]).filter(function (k) { return k !== "foodkids_est" && k !== "foodkids_moe"; });
    head = head.concat(["foodkids_est", "foodkids_moe"]);
    var fixed = { state: "State", leaid: "Federal district ID (NCES LEA ID)", st_no: "State district number", name_census: "District name (Census)", district_type: "District type (Census)" };
    var cols = head.map(function (k) {
      if (fixed[k]) return { name: k, label: fixed[k], type: "str" };
      var code = k.replace(/_(est|moe)$/, ""), isMoe = /_moe$/.test(k), d = M.BY[code];
      var label;
      if (code === "kids617") label = isMoe ? "Margin of error (90%), children ages 6 to 17" : "Children ages 6 to 17 (count)";
      else if (code === "foodkids" && isMoe) label = "No margin of error published (USDA SRAM)";
      else label = isMoe ? "Margin of error (90%), " + d.label : d.label + unitText(d);
      return { name: k, label: label, type: "num" };
    });
    var keep = states(sel);
    var rows = M.raw.ind.filter(function (r) { return keep.indexOf(r.state) >= 0; }).map(function (r) {
      var o = {}; head.forEach(function (k) { o[k] = r[k] == null ? "" : r[k]; }); return o;
    });
    return {
      key: "indicators", title: "MAM district indicators", cols: cols, rows: rows,
      notes: [
        "Seventeen indicators are from the American Community Survey 2020-2024 5-year estimates, with margins of error at 90 percent. They describe everyone living in each district, not enrolled students.",
        "foodkids is from the USDA ERS SNAP-Authorized Retailer Access Map (July 2026 release, driving distance, stores as of June 2025, 2020 Census). It has no margin of error.",
        "Made by 31_dashboard_indicators.do and 33_dashboard_food.do. Sources, methods and file fingerprints are in the README."
      ]
    };
  }

  function fundingData(sel) {
    var label = {
      state: "State", leaid: "Federal district ID (NCES LEA ID)", st_no: "State district number", st_leaid: "State LEA ID (CCD)",
      name_census: "District name (Census)", name_state: "District name (state file)", name_ccd: "District name (CCD)",
      district_type: "District type (Census)", enroll_k12: "K-12 enrollment, 2024-25",
      base_pct: "Share of students the state counts now (%)", base_count: "Students the state counts now",
      base_measure: "Measure the state uses now", enroll_source: "Source of K-12 enrollment",
      ms_starred_cells: "Mississippi: enrollment cells under 10, counted as 0", cep_id: "Mississippi CEP list district ID",
      cep_name: "Mississippi CEP list district name"
    };
    var num = ["enroll_k12", "base_pct", "base_count", "ms_starred_cells"];
    var head = Object.keys(M.raw.dist[0]);
    var cols = head.map(function (k) { return { name: k, label: label[k] || k, type: num.indexOf(k) >= 0 ? "num" : "str" }; });
    cols = cols.concat([
      { name: "formula", label: "State funding formula", type: "str" },
      { name: "formula_year", label: "Formula year", type: "str" },
      { name: "base_amount", label: "Base amount per student, in law (dollars)", type: "num" },
      { name: "poverty_weight", label: "Poverty weight, in law (share of base)", type: "num" },
      { name: "concentration_weight", label: "Concentrated poverty weight, in law (share of base)", type: "num" },
      { name: "concentration_line", label: "Concentrated poverty line, share of enrollment", type: "num" }
    ]);
    var keep = states(sel);
    var rows = M.raw.dist.filter(function (r) { return keep.indexOf(r.state) >= 0; }).map(function (r) {
      var o = {}; head.forEach(function (k) { o[k] = r[k] == null ? "" : r[k]; });
      var L = M.LAW[r.state];
      o.formula = L.formula; o.formula_year = L.year; o.base_amount = L.base; o.poverty_weight = L.w;
      o.concentration_weight = L.cpW; o.concentration_line = L.cpLine;
      return o;
    });
    return {
      key: "funding_inputs", title: "MAM funding inputs", cols: cols, rows: rows,
      notes: [
        "Tennessee (TISA 2025-26): base $7,295, 25 percent weight for each economically disadvantaged student. The 5 percent concentrated poverty weight is set school by school and is not modeled, so its columns are 0 here.",
        "Mississippi (MSFF FY26): base $6,842.61, 30 percent weight for each low-income student, plus 10 percent for low-income students above 35 percent of enrollment. The FY26 base comes from George County School District's FY26 budget hearing and is not yet confirmed in an MDE document.",
        "Made by 30_dashboard_districts.do. Sources, methods and file fingerprints are in the README."
      ]
    };
  }

  function resultsData(sel) {
    var s = M.state(), w = M.weightsNow(), codes = s.picked.slice();
    var cols = [
      { name: "state", label: "State", type: "str" },
      { name: "leaid", label: "Federal district ID (NCES LEA ID)", type: "str" },
      { name: "district", label: "District name", type: "str" },
      { name: "enroll_k12", label: "K-12 enrollment, 2024-25", type: "num" },
      { name: "base_pct", label: "Share of students the state counts now (%)", type: "num" }
    ];
    codes.forEach(function (c) {
      var d = M.BY[c];
      cols.push({ name: "val_" + c, label: d.label + unitText(d), type: "num" });
      cols.push({ name: "sc_" + c, label: "Scaled: " + d.label, type: "num" });
      cols.push({ name: "w_" + c, label: "Your weight: " + d.label, type: "num" });
    });
    cols = cols.concat([
      { name: "scaling", label: "Scaling method (rank, minmax or z)", type: "str" },
      { name: "index", label: "Your index (weighted average of scaled values)", type: "num" },
      { name: "rank_now", label: "Rank by the share the state counts now (1 = highest)", type: "num" },
      { name: "rank_yours", label: "Rank by your index (1 = most need)", type: "num" },
      { name: "rank_move", label: "Places moved up (rank now minus your rank)", type: "num" },
      { name: "count_now", label: "Students the state counts now", type: "num" },
      { name: "count_yours", label: "Students counted after re-sharing by your index", type: "num" },
      { name: "dollars_now", label: "Poverty-weight dollars now", type: "num" },
      { name: "dollars_yours", label: "Poverty-weight dollars under your index", type: "num" },
      { name: "change", label: "Change in poverty-weight dollars", type: "num" },
      { name: "change_per_student", label: "Change per K-12 student (dollars)", type: "num" }
    ]);
    var rows = [];
    states(sel).forEach(function (st) {
      var res = M.resultsFor(st);
      res.rows.slice().sort(function (a, b) { return a.rank - b.rank; }).forEach(function (o) {
        var r = { state: st, leaid: o.r.leaid, district: o.r.name, enroll_k12: o.r.enroll, base_pct: o.r.basePct };
        codes.forEach(function (c) { r["val_" + c] = o.r.vals[c]; r["sc_" + c] = o.scaled[c]; r["w_" + c] = Number(w[c]) || 0; });
        r.scaling = s.scale; r.index = o.index; r.rank_now = o.curRank; r.rank_yours = o.rank; r.rank_move = o.curRank - o.rank;
        r.count_now = o.curCount; r.count_yours = o.newCount; r.dollars_now = o.curDollars; r.dollars_yours = o.newDollars;
        r.change = o.change; r.change_per_student = o.perStudent;
        rows.push(r);
      });
    });
    var spec = codes.map(function (c) { return M.BY[c].label + " " + (Number(w[c]) || 0); }).join(", ");
    return {
      key: "your_results", title: "MAM dashboard: your results", cols: cols, rows: rows,
      notes: [
        "Your choices: " + spec + ". Scaling: " + ({ rank: "ranks", minmax: "0 to 100", z: "z-scores" })[s.scale] + ".",
        "Each state is ranked on its own. The index is rounded to 9 decimals, and exact ties go to the district listed first alphabetically.",
        "Re-sharing: districts are ordered by your index, the state's actual district rates are handed out from highest to lowest in that order and multiplied by K-12 enrollment, and the counts are scaled to the state's actual total (no district above its enrollment). The weights in law are then applied.",
        "Median household income is flipped before scaling, so lower income counts as more need. The val_ columns show the values before flipping."
      ]
    };
  }

  // ---------------------------------------------------------------------------
  // Writers
  // ---------------------------------------------------------------------------
  var enc = new TextEncoder();
  function numOf(v) {
    if (v == null || v === "") return null;
    var x = typeof v === "number" ? v : Number(v);
    return isFinite(x) ? x : null;
  }
  function textOf(c, v) {
    if (c.type === "num") { if (typeof v === "string") return v; var x = numOf(v); return x == null ? "" : String(x); }
    return v == null ? "" : String(v);
  }

  function toCSV(ds) {
    function q(s) { return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    var lines = [ds.cols.map(function (c) { return q(c.name); }).join(",")];
    ds.rows.forEach(function (r) { lines.push(ds.cols.map(function (c) { return q(textOf(c, r[c.name])); }).join(",")); });
    return new Blob([lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
  }

  function toJSON(ds) {
    var out = {
      title: ds.title, source: REPO, downloaded: today(), notes: ds.notes,
      variables: ds.cols.map(function (c) { return { name: c.name, label: c.label, type: c.type === "num" ? "number" : "string" }; }),
      rows: ds.rows.map(function (r) {
        var o = {}; ds.cols.forEach(function (c) { o[c.name] = c.type === "num" ? numOf(r[c.name]) : (r[c.name] == null ? "" : String(r[c.name])); }); return o;
      })
    };
    return new Blob([JSON.stringify(out, null, 1)], { type: "application/json" });
  }

  // --- zip (stored, no compression), for .xlsx ---
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var out = [], central = [], off = 0;
    var d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      out.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, tm, true); c.setUint16(14, dt, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (s, b) { return s + b.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return out.concat(central, [new Uint8Array(e.buffer)]);
  }

  function xmlEsc(s) {
    return String(s).replace(/[^\x09\x0A\x0D\x20-퟿-�]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function colRef(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function sheetXML(table, bold) {
    var x = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'];
    table.forEach(function (row, ri) {
      var cells = row.map(function (v, ci) {
        var ref = colRef(ci) + (ri + 1), st = bold && ri === 0 ? ' s="1"' : "";
        if (v == null || v === "") return "";
        if (typeof v === "number") return '<c r="' + ref + '"' + st + '><v>' + v + "</v></c>";
        return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + "</t></is></c>";
      }).join("");
      x.push('<row r="' + (ri + 1) + '">' + cells + "</row>");
    });
    x.push("</sheetData></worksheet>");
    return x.join("");
  }
  function toXLSX(ds) {
    var data = [ds.cols.map(function (c) { return c.name; })];
    ds.rows.forEach(function (r) {
      data.push(ds.cols.map(function (c) { return c.type === "num" ? numOf(r[c.name]) : (r[c.name] == null ? "" : String(r[c.name])); }));
    });
    var vars = [["variable", "label", "type"]].concat(ds.cols.map(function (c) { return [c.name, c.label, c.type === "num" ? "number" : "text"]; }));
    var about = [[ds.title], ["Source: " + REPO], ["Downloaded: " + today()]].concat(ds.notes.map(function (n) { return [n]; }));
    var sheets = [["Data", data, true], ["Variables", vars, true], ["About", about, true]];
    var files = [
      { name: "[Content_Types].xml", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") + "</Types>" },
      { name: "_rels/.rels", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: "xl/workbook.xml", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map(function (s, i) { return '<sheet name="' + s[0] + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets></workbook>" },
      { name: "xl/_rels/workbook.xml.rels", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
        '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: "xl/styles.xml", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' }
    ];
    sheets.forEach(function (s, i) { files.push({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", text: sheetXML(s[1], s[2]) }); });
    return new Blob(zip(files), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  // --- Stata .dta, format 118 (Stata 14 and later) ---
  function toDTA(ds) {
    var chunks = [], pos = 0, map = [];
    function put(b) { chunks.push(b); pos += b.length; }
    function tag(s) { put(enc.encode(s)); }
    function u16(n) { var b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
    function u32(n) { var b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
    function u64(n) { var b = new Uint8Array(8); var v = new DataView(b.buffer); v.setUint32(0, n % 4294967296, true); v.setUint32(4, Math.floor(n / 4294967296), true); return b; }
    function fixed(s, n) { var b = new Uint8Array(n), e = enc.encode(s).slice(0, n - 1); b.set(e); return b; }
    function cut(s, chars) { var a = Array.from(String(s)); return a.length > chars ? a.slice(0, chars).join("") : String(s); }
    var K = ds.cols.length, N = ds.rows.length;
    var width = ds.cols.map(function (c) {
      if (c.type === "num") return 0;
      var w = 1;
      ds.rows.forEach(function (r) { var v = r[c.name]; if (v != null) w = Math.max(w, enc.encode(String(v)).length); });
      return Math.min(w, 2045);
    });
    var d = new Date(), MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    var ts = p2(d.getDate()) + " " + MON[d.getMonth()] + " " + d.getFullYear() + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
    var lab = enc.encode(cut(ds.title, 80));

    map[0] = pos; tag("<stata_dta><header><release>118</release><byteorder>LSF</byteorder><K>"); put(u16(K));
    tag("</K><N>"); put(u64(N)); tag("</N><label>"); put(u16(lab.length)); put(lab);
    tag("</label><timestamp>"); put(new Uint8Array([17])); tag(ts); tag("</timestamp></header>");
    map[1] = pos; tag("<map>"); var mapAt = chunks.length; for (var i = 0; i < 14; i++) put(new Uint8Array(8)); tag("</map>");
    map[2] = pos; tag("<variable_types>"); ds.cols.forEach(function (c, j) { put(u16(c.type === "num" ? 65526 : width[j])); }); tag("</variable_types>");
    map[3] = pos; tag("<varnames>"); ds.cols.forEach(function (c) { put(fixed(c.name, 129)); }); tag("</varnames>");
    map[4] = pos; tag("<sortlist>"); for (i = 0; i <= K; i++) put(u16(0)); tag("</sortlist>");
    map[5] = pos; tag("<formats>"); ds.cols.forEach(function (c, j) { put(fixed(c.type === "num" ? "%12.0g" : "%-" + width[j] + "s", 57)); }); tag("</formats>");
    map[6] = pos; tag("<value_label_names>"); ds.cols.forEach(function () { put(new Uint8Array(129)); }); tag("</value_label_names>");
    map[7] = pos; tag("<variable_labels>"); ds.cols.forEach(function (c) { put(fixed(cut(c.label, 80), 321)); }); tag("</variable_labels>");
    map[8] = pos; tag("<characteristics>");
    var notes = ["Source: " + REPO + ". Downloaded " + today() + "."].concat(ds.notes);
    function ch(name, text) { var t = enc.encode(text); tag("<ch>"); put(u32(129 + 129 + t.length + 1)); put(fixed("_dta", 129)); put(fixed(name, 129)); put(t); put(new Uint8Array(1)); tag("</ch>"); }
    ch("note0", String(notes.length));
    notes.forEach(function (n, j) { ch("note" + (j + 1), n); });
    tag("</characteristics>");
    map[9] = pos; tag("<data>");
    var rowLen = ds.cols.reduce(function (s, c, j) { return s + (c.type === "num" ? 8 : width[j]); }, 0);
    var buf = new Uint8Array(rowLen * N), dv = new DataView(buf.buffer), o = 0;
    ds.rows.forEach(function (r) {
      ds.cols.forEach(function (c, j) {
        if (c.type === "num") {
          var x = numOf(r[c.name]);
          if (x == null) { dv.setUint32(o, 0, true); dv.setUint32(o + 4, 0x7FE00000, true); } // Stata missing (.)
          else dv.setFloat64(o, x, true);
          o += 8;
        } else {
          var e = enc.encode(r[c.name] == null ? "" : String(r[c.name])).slice(0, width[j]);
          buf.set(e, o); o += width[j];
        }
      });
    });
    put(buf); tag("</data>");
    map[10] = pos; tag("<strls></strls>");
    map[11] = pos; tag("<value_labels></value_labels>");
    map[12] = pos; tag("</stata_dta>");
    map[13] = pos;
    for (i = 0; i < 14; i++) chunks[mapAt + i] = u64(map[i]);
    return new Blob(chunks, { type: "application/x-stata-dta" });
  }

  function mapGeoJSON(sel) {
    var keep = states(sel), pre = { MS: "28", TN: "47" };
    var fc = { type: "FeatureCollection", features: M.raw.map.features.filter(function (f) {
      return keep.some(function (s) { return f.properties.leaid.slice(0, 2) === pre[s]; });
    }) };
    return new Blob([JSON.stringify(fc)], { type: "application/geo+json" });
  }

  // ---------------------------------------------------------------------------
  // The panel
  // ---------------------------------------------------------------------------
  function render() {
    if (!M) return;
    var what = picked("dlWhat"), fmt = picked("dlFormat"), isMap = what === "map";
    document.querySelectorAll("input[name=dlFormat]").forEach(function (x) {
      var off = isMap ? x.value !== "json" : false;
      x.disabled = off; x.closest(".choice").classList.toggle("off", off);
    });
    if (isMap && fmt !== "json") { $("dl-json").checked = true; fmt = "json"; }
    $("dl-json-label").textContent = isMap ? "GeoJSON" : "JSON";
    var note = "", ok = true;
    if (what === "results") {
      var s = M.state();
      if (!M.ready()) { ok = false; note = "Pick your indicators and set weights that add up to 100 first. Your results use the choices in the steps above."; }
      else note = "Uses your current choices: " + s.picked.length + " indicators, scaled by " + ({ rank: "ranks", minmax: "0 to 100", z: "z-scores" })[s.scale] + ". Each state is ranked on its own.";
    } else if (isMap) note = "District boundaries come as GeoJSON only. They are simplified to about 200 meters.";
    else if (fmt === "dta") note = "Stata format 118, for Stata 14 or later. Variable labels and notes are included (type notes in Stata to see them).";
    else if (fmt === "xlsx") note = "The workbook has three sheets: the data, what each variable means, and notes on sources.";
    else if (fmt === "json") note = "Includes what each variable means and notes on sources.";
    else note = "Plain CSV. What each variable means is in the Excel, Stata and JSON files, and in the README.";
    $("dlNote").textContent = note;
    $("dlBtn").disabled = !ok;
  }

  function download() {
    var what = picked("dlWhat"), sel = picked("dlState"), fmt = picked("dlFormat");
    var stPart = sel === "both" ? "MS_TN" : sel, blob, name;
    if (what === "map") { blob = mapGeoJSON(sel); name = "mam_district_boundaries_" + stPart + ".geojson"; }
    else {
      var ds = what === "indicators" ? indicatorsData(sel) : what === "funding" ? fundingData(sel) : resultsData(sel);
      blob = fmt === "csv" ? toCSV(ds) : fmt === "xlsx" ? toXLSX(ds) : fmt === "dta" ? toDTA(ds) : toJSON(ds);
      name = "mam_" + ds.key + "_" + stPart + (what === "results" ? "_" + today() : "") + "." + fmt;
    }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    $("dlDone").textContent = "Downloaded " + name + ".";
  }

  document.addEventListener("mam:ready", function () {
    M = window.__mam;
    document.querySelectorAll("#data input").forEach(function (x) { x.addEventListener("change", function () { $("dlDone").textContent = ""; render(); }); });
    $("dlBtn").addEventListener("click", download);
    render();
  });
  document.addEventListener("mam:update", render);
  document.addEventListener("DOMContentLoaded", function () {
    $("dataBtn").addEventListener("click", function () {
      var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      $("data").scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      $("dataTitle").focus({ preventScroll: true });
    });
  });

  window.__mamDownload = { indicatorsData: indicatorsData, fundingData: fundingData, resultsData: resultsData, toCSV: toCSV, toJSON: toJSON, toXLSX: toXLSX, toDTA: toDTA };
})();

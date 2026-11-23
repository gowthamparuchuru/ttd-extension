(() => {
  const S = globalThis.SCHEMAS;
  const $ = (sel) => document.querySelector(sel);
  // Firefox: promise-based `browser`; Chrome MV3: `chrome` (promises too).
  const ext = globalThis.browser ?? globalThis.chrome;
  const store = ext.storage.local;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  const MAX_PILGRIMS = 6;
  const MAX_SRIVANI = 9;
  const MAX_FILE = 1024 * 1024;
  const TTD_HOSTS = ["ttdevasthanams.ap.gov.in", "tirupatibalaji.ap.gov.in"];
  const TTD_ORIGINS = TTD_HOSTS.map((h) => `https://${h}/*`);

  // ---------- toast ----------
  let toastTimer;
  const toast = (text, kind = "success") => {
    const el = $("#toast");
    el.textContent = text;
    el.className = `show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = ""), kind === "success" ? 2500 : 5000);
  };

  // ---------- validation hints ----------
  // Verhoeff checksum used by Aadhaar.
  const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
  const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
  const verhoeffOk = (num) => {
    let c = 0;
    const digits = num.split("").reverse().map(Number);
    for (let i = 0; i < digits.length; i++) c = VD[c][VP[i % 8][digits[i]]];
    return c === 0;
  };
  const CHECKS = {
    aadhaar: (v, data) => {
      const proof = data.idProof || data.idType || "Aadhaar Card";
      if (!v || !/aadhaar/i.test(proof)) return "";
      const d = v.replace(/\s/g, "");
      if (!/^\d{12}$/.test(d)) return "An Aadhaar number has 12 digits — please re-check.";
      if (!verhoeffOk(d)) return "This Aadhaar number looks mistyped (checksum fails).";
      return "";
    },
    srivaniName: (v) => {
      if (!v) return "";
      const clean = v.replace(/[^a-zA-Z ]+/g, " ").replace(/\s+/g, " ").trim();
      if (!clean) return "TTD accepts English letters only.";
      if (clean.length < 4) return "TTD needs 4+ letters — add a surname or initial.";
      return "";
    },
  };

  // ---------- generic schema form ----------
  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve({ name: file.name, type: file.type, data: r.result });
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const optPair = (o) => (Array.isArray(o) ? o : [o, o]);

  /**
   * Render `schema` into `form`. Returns { get(), set(data) }.
   * onChange(data) fires after every edit; actions: [{label, cls, onClick(data)}].
   */
  const buildForm = (form, schema, { onChange = null, actions = [] } = {}) => {
    let data = {};
    const rows = [];

    const defaults = () => {
      const d = {};
      for (const f of schema) if (f.key && f.default !== undefined) d[f.key] = f.default;
      return d;
    };

    const refresh = () => {
      for (const r of rows) {
        if (r.field.showIf) r.el.hidden = !r.field.showIf(data);
        if (r.warn) r.warn.textContent = r.field.check ? CHECKS[r.field.check](data[r.field.key] || "", data) : "";
      }
    };
    const changed = () => {
      refresh();
      onChange && onChange(data);
    };

    form.textContent = "";
    for (const f of schema) {
      if (f.type === "heading") {
        const h = document.createElement("h3");
        h.textContent = f.label;
        form.appendChild(h);
        rows.push({ field: f, el: h });
        continue;
      }
      const wrap = document.createElement("div");
      wrap.className = "field" + (f.wide || ["multi", "file", "bool"].includes(f.type) ? " wide" : "");
      const label = document.createElement("span");
      label.textContent = f.label;
      const row = { field: f, el: wrap };

      if (f.type === "bool") {
        const lab = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.addEventListener("change", () => {
          data[f.key] = box.checked;
          changed();
        });
        lab.append(box, " ", f.label);
        wrap.appendChild(lab);
        row.write = () => (box.checked = !!data[f.key]);
      } else if (f.type === "radio" || f.type === "multi") {
        wrap.appendChild(label);
        const box = document.createElement("div");
        box.className = "choices";
        const inputs = f.options.map((o) => {
          const [value, text] = optPair(o);
          const lab = document.createElement("label");
          const inp = document.createElement("input");
          inp.type = f.type === "radio" ? "radio" : "checkbox";
          inp.name = `${form.id}-${f.key}`;
          inp.value = value;
          inp.addEventListener("change", () => {
            if (f.type === "radio") data[f.key] = value;
            else data[f.key] = inputs.filter((i) => i.checked).map((i) => i.value);
            changed();
          });
          lab.append(inp, text);
          box.appendChild(lab);
          return inp;
        });
        wrap.appendChild(box);
        row.write = () =>
          inputs.forEach((i) => (i.checked = f.type === "radio" ? data[f.key] === i.value : (data[f.key] || []).includes(i.value)));
      } else if (f.type === "file") {
        wrap.appendChild(label);
        const line = document.createElement("div");
        line.className = "file-row";
        const nameEl = document.createElement("span");
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = f.accept || "";
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "small";
        clear.textContent = "✕";
        inp.addEventListener("change", async () => {
          const file = inp.files[0];
          if (!file) return;
          if (file.size > MAX_FILE) {
            toast("File is larger than 1 MB.", "error");
            inp.value = "";
            return;
          }
          data[f.key] = await readFile(file);
          row.write();
          changed();
        });
        clear.addEventListener("click", () => {
          delete data[f.key];
          row.write();
          changed();
        });
        line.append(nameEl, inp, clear);
        wrap.appendChild(line);
        row.write = () => {
          const has = !!data[f.key]?.data;
          nameEl.textContent = has ? `📎 ${data[f.key].name}` : "";
          inp.hidden = has;
          clear.hidden = !has;
          inp.value = "";
        };
      } else {
        wrap.appendChild(label);
        let inp;
        if (f.type === "select") {
          inp = document.createElement("select");
          const blank = document.createElement("option");
          blank.value = "";
          blank.textContent = "Select";
          inp.appendChild(blank);
          for (const o of f.options) {
            const [value, text] = optPair(o);
            const opt = document.createElement("option");
            opt.value = value;
            opt.textContent = text;
            inp.appendChild(opt);
          }
        } else {
          inp = document.createElement("input");
          inp.type = f.type === "csv" ? "text" : f.type;
          if (f.min !== undefined) inp.min = f.min;
          if (f.max !== undefined) inp.max = f.max;
          if (f.maxlength) inp.maxLength = f.maxlength;
          if (f.list) {
            const dl = document.createElement("datalist");
            dl.id = `${form.id}-${f.key}-list`;
            for (const v of f.list) {
              const o = document.createElement("option");
              o.value = v;
              dl.appendChild(o);
            }
            wrap.appendChild(dl);
            inp.setAttribute("list", dl.id);
          }
        }
        if (f.required) inp.required = true;
        const read = () => {
          const v = inp.value.trim();
          data[f.key] = f.type === "csv" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v;
          changed();
        };
        inp.addEventListener("input", read);
        inp.addEventListener("change", read);
        wrap.appendChild(inp);
        row.write = () => {
          const v = data[f.key];
          inp.value = v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v);
        };
        if (f.check) {
          row.warn = document.createElement("small");
          row.warn.className = "warn";
          wrap.appendChild(row.warn);
        }
      }
      form.appendChild(wrap);
      rows.push(row);
    }

    if (actions.length) {
      const bar = document.createElement("div");
      bar.className = "form-actions";
      for (const a of actions) {
        const b = document.createElement("button");
        b.type = a.submit ? "submit" : "button";
        b.textContent = a.label;
        if (a.cls) b.className = a.cls;
        if (!a.submit) b.addEventListener("click", () => a.onClick(data));
        bar.appendChild(b);
        a.el = b;
      }
      form.appendChild(bar);
      const submit = actions.find((a) => a.submit);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        submit && submit.onClick(data);
      });
    }

    const set = (d) => {
      data = { ...defaults(), ...(d || {}) };
      rows.forEach((r) => r.write && r.write());
      refresh();
    };
    set({});
    return { get: () => data, set, actions };
  };

  // ---------- messaging to the TTD tab ----------
  const activeTab = async () => (await ext.tabs.query({ active: true, currentWindow: true }))[0];
  const isTtd = (tab) => {
    try {
      const h = new URL(tab.url).hostname;
      return TTD_HOSTS.some((x) => h === x || h.endsWith("." + x));
    } catch {
      return false;
    }
  };

  const send = async (action, extra = {}) => {
    const tab = await activeTab();
    if (!tab || !isTtd(tab)) {
      toast("Open a TTD booking page (ttdevasthanams.ap.gov.in or tirupatibalaji.ap.gov.in) first.", "warn");
      return null;
    }
    try {
      const res = await ext.tabs.sendMessage(tab.id, { action, ...extra });
      if (res && action !== "PING") toast(res.message || (res.status === "success" ? "Done." : "Fill failed."), res.status === "success" ? res.kind || "success" : res.kind || "error");
      return res;
    } catch {
      toast("Refresh the TTD page (the extension was installed/updated after it opened).", "warn");
      return null;
    }
  };

  const updatePageStatus = async () => {
    const el = $("#page-status");
    const tab = await activeTab();
    if (!tab || !isTtd(tab)) return (el.textContent = "not on TTD");
    try {
      const res = await ext.tabs.sendMessage(tab.id, { action: "PING" });
      el.textContent = res.hasPilgrimForm || res.hasSrivaniForm ? "form detected" : "TTD page";
    } catch {
      el.textContent = "refresh page";
    }
  };

  // Firefox MV3 treats host access as opt-in; Chrome grants it at install (button stays hidden).
  const setupSiteAccess = async () => {
    const btn = $("#grant-access");
    const granted = await ext.permissions.contains({ origins: TTD_ORIGINS }).catch(() => true);
    btn.hidden = granted;
    btn.addEventListener("click", () => {
      // request() must be the first call in the click handler to count as a user gesture in Firefox.
      ext.permissions.request({ origins: TTD_ORIGINS }).then((ok) => {
        btn.hidden = ok;
        toast(ok ? "Access granted — reload the open TTD page." : "Access not granted; autofill can't run on TTD pages.", ok ? "success" : "warn");
      });
    });
  };

  // ---------- list editor (pilgrims / srivani / sevaks) ----------
  const listEditor = ({ storageKey, max, listEl, countEl, details, titleEl, form, schema, noun, describe, nameOf, fillAction }) => {
    let items = [];
    let editing = null;

    const save = () => store.set({ [storageKey]: items });

    const reset = () => {
      editing = null;
      editor.set({});
      titleEl.textContent = `➕ Add ${noun}`;
      editor.actions[0].el.textContent = `Add ${noun}`;
    };

    const render = () => {
      listEl.textContent = "";
      if (countEl) countEl.textContent = max ? `(${items.length}/${max})` : `(${items.length})`;
      if (!items.length) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = `No ${noun}s yet — add one below.`;
        listEl.appendChild(li);
        return;
      }
      items.forEach((it, i) => {
        const li = document.createElement("li");
        const info = document.createElement("div");
        info.className = "info";
        const n = document.createElement("div");
        n.className = "name";
        n.textContent = `${i + 1}. ${nameOf(it) || "(unnamed)"}`;
        const m = document.createElement("div");
        m.className = "meta";
        m.textContent = describe(it);
        info.append(n, m);
        li.appendChild(info);
        const btn = (label, title, fn) => {
          const b = document.createElement("button");
          b.className = "small";
          b.textContent = label;
          b.title = title;
          b.addEventListener("click", fn);
          li.appendChild(b);
        };
        if (fillAction) btn("⚡", "Fill this one", () => fillAction(it, i));
        btn("↑", "Move up", () => {
          if (!i) return;
          [items[i - 1], items[i]] = [items[i], items[i - 1]];
          save();
          render();
        });
        btn("✎", "Edit", () => {
          editing = it.id;
          editor.set(it);
          titleEl.textContent = `✎ Edit ${noun}`;
          editor.actions[0].el.textContent = `Update ${noun}`;
          details.open = true;
          details.scrollIntoView({ behavior: "smooth" });
        });
        btn("🗑", "Delete", () => {
          if (!confirm(`Delete ${nameOf(it) || noun}?`)) return;
          items = items.filter((x) => x !== it);
          if (editing === it.id) reset();
          save();
          render();
        });
        listEl.appendChild(li);
      });
    };

    const editor = buildForm(form, schema, {
      actions: [
        {
          label: `Add ${noun}`,
          cls: "primary",
          submit: true,
          onClick: (d) => {
            const missing = schema.filter((f) => f.required && (!f.showIf || f.showIf(d)) && !String(d[f.key] || "").trim());
            if (missing.length) return toast(`Missing: ${missing.map((f) => f.label.replace(/\s*\*.*$/, "")).join(", ")}`, "error");
            if (editing) {
              items = items.map((x) => (x.id === editing ? { ...d, id: editing } : x));
              toast(`${noun[0].toUpperCase() + noun.slice(1)} updated.`);
            } else {
              if (max && items.length >= max) return toast(`Maximum ${max} ${noun}s.`, "error");
              items.push({ ...d, id: uid() });
              toast(`${noun[0].toUpperCase() + noun.slice(1)} added.`);
            }
            save();
            render();
            reset();
          },
        },
        { label: "Clear", onClick: () => reset() },
      ],
    });

    return {
      load: (list) => {
        items = Array.isArray(list) ? list : [];
        render();
        reset();
      },
    };
  };

  // ---------- autosaved single-object forms ----------
  const autosaveForm = (form, schema, read, write) => {
    let timer;
    const f = buildForm(form, schema, {
      onChange: (d) => {
        clearTimeout(timer);
        timer = setTimeout(() => write(d), 250);
      },
    });
    f.set(read);
    return f;
  };

  // ---------- wire up ----------
  const init = async () => {
    const d = await store.get(null);

    document.querySelectorAll("#tabs button").forEach((b) =>
      b.addEventListener("click", () => {
        document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("active", x === b));
        document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === `tab-${b.dataset.tab}`));
        store.set({ popupTab: b.dataset.tab });
      }),
    );
    if (d.popupTab) document.querySelector(`#tabs button[data-tab="${d.popupTab}"]`)?.click();

    const pilgrims = listEditor({
      storageKey: "pilgrims",
      max: MAX_PILGRIMS,
      listEl: $("#pilgrim-list"),
      countEl: $("#pilgrim-count"),
      details: $("#pilgrim-editor"),
      titleEl: $("#pilgrim-editor-title"),
      form: $("#pilgrim-form"),
      schema: S.pilgrim,
      noun: "pilgrim",
      nameOf: (p) => p.name,
      describe: (p) => `${p.age || "?"} yrs • ${p.gender || "?"} • ${p.idProof || "?"} ${p.idNumber ? "••" + String(p.idNumber).slice(-4) : ""}`,
      fillAction: (p) => send("FILL_PILGRIM", { id: p.id }),
    });
    pilgrims.load(d.pilgrims);

    const srivani = listEditor({
      storageKey: "srivaniPeople",
      max: MAX_SRIVANI,
      listEl: $("#srivani-list"),
      countEl: $("#srivani-count"),
      details: $("#srivani-editor"),
      titleEl: $("#srivani-editor-title"),
      form: $("#srivani-form"),
      schema: S.srivaniMember,
      noun: "member",
      nameOf: (p) => p.name,
      describe: (p) => `${p.age || "?"} yrs • ${p.gender || "?"} • ${p.idProof || "?"}`,
    });
    srivani.load(d.srivaniPeople);

    const sevaks = listEditor({
      storageKey: "sevaks",
      listEl: $("#sevak-list"),
      details: $("#sevak-editor"),
      titleEl: $("#sevak-editor-title"),
      form: $("#sevak-form"),
      schema: S.sevak,
      noun: "sevak profile",
      nameOf: (s) => [s.sevakName || s.spvrName, s.surName].filter(Boolean).join(" "),
      describe: (s) => `${s.age ? s.age + " yrs • " : ""}${s.mobileNo || "no mobile"} • ${s.idType || "Aadhaar Card"}`,
      fillAction: (_s, i) => send("FILL_SEVA", { index: i }),
    });
    sevaks.load(d.sevaks);

    autosaveForm($("#contact-form"), S.contact, d.contact || {}, (v) => store.set({ contact: v }));

    const advKeys = S.srivaniAdvance.map((f) => f.key);
    autosaveForm(
      $("#srivani-advance-form"),
      S.srivaniAdvance,
      Object.fromEntries(advKeys.filter((k) => d[k] !== undefined).map((k) => [k, d[k]])),
      (v) => store.set(Object.fromEntries(advKeys.map((k) => [k, v[k] ?? ""]))),
    );

    const setKeys = S.settings.map((f) => f.key);
    autosaveForm(
      $("#settings-form"),
      S.settings,
      Object.fromEntries(setKeys.filter((k) => d[k] !== undefined).map((k) => [k, d[k]])),
      (v) => store.set(Object.fromEntries(setKeys.map((k) => [k, v[k]]))),
    );

    $("#fill-pilgrims").addEventListener("click", () => send("FILL_PILGRIMS", { continueAfterFill: false }));
    $("#fill-pilgrims-continue").addEventListener("click", () => send("FILL_PILGRIMS", { continueAfterFill: true }));
    $("#fill-contact").addEventListener("click", () => send("FILL_CONTACT"));
    $("#fill-srivani").addEventListener("click", () => send("FILL_SRIVANI"));

    $("#export").addEventListener("click", async () => {
      const all = await store.get(null);
      delete all.popupTab;
      const url = URL.createObjectURL(new Blob([JSON.stringify(all, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `ttd-autofill-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    $("#import").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const obj = JSON.parse(await file.text());
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("not an object");
        await store.set(obj);
        location.reload();
      } catch {
        toast("Invalid backup file.", "error");
      }
    });
    $("#clear-all").addEventListener("click", async () => {
      if (!confirm("Delete ALL saved pilgrims, members, sevaks and settings?")) return;
      await store.clear();
      location.reload();
    });

    updatePageStatus();
    setupSiteAccess();
  };

  init();
})();

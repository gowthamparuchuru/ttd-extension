// Shared helpers for the isolated-world content scripts.
// All scripts in manifest order share one isolated world; they communicate via globalThis.TTDPA.
(() => {
  const T = (globalThis.TTDPA = globalThis.TTDPA || {});

  // ---------- timing / visibility ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.closest(".ng-hide, [hidden]")) return false;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };

  const isClickable = (el) => {
    if (!isVisible(el) || el.disabled || el.getAttribute("aria-disabled") === "true" || /\bdisabled\b/i.test(String(el.className || ""))) return false;
    try {
      if (getComputedStyle(el).pointerEvents === "none") return false;
    } catch {}
    return true;
  };

  const waitFor = async (probe, tries = 20, interval = 150) => {
    for (let i = 0; i < tries; i++) {
      const v = probe();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  };

  // Resolve once the subtree stops mutating for `quiet` ms (or after `timeout`).
  const settle = (root, { quiet = 350, timeout = 2500 } = {}) =>
    new Promise((resolve) => {
      if (!root || typeof MutationObserver !== "function") return resolve();
      let done = false;
      let quietTimer;
      const finish = () => {
        if (done) return;
        done = true;
        obs.disconnect();
        clearTimeout(quietTimer);
        resolve();
      };
      const obs = new MutationObserver(() => {
        clearTimeout(quietTimer);
        quietTimer = setTimeout(finish, quiet);
      });
      obs.observe(root, { childList: true, subtree: true });
      quietTimer = setTimeout(finish, quiet);
      setTimeout(finish, timeout);
    });

  // ---------- text normalisation & fuzzy matching ----------
  const norm = (s) => (s == null ? "" : String(s).toLowerCase().trim().replace(/\s+/g, " "));

  const words = (s) =>
    norm(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['\u2018\u2019`]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/^the /, "")
      .split(" ")
      .filter(Boolean);

  const compact = (s) => words(s).join("");

  const editDistance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diag = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const up = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = up;
      }
    }
    return row[b.length];
  };

  const STOP_WORDS = new Set(["of", "the", "and"]);

  /**
   * Pick the option label that best represents `wanted`.
   * Order: exact (incl. aliases) → word-prefix → acronym → small edit distance.
   * Returns the original label or null.
   */
  const bestOption = (wanted, labels, { aliases = [], exactOnly = false } = {}) => {
    const key = compact(wanted);
    if (!key) return null;
    const entries = (labels || [])
      .map((label) => {
        const w = words(label);
        return { label, words: w, key: w.join("") };
      })
      .filter((e) => e.key);
    const group = aliases.find((g) => g.includes(key));
    const candidates = group ? [key, ...group.filter((k) => k !== key)] : [key];

    for (const c of candidates) {
      const hit = entries.find((e) => e.key === c);
      if (hit) return hit.label;
    }
    if (exactOnly) return null;

    const startsWithWords = (entry, c) => {
      let acc = "";
      for (const w of entry.words) {
        acc += w;
        if (acc === c) return true;
        if (acc.length >= c.length) return false;
      }
      return false;
    };
    for (const c of candidates) {
      const hits = entries.filter((e) => startsWithWords(e, c)).sort((a, b) => a.key.length - b.key.length);
      if (hits[0]) return hits[0].label;
    }
    for (const c of candidates) {
      if (c.length < 2 || c.length > 6) continue;
      const hit = entries.find(
        (e) =>
          e.words.length > 1 &&
          e.words
            .filter((w) => !STOP_WORDS.has(w))
            .map((w) => w[0])
            .join("") === c,
      );
      if (hit) return hit.label;
    }
    if (key.length >= 5) {
      const limit = key.length >= 8 ? 2 : 1;
      const ranked = entries
        .map((e) => ({ e, d: editDistance(key, e.key) }))
        .filter((x) => x.d <= limit)
        .sort((a, b) => a.d - b.d);
      if (ranked.length && (ranked.length === 1 || ranked[1].d > ranked[0].d)) return ranked[0].e.label;
    }
    return null;
  };

  const COUNTRY_ALIASES = [
    ["unitedstates", "unitedstatesofamerica", "usa", "us", "america", "unitedstatesamerica"],
    ["unitedkingdom", "uk", "greatbritain", "britain", "gb", "england", "scotland", "wales", "northernireland"],
    ["unitedarabemirates", "uae", "emirates", "dubai", "abudhabi"],
    ["southkorea", "korea", "republicofkorea", "korearepublicof", "koreasouth"],
    ["russia", "russianfederation"],
    ["netherlands", "holland"],
    ["newzealand", "nz"],
    ["saudiarabia", "ksa"],
    ["hongkong", "hk", "hongkongsar"],
    ["czechrepublic", "czechia"],
    ["myanmar", "burma"],
    ["srilanka", "ceylon"],
    ["ivorycoast", "cotedivoire"],
    ["tanzania", "unitedrepublicoftanzania", "tanzaniaunitedrepublicof"],
    ["vietnam", "vietnamsocialistrepublicof"],
    ["iran", "islamicrepublicofiran", "iranislamicrepublicof"],
    ["laos", "laopeoplesdemocraticrepublic"],
    ["syria", "syrianarabrepublic"],
    ["northmacedonia", "macedonia"],
    ["turkey", "turkiye"],
    ["eswatini", "swaziland"],
  ];

  const STATE_ALIASES = [
    ["andamanandnicobarislands", "andamanandnicobar", "andamannicobar", "andamannicobarislands", "andaman"],
    ["andhrapradesh", "andhra", "ap"],
    ["arunachalpradesh", "arunachal"],
    ["chhattisgarh", "chattisgarh", "chhatisgarh", "cg"],
    ["dadraandnagarhaveli", "dadranagarhaveli", "dadra", "dnh"],
    ["damananddiu", "damandiu", "daman"],
    ["delhi", "newdelhi", "nctdelhi", "nctofdelhi", "nationalcapitalterritoryofdelhi", "dl"],
    ["himachalpradesh", "himachal", "hp"],
    ["jammuandkashmir", "jammukashmir", "jammu", "kashmir", "jk"],
    ["odisha", "orissa", "od"],
    ["puducherry", "pondicherry", "py"],
    ["tamilnadu", "tn"],
    ["telangana", "telengana", "ts", "tg"],
    ["uttarpradesh", "up"],
    ["uttarakhand", "uttaranchal", "uttrakhand", "uk"],
    ["westbengal", "bengal", "wb"],
  ];

  // Firefox exposes promise-based `browser`; Chrome MV3 `chrome` also returns promises.
  const ext = globalThis.browser ?? globalThis.chrome;

  // ---------- MAIN-world bridge client ----------
  const CHANNEL = "TTDPA_BRIDGE";
  const TOKEN_ATTR = "data-ttdpa-target";

  const bridge = (() => {
    let ready = false;
    let diag = null;
    let seq = 0;
    let pendingEnsure = null;
    const waiting = new Map();

    window.addEventListener("message", (event) => {
      const msg = event.data;
      // No event.source check: Firefox content scripts see the page window through an Xray wrapper,
      // so identity comparison is unreliable. Replies are only honoured for ids we issued.
      if (!msg || typeof msg !== "object" || !(CHANNEL in msg)) return;
      if (msg[CHANNEL] === "ready") {
        ready = true;
        diag = msg.diag || diag;
        return;
      }
      if (msg[CHANNEL] !== "res") return;
      const w = waiting.get(msg.id);
      if (!w) return;
      waiting.delete(msg.id);
      clearTimeout(w.timer);
      w.resolve(msg);
    });

    const request = (op, payload = {}, timeout = 1200) =>
      new Promise((resolve) => {
        const id = `ttdpa${++seq}`;
        const timer = setTimeout(() => {
          waiting.delete(id);
          resolve(null);
        }, timeout);
        waiting.set(id, { resolve, timer });
        window.postMessage({ [CHANNEL]: "req", id, op, ...payload }, "*");
      });

    // Ask the bridge to act on `el`. Resolves to the bridge reply or null.
    const call = async (op, el, payload = {}, timeout) => {
      if (!ready || !el) return null;
      const token = `ttdpa${++seq}`;
      try {
        el.setAttribute(TOKEN_ATTR, token);
      } catch {
        return null;
      }
      const res = await request(op, { token, ...payload }, timeout);
      if (!res && el.getAttribute(TOKEN_ATTR) === token) el.removeAttribute(TOKEN_ATTR);
      return res && res.ok !== false ? res : null;
    };

    const ensure = () => {
      if (ready) return Promise.resolve(true);
      if (!pendingEnsure)
        pendingEnsure = (async () => {
          for (let i = 0; i < 3 && !ready; i++) {
            const res = await request("ping", {}, 250);
            if (res && res.ok) {
              ready = true;
              diag = res.diag || diag;
            } else await sleep(250);
          }
          pendingEnsure = null;
          return ready;
        })();
      return pendingEnsure;
    };

    return {
      call,
      ensure,
      get ready() {
        return ready;
      },
      get diag() {
        return diag;
      },
    };
  })();

  // ---------- element interaction ----------
  const fireInputEvents = (el, { blur = true } = {}) => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    if (blur) el.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  const nativeSetValue = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  };

  /** Write a value through the page bridge (trusted typing) or fall back to native setter + events. */
  const setValue = async (el, value, { blur = true } = {}) => {
    if (!el) return false;
    const v = value == null ? "" : String(value);
    const res = await bridge.call("setValue", el, { value: v, blur });
    if (!res) {
      nativeSetValue(el, v);
      fireInputEvents(el, { blur });
    }
    return (el.value || "") === v;
  };

  /** Plain set + input/change (used on the Angular portal where typing is not needed). */
  const setPlain = (el, value, { blur = false } = {}) => {
    if (!el) return;
    nativeSetValue(el, value);
    fireInputEvents(el, { blur });
  };

  // Firefox rejects the content-script `window` as MouseEventInit.view; retry without it.
  const makeEvent = (Ctor, type, init) => {
    try {
      return new Ctor(type, init);
    } catch {
      const { view, ...rest } = init;
      try {
        return new Ctor(type, rest);
      } catch {
        return null;
      }
    }
  };

  const syntheticClick = (el) => {
    const r = el.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    const PE = typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
    for (const [Ctor, type] of [
      [PE, "pointerdown"],
      [MouseEvent, "mousedown"],
      [PE, "pointerup"],
      [MouseEvent, "mouseup"],
    ]) {
      const evt = makeEvent(Ctor, type, Ctor === PE ? { ...init, pointerId: 1 } : init);
      if (evt) el.dispatchEvent(evt);
    }
    el.click();
  };

  /** Click via the page bridge (React onClick when guarded) else synthetic pointer sequence. */
  const click = async (el, { guarded = true } = {}) => {
    if (!el) return false;
    const res = await bridge.call("click", el, guarded ? { guarded: true } : {});
    if (res && res.clicked) return true;
    try {
      el.focus({ preventScroll: true });
    } catch {}
    syntheticClick(el);
    return true;
  };

  /** Scroll + full pointer sequence click with settle delays (Angular widgets). */
  const physicalClick = async (el) => {
    if (!el) return false;
    el.scrollIntoView?.({ block: "center", inline: "center" });
    await sleep(60);
    syntheticClick(el);
    await sleep(120);
    return true;
  };

  // ---------- React custom dropdown (ttdevasthanams portal) ----------
  const DROPDOWN_ITEMS = '[class*="floatingDropdown_listItem"], [class*="dropdown_scroll"] li, ul[style*="list-style-type: none"] li';

  const quoteNorm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[\u0027\u2018\u2019\u0060]/g, "'")
      .replace(/[\u0022\u201C\u201D]/g, '"')
      .replace(/\s+/g, " ")
      .trim();

  /**
   * Open a custom dropdown bound to `input` and click the option matching `wanted`.
   * `pick(labels, opts)` may override matching (fuzzy/aliases). Returns true when the input shows the choice.
   */
  const chooseFromDropdown = async (input, wanted, { pick = null, scope = document } = {}) => {
    if (!input || !wanted) return false;
    const current = (input.value || "").trim();
    if (current && (pick ? pick([current], { exactOnly: true }) !== null : quoteNorm(current) === quoteNorm(wanted))) return true;

    await click(input, { guarded: true });
    await sleep(20);

    for (let attempt = 0; attempt < 25; attempt++) {
      await sleep(20);
      const items = Array.from(scope.querySelectorAll(DROPDOWN_ITEMS));
      if (!items.length) continue;
      const text = (li) => (li.innerText || li.textContent || "").trim();
      let choice;
      if (pick) {
        const label = pick(items.map(text));
        choice = label === null ? null : items.find((li) => text(li) === label);
      } else {
        choice = items.find((li) => quoteNorm(text(li)) === quoteNorm(wanted));
      }
      if (!choice) continue;

      const label = text(choice);
      const holds = () => (pick ? quoteNorm(input.value) === quoteNorm(label) : !!(input.value || "").trim());
      choice.scrollIntoView?.({ block: "nearest" });
      await click(choice, { guarded: true });
      for (let i = 0; i < 10 && !holds(); i++) await sleep(15);
      if (!holds()) {
        const wrote = await bridge.call("setValue", input, { value: label });
        await bridge.call("announce", input, { value: label });
        if (!wrote) {
          nativeSetValue(input, label);
          fireInputEvents(input, { blur: false });
        }
        await sleep(20);
      }
      try {
        input.blur();
      } catch {}
      document.body.click();
      await sleep(40);
      if (holds()) return true;
    }
    document.body.click();
    return false;
  };

  const looksLikeDropdown = (input) =>
    !!input &&
    (input.readOnly ||
      input.getAttribute("role") === "combobox" ||
      input.hasAttribute("aria-haspopup") ||
      /dropdown/i.test(String(input.className || "")) ||
      /dropdown/i.test(String(input.parentElement?.className || "")) ||
      !!input.parentElement?.querySelector('img[alt="dropdown icon"]'));

  /** Dropdown when it looks like one (with fuzzy+alias matching), plain text otherwise. */
  const fillSmart = async (input, value, aliases = []) => {
    if (!input || !value) return false;
    if (!looksLikeDropdown(input)) return setValue(input, value);
    const ok = await chooseFromDropdown(input, value, { pick: (labels, o = {}) => bestOption(value, labels, { aliases, ...o }) });
    document.body.click();
    await sleep(50);
    if (!ok && !input.readOnly) return setValue(input, value);
    return ok;
  };

  // ---------- files ----------
  const dataUrlToFile = ({ data, name, type }) => {
    const bin = atob(data.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type });
  };

  /** Prefer building the File in the page world (no cross-compartment objects); fall back to local. */
  const attachFile = async (input, file) => {
    if (!input || !file || !file.data) return false;
    const res = await bridge.call("attachFile", input, { file: { name: file.name, type: file.type, data: file.data } }, 3000);
    if (res && res.attached) return true;
    try {
      const dt = new DataTransfer();
      dt.items.add(dataUrlToFile(file));
      input.files = dt.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  };

  // ---------- toast ----------
  const toast = (message, kind = "success") => {
    const id = "ttdpa-toast";
    document.getElementById(id)?.remove();
    const el = document.createElement("div");
    el.id = id;
    el.textContent = message;
    const bg = kind === "error" ? "#DC2626" : kind === "warn" ? "#D97706" : "#16A34A";
    el.style.cssText =
      `position:fixed;bottom:96px;right:22px;z-index:2147483647;background:${bg};color:#fff;` +
      "font:600 13px/1.4 system-ui,-apple-system,sans-serif;padding:11px 16px;border-radius:12px;max-width:320px;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.3)";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), kind === "warn" ? 7000 : 4000);
  };

  // ---------- site detection ----------
  const onHost = (h) => location.hostname === h || location.hostname.endsWith("." + h);
  const isSrivaniSite = () => onHost("tirupatibalaji.ap.gov.in");
  const isPortalSite = () => onHost("ttdevasthanams.ap.gov.in");

  Object.assign(T, {
    ext,
    sleep,
    isVisible,
    isClickable,
    waitFor,
    settle,
    norm,
    compact,
    bestOption,
    COUNTRY_ALIASES,
    STATE_ALIASES,
    bridge,
    nativeSetValue,
    fireInputEvents,
    setValue,
    setPlain,
    click,
    physicalClick,
    chooseFromDropdown,
    looksLikeDropdown,
    fillSmart,
    attachFile,
    toast,
    isSrivaniSite,
    isPortalSite,
  });
})();

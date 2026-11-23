// Entry point: popup message router, floating fill button and Alt+A / Alt+S shortcuts.
(() => {
  const T = globalThis.TTDPA;
  const { toast, isSrivaniSite, ext } = T;

  const STORAGE_KEYS = [
    "pilgrims",
    "contact",
    "srivaniPeople",
    "srivaniAdvance",
    "srivaniDarshanDate",
    "srivaniLaddus",
    "srivaniIncludeAccommodation",
    "srivaniAccommodationDate",
    "srivaniAccommodationTimeSlot",
    "sevaks",
    "sevaClickSaveAndAdd",
    "defaultFillAction",
  ];
  const load = () => ext.storage.local.get(STORAGE_KEYS);

  const contextLost = (err) => !ext.runtime?.id || /extension context invalidated/i.test(String(err?.message || err));
  const bridgeHint = () => (T.bridge.ready ? "" : " (page bridge not loaded — refresh the TTD page if fields don't stick)");

  let busy = false;
  const exclusive = async (fn) => {
    if (busy) return { status: "error", message: "A fill is already running." };
    busy = true;
    document.getElementById(FAB_ID)?.classList.add("ttdpa-busy");
    try {
      await T.bridge.ensure();
      return await fn();
    } catch (err) {
      if (contextLost(err)) {
        removeFab();
        return { status: "error", message: "Extension was reloaded — refresh this TTD page." };
      }
      return { status: "error", message: String(err?.message || err) };
    } finally {
      busy = false;
      document.getElementById(FAB_ID)?.classList.remove("ttdpa-busy");
    }
  };

  const describePassport = (rejected) =>
    (rejected || [])
      .filter((r) => r?.fields?.length)
      .map((r) => (r.name ? `${r.name}’s ` : "") + r.fields.join(", "))
      .join("; ");

  // ---------- actions ----------
  const fillPilgrims = (continueAfterFill) =>
    exclusive(async () => {
      const data = await load();
      const pilgrims = data.pilgrims || [];
      if (!pilgrims.length) return { status: "error", message: "No pilgrims saved — open the extension to add them.", kind: "warn" };
      if (!T.pilgrim.hasPilgrimForm()) return { status: "error", message: "Open a TTD pilgrim details form first.", kind: "warn" };
      const res = await T.pilgrim.fillAll(pilgrims, data.contact || {});
      if (res.status !== "success") return res;
      const head = `Filled ${res.filled} pilgrim${res.filled === 1 ? "" : "s"}${res.skipped ? ` (${res.skipped} more than the form has rows)` : ""}`;
      if (res.passportPending > 0) {
        const detail = describePassport(res.rejected);
        return {
          ...res,
          kind: "warn",
          message: detail
            ? `${head}. TTD did not accept ${detail} — fix it in the passport/visa form and press Submit.`
            : `${head}. A passport/visa form is still open — check it and press Submit.`,
        };
      }
      if (!continueAfterFill) return { ...res, message: head + "." + bridgeHint() };
      const pressed = await T.pilgrim.pressContinue();
      return pressed
        ? { ...res, message: head + ". Continuing…", continued: true }
        : { ...res, kind: "warn", message: head + ", but Continue is unavailable. Check the form and continue manually." };
    });

  const fillOnePilgrim = (id) =>
    exclusive(async () => {
      const data = await load();
      const p = (data.pilgrims || []).find((x) => x.id === id);
      if (!p) return { status: "error", message: "Pilgrim not found." };
      if (!T.pilgrim.hasPilgrimForm()) return { status: "error", message: "Open a TTD pilgrim details form first.", kind: "warn" };
      const res = await T.pilgrim.fillOne(p, data.contact || {});
      return res.passportPending
        ? { ...res, kind: "warn", message: `Filled ${p.name}. A passport/visa form is still open — check it and press Submit.` }
        : { ...res, message: `Filled ${p.name}.` };
    });

  const fillContact = () =>
    exclusive(async () => {
      const data = await load();
      await T.pilgrim.fillContact(data.contact || {});
      return { status: "success", message: "Contact details filled." };
    });

  const fillSrivani = () =>
    exclusive(async () => {
      const d = await load();
      const members = d.srivaniPeople || [];
      if (!members.length) return { status: "error", message: "No Srivani members saved — open the extension to add them.", kind: "warn" };
      if (!T.srivani.hasForm()) return { status: "error", message: "Open the TTD Srivani booking form first.", kind: "warn" };
      const adv = !!d.srivaniAdvance;
      const res = await T.srivani.fill({
        members,
        darshanDate: adv ? d.srivaniDarshanDate : "",
        extraLaddus: adv ? d.srivaniLaddus : "",
        includeAccommodation: adv && !!d.srivaniIncludeAccommodation,
        accommodationDate: adv && d.srivaniIncludeAccommodation ? d.srivaniAccommodationDate : "",
        accommodationTimeSlot: adv && d.srivaniIncludeAccommodation ? d.srivaniAccommodationTimeSlot : "",
      });
      if (res.status !== "success") return res;
      const sum = T.srivani.summarize(res, adv && (d.srivaniDarshanDate || d.srivaniLaddus));
      return { ...res, kind: sum.kind, message: sum.text };
    });

  const fillSeva = (index) =>
    exclusive(async () => {
      const d = await load();
      const sevak = (d.sevaks || [])[index];
      if (!sevak) return { status: "error", message: "Sevak profile not found." };
      await T.seva.fillSevak({ ...sevak, memberIndex: index, clickSaveAndAdd: d.sevaClickSaveAndAdd !== false });
      return { status: "success", message: `Filled ${sevak.sevakName || sevak.spvrName || "sevak"}.` };
    });

  const show = (res) => {
    if (!res) return;
    const kind = res.status !== "success" ? res.kind || "error" : res.kind || "success";
    toast(res.message || (res.status === "success" ? "Done." : "Could not fill this page."), kind);
  };

  // ---------- popup messages ----------
  ext.runtime.onMessage.addListener((msg, _sender, reply) => {
    const handlers = {
      PING: async () => ({
        status: "success",
        site: isSrivaniSite() ? "srivani" : "portal",
        hasPilgrimForm: T.pilgrim.hasPilgrimForm(),
        hasSrivaniForm: T.srivani.hasForm(),
        bridge: T.bridge.ready,
      }),
      FILL_PILGRIMS: () => fillPilgrims(!!msg.continueAfterFill),
      FILL_PILGRIM: () => fillOnePilgrim(msg.id),
      FILL_CONTACT: fillContact,
      FILL_SRIVANI: fillSrivani,
      FILL_SEVA: () => fillSeva(msg.index),
    };
    const h = handlers[msg?.action];
    if (!h) return false;
    h().then((res) => {
      if (msg.action !== "PING") show(res);
      reply(res);
    });
    return true;
  });

  // ---------- floating button ----------
  const FAB_ID = "ttdpa-fab";
  const WRAP_ID = "ttdpa-fab-wrap";
  const STYLE_ID = "ttdpa-fab-style";
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || "");
  const ALT = IS_MAC ? "⌥" : "Alt";

  const runFromPage = async (continueAfterFill) => {
    if (isSrivaniSite()) return show(await fillSrivani());
    const { defaultFillAction } = await ext.storage.local.get("defaultFillAction");
    const cont = continueAfterFill ?? defaultFillAction === "continue";
    show(await fillPilgrims(cont));
  };

  const hasForm = () => (isSrivaniSite() ? T.srivani.hasForm() : T.pilgrim.hasPilgrimForm());

  const removeFab = () => {
    document.getElementById(WRAP_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
  };

  const injectStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${WRAP_ID}{position:fixed;right:22px;bottom:22px;z-index:2147483646;font-family:system-ui,-apple-system,sans-serif}
      #${FAB_ID}{width:58px;height:58px;border-radius:50%;border:2px solid rgba(212,175,55,.7);background:#EA6C14;color:#fff;
        cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 10px 28px rgba(0,0,0,.35);
        transition:transform .15s ease}
      #${FAB_ID}:hover,#${FAB_ID}:focus-visible{transform:scale(1.08);outline:none}
      #${FAB_ID} img{width:100%;height:100%;border-radius:50%}
      #${FAB_ID}.ttdpa-busy{pointer-events:none;filter:saturate(.6)}
      #${FAB_ID}.ttdpa-busy img{display:none}
      #${FAB_ID}.ttdpa-busy::after{content:'';width:22px;height:22px;border:3px solid rgba(255,255,255,.35);border-top-color:#fff;
        border-radius:50%;animation:ttdpa-spin .7s linear infinite}
      #${WRAP_ID} .ttdpa-tip{position:absolute;right:70px;bottom:6px;white-space:nowrap;background:rgba(24,24,27,.95);color:#fff;
        font-size:12px;padding:8px 10px;border-radius:10px;opacity:0;visibility:hidden;transition:opacity .15s}
      #${WRAP_ID}:hover .ttdpa-tip{opacity:1;visibility:visible}
      #${WRAP_ID} kbd{background:rgba(255,255,255,.15);border-radius:5px;padding:1px 5px;font:700 11px ui-monospace,monospace}
      @keyframes ttdpa-spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(s);
  };

  const kbd = (t) => Object.assign(document.createElement("kbd"), { textContent: t });
  const tipNodes = () =>
    isSrivaniSite()
      ? ["Fill Srivani details ", kbd(ALT), kbd("A")]
      : ["Fill ", kbd(ALT), kbd("A"), "\u00a0 Fill & Continue ", kbd(ALT), kbd("S")];

  const ensureFab = () => {
    if (!ext.runtime?.id) return removeFab();
    if (!hasForm()) return removeFab();
    if (document.getElementById(WRAP_ID)) return;
    injectStyle();
    const wrap = document.createElement("div");
    wrap.id = WRAP_ID;
    const btn = document.createElement("button");
    btn.id = FAB_ID;
    btn.type = "button";
    btn.title = "TTD Pilgrim Autofill";
    const img = document.createElement("img");
    img.src = ext.runtime.getURL("icons/icon-128.png");
    img.alt = "";
    btn.appendChild(img);
    btn.addEventListener("click", () => runFromPage(null));
    const tip = document.createElement("div");
    tip.className = "ttdpa-tip";
    tip.append(...tipNodes());
    wrap.append(btn, tip);
    document.body.appendChild(wrap);
  };

  window.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.code !== "KeyA" && e.code !== "KeyS") return;
    if (!hasForm()) return;
    e.preventDefault();
    const cont = isSrivaniSite() ? false : e.code === "KeyS";
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === "function") {
      active.blur();
      setTimeout(() => runFromPage(cont), 60);
    } else runFromPage(cont);
  });

  let debounce;
  new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(ensureFab, 600);
  }).observe(document.body, { childList: true, subtree: true });
  ensureFab();
})();

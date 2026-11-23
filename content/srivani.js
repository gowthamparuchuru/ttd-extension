// Srivani Trust donor-darshan form (AngularJS, tirupatibalaji.ap.gov.in).
// Rows use fName{i}, age{i}, gender{i} (select), proofS{i} (select), proofId{i}.
(() => {
  const T = globalThis.TTDPA;
  const { sleep, norm, setPlain, physicalClick, bridge, isVisible, waitFor, settle } = T;

  const MAX_ROWS = 9;

  const hiddenByAncestor = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hasAttribute("hidden") || n.classList.contains("ng-hide") || n.style.display === "none") return true;
      if (/display\s*:\s*none/i.test(n.getAttribute("style") || "")) return true;
    }
    return false;
  };

  // Angular may render duplicate copies of a field; prefer the live, editable, visible one.
  const byName = (name) => {
    const all = Array.from(document.querySelectorAll(`input[name="${name}"], select[name="${name}"]`));
    if (all.length <= 1) return all[0] || null;
    const live = all.filter((el) => !el.disabled && !el.readOnly && !hiddenByAncestor(el));
    if (live.length) return live[live.length - 1];
    const shown = all.filter((el) => !hiddenByAncestor(el));
    return shown[shown.length - 1] || all[all.length - 1];
  };

  const ngState = (el) => {
    if (!el || ![...el.classList].some((c) => c.startsWith("ng-"))) return "plain";
    if (el.classList.contains("ng-invalid")) return "rejected";
    return el.classList.contains("ng-dirty") ? "accepted" : "untouched";
  };
  const isNgBound = (el) => !!el && [...el.classList].some((c) => c.startsWith("ng-"));

  /** Write and verify Angular accepted it; on failure re-resolve the element by name once and retry. */
  const writeVerified = async (el, value, name = null) => {
    if (!el) return false;
    const v = String(value);
    const accepted = (e) => !!e && (e.value || "") === v && ngState(e) !== "rejected";
    setPlain(el, value);
    if (accepted(el)) return true;
    await sleep(150);
    const again = (name && byName(name)) || el;
    setPlain(again, value);
    return accepted(again);
  };

  const optionValue = (select, text) => {
    if (!select || !text) return null;
    const want = norm(text);
    const opts = Array.from(select.options);
    const hit = opts.find((o) => norm(o.textContent) === want) || opts.find((o) => norm(o.textContent).includes(want));
    return hit ? hit.value : null;
  };

  const retry = async (getter, arg) => {
    let el = getter(arg);
    for (let i = 0; i < 6 && !el; i++) {
      await sleep(60);
      el = getter(arg);
    }
    return el;
  };

  // TTD requires 4+ English letters for Srivani names.
  const ttdName = (raw) => {
    const value = String(raw || "")
      .replace(/[^a-zA-Z ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    const issue = !value ? "not_english" : value.length < 4 ? "too_short" : null;
    return { value, issue };
  };

  const describeNameIssue = (r) =>
    r.nameIssue === "too_short"
      ? `Row ${r.row}: "${r.nameValue}" is too short — TTD needs 4+ letters. Add a surname or initial.`
      : `Row ${r.row}: TTD accepts the name in English letters only.`;

  const proofKey = (m) => (m.idProof === "Passport" ? "passport" : "aadha");

  const rowAlreadyFilled = (m, idx) => {
    if (!m || !m.name || !m.name.trim()) return false;
    const f = (n) => byName(`${n}${idx}`);
    const first = f("fName");
    if (!first || first.readOnly || first.disabled) return false;
    const ok = (el) => !!el && ngState(el) !== "rejected";
    const sameText = (el, v) => ok(el) && norm(el.value) === norm(v);
    const sameOption = (el, text) => {
      if (!ok(el)) return false;
      const v = optionValue(el, text);
      return v !== null && el.value === v;
    };
    return !(
      !sameText(first, ttdName(m.name).value) ||
      (m.age && !sameText(f("age"), m.age)) ||
      (m.gender && !sameOption(f("gender"), m.gender)) ||
      (m.idProof && !sameOption(f("proofS"), proofKey(m))) ||
      (m.idNumber && !sameText(f("proofId"), m.idNumber))
    );
  };

  // Three phases per row so Angular can re-render between them: age → name/gender/proof type → proof number + verify.
  const startRow = async (m, idx) => {
    if (!m || !m.name || !m.name.trim()) return null;
    const f = (n) => byName(`${n}${idx}`);
    const first = f("fName");
    if (!first || first.readOnly || first.disabled) return null;
    const failed = [];
    const ctx = { member: m, idx, f, failed, nameOk: false, name: ttdName(m.name), mark: (ok, what) => ok || failed.push(what) };
    if (m.age) {
      const age = await retry(f, "age");
      ctx.mark(!!age && (await writeVerified(age, m.age, `age${idx}`)), "age");
    }
    return ctx;
  };

  const middleRow = async (ctx) => {
    const { member: m, idx, f, mark, name } = ctx;
    if (name.issue) {
      const el = f("fName");
      if (name.value && el) setPlain(el, name.value);
    } else ctx.nameOk = await writeVerified(f("fName"), name.value, `fName${idx}`);
    mark(ctx.nameOk, "name");

    if (m.gender) {
      const sel = await retry(f, "gender");
      const v = sel ? optionValue(sel, m.gender) : null;
      mark(v !== null && (await writeVerified(sel, v, `gender${idx}`)), "gender");
    }
    if (m.idProof) {
      const sel = await retry(f, "proofS");
      for (let i = 0; i < 100 && sel && sel.options.length <= 1; i++) await sleep(30);
      const v = sel ? optionValue(sel, proofKey(m)) : null;
      mark(v !== null && (await writeVerified(sel, v, `proofS${idx}`)), "proofType");
    }
  };

  const finishRow = async (ctx) => {
    const { member: m, idx, f, failed, mark, name } = ctx;
    if (m.idNumber) {
      const el = await retry(f, "proofId");
      mark(!!el && (await writeVerified(el, m.idNumber, `proofId${idx}`)), "proofId");
    }
    const holdsName = (el) => !!el && (el.value || "").trim() === name.value && ngState(el) !== "rejected";
    let el = f("fName");
    let nameOk = ctx.nameOk && holdsName(el);
    if (!nameOk && !name.issue) {
      if (el && !el.readOnly && !el.disabled) setPlain(el, name.value);
      el = f("fName");
      nameOk = holdsName(el);
    }
    // A half-accepted name blocks TTD validation silently; clear it so the user sees the gap.
    if (!nameOk && !name.issue && el) setPlain(el, "");
    const filled = nameOk && failed.length === 0;
    return {
      filled,
      failed,
      nameIssue: name.issue,
      nameValue: name.value,
      state: filled || name.issue ? null : { state: ngState(f("fName")), copies: document.querySelectorAll(`input[name="fName${idx}"]`).length },
    };
  };

  const formRoot = () => {
    const el = document.querySelector('input[name^="fName"], select[name^="proofS"]');
    return (el && el.closest("form")) || document.body;
  };

  const commonRoot = (ctxs) => {
    const firsts = ctxs.filter(Boolean).map((c) => c.f("fName")).filter(Boolean);
    let n = firsts[0] ? firsts[0].closest("form") || firsts[0].parentElement : null;
    while (n && n !== document.body && !firsts.every((e) => n.contains(e))) n = n.parentElement;
    return n || formRoot();
  };

  // ---------- auto-dismiss the "#pasok" passport-info alert while filling ----------
  let lastPasok = 0;
  const dismissPasok = () => {
    const ok = document.querySelector("#pasok");
    if (!ok || !isVisible(ok) || Date.now() - lastPasok < 1000) return false;
    lastPasok = Date.now();
    ok.click();
    return true;
  };
  const watchPasok = () => {
    dismissPasok();
    let queued = false;
    const obs = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        dismissPasok();
      }, 150);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  };

  // ---------- calendar ----------
  const MODAL_SEL = ".modal-dialog, .modal-content, .cal_info";

  // Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YY…; returns DD-MM-YYYY (TTD calendar cell class).
  const toTtdDate = (s) => {
    if (!s) return "";
    const parts = String(s).split(/[^\d]/).filter(Boolean);
    if (parts.length !== 3) return s;
    let d, m, y;
    if (parts[0].length === 4) [y, m, d] = parts;
    else {
      [d, m, y] = parts;
      if (y.length === 2) y = "20" + y;
    }
    return `${d.padStart(2, "0")}-${m.padStart(2, "0")}-${y}`;
  };

  const visibleModals = () => [...Array.from(document.querySelectorAll(MODAL_SEL)).filter(isVisible), document];
  const modalOf = (el) => el?.closest(MODAL_SEL) || null;

  const findDayCell = (dateClass) => {
    for (const root of visibleModals()) {
      const days = Array.from(root.querySelectorAll(".day")).filter((d) => d.classList.contains(dateClass) && isVisible(d));
      if (!days.length) continue;
      const inMonth = days.filter((d) => !d.classList.contains("different-month"));
      const pool = inMonth.length ? inMonth : days;
      return pool.find((d) => d.classList.contains("available")) || pool[0];
    }
    return null;
  };

  const nextMonth = async () => {
    const btn = Array.from(document.querySelectorAll(".modal-dialog .cal-btns.next, .cal-btns.next")).find(
      (b) => isVisible(b) && !b.classList.contains("fadeCalButtton"),
    );
    if (!btn) return false;
    await physicalClick(btn);
    await sleep(450);
    return true;
  };

  const closeModal = async (el) => {
    const modal = (el && el.closest?.(".modal-dialog, .modal-content")) || el;
    const root = modal && modal.querySelectorAll ? modal : document;
    const x = Array.from(root.querySelectorAll(".modal-header button, .modal-header .close, button.close")).find(
      (b) => b.querySelector("img") || /^[x✕×]$/i.test((b.textContent || "").trim()),
    );
    if (x) {
      await physicalClick(x);
      await sleep(250);
      return true;
    }
    (root === document ? document.body : root).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
    return false;
  };

  const pressCalendarOk = async (scope) => {
    const root = scope && scope.querySelectorAll ? scope : document;
    const ok = Array.from(root.querySelectorAll("#calok, #calaok, .legend_redeem button")).find((b) => isVisible(b) && norm(b.textContent).includes("ok"));
    if (ok) {
      await physicalClick(ok);
      await sleep(250);
    }
  };

  const clearDate = async (input, modelKey) => {
    if (!input) return;
    setPlain(input, "");
    if (modelKey) await bridge.call("ngClearModel", input, { key: modelKey });
  };

  const pickDate = async (input, date, modelKey, { closeAfter = true } = {}) => {
    if (!input || !date || input.disabled) return false;
    const want = toTtdDate(date);
    await physicalClick(input);
    await sleep(400);
    let cell = null;
    for (let i = 0; i < 8 && !(cell = findDayCell(want)); i++) if (!(await nextMonth())) break;
    if (!cell) {
      await closeModal(Array.from(document.querySelectorAll(MODAL_SEL)).find(isVisible) || null);
      await clearDate(input, modelKey);
      return false;
    }
    if (!cell.classList.contains("available")) {
      await closeModal(modalOf(cell));
      await clearDate(input, modelKey);
      return false;
    }
    await physicalClick(cell);
    await sleep(350);
    if ((input.value || "").trim() !== want) {
      await bridge.call("ngSelectDay", cell);
      await sleep(350);
    }
    const ok = (input.value || "").trim() === want;
    if (ok && closeAfter) await pressCalendarOk(modalOf(cell));
    if (!ok) {
      await closeModal(modalOf(cell));
      await clearDate(input, modelKey);
      return false;
    }
    await sleep(400);
    return (input.value || "").trim() === want;
  };

  const ensureChecked = async (box, wanted) => {
    if (!box) return false;
    for (let i = 0; i < 6 && box.disabled; i++) await sleep(150);
    if (box.disabled) return false;
    if (box.checked !== wanted) await physicalClick(box);
    await sleep(350);
    return box.checked === wanted;
  };

  const hasAdvanceSection = () =>
    !!(
      document.querySelector("#darshanDate") ||
      document.querySelector('input[type="checkbox"][ng-model="sripgc.darshanCheck"]') ||
      document.querySelector("#accomodationDate") ||
      document.querySelector('input[type="checkbox"][ng-model="sripgc.accomCheck"]')
    );

  const applyDarshan = async (date, laddus) => {
    if (!date && !laddus) return { applied: false, dateUnavailable: false };
    const box = document.querySelector('input[type="checkbox"][ng-model="sripgc.darshanCheck"]');
    if (!(box && (await ensureChecked(box, true)))) return { applied: false, dateUnavailable: false };
    let hadInput = false;
    let picked = false;
    if (date) {
      const input = document.querySelector("#darshanDate") || document.querySelector('input[name="date"]');
      if (input) {
        hadInput = true;
        picked = await pickDate(input, date, "selectedDarshandate");
      }
    }
    if (laddus) {
      const ladduInput = document.querySelector('input[name="addladdus"], #addladdus');
      if (ladduInput) {
        for (let i = 0; i < 6 && ladduInput.disabled; i++) await sleep(150);
        if (!ladduInput.disabled) await writeVerified(ladduInput, laddus, "addladdus");
      }
    }
    return { applied: true, dateUnavailable: !!date && hadInput && !picked };
  };

  const pickTimeSlot = async (slot) => {
    const radios = await waitFor(() => {
      const r = Array.from(document.querySelectorAll('input[name="checkInTimeSlot"]')).filter((e) => isVisible(e) || isVisible(e.closest(".sed_rdb_lcnt")));
      return r.length ? r : null;
    });
    if (!radios) return false;
    const want = norm(slot);
    const pick = (want && (radios.find((r) => norm(r.value) === want) || radios.find((r) => norm(r.value).includes(want)))) || radios[0];
    if (!pick || pick.disabled) return false;
    await physicalClick(pick);
    if (!pick.checked) await physicalClick(pick);
    await sleep(350);
    return pick.checked;
  };

  const applyAccommodation = async (date, slot) => {
    if (!date) return { applied: false, dateUnavailable: false };
    const box = await waitFor(() => document.querySelector('input[type="checkbox"][ng-model="sripgc.accomCheck"]'), 8, 150);
    if (!box) return { applied: false, dateUnavailable: false };
    for (let i = 0; i < 24 && box.disabled; i++) await sleep(150);
    if (!(await ensureChecked(box, true))) return { applied: false, dateUnavailable: false };
    const input = await waitFor(() => document.querySelector("#accomodationDate") || document.querySelector('input[name="sdonredatefrom"]'));
    let picked = false;
    if (input) {
      picked = await pickDate(input, date, "selectedAccdate", { closeAfter: false });
      if (picked) {
        await pickTimeSlot(slot);
        await pressCalendarOk(visibleModals().find((m) => m !== document && m.querySelector('input[name="checkInTimeSlot"]')));
      }
    }
    return { applied: true, dateUnavailable: !!input && !picked };
  };

  // ---------- entry ----------
  const fill = async ({ members, darshanDate, extraLaddus, includeAccommodation, accommodationDate, accommodationTimeSlot } = {}) => {
    if (!Array.isArray(members) || !members.length) return { status: "error", message: "No Srivani members saved." };
    const stopWatching = watchPasok();
    try {
      // Some layouts number rows from 1; detect which index the first usable row has.
      const wanted = members.map((m) => norm(m && m.name)).filter(Boolean);
      const startsAtZero = Array.from(document.querySelectorAll('input[name="fName0"]')).some(
        (el) => !el.disabled && !el.readOnly && !hiddenByAncestor(el) && (!(el.value || "").trim() || wanted.includes(norm(el.value))),
      );
      const base = startsAtZero ? 0 : 1;

      await settle(formRoot());
      for (let i = 0; i < 8 && !isNgBound(byName(`fName${base}`)); i++) await sleep(100);

      const list = members.slice(0, MAX_ROWS);
      let alreadyFilled = 0;
      const ctxs = [];
      for (let i = 0; i < list.length; i++) {
        if (rowAlreadyFilled(list[i], base + i)) {
          alreadyFilled++;
          ctxs.push(null);
          continue;
        }
        ctxs.push(await startRow(list[i], base + i));
      }
      await settle(commonRoot(ctxs), { quiet: 120, timeout: 800 });
      for (const c of ctxs) if (c) await middleRow(c);
      await settle(commonRoot(ctxs), { quiet: 80, timeout: 500 });

      let filled = 0;
      const unverifiedRows = [];
      for (let i = 0; i < ctxs.length; i++) {
        if (!ctxs[i]) continue;
        const r = await finishRow(ctxs[i]);
        if (r.filled) filled++;
        else
          unverifiedRows.push({
            row: i + 1,
            failed: r.failed,
            ...(r.nameIssue ? { nameIssue: r.nameIssue, nameValue: r.nameValue } : {}),
            ...(r.state || {}),
          });
      }

      const advance = { darshanApplied: false, accommodationApplied: false, dateUnavailable: false };
      const hasAdvance = hasAdvanceSection();
      if (hasAdvance && (darshanDate || extraLaddus)) {
        const r = await applyDarshan(darshanDate, extraLaddus);
        advance.darshanApplied = r.applied;
        advance.dateUnavailable = r.dateUnavailable;
        await sleep(300);
      }
      if (hasAdvance && !advance.dateUnavailable && (includeAccommodation || accommodationDate)) {
        const r = await applyAccommodation(accommodationDate || darshanDate, accommodationTimeSlot);
        advance.accommodationApplied = r.applied;
        advance.dateUnavailable = r.dateUnavailable;
        await sleep(300);
      }
      if (list.some((m) => m && m.idProof === "Passport")) await sleep(400);
      dismissPasok();
      return { status: "success", filled, alreadyFilled, unverified: unverifiedRows.length, unverifiedRows, advance };
    } catch (err) {
      return { status: "error", message: String(err && err.message ? err.message : err) };
    } finally {
      stopWatching();
    }
  };

  const hasForm = () => !!document.querySelector('input[name^="fName"], input[name^="age"]');

  const summarize = (res, wantedAdvance) => {
    const head = `Filled ${res.filled} member${res.filled === 1 ? "" : "s"}${res.alreadyFilled ? ` (${res.alreadyFilled} already on the form)` : ""}`;
    if (res.unverified > 0) {
      const nameRows = res.unverifiedRows.filter((r) => r.nameIssue);
      if (nameRows.length) return { text: `${head}. ${nameRows.map(describeNameIssue).join(" ")}`, kind: "warn" };
      const detail = res.unverifiedRows
        .map((r) => `row ${r.row}: ${r.failed.join("+") || "unknown"}${r.state ? ` [${r.state}${r.copies > 1 ? `, ${r.copies} copies` : ""}]` : ""}`)
        .join(", ");
      return { text: `${head}. TTD did not accept ${detail || "every row"} — fill it manually.`, kind: "warn" };
    }
    if (wantedAdvance && res.advance?.dateUnavailable) return { text: `${head}. That date is not available — select it manually.`, kind: "warn" };
    return { text: `${head}. Continue manually on TTD.`, kind: "success" };
  };

  T.srivani = { fill, hasForm, summarize };
})();

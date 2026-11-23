// Pilgrim booking forms on the React portal (ttdevasthanams.ap.gov.in):
// darshan / seva / accommodation pilgrim rows, passport+visa popup, general contact block, Continue.
(() => {
  const T = globalThis.TTDPA;
  const { sleep, norm, compact, bestOption, setValue, click, chooseFromDropdown, fillSmart, attachFile, isVisible, isClickable } = T;

  const PASSPORT_POPUP_SEL = '[class*="passportVisaPopup"], [role="dialog"], [class*="popup"], [class*="modal"]';
  const notInPassportPopup = (el) => !el.closest('[class*="passportVisaPopup"]');

  const allByName = (...names) => {
    for (const n of names) {
      const found = document.querySelectorAll(`input[name="${n}"]`);
      if (found.length) return Array.from(found);
    }
    return [];
  };
  const firstByName = (...names) => allByName(...names)[0] || null;
  const rowField = (row, ...names) => {
    for (const n of names) {
      const found = document.querySelectorAll(`input[name="${n}"]`);
      if (found.length > row) return found[row];
    }
    return null;
  };
  const nameInputs = () => {
    const a = allByName("name");
    return a.length ? a : allByName("fname");
  };

  // ---------- pilgrim rows ----------
  const fillNameAge = async (p, row) => {
    await setValue(rowField(row, "name", "fname"), p.name);
    if (p.age) await setValue(document.querySelectorAll('input[name="age"]')[row], p.age);
  };

  const findPassportPopup = () => {
    const popups = Array.from(document.querySelectorAll(PASSPORT_POPUP_SEL)).filter(
      (el) =>
        isVisible(el) &&
        el.querySelector('input[name="visaNumber"], input[name="passportNumber"]') &&
        !el.querySelector('input[name="name"], input[name="fname"]'),
    );
    return popups.find((p) => !popups.some((o) => o !== p && o.contains(p))) || null;
  };

  const PASSPORT_FIELD_LABELS = {
    passportNumber: "passport number",
    country: "country",
    visaNumber: "visa number",
    visaType: "visa type",
    visaValidityDate: "visa validity date",
  };

  const digitsKey = (s) =>
    (String(s || "").match(/\d+/g) || [])
      .map(Number)
      .sort((a, b) => a - b)
      .join(",");

  const hasNearbyError = (input, popup) => {
    if (input.getAttribute("aria-invalid") === "true") return true;
    let n = input.parentElement;
    for (let i = 0; n && i < 3 && n !== popup && n.querySelectorAll("input, select, textarea").length <= 1; i++, n = n.parentElement) {
      const err = Array.from(n.querySelectorAll('[class*="error"], [class*="Error"], [class*="invalid"], [class*="Invalid"], [role="alert"]')).find(
        (e) => e !== input && (e.textContent || "").trim() && isVisible(e),
      );
      if (err) return true;
    }
    return false;
  };

  /** Fill the passport/visa popup and submit it. Returns "submitted" | "open". */
  const fillPassportPopup = async (popup, p, fallbackCountry, rejected) => {
    const field = (n) => popup.querySelector(`input[name="${n}"]`);
    const checks = [];
    const sameText = (want) => (got) => compact(got) === compact(want);

    const text = async (n, value, holds = sameText(value)) => {
      if (!value) return;
      const el = field(n);
      if (!el) return;
      await setValue(el, value);
      checks.push({ n, holds });
    };
    const pickList = async (n, value, aliases = [], alwaysList = false) => {
      if (!value) return;
      const el = field(n);
      if (!el) return;
      const holds = (got) => bestOption(value, [got], { aliases, exactOnly: true }) !== null;
      checks.push({ n, holds });
      if (holds(el.value)) return;
      const ok =
        (alwaysList || T.looksLikeDropdown(el)) &&
        (await chooseFromDropdown(el, value, { pick: (labels, o = {}) => bestOption(value, labels, { aliases, ...o }) }));
      if (!ok && !el.readOnly) await setValue(el, value);
    };

    await text("passportNumber", p.idNumber);
    await sleep(300);
    await pickList("country", p.passportCountry || fallbackCountry, T.COUNTRY_ALIASES, true);
    await text("visaNumber", p.visaNumber);
    await pickList("visaType", p.visaType);
    await text("visaValidityDate", p.visaValidityDate, (got) => digitsKey(got) === digitsKey(p.visaValidityDate));

    const failing = ({ includeEmpty }) => {
      const bad = checks.filter(({ n, holds }) => {
        const el = field(n);
        return el && (!holds(el.value) || hasNearbyError(el, popup));
      }).map(({ n }) => n);
      if (includeEmpty)
        for (const n of Object.keys(PASSPORT_FIELD_LABELS)) {
          const el = field(n);
          if (el && !(el.value || "").trim() && !bad.includes(n)) bad.push(n);
        }
      return bad;
    };
    const report = (names) => rejected.push({ name: p.name || "", fields: names.map((n) => PASSPORT_FIELD_LABELS[n] || n) });

    const countryCheck = checks.find((c) => c.n === "country");
    const countryEl = field("country");
    if (countryCheck && countryEl && !countryCheck.holds(countryEl.value)) {
      report(["country", ...failing({ includeEmpty: false }).filter((n) => n !== "country")]);
      return "open";
    }

    const submitBtn = () =>
      popup.querySelector('button[type="submit"]') ||
      popup.querySelector('button[class*="continueBtn"]') ||
      Array.from(popup.querySelectorAll("button")).find((b) => (b.innerText || "").toLowerCase().includes("submit"));
    let btn = null;
    const until = Date.now() + 2000;
    while (Date.now() < until && !((btn = submitBtn()) && !btn.disabled)) await sleep(100);
    if (!btn || btn.disabled) {
      report(failing({ includeEmpty: true }));
      return "open";
    }
    await click(btn, { guarded: true });
    const closeBy = Date.now() + 3000;
    while (Date.now() < closeBy) {
      if (!isVisible(popup)) return "submitted";
      await sleep(100);
    }
    return "open";
  };

  /** Gender + ID type + ID number for a row; handles the passport popup. Returns "none" | "submitted" | "open" | "missing". */
  const fillRowIdentity = async (p, row, fallbackCountry, rejected) => {
    const gender = document.querySelectorAll('input[name="gender"]')[row];
    if (gender && p.gender) await chooseFromDropdown(gender, p.gender);

    const popupAlreadyOpen = p.idProof === "Passport" ? findPassportPopup() : null;
    const idType = rowField(row, "idType", "photoIdType");
    if (idType) {
      await chooseFromDropdown(idType, (p.idProof || "Aadhaar Card").trim());
      for (let i = 0; i < 20; i++) {
        const num = rowField(row, "idNumber", "idProofNumber");
        if (num && !num.disabled) break;
        await sleep(15);
      }
    }
    const idNum = rowField(row, "idNumber", "idProofNumber");
    if (idNum && p.idNumber) {
      if (idNum.disabled) idNum.disabled = false;
      await setValue(idNum, p.idNumber);
    }
    if (p.idProof !== "Passport") return "none";
    if (popupAlreadyOpen) return "open";
    const popup = await T.waitFor(findPassportPopup, 80, 50);
    return popup ? fillPassportPopup(popup, p, fallbackCountry, rejected) : "missing";
  };

  // ---------- general / contact block ----------
  // When several "country"/"state" inputs exist, prefer the one sharing the deepest ancestor with city/pincode.
  const pickNearest = (names, neighbourNames) => {
    const neighbours = allByName(...neighbourNames).filter(notInPassportPopup);
    if (!neighbours.length) return null;
    const depth = (el) => {
      let d = 0;
      for (let n = el; n; n = n.parentElement) d++;
      return d;
    };
    const affinity = (el) =>
      Math.max(
        ...neighbours.map((nb) => {
          for (let a = el.parentElement; a; a = a.parentElement) if (a.contains(nb)) return depth(a);
          return 0;
        }),
      );
    let best = null;
    let bestScore = -1;
    for (const el of allByName(...names).filter(notInPassportPopup)) {
      const s = affinity(el);
      if (s > bestScore) {
        best = el;
        bestScore = s;
      }
    }
    return best;
  };

  const attachSupportingDocument = async (contact) => {
    const doc = contact.document;
    if (!doc || !doc.data) return false;
    for (const input of document.querySelectorAll('input[type="file"]')) {
      const box = input.closest('div[style*="position: relative"]') || input.parentElement;
      const txt = box?.textContent || "";
      if (!/uploaded document name/i.test(txt)) continue;
      if (txt.includes(doc.name)) return false;
      const ok = await attachFile(input, doc);
      await sleep(250);
      return ok;
    }
    return false;
  };

  const fillContact = async (c) => {
    if (!c) return;
    if (c.email) {
      const all = allByName("pilgrimEmail", "emailId", "email");
      if (all.length) await setValue(all[all.length - 1], c.email, { blur: false });
    }
    if (c.country) {
      const el = pickNearest(["pilgrimCountry", "country"], ["pilgrimCity", "city", "pilgrimState", "state", "pilgrimPincode", "pincode"]);
      if (el) await fillSmart(el, c.country, T.COUNTRY_ALIASES);
    }
    if (c.state) {
      const el = pickNearest(["pilgrimState", "state"], ["pilgrimCity", "city", "pilgrimPincode", "pincode"]);
      if (el) await fillSmart(el, c.state, T.STATE_ALIASES);
    }
    if (c.city) {
      const all = allByName("pilgrimCity", "city");
      if (all.length) await setValue(all[all.length - 1], c.city);
    }
    if (c.pincode) await setValue(firstByName("pilgrimPincode", "pincode"), c.pincode);
    if (c.gothram) await setValue(firstByName("gothram", "gotram"), c.gothram);
    await attachSupportingDocument(c);
  };

  // ---------- fill all rows ----------
  const RECHECK_DELAY = 120;
  const RECHECK_PASSES = 3;

  const fillAll = async (pilgrims, contact) => {
    const names = nameInputs();
    if (!names.length) return { status: "error", message: "Pilgrim name fields not found on this page." };

    const emptyRows = names.map((el, i) => (!(el.value || "").trim() ? i : -1)).filter((i) => i >= 0);
    const fallbackCountry = contact ? contact.country : undefined;
    const rejected = [];
    let passportPending = 0;

    // Rows already holding a saved pilgrim's name are matched up, not refilled.
    const remaining = pilgrims.slice();
    const matched = [];
    names.forEach((el, row) => {
      if (emptyRows.includes(row)) return;
      const idx = remaining.findIndex((p) => p && norm(p.name) === norm(el.value));
      if (idx !== -1) matched.push({ pilgrim: remaining.splice(idx, 1)[0], row });
    });

    // Passport rows already filled: maybe their popup is open, otherwise redo identity.
    const openPopup = findPassportPopup();
    const popupPassport = norm(openPopup?.querySelector('input[name="passportNumber"]')?.value);
    let popupOwner = null;
    const redoIdentity = [];
    for (const m of matched) {
      if (m.pilgrim.idProof !== "Passport") continue;
      const idType = rowField(m.row, "idType", "photoIdType");
      if (idType && norm(idType.value) === "passport") {
        if (!popupOwner && popupPassport && norm(m.pilgrim.idNumber) === popupPassport) popupOwner = m.pilgrim;
        continue;
      }
      redoIdentity.push(m);
    }
    if (popupOwner && (await fillPassportPopup(openPopup, popupOwner, fallbackCountry, rejected)) === "open") passportPending++;

    const fresh = remaining.slice(0, emptyRows.length).map((pilgrim, i) => ({ pilgrim, row: emptyRows[i] }));
    for (const f of fresh) {
      await fillNameAge(f.pilgrim, f.row);
      await sleep(100);
    }

    // React may re-render rows and drop a name; put it back.
    const restoreName = async ({ pilgrim, row }) => {
      const el = rowField(row, "name", "fname");
      if (!el || norm(el.value) === norm(pilgrim.name)) return false;
      await fillNameAge(pilgrim, row);
      return true;
    };
    if (fresh.length) {
      await sleep(RECHECK_DELAY);
      for (const f of fresh) await restoreName(f);
    }

    const identityWork = fresh.concat(redoIdentity).sort((a, b) => a.row - b.row);
    for (const w of identityWork) {
      await restoreName(w);
      const state = await fillRowIdentity(w.pilgrim, w.row, fallbackCountry, rejected);
      if (state === "open" || state === "missing") passportPending++;
    }

    for (let pass = 0; pass < RECHECK_PASSES; pass++) {
      let fixed = 0;
      for (const f of fresh)
        if (await restoreName(f)) {
          fixed++;
          if (f.pilgrim.idProof !== "Passport") await fillRowIdentity(f.pilgrim, f.row, fallbackCountry, rejected);
        }
      if (!fixed) break;
      await sleep(RECHECK_DELAY);
    }

    if (contact) await fillContact(contact);
    return {
      status: "success",
      filled: fresh.length + redoIdentity.length + (popupOwner ? 1 : 0),
      skipped: Math.max(0, remaining.length - emptyRows.length),
      passportPending,
      rejected,
    };
  };

  /** Fill one pilgrim into the first empty row (or the last row). */
  const fillOne = async (pilgrim, contact) => {
    const names = nameInputs();
    if (!names.length) return { status: "error", message: "Pilgrim name fields not found on this page." };
    let row = names.findIndex((el) => !(el.value || "").trim());
    if (row === -1) row = names.length - 1;
    const rejected = [];
    await fillNameAge(pilgrim, row);
    const state = await fillRowIdentity(pilgrim, row, contact?.country, rejected);
    await fillContact(contact);
    return { status: "success", filled: 1, passportPending: state === "open" || state === "missing" ? 1 : 0, rejected };
  };

  // ---------- Continue / review ----------
  const CHROME_SEL = 'header, nav, footer, aside, [role="dialog"], [class*="passportVisaPopup"]';
  const BUTTON_SEL = 'button, input[type="button"], input[type="submit"], [role="button"]';
  const REVIEW_SEL = '[class*="sevaReview"], [class*="ReviewDetails"]';
  const label = (el) => (el.innerText || el.value || el.textContent || "").trim();

  const formAnchors = () =>
    Array.from(document.querySelectorAll('input[name="name"], input[name="fname"], input[name="age"]')).filter(
      (el) => isVisible(el) && !el.closest(CHROME_SEL),
    );

  const sharesAncestor = (btn, anchors) => {
    for (let n = btn.parentElement; n && n !== document.body; n = n.parentElement) if (anchors.some((a) => n.contains(a))) return true;
    return false;
  };

  const continueButtons = (anchors) =>
    Array.from(document.querySelectorAll(BUTTON_SEL)).filter(
      (b) => /\bcontinue\b/i.test(label(b)) && !b.closest(CHROME_SEL) && isVisible(b) && (!anchors || sharesAncestor(b, anchors)),
    );

  const findContinue = () => {
    const anchors = formAnchors();
    let list = anchors.length ? continueButtons(anchors) : [];
    if (!list.length) list = continueButtons(null);
    return list.find(isClickable) || list[0] || null;
  };

  const waitForContinue = async () => {
    await sleep(150);
    const until = performance.now() + 2500;
    for (;;) {
      const b = findContinue();
      if (isClickable(b)) return b;
      if (performance.now() >= until) return null;
      await sleep(80);
    }
  };

  // After Continue, the review step shows its own Continue / Pay Now; press it once when it appears.
  let followRun = 0;
  const followReview = (first) => {
    const run = ++followRun;
    const until = performance.now() + 15000;
    const tick = async () => {
      if (run !== followRun) return;
      const review = document.querySelector(REVIEW_SEL);
      const next =
        continueButtons(null).find((b) => b !== first && b.closest(REVIEW_SEL) && isClickable(b)) ||
        (review && Array.from(review.querySelectorAll(BUTTON_SEL)).find((b) => b !== first && /^\s*pay\s*now\s*$/i.test(label(b)) && isClickable(b)));
      if (next) {
        followRun++;
        next.scrollIntoView?.({ block: "center" });
        await click(next, { guarded: true });
        return;
      }
      if (performance.now() < until) setTimeout(tick, 200);
    };
    setTimeout(tick, 200);
  };

  const pressContinue = async () => {
    const btn = await waitForContinue();
    if (!btn) return false;
    btn.scrollIntoView?.({ block: "center" });
    await click(btn, { guarded: true });
    followReview(btn);
    return true;
  };

  const hasPilgrimForm = () => nameInputs().length > 0;

  T.pilgrim = { fillAll, fillOne, fillContact, pressContinue, hasPilgrimForm };
})();

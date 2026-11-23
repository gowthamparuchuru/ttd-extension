// Srivari Seva / Parakamani / skilled-volunteer sevak profile forms (React portal).
(() => {
  const T = globalThis.TTDPA;
  const { sleep, norm, setValue, click, chooseFromDropdown, attachFile, bestOption, bridge, nativeSetValue, fireInputEvents } = T;

  const ITEMS_SEL = '[class*="floatingDropdown_listItem"], [class*="dropdown_scroll"] li, ul[style*="list-style-type: none"] li';
  const CHECK_ITEMS_SEL = '[class*="checkboxListItem"]';

  const shown = (el) => {
    const r = el.getBoundingClientRect();
    return el.offsetParent !== null && r.width > 0 && r.height > 0;
  };

  const fillSevak = async (s) => {
    // Group forms render one container per sevak; scope lookups to the requested one.
    let root = document;
    if (typeof s.memberIndex === "number") {
      const boxes = document.querySelectorAll('[class*="sevakContainer"]');
      if (boxes.length > s.memberIndex) root = boxes[s.memberIndex];
      else if (boxes.length) root = boxes[boxes.length - 1];
    }

    // Last visible empty match, else last visible, else last.
    const find = (sel) => {
      const all = Array.from(root.querySelectorAll(sel));
      if (!all.length) return null;
      const rev = all.slice().reverse();
      return rev.find((el) => shown(el) && !(el.value || "").trim()) || rev.find(shown) || all[all.length - 1];
    };
    const byLabel = (name, labelText) => {
      const direct = root.querySelector(`input[name="${name}"]`);
      if (direct) return direct;
      if (!labelText) return null;
      const want = labelText.toLowerCase();
      for (const el of root.querySelectorAll("label, span, div")) {
        const t = el.textContent?.trim().toLowerCase();
        if (t && t.includes(want)) {
          const input = el.closest("div")?.querySelector("input");
          if (input) return input;
        }
      }
      return null;
    };
    const text = async (name, value) => {
      if (!value) return false;
      const el = find(`input[name="${name}"]`);
      if (!el) return false;
      await setValue(el, value);
      return true;
    };
    const radio = (name, value) => {
      if (!value) return;
      for (const r of root.querySelectorAll(`input[name="${name}"]`))
        if (r.value.toLowerCase() === String(value).toLowerCase()) {
          r.click();
          fireInputEvents(r);
        }
    };
    const dropdown = async (el, value, wait = 100) => {
      if (!el || !value) return false;
      const ok = await chooseFromDropdown(el, value);
      document.body.click();
      await sleep(wait);
      return ok;
    };
    // Last resort for stubborn React dropdown inputs: write the value and call React's onChange directly.
    const force = async (el, value) => {
      if (!el) return false;
      nativeSetValue(el, value);
      if (!(await bridge.call("announce", el, { blur: true }))) fireInputEvents(el);
      await sleep(50);
      return el.value === value;
    };
    const dropdownOrForce = async (el, value) => {
      if (!el || !value) return;
      await chooseFromDropdown(el, value);
      await sleep(200);
      if (!(el.value || "").trim()) await force(el, value);
    };
    const multiCheck = async (input, wanted, matches) => {
      if (!input || !wanted?.length) return;
      await click(input);
      await sleep(200);
      for (const item of document.querySelectorAll(`${CHECK_ITEMS_SEL}, li`)) {
        const label = item.textContent?.trim() || "";
        if (!wanted.some((w) => matches(w, label))) continue;
        const box = item.querySelector('input[type="checkbox"]');
        if (box && !box.checked) {
          box.click();
          await sleep(100);
        }
      }
      document.body.click();
      await sleep(100);
    };

    const ID_TYPE_SEL = '#idType, input[name="idType"], input[name="photoIdType"], input[name="spvrIdType"]';
    const idTypeInput = () => find("#idType") || find('input[name="idType"]') || find('input[name="photoIdType"]') || find('input[name="spvrIdType"]');
    const idType = (s.idType || "Aadhaar Card").trim();
    const isAadhaar = idType.toLowerCase().includes("aadhaar");

    // Wait briefly for the page to preselect an ID type.
    const until = Date.now() + 400;
    while (Date.now() < until && !(find(ID_TYPE_SEL)?.value || "").trim()) await sleep(100);

    if (!isAadhaar) await dropdownOrForce(idTypeInput(), idType);
    await sleep(150);

    await text("idNumber", s.idNumber);
    (await text("spvrName", s.spvrName)) || (await text("trainerName", s.spvrName));
    (await text("spvrRelativeName", s.spvrRelativeName)) || (await text("trainerRelativeName", s.spvrRelativeName));
    await text("dob", s.dob);
    await sleep(100);
    await text("age", s.age);
    radio("gender", s.gender);
    if (s.maritalStatus) await dropdown(find('input[name="maritalStatus"]'), s.maritalStatus, 50);
    await text("mobileNo", s.mobileNo);
    await text("altMobileNo", s.altMobileNo);
    (await text("emailId", s.email)) || (await text("email", s.email));
    await text("residentialAdrs", s.residentialAdrs);
    await text("pincode", s.pincode);
    if (s.country) await dropdown(find('input[name="country"]'), s.country, 50);

    if (s.state) {
      const el = find('input[name="state"]');
      if (el?.readOnly) {
        await chooseFromDropdown(el, s.state, { pick: (labels, o = {}) => bestOption(s.state, labels, { aliases: T.STATE_ALIASES, ...o }) });
        document.body.click();
        el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
        await sleep(200);
      } else if (el) {
        await setValue(el, s.state);
        await sleep(50);
      }
    }

    if (s.district) {
      const el = find('input[name="district"]');
      if (el && !el.readOnly) await setValue(el, s.district);
      else if (el) await pickDistrict(el, s.district);
      await sleep(50);
    }

    (await text("city", s.city)) || (await text("cityOrVillage", s.city));

    await dropdown(byLabel("qualification", "Qualification Category") || byLabel("qualificationCategory", "Qualification"), s.qualification, 600);
    await dropdown(byLabel("specQualification", "Specific Qualification") || byLabel("specificQualification", "Qualification"), s.specQualification, 150);
    await text("uniName", s.uniName);
    await dropdown(byLabel("yearOfGraduation", "Year of Graduation") || byLabel("graduationYear", "Year"), s.yearOfGraduation, 100);
    await text("eduSpecialization", s.eduSpecialization);
    await dropdown(byLabel("employmentStatus", "Employment Status") || byLabel("employmentStatus", "Occupation Status"), s.employmentStatus, 150);
    await dropdown(byLabel("employmentSector", "Employment Sector") || byLabel("sector", "Sector"), s.employmentSector, 100);
    const professionInput = () => byLabel("professionalCategory", "Profession") || byLabel("profession", "Professional Category");
    const roleInput = () => byLabel("specProfession", "Profession Role") || byLabel("professionRole", "Role");
    await dropdown(professionInput(), s.professionalCategory, 300);
    await dropdown(roleInput(), s.specProfession, 100);
    await text("profYearsOfExp", s.profYearsOfExp);

    radio("previouslyVolunteered", s.previouslyVolunteered);
    if (s.previouslyVolunteered === "true") {
      await sleep(150);
      await text("noOfParticipation", s.noOfParticipation);
      await text("lastTwoSevaPeriods", s.lastTwoSevaPeriods);
      await text("religiousInstitute", s.religiousInstitute);
      await text("volunteeredExp", s.volunteeredExp);
    }

    if (s.experiencedTrainer) radio("experiencedTrainer", s.experiencedTrainer);
    if (s.experiencedTrainer === "true") {
      await sleep(150);
      const set = async (el, v) => el && v && (await setValue(el, v));
      await set(byLabel("trainerInstituteName", "Organization / Institute Name"), s.trainerInstituteName);
      await set(byLabel("trainerRole", "Your Role as Trainer"), s.trainerRole);
      await set(byLabel("trainerExp", "Experience"), s.trainerExp);
      const isOther = (v) => /other/i.test(v) && /specify/i.test(v);
      await multiCheck(document.querySelector('input[name="areaOfTrainerExp"]'), s.areaOfTrainerExp, (w, label) => {
        const a = norm(w);
        const b = norm(label);
        return a === b || (isOther(a) && isOther(b));
      });
      if (s.areaOfTrainerExp?.some(isOther) && s.otherAreaOfTrainerExp) {
        await sleep(150);
        await set(byLabel("otherAreaOfTrainerExp", "Other Area of Training Expertise"), s.otherAreaOfTrainerExp);
      }
    }

    await dropdown(document.querySelector('input[name="preferredLoc"]'), s.preferredLoc, 150);
    await dropdown(document.querySelector('input[name="timeCommitment"]'), s.timeCommitment, 150);
    await dropdown(document.querySelector('input[name="freq"]'), s.freq, 150);
    if (s.preferredLoc === "Other(Specify)" && s.otherPreferredLoc) {
      await sleep(150);
      await text("otherPreferredLoc", s.otherPreferredLoc);
    }
    for (const n of ["firstRefName", "firstRefDetails", "firstRefMobileNo", "secRefName", "secRefDetails", "secRefMobileNo"]) await text(n, s[n]);

    await multiCheck(document.querySelector('input[name="languages"]'), s.languages, (w, label) => label === w);

    if (s.photo?.data) {
      const boxes = Array.from(root.querySelectorAll('[class*="photo-container"], [class*="photo-upload-container"]'));
      const box = boxes.slice().reverse().find(shown) || boxes[boxes.length - 1];
      let input = box && (box.parentElement?.querySelector('input[type="file"]') || box.nextElementSibling);
      if (!input || input.type !== "file") {
        const files = Array.from(root.querySelectorAll('input[type="file"][accept*="jpeg"]'));
        input = files.slice().reverse().find((f) => f.offsetParent !== null || f.getBoundingClientRect().width > 0) || files[files.length - 1];
      }
      if (input) await attachFile(input, s.photo);
      await sleep(250);
    }
    await attachByLabel("Upload ID Proof", s.document, 1);
    await attachByLabel("Upload Educational Certificate", s.eduCertificate, 2);

    await text("sevakName", s.sevakName);
    await text("surName", s.surName);
    await text("fatherOrSpouseName", s.fatherOrSpouseName);
    await dropdown(find('input[name="bloodGroup"]'), s.bloodGroup, 200);
    if (s.mentallyFit || s.physicallyFit) await tickFitness(root, s);
    await text("street", s.street);
    await text("doorNo", s.doorNo);
    await dropdown(find('input[name="nearestTtdTemple"]'), s.nearestTtdTemple, 200);
    await text("qualification", s.volunteerQualification);
    await text("profession", s.volunteerProfession);
    for (const n of ["employeeId", "designation", "specialisation", "placeOfWork"]) await text(n, s[n]);

    // Dependent dropdowns (profession → role, id type) often reset after later re-renders; re-apply.
    for (let i = 0; i < 3 && s.professionalCategory; i++) {
      const prof = professionInput();
      if (!prof) break;
      const profEmpty = !(prof.value || "").trim();
      if (profEmpty) await dropdownOrForce(prof, s.professionalCategory);
      const role = s.specProfession && roleInput();
      if (role && !(role.value || "").trim()) await dropdownOrForce(role, s.specProfession);
      else if (!profEmpty) break;
    }
    if (!isAadhaar)
      for (let i = 0; i < 3; i++) {
        const el = idTypeInput();
        if (!el || (el.value || "").trim()) break;
        await dropdownOrForce(el, idType);
        await text("idNumber", s.idNumber);
      }
    if (s.idNumber) {
      const el = find('input[name="idNumber"]');
      if (el && !(el.value || "").trim()) await setValue(el, s.idNumber);
    }

    if (s.clickSaveAndAdd !== false) await saveAndAdd();
  };

  const pickDistrict = async (input, district) => {
    const n = (t) => t.toLowerCase().replace(/\s+/g, " ").trim();
    const strip = (t) => t.replace(/\s*(urban|rural|north|south|east|west)$/i, "").trim();
    const want = n(district);
    document.body.click();
    await sleep(100);
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await sleep(150);
      const scope = input.closest('div[style*="position"]') || input.parentElement?.parentElement || input.parentElement || document;
      await click(input);
      await sleep(100);
      let items = [];
      for (let i = 0; i < 10 && !items.length; i++) {
        items = Array.from(scope.querySelectorAll(ITEMS_SEL));
        if (!items.length && scope.parentElement) items = Array.from(scope.parentElement.querySelectorAll(ITEMS_SEL));
        if (!items.length) await sleep(100);
      }
      if (!items.length) {
        document.body.click();
        await sleep(100);
        continue;
      }
      const label = (li) => n(li.innerText?.trim() || "");
      const hit =
        items.find((li) => label(li) === want) ||
        items.find((li) => label(li).startsWith(want) || want.startsWith(label(li))) ||
        items.find((li) => {
          const a = n(strip(li.innerText?.trim() || ""));
          const b = n(strip(district));
          return a.includes(b) || b.includes(a);
        });
      let ok = false;
      if (hit) {
        hit.scrollIntoView?.({ block: "nearest" });
        await click(hit);
        await sleep(100);
        ok = !!(input.value || "").trim();
      }
      document.body.click();
      await sleep(50);
      if (ok) return true;
    }
    return false;
  };

  const attachByLabel = async (labelText, file, fallbackIndex) => {
    if (!file?.data) return;
    let input = null;
    for (const l of document.querySelectorAll("label"))
      if (l.textContent?.includes(labelText)) {
        input = (l.closest('div[style*="position: relative"]') || l.closest("div"))?.querySelector('input[type="file"]');
        break;
      }
    if (!input) input = document.querySelectorAll('input[type="file"][accept*="jpeg"]')[fallbackIndex] || null;
    if (input) await attachFile(input, file);
    await sleep(250);
  };

  const tickFitness = async (root, s) => {
    const groups = Array.from(root.querySelectorAll('#fitness, [id*="fitness"]'));
    const group = groups.length
      ? groups.slice().reverse().find(shown) || groups[groups.length - 1]
      : Array.from(root.querySelectorAll('div[class*="radioGroup"]')).find((g) => g.textContent.includes("Mentally Fit"));
    if (!group) return;
    for (const box of group.querySelectorAll('input[type="checkbox"][name="fitness"]')) {
      const label = box.closest("label")?.textContent?.toLowerCase() || "";
      const want = (s.mentallyFit && label.includes("mentally")) || (s.physicallyFit && label.includes("physically"));
      if (!want || box.checked) continue;
      box.click();
      await sleep(150);
    }
  };

  const saveAndAdd = async () => {
    await sleep(400);
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim().includes("Save and Add Sevak") && !b.disabled);
    if (!btn) return;
    btn.click();
    for (let i = 0; i < 30; i++) {
      await sleep(50);
      for (const dlg of document.querySelectorAll('[role="dialog"]')) {
        const txt = (dlg.textContent || "").toLowerCase();
        if (!txt.includes("validation") && !txt.includes("alert")) continue;
        const msg = dlg.querySelector('[class*="subTitle"]')?.textContent.trim() || "Backend validation failed";
        const retry = Array.from(dlg.querySelectorAll("button")).find((b) => b.textContent?.includes("Retry"));
        const close = dlg.querySelector('img[src*="cross"]');
        if (retry) retry.click();
        else if (close) close.click();
        throw new Error(`TTD validation: ${msg}`);
      }
    }
  };

  T.seva = { fillSevak };
})();

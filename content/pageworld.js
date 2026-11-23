// Runs in the page's MAIN world. The isolated content script cannot see page
// expandos (React's __reactProps$*, window.angular), so it marks a target
// element with a one-shot attribute token and asks this bridge to act on it.
(() => {
  const CHANNEL = "TTDPA_BRIDGE";
  const TOKEN_ATTR = "data-ttdpa-target";
  const VERSION = 1;

  const takeTarget = (token) => {
    if (!token) return null;
    const el = document.querySelector(`[${TOKEN_ATTR}="${CSS.escape(String(token))}"]`);
    if (el) el.removeAttribute(TOKEN_ATTR);
    return el;
  };

  const reactProps = (el) => {
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
    return key ? el[key] : null;
  };

  const hasReactRoot = () =>
    [document.documentElement, document.body, document.body && document.body.firstElementChild].some(
      (el) => el && Object.keys(el).some((k) => k.startsWith("__reactContainer$") || k.startsWith("__reactFiber$")),
    );

  const ng = () => (window.angular && typeof window.angular.element === "function" ? window.angular : null);

  const ngState = (el) => {
    const cl = el && el.classList;
    if (!cl || ![...cl].some((c) => c.startsWith("ng-"))) return "plain";
    if (cl.contains("ng-invalid")) return "rejected";
    if (cl.contains("ng-dirty")) return "accepted";
    return "untouched";
  };

  const nativeSetValue = (el, value) => {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  };

  const fire = (el, type, init = {}) => {
    const Ctor = type.startsWith("pointer") && typeof PointerEvent === "function" ? PointerEvent : type.startsWith("mouse") ? MouseEvent : Event;
    try {
      el.dispatchEvent(new Ctor(type, init));
    } catch {
      const { view, ...rest } = init;
      try {
        el.dispatchEvent(new Ctor(type, rest));
      } catch {}
    }
  };

  const fireInputChange = (el, blur) => {
    fire(el, "input", { bubbles: true });
    fire(el, "change", { bubbles: true });
    if (blur) fire(el, "blur", { bubbles: true });
  };

  const TYPEABLE = new Set(["text", "search", "tel", "email", "url", "password", "number", "date"]);
  const isTypeable = (el) =>
    el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TYPEABLE.has(String(el.type || "text").toLowerCase()));

  // execCommand("insertText") makes the browser emit genuine beforeinput/input
  // events, which frameworks that ignore synthetic events still accept.
  const typeValue = (el, value, blur) => {
    try {
      el.focus({ preventScroll: true });
    } catch {}
    nativeSetValue(el, "");
    if (document.activeElement === el) {
      try {
        document.execCommand("insertText", false, value);
      } catch {}
    }
    if ((el.value || "") !== value) {
      nativeSetValue(el, value);
      fireInputChange(el, false);
    }
    if (blur) {
      try {
        el.blur();
      } catch {}
    }
    return (el.value || "") === value;
  };

  const callReactHandler = (el, handler) => {
    const props = reactProps(el);
    if (!props || typeof props[handler] !== "function") return false;
    const type = handler === "onChange" ? "change" : "click";
    const noop = () => {};
    const evt = {
      target: el,
      currentTarget: el,
      type,
      isTrusted: true,
      nativeEvent: { target: el, currentTarget: el, type, isTrusted: true, preventDefault: noop, stopPropagation: noop },
      preventDefault: noop,
      stopPropagation: noop,
      persist: noop,
    };
    try {
      props[handler](evt);
      return true;
    } catch {
      return false;
    }
  };

  const syntheticClick = (el) => {
    try {
      el.scrollIntoView({ block: "center", inline: "center" });
    } catch {}
    const r = el.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    fire(el, "pointerdown", { ...init, pointerId: 1 });
    fire(el, "mousedown", init);
    fire(el, "pointerup", { ...init, pointerId: 1 });
    fire(el, "mouseup", init);
    try {
      el.click();
      return true;
    } catch {
      return false;
    }
  };

  const isFormSubmit = (el) => {
    const type = String(el.type || "").toLowerCase();
    const submit = (el.tagName === "BUTTON" && (type || "submit") === "submit") || (el.tagName === "INPUT" && type === "submit");
    return submit && !!(el.form || el.closest("form"));
  };

  const ngScope = (el) => {
    const a = ng();
    for (let n = el; a && n && n !== document; n = n.parentElement) {
      const w = a.element(n);
      const s = (w.isolateScope && w.isolateScope()) || (w.scope && w.scope());
      if (s) return s;
    }
    return null;
  };

  const ngApply = (scope, fn) => {
    try {
      if (scope.$root && scope.$root.$$phase) fn();
      else scope.$apply(fn);
      return true;
    } catch {
      try {
        fn();
        scope.$root && scope.$root.$digest();
        return true;
      } catch {
        return false;
      }
    }
  };

  const diag = () => {
    const a = ng();
    return { version: VERSION, angular: !!a, react: hasReactRoot(), path: location.pathname };
  };

  const ops = {
    ping: () => ({ ok: true, diag: diag() }),

    setValue: (msg) => {
      const el = takeTarget(msg.token);
      if (!el) return { ok: false, reason: "stale-target" };
      const value = msg.value == null ? "" : String(msg.value);
      let trusted = false;
      if (!msg.eventsOnly && isTypeable(el)) trusted = typeValue(el, value, !!msg.blur);
      else {
        nativeSetValue(el, value);
        fireInputChange(el, !!msg.blur);
      }
      return { ok: true, trusted, written: (el.value || "") === value, ngState: ngState(el) };
    },

    click: (msg) => {
      const el = takeTarget(msg.token);
      if (!el) return { ok: false, reason: "stale-target" };
      if (msg.guarded && !isFormSubmit(el) && callReactHandler(el, "onClick")) return { ok: true, clicked: true, via: "react" };
      return { ok: true, clicked: syntheticClick(el), via: "events" };
    },

    announce: (msg) => {
      const el = takeTarget(msg.token);
      if (!el) return { ok: false, reason: "stale-target" };
      const told = callReactHandler(el, "onChange");
      if (!told) fireInputChange(el, !!msg.blur);
      return { ok: true, told };
    },

    // Angular calendar cell: invoke the directive's select(newItem) directly.
    ngSelectDay: (msg) => {
      const el = takeTarget(msg.token);
      if (!el) return { ok: false, reason: "stale-target" };
      const scope = ngScope(el);
      let s = scope;
      let day = null;
      let select = null;
      while (s && !(day && select)) {
        if (!day && s.day) day = s.day;
        if (!select && typeof s.select === "function") select = s.select;
        s = s.$parent;
      }
      if (!scope || !day || !select) return { ok: false, reason: "no-scope" };
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, view: window });
      return { ok: ngApply(scope, () => select({ newItem: day, event })) };
    },

    // Clear a property on the Srivani page controller (sripgc).
    ngClearModel: (msg) => {
      const el = takeTarget(msg.token);
      if (!el) return { ok: false, reason: "stale-target" };
      let s = ngScope(el);
      while (s && !s.sripgc) s = s.$parent;
      if (!s) return { ok: false, reason: "no-scope" };
      const ctrl = s.sripgc;
      return { ok: ngApply(s, () => (ctrl[msg.key] = "")) };
    },

    // Build the File here so the page receives native objects (Firefox content-script Files are
    // cross-compartment), then let React's onChange see it.
    attachFile: (msg) => {
      const el = takeTarget(msg.token);
      if (!el) return { ok: false, reason: "stale-target" };
      const { name, type, data } = msg.file || {};
      if (!data) return { ok: false, reason: "no-data" };
      const bin = atob(String(data).split(",")[1] || "");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name || "file", { type: type || "" }));
      el.files = dt.files;
      fire(el, "input", { bubbles: true });
      fire(el, "change", { bubbles: true });
      return { ok: true, attached: el.files.length > 0 };
    },
  };

  const reply = (id, payload) => {
    try {
      window.postMessage({ [CHANNEL]: "res", id, ...payload }, "*");
    } catch {}
  };

  window.addEventListener("message", (event) => {
    const msg = event.data;
    // Content-script messages arrive with a Firefox Xray source, so don't compare event.source.
    if (!msg || typeof msg !== "object" || msg[CHANNEL] !== "req") return;
    const op = ops[msg.op];
    let result;
    try {
      result = op ? op(msg) : { ok: false, reason: "unknown-op" };
    } catch {
      result = { ok: false, reason: "bridge-error" };
    }
    reply(msg.id, result);
  });

  const announceReady = () => {
    try {
      window.postMessage({ [CHANNEL]: "ready", diag: diag() }, "*");
    } catch {}
  };
  let beats = 0;
  const heartbeat = () => {
    announceReady();
    if (++beats < 4) setTimeout(heartbeat, 1200);
  };
  heartbeat();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", announceReady, { once: true });
})();

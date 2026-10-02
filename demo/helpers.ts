import fs from "node:fs";

import { expect, type Locator, type Page } from "@playwright/test";

export const DEMO_EMAIL = process.env.DEMO_EMAIL || "danigrande@live.com";
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "pist2806";
export const DEMO_GROUP = process.env.DEMO_GROUP || "Demo group";
export const DEMO_NAME = process.env.DEMO_NAME || "Dani";
export const DEMO_USER_ID = process.env.DEMO_USER_ID || "69ef377aff316fe198c970b7";

export interface DemoOptions {
  /** Render a phone status bar + home indicator and inset the app (mobile clips). */
  device?: boolean;
}

// Caption timing recorder — captions are burned in post-processing, not rendered in-app.
let captions: { t: number; text: string }[] = [];
let startTime = 0;

export function demoStart(): void {
  captions = [];
  startTime = Date.now();
}

export function caption(text: string): void {
  captions.push({ t: Date.now(), text });
}

export function demoEnd(file: string): void {
  fs.writeFileSync(file, JSON.stringify({ t0: startTime, tEnd: Date.now(), captions }, null, 2));
}

/**
 * Injected before app scripts. Renders a synthetic cursor (with pulse + click ripple),
 * an attention callout API, and — when `device` is set — a phone status bar + home indicator.
 */
function demoOverlayInit(options: DemoOptions = {}): void {
  const device = Boolean(options.device);

  const install = (): void => {
    if (!document.body) return;

    if (!document.getElementById("__demo_style")) {
      const style = document.createElement("style");
      style.id = "__demo_style";
      style.textContent =
        "@keyframes __demo_pulse{0%{transform:translate(-2px,-2px) scale(1)}50%{transform:translate(-2px,-2px) scale(1.12)}100%{transform:translate(-2px,-2px) scale(1)}}" +
        "@keyframes __demo_ring{0%{opacity:.9;transform:scale(.96)}100%{opacity:0;transform:scale(1.04)}}";
      document.head.appendChild(style);
    }

    if (device && !document.getElementById("__device_status")) {
      const fg = "#f3f4f6";
      const SIGNAL =
        `<svg width="18" height="12" viewBox="0 0 18 12" fill="${fg}">` +
        '<rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/>' +
        '<rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>';
      const WIFI =
        `<svg width="17" height="12" viewBox="0 0 17 12" fill="${fg}">` +
        '<path d="M8.5 2.2c2.4 0 4.6.9 6.2 2.4l1.3-1.4C14.1 1.4 11.4.3 8.5.3S2.9 1.4 1 3.2l1.3 1.4C3.9 3.1 6.1 2.2 8.5 2.2z"/>' +
        '<path d="M8.5 5.6c1.5 0 2.9.6 3.9 1.6l1.3-1.4c-1.4-1.4-3.3-2.2-5.2-2.2S4.7 4.4 3.3 5.8l1.3 1.4c1-1 2.4-1.6 3.9-1.6z"/>' +
        '<path d="M8.5 9c.7 0 1.3.3 1.8.8l-1.8 2-1.8-2c.5-.5 1.1-.8 1.8-.8z"/></svg>';
      const BATTERY =
        `<svg width="25" height="12" viewBox="0 0 25 12" fill="none">` +
        `<rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="${fg}" opacity="0.4"/>` +
        `<rect x="2" y="2" width="18" height="8" rx="1.5" fill="${fg}"/>` +
        `<rect x="22.5" y="4" width="1.5" height="4" rx="0.75" fill="${fg}" opacity="0.4"/></svg>`;
      const bar = document.createElement("div");
      bar.id = "__device_status";
      bar.style.cssText =
        "position:fixed;top:0;left:0;right:0;height:44px;z-index:2147483647;display:flex;" +
        "align-items:center;justify-content:space-between;padding:0 24px;pointer-events:none;" +
        `background:#0a0e27;color:${fg};font:600 15px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
      bar.innerHTML = `<span>9:41</span><span style="display:flex;align-items:center;gap:6px">${SIGNAL}${WIFI}${BATTERY}</span>`;
      document.body.appendChild(bar);

      const home = document.createElement("div");
      home.id = "__device_home";
      home.style.cssText =
        "position:fixed;bottom:8px;left:50%;transform:translateX(-50%);width:134px;height:5px;" +
        "border-radius:3px;background:rgba(243,244,246,.4);z-index:2147483647;pointer-events:none";
      document.body.appendChild(home);
    }

    if (!document.getElementById("__demo_cursor")) {
      const cursor = document.createElement("div");
      cursor.id = "__demo_cursor";
      cursor.style.cssText =
        "position:fixed;left:-100px;top:-100px;z-index:2147483647;width:30px;height:30px;" +
        "pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));" +
        "animation:__demo_pulse 1.6s ease-in-out infinite;transition:left 60ms linear,top 60ms linear";
      cursor.innerHTML =
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M4 2.5 L4 19.5 L8.4 15.4 L11.2 21.5 L13.7 20.3 L10.9 14.3 L17.5 14.1 Z" ' +
        'fill="#ffffff" stroke="#111827" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.body.appendChild(cursor);

      window.addEventListener("mousemove", (e) => {
        const ev = e as MouseEvent;
        cursor.style.left = `${ev.clientX}px`;
        cursor.style.top = `${ev.clientY}px`;
      }, true);

      window.addEventListener("mousedown", (e) => {
        const ev = e as MouseEvent;
        const ripple = document.createElement("div");
        ripple.style.cssText =
          `position:fixed;left:${ev.clientX}px;top:${ev.clientY}px;width:12px;height:12px;` +
          "border:3px solid rgba(245,166,35,.9);border-radius:50%;pointer-events:none;" +
          "transform:translate(-50%,-50%);z-index:2147483646;opacity:1;" +
          "transition:width .5s ease-out,height .5s ease-out,opacity .5s ease-out";
        document.body.appendChild(ripple);
        requestAnimationFrame(() => {
          ripple.style.width = "80px";
          ripple.style.height = "80px";
          ripple.style.opacity = "0";
        });
        window.setTimeout(() => ripple.remove(), 550);
      }, true);
    }
  };

  const w = window as unknown as {
    __callout?: (rect: { x: number; y: number; width: number; height: number }, label?: string, ms?: number) => void;
    __clearCallout?: () => void;
  };

  w.__clearCallout = (): void => {
    document.getElementById("__demo_callout")?.remove();
    document.getElementById("__demo_callout_ring")?.remove();
  };

  w.__callout = (rect, label, ms = 2400): void => {
    w.__clearCallout?.();
    const el = document.createElement("div");
    el.id = "__demo_callout";
    el.style.cssText =
      `position:fixed;left:${rect.x - 6}px;top:${rect.y - 6}px;width:${rect.width + 12}px;height:${rect.height + 12}px;` +
      "border:3px solid #f5a623;border-radius:12px;pointer-events:none;z-index:2147483645;" +
      "box-shadow:0 0 0 4px rgba(245,166,35,.18), 0 0 24px rgba(245,166,35,.35)";
    document.body.appendChild(el);
    if (label) {
      const tag = document.createElement("div");
      tag.style.cssText =
        "position:absolute;left:0;top:-34px;background:#f5a623;color:#fff;font:700 14px Inter,system-ui,sans-serif;" +
        "padding:4px 12px;border-radius:8px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.35)";
      tag.textContent = label;
      el.appendChild(tag);
    }
    const ring = el.cloneNode(false) as HTMLElement;
    ring.id = "__demo_callout_ring";
    ring.style.cssText += ";animation:__demo_ring 1.2s ease-out infinite";
    document.body.appendChild(ring);
    window.setTimeout(() => w.__clearCallout?.(), ms);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
}

export async function setupDemoPage(page: Page, options: DemoOptions = {}): Promise<void> {
  await page.addInitScript(demoOverlayInit, { device: Boolean(options.device) });
}

export async function beat(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Glide the synthetic cursor to an element, fire the ripple, then click. */
export async function clickItem(
  page: Page,
  locator: Locator,
  opts: { after?: number } = {},
): Promise<void> {
  const target = locator.first();
  await target.waitFor({ state: "visible" });
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
    await page.waitForTimeout(260);
  }
  await target.click();
  await page.waitForTimeout(opts.after ?? 340);
}

/** Draw an animated attention callout around an element, optionally labelled. */
export async function highlight(
  page: Page,
  locator: Locator,
  label?: string,
  ms = 2400,
): Promise<void> {
  const box = await locator.first().boundingBox();
  if (!box) return;
  await page.evaluate(
    ({ rect, text, duration }) => {
      const w = window as unknown as {
        __callout?: (r: { x: number; y: number; width: number; height: number }, l?: string, m?: number) => void;
      };
      w.__callout?.(rect, text, duration);
    },
    { rect: box, text: label, duration: ms },
  );
  await page.waitForTimeout(ms);
}

type AuthVars = {
  email: string;
  password: string;
  group: string;
  name: string;
  userId: string;
};

/**
 * Seeds the World Cup web app session (localStorage) before any page script runs.
 * The web app reads `worldcup2026_user` in `shared_ui.checkAuth()`.
 */
function seedWebAuth(v: AuthVars): void {
  try {
    localStorage.setItem(
      "worldcup2026_user",
      JSON.stringify({
        email: v.email,
        name: v.name,
        userId: v.userId,
        groupName: v.group,
        isAdmin: true,
      }),
    );
    localStorage.setItem("worldcup2026_onboarding_done", "true");
    localStorage.setItem("language", "en");
  } catch {
    /* ignore */
  }
}

/**
 * Seeds the mobile (Expo web) session. AsyncStorage on web is backed by
 * localStorage under the exact key `porra_mundial_auth`.
 */
function seedMobileAuth(v: AuthVars): void {
  try {
    localStorage.setItem(
      "porra_mundial_auth",
      JSON.stringify({
        userId: v.userId,
        email: v.email,
        password: v.password,
        name: v.name,
        currentGroup: v.group,
        groups: [v.group],
        isAdmin: true,
        mustChangePassword: false,
      }),
    );
  } catch {
    /* ignore */
  }
}

const AUTH_VARS: AuthVars = {
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  group: DEMO_GROUP,
  name: DEMO_NAME,
  userId: DEMO_USER_ID,
};

/** Configure the page for the static web app and navigate to a logged-in route. */
export async function gotoWeb(page: Page, path: string): Promise<void> {
  await page.addInitScript(seedWebAuth, AUTH_VARS);
  await page.goto(path);
}

/** Configure the page for the Expo web app and navigate to a logged-in route. */
export async function gotoMobile(page: Page, path = "/"): Promise<void> {
  await page.addInitScript(seedMobileAuth, AUTH_VARS);
  await page.goto(path);
}

/**
 * Inject an iOS-style on-screen keyboard (Expo web has no native keyboard) and
 * lift the message input bar above it so typing is visible in the recording.
 */
export async function showKeyboard(page: Page, height = 300): Promise<void> {
  await page.evaluate((h) => {
    const w = window as unknown as { __demo_lifted?: HTMLElement | null };
    if (document.getElementById("__demo_keyboard")) return;

    const kb = document.createElement("div");
    kb.id = "__demo_keyboard";
    kb.style.cssText =
      `position:fixed;left:0;right:0;bottom:0;height:${h}px;z-index:2147483644;` +
      "background:#cbd5e1;border-top:1px solid #94a3b8;display:flex;flex-direction:column;" +
      "justify-content:flex-start;gap:6px;padding:10px 6px;box-sizing:border-box;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";

    const key = (label: string, extra = "") =>
      `<div style="flex:1;display:flex;align-items:center;justify-content:center;background:#fff;` +
      `border-radius:5px;font-size:15px;color:#111;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.2);${extra}">${label}</div>`;

    const row = (letters: string) =>
      `<div style="display:flex;justify-content:center;gap:5px;height:40px;">${[...letters].map((k) => key(k)).join("")}</div>`;

    kb.innerHTML =
      row("QWERTYUIOP") +
      row("ASDFGHJKL") +
      `<div style="display:flex;justify-content:center;gap:5px;height:40px;">` +
      key("⇧", "flex:0 0 46px;background:#e5e7eb;") +
      [..."ZXCVBNM"].map((k) => key(k)).join("") +
      key("⌫", "flex:0 0 46px;background:#e5e7eb;") +
      `</div>` +
      `<div style="display:flex;justify-content:center;gap:5px;height:40px;">` +
      key("123", "flex:0 0 56px;background:#e5e7eb;font-size:12px;") +
      key("space", "max-width:200px;color:#64748b;font-size:12px;") +
      key("return", "flex:0 0 76px;background:#3b82f6;color:#fff;font-size:12px;") +
      `</div>`;
    document.body.appendChild(kb);

    const ta = document.querySelector("textarea[placeholder], input[placeholder]") as HTMLElement | null;
    let bar: HTMLElement | null = ta;
    for (let i = 0; i < 3 && bar; i += 1) bar = bar.parentElement;
    if (bar) {
      w.__demo_lifted = bar;
      bar.style.transition = "transform .25s ease";
      bar.style.transform = `translateY(-${h}px)`;
    }
  }, height);
}

/** Remove the synthetic keyboard and restore the input bar position. */
export async function hideKeyboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __demo_lifted?: HTMLElement | null };
    document.getElementById("__demo_keyboard")?.remove();
    if (w.__demo_lifted) {
      w.__demo_lifted.style.transform = "";
      w.__demo_lifted = null;
    }
  });
}

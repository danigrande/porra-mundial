// Generates e2e/demo/assets/phone-frame.png — a phone bezel with a transparent
// screen cutout (390x844) and a dynamic island. Run once: node e2e/demo/make-phone-frame.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "assets");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "phone-frame.png");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: transparent; width: 418px; height: 872px; }
  .phone {
    position: relative; width: 418px; height: 872px; box-sizing: border-box;
    border: 14px solid #0b0b0d; border-radius: 54px; background: transparent;
  }
  .gloss {
    position: absolute; inset: 0; border-radius: 40px;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.10);
  }
  .island {
    position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
    width: 118px; height: 34px; background: #000; border-radius: 17px;
  }
</style></head><body>
  <div class="phone"><div class="island"></div><div class="gloss"></div></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 418, height: 872 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.locator(".phone").screenshot({ path: out, omitBackground: true });
await browser.close();
console.log("wrote", out);

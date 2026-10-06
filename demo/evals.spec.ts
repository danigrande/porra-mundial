import { expect, test, type Page } from "@playwright/test";

import {
  beat,
  beginCut,
  caption,
  clickItem,
  demoEnd,
  demoMarkReady,
  demoStart,
  endCut,
  gotoWeb,
  setupDemoPage,
} from "./helpers";

const DEV_KEY = process.env.DEV_DASHBOARD_KEY || "agente-dev-2026";

test.beforeAll(async ({ request }) => {
  // Warm the free-tier backend so the dashboard loads quickly.
  await request.get("https://porra-mundial.onrender.com/health", { timeout: 90_000 }).catch(() => {});
});

async function navTab(page: Page, tab: string, panelId: string): Promise<void> {
  await clickItem(page, page.locator("#hamburger-btn"), { after: 350 });
  await clickItem(page, page.locator(`.menu-item[data-tab="${tab}"]`), { after: 400 });
  await expect(page.locator(`#panel-${panelId}`)).toBeVisible();
}

test("evals", async ({ page }, testInfo) => {
  await setupDemoPage(page);
  await page.addInitScript(() => {
    try { localStorage.setItem("devLang", "en"); } catch { /* ignore */ }
  });
  demoStart();

  // ── Login ───────────────────────────────────────────────────────────
  beginCut();
  await gotoWeb(page, "/dev_dashboard.html");
  const keyInput = page.locator("#dev-key-input");
  await expect(keyInput).toBeVisible({ timeout: 60_000 });
  endCut();
  await beat(page, 300);
  demoMarkReady();

  caption("The developer dashboard — where the quality of every AI call lives.");
  await clickItem(page, keyInput);
  await keyInput.pressSequentially(DEV_KEY, { delay: 12 });
  await keyInput.press("Enter");
  await expect(page.locator("#dashboard")).toBeVisible({ timeout: 30_000 });
  await beat(page, 900);

  // ── AI Logs ─────────────────────────────────────────────────────────
  caption("Every AI call is logged with its prompt, response, tokens and latency.");
  await navTab(page, "logs", "logs");
  await expect(page.locator("#logs-table-body tbody tr").first()).toBeVisible({ timeout: 30_000 });
  await beat(page, 900);
  await clickItem(page, page.locator("#logs-table-body tbody tr").first());
  await expect(page.locator("#log-modal.show")).toBeVisible();
  await beat(page, 2600);
  await clickItem(page, page.locator(".modal-close"));
  await beat(page, 700);

  // ── Evals (judge scores) ────────────────────────────────────────────
  caption("The judge scores every response on language purity and quality.");
  await navTab(page, "evals", "evals");
  await expect(page.locator("#evals-table-body tbody tr").first()).toBeVisible({ timeout: 30_000 });
  await beat(page, 2000);
  caption("…and breaks the scores down by language and by personality.");
  await beat(page, 2000);
  await clickItem(page, page.locator("#evals-table-body tbody tr").first());
  await expect(page.locator("#log-modal.show")).toBeVisible();
  await beat(page, 2600);
  await clickItem(page, page.locator(".modal-close"));
  await beat(page, 700);

  // ── Benchmarks (golden dataset) ─────────────────────────────────────
  caption("The golden dataset — 102 tests — is run against the model, and pass rates are tracked over time.");
  await navTab(page, "benchmarks", "benchmarks");
  await expect(page.locator("#run-history-body tbody tr").first()).toBeVisible({ timeout: 30_000 });
  await beat(page, 3400);

  // ── Human review ────────────────────────────────────────────────────
  caption("Downvotes, judge disagreements and force-approved replies land in the human-review queue.");
  await navTab(page, "reviews", "reviews");
  await expect(page.locator("#review-queue-body").getByText(/pending|Pending/).first()).toBeVisible({ timeout: 30_000 }).catch(() => {});
  await beat(page, 3000);

  // ── Corrections ─────────────────────────────────────────────────────
  caption("When a user corrects the bot, the correction is captured as a labelled signal.");
  await navTab(page, "corrections", "corrections");
  await beat(page, 2600);

  // ── RAG ─────────────────────────────────────────────────────────────
  caption("And the RAG knowledge base the bot draws on.");
  await navTab(page, "rag", "rag");
  await beat(page, 2600);

  caption("Measured, scored, reviewed — and only then trusted.");
  await beat(page, 1800);

  demoEnd(testInfo.outputPath("captions.json"));
});

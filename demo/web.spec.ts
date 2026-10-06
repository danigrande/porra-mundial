import { expect, test } from "@playwright/test";

import {
  beat,
  caption,
  clickItem,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  demoEnd,
  demoStart,
  gotoWeb,
  setupDemoPage,
} from "./helpers";

test.beforeAll(async ({ request }) => {
  // Warm up the free-tier backend so the first login lookup is fast.
  await request.get("https://porra-mundial.onrender.com/health", { timeout: 90_000 }).catch(() => {});
});

test("web", async ({ page }, testInfo) => {
  await setupDemoPage(page);
  await page.addInitScript(() => {
    try { localStorage.setItem("devLang", "en"); } catch { /* ignore */ }
  });
  demoStart();

  // ── 0. Login ────────────────────────────────────────────────────────
  await page.goto("/");
  caption("Sign in with your email and your group.");
  await page.locator("#loginEmail").click();
  await page.locator("#loginEmail").pressSequentially(DEMO_EMAIL, { delay: 40 });
  await expect(page.locator('#loginGroupSelect option[value="Demo group"]')).toHaveCount(1, {
    timeout: 60_000,
  });
  await page.locator("#loginGroupSelect").selectOption("Demo group");
  await page.locator("#loginPassword").click();
  await page.locator("#loginPassword").pressSequentially(DEMO_PASSWORD, { delay: 60 });
  await clickItem(page, page.locator("#btnLogin"));
  await page.waitForURL(/player_scores\.html/, { timeout: 30_000 });
  await beat(page, 1500);

  // ── 1. My Predictions ───────────────────────────────────────────────
  await gotoWeb(page, "/worldcup.html");
  caption("Agente Mundial turns the World Cup into a shared prediction game.");
  await expect(page.locator("#groupsGrid .group-card").first()).toBeVisible();
  await beat(page, 2200);
  caption("Every player fills a full bracket — scores for all 104 matches.");
  await beat(page, 2200);

  // ── 2. The Wall ─────────────────────────────────────────────────────
  await gotoWeb(page, "/pool.html");
  caption("The Wall lays every player's picks side by side.");
  await expect(page.locator("#poolTable")).toBeVisible();
  await beat(page, 2600);
  caption("Spot the rival who shares your exact score.");
  await beat(page, 2200);

  // ── 3. Leaderboard ──────────────────────────────────────────────────
  await gotoWeb(page, "/player_scores.html");
  caption("A live leaderboard, updated after every result.");
  await expect(page.locator("#leaderboardContainer")).toBeVisible();
  await beat(page, 2600);
  caption("Points, exact scores, and knockout runs — all automatic.");
  await beat(page, 2400);

  // ── 4. DevOps panel (optional — needs DEV_DASHBOARD_KEY) ────────────
  const devKey = process.env.DEV_DASHBOARD_KEY;
  if (devKey) {
    // Open the hamburger and click a real menu entry (visible navigation).
    const navTab = async (tab: string, panelId: string) => {
      await clickItem(page, page.locator("#hamburger-btn"), { after: 500 });
      await clickItem(page, page.locator(`.menu-item[data-tab="${tab}"]`), { after: 400 });
      await expect(page.locator(`#panel-${panelId}`)).toBeVisible();
    };

    await gotoWeb(page, "/dev_dashboard.html");
    caption("Behind the scenes: the DevOps panel runs the AI agent.");
    await expect(page.locator("#dev-key-input")).toBeVisible();
    await page.locator("#dev-key-input").fill(devKey);
    await page.locator("#dev-key-input").press("Enter");
    await expect(page.locator("#dashboard")).toBeVisible();
    await beat(page, 700);

    await clickItem(page, page.locator("#hamburger-btn"), { after: 300 });
    caption("Health, logs, evals, benchmarks, RAG, users and more — all in one panel.");
    await beat(page, 1200);
    await page.keyboard.press("Escape");

    await navTab("users", "users");
    await expect(page.locator("#users-table-body tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => {
      document.querySelectorAll("#users-table-body tbody tr").forEach((tr) => {
        const cell = tr.querySelector("td:nth-child(2)");
        if (!cell) return;
        const text = cell.textContent || "";
        const m = text.match(/@(.+)$/);
        cell.textContent = "d•••••@" + (m ? m[1].trim() : "•••••");
      });
    });
    caption("Group and user management, fully scripted.");
    await beat(page, 900);

    await navTab("rag", "rag");
    caption("RAG explorer — the agent's live knowledge base.");
    await beat(page, 900);

    // ── AI logs — open a row ──────────────────────────────────────────
    await navTab("logs", "logs");
    await expect(page.locator("#logs-table-body tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await beat(page, 500);
    caption("Every AI call is logged with full prompt, tokens and latency.");
    await clickItem(page, page.locator("#logs-table-body tbody tr").first());
    await expect(page.locator("#log-modal.show")).toBeVisible();
    await beat(page, 1100);
    await page.keyboard.press("Escape");
    await expect(page.locator("#log-modal")).not.toHaveClass(/show/);

    // ── Evals — open a row, expand collapsibles ───────────────────────
    await navTab("evals", "evals");
    await expect(page.locator("#evals-table-body tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await beat(page, 500);
    caption("The judge scores every response on language purity and quality.");
    await clickItem(page, page.locator("#evals-table-body tbody tr").first());
    await expect(page.locator("#log-modal.show")).toBeVisible();
    await beat(page, 600);

    const details = page.locator("#modal-body details");
    const n = Math.min(await details.count(), 3);
    for (let i = 0; i < n; i += 1) {
      await clickItem(page, details.nth(i), { after: 120 });
      await beat(page, 350);
    }
    caption("System prompt, RAG context and technical details — all inspectable.");
    await beat(page, 900);
    await page.keyboard.press("Escape");
  }

  caption("Agente Mundial — the World Cup, reinvented.");
  await beat(page, 900);

  demoEnd(testInfo.outputPath("captions.json"));
});

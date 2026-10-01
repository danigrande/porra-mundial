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

test("web", async ({ page }, testInfo) => {
  await setupDemoPage(page);
  demoStart();

  // ── 0. Login ────────────────────────────────────────────────────────
  await page.goto("/");
  caption("Sign in with your email and your group.");
  await page.locator("#loginEmail").click();
  await page.locator("#loginEmail").pressSequentially(DEMO_EMAIL, { delay: 40 });
  await expect(page.locator('#loginGroupSelect option[value="Demo group"]')).toHaveCount(1, {
    timeout: 20_000,
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
    await gotoWeb(page, "/dev_dashboard.html");
    caption("Behind the scenes: the DevOps panel runs the AI agent.");
    await expect(page.locator("#dev-key-input")).toBeVisible();
    await page.locator("#dev-key-input").fill(devKey);
    await page.locator("#dev-key-input").press("Enter");
    await expect(page.locator("#dashboard")).toBeVisible();
    await beat(page, 800);
    await clickItem(page, page.locator("#lang-toggle"));
    await beat(page, 800);

    await page.evaluate(() => (window as unknown as { switchTab?: (t: string) => void }).switchTab?.("users"));
    await expect(page.locator("#panel-users")).toBeVisible();
    caption("Group and user management, fully scripted.");
    await beat(page, 2400);

    await page.evaluate(() => (window as unknown as { switchTab?: (t: string) => void }).switchTab?.("rag"));
    await expect(page.locator("#panel-rag")).toBeVisible();
    caption("RAG explorer — the agent's live knowledge base.");
    await beat(page, 2400);
  }

  caption("Agente Mundial — the World Cup, reinvented.");
  await beat(page, 1800);

  demoEnd(testInfo.outputPath("captions.json"));
});

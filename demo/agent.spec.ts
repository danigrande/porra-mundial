import { expect, test } from "@playwright/test";

import {
  beat,
  caption,
  clickItem,
  demoEnd,
  demoStart,
  gotoWeb,
  setupDemoPage,
} from "./helpers";

const DEV_KEY = process.env.DEV_DASHBOARD_KEY || "agente-dev-2026";

test("agent", async ({ page }, testInfo) => {
  await setupDemoPage(page);
  demoStart();

  // The dashboard uses native confirm()/alert() for actions — auto-accept them.
  page.on("dialog", (dialog) => dialog.accept());

  // ── 0. Dev dashboard login ──────────────────────────────────────────
  await gotoWeb(page, "/dev_dashboard.html");
  caption("Behind the scenes: the developer dashboard.");
  const keyInput = page.locator("#dev-key-input");
  await expect(keyInput).toBeVisible({ timeout: 60_000 });
  await clickItem(page, keyInput);
  await keyInput.pressSequentially(DEV_KEY, { delay: 40 });
  await keyInput.press("Enter");
  await expect(page.locator("#dashboard")).toBeVisible({ timeout: 30_000 });
  await beat(page, 1200);

  await clickItem(page, page.locator("#lang-toggle"));
  await beat(page, 700);

  // ── 1. Feedback inbox ───────────────────────────────────────────────
  await clickItem(page, page.locator("#hamburger-btn"), { after: 400 });
  await clickItem(page, page.locator('.menu-item[data-tab="feedback"]'), { after: 500 });
  await expect(page.locator("#panel-feedback")).toBeVisible();
  await expect(page.locator("#feedback-table-body table")).toBeVisible({ timeout: 30_000 });
  caption("Raw user feedback, waiting to be triaged.");
  await beat(page, 2600);

  // ── 2. Analyse with the three-agent pipeline ────────────────────────
  caption("Three agents read it and prioritise it against the product strategy.");
  const analyzeResp = page.waitForResponse(
    (r) => r.url().includes("/api/dev/feedback/analyze-all"),
    { timeout: 180_000 },
  );
  await clickItem(
    page,
    page.getByRole("button", { name: /Analizar todo|Analyze all/ }),
    { after: 400 },
  );
  await analyzeResp;
  await expect(page.locator("#feedback-table-body table")).toBeVisible({ timeout: 30_000 });
  await beat(page, 1500);
  caption("Priority assigned — a scoring bug outranks a nice-to-have.");
  await beat(page, 2800);

  // ── 3. Generate a PRD ───────────────────────────────────────────────
  caption("One click drafts a structured product requirement.");
  const generateResp = page.waitForResponse(
    (r) => r.url().includes("/api/dev/prds/generate/"),
    { timeout: 180_000 },
  );
  await clickItem(
    page,
    page.locator("#feedback-table-body tbody tr").first().locator('button[title="Generar PRD"]'),
    { after: 400 },
  );
  await generateResp;
  await expect(page.locator("#panel-prds")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#prds-table-body table")).toBeVisible({ timeout: 30_000 });
  await beat(page, 2000);

  // ── 4. Review the PRD ───────────────────────────────────────────────
  await clickItem(page, page.locator("#prds-table-body tbody tr").first(), { after: 500 });
  await expect(page.locator("#log-modal.show")).toBeVisible();
  caption("Problem, proposed solution, impact, and testable acceptance criteria.");
  await beat(page, 3800);

  // ── 5. Approve ──────────────────────────────────────────────────────
  caption("Nothing is built automatically — a human approves it.");
  await clickItem(
    page,
    page.locator("#modal-body").getByRole("button", { name: /Aprobar|Approve/ }),
    { after: 600 },
  );
  await beat(page, 1400);
  await page.keyboard.press("Escape");
  await expect(page.locator("#log-modal")).not.toHaveClass(/show/);
  await beat(page, 1200);

  caption("Approved PRDs are exposed at an endpoint a coding agent can consume.");
  await beat(page, 2400);

  demoEnd(testInfo.outputPath("captions.json"));
});

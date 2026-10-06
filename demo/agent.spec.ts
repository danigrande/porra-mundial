import { expect, test } from "@playwright/test";

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
  // Warm the free-tier backend so login and the agent pipeline stay snappy.
  await request.get("https://porra-mundial.onrender.com/health", { timeout: 90_000 }).catch(() => {});
});

test("agent", async ({ page }, testInfo) => {
  await setupDemoPage(page);
  demoStart();

  // The dashboard uses native confirm()/alert() for actions — auto-accept them.
  page.on("dialog", (dialog) => dialog.accept());

  // ── 0. Users capture feedback and vote ──────────────────────────────
  // Mark "ready" once the page is up: everything before it (page load, white
  // flash) is trimmed in post so the clip opens on real content.
  await gotoWeb(page, "/feedback.html");
  const subject = page.locator("#fbSubject");
  await expect(subject).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#fbHistoryBody tr.fb-row").first()).toBeVisible({ timeout: 30_000 });
  await beat(page, 350);
  demoMarkReady();

  caption("Users report bugs and upvote ideas, right inside the app.");
  await beat(page, 1800);

  await clickItem(page, page.locator(".fb-type-btn.feature"));
  await clickItem(page, subject);
  await subject.pressSequentially("Notify me when a friend overtakes me", { delay: 10 });
  const detail = page.locator("#fbDetail");
  await clickItem(page, detail);
  await detail.pressSequentially(
    "I would like a heads-up when a friend passes me in the standings. It would make the pool feel alive and bring me back more often.",
    { delay: 3 },
  );
  await beat(page, 700);

  caption("Submitting the request.");
  await clickItem(page, page.locator("#fbSubmitBtn"), { after: 400 });
  await expect(page.locator("#fbStatus.status-success")).toBeVisible({ timeout: 30_000 });
  await beat(page, 1400);

  caption("And the group upvotes what matters most.");
  await clickItem(
    page,
    page.locator("#fbHistoryBody tr.fb-row").first().locator(".fb-vote-btn"),
    { after: 400 },
  );
  await beat(page, 1800);

  // ── 1. Dev dashboard login ──────────────────────────────────────────
  beginCut(); // cut the page navigation / white flash
  await gotoWeb(page, "/dev_dashboard.html");
  const keyInput = page.locator("#dev-key-input");
  await expect(keyInput).toBeVisible({ timeout: 60_000 });
  endCut();
  await beat(page, 300);

  caption("Behind the scenes: the developer dashboard.");
  await clickItem(page, keyInput);
  await keyInput.pressSequentially(DEV_KEY, { delay: 12 });
  await keyInput.press("Enter");
  await expect(page.locator("#dashboard")).toBeVisible({ timeout: 30_000 });
  await beat(page, 600);

  await clickItem(page, page.locator("#lang-toggle"));
  await beat(page, 350);

  // ── 2. Feedback inbox ───────────────────────────────────────────────
  await clickItem(page, page.locator("#hamburger-btn"), { after: 300 });
  await clickItem(page, page.locator('.menu-item[data-tab="feedback"]'), { after: 400 });
  await expect(page.locator("#panel-feedback")).toBeVisible();
  await expect(page.locator("#feedback-table-body table")).toBeVisible({ timeout: 30_000 });
  caption("The request is already waiting in the feedback inbox.");
  await beat(page, 2400);

  // ── 3. Analyse with the three-agent pipeline ────────────────────────
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
  beginCut(); // cut the pipeline wait so the clip never stalls
  await analyzeResp;
  await expect(page.locator("#feedback-table-body table")).toBeVisible({ timeout: 30_000 });
  await beat(page, 1200);
  endCut();
  caption("Priority assigned — a scoring bug outranks a nice-to-have.");
  await beat(page, 2800);

  // ── 4. Generate a PRD ───────────────────────────────────────────────
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
  beginCut(); // cut the generation wait
  await generateResp;
  await expect(page.locator("#panel-prds")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#prds-table-body table")).toBeVisible({ timeout: 30_000 });
  await beat(page, 1200);
  endCut();
  await beat(page, 1600);

  // ── 5. Review the PRD ───────────────────────────────────────────────
  await clickItem(page, page.locator("#prds-table-body tbody tr").first(), { after: 400 });
  beginCut(); // cut the detail load
  await expect(page.locator("#log-modal.show")).toBeVisible();
  await beat(page, 1000);
  endCut();
  caption("Problem, proposed solution, impact, and testable acceptance criteria.");
  await beat(page, 4200);

  // ── 6. Approve ──────────────────────────────────────────────────────
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

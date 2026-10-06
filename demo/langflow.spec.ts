import { expect, test } from "@playwright/test";

import { beat, caption, demoEnd, demoMarkReady, demoStart, setupDemoPage } from "./helpers";

const FLOW_ID = "1132c6e0-4baa-45b1-94b0-aa716b87ae64";

test("langflow", async ({ page }, testInfo) => {
  await setupDemoPage(page);
  demoStart();

  await page.goto(`/flow/${FLOW_ID}`);
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 60_000 });
  await beat(page, 1500);
  demoMarkReady();

  caption("The feedback-to-PRD flow, designed in LangFlow: three chained agents.");
  await beat(page, 3000);

  caption("Strategy Owner → PRD Writer → Juno Orchestrator.");
  await beat(page, 3000);

  demoEnd(testInfo.outputPath("captions.json"));
});

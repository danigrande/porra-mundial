import { expect, test, type Page } from "@playwright/test";

import {
  beat,
  caption,
  clickItem,
  DEMO_EMAIL,
  DEMO_GROUP,
  DEMO_PASSWORD,
  demoEnd,
  demoMarkReady,
  demoStart,
  hideKeyboard,
  setupDemoPage,
  showKeyboard,
} from "./helpers";

const API = "https://porra-mundial.onrender.com/api";
const USER_ID = "69ef377aff316fe198c970b7";

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${API}/profile?userId=${USER_ID}`);
  const current = (await res.json()).data ?? {};
  await request.post(`${API}/profile`, {
    data: {
      userId: USER_ID,
      groupName: DEMO_GROUP,
      profile: {
        nickname: current.nickname,
        likes: current.likes,
        dislikes: current.dislikes,
        humor_style: current.humor_style,
        ai_personality: "andres_montes",
        notificationPreference: current.notificationPreference,
      },
    },
  });
});

// Bottom tab order: 0 = Leaderboard, 1 = Results, 2 = Chat, 3 = My Prediction, 4 = More
async function tapTab(page: Page, index: number): Promise<void> {
  await clickItem(page, page.getByRole("tab").nth(index));
}

const INPUT = "Write a message...";

async function waitForChat(page: Page): Promise<void> {
  await expect(page.getByPlaceholder(INPUT)).toBeVisible({ timeout: 45_000 });
}

async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.getByPlaceholder(INPUT);
  await clickItem(page, input);
  await showKeyboard(page);
  await input.pressSequentially(text, { delay: 60 });
  await beat(page, 500);
  await clickItem(page, page.getByLabel("Send"));
  await hideKeyboard(page);
}

async function waitForAgentReply(page: Page): Promise<void> {
  const before = await page.getByText(/AI-generated summary/).count();
  await expect
    .poll(() => page.getByText(/AI-generated summary/).count(), { timeout: 90_000, intervals: [1000] })
    .toBeGreaterThan(before);
  await beat(page, 3000);
}

test("mobile", async ({ page }, testInfo) => {
  await setupDemoPage(page, { device: true });
  demoStart();

  // ── 0. Login ────────────────────────────────────────────────────────
  // Mark "ready" once the app has loaded so the blank start-up is trimmed.
  await page.goto("/");
  const email = page.getByPlaceholder("Email");
  await expect(email).toBeVisible({ timeout: 90_000 });
  await beat(page, 300);
  demoMarkReady();

  caption("Agente Mundial — your World Cup pool, in your pocket.");
  await clickItem(page, email);
  await email.pressSequentially(DEMO_EMAIL, { delay: 45 });
  await clickItem(page, page.getByLabel("Continue"));
  const groupPill = page.getByText(DEMO_GROUP, { exact: true });
  await expect(groupPill).toBeVisible({ timeout: 30_000 });
  await clickItem(page, groupPill);
  const password = page.getByPlaceholder("Password");
  await clickItem(page, password);
  await password.pressSequentially(DEMO_PASSWORD, { delay: 60 });
  await clickItem(page, page.getByLabel("Log in"));
  await expect(page.getByText(DEMO_GROUP).first()).toBeVisible({ timeout: 60_000 });
  await beat(page, 1500);

  // ── 1. Leaderboard ──────────────────────────────────────────────────
  caption("Live standings for your group — tap any player.");
  await expect(page.getByText("Tournament Finished").first()).toBeVisible({ timeout: 30_000 });
  await beat(page, 2400);

  // ── 2. Predictions ──────────────────────────────────────────────────
  await tapTab(page, 3);
  caption("Fill the bracket from anywhere.");
  await expect(page.getByRole("heading", { name: "My Prediction" })).toBeVisible();
  await expect(page.getByText("PROJECTED STANDINGS").first()).toBeVisible({ timeout: 30_000 });
  await beat(page, 2400);

  // ── 3. Chat: Andrés Montes ──────────────────────────────────────────
  await tapTab(page, 2);
  caption("Mention @agente — it answers in the group chat.");
  await waitForChat(page);
  await beat(page, 1500);
  await sendMessage(page, "@agente what did you think of the World Cup?");
  caption("Andrés Montes, the legendary commentator, takes the mic.");
  await waitForAgentReply(page);

  // ── 4. Switch personality to Donald Trump ───────────────────────────
  await tapTab(page, 4);
  caption("Pick your agent's personality and language.");
  await clickItem(page, page.getByText("My Profile", { exact: true }));
  await expect(page.getByText("AI Personality (Language)")).toBeVisible({ timeout: 30_000 });
  await clickItem(page, page.getByText(/Andrés Montes/).first());
  await clickItem(page, page.getByText(/Donald Trump/).first());
  await clickItem(page, page.getByText("Save AI Profile").first());
  await beat(page, 1500);

  // ── 5. Chat: Donald Trump ───────────────────────────────────────────
  await tapTab(page, 2);
  caption("Same group, new voice — Donald Trump takes over.");
  await waitForChat(page);
  await beat(page, 1500);
  await sendMessage(page, "@agente do you think I can win the next one?");
  await waitForAgentReply(page);

  // ── 6. Notifications ────────────────────────────────────────────────
  await tapTab(page, 4);
  caption("Fine-grained notifications, tuned to how you play.");
  await clickItem(page, page.getByText("Notifications", { exact: true }));
  await expect(page.getByText("All notifications").first()).toBeVisible({ timeout: 30_000 });
  await beat(page, 2400);

  caption("Agente Mundial — the World Cup, reinvented.");
  await beat(page, 1800);

  demoEnd(testInfo.outputPath("captions.json"));
});

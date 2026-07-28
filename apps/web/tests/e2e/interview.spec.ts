/**
 * tests/e2e/interview.spec.ts
 *
 * End-to-end tests for the /interview page.
 *
 * All tests in this file run inside the "chromium-authenticated" Playwright
 * project, which injects the storageState written by global.setup.ts. This
 * means every test starts fully logged in — no login step, no redirect.
 *
 * Browser launch flags set in playwright.config.ts:
 *   --use-fake-ui-for-media-stream   → auto-dismisses permission prompts
 *   --use-fake-device-for-media-stream → synthetic audio source (no real mic)
 *
 * Locator strategy (in preference order):
 *   1. ARIA role + name  (most resilient — survives CSS/DOM refactors)
 *   2. Stable HTML id attributes (interview-chat-input, etc.)
 *   3. aria-label on structural containers
 *   4. data-testid when nothing else is specific enough
 *   5. CSS class strings — never used here
 */

import { test, expect, type Page } from "@playwright/test";

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Navigate to /interview and wait for the page to be fully hydrated.
 * We consider the page ready when the "Start Interview" button is visible,
 * meaning React has mounted, tRPC provider is ready, and Monaco is
 * initialising in the background.
 */
async function gotoInterview(page: Page): Promise<void> {
  await page.goto("/interview");
  await page.waitForLoadState("networkidle");
  // The control panel button is the cheapest stable hydration signal
  await expect(
    page.getByRole("button", { name: "Start Interview" })
  ).toBeVisible({ timeout: 20_000 });
}

/**
 * Wait for the Monaco editor iframe / web-worker to finish loading.
 * Monaco renders inside a div[role="code"]. The "Loading editor…" text
 * disappears once the worker is ready.
 */
async function waitForEditor(page: Page): Promise<void> {
  // Monaco renders its text area as a textarea inside .monaco-editor
  await page.locator(".monaco-editor textarea").waitFor({
    state: "attached",
    timeout: 30_000,
  });
}

// ─── Suite: Page structure ────────────────────────────────────────────────────

test.describe("Interview page — structure", () => {
  test.beforeEach(async ({ page }) => {
    await gotoInterview(page);
  });

  test("renders the top navigation bar with brand name", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.getByText("AI Interview")).toBeVisible();
  });

  test("shows the Live Session badge in the header", async ({ page }) => {
    await expect(page.getByText("Live Session")).toBeVisible();
  });

  test("renders the chat panel with aria-label", async ({ page }) => {
    await expect(
      page.getByRole("region", { name: "Chat and video panel" })
    ).toBeVisible();
  });

  test("renders the code editor panel with aria-label", async ({ page }) => {
    await expect(
      page.getByRole("region", { name: "Code editor panel" })
    ).toBeVisible();
  });

  test("renders the initial AI welcome message in the chat log", async ({
    page,
  }) => {
    const log = page.getByRole("log", { name: "Chat messages" });
    await expect(log).toBeVisible();
    await expect(
      log.getByText("Welcome! I'll be your AI interviewer today.")
    ).toBeVisible();
  });

  test("shows the message count badge ('1 message' initially)", async ({
    page,
  }) => {
    await expect(page.getByText("1 message")).toBeVisible();
  });

  test("renders the chat input with correct aria-label", async ({ page }) => {
    await expect(
      page.getByRole("textbox", { name: "Chat message input" })
    ).toBeVisible();
  });

  test("the send button is initially disabled (no input text)", async ({
    page,
  }) => {
    const sendButton = page.getByRole("button", { name: "Send message" });
    await expect(sendButton).toBeDisabled();
  });

  test("renders the audio visualizer with its aria-label", async ({ page }) => {
    await expect(
      page.getByLabel("Audio visualizer")
    ).toBeVisible();
  });

  test("renders the Mic Visualizer header text", async ({ page }) => {
    await expect(page.getByText("Mic Visualizer")).toBeVisible();
  });
});

// ─── Suite: Control panel — recording state machine ──────────────────────────

test.describe("Interview page — recording controls", () => {
  test.beforeEach(async ({ page }) => {
    await gotoInterview(page);
  });

  test("shows 'Ready to start' status text before recording begins", async ({
    page,
  }) => {
    await expect(page.getByText("Ready to start")).toBeVisible();
  });

  test("'Start Interview' button is visible and enabled initially", async ({
    page,
  }) => {
    const btn = page.getByRole("button", { name: "Start Interview" });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("clicking 'Start Interview' transitions UI to recording state", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Start Interview" }).click();

    // The button swaps from Start Interview → End Interview
    await expect(
      page.getByRole("button", { name: "End Interview" })
    ).toBeVisible({ timeout: 8_000 });

    // Status text updates
    await expect(page.getByText("Recording active")).toBeVisible();

    // The original button should be gone
    await expect(
      page.getByRole("button", { name: "Start Interview" })
    ).not.toBeVisible();
  });

  test("the AudioVisualizer shows the 'Live' badge when recording is active", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Start Interview" }).click();

    // aria-label transitions on the canvas element
    const canvas = page.getByLabel("Real-time audio frequency visualizer");
    await expect(canvas).toBeVisible({ timeout: 8_000 });

    // The "Live" pill appears alongside the Mic Visualizer title
    await expect(page.getByText("Live")).toBeVisible();
  });

  test("clicking 'End Interview' stops recording and reverts the UI", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Start Interview" }).click();
    await expect(
      page.getByRole("button", { name: "End Interview" })
    ).toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: "End Interview" }).click();

    // Should revert to the initial state
    await expect(
      page.getByRole("button", { name: "Start Interview" })
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("Ready to start")).toBeVisible();
    await expect(page.getByText("Live")).not.toBeVisible();
  });

  test("canvas aria-label reverts to 'idle state' after stopping", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Start Interview" }).click();
    await expect(
      page.getByLabel("Real-time audio frequency visualizer")
    ).toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: "End Interview" }).click();

    await expect(
      page.getByLabel("Audio visualizer idle state")
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─── Suite: Audio visualizer component ───────────────────────────────────────

test.describe("AudioVisualizer", () => {
  test.beforeEach(async ({ page }) => {
    await gotoInterview(page);
  });

  test("canvas is rendered with role='img'", async ({ page }) => {
    // The canvas has role='img' set explicitly in audio-visualizer.tsx
    const canvas = page.getByRole("img", {
      name: "Audio visualizer idle state",
    });
    await expect(canvas).toBeVisible();
  });

  test("canvas transitions to active role name when stream is provided", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Start Interview" }).click();

    await expect(
      page.getByRole("img", { name: "Real-time audio frequency visualizer" })
    ).toBeVisible({ timeout: 8_000 });
  });

  test("live speech transcript region is present when recording and SpeechRecognition is available", async ({
    page,
  }) => {
    // SpeechRecognition is available in Chromium
    await page.getByRole("button", { name: "Start Interview" }).click();

    // The transcript region has aria-label="Live speech transcript"
    const transcriptRegion = page.getByLabel("Live speech transcript");
    await expect(transcriptRegion).toBeVisible({ timeout: 8_000 });

    // Initial content is the placeholder "Listening…" text
    await expect(
      transcriptRegion.getByText("Listening\u2026")
    ).toBeVisible();
  });

  test("transcript region disappears after recording stops", async ({ page }) => {
    await page.getByRole("button", { name: "Start Interview" }).click();
    await expect(page.getByLabel("Live speech transcript")).toBeVisible({
      timeout: 8_000,
    });

    await page.getByRole("button", { name: "End Interview" }).click();

    await expect(page.getByLabel("Live speech transcript")).not.toBeVisible({
      timeout: 5_000,
    });
  });
});

// ─── Suite: Chat panel — user interactions ───────────────────────────────────

test.describe("Interview page — chat input", () => {
  test.beforeEach(async ({ page }) => {
    await gotoInterview(page);
  });

  test("typing into the chat input enables the send button", async ({
    page,
  }) => {
    const input = page.getByRole("textbox", { name: "Chat message input" });
    const sendBtn = page.getByRole("button", { name: "Send message" });

    await expect(sendBtn).toBeDisabled();
    await input.fill("What is the time complexity?");
    await expect(sendBtn).toBeEnabled();
  });

  test("clearing the chat input disables the send button again", async ({
    page,
  }) => {
    const input = page.getByRole("textbox", { name: "Chat message input" });
    const sendBtn = page.getByRole("button", { name: "Send message" });

    await input.fill("Some text");
    await expect(sendBtn).toBeEnabled();
    await input.clear();
    await expect(sendBtn).toBeDisabled();
  });

  test("pressing Enter submits the chat message optimistically", async ({
    page,
  }) => {
    // Intercept the tRPC mutation so tests don't depend on a live backend.
    await page.route("**/api/trpc/**", async (route) => {
      // Return a plausible tRPC batch response for interviews.submitAnswer
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                aiResponse: "Great solution! What is the space complexity?",
                interview: {
                  id: "00000000-0000-0000-0000-000000000001",
                  transcript: [],
                  status: "active",
                },
              },
            },
          },
        ]),
      });
    });

    const input = page.getByRole("textbox", { name: "Chat message input" });
    const log = page.getByRole("log", { name: "Chat messages" });

    await input.fill("My approach is O(n log n)");
    await input.press("Enter");

    // Optimistic bubble appears immediately (before AI response)
    await expect(
      log.getByText("My approach is O(n log n)")
    ).toBeVisible({ timeout: 5_000 });

    // The input is cleared after submission
    await expect(input).toHaveValue("");
  });

  test("the AI reply appears in the log after a successful server response", async ({
    page,
  }) => {
    await page.route("**/api/trpc/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                aiResponse: "What is the space complexity?",
                interview: { id: "00000000-0000-0000-0000-000000000001" },
              },
            },
          },
        ]),
      });
    });

    const input = page.getByRole("textbox", { name: "Chat message input" });
    const log = page.getByRole("log", { name: "Chat messages" });

    await input.fill("O(n log n) using merge sort");
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(
      log.getByText("What is the space complexity?")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Shift+Enter inserts a newline instead of submitting", async ({
    page,
  }) => {
    // The input is a single-line <input type="text">, so Shift+Enter should
    // NOT clear it. This verifies the event handler guard in the page code.
    const input = page.getByRole("textbox", { name: "Chat message input" });
    await input.fill("Line one");
    await input.press("Shift+Enter");
    // The input retains its value (not submitted)
    await expect(input).toHaveValue("Line one");
  });

  test("a server error surfaces as an error bubble in the chat log", async ({
    page,
  }) => {
    await page.route("**/api/trpc/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "Internal Server Error", code: -32603 },
        }),
      });
    });

    const input = page.getByRole("textbox", { name: "Chat message input" });
    await input.fill("This will fail");
    await page.getByRole("button", { name: "Send message" }).click();

    const log = page.getByRole("log", { name: "Chat messages" });
    await expect(
      log.getByText(/Something went wrong/)
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Suite: CodeCanvas — Monaco Editor ───────────────────────────────────────

test.describe("CodeCanvas — Monaco Editor", () => {
  test.beforeEach(async ({ page }) => {
    await gotoInterview(page);
    await waitForEditor(page);
  });

  test("the code editor panel has the correct aria-label", async ({ page }) => {
    await expect(
      page.getByRole("region", { name: "Code editor panel" })
    ).toBeVisible();
  });

  test("displays 'Code Editor' and 'TypeScript' labels in the panel header", async ({
    page,
  }) => {
    const codePanel = page.getByRole("region", { name: "Code editor panel" });
    await expect(codePanel.getByText("Code Editor")).toBeVisible();
    await expect(codePanel.getByText("TypeScript")).toBeVisible();
  });

  test("shows the filename tab as 'solution.ts'", async ({ page }) => {
    await expect(page.getByText("solution.ts")).toBeVisible();
  });

  test("the Monaco editor container is visible", async ({ page }) => {
    await expect(page.locator(".monaco-editor").first()).toBeVisible();
  });

  test("the editor is pre-populated with the starter code", async ({
    page,
  }) => {
    // Monaco stores its content in .view-lines
    const editorContent = page.locator(".monaco-editor .view-lines");
    await expect(editorContent).toContainText("function solution(", {
      timeout: 15_000,
    });
  });

  test("typing into the Monaco editor updates its content", async ({ page }) => {
    const editorTextarea = page.locator(".monaco-editor textarea").first();

    // Monaco uses a hidden textarea for keyboard input.
    // We focus it, select-all, then type to replace the starter code.
    await editorTextarea.focus();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("const x = 42;");

    const viewLines = page.locator(".monaco-editor .view-lines");
    await expect(viewLines).toContainText("const x = 42;", { timeout: 8_000 });
  });

  test("the Monaco editor textarea is keyboard-accessible", async ({
    page,
  }) => {
    const editorTextarea = page.locator(".monaco-editor textarea").first();
    await editorTextarea.focus();
    // The textarea is the active element after focus — confirms keyboard access
    await expect(editorTextarea).toBeFocused();
  });

  test("typing code and sending a chat message includes the code in the tRPC payload", async ({
    page,
  }) => {
    let capturedBody: string | null = null;

    await page.route("**/api/trpc/**", async (route) => {
      capturedBody = route.request().postData();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                aiResponse: "Interesting approach.",
                interview: { id: "00000000-0000-0000-0000-000000000001" },
              },
            },
          },
        ]),
      });
    });

    // Type into the editor
    const editorTextarea = page.locator(".monaco-editor textarea").first();
    await editorTextarea.focus();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("function binarySearch() {}");

    // Send a chat message
    const chatInput = page.getByRole("textbox", { name: "Chat message input" });
    await chatInput.fill("Here is my binary search implementation");
    await chatInput.press("Enter");

    // Wait for the route to be intercepted
    await page.waitForResponse("**/api/trpc/**", { timeout: 8_000 });

    // The tRPC payload should carry the code field
    expect(capturedBody).not.toBeNull();
    const parsed = JSON.parse(capturedBody!);
    // tRPC batches; the code property lives in the first batch item's input
    const inputJson = JSON.stringify(parsed);
    expect(inputJson).toContain("binarySearch");
  });
});

// ─── Suite: Protected route — redirect when unauthenticated ──────────────────

// Note: this test is deliberately included here but will be skipped unless
// the context has no storageState. The "chromium-public" project (no auth)
// picks it up via public.spec.ts. It's documented here as cross-reference.
test.describe("Interview page — authenticated access", () => {
  test("authenticated user can access /interview without redirect", async ({
    page,
  }) => {
    await page.goto("/interview");
    // If the middleware redirect works, we'd land on a login page.
    // With auth injected we must stay on /interview.
    await expect(page).toHaveURL(/\/interview/, { timeout: 10_000 });
  });
});

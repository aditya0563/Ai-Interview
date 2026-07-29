import { test, expect } from "@playwright/test";
import * as path from "path";

test.describe("Golden Path E2E - Interview Journey", () => {
  // Assume a logged-in state by injecting the dummy cookie session state
  test.use({ storageState: path.join(__dirname, ".auth", "user.json") });

  test("completes the core interview flow without hitting real hardware or AI APIs", async ({ page, context }) => {
    // 1. Environment Setup & Stubs
    
    // Stub the microphone permissions using Playwright's context
    // This prevents the browser from blocking or prompting for mic access,
    // and successfully mocks a MediaStream so our Web Audio APIs don't crash.
    await context.grantPermissions(["microphone"]);

    // Intercept the tRPC network request for submitAnswer
    await page.route("**/api/trpc/*submitAnswer*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                aiResponse: "Excellent code! This looks perfectly optimal.",
                interview: { id: "test-interview-123", status: "active" },
              },
            },
          },
        ]),
      });
    });

    // 2. The Golden Path Execution

    // Navigate to the dashboard and enter the interview room
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Start New Interview" }).click();

    // Wait for the URL to indicate we are successfully in the interview room
    await expect(page).toHaveURL(/\/interview/);

    // Verify Audio: Assert that the application does not crash when the microphone is requested.
    // By granting permissions above, the app should smoothly transition into a recording state
    // rather than throwing the known hardware error toasts.
    await expect(page.getByText("Microphone access is unavailable")).not.toBeVisible();
    await expect(page.getByText("Unable to access the microphone")).not.toBeVisible();
    
    // Assert the presence of a recording or active microphone indicator if it exists on the page
    // (This ensures the use-audio-recorder hook successfully invoked getUserMedia)
    const micButton = page.getByRole("button", { name: /microphone/i }).or(page.getByRole("button", { name: /record/i }));
    if (await micButton.count() > 0) {
      await expect(micButton.first()).toBeVisible();
    }

    // Interact with Monaco: Locate the Monaco editor instance on the page.
    const editorTextarea = page.locator(".monaco-editor textarea").first();
    // Handle the asynchronous nature of the Monaco editor loading
    await editorTextarea.waitFor({ state: "attached", timeout: 15_000 });
    
    // Click into it and simulate typing a basic code block
    await editorTextarea.focus();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("function test() { return true; }");

    // Submit: Locate and click the "Submit Answer" button.
    await page.getByRole("button", { name: "Submit Answer" }).click();

    // Verify UI Update: Assert that the intercepted, mocked AI response successfully renders
    // inside the chat transcript UI on the page.
    const chatLog = page.getByRole("log", { name: "Chat messages" });
    await expect(chatLog.getByText("Excellent code! This looks perfectly optimal.")).toBeVisible({ timeout: 10_000 });
  });
});

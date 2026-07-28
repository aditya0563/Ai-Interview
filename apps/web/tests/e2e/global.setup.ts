/**
 * Global setup — runs once before all Playwright test suites.
 *
 * Strategy: Auth.js v5 (next-auth@5) uses a signed JWT stored in the
 * `authjs.session-token` cookie.  We manufacture a valid token using the
 * same AUTH_SECRET the dev server uses, inject it into a browser context,
 * hit /api/auth/session to confirm the server accepts it, then serialise
 * the full cookie jar to tests/e2e/.auth/user.json.
 *
 * Result: every test project that sets `storageState` to that file starts
 * fully authenticated — no GitHub redirect, no OAuth flow, no flakiness.
 */

import { chromium, type FullConfig } from "@playwright/test";
import { SignJWT } from "jose";
import * as fs from "fs";
import * as path from "path";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:3000";

/**
 * The AUTH_SECRET must exactly match what the running dev server uses.
 * Read from the environment first (CI), then fall back to the local default.
 */
const AUTH_SECRET =
  process.env["AUTH_SECRET"] ?? "playwright-test-secret-32-chars!!";

const STORAGE_STATE_PATH = path.join(
  __dirname,
  ".auth",
  "user.json"
);

// ─── Mock user fixture ────────────────────────────────────────────────────────

/**
 * The fields must match the shape that auth.ts writes into the JWT
 * (see the `jwt` callback: token.id and token.role).
 */
const MOCK_USER = {
  id: "test-user-playwright-e2e",
  name: "Playwright Test User",
  email: "playwright@example.com",
  image: null,
  role: "user" as const,
} as const;

// ─── JWT helper ───────────────────────────────────────────────────────────────

/**
 * Creates a signed Auth.js v5 compatible JWT.
 *
 * Auth.js v5 encodes the following claims into the session cookie:
 *   sub   — user id
 *   name  — display name
 *   email — email address
 *   picture — avatar URL
 *   iat   — issued-at (seconds)
 *   exp   — expiry (seconds)
 *   jti   — random token id
 *
 * Plus whatever your `jwt` callback adds (here: `id` and `role`).
 */
async function createSessionToken(): Promise<string> {
  const secret = new TextEncoder().encode(AUTH_SECRET);
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 60 * 60 * 24;

  const token = await new SignJWT({
    // Standard OIDC / Auth.js claims
    sub: MOCK_USER.id,
    name: MOCK_USER.name,
    email: MOCK_USER.email,
    picture: MOCK_USER.image,
    // Custom claims written by the jwt() callback in auth.ts
    id: MOCK_USER.id,
    role: MOCK_USER.role,
    // Required timing claims
    iat: now,
    exp: now + oneDay,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .sign(secret);

  return token;
}

// ─── Main setup ───────────────────────────────────────────────────────────────

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // Ensure the output directory exists
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();

  try {
    const sessionToken = await createSessionToken();

    // Inject the Auth.js session cookie.
    // Auth.js v5 uses `authjs.session-token` in production (HTTPS) and
    // `__Secure-authjs.session-token` with the Secure flag in prod.
    // The dev server uses the non-Secure variant over HTTP.
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,       // HTTP localhost — no Secure flag
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
      },
    ]);

    // Navigate to the session endpoint and verify Auth.js accepted our token.
    const page = await context.newPage();
    const response = await page.goto(`${BASE_URL}/api/auth/session`, {
      waitUntil: "networkidle",
    });

    if (!response || !response.ok()) {
      throw new Error(
        `[global.setup] /api/auth/session returned ${response?.status()} — ` +
          "is the dev server running and is AUTH_SECRET set correctly?"
      );
    }

    const sessionData = (await response.json()) as Record<string, unknown>;

    // Auth.js returns {} for an unauthenticated session and { user: {...} }
    // for an authenticated one.
    if (!sessionData["user"]) {
      throw new Error(
        "[global.setup] Auth.js session endpoint returned no `user` object. " +
          "The JWT was not accepted. Check that AUTH_SECRET matches exactly.\n" +
          `Session response: ${JSON.stringify(sessionData, null, 2)}`
      );
    }

    console.log(
      `[global.setup] ✓ Authenticated as: ${JSON.stringify(sessionData["user"])}`
    );

    // Serialise the entire browser storage (cookies + localStorage) so that
    // all downstream test projects can reuse this auth state without re-logging.
    await context.storageState({ path: STORAGE_STATE_PATH });

    console.log(
      `[global.setup] ✓ Storage state saved to ${STORAGE_STATE_PATH}`
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

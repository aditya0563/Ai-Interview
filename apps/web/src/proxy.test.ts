/**
 * apps/web — proxy.ts unit tests
 *
 * proxy.ts is a Next.js Middleware file. Its two testable contracts are:
 *  1. The `config.matcher` routes exactly the expected paths.
 *  2. The default export is the Auth.js auth handler (not null/undefined).
 *
 * We cannot execute the middleware's network logic in Vitest (it requires the
 * Next.js Edge Runtime), so we mock next-auth and auth.config, then verify:
 *  - The exported config.matcher array contains the correct route patterns.
 *  - The default export is the value returned by NextAuth(...).auth — proving
 *    the wiring is correct without executing real OAuth flows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Sentinel representing the auth handler function
const MOCK_AUTH_HANDLER = vi.fn().mockName("authHandler");

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: MOCK_AUTH_HANDLER,
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("./auth.config", () => ({
  authConfig: {
    providers: [],
    session: { strategy: "jwt" },
    pages: { signIn: "/" },
    callbacks: {
      authorized: vi.fn().mockReturnValue(true),
    },
  },
  default: {
    providers: [],
    session: { strategy: "jwt" },
  },
}));

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// ─── Import the module under test AFTER mocks are set up ────────────────────
// Dynamic import inside each test group so vi.mock hoisting is applied first.

// ═══════════════════════════════════════════════════════════════════════════
// Route matcher configuration
// ═══════════════════════════════════════════════════════════════════════════

describe("proxy.ts — config.matcher", () => {
  it("protects /interview/* routes", async () => {
    const proxyModule = await import("./proxy");
    expect(proxyModule.config.matcher).toContain("/interview/:path*");
  });

  it("protects /admin/* routes", async () => {
    const proxyModule = await import("./proxy");
    expect(proxyModule.config.matcher).toContain("/admin/:path*");
  });

  it("exports exactly two matcher patterns", async () => {
    const proxyModule = await import("./proxy");
    expect(proxyModule.config.matcher).toHaveLength(2);
  });

  it("does not protect the root / route", async () => {
    const proxyModule = await import("./proxy");
    expect(proxyModule.config.matcher).not.toContain("/");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Default export wiring
// ═══════════════════════════════════════════════════════════════════════════

describe("proxy.ts — default export", () => {
  it("exports the auth handler returned by NextAuth(authConfig)", async () => {
    const proxyModule = await import("./proxy");
    // The default export must be the exact object NextAuth().auth returned
    expect(proxyModule.default).toBe(MOCK_AUTH_HANDLER);
  });

  it("passes authConfig into NextAuth", async () => {
    // NextAuth was called during module evaluation — verify it received authConfig
    expect(NextAuth).toHaveBeenCalledWith(authConfig);
  });

  it("default export is not null or undefined", async () => {
    const proxyModule = await import("./proxy");
    expect(proxyModule.default).not.toBeNull();
    expect(proxyModule.default).not.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// authConfig — authorized callback logic (via auth.config mock introspection)
// ═══════════════════════════════════════════════════════════════════════════

describe("authConfig — authorized callback routing logic", () => {
  /**
   * We test the authorised callback in isolation by reimporting the REAL
   * auth.config (un-mocked). We use a separate vi.isolateModules block so this
   * test does not interfere with the proxy import above.
   */
  it("allows unauthenticated access to public routes", async () => {
    const { authConfig: realConfig } = await vi.importActual<
      typeof import("./auth.config")
    >("./auth.config");

    const authorized = realConfig.callbacks?.authorized;
    if (typeof authorized !== "function") {
      throw new Error("authorized callback not found on authConfig");
    }

    const result = authorized({
      auth: null,
      request: { nextUrl: new URL("http://localhost/") } as never,
    });
    expect(result).toBe(true);
  });

  it("blocks unauthenticated access to /interview routes", async () => {
    const { authConfig: realConfig } = await vi.importActual<
      typeof import("./auth.config")
    >("./auth.config");

    const authorized = realConfig.callbacks?.authorized;
    if (typeof authorized !== "function") {
      throw new Error("authorized callback not found on authConfig");
    }

    const result = authorized({
      auth: null,
      request: {
        nextUrl: new URL("http://localhost/interview/abc123"),
      } as never,
    });
    expect(result).toBe(false);
  });

  it("allows authenticated access to /interview routes", async () => {
    const { authConfig: realConfig } = await vi.importActual<
      typeof import("./auth.config")
    >("./auth.config");

    const authorized = realConfig.callbacks?.authorized;
    if (typeof authorized !== "function") {
      throw new Error("authorized callback not found on authConfig");
    }

    const result = authorized({
      auth: { user: { id: "u1", email: "a@a.com" } } as never,
      request: {
        nextUrl: new URL("http://localhost/interview/abc123"),
      } as never,
    });
    expect(result).toBe(true);
  });

  it("blocks authenticated non-admin from /admin routes", async () => {
    const { authConfig: realConfig } = await vi.importActual<
      typeof import("./auth.config")
    >("./auth.config");

    const authorized = realConfig.callbacks?.authorized;
    if (typeof authorized !== "function") {
      throw new Error("authorized callback not found on authConfig");
    }

    const result = authorized({
      auth: {
        user: { id: "u1", email: "a@a.com", role: "user" },
      } as never,
      request: {
        nextUrl: new URL("http://localhost/admin/dashboard"),
      } as never,
    });
    expect(result).toBe(false);
  });

  it("allows admin users to access /admin routes", async () => {
    const { authConfig: realConfig } = await vi.importActual<
      typeof import("./auth.config")
    >("./auth.config");

    const authorized = realConfig.callbacks?.authorized;
    if (typeof authorized !== "function") {
      throw new Error("authorized callback not found on authConfig");
    }

    const result = authorized({
      auth: {
        user: { id: "u1", email: "a@a.com", role: "admin" },
      } as never,
      request: {
        nextUrl: new URL("http://localhost/admin/dashboard"),
      } as never,
    });
    expect(result).toBe(true);
  });
});

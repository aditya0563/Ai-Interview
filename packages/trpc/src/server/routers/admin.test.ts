import { expect, test, describe, vi } from "vitest";
import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";
import type { Context, SessionUser } from "../trpc";

// Mock the database
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => [{ count: 1 }]),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(() => [{ id: "test-user-id" }]),
    })),
  })),
};

const createCaller = createCallerFactory(appRouter);

describe("adminRouter", () => {
  describe("getSystemStats", () => {
    test("Success Flow: admin can access stats", async () => {
      const sessionUser: SessionUser = { id: "admin-1", role: "admin" };
      const ctx: Context = { db: mockDb as any, session: { user: sessionUser } };
      const caller = createCaller(ctx);
      
      const stats = await caller.admin.getSystemStats();
      expect(stats.totalUsers).toBe(1);
      expect(stats.totalInterviews).toBe(1);
      expect(stats.systemHealth).toBe("OK");
    });

    test("RBAC Rejection: user role throws FORBIDDEN", async () => {
      const sessionUser: SessionUser = { id: "user-1", role: "user" };
      const ctx: Context = { db: mockDb as any, session: { user: sessionUser } };
      const caller = createCaller(ctx);

      await expect(caller.admin.getSystemStats()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
    });

    test("Unauthenticated Rejection: session = null throws UNAUTHORIZED", async () => {
      const ctx: Context = { db: mockDb as any, session: null };
      const caller = createCaller(ctx);

      await expect(caller.admin.getSystemStats()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "You must be signed in to access this resource.",
      });
    });
  });

  describe("deleteUser", () => {
    test("Success Flow: admin can delete users", async () => {
      const sessionUser: SessionUser = { id: "admin-1", role: "admin" };
      const ctx: Context = { db: mockDb as any, session: { user: sessionUser } };
      const caller = createCaller(ctx);
      
      const result = await caller.admin.deleteUser({ userId: "550e8400-e29b-41d4-a716-446655440000" });
      expect(result).toEqual([{ id: "test-user-id" }]);
    });

    test("RBAC Rejection: user role throws FORBIDDEN", async () => {
      const sessionUser: SessionUser = { id: "user-1", role: "user" };
      const ctx: Context = { db: mockDb as any, session: { user: sessionUser } };
      const caller = createCaller(ctx);

      await expect(caller.admin.deleteUser({ userId: "550e8400-e29b-41d4-a716-446655440000" })).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
    });

    test("Unauthenticated Rejection: session = null throws UNAUTHORIZED", async () => {
      const ctx: Context = { db: mockDb as any, session: null };
      const caller = createCaller(ctx);

      await expect(caller.admin.deleteUser({ userId: "550e8400-e29b-41d4-a716-446655440000" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "You must be signed in to access this resource.",
      });
    });
  });
});

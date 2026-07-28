/**
 * packages/trpc — users router unit tests
 *
 * All DB I/O is mocked. Tests verify Zod contracts and DB call signatures.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCallerFactory } from "../trpc";
import { usersRouter } from "./users";

vi.mock("@repo/database", () => ({
  users: { id: "id", email: "email" },
}));

// ─── DB mock factory ────────────────────────────────────────────────────────

function makeChain<T>(resolvedValue: T) {
  const chain: Record<string, unknown> = {};
  const methods = ["insert", "values", "returning", "select", "from", "where"];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  (chain["returning"] as ReturnType<typeof vi.fn>).mockResolvedValue(
    resolvedValue
  );
  (chain["where"] as ReturnType<typeof vi.fn>).mockResolvedValue(
    resolvedValue
  );
  return chain;
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FIXED_USER_UUID = "00000000-0000-0000-0000-000000000020";

const baseUser = {
  id: FIXED_USER_UUID,
  name: "Alice Example",
  email: "alice@example.com",
  emailVerified: null,
  image: null,
  role: "user" as const,
};

const createCaller = createCallerFactory(usersRouter);

let mockDb: {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  const insertChain = makeChain([baseUser]);
  const selectChain = makeChain([baseUser]);
  mockDb = {
    insert: vi.fn().mockReturnValue(insertChain),
    select: vi.fn().mockReturnValue(selectChain),
  };
});

function buildCaller() {
  return createCaller({ db: mockDb as never, session: null });
}

// ═══════════════════════════════════════════════════════════════════════════
// users.list
// ═══════════════════════════════════════════════════════════════════════════

describe("users.list", () => {
  it("selects all users from the DB", async () => {
    const caller = buildCaller();
    const result = await caller.list();
    expect(result).toEqual([baseUser]);
    expect(mockDb.select).toHaveBeenCalledOnce();
  });

  it("returns an empty array when no users exist", async () => {
    const emptyChain = makeChain<typeof baseUser[]>([]);
    const caller = createCaller({
      db: { ...mockDb, select: vi.fn().mockReturnValue(emptyChain) } as never,
      session: null,
    });
    const result = await caller.list();
    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// users.getById
// ═══════════════════════════════════════════════════════════════════════════

describe("users.getById", () => {
  it("selects a user by UUID", async () => {
    const caller = buildCaller();
    const result = await caller.getById({ id: FIXED_USER_UUID });
    expect(result).toEqual([baseUser]);
    expect(mockDb.select).toHaveBeenCalledOnce();
  });

  it("rejects a non-UUID id", async () => {
    const caller = buildCaller();
    await expect(caller.getById({ id: "not-a-uuid" })).rejects.toThrow();
  });

  it("rejects an empty id string", async () => {
    const caller = buildCaller();
    await expect(caller.getById({ id: "" })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// users.create
// ═══════════════════════════════════════════════════════════════════════════

describe("users.create", () => {
  it("inserts a user and returns the created row", async () => {
    const caller = buildCaller();
    const result = await caller.create({
      email: "alice@example.com",
      name: "Alice Example",
    });
    expect(result).toEqual([baseUser]);
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("inserts a user without an optional name", async () => {
    const caller = buildCaller();
    const result = await caller.create({ email: "bob@example.com" });
    expect(result).toEqual([baseUser]);
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("rejects an invalid email address", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({ email: "not-an-email" })
    ).rejects.toThrow();
  });

  it("rejects an empty email string", async () => {
    const caller = buildCaller();
    await expect(caller.create({ email: "" })).rejects.toThrow();
  });

  it("rejects an empty name string (min(1) constraint)", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({ email: "valid@example.com", name: "" })
    ).rejects.toThrow();
  });

  it("accepts a name with a single character", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({ email: "valid@example.com", name: "A" })
    ).resolves.toBeDefined();
  });
});

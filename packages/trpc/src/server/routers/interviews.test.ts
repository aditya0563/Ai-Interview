/**
 * packages/trpc — interviews router unit tests
 *
 * Strategy:
 *  - The DB is fully mocked using vi.fn() builders that mirror the Drizzle
 *    query-builder fluent API (insert→values→returning, select→from→where, etc.).
 *  - The AI service is module-mocked so no GEMINI_API_KEY is needed.
 *  - Callers are constructed via createCallerFactory so real tRPC middleware
 *    (logger, auth) executes — this is a true integration of the router layer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "../trpc";
import { interviewsRouter } from "./interviews";

// ─── Mock @repo/database ────────────────────────────────────────────────────
// We only need the table object reference; Drizzle ORM itself is mocked below.
vi.mock("@repo/database", () => ({
  interviews: { id: "id", transcript: "transcript" },
}));

// ─── Mock AI service ────────────────────────────────────────────────────────
vi.mock("../services/ai", () => ({
  generateInterviewResponse: vi.fn(),
}));

import { generateInterviewResponse } from "../services/ai";

// ─── DB mock factory ────────────────────────────────────────────────────────

/**
 * Builds a chainable Drizzle-like mock that returns `resolvedValue` when
 * the chain is awaited.
 */
function makeChain<T>(resolvedValue: T) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "insert",
    "values",
    "returning",
    "select",
    "from",
    "where",
    "update",
    "set",
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  // The final `.returning()` / `.where()` is what gets awaited
  (chain["returning"] as ReturnType<typeof vi.fn>).mockResolvedValue(
    resolvedValue
  );
  (chain["where"] as ReturnType<typeof vi.fn>).mockResolvedValue(
    resolvedValue
  );
  return chain as unknown as ReturnType<typeof vi.fn>;
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FIXED_UUID = "00000000-0000-0000-0000-000000000001";
const FIXED_USER_UUID = "00000000-0000-0000-0000-000000000002";

const baseInterview = {
  id: FIXED_UUID,
  userId: FIXED_USER_UUID,
  jobRole: "Senior Frontend Engineer",
  status: "active" as const,
  transcript: [] as Array<{ role: string; content: string }>,
  createdAt: new Date("2024-01-01T00:00:00Z"),
};

// ─── Caller factory ─────────────────────────────────────────────────────────

const createCaller = createCallerFactory(interviewsRouter);

function buildCaller(dbOverrides?: Partial<typeof mockDb>) {
  return createCaller({
    db: { ...mockDb, ...dbOverrides } as never,
    session: null,
  });
}

// ─── Shared mutable mock db ─────────────────────────────────────────────────

let mockDb: {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();

  const insertChain = makeChain([baseInterview]);
  const selectChain = makeChain([baseInterview]);
  const updateChain = makeChain([baseInterview]);

  mockDb = {
    insert: vi.fn().mockReturnValue(insertChain),
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// interviews.create
// ═══════════════════════════════════════════════════════════════════════════

describe("interviews.create", () => {
  it("inserts a new interview and returns the row", async () => {
    const caller = buildCaller();
    const result = await caller.create({
      userId: FIXED_USER_UUID,
      jobRole: "Senior Frontend Engineer",
    });
    expect(result).toEqual([baseInterview]);
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("rejects a non-UUID userId", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({ userId: "not-a-uuid", jobRole: "Engineer" })
    ).rejects.toThrow();
  });

  it("rejects an empty jobRole", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({ userId: FIXED_USER_UUID, jobRole: "" })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// interviews.getById
// ═══════════════════════════════════════════════════════════════════════════

describe("interviews.getById", () => {
  it("selects an interview by UUID", async () => {
    const caller = buildCaller();
    const result = await caller.getById({ id: FIXED_UUID });
    expect(result).toEqual([baseInterview]);
    expect(mockDb.select).toHaveBeenCalledOnce();
  });

  it("rejects a non-UUID id", async () => {
    const caller = buildCaller();
    await expect(caller.getById({ id: "bad-id" })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// interviews.addTranscriptMessage
// ═══════════════════════════════════════════════════════════════════════════

describe("interviews.addTranscriptMessage", () => {
  it("updates transcript and returns the row", async () => {
    const caller = buildCaller();
    const result = await caller.addTranscriptMessage({
      interviewId: FIXED_UUID,
      message: { role: "user", content: "Hello" },
    });
    expect(result).toEqual([baseInterview]);
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it("rejects a non-UUID interviewId", async () => {
    const caller = buildCaller();
    await expect(
      caller.addTranscriptMessage({
        interviewId: "not-uuid",
        message: { role: "user", content: "Hello" },
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// interviews.updateStatus
// ═══════════════════════════════════════════════════════════════════════════

describe("interviews.updateStatus", () => {
  it("updates status to 'completed'", async () => {
    const caller = buildCaller();
    const result = await caller.updateStatus({
      interviewId: FIXED_UUID,
      status: "completed",
    });
    expect(result).toEqual([baseInterview]);
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it("rejects an invalid status value", async () => {
    const caller = buildCaller();
    await expect(
      caller.updateStatus({
        interviewId: FIXED_UUID,
        // @ts-expect-error intentional invalid value
        status: "pending",
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// interviews.submitAnswer
// ═══════════════════════════════════════════════════════════════════════════

describe("interviews.submitAnswer", () => {
  it("fetches the interview, calls AI, persists both messages, and returns", async () => {
    vi.mocked(generateInterviewResponse).mockResolvedValue(
      "What is the time complexity of your solution?"
    );

    // select().from().where() must resolve to the existing interview
    const selectChain = makeChain([baseInterview]);
    // update chain is called three times: user msg append, ai msg append (returning)
    const updateChain = makeChain([
      { ...baseInterview, transcript: [{ role: "assistant", content: "..." }] },
    ]);

    const caller = buildCaller({
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
    });

    const result = await caller.submitAnswer({
      interviewId: FIXED_UUID,
      message: "My solution is O(n log n).",
      code: "function sort(arr) { return arr.sort(); }",
    });

    expect(generateInterviewResponse).toHaveBeenCalledOnce();
    expect(generateInterviewResponse).toHaveBeenCalledWith(
      baseInterview.jobRole,
      [{ role: "user", content: "My solution is O(n log n)." }],
      "function sort(arr) { return arr.sort(); }"
    );
    expect(result.aiResponse).toBe(
      "What is the time complexity of your solution?"
    );
  });

  it("throws when the interview is not found", async () => {
    // select returns empty array — interview not found
    const selectChain = makeChain([] as typeof baseInterview[]);
    const caller = buildCaller({
      select: vi.fn().mockReturnValue(selectChain),
    });

    await expect(
      caller.submitAnswer({
        interviewId: FIXED_UUID,
        message: "Answer",
        code: "",
      })
    ).rejects.toThrow(`Interview not found: ${FIXED_UUID}`);

    expect(generateInterviewResponse).not.toHaveBeenCalled();
  });

  it("propagates AI service errors without masking them", async () => {
    vi.mocked(generateInterviewResponse).mockRejectedValue(
      new Error("Gemini returned an empty response.")
    );

    const selectChain = makeChain([baseInterview]);
    const updateChain = makeChain([baseInterview]);

    const caller = buildCaller({
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
    });

    await expect(
      caller.submitAnswer({
        interviewId: FIXED_UUID,
        message: "My answer",
        code: "",
      })
    ).rejects.toThrow("Gemini returned an empty response.");
  });

  it("rejects an empty message", async () => {
    const caller = buildCaller();
    await expect(
      caller.submitAnswer({
        interviewId: FIXED_UUID,
        message: "",
        code: "",
      })
    ).rejects.toThrow();
  });

  it("rejects a non-UUID interviewId", async () => {
    const caller = buildCaller();
    await expect(
      caller.submitAnswer({
        interviewId: "not-uuid",
        message: "Valid message",
        code: "",
      })
    ).rejects.toThrow();
  });
});

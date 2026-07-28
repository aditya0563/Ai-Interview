/**
 * packages/trpc — reports router unit tests
 *
 * The DB is fully mocked. No network, no PostgreSQL, no AI service.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCallerFactory } from "../trpc";
import { reportsRouter } from "./reports";

vi.mock("@repo/database", () => ({
  reports: { id: "id", interviewId: "interviewId" },
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
  return chain as unknown as ReturnType<typeof vi.fn>;
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FIXED_INTERVIEW_UUID = "00000000-0000-0000-0000-000000000010";
const FIXED_REPORT_UUID = "00000000-0000-0000-0000-000000000011";

const baseReport = {
  id: FIXED_REPORT_UUID,
  interviewId: FIXED_INTERVIEW_UUID,
  overallScore: 82,
  technicalScore: 78,
  communicationScore: 90,
  strengths: ["Clear communication", "Good problem decomposition"],
  improvements: ["Optimise space complexity"],
  detailedFeedback:
    "Overall a strong performance. Consider discussing trade-offs more explicitly.",
  createdAt: new Date("2024-01-01T00:00:00Z"),
};

const createCaller = createCallerFactory(reportsRouter);

let mockDb: {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  const insertChain = makeChain([baseReport]);
  const selectChain = makeChain([baseReport]);
  mockDb = {
    insert: vi.fn().mockReturnValue(insertChain),
    select: vi.fn().mockReturnValue(selectChain),
  };
});

function buildCaller() {
  return createCaller({ db: mockDb as never, session: null });
}

// ═══════════════════════════════════════════════════════════════════════════
// reports.create
// ═══════════════════════════════════════════════════════════════════════════

describe("reports.create", () => {
  it("inserts a report and returns the created row", async () => {
    const caller = buildCaller();
    const result = await caller.create({
      interviewId: FIXED_INTERVIEW_UUID,
      overallScore: 82,
      technicalScore: 78,
      communicationScore: 90,
      strengths: ["Clear communication"],
      improvements: ["Optimise space complexity"],
      detailedFeedback: "Strong performance.",
    });
    expect(result).toEqual([baseReport]);
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("rejects overallScore > 100", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({
        interviewId: FIXED_INTERVIEW_UUID,
        overallScore: 101,
        technicalScore: 50,
        communicationScore: 50,
        strengths: [],
        improvements: [],
        detailedFeedback: "Valid feedback",
      })
    ).rejects.toThrow();
  });

  it("rejects overallScore < 0", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({
        interviewId: FIXED_INTERVIEW_UUID,
        overallScore: -1,
        technicalScore: 50,
        communicationScore: 50,
        strengths: [],
        improvements: [],
        detailedFeedback: "Valid feedback",
      })
    ).rejects.toThrow();
  });

  it("rejects technicalScore > 100", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({
        interviewId: FIXED_INTERVIEW_UUID,
        overallScore: 50,
        technicalScore: 200,
        communicationScore: 50,
        strengths: [],
        improvements: [],
        detailedFeedback: "Valid feedback",
      })
    ).rejects.toThrow();
  });

  it("rejects a non-integer score", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({
        interviewId: FIXED_INTERVIEW_UUID,
        overallScore: 82.5,
        technicalScore: 78,
        communicationScore: 90,
        strengths: [],
        improvements: [],
        detailedFeedback: "Valid",
      })
    ).rejects.toThrow();
  });

  it("rejects an empty detailedFeedback", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({
        interviewId: FIXED_INTERVIEW_UUID,
        overallScore: 50,
        technicalScore: 50,
        communicationScore: 50,
        strengths: [],
        improvements: [],
        detailedFeedback: "",
      })
    ).rejects.toThrow();
  });

  it("rejects a non-UUID interviewId", async () => {
    const caller = buildCaller();
    await expect(
      caller.create({
        interviewId: "not-a-uuid",
        overallScore: 50,
        technicalScore: 50,
        communicationScore: 50,
        strengths: [],
        improvements: [],
        detailedFeedback: "Valid feedback",
      })
    ).rejects.toThrow();
  });

  it("accepts an empty strengths array", async () => {
    const caller = buildCaller();
    const result = await caller.create({
      interviewId: FIXED_INTERVIEW_UUID,
      overallScore: 50,
      technicalScore: 50,
      communicationScore: 50,
      strengths: [],
      improvements: [],
      detailedFeedback: "Valid feedback",
    });
    expect(result).toEqual([baseReport]);
  });

  it("accepts score boundary values (0 and 100)", async () => {
    const caller = buildCaller();
    // Should not throw — these are the exact Zod min/max bounds
    await expect(
      caller.create({
        interviewId: FIXED_INTERVIEW_UUID,
        overallScore: 0,
        technicalScore: 100,
        communicationScore: 0,
        strengths: [],
        improvements: [],
        detailedFeedback: "Boundary test",
      })
    ).resolves.toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// reports.getByInterviewId
// ═══════════════════════════════════════════════════════════════════════════

describe("reports.getByInterviewId", () => {
  it("returns reports for a valid interviewId", async () => {
    const caller = buildCaller();
    const result = await caller.getByInterviewId({
      interviewId: FIXED_INTERVIEW_UUID,
    });
    expect(result).toEqual([baseReport]);
    expect(mockDb.select).toHaveBeenCalledOnce();
  });

  it("rejects a non-UUID interviewId", async () => {
    const caller = buildCaller();
    await expect(
      caller.getByInterviewId({ interviewId: "bad-id" })
    ).rejects.toThrow();
  });

  it("returns an empty array when no reports exist", async () => {
    // Override select chain to return []
    const emptySelectChain = makeChain<typeof baseReport[]>([]);
    const caller = createCaller({
      db: {
        ...mockDb,
        select: vi.fn().mockReturnValue(emptySelectChain),
      } as never,
      session: null,
    });
    const result = await caller.getByInterviewId({
      interviewId: FIXED_INTERVIEW_UUID,
    });
    expect(result).toEqual([]);
  });
});

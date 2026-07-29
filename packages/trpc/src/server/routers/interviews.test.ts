import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "../trpc";
import { interviewsRouter } from "./interviews";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { 
  users, usersRelations, 
  interviews, interviewsRelations, 
  interviewMessages, interviewMessagesRelations, 
  interviewCodeSnapshots, interviewCodeSnapshotsRelations 
} from "@repo/database/schema";
import { generateInterviewResponse } from "../services/ai";

// 1. Eradicate Legacy Mocks: Mock the AI service boundary, but NO MORE DB mocks!
vi.mock("../services/ai", () => ({
  generateInterviewResponse: vi.fn(),
}));

// Mock Upstash Ratelimit to prevent Invalid URL / network errors during aiProcedure tests
vi.mock("@upstash/ratelimit", () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 }),
  }));
  (Ratelimit as any).slidingWindow = vi.fn();
  return { Ratelimit };
});

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn().mockReturnValue({}),
  },
}));

const FIXED_USER_CUID2 = "tz4a98xxat96iws9zvli3b7z";
const FIXED_INTERVIEW_CUID2 = "tz4a98xxat96iws9zvli3b7x";

const createCaller = createCallerFactory(interviewsRouter);

describe("interviews router (Integration Tests)", () => {
  let db: any;
  let client: PGlite;

  function buildCaller() {
    return createCaller({
      db,
      session: {
        user: {
          id: FIXED_USER_CUID2,
          email: "test@example.com",
          name: "Test User",
          role: "user",
          emailVerified: new Date(),
        },
        expires: "9999-12-31T23:59:59.999Z"
      },
    } as any);
  }

  beforeAll(async () => {
    // 2. Mirror the Service Test Setup (PGlite in-memory Postgres)
    client = new PGlite();
    
    db = drizzle(client, {
      schema: {
        users, usersRelations,
        interviews, interviewsRelations,
        interviewMessages, interviewMessagesRelations,
        interviewCodeSnapshots, interviewCodeSnapshotsRelations,
      }
    });

    await client.exec(`
      CREATE TYPE status AS ENUM ('active', 'completed', 'processing', 'ai_failed');
      CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        email_verified TIMESTAMP,
        image TEXT,
        role TEXT DEFAULT 'user',
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      CREATE TABLE interviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        job_role TEXT NOT NULL,
        status status NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      CREATE TABLE interview_messages (
        id TEXT PRIMARY KEY,
        interview_id TEXT NOT NULL REFERENCES interviews(id),
        role message_role NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP
      );

      CREATE TABLE interview_code_snapshots (
        id TEXT PRIMARY KEY,
        interview_id TEXT NOT NULL REFERENCES interviews(id),
        code TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'javascript',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    
    await client.exec(`
      TRUNCATE TABLE interview_code_snapshots, interview_messages, interviews, users CASCADE;
    `);

    // Seed a valid user for foreign key integrity
    await db.insert(users).values({
      id: FIXED_USER_CUID2,
      name: "Test User",
      email: "test@example.com",
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // interviews.create
  // ═══════════════════════════════════════════════════════════════════════════
  describe("interviews.create", () => {
    it("inserts a new interview and returns the row", async () => {
      const caller = buildCaller();
      const result = await caller.create({
        jobRole: "Senior Frontend Engineer",
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].jobRole).toBe("Senior Frontend Engineer");
      expect(result[0].userId).toBe(FIXED_USER_CUID2);
      expect(result[0].status).toBe("active");
    });

    it("rejects an empty jobRole string to enforce zod boundaries", async () => {
      const caller = buildCaller();
      await expect(
        caller.create({ jobRole: "" })
      ).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // interviews.getById
  // ═══════════════════════════════════════════════════════════════════════════
  describe("interviews.getById", () => {
    it("selects an interview accurately by a valid CUID2", async () => {
      // 3. Fix the Validation Boundary: Using valid CUID2 for the fixture
      await db.insert(interviews).values({
        id: FIXED_INTERVIEW_CUID2,
        userId: FIXED_USER_CUID2,
        jobRole: "Backend Engineer",
      });

      const caller = buildCaller();
      const result = await caller.getById({ id: FIXED_INTERVIEW_CUID2 });
      
      expect(result).toBeDefined();
      expect(result.id).toBe(FIXED_INTERVIEW_CUID2);
      expect(result.jobRole).toBe("Backend Engineer");
    });

    it("rejects a non-CUID2 id payload immediately via Zod", async () => {
      const caller = buildCaller();
      await expect(caller.getById({ id: "bad-id" })).rejects.toThrow();
    });

    it("throws NOT_FOUND if the interview doesn't exist", async () => {
      const caller = buildCaller();
      await expect(caller.getById({ id: FIXED_INTERVIEW_CUID2 })).rejects.toThrowError(
        new TRPCError({ code: "NOT_FOUND", message: "Resource not found" })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // interviews.addTranscriptMessage
  // ═══════════════════════════════════════════════════════════════════════════
  describe("interviews.addTranscriptMessage", () => {
    it("inserts message and returns the row", async () => {
      await db.insert(interviews).values({
        id: FIXED_INTERVIEW_CUID2,
        userId: FIXED_USER_CUID2,
        jobRole: "Engineer",
      });

      const caller = buildCaller();
      const result = await caller.addTranscriptMessage({
        interviewId: FIXED_INTERVIEW_CUID2,
        message: { role: "user", content: "Hello" },
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].interviewId).toBe(FIXED_INTERVIEW_CUID2);
      expect(result[0].role).toBe("user");
      expect(result[0].content).toBe("Hello");
    });

    it("rejects a non-CUID2 interviewId payload via Zod", async () => {
      const caller = buildCaller();
      await expect(
        caller.addTranscriptMessage({
          interviewId: "not-cuid2",
          message: { role: "user", content: "Hello" },
        })
      ).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // interviews.updateStatus
  // ═══════════════════════════════════════════════════════════════════════════
  describe("interviews.updateStatus", () => {
    it("updates status to 'completed' successfully", async () => {
      await db.insert(interviews).values({
        id: FIXED_INTERVIEW_CUID2,
        userId: FIXED_USER_CUID2,
        jobRole: "Engineer",
        status: "active",
      });

      const caller = buildCaller();
      const result = await caller.updateStatus({
        interviewId: FIXED_INTERVIEW_CUID2,
        status: "completed",
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("completed");
    });

    it("rejects an invalid enum status value", async () => {
      const caller = buildCaller();
      await expect(
        caller.updateStatus({
          interviewId: FIXED_INTERVIEW_CUID2,
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
    it("integrates seamlessly through the router caller to processInterviewAnswer", async () => {
      await db.insert(interviews).values({
        id: FIXED_INTERVIEW_CUID2,
        userId: FIXED_USER_CUID2,
        jobRole: "Software Engineer",
      });

      vi.mocked(generateInterviewResponse).mockResolvedValue(
        "What is the time complexity of your solution?"
      );

      const caller = buildCaller();
      const result = await caller.submitAnswer({
        interviewId: FIXED_INTERVIEW_CUID2,
        message: "My solution is O(n log n).",
        code: "function sort(arr) { return arr.sort(); }",
      });

      expect(generateInterviewResponse).toHaveBeenCalledOnce();
      expect(result.aiResponse).toBe("What is the time complexity of your solution?");
      
      const dbMessages = await db.select().from(interviewMessages).where(eq(interviewMessages.interviewId, FIXED_INTERVIEW_CUID2));
      expect(dbMessages).toHaveLength(2); // Ensures both the user message and assistant reply persisted
    });

    it("rejects an empty message payload", async () => {
      const caller = buildCaller();
      await expect(
        caller.submitAnswer({
          interviewId: FIXED_INTERVIEW_CUID2,
          message: "",
          code: "",
        })
      ).rejects.toThrow();
    });

    it("rejects a non-CUID2 interviewId payload", async () => {
      const caller = buildCaller();
      await expect(
        caller.submitAnswer({
          interviewId: "not-cuid2",
          message: "Valid message",
          code: "",
        })
      ).rejects.toThrow();
    });
  });
});

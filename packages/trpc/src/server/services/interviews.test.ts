import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { processInterviewAnswer } from "./interviews";
import { generateInterviewResponse } from "./ai";
import { TRPCError } from "@trpc/server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { 
  users, usersRelations, 
  interviews, interviewsRelations, 
  interviewMessages, interviewMessagesRelations, 
  interviewCodeSnapshots, interviewCodeSnapshotsRelations 
} from "@repo/database/schema";

// 1. Eradicate Fragile Mocks: We only mock the external network boundary now, not the database.
vi.mock("./ai", () => ({
  generateInterviewResponse: vi.fn(),
}));

describe("processInterviewAnswer with in-memory DB", () => {
  let db: any;
  let client: PGlite;
  
  // 3. Update Fixtures to CUID2
  const userId = "tz4a98xxat96iws9zvli3b7z";
  const interviewId = "tz4a98xxat96iws9zvli3b7x";

  beforeAll(async () => {
    // 2. Implement In-Memory Database using PGLite (Real PostgreSQL in WASM)
    client = new PGlite();
    
    // Inject the schema to enable the db.query API within the service
    db = drizzle(client, {
      schema: {
        users, usersRelations,
        interviews, interviewsRelations,
        interviewMessages, interviewMessagesRelations,
        interviewCodeSnapshots, interviewCodeSnapshotsRelations,
      }
    });

    // Execute raw SQL to materialize the Drizzle schema in PGLite
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
    
    // Clear out data between tests
    await client.exec(`
      TRUNCATE TABLE interview_code_snapshots, interview_messages, interviews, users CASCADE;
    `);

    // Seed the foundational data needed for Foreign Key constraints
    await db.insert(users).values({
      id: userId,
      name: "Test User",
      email: "test@example.com",
    });
  });

  const defaultParams = {
    userId,
    interviewId,
    message: "Here is my answer",
    code: "console.log('hello');",
  };

  it("Test Case 1: Idempotency & Race Conditions - rejects if actively processing", async () => {
    // Arrange
    await db.insert(interviews).values({
      id: interviewId,
      userId,
      jobRole: "Software Engineer",
      status: "processing",
    });

    // Act & Assert
    await expect(processInterviewAnswer({ db, ...defaultParams })).rejects.toThrowError(
      new TRPCError({
        code: "CONFLICT",
        message: "Interview is already processing a submission",
      })
    );

    expect(generateInterviewResponse).toHaveBeenCalledTimes(0);
    
    // Verify no Phase 1 messages were inserted due to the early return
    const messages = await db.select().from(interviewMessages).where(eq(interviewMessages.interviewId, interviewId));
    expect(messages).toHaveLength(0);
  });

  it("Test Case 2: The Timeout Rollback - AI failure sets ai_failed status but commits Phase 1", async () => {
    // Arrange
    await db.insert(interviews).values({
      id: interviewId,
      userId,
      jobRole: "Software Engineer",
      status: "active",
    });
    
    const aiError = new Error("AI Timeout");
    vi.mocked(generateInterviewResponse).mockRejectedValueOnce(aiError);

    // Act & Assert
    await expect(processInterviewAnswer({ db, ...defaultParams })).rejects.toThrowError(
      new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate AI response. Please try again.",
        cause: aiError,
      })
    );

    // Verify Phase 1 (database insert for the candidate's code and message) executed and committed
    const messages = await db.select().from(interviewMessages).where(eq(interviewMessages.interviewId, interviewId));
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Here is my answer");
    expect(messages[0].role).toBe("user");

    const snapshots = await db.select().from(interviewCodeSnapshots).where(eq(interviewCodeSnapshots.interviewId, interviewId));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].code).toBe("console.log('hello');");

    // Verify system caught AI error and updated status (Phase 2 rollback equivalent)
    const updatedInterview = await db.select().from(interviews).where(eq(interviews.id, interviewId));
    expect(updatedInterview[0].status).toBe("ai_failed");
  });

  // 4. Write a True Integration Test
  it("Test Case 3: True Integration Test - successful submitAnswer inserts data and AI response", async () => {
    // Arrange
    await db.insert(interviews).values({
      id: interviewId,
      userId,
      jobRole: "Software Engineer",
      status: "active",
    });
    
    vi.mocked(generateInterviewResponse).mockResolvedValueOnce("Great answer! What is the space complexity?");

    // Act
    const result = await processInterviewAnswer({ db, ...defaultParams });

    // Assert the returned payload
    expect(result.aiResponse).toBe("Great answer! What is the space complexity?");
    expect(result.interview.id).toBe(interviewId);
    expect(result.interview.status).toBe("active"); 

    // Assert the database actually contains both the candidate's message and the AI's response
    const messages = await db.select().from(interviewMessages).where(eq(interviewMessages.interviewId, interviewId));
    expect(messages).toHaveLength(2);
    
    const userMsg = messages.find((m: any) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg?.content).toBe("Here is my answer");

    const assistantMsg = messages.find((m: any) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toBe("Great answer! What is the space complexity?");

    // Assert the code snapshot was permanently recorded
    const snapshots = await db.select().from(interviewCodeSnapshots).where(eq(interviewCodeSnapshots.interviewId, interviewId));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].code).toBe("console.log('hello');");
  });
});

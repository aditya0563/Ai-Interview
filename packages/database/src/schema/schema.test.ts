/**
 * packages/database — Integration tests for the users schema.
 *
 * Prerequisites:
 *   • A PostgreSQL instance running at DATABASE_TEST_URL (or DATABASE_URL).
 *   • The schema applied via `pnpm --filter @repo/database db:push` or the
 *     migration SQL executed manually.
 *
 * Execution:
 *   pnpm --filter @repo/database test
 *
 * Isolation strategy:
 *   • beforeAll  — connects once (cheap, single pool per file).
 *   • afterEach  — DELETE all rows in dependency order to reset state.
 *   • afterAll   — closes the postgres connection pool.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../schema";
import {
  users,
  accounts,
  sessions,
  interviews,
  interviewMessages,
  interviewCodeSnapshots,
  reports,
} from "../schema";

// ─── Connection ─────────────────────────────────────────────────────────────

const connectionString =
  process.env["DATABASE_TEST_URL"] ?? process.env["DATABASE_URL"] ?? "";

if (!connectionString) {
  throw new Error(
    "Set DATABASE_TEST_URL (or DATABASE_URL) to a test PostgreSQL instance before running database integration tests."
  );
}

let sql: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  sql = postgres(connectionString, { prepare: false, max: 5 });
  db = drizzle(sql, { schema });
});

afterAll(async () => {
  await sql.end();
});

// Delete in FK-safe order after every test so state never bleeds between cases.
afterEach(async () => {
  await db.delete(reports);
  await db.delete(interviewCodeSnapshots);
  await db.delete(interviewMessages);
  await db.delete(interviews);
  await db.delete(accounts);
  await db.delete(sessions);
  await db.delete(users);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [user] = await db
    .insert(users)
    .values({
      email: `test-${crypto.randomUUID()}@example.com`,
      name: "Test User",
      role: "user",
      ...overrides,
    })
    .returning();
  return user!;
}

async function seedInterview(
  userId: string,
  overrides: Partial<typeof interviews.$inferInsert> = {}
) {
  const [interview] = await db
    .insert(interviews)
    .values({
      userId,
      jobRole: "Software Engineer",
      ...overrides,
    })
    .returning();
  return interview!;
}

// ═══════════════════════════════════════════════════════════════════════════
// users table
// ═══════════════════════════════════════════════════════════════════════════

describe("users table", () => {
  it("inserts a user and assigns a generated id", async () => {
    const user = await seedUser({ email: "alice@example.com", name: "Alice" });
    expect(user.id).toBeTypeOf("string");
    expect(user.id.length).toBeGreaterThan(0);
    expect(user.email).toBe("alice@example.com");
    expect(user.role).toBe("user");
  });

  it("enforces NOT NULL on email", async () => {
    await expect(
      db
        .insert(users)
        .values({ email: null as unknown as string, role: "user" })
        .returning()
    ).rejects.toThrow();
  });

  it("enforces UNIQUE constraint on email", async () => {
    const email = "dupe@example.com";
    await seedUser({ email });
    await expect(seedUser({ email })).rejects.toThrow(/unique/i);
  });

  it("defaults role to 'user'", async () => {
    const user = await seedUser();
    expect(user.role).toBe("user");
  });

  it("selects a user by id", async () => {
    const created = await seedUser({ email: "bob@example.com" });
    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.id, created.id));
    expect(found).toBeDefined();
    expect(found!.email).toBe("bob@example.com");
  });

  it("returns null when selecting a nonexistent user", async () => {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, "nonexistent-id"));
    expect(rows).toHaveLength(0);
  });

  it("restricts delete on user if they have interviews (no cascade)", async () => {
    const user = await seedUser();
    await seedInterview(user.id);

    await expect(
      db.delete(users).where(eq(users.id, user.id))
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// interviews table
// ═══════════════════════════════════════════════════════════════════════════

describe("interviews table", () => {
  it("inserts an interview", async () => {
    const user = await seedUser();
    const interview = await seedInterview(user.id);

    expect(interview.id).toBeTypeOf("string");
    expect(interview.status).toBe("active");
    expect(interview.createdAt).toBeInstanceOf(Date);
  });

  it("stores and retrieves interview messages", async () => {
    const user = await seedUser();
    const interview = await seedInterview(user.id);

    await db.insert(interviewMessages).values({
      interviewId: interview.id,
      role: "assistant",
      content: "Tell me about yourself.",
    });

    await db.insert(interviewMessages).values({
      interviewId: interview.id,
      role: "user",
      content: "I am a full-stack engineer.",
    });

    const messages = await db
      .select()
      .from(interviewMessages)
      .where(eq(interviewMessages.interviewId, interview.id));

    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe("assistant");
    expect(messages[1]!.role).toBe("user");
  });
  
  it("stores and retrieves interview code snapshots", async () => {
    const user = await seedUser();
    const interview = await seedInterview(user.id);

    await db.insert(interviewCodeSnapshots).values({
      interviewId: interview.id,
      code: "console.log('hello world');",
      language: "typescript",
    });

    const snapshots = await db
      .select()
      .from(interviewCodeSnapshots)
      .where(eq(interviewCodeSnapshots.interviewId, interview.id));

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.code).toBe("console.log('hello world');");
    expect(snapshots[0]!.language).toBe("typescript");
  });

  it("updates status from active to completed", async () => {
    const user = await seedUser();
    const interview = await seedInterview(user.id);

    const [updated] = await db
      .update(interviews)
      .set({ status: "completed" })
      .where(eq(interviews.id, interview.id))
      .returning();

    expect(updated!.status).toBe("completed");
  });

  it("enforces FK constraint — userId must exist in users table", async () => {
    await expect(
      db
        .insert(interviews)
        .values({ userId: "nonexistent-user-id", jobRole: "Engineer" })
        .returning()
    ).rejects.toThrow();
  });

  it("restricts delete on interview if it has reports (no cascade)", async () => {
    const user = await seedUser();
    const interview = await seedInterview(user.id);

    await db.insert(reports).values({
      interviewId: interview.id,
      overallScore: 75,
      technicalScore: 70,
      communicationScore: 80,
      detailedFeedback: "Good.",
    });

    await expect(
      db.delete(interviews).where(eq(interviews.id, interview.id))
    ).rejects.toThrow();
  });

  it("selects all interviews for a specific userId", async () => {
    const userA = await seedUser();
    const userB = await seedUser();
    await seedInterview(userA.id, { jobRole: "Frontend Engineer" });
    await seedInterview(userA.id, { jobRole: "Backend Engineer" });
    await seedInterview(userB.id, { jobRole: "DevOps Engineer" });

    const userAInterviews = await db
      .select()
      .from(interviews)
      .where(eq(interviews.userId, userA.id));
    expect(userAInterviews).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// reports table
// ═══════════════════════════════════════════════════════════════════════════

describe("reports table", () => {
  it("inserts a report linked to an interview", async () => {
    const user = await seedUser();
    const interview = await seedInterview(user.id);

    const [report] = await db
      .insert(reports)
      .values({
        interviewId: interview.id,
        overallScore: 88,
        technicalScore: 85,
        communicationScore: 92,
        strengths: ["Clear explanations", "Good use of data structures"],
        improvements: ["Could improve time complexity"],
        detailedFeedback: "Excellent performance overall.",
      })
      .returning();

    expect(report!.id).toBeTypeOf("string");
    expect(report!.overallScore).toBe(88);
    expect(report!.strengths).toEqual([
      "Clear explanations",
      "Good use of data structures",
    ]);
    expect(report!.improvements).toEqual(["Could improve time complexity"]);
  });

  it("stores JSONB arrays correctly for strengths and improvements", async () => {
    const user = await seedUser();
    const interview = await seedInterview(user.id);
    const strengths = ["S1", "S2", "S3"];
    const improvements = ["I1"];

    const [report] = await db
      .insert(reports)
      .values({
        interviewId: interview.id,
        overallScore: 60,
        technicalScore: 55,
        communicationScore: 65,
        strengths,
        improvements,
        detailedFeedback: "Average performance.",
      })
      .returning();

    expect(report!.strengths).toEqual(strengths);
    expect(report!.improvements).toEqual(improvements);
  });

  it("queries reports by interviewId", async () => {
    const user = await seedUser();
    const interviewA = await seedInterview(user.id);
    const interviewB = await seedInterview(user.id);

    await db.insert(reports).values({
      interviewId: interviewA.id,
      overallScore: 70,
      technicalScore: 70,
      communicationScore: 70,
      detailedFeedback: "Report A",
    });
    await db.insert(reports).values({
      interviewId: interviewA.id,
      overallScore: 75,
      technicalScore: 75,
      communicationScore: 75,
      detailedFeedback: "Report A (second)",
    });
    await db.insert(reports).values({
      interviewId: interviewB.id,
      overallScore: 90,
      technicalScore: 90,
      communicationScore: 90,
      detailedFeedback: "Report B",
    });

    const reportsA = await db
      .select()
      .from(reports)
      .where(eq(reports.interviewId, interviewA.id));
    expect(reportsA).toHaveLength(2);

    const reportsB = await db
      .select()
      .from(reports)
      .where(eq(reports.interviewId, interviewB.id));
    expect(reportsB).toHaveLength(1);
  });
});

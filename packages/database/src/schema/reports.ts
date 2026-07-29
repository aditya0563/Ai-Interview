import { integer, jsonb, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { interviews } from "./interviews";

export const reports = pgTable("reports", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  interviewId: text("interview_id")
    .notNull()
    .references(() => interviews.id),
  overallScore: integer("overall_score").notNull(),
  technicalScore: integer("technical_score").notNull(),
  communicationScore: integer("communication_score").notNull(),
  strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
  improvements: jsonb("improvements").$type<string[]>().notNull().default([]),
  detailedFeedback: text("detailed_feedback").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("report_interview_id_idx").on(table.interviewId),
]);

// ─── Relations ────────────────────────────────────────────────────────────────

export const reportsRelations = relations(reports, ({ one }) => ({
  interview: one(interviews, {
    fields: [reports.interviewId],
    references: [interviews.id],
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

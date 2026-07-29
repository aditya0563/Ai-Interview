import { pgEnum, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { reports } from "./reports";

export const statusEnum = pgEnum("status", ["active", "completed", "processing", "ai_failed"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);

export const interviews = pgTable("interviews", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  jobRole: text("job_role").notNull(),
  status: statusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("interview_user_id_idx").on(table.userId),
]);

export const interviewMessages = pgTable("interview_messages", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  interviewId: text("interview_id")
    .notNull()
    .references(() => interviews.id),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("interview_msg_interview_id_idx").on(table.interviewId),
]);

export const interviewCodeSnapshots = pgTable("interview_code_snapshots", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  interviewId: text("interview_id")
    .notNull()
    .references(() => interviews.id),
  code: text("code").notNull(),
  language: text("language").notNull().default("javascript"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("interview_code_interview_id_idx").on(table.interviewId),
]);

// ─── Relations ────────────────────────────────────────────────────────────────

export const interviewsRelations = relations(interviews, ({ one, many }) => ({
  user: one(users, {
    fields: [interviews.userId],
    references: [users.id],
  }),
  messages: many(interviewMessages),
  snapshots: many(interviewCodeSnapshots),
  reports: many(reports),
}));

export const interviewMessagesRelations = relations(interviewMessages, ({ one }) => ({
  interview: one(interviews, {
    fields: [interviewMessages.interviewId],
    references: [interviews.id],
  }),
}));

export const interviewCodeSnapshotsRelations = relations(interviewCodeSnapshots, ({ one }) => ({
  interview: one(interviews, {
    fields: [interviewCodeSnapshots.interviewId],
    references: [interviews.id],
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type Interview = typeof interviews.$inferSelect;
export type NewInterview = typeof interviews.$inferInsert;
export type InterviewMessage = typeof interviewMessages.$inferSelect;
export type NewInterviewMessage = typeof interviewMessages.$inferInsert;
export type InterviewCodeSnapshot = typeof interviewCodeSnapshots.$inferSelect;
export type NewInterviewCodeSnapshot = typeof interviewCodeSnapshots.$inferInsert;

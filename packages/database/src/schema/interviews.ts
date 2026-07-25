import { pgEnum, pgTable, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const statusEnum = pgEnum("status", ["active", "completed"]);

export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobRole: text("job_role").notNull(),
  status: statusEnum("status").notNull().default("active"),
  transcript: jsonb("transcript")
    .$type<Array<{ role: string; content: string }>>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Interview = typeof interviews.$inferSelect;
export type NewInterview = typeof interviews.$inferInsert;

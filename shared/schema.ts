import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, boolean, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const accessTierEnum = pgEnum("access_tier", ["open", "verified", "restricted"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["author_auth", "contributor_auth"]);
export const threadSourceEnum = pgEnum("thread_source", ["native", "email"]);
export const timelineEntryTypeEnum = pgEnum("timeline_entry_type", ["auto", "manual"]);
export const emailIngestionStatusEnum = pgEnum("email_ingestion_status", ["processed", "discarded", "failed"]);
export const planEnum = pgEnum("plan", ["free", "paid"]);

export const authors = pgTable("authors", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }),
  sessionToken: varchar("session_token", { length: 64 }),
  openrouterKey: text("openrouter_key"),
  tokenBalance: integer("token_balance").default(20).notNull(),
  plan: planEnum("plan").default("free").notNull(),
  gistLimit: integer("gist_limit").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gists = pgTable("gists", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 16 }).notNull().unique(),
  authorId: uuid("author_id").references(() => authors.id).notNull(),
  title: text("title").notNull(),
  markdownSource: text("markdown_source").notNull(),
  renderedHtml: text("rendered_html"),
  accessTier: accessTierEnum("access_tier").default("open").notNull(),
  allowList: text("allow_list").array(),
  emailIngestionAddress: varchar("email_ingestion_address", { length: 255 }).unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const contributors = pgTable("contributors", {
  id: uuid("id").primaryKey().defaultRandom(),
  gistId: uuid("gist_id").references(() => gists.id).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  sessionToken: varchar("session_token", { length: 64 }),
  sessionExpiresAt: timestamp("session_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  gistId: uuid("gist_id").references(() => gists.id).notNull(),
  source: threadSourceEnum("source").notNull(),
  sourceLabel: varchar("source_label", { length: 255 }),
  sourceDate: timestamp("source_date"),
  messages: jsonb("messages").notNull().$type<ThreadMessage[]>(),
  summary: text("summary"),
  messageCount: integer("message_count").default(0),
  participantCount: integer("participant_count").default(0),
  anchorBlockIndex: integer("anchor_block_index"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const otps = pgTable("otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  purpose: otpPurposeEnum("purpose").notNull(),
  gistId: uuid("gist_id"),
  attempts: integer("attempts").default(0).notNull(),
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const timelineEntries = pgTable("timeline_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  gistId: uuid("gist_id").references(() => gists.id).notNull(),
  entryDate: timestamp("entry_date").notNull(),
  description: text("description").notNull(),
  entryType: timelineEntryTypeEnum("entry_type").notNull(),
  sourceType: varchar("source_type", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailIngestionLog = pgTable("email_ingestion_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  gistId: uuid("gist_id").references(() => gists.id).notNull(),
  senderEmail: varchar("sender_email", { length: 255 }),
  subject: text("subject"),
  status: emailIngestionStatusEnum("status").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const authorsRelations = relations(authors, ({ many }) => ({
  gists: many(gists),
}));

export const gistsRelations = relations(gists, ({ one, many }) => ({
  author: one(authors, { fields: [gists.authorId], references: [authors.id] }),
  contributors: many(contributors),
  threads: many(threads),
  timelineEntries: many(timelineEntries),
  emailIngestionLogs: many(emailIngestionLog),
}));

export const contributorsRelations = relations(contributors, ({ one }) => ({
  gist: one(gists, { fields: [contributors.gistId], references: [gists.id] }),
}));

export const threadsRelations = relations(threads, ({ one }) => ({
  gist: one(gists, { fields: [threads.gistId], references: [gists.id] }),
}));

export const timelineEntriesRelations = relations(timelineEntries, ({ one }) => ({
  gist: one(gists, { fields: [timelineEntries.gistId], references: [gists.id] }),
}));

export const emailIngestionLogRelations = relations(emailIngestionLog, ({ one }) => ({
  gist: one(gists, { fields: [emailIngestionLog.gistId], references: [gists.id] }),
}));

export interface ThreadMessage {
  authorName: string;
  authorEmail?: string;
  body: string;
  timestamp: string;
}

export const insertAuthorSchema = createInsertSchema(authors).omit({
  id: true,
  createdAt: true,
  sessionToken: true,
  tokenBalance: true,
  plan: true,
  gistLimit: true,
});

export const insertGistSchema = createInsertSchema(gists).omit({
  id: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  renderedHtml: true,
  isActive: true,
});

export const insertContributorSchema = createInsertSchema(contributors).omit({
  id: true,
  createdAt: true,
  sessionToken: true,
  sessionExpiresAt: true,
});

export const insertThreadSchema = createInsertSchema(threads).omit({
  id: true,
  createdAt: true,
  summary: true,
});

export const insertOtpSchema = createInsertSchema(otps).omit({
  id: true,
  createdAt: true,
  attempts: true,
  used: true,
});

export const insertTimelineEntrySchema = createInsertSchema(timelineEntries).omit({
  id: true,
  createdAt: true,
});

export type Author = typeof authors.$inferSelect;
export type InsertAuthor = z.infer<typeof insertAuthorSchema>;
export type Gist = typeof gists.$inferSelect;
export type InsertGist = z.infer<typeof insertGistSchema>;
export type Contributor = typeof contributors.$inferSelect;
export type InsertContributor = z.infer<typeof insertContributorSchema>;
export type Thread = typeof threads.$inferSelect;
export type InsertThread = z.infer<typeof insertThreadSchema>;
export type Otp = typeof otps.$inferSelect;
export type InsertOtp = z.infer<typeof insertOtpSchema>;
export type TimelineEntry = typeof timelineEntries.$inferSelect;
export type InsertTimelineEntry = z.infer<typeof insertTimelineEntrySchema>;
export type EmailIngestionLogEntry = typeof emailIngestionLog.$inferSelect;

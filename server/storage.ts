import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  authors, gists, contributors, threads, otps, timelineEntries, emailIngestionLog,
  type Author, type InsertAuthor,
  type Gist, type InsertGist,
  type Contributor, type InsertContributor,
  type Thread, type InsertThread,
  type Otp, type InsertOtp,
  type TimelineEntry, type InsertTimelineEntry,
  type EmailIngestionLogEntry,
} from "@shared/schema";
import crypto from "crypto";

export interface IStorage {
  getAuthorByEmail(email: string): Promise<Author | undefined>;
  getAuthorById(id: string): Promise<Author | undefined>;
  getAuthorBySessionToken(token: string): Promise<Author | undefined>;
  createAuthor(data: InsertAuthor): Promise<Author>;
  updateAuthorSession(id: string, token: string | null): Promise<void>;
  updateAuthorOpenrouterKey(id: string, key: string): Promise<void>;
  decrementAuthorTokens(id: string): Promise<number>;

  getGistBySlug(slug: string): Promise<Gist | undefined>;
  getGistsByAuthor(authorId: string): Promise<Gist[]>;
  createGist(data: InsertGist & { slug: string }): Promise<Gist>;
  updateGist(slug: string, authorId: string, data: Partial<Pick<Gist, "title" | "markdownSource" | "accessTier" | "allowList">>): Promise<Gist | undefined>;
  softDeleteGist(slug: string, authorId: string): Promise<void>;
  countActiveGists(authorId: string): Promise<number>;

  getContributorsByGist(gistId: string): Promise<Contributor[]>;
  getContributorBySession(token: string): Promise<Contributor | undefined>;
  createContributor(data: InsertContributor): Promise<Contributor>;
  updateContributorSession(id: string, token: string, expiresAt: Date): Promise<void>;

  createOtp(data: InsertOtp): Promise<Otp>;
  getActiveOtp(email: string, purpose: string): Promise<Otp | undefined>;
  markOtpUsed(id: string): Promise<void>;
  incrementOtpAttempts(id: string): Promise<void>;

  getThreadsByGist(gistId: string): Promise<Thread[]>;
  getThreadById(id: string): Promise<Thread | undefined>;
  createThread(data: InsertThread): Promise<Thread>;
  addThreadReply(threadId: string, message: { authorName: string; authorEmail?: string; body: string; timestamp: string }): Promise<Thread | undefined>;

  getTimelineByGist(gistId: string): Promise<TimelineEntry[]>;
  createTimelineEntry(data: InsertTimelineEntry): Promise<TimelineEntry>;
}

export class DatabaseStorage implements IStorage {
  async getAuthorByEmail(email: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.email, email.toLowerCase())).limit(1);
    return author;
  }

  async getAuthorById(id: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.id, id)).limit(1);
    return author;
  }

  async getAuthorBySessionToken(token: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.sessionToken, token)).limit(1);
    return author;
  }

  async createAuthor(data: InsertAuthor): Promise<Author> {
    const [author] = await db.insert(authors).values({ ...data, email: data.email.toLowerCase() }).returning();
    return author;
  }

  async updateAuthorSession(id: string, token: string | null): Promise<void> {
    await db.update(authors).set({ sessionToken: token }).where(eq(authors.id, id));
  }

  async updateAuthorOpenrouterKey(id: string, key: string): Promise<void> {
    await db.update(authors).set({ openrouterKey: key }).where(eq(authors.id, id));
  }

  async decrementAuthorTokens(id: string): Promise<number> {
    const [result] = await db
      .update(authors)
      .set({ tokenBalance: sql`GREATEST(${authors.tokenBalance} - 1, 0)` })
      .where(eq(authors.id, id))
      .returning({ tokenBalance: authors.tokenBalance });
    return result?.tokenBalance ?? 0;
  }

  async getGistBySlug(slug: string): Promise<Gist | undefined> {
    const [gist] = await db.select().from(gists)
      .where(and(eq(gists.slug, slug), isNull(gists.deletedAt), eq(gists.isActive, true)))
      .limit(1);
    return gist;
  }

  async getGistsByAuthor(authorId: string): Promise<Gist[]> {
    return db.select().from(gists)
      .where(and(eq(gists.authorId, authorId), isNull(gists.deletedAt)))
      .orderBy(desc(gists.updatedAt));
  }

  async createGist(data: InsertGist & { slug: string }): Promise<Gist> {
    const [gist] = await db.insert(gists).values(data).returning();
    return gist;
  }

  async updateGist(slug: string, authorId: string, data: Partial<Pick<Gist, "title" | "markdownSource" | "accessTier" | "allowList">>): Promise<Gist | undefined> {
    const [gist] = await db.update(gists)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(gists.slug, slug), eq(gists.authorId, authorId), isNull(gists.deletedAt)))
      .returning();
    return gist;
  }

  async softDeleteGist(slug: string, authorId: string): Promise<void> {
    await db.update(gists)
      .set({ deletedAt: new Date(), isActive: false })
      .where(and(eq(gists.slug, slug), eq(gists.authorId, authorId)));
  }

  async countActiveGists(authorId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(gists)
      .where(and(eq(gists.authorId, authorId), isNull(gists.deletedAt), eq(gists.isActive, true)));
    return result[0]?.count ?? 0;
  }

  async getContributorsByGist(gistId: string): Promise<Contributor[]> {
    return db.select().from(contributors).where(eq(contributors.gistId, gistId));
  }

  async getContributorBySession(token: string): Promise<Contributor | undefined> {
    const [c] = await db.select().from(contributors)
      .where(and(eq(contributors.sessionToken, token), sql`${contributors.sessionExpiresAt} > NOW()`))
      .limit(1);
    return c;
  }

  async createContributor(data: InsertContributor): Promise<Contributor> {
    const [c] = await db.insert(contributors).values(data).returning();
    return c;
  }

  async updateContributorSession(id: string, token: string, expiresAt: Date): Promise<void> {
    await db.update(contributors).set({ sessionToken: token, sessionExpiresAt: expiresAt }).where(eq(contributors.id, id));
  }

  async createOtp(data: InsertOtp): Promise<Otp> {
    const [otp] = await db.insert(otps).values(data).returning();
    return otp;
  }

  async getActiveOtp(email: string, purpose: string): Promise<Otp | undefined> {
    const [otp] = await db.select().from(otps)
      .where(and(
        eq(otps.email, email.toLowerCase()),
        eq(otps.purpose, purpose as any),
        eq(otps.used, false),
        sql`${otps.expiresAt} > NOW()`,
        sql`${otps.attempts} < 3`
      ))
      .orderBy(desc(otps.createdAt))
      .limit(1);
    return otp;
  }

  async markOtpUsed(id: string): Promise<void> {
    await db.update(otps).set({ used: true }).where(eq(otps.id, id));
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    await db.update(otps).set({ attempts: sql`${otps.attempts} + 1` }).where(eq(otps.id, id));
  }

  async getThreadsByGist(gistId: string): Promise<Thread[]> {
    return db.select().from(threads).where(eq(threads.gistId, gistId)).orderBy(desc(threads.createdAt));
  }

  async getThreadById(id: string): Promise<Thread | undefined> {
    const [t] = await db.select().from(threads).where(eq(threads.id, id)).limit(1);
    return t;
  }

  async createThread(data: InsertThread): Promise<Thread> {
    const [t] = await db.insert(threads).values(data as any).returning();
    return t;
  }

  async addThreadReply(threadId: string, message: { authorName: string; authorEmail?: string; body: string; timestamp: string }): Promise<Thread | undefined> {
    const thread = await this.getThreadById(threadId);
    if (!thread) return undefined;

    const messages = [...(thread.messages || []), message];
    const participants = new Set(messages.map(m => m.authorName));

    const [updated] = await db.update(threads)
      .set({
        messages: messages,
        messageCount: messages.length,
        participantCount: participants.size,
      })
      .where(eq(threads.id, threadId))
      .returning();
    return updated;
  }

  async getTimelineByGist(gistId: string): Promise<TimelineEntry[]> {
    return db.select().from(timelineEntries).where(eq(timelineEntries.gistId, gistId)).orderBy(desc(timelineEntries.entryDate));
  }

  async createTimelineEntry(data: InsertTimelineEntry): Promise<TimelineEntry> {
    const [entry] = await db.insert(timelineEntries).values(data).returning();
    return entry;
  }
}

export const storage = new DatabaseStorage();

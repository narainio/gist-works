import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import crypto from "crypto";
import { Resend } from "resend";
import rateLimit from "express-rate-limit";
import { log } from "./index";

const SESSION_COOKIE = "gist_session";
const CONTRIBUTOR_COOKIE = "gist_contributor";
const OTP_MAX_ATTEMPTS = 3;
const CONTRIBUTOR_SESSION_MS = 24 * 60 * 60 * 1000;

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Try again in a few minutes." },
});

async function appendTimelineToMarkdown(gistId: string, slug: string, authorId: string, date: string, description: string): Promise<void> {
  const gist = await storage.getGistBySlug(slug);
  if (!gist) return;
  const newEntry = `> - ${date} · ${description}\n`;
  const timelineHeaderRegex = /> \*\*Timeline:\*\*\n/;
  if (timelineHeaderRegex.test(gist.markdownSource)) {
    const updatedSource = gist.markdownSource.replace(
      timelineHeaderRegex,
      `> **Timeline:**\n${newEntry}`
    );
    await storage.updateGist(slug, authorId, { markdownSource: updatedSource });
  } else {
    const timelineBlock = `\n\n> **Timeline:**\n${newEntry}`;
    await storage.updateGist(slug, authorId, { markdownSource: gist.markdownSource + timelineBlock });
  }
}

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

async function getAuthorFromRequest(req: Request): Promise<any | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  return storage.getAuthorBySessionToken(token);
}

function requireAuthor(req: Request, res: Response, next: NextFunction) {
  getAuthorFromRequest(req).then((author) => {
    if (!author) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    (req as any).author = author;
    next();
  }).catch(next);
}

async function sendOtpEmail(email: string, code: string, purpose: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    log(`[DEV] OTP for ${email}: ${code} (no RESEND_API_KEY set)`, "otp");
    return;
  }

  const resend = new Resend(resendKey);
  const subject = purpose === "author_auth"
    ? `Your Gist sign-in code: ${code}`
    : `Your Gist verification code: ${code}`;

  try {
    await resend.emails.send({
      from: "Gist <onboarding@resend.dev>",
      to: email,
      subject,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="font-size: 18px; font-weight: 600; color: #1C1917; margin-bottom: 8px;">
            Your verification code
          </h2>
          <p style="font-size: 14px; color: #57534E; margin-bottom: 24px;">
            Enter this code to ${purpose === "author_auth" ? "sign in to" : "verify your identity on"} Gist.
          </p>
          <div style="background: #F5F5F4; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #1C1917;">
              ${code}
            </span>
          </div>
          <p style="font-size: 13px; color: #78756F;">
            This code expires in 10 minutes. If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    log(`Failed to send OTP email to ${email}: ${err}`, "otp");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const cookieParser = (await import("cookie-parser")).default;
  app.use(cookieParser(process.env.SESSION_SECRET || "gist-dev-secret"));

  app.post("/api/auth/request-otp", otpLimiter, async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storage.createOtp({
      email: email.toLowerCase(),
      code,
      purpose: "author_auth",
      expiresAt,
    });

    await sendOtpEmail(email, code, "author_auth");

    const response: any = { message: "OTP sent" };
    if (!process.env.RESEND_API_KEY) {
      response.devCode = code;
    }
    res.json(response);
  });

  app.post("/api/auth/verify-otp", otpLimiter, async (req: Request, res: Response) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const otp = await storage.getActiveOtp(email.toLowerCase(), "author_auth");
    if (!otp) {
      return res.status(400).json({ message: "No active code found. Request a new one." });
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many attempts. Request a new code." });
    }

    await storage.incrementOtpAttempts(otp.id);

    if (otp.code !== code) {
      return res.status(400).json({ message: "Invalid code" });
    }

    await storage.markOtpUsed(otp.id);

    let author = await storage.getAuthorByEmail(email.toLowerCase());
    if (!author) {
      author = await storage.createAuthor({ email: email.toLowerCase() });
    }

    const sessionToken = generateSessionToken();
    await storage.updateAuthorSession(author.id, sessionToken);

    res.cookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    const updatedAuthor = await storage.getAuthorById(author.id);
    res.json(updatedAuthor);
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const author = await getAuthorFromRequest(req);
    if (!author) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { openrouterKey, ...safeAuthor } = author;
    res.json({ ...safeAuthor, openrouterKey: openrouterKey ? "***" : null });
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const author = await getAuthorFromRequest(req);
    if (author) {
      await storage.updateAuthorSession(author.id, null);
    }
    res.clearCookie(SESSION_COOKIE);
    res.json({ message: "Logged out" });
  });

  app.get("/api/gists", requireAuthor, async (req: Request, res: Response) => {
    const author = (req as any).author;
    const gistList = await storage.getGistsByAuthor(author.id);
    res.json(gistList);
  });

  app.post("/api/gists", requireAuthor, async (req: Request, res: Response) => {
    const author = (req as any).author;
    const { title, markdownSource } = req.body;

    if (!title || !markdownSource) {
      return res.status(400).json({ message: "Title and markdown source are required" });
    }

    const activeCount = await storage.countActiveGists(author.id);
    if (author.plan === "free" && activeCount >= author.gistLimit) {
      return res.status(403).json({ message: "You've reached your free Gist limit. Upgrade to create more." });
    }

    const slug = generateSlug();
    const gist = await storage.createGist({
      authorId: author.id,
      title,
      markdownSource,
      slug,
    });

    await storage.createTimelineEntry({
      gistId: gist.id,
      entryDate: new Date(),
      description: "Gist created",
      entryType: "auto",
      sourceType: "system",
    });

    res.json(gist);
  });

  app.get("/api/gists/:slug/manage", requireAuthor, async (req: Request, res: Response) => {
    const author = (req as any).author;
    const slug = req.params.slug as string;
    const gist = await storage.getGistBySlug(slug);

    if (!gist || gist.authorId !== author.id) {
      return res.status(404).json({ message: "Gist not found" });
    }

    res.json(gist);
  });

  app.put("/api/gists/:slug", requireAuthor, async (req: Request, res: Response) => {
    const author = (req as any).author;
    const slug = req.params.slug as string;
    const { title, markdownSource, accessTier, allowList } = req.body;

    const updateData: any = {};
    if (title) updateData.title = title;
    if (markdownSource) updateData.markdownSource = markdownSource;
    if (accessTier) updateData.accessTier = accessTier;
    if (allowList !== undefined) updateData.allowList = allowList;

    const updated = await storage.updateGist(slug, author.id, updateData);

    if (!updated) {
      return res.status(404).json({ message: "Gist not found" });
    }

    await storage.createTimelineEntry({
      gistId: updated.id,
      entryDate: new Date(),
      description: "Gist updated",
      entryType: "auto",
      sourceType: "edit",
    });

    res.json(updated);
  });

  app.delete("/api/gists/:slug", requireAuthor, async (req: Request, res: Response) => {
    const author = (req as any).author;
    const slug = req.params.slug as string;
    await storage.softDeleteGist(slug, author.id);
    res.json({ message: "Gist deleted" });
  });

  app.get("/api/g/:slug", async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const gist = await storage.getGistBySlug(slug);
    if (!gist) {
      return res.status(404).json({ message: "Gist not found" });
    }

    if (gist.accessTier === "restricted") {
      const contributorToken = req.cookies?.[CONTRIBUTOR_COOKIE];
      const authorToken = req.cookies?.[SESSION_COOKIE];
      const author = authorToken ? await storage.getAuthorBySessionToken(authorToken) : null;
      const contributor = contributorToken ? await storage.getContributorBySession(contributorToken) : null;

      if (!author || author.id !== gist.authorId) {
        if (!contributor || contributor.gistId !== gist.id) {
          return res.status(403).json({ message: "Access restricted" });
        }
      }
    }

    if (gist.accessTier === "verified") {
      const contributorToken = req.cookies?.[CONTRIBUTOR_COOKIE];
      const authorToken = req.cookies?.[SESSION_COOKIE];
      const author = authorToken ? await storage.getAuthorBySessionToken(authorToken) : null;
      const contributor = contributorToken ? await storage.getContributorBySession(contributorToken) : null;

      if (!author && !contributor) {
        return res.status(401).json({ message: "Email verification required" });
      }
    }

    const gistContributors = await storage.getContributorsByGist(gist.id);
    const timeline = await storage.getTimelineByGist(gist.id);
    const gistThreads = await storage.getThreadsByGist(gist.id);

    res.json({
      ...gist,
      contributors: gistContributors,
      timelineEntries: timeline,
      threads: gistThreads,
    });
  });

  app.get("/api/g/:slug/contributor-status", async (req: Request, res: Response) => {
    const contributorToken = req.cookies?.[CONTRIBUTOR_COOKIE];
    if (!contributorToken) {
      return res.json({ verified: false });
    }
    const contributor = await storage.getContributorBySession(contributorToken);
    if (!contributor) {
      return res.json({ verified: false });
    }
    res.json({ verified: true, contributor });
  });

  app.post("/api/g/:slug/verify", otpLimiter, async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const { email, displayName } = req.body;
    if (!email || !displayName) {
      return res.status(400).json({ message: "Email and display name are required" });
    }

    const gist = await storage.getGistBySlug(slug);
    if (!gist) {
      return res.status(404).json({ message: "Gist not found" });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storage.createOtp({
      email: email.toLowerCase(),
      code,
      purpose: "contributor_auth",
      gistId: gist.id,
      expiresAt,
    });

    await sendOtpEmail(email, code, "contributor_auth");

    const response: any = { message: "OTP sent" };
    if (!process.env.RESEND_API_KEY) {
      response.devCode = code;
    }
    res.json(response);
  });

  app.post("/api/g/:slug/verify/confirm", otpLimiter, async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const otp = await storage.getActiveOtp(email.toLowerCase(), "contributor_auth");
    if (!otp) {
      return res.status(400).json({ message: "No active code found" });
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many attempts. Request a new code." });
    }

    await storage.incrementOtpAttempts(otp.id);
    if (otp.code !== code) {
      return res.status(400).json({ message: "Invalid code" });
    }

    await storage.markOtpUsed(otp.id);

    const gist = await storage.getGistBySlug(slug);
    if (!gist) {
      return res.status(404).json({ message: "Gist not found" });
    }

    const existingContributors = await storage.getContributorsByGist(gist.id);
    let contributor = existingContributors.find((c) => c.email === email.toLowerCase());

    if (!contributor) {
      contributor = await storage.createContributor({
        gistId: gist.id,
        email: email.toLowerCase(),
        displayName: req.body.displayName || email.split("@")[0],
      });

      const joinDate = new Date().toISOString().split("T")[0];
      await storage.createTimelineEntry({
        gistId: gist.id,
        entryDate: new Date(),
        description: `${contributor.displayName} joined as contributor`,
        entryType: "auto",
        sourceType: "contributor",
      });
      await appendTimelineToMarkdown(gist.id, slug, gist.authorId, joinDate, `${contributor.displayName} joined as contributor`);
    }

    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + CONTRIBUTOR_SESSION_MS);
    await storage.updateContributorSession(contributor.id, sessionToken, expiresAt);

    res.cookie(CONTRIBUTOR_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: CONTRIBUTOR_SESSION_MS,
      path: "/",
    });

    res.json({ message: "Verified", contributor });
  });

  app.post("/api/g/:slug/threads", async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const contributorToken = req.cookies?.[CONTRIBUTOR_COOKIE];
    const authorToken = req.cookies?.[SESSION_COOKIE];
    const contributor = contributorToken ? await storage.getContributorBySession(contributorToken) : null;
    const author = authorToken ? await storage.getAuthorBySessionToken(authorToken) : null;

    if (!contributor && !author) {
      return res.status(401).json({ message: "Please verify your email first" });
    }

    const gist = await storage.getGistBySlug(slug);
    if (!gist) {
      return res.status(404).json({ message: "Gist not found" });
    }

    const { message, anchorBlockIndex } = req.body;
    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const authorName = contributor ? contributor.displayName : (author?.displayName || author?.email || "Author");
    const authorEmail = contributor ? contributor.email : author?.email;

    const thread = await storage.createThread({
      gistId: gist.id,
      source: "native",
      messages: [{
        authorName,
        authorEmail,
        body: message,
        timestamp: new Date().toISOString(),
      }],
      messageCount: 1,
      participantCount: 1,
      anchorBlockIndex: typeof anchorBlockIndex === "number" ? anchorBlockIndex : null,
    });

    const threadDate = new Date().toISOString().split("T")[0];
    await storage.createTimelineEntry({
      gistId: gist.id,
      entryDate: new Date(),
      description: `${authorName} started a thread`,
      entryType: "auto",
      sourceType: "thread",
    });
    await appendTimelineToMarkdown(gist.id, slug, gist.authorId, threadDate, `${authorName} started a thread`);

    res.json(thread);
  });

  app.post("/api/g/:slug/threads/:threadId/reply", async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const threadId = req.params.threadId as string;
    const contributorToken = req.cookies?.[CONTRIBUTOR_COOKIE];
    const authorToken = req.cookies?.[SESSION_COOKIE];
    const contributor = contributorToken ? await storage.getContributorBySession(contributorToken) : null;
    const author = authorToken ? await storage.getAuthorBySessionToken(authorToken) : null;

    if (!contributor && !author) {
      return res.status(401).json({ message: "Please verify your email first" });
    }

    const gist = await storage.getGistBySlug(slug);
    if (!gist) {
      return res.status(404).json({ message: "Gist not found" });
    }

    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "Message is required" });
    }

    const authorName = contributor ? contributor.displayName : (author?.displayName || author?.email || "Author");
    const authorEmail = contributor ? contributor.email : author?.email;

    const updated = await storage.addThreadReply(threadId, {
      authorName,
      authorEmail,
      body: message,
      timestamp: new Date().toISOString(),
    });

    if (!updated) {
      return res.status(404).json({ message: "Thread not found" });
    }

    const replyDate = new Date().toISOString().split("T")[0];
    await storage.createTimelineEntry({
      gistId: gist.id,
      entryDate: new Date(),
      description: `${authorName} replied to a thread`,
      entryType: "auto",
      sourceType: "thread",
    });
    await appendTimelineToMarkdown(gist.id, slug, gist.authorId, replyDate, `${authorName} replied to a thread`);

    res.json(updated);
  });

  interface SynthesisConfig {
    model: string;
    max_tokens: number;
    temperature: number;
    prompt: string;
  }

  const synthesisConfigs: Record<string, SynthesisConfig> = {
    executive: {
      model: "google/gemini-2.0-flash-001",
      max_tokens: 400,
      temperature: 0.3,
      prompt: `You synthesize shared context surfaces called "Gists." A Gist is a canonical artifact containing decisions, discussion threads, and timeline entries for a cross-org collaboration.

Your task: write an executive summary for someone who needs to get caught up in 90 seconds.

Rules:
- Write 3 to 5 sentences. No more than 5 sentences. No headers.
- Lead with the single most important current status or decision.
- Mention any open questions or unresolved threads if they exist.
- End with what the reader should know or do next.
- Use **bold** for key decisions or status changes.
- Write in plain language for a senior stakeholder. No jargon.
- Do NOT include a title or "Executive Summary" header — the UI provides that.
- Do NOT use bullet points. Write flowing prose.`,
    },
    full: {
      model: "anthropic/claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.3,
      prompt: `You synthesize shared context surfaces called "Gists." A Gist is a canonical artifact containing decisions, discussion threads, and timeline entries for a cross-org collaboration.

Your task: write a comprehensive summary that covers everything in this Gist.

Rules:
- Use markdown formatting: ## headers for major sections, **bold** for emphasis, bullet lists where appropriate.
- Organize by theme or topic, not by document order. Group related decisions and threads together.
- For each decision, state what was decided and the key rationale (1 sentence each).
- For each active thread, summarize the discussion and note if it's resolved or open.
- Include a "## Timeline" section at the end with the 5 most recent events.
- Write for someone who has never seen this Gist before.
- Target 400 to 800 words. Be thorough but not repetitive.
- Do NOT include a title — the UI provides that.`,
    },
    decisions: {
      model: "google/gemini-2.0-flash-001",
      max_tokens: 1500,
      temperature: 0.1,
      prompt: `You extract and summarize decisions from shared context surfaces called "Gists."

Your task: list every decision found in this Gist in a consistent, structured format.

Rules:
- For each decision, output exactly this format:

**[Decision question or title]**
Decided: [date if available, otherwise "Date not recorded"]
Conclusion: [what was decided — 1 sentence]
Rationale: [why — 1 sentence]

- Separate each decision with a blank line.
- Order decisions reverse-chronologically (most recent first). If dates aren't available, maintain document order.
- If no decisions exist, write: "No decisions have been recorded in this Gist yet."
- Do NOT add commentary, introductions, or conclusions. Just the decisions.
- Do NOT use bullet points within each decision block.`,
    },
    changed: {
      model: "anthropic/claude-sonnet-4-20250514",
      max_tokens: 600,
      temperature: 0.3,
      prompt: `You synthesize shared context surfaces called "Gists." A Gist is a canonical artifact containing decisions, discussion threads, and timeline entries for a cross-org collaboration.

Your task: summarize what has changed recently, as if briefing someone who last looked at this Gist a week ago.

Rules:
- Lead with the most significant recent change.
- Use a bulleted list: each bullet is one change, 1 to 2 sentences.
- Categorize changes by type using **bold** prefixes: **New decision:**, **Thread update:**, **Timeline:**, **Content edit:**
- Focus on the 5 to 10 most recent and meaningful changes. Skip trivial edits.
- If nothing has changed recently, write: "No significant changes since last week."
- Target 150 to 300 words.
- Do NOT include a title or header — the UI provides that.`,
    },
  };

  const tokenCost: Record<string, number> = {
    executive: 1,
    full: 2,
    decisions: 1,
    changed: 2,
  };

  function formatThreadsForAI(threads: any[]): string {
    if (threads.length === 0) return "";

    const formatted = threads.map((thread) => {
      const messages = Array.isArray(thread.messages) ? thread.messages : [];
      const messageText = messages
        .map((msg: any) => `  - ${msg.displayName || msg.authorName || msg.email || "Anonymous"}: ${msg.body || msg.content || ""}`)
        .join("\n");
      return `### Thread: ${thread.sourceLabel || thread.source || "Untitled"} (${thread.createdAt ? new Date(thread.createdAt).toLocaleDateString() : "no date"})\n${messageText || "  (no messages)"}`;
    }).join("\n\n");

    return `\n\n## Threads (${threads.length})\n\n${formatted}`;
  }

  function formatTimelineForAI(timeline: any[]): string {
    if (timeline.length === 0) return "";

    const entries = timeline
      .sort((a: any, b: any) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
      .map((t: any) => `- ${t.entryDate}: ${t.description}`)
      .join("\n");

    return `\n\n## Timeline (${timeline.length} entries)\n\n${entries}`;
  }

  async function callOpenRouter(
    apiKey: string,
    config: SynthesisConfig,
    systemPrompt: string,
    userContent: string,
    referer: string
  ): Promise<globalThis.Response> {
    const makeRequest = async (model: string) => {
      return fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": referer,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          stream: true,
          max_tokens: config.max_tokens,
          temperature: config.temperature,
        }),
      });
    };

    let response = await makeRequest(config.model);

    if (!response.ok && config.model !== "google/gemini-2.0-flash-001") {
      log(`Primary model ${config.model} failed (${response.status}), falling back to Flash`, "synthesis");
      response = await makeRequest("google/gemini-2.0-flash-001");
    }

    return response;
  }

  app.post("/api/g/:slug/synthesize", async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const gist = await storage.getGistBySlug(slug);
    if (!gist) {
      return res.status(404).json({ message: "Gist not found" });
    }

    const { viewType } = req.body;
    const author = await storage.getAuthorById(gist.authorId);
    if (!author) {
      return res.status(500).json({ message: "Author not found" });
    }

    let apiKey = author.openrouterKey;

    if (!apiKey) {
      const cost = tokenCost[viewType] || 1;
      if (author.tokenBalance < cost) {
        return res.status(402).json({ message: "No synthesis tokens remaining. Add your OpenRouter key in Settings." });
      }
      apiKey = process.env.OPENROUTER_API_KEY || "";
    }

    if (!apiKey) {
      return res.status(503).json({ message: "AI synthesis is not configured. Add your OpenRouter key in Settings." });
    }

    const config = synthesisConfigs[viewType] || synthesisConfigs.executive;

    const gistThreads = await storage.getThreadsByGist(gist.id);
    const timeline = await storage.getTimelineByGist(gist.id);

    const context = [
      `## Document Content\n\n${gist.markdownSource}`,
      formatThreadsForAI(gistThreads),
      formatTimelineForAI(timeline),
    ].join("");

    if (!author.openrouterKey) {
      const cost = tokenCost[viewType] || 1;
      for (let i = 0; i < cost; i++) {
        await storage.decrementAuthorTokens(author.id);
      }
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const referer = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000";

    try {
      const response = await callOpenRouter(apiKey, config, config.prompt, context, referer);

      if (!response.ok) {
        const errBody = await response.text();
        log(`OpenRouter error: ${response.status} ${errBody}`, "synthesis");
        res.write(`data: ${JSON.stringify({ content: "Synthesis unavailable right now. The AI service returned an error. You can still read the full Gist below." })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              res.write("data: [DONE]\n\n");
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch {}
          }
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      log(`Synthesis error: ${err}`, "synthesis");
      res.write(`data: ${JSON.stringify({ content: "Synthesis unavailable right now. You can still read the full Gist below." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });

  app.put("/api/settings/openrouter", requireAuthor, async (req: Request, res: Response) => {
    const author = (req as any).author;
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ message: "Key is required" });
    }
    await storage.updateAuthorOpenrouterKey(author.id, key);
    res.json({ message: "Key saved" });
  });

  app.get("/api/g/:slug/export", async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const gist = await storage.getGistBySlug(slug);
    if (!gist) {
      return res.status(404).json({ message: "Gist not found" });
    }

    res.setHeader("Content-Type", "text/markdown");
    res.setHeader("Content-Disposition", `attachment; filename="${gist.slug}.md"`);
    res.send(gist.markdownSource);
  });

  return httpServer;
}

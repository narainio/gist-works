---
name: GitHub empty repository import
description: GitHub imports through the Replit connector need an initial branch before Git-object API uploads.
---

When creating an empty GitHub repository through the Replit connector, create an initial file on `main` with the Contents API before using Git Database endpoints. Upload source blobs at a controlled rate with backoff.

**Why:** The connector returns a 409 for Git blob creation on an empty repository and enforces a low per-Repl request-rate limit.

**How to apply:** Seed `main` first, then create the source-tree commit through the Git APIs with serialized or rate-limited blob uploads. Verify the resulting recursive tree count against the local tracked-file count.
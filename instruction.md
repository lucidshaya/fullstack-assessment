## Take-home assessment

This take-home is the **first step** of our hiring process. We use it to
decide whom to invite to a technical interview, so please treat it as a
screening exercise, not a post-interview formality.

You have been given a starter repository (`fullstack-assessment`). It is
a small storefront + admin order platform built with Node.js / Express /
PostgreSQL / Redis on the backend and React / TypeScript / Vite on the
frontend.

The code runs and the happy path works, but it contains intentional
logical, security, and UX bugs across both stacks. Your job is to find
them and fix them.

### What to do

1. Clone the repo and follow the README to run it locally
   (`docker compose up -d`, then `npm install && npm run dev` in both
   `backend/` and `frontend/`).
2. Identify as many issues as you can. Focus areas: data integrity,
   concurrency, idempotency, authentication / authorization, money
   handling, XSS, frontend state correctness, error handling, and
   accessibility.
3. Fix the issues with production-appropriate changes.
4. Add tests proving the fix for at least the highest-impact backend
   bugs (concurrency, idempotency, auth) and at least one frontend bug.
5. Submit:
   - `FINDINGS.md` - what you found, why it happens, your fix, and
     remaining trade-offs
   - `AI_NOTES.md` - your AI usage notes (see below, this is required)
   - All test files and any infra changes

### Time and deadline

- Up to 8 hours of focused work. Do not exceed this.
- Submit within **5 calendar days** of receiving this brief.
- We would rather see fewer issues fixed well, with tests and reasoning,
  than every issue half-fixed. Note clearly in `FINDINGS.md` anything
  you spotted but did not fix, and why.

If something blocks you (env issue, ambiguous requirement), email us
rather than guessing silently. Asking sensible clarifying questions is a
positive signal.

### AI usage policy

You may use any AI tooling you want (ChatGPT, Cursor, Claude, Copilot,
etc.). We assume you will. We are evaluating _how well_ you use AI, not
whether you used it.

This means:

- Naive AI usage will produce code that appears to work but contains the
  same class of bugs we deliberately seeded. We will notice.
- You must submit `AI_NOTES.md` (template provided in the repo) with:
  1. Tools used
  2. 3 to 5 of your most useful prompts, verbatim, with what you kept
     or rejected
  3. At least one concrete case where AI gave a plausible-looking but
     incorrect, insecure, or unsafe answer, quoted, and how you caught
     and corrected it
  4. How you validated AI-generated code (tests, manual review, docs)
  5. What you did not delegate to AI and why - especially money, auth,
     concurrency, and rendering untrusted input

Submissions without `AI_NOTES.md` will not be reviewed.

### How we evaluate

| Area                                                  | Weight |
| ----------------------------------------------------- | ------ |
| Backend correctness (concurrency, idempotency, dedup) | 35     |
| Frontend correctness + security                       | 25     |
| Tests                                                 | 15     |
| Reasoning quality (`FINDINGS.md`)                     | 10     |
| AI usage quality (`AI_NOTES.md`)                      | 15     |

Strong submissions are advanced to a technical interview where we will
walk through your `FINDINGS.md` and `AI_NOTES.md` together and discuss
your reasoning and trade-offs. Be ready to talk through your decisions,
not just your diff.

### Submission

- Push your work to a **private Git repo** and share access with us, or
  send a zip.
- Make sure `node_modules`, `.env`, and build output are excluded.
- Reply to the email you received with the repo link or zip, your
  `FINDINGS.md`, and your `AI_NOTES.md`.

### Ground rules

- Work on this on your own. Do not pair with another engineer.
- Do not publish the assessment, your solution, or your `AI_NOTES.md` in
  a public repo, gist, or blog post. Keep the repo private.
- Reasonable use of search engines, official docs, Stack Overflow, and
  AI tools is expected and encouraged.

Good luck.

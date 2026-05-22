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

1. **Fork** [`heimdallinc/fullstack-assessment`](https://github.com/heimdallinc/fullstack-assessment)
   on GitHub, then clone your fork locally. Work on a branch in your fork.
2. Follow the README to run it (`docker compose up -d`, then
   `npm install && npm run dev` in both `backend/` and `frontend/`).
3. Identify as many issues as you can. Focus areas: data integrity,
   concurrency, idempotency, authentication / authorization, money
   handling, XSS, frontend state correctness, error handling, and
   accessibility.
4. Fix the issues with production-appropriate changes.
5. Add tests proving the fix for at least the highest-impact backend
   bugs (concurrency, idempotency, auth) and at least one frontend bug.
6. Add to your fork:
   - `FINDINGS.md` - what you found, why it happens, your fix, and
     remaining trade-offs
   - `AI_NOTES.md` - your AI usage notes (see below, this is required)
   - All test files and any infra changes
7. Open a pull request from your fork's branch to
   `heimdallinc/fullstack-assessment` `main` (see Submission below).

### Time and deadline

- Up to 8 hours of focused work. Do not exceed this.
- Submit within **48 hours** of receiving this brief. The PR open time
  is what we go by, so open the PR even if you are still polishing -
  you can keep pushing commits to the same PR until the deadline.
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

Submit your work as a **pull request** from your fork to
`heimdallinc/fullstack-assessment` `main`.

Steps:

1. Fork [`heimdallinc/fullstack-assessment`](https://github.com/heimdallinc/fullstack-assessment).
2. Create a branch in your fork (e.g. `submission/<your-name>`).
3. Commit your fixes, tests, `FINDINGS.md`, and `AI_NOTES.md`.
4. Push the branch to your fork.
5. Open a PR from `your-username/fullstack-assessment:submission/<your-name>`
   to `heimdallinc/fullstack-assessment:main`.
6. Title the PR `Submission - <Your Full Name>`.
7. In the PR description include:
   - A short summary of your approach
   - A link to `FINDINGS.md` and `AI_NOTES.md` in your branch
   - Any setup quirks the reviewer should know about
8. Reply to the email you received with the PR link.

Notes:

- Make sure `node_modules`, `.env`, and build output are not committed
  (the repo's `.gitignore` already excludes them - keep it that way).
- Do not force-push or rebase the branch after the deadline.
- We take the PR's open timestamp as your submission time.

### Ground rules

- Work on this on your own. Do not pair with another engineer.
- Do not publish the assessment, your solution, or your `AI_NOTES.md` in
  a public blog post, gist, social media thread, or any forum. Your
  fork on GitHub is fine and expected. Do not advertise it.
- Reasonable use of search engines, official docs, Stack Overflow, and
  AI tools is expected and encouraged.

Good luck.

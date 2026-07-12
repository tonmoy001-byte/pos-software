<!-- BEGIN:agent-skill-system -->
# Agent Skill System

This project uses a skill-driven execution model. Skills are structured workflows that extend the agent's capabilities.

## Core Rules

- If a task matches a skill, you MUST invoke it
- Skills are located in `skills/<skill-name>/SKILL.md`
- Never implement directly if a skill applies
- Always follow the skill instructions exactly (do not partially apply them)

## Skill Discovery

All skills live in:

```
skills/<skill-name>/SKILL.md
```

The agent should detect when a skill applies and invoke it using the `skill` tool.

## Intent → Skill Mapping

The agent should automatically map user intent to skills:

- Feature / new functionality → `spec-driven-development`, then `incremental-implementation`, `test-driven-development`
- Planning / breakdown → `planning-and-task-breakdown`
- Bug / failure / unexpected behavior → `debugging-and-error-recovery`
- Code review → `code-review-and-quality`
- Refactoring / simplification → `code-simplification`
- API or interface design → `api-and-interface-design`
- UI work → `frontend-ui-engineering`
- Security concerns → `security-and-hardening`
- Performance issues → `performance-optimization`
- Git workflow → `git-workflow-and-versioning`
- CI/CD → `ci-cd-and-automation`
- Documentation → `documentation-and-adrs`
- Shipping / deployment → `shipping-and-launch`

## Lifecycle Mapping (Implicit Commands)

The development lifecycle is encoded implicitly:

- DEFINE → `spec-driven-development`
- PLAN → `planning-and-task-breakdown`
- BUILD → `incremental-implementation` + `test-driven-development`
- VERIFY → `debugging-and-error-recovery`
- REVIEW → `code-review-and-quality`
- SHIP → `shipping-and-launch`

## Execution Model

For every request:

1. Determine if any skill applies (even 1% chance)
2. Invoke the appropriate skill using the `skill` tool
3. Follow the skill workflow strictly
4. Only proceed to implementation after required steps (spec, plan, etc.) are complete

## Anti-Rationalization

The following thoughts are incorrect and must be ignored:

- "This is too small for a skill"
- "I can just quickly implement this"
- "I'll gather context first"

Correct behavior:

- Always check for and use skills first
<!-- END:agent-skill-system -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:verification-rules -->
# Verification After Every Code Change

After ANY code change, you MUST run verification before declaring success:

## Verification Steps

1. **Build check**: `npx next build`
   - Confirm: ✓ Compiled successfully, ✓ Finished TypeScript, ✓ 42/42 pages
   - Fix any type errors before proceeding

2. **Start dev server**: `npm run dev`
   - Wait for: `✓ Ready in Ns` and confirm `http://localhost:3000` responds with 200

3. **Functional test the changed code**: This is the most important step. Test the actual behavior you changed:
   - For **new/modified API routes**: Call them with curl/PowerShell and verify the response body and status code match expectations (e.g., creating a record returns 201 with correct data, listing returns the expected shape)
   - For **new/modified pages**: Use dev-browser to navigate to the page, verify the UI renders correctly, and interact with any forms/buttons to confirm they work end-to-end
   - For **auth or protected routes**: Test both authorized and unauthorized access scenarios
   - For **database changes**: Verify data is correctly created, updated, or deleted via API calls

4. **Smoke test key pages** (curl):
   - `/admin` → 200
   - `/suspended` → 200
   - `/api/health` → 200 (confirms DB connection)
   - `/auth/signin` → 200
   - Admin API routes → 403 (expected without auth)

5. **Report results**: Print a table of checks with pass/fail status.

## Exceptions
- Pre-existing warnings (twilio module, next.config.ts NFT trace) are not blockers
- 403 on admin API routes without auth is expected behavior
<!-- END:verification-rules -->

<!-- BEGIN:commit-push-rules -->
# Commit and Push After Every Successful Test

After completing verification and confirming all tests pass, you MUST commit and push the changes before stopping work. This is not optional.

## Workflow

1. **Inspect state**: `git status` and `git diff` to review what changed
2. **Stage only intended files**: do not stage secrets, logs, or unintended changes
3. **Commit with a descriptive message** that explains the why, not just the what
4. **Push to the current branch's upstream**: `git push` (or `git push -u origin <branch>` if no upstream)
5. **Confirm the push succeeded** by checking `git status` shows "Your branch is up to date"

## Commit Message Style

- Imperative mood: "Fix sales list..." not "Fixed sales list..."
- Reference the affected page/component: `src/app/sales/regular/page.tsx:66`
- Group related changes in a single commit; do not batch unrelated work
- One short subject line, optional body explaining the root cause

## What NOT to Commit

- Generated logs (`dev-server.log`, `prod-server.log`, `build-output.log`) unless explicitly required
- Secrets, `.env` files, or credentials
- Unrelated formatting changes (whitespace-only diffs)

## When to Skip

- If verification FAILED, do not commit — fix first, then verify, then commit
- If the user explicitly says "don't commit" or "hold off", respect that
- If the change is experimental and the user hasn't approved it, ask first
<!-- END:commit-push-rules -->

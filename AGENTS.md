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

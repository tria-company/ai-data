---
phase: quick
plan: 260327-l6k
subsystem: database, scraper
tags: [instagram, puppeteer, supabase, likes, comments, extraction]

requires:
  - phase: none
    provides: existing scraper infrastructure
provides:
  - post_likes and post_comments DB tables
  - extractPostLikes and extractPostComments extraction functions
  - Likes/comments wired into scraper loop with DB persistence
affects: [scraper, database-schema]

tech-stack:
  added: []
  patterns: [engagement-extraction, modal-scraping, per-post-error-isolation]

key-files:
  created: []
  modified:
    - supabase_schema.sql
    - lib/extraction.ts
    - lib/scraper.ts

key-decisions:
  - "Limit engagement extraction to 10 posts per target to stay within Vercel timeout"
  - "Use multiple selector strategies for Instagram DOM resilience"
  - "Per-post error isolation so likes/comments failure never breaks main scrape"

patterns-established:
  - "Engagement extraction: open new tab per post, extract, close tab"
  - "Error isolation: wrap each post's engagement extraction in try/catch"

requirements-completed: [LIKES-EXTRACT, COMMENTS-EXTRACT, DB-SCHEMA]

duration: 2min
completed: 2026-03-27
---

# Quick Task 260327-l6k: Likes and Comments Extraction Summary

**Instagram post likes (usernames) and comments (username+text) extraction with dedicated DB tables and scraper integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T18:17:56Z
- **Completed:** 2026-03-27T18:20:16Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Two new DB tables (post_likes, post_comments) with unique constraints and indices for deduplication
- Two new extraction functions following existing patterns: extractPostLikes (modal-based) and extractPostComments (page-based)
- Full integration into scraper loop with upsert to DB and per-post error isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DB tables for likes and comments** - `1563a5c` (feat)
2. **Task 2: Create extraction functions for likes and comments** - `324e3a5` (feat)
3. **Task 3: Wire extraction into scraper loop and save to DB** - `866db08` (feat)

## Files Created/Modified
- `supabase_schema.sql` - Added post_likes and post_comments table definitions with unique constraints and indices
- `lib/extraction.ts` - Added extractPostLikes (opens likes modal, scrolls, extracts usernames) and extractPostComments (loads more comments, extracts username+text pairs)
- `lib/scraper.ts` - Imports new functions, extracts likes/comments for up to 10 posts per target, upserts to DB

## Decisions Made
- Limited engagement extraction to 10 posts per target to avoid Vercel function timeouts (300s limit)
- Used multiple DOM selector strategies for Instagram resilience (text matching, aria-labels, structural patterns)
- Per-post error isolation: if likes/comments extraction fails for one post, others continue normally
- Returns empty arrays on error rather than throwing, consistent with existing extraction patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**Database migration required.** Run the following SQL on your Supabase instance to create the new tables:

```sql
-- New tables for likes and comments extraction

create table if not exists public.post_likes (
  id uuid not null default gen_random_uuid (),
  postid text not null,
  liker_username text not null,
  created_at timestamp with time zone not null default now(),
  constraint post_likes_pkey primary key (id),
  constraint post_likes_postid_liker_key unique (postid, liker_username)
);

create table if not exists public.post_comments (
  id uuid not null default gen_random_uuid (),
  postid text not null,
  commenter_username text not null,
  comment_text text not null,
  created_at timestamp with time zone not null default now(),
  constraint post_comments_pkey primary key (id),
  constraint post_comments_postid_commenter_text_key unique (postid, commenter_username, comment_text)
);

create index if not exists idx_post_likes_postid on public.post_likes (postid);
create index if not exists idx_post_comments_postid on public.post_comments (postid);
```

## Known Stubs

None - all functions are fully implemented and wired to data sources.

## Next Phase Readiness
- Likes and comments extraction is fully integrated into the scraper flow
- New tables need to be created on the Supabase instance before deploying (see SQL above)
- Frontend may need updates to display likes/comments data if desired

---
*Quick Task: 260327-l6k*
*Completed: 2026-03-27*
